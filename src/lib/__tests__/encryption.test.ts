/**
 * Encryption Library Tests
 *
 * Tests the core crypto functions in isolation. These tests use real
 * Web Crypto API (polyfilled from Node.js crypto module for jsdom).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

// jsdom doesn't provide crypto.subtle — polyfill from Node.js
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true,
    });
  }
});
import {
  deriveKeys,
  encryptNote,
  decryptNote,
  computeContentHash,
  createKeyCheck,
  verifyKeyCheck,
  exportSessionKeys,
  importSessionKeys,
  toBase64,
} from '../encryption';

// Fixed test salt for deterministic key derivation
const TEST_SALT = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const TEST_PASSPHRASE = 'test-passphrase-for-e2ee';
const TEST_NOTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '660e8400-e29b-41d4-a716-446655440001';

describe('encryption', () => {
  describe('deriveKeys', () => {
    it('derives consistent keys from same passphrase and salt', async () => {
      const keys1 = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const keys2 = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);

      // Same salt should be returned
      expect(keys1.salt).toEqual(keys2.salt);

      // Keys should be CryptoKey objects
      expect(keys1.encryptionKey).toBeDefined();
      expect(keys1.hashKey).toBeDefined();
    });

    it('generates random salt when not provided', async () => {
      const keys1 = await deriveKeys(TEST_PASSPHRASE);
      const keys2 = await deriveKeys(TEST_PASSPHRASE);

      // Different salts should be generated
      expect(keys1.salt).not.toEqual(keys2.salt);
      expect(keys1.salt.length).toBe(16);
      expect(keys2.salt.length).toBe(16);
    });
  });

  describe('encryptNote / decryptNote', () => {
    it('roundtrip preserves title and content', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const title = 'My Secret Note';
      const content = '<p>This is <strong>confidential</strong> content.</p>';

      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, title, content, keys);
      const decrypted = await decryptNote(TEST_NOTE_ID, TEST_USER_ID, encrypted, keys.encryptionKey);

      expect(decrypted.title).toBe(title);
      expect(decrypted.content).toBe(content);
    });

    it('roundtrip preserves empty content', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);

      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, '', '', keys);
      const decrypted = await decryptNote(TEST_NOTE_ID, TEST_USER_ID, encrypted, keys.encryptionKey);

      expect(decrypted.title).toBe('');
      expect(decrypted.content).toBe('');
    });

    it('roundtrip preserves unicode content', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const title = 'タイトル 🌸';
      const content = '<p>Wabi-sabi — 侘寂 — finding beauty in imperfection</p>';

      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, title, content, keys);
      const decrypted = await decryptNote(TEST_NOTE_ID, TEST_USER_ID, encrypted, keys.encryptionKey);

      expect(decrypted.title).toBe(title);
      expect(decrypted.content).toBe(content);
    });

    it('wrong key throws on decrypt (GCM tag failure)', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const wrongKeys = await deriveKeys('wrong-passphrase', TEST_SALT);

      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, 'title', 'content', keys);

      await expect(
        decryptNote(TEST_NOTE_ID, TEST_USER_ID, encrypted, wrongKeys.encryptionKey)
      ).rejects.toThrow();
    });

    it('tampered ciphertext throws on decrypt', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, 'title', 'content', keys);

      // Tamper with ciphertext by flipping a character
      const tampered = { ...encrypted };
      const bytes = atob(tampered.ciphertext);
      const flipped = String.fromCharCode(bytes.charCodeAt(0) ^ 0xff) + bytes.slice(1);
      tampered.ciphertext = btoa(flipped);

      await expect(
        decryptNote(TEST_NOTE_ID, TEST_USER_ID, tampered, keys.encryptionKey)
      ).rejects.toThrow();
    });

    it('wrong AAD (different noteId) throws on decrypt', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, 'title', 'content', keys);

      const differentNoteId = '770e8400-e29b-41d4-a716-446655440099';

      await expect(
        decryptNote(differentNoteId, TEST_USER_ID, encrypted, keys.encryptionKey)
      ).rejects.toThrow();
    });

    it('produces different IVs per encryption (no nonce reuse)', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);

      const enc1 = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, 'title', 'content', keys);
      const enc2 = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, 'title', 'content', keys);

      // IVs must be different even for identical plaintext
      expect(enc1.iv).not.toBe(enc2.iv);
      // Ciphertexts should also differ (different IVs → different ciphertext)
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });

    it('sets version to 1', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, 'title', 'content', keys);

      expect(encrypted.version).toBe(1);
    });
  });

  describe('computeContentHash', () => {
    it('same content produces same hash (HMAC consistency)', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);

      const hash1 = await computeContentHash('title', 'content', keys.hashKey);
      const hash2 = await computeContentHash('title', 'content', keys.hashKey);

      expect(hash1).toBe(hash2);
    });

    it('different content produces different hash (HMAC uniqueness)', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);

      const hash1 = await computeContentHash('title', 'content A', keys.hashKey);
      const hash2 = await computeContentHash('title', 'content B', keys.hashKey);

      expect(hash1).not.toBe(hash2);
    });

    it('different title produces different hash', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);

      const hash1 = await computeContentHash('title A', 'content', keys.hashKey);
      const hash2 = await computeContentHash('title B', 'content', keys.hashKey);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('exportSessionKeys / importSessionKeys', () => {
    it('round-trip: imported keys can decrypt what original keys encrypted', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);
      const restored = await importSessionKeys(blob);

      const encrypted = await encryptNote(TEST_NOTE_ID, TEST_USER_ID, 'Secret Title', '<p>Secret</p>', keys);
      const decrypted = await decryptNote(TEST_NOTE_ID, TEST_USER_ID, encrypted, restored.encryptionKey);

      expect(decrypted.title).toBe('Secret Title');
      expect(decrypted.content).toBe('<p>Secret</p>');
    });

    it('round-trip: restored HMAC matches original', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);
      const restored = await importSessionKeys(blob);

      const hash1 = await computeContentHash('title', 'content', keys.hashKey);
      const hash2 = await computeContentHash('title', 'content', restored.hashKey);

      expect(hash1).toBe(hash2);
    });

    it('preserves raw key bytes and salt', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);
      const restored = await importSessionKeys(blob);

      expect(restored.rawEncryptionKey).toEqual(keys.rawEncryptionKey);
      expect(restored.rawHashKey).toEqual(keys.rawHashKey);
      expect(restored.salt).toEqual(keys.salt);
    });

    it('blob includes version field', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);

      expect(blob.version).toBe(2);
      expect(blob).toHaveProperty('checksum');
    });

    it('rejects blob with wrong version', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (blob as any).version = 3;

      await expect(importSessionKeys(blob)).rejects.toThrow('Unsupported session blob version');
    });

    it('rejects blob with wrong key length', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);
      const legacyBlob = {
        version: 1 as const,
        encKey: btoa('short'), // 5 bytes, not 32
        hashKey: blob.hashKey,
        salt: blob.salt,
      };

      await expect(importSessionKeys(legacyBlob)).rejects.toThrow('Invalid encryption key length');
    });

    it('rejects blob with integrity mismatch', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);
      blob.encKey = toBase64(new Uint8Array(32).fill(7));

      await expect(importSessionKeys(blob)).rejects.toThrow('Session blob integrity check failed');
    });

    it('rejects v2 blobs missing a checksum', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blob = exportSessionKeys(keys);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (blob as any).checksum;

      await expect(importSessionKeys(blob)).rejects.toThrow('Missing session blob checksum');
    });

    it('imports legacy v1 blobs for backward compatibility', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const blobV2 = exportSessionKeys(keys);
      const blobV1 = {
        version: 1 as const,
        encKey: blobV2.encKey,
        hashKey: blobV2.hashKey,
        salt: blobV2.salt,
      };

      const restored = await importSessionKeys(blobV1);

      expect(restored.rawEncryptionKey).toEqual(keys.rawEncryptionKey);
      expect(restored.rawHashKey).toEqual(keys.rawHashKey);
      expect(restored.salt).toEqual(keys.salt);
    });
  });

  describe('createKeyCheck / verifyKeyCheck', () => {
    it('key-check roundtrip verification succeeds with correct key', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);

      const { keyCheck, keyCheckIv } = await createKeyCheck(keys.encryptionKey);
      const isValid = await verifyKeyCheck(keys.encryptionKey, keyCheck, keyCheckIv);

      expect(isValid).toBe(true);
    });

    it('key-check verification fails with wrong key', async () => {
      const keys = await deriveKeys(TEST_PASSPHRASE, TEST_SALT);
      const wrongKeys = await deriveKeys('wrong-passphrase', TEST_SALT);

      const { keyCheck, keyCheckIv } = await createKeyCheck(keys.encryptionKey);
      const isValid = await verifyKeyCheck(wrongKeys.encryptionKey, keyCheck, keyCheckIv);

      expect(isValid).toBe(false);
    });
  });
});
