/**
 * Core Encryption Library
 *
 * Pure crypto functions for E2EE. No UI, no React — fully testable in isolation.
 *
 * Encryption model:
 * - Argon2id key derivation (via hash-wasm WASM)
 * - 64-byte output split: first 32 → AES-256-GCM key, last 32 → HMAC-SHA-256 key
 * - AES-GCM with AAD = `${noteId}:${userId}` (prevents note-swapping attacks)
 * - 12-byte random IV per encryption (no nonce reuse)
 * - Title + content encrypted as a single JSON blob
 * - HMAC-SHA-256 content hash for conflict detection
 *
 * All binary data is stored/transmitted as base64 strings.
 */

import { argon2id } from 'hash-wasm';

// ============================================================================
// Types
// ============================================================================

export interface DerivedKeys {
  encryptionKey: CryptoKey;  // AES-256-GCM
  hashKey: CryptoKey;        // HMAC-SHA-256
  salt: Uint8Array;          // 16-byte random salt
}

export interface EncryptedNote {
  ciphertext: string;   // base64
  iv: string;           // base64 (12-byte nonce)
  contentHash: string;  // base64 HMAC-SHA-256
  version: number;      // encryption schema version (1)
}

// ============================================================================
// Helpers
// ============================================================================

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive encryption and HMAC keys from a passphrase using Argon2id.
 *
 * @param passphrase - User's passphrase
 * @param salt - Optional 16-byte salt (generated if not provided)
 * @returns DerivedKeys with AES-256-GCM key, HMAC-SHA-256 key, and salt
 */
export async function deriveKeys(
  passphrase: string,
  salt?: Uint8Array
): Promise<DerivedKeys> {
  // Generate or use provided salt
  const keySalt = salt ?? crypto.getRandomValues(new Uint8Array(16));

  // Argon2id: 64-byte output
  const hashHex = await argon2id({
    password: passphrase,
    salt: keySalt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MB
    hashLength: 64,
    outputType: 'hex',
  });

  // Convert hex to bytes
  const hashBytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    hashBytes[i] = parseInt(hashHex.substring(i * 2, i * 2 + 2), 16);
  }

  // Split: first 32 bytes → AES key, last 32 bytes → HMAC key
  const encKeyRaw = hashBytes.slice(0, 32);
  const hmacKeyRaw = hashBytes.slice(32, 64);

  // Import as CryptoKeys
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    encKeyRaw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const hashKey = await crypto.subtle.importKey(
    'raw',
    hmacKeyRaw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  return { encryptionKey, hashKey, salt: keySalt };
}

// ============================================================================
// Encryption / Decryption
// ============================================================================

/**
 * Encrypt a note's title and content.
 *
 * @param noteId - Note UUID (used in AAD)
 * @param userId - User UUID (used in AAD)
 * @param title - Plaintext title
 * @param content - Plaintext content (HTML)
 * @param keys - Derived encryption and hash keys
 * @returns EncryptedNote with ciphertext, IV, content hash, and version
 */
export async function encryptNote(
  noteId: string,
  userId: string,
  title: string,
  content: string,
  keys: DerivedKeys
): Promise<EncryptedNote> {
  // Serialize title + content as JSON blob
  const plaintext = JSON.stringify({ title, content });
  const plaintextBytes = textEncoder.encode(plaintext);

  // AAD: noteId:userId (prevents note-swapping attacks)
  const aad = textEncoder.encode(`${noteId}:${userId}`);

  // 12-byte random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // AES-256-GCM encrypt
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    keys.encryptionKey,
    plaintextBytes
  );

  // Compute content hash (for conflict detection)
  const contentHash = await computeContentHash(title, content, keys.hashKey);

  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    iv: toBase64(iv),
    contentHash,
    version: 1,
  };
}

/**
 * Decrypt a note's title and content.
 *
 * @param noteId - Note UUID (used in AAD verification)
 * @param userId - User UUID (used in AAD verification)
 * @param encrypted - EncryptedNote data
 * @param encryptionKey - AES-256-GCM key
 * @returns Decrypted { title, content }
 * @throws Error if decryption fails (wrong key, tampered data, wrong AAD)
 */
export async function decryptNote(
  noteId: string,
  userId: string,
  encrypted: Pick<EncryptedNote, 'ciphertext' | 'iv'>,
  encryptionKey: CryptoKey
): Promise<{ title: string; content: string }> {
  const ciphertextBytes = fromBase64(encrypted.ciphertext);
  const ivBytes = fromBase64(encrypted.iv);
  const aad = textEncoder.encode(`${noteId}:${userId}`);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer, additionalData: aad },
    encryptionKey,
    ciphertextBytes.buffer as ArrayBuffer
  );

  const plaintext = textDecoder.decode(plaintextBuffer);
  const { title, content } = JSON.parse(plaintext);
  return { title, content };
}

// ============================================================================
// Content Hashing (for conflict detection)
// ============================================================================

/**
 * Compute HMAC-SHA-256 content hash for conflict detection.
 *
 * @param title - Note title
 * @param content - Note content
 * @param hashKey - HMAC-SHA-256 key
 * @returns base64-encoded HMAC
 */
export async function computeContentHash(
  title: string,
  content: string,
  hashKey: CryptoKey
): Promise<string> {
  const data = textEncoder.encode(JSON.stringify({ title, content }));
  const signature = await crypto.subtle.sign('HMAC', hashKey, data);
  return toBase64(new Uint8Array(signature));
}

// ============================================================================
// Key Check (passphrase verification)
// ============================================================================

/**
 * Create a key-check blob that can be stored in user metadata.
 * Used to verify the passphrase is correct without storing the passphrase itself.
 *
 * Encrypts a known plaintext string with the encryption key. On unlock,
 * we decrypt and verify the known plaintext matches.
 *
 * @param encryptionKey - AES-256-GCM key
 * @returns { keyCheck: base64, keyCheckIv: base64 }
 */
export async function createKeyCheck(
  encryptionKey: CryptoKey
): Promise<{ keyCheck: string; keyCheckIv: string }> {
  const knownPlaintext = textEncoder.encode('yidhan-key-check-v1');
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    knownPlaintext
  );

  return {
    keyCheck: toBase64(new Uint8Array(ciphertext)),
    keyCheckIv: toBase64(iv),
  };
}

/**
 * Verify a passphrase by attempting to decrypt the key-check blob.
 *
 * @param encryptionKey - AES-256-GCM key derived from the passphrase being verified
 * @param keyCheck - Stored key-check ciphertext (base64)
 * @param keyCheckIv - Stored key-check IV (base64)
 * @returns true if passphrase is correct, false otherwise
 */
export async function verifyKeyCheck(
  encryptionKey: CryptoKey,
  keyCheck: string,
  keyCheckIv: string
): Promise<boolean> {
  try {
    const ciphertextBytes = fromBase64(keyCheck);
    const ivBytes = fromBase64(keyCheckIv);

    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer },
      encryptionKey,
      ciphertextBytes.buffer as ArrayBuffer
    );

    const plaintext = textDecoder.decode(plaintextBuffer);
    return plaintext === 'yidhan-key-check-v1';
  } catch {
    // Decryption failed — wrong key
    return false;
  }
}
