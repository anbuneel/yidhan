/**
 * Share Encryption Tests
 *
 * Tests the E2EE sharing crypto functions: base64url encoding, token/key generation,
 * and the encrypt/decrypt roundtrip with AAD binding.
 */

import { describe, it, expect } from 'vitest';
import {
  toBase64Url,
  fromBase64Url,
  toBase64,
  fromBase64,
  generateShareToken,
  generateShareKey,
  encryptSharePayload,
  decryptSharePayload,
  type SharePayload,
} from '../encryption';

// ============================================================================
// Base64URL encoding
// ============================================================================

describe('toBase64Url / fromBase64Url', () => {
  it('roundtrips arbitrary bytes', () => {
    const original = crypto.getRandomValues(new Uint8Array(32));
    const encoded = toBase64Url(original);
    const decoded = fromBase64Url(encoded);
    expect(decoded).toEqual(original);
  });

  it('produces URL-safe characters only (no +, /, or =)', () => {
    // Run multiple times to catch edge cases
    for (let i = 0; i < 20; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const encoded = toBase64Url(bytes);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    }
  });

  it('roundtrips 16-byte input (token-length)', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const encoded = toBase64Url(bytes);
    expect(encoded.length).toBe(22); // 16 bytes → 22 chars unpadded
    expect(fromBase64Url(encoded)).toEqual(bytes);
  });

  it('roundtrips 32-byte input (key-length)', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const encoded = toBase64Url(bytes);
    expect(encoded.length).toBe(43); // 32 bytes → 43 chars unpadded
    expect(fromBase64Url(encoded)).toEqual(bytes);
  });

  it('is compatible with standard base64 for simple inputs', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const standard = toBase64(input);
    const urlSafe = toBase64Url(input);
    // For this input, they should be identical (no +, /, or padding needed)
    expect(urlSafe).toBe(standard.replace(/=+$/, ''));
    expect(fromBase64Url(urlSafe)).toEqual(fromBase64(standard));
  });

  it('handles empty input', () => {
    const empty = new Uint8Array(0);
    const encoded = toBase64Url(empty);
    expect(encoded).toBe('');
    expect(fromBase64Url(encoded)).toEqual(empty);
  });
});

// ============================================================================
// Token and key generation
// ============================================================================

describe('generateShareToken', () => {
  it('produces a 22-character base64url string', () => {
    const token = generateShareToken();
    expect(token.length).toBe(22);
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('produces unique tokens across calls', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('generateShareKey', () => {
  it('produces 32 random bytes', () => {
    const key = generateShareKey();
    expect(key.length).toBe(32);
    expect(key).toBeInstanceOf(Uint8Array);
  });

  it('produces unique keys across calls', () => {
    const keys = Array.from({ length: 10 }, () => toBase64Url(generateShareKey()));
    const unique = new Set(keys);
    expect(unique.size).toBe(10);
  });
});

// ============================================================================
// Encrypt / decrypt roundtrip
// ============================================================================

const samplePayload: SharePayload = {
  version: 1,
  title: 'Test Note',
  content: '<p>Hello, world!</p>',
  tags: [{ name: 'test', color: 'terracotta' }],
  sharedAt: '2026-03-02T12:00:00.000Z',
};

describe('encryptSharePayload / decryptSharePayload', () => {
  it('roundtrips successfully', async () => {
    const token = generateShareToken();
    const key = generateShareKey();

    const encrypted = await encryptSharePayload(token, key, samplePayload);
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.version).toBe(1);

    const decrypted = await decryptSharePayload(token, key, encrypted);
    expect(decrypted).toEqual(samplePayload);
  });

  it('preserves all payload fields', async () => {
    const token = generateShareToken();
    const key = generateShareKey();
    const payload: SharePayload = {
      version: 1,
      title: 'Multi-tag note with special chars: <>&"\'',
      content: '<h1>Heading</h1><p>Paragraph with <strong>bold</strong></p>',
      tags: [
        { name: 'urgent', color: 'terracotta' },
        { name: 'work', color: 'indigo' },
        { name: 'ideas', color: 'sage' },
      ],
      sharedAt: '2026-03-02T15:30:00.000Z',
    };

    const encrypted = await encryptSharePayload(token, key, payload);
    const decrypted = await decryptSharePayload(token, key, encrypted);
    expect(decrypted).toEqual(payload);
  });

  it('fails with wrong key', async () => {
    const token = generateShareToken();
    const correctKey = generateShareKey();
    const wrongKey = generateShareKey();

    const encrypted = await encryptSharePayload(token, correctKey, samplePayload);

    await expect(
      decryptSharePayload(token, wrongKey, encrypted)
    ).rejects.toThrow();
  });

  it('fails with wrong token (AAD mismatch)', async () => {
    const token1 = generateShareToken();
    const token2 = generateShareToken();
    const key = generateShareKey();

    const encrypted = await encryptSharePayload(token1, key, samplePayload);

    // Try decrypting with a different token (simulates ciphertext swap attack)
    await expect(
      decryptSharePayload(token2, key, encrypted)
    ).rejects.toThrow();
  });

  it('fails with tampered ciphertext', async () => {
    const token = generateShareToken();
    const key = generateShareKey();

    const encrypted = await encryptSharePayload(token, key, samplePayload);

    // Tamper with the ciphertext
    const tampered = { ...encrypted };
    const bytes = fromBase64(tampered.ciphertext);
    bytes[0] ^= 0xff; // flip bits
    tampered.ciphertext = toBase64(bytes);

    await expect(
      decryptSharePayload(token, key, tampered)
    ).rejects.toThrow();
  });

  it('fails with tampered IV', async () => {
    const token = generateShareToken();
    const key = generateShareKey();

    const encrypted = await encryptSharePayload(token, key, samplePayload);

    const tampered = { ...encrypted };
    const ivBytes = fromBase64(tampered.iv);
    ivBytes[0] ^= 0xff;
    tampered.iv = toBase64(ivBytes);

    await expect(
      decryptSharePayload(token, key, tampered)
    ).rejects.toThrow();
  });

  it('produces different ciphertext for same payload (random IV)', async () => {
    const token = generateShareToken();
    const key = generateShareKey();

    const encrypted1 = await encryptSharePayload(token, key, samplePayload);
    const encrypted2 = await encryptSharePayload(token, key, samplePayload);

    // Different IVs → different ciphertexts
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

    // Both should decrypt correctly
    const decrypted1 = await decryptSharePayload(token, key, encrypted1);
    const decrypted2 = await decryptSharePayload(token, key, encrypted2);
    expect(decrypted1).toEqual(samplePayload);
    expect(decrypted2).toEqual(samplePayload);
  });

  it('handles empty title and content', async () => {
    const token = generateShareToken();
    const key = generateShareKey();
    const payload: SharePayload = {
      version: 1,
      title: '',
      content: '',
      tags: [],
      sharedAt: '2026-03-02T00:00:00.000Z',
    };

    const encrypted = await encryptSharePayload(token, key, payload);
    const decrypted = await decryptSharePayload(token, key, encrypted);
    expect(decrypted).toEqual(payload);
  });

  it('handles unicode content', async () => {
    const token = generateShareToken();
    const key = generateShareKey();
    const payload: SharePayload = {
      version: 1,
      title: '日本語タイトル 🎌',
      content: '<p>こんにちは世界 🌍 Привет мир</p>',
      tags: [{ name: '日記', color: 'gold' }],
      sharedAt: '2026-03-02T12:00:00.000Z',
    };

    const encrypted = await encryptSharePayload(token, key, payload);
    const decrypted = await decryptSharePayload(token, key, encrypted);
    expect(decrypted).toEqual(payload);
  });
});

// ============================================================================
// generateSlug (tested via ShareModal, but we can test the pattern)
// ============================================================================

describe('slug generation pattern', () => {
  // generateSlug is in ShareModal.tsx (not exported), so we test the pattern here
  const generateSlug = (title: string): string =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60)
      .replace(/-+$/, '');

  it('converts title to lowercase hyphenated slug', () => {
    expect(generateSlug('My Shopping List')).toBe('my-shopping-list');
  });

  it('strips special characters', () => {
    expect(generateSlug("Today's Plan: Buy Groceries!")).toBe('todays-plan-buy-groceries');
  });

  it('truncates to 60 characters', () => {
    const longTitle = 'A'.repeat(100);
    expect(generateSlug(longTitle).length).toBeLessThanOrEqual(60);
  });

  it('handles empty title', () => {
    expect(generateSlug('')).toBe('');
  });

  it('handles unicode-only title', () => {
    expect(generateSlug('日本語')).toBe('');
  });

  it('collapses multiple spaces into single hyphens', () => {
    expect(generateSlug('hello    world')).toBe('hello-world');
  });

  it('trims trailing hyphens after truncation', () => {
    // Create a title where truncation would leave a trailing hyphen
    const title = 'a-'.repeat(31); // 62 chars, truncated to 60, ends with '-'
    const slug = generateSlug(title);
    expect(slug).not.toMatch(/-$/);
  });
});
