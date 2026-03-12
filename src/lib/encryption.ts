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
 * Share encryption model:
 * - Per-share random 32-byte AES-256-GCM key (never reuses vault keys)
 * - Key delivered via URL fragment (#k=<base64url>) — never reaches the server
 * - AAD = `share:<token>:v1` (binds ciphertext to specific share, prevents swap/replay)
 * - Payload: { version, title, content, tags, sharedAt }
 *
 * All binary data is stored/transmitted as base64 strings.
 */

import { argon2id } from 'hash-wasm';

// ============================================================================
// Constants
// ============================================================================

/** Encryption schema version. Increment when changing cipher, KDF, or serialization. */
export const ENCRYPTION_VERSION = 1;
export const SESSION_BLOB_VERSION = 2;

/** Argon2id parameters — changing these invalidates existing derived keys. */
export const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MB
  hashLength: 64,    // 32 bytes encryption key + 32 bytes HMAC key
} as const;

// ============================================================================
// Types
// ============================================================================

export interface DerivedKeys {
  encryptionKey: CryptoKey;  // AES-256-GCM
  hashKey: CryptoKey;        // HMAC-SHA-256
  salt: Uint8Array;          // 16-byte random salt
  /**
   * Raw key bytes for sessionStorage persistence (never sent to server).
   * SECURITY: These are extractable, which reduces XSS resistance compared to
   * non-extractable CryptoKeys. This is the cost of surviving page refresh.
   * Zero these with .fill(0) when locking the vault.
   */
  rawEncryptionKey: Uint8Array;  // 32 bytes
  rawHashKey: Uint8Array;        // 32 bytes
}

/** Legacy serialized key material without corruption detection. */
export interface SessionKeyBlobV1 {
  version: 1;       // blob schema version
  encKey: string;   // base64
  hashKey: string;  // base64
  salt: string;     // base64
}

/** Serialized key material with an integrity checksum for corruption detection. */
export interface SessionKeyBlobV2 {
  version: 2;
  encKey: string;    // base64
  hashKey: string;   // base64
  salt: string;      // base64
  checksum: string;  // hex FNV-1a checksum of the serialized payload
}

export type SessionKeyBlob = SessionKeyBlobV1 | SessionKeyBlobV2;

export interface EncryptedNote {
  ciphertext: string;   // base64
  iv: string;           // base64 (12-byte nonce)
  contentHash: string;  // base64 HMAC-SHA-256
  version: number;      // encryption schema version (1)
}

/** Plaintext payload encrypted inside a share link */
export interface SharePayload {
  version: 1;
  title: string;
  content: string;
  tags: Array<{ name: string; color: string }>;
  sharedAt: string; // ISO 8601
}

/** Encrypted share data stored in the database */
export interface EncryptedShareData {
  ciphertext: string; // base64 (standard — consistent with existing DB storage)
  iv: string;         // base64 (12-byte nonce)
  version: number;    // encryption schema version (1)
}

// ============================================================================
// Helpers
// ============================================================================

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function buildSessionBlobPayload(
  blob: Pick<SessionKeyBlobV1, 'encKey' | 'hashKey' | 'salt'>
): string {
  return `yidhan-session-blob-v2:${blob.encKey}:${blob.hashKey}:${blob.salt}`;
}

function computeSessionBlobChecksum(
  blob: Pick<SessionKeyBlobV1, 'encKey' | 'hashKey' | 'salt'>
): string {
  const bytes = textEncoder.encode(buildSessionBlobPayload(blob));
  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

function hasValidSessionBlobChecksum(blob: SessionKeyBlobV2): boolean {
  return computeSessionBlobChecksum(blob) === blob.checksum;
}

function isSessionKeyBlobV2(blob: SessionKeyBlob): blob is SessionKeyBlobV2 {
  return blob.version === SESSION_BLOB_VERSION;
}

// TS 5.9 narrows Uint8Array to Uint8Array<ArrayBufferLike> which is not
// assignable to BufferSource. At runtime, crypto.subtle.importKey accepts
// Uint8Array directly. Cast through BufferSource to satisfy the type checker.

/** Import raw bytes as a non-extractable AES-256-GCM CryptoKey */
async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Import raw bytes as a non-extractable HMAC-SHA-256 CryptoKey */
async function importHmacKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

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
    parallelism: ARGON2_PARAMS.parallelism,
    iterations: ARGON2_PARAMS.iterations,
    memorySize: ARGON2_PARAMS.memorySize,
    hashLength: ARGON2_PARAMS.hashLength,
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

  // Import as non-extractable CryptoKeys
  const encryptionKey = await importAesKey(encKeyRaw);
  const hashKey = await importHmacKey(hmacKeyRaw);

  return { encryptionKey, hashKey, salt: keySalt, rawEncryptionKey: encKeyRaw, rawHashKey: hmacKeyRaw };
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
    version: ENCRYPTION_VERSION,
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
    { name: 'AES-GCM', iv: new Uint8Array(ivBytes), additionalData: aad },
    encryptionKey,
    new Uint8Array(ciphertextBytes)
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
// Session Key Persistence (sessionStorage export/import)
// ============================================================================

/**
 * Export derived keys to a serializable blob for sessionStorage.
 * Uses raw key bytes cached at derive time (keys remain non-extractable).
 */
export function exportSessionKeys(keys: DerivedKeys): SessionKeyBlob {
  const payload = {
    encKey: toBase64(keys.rawEncryptionKey),
    hashKey: toBase64(keys.rawHashKey),
    salt: toBase64(keys.salt),
  };

  return {
    version: SESSION_BLOB_VERSION,
    ...payload,
    checksum: computeSessionBlobChecksum(payload),
  };
}

/**
 * Import keys from a session blob back into DerivedKeys.
 * Re-imports raw bytes as non-extractable CryptoKeys.
 */
export async function importSessionKeys(blob: SessionKeyBlob): Promise<DerivedKeys> {
  const version = blob.version as number;
  if (version !== 1 && version !== SESSION_BLOB_VERSION) {
    throw new Error(`Unsupported session blob version: ${version}`);
  }

  if (version === SESSION_BLOB_VERSION && isSessionKeyBlobV2(blob)) {
    if (!blob.checksum) {
      throw new Error('Missing session blob checksum');
    }
    if (!hasValidSessionBlobChecksum(blob)) {
      throw new Error('Session blob integrity check failed');
    }
  }

  const rawEncryptionKey = fromBase64(blob.encKey);
  const rawHashKey = fromBase64(blob.hashKey);
  const salt = fromBase64(blob.salt);

  if (rawEncryptionKey.length !== 32) throw new Error(`Invalid encryption key length: expected 32, got ${rawEncryptionKey.length}`);
  if (rawHashKey.length !== 32) throw new Error(`Invalid HMAC key length: expected 32, got ${rawHashKey.length}`);
  if (salt.length !== 16) throw new Error(`Invalid salt length: expected 16, got ${salt.length}`);

  const encryptionKey = await importAesKey(rawEncryptionKey);
  const hashKey = await importHmacKey(rawHashKey);

  return { encryptionKey, hashKey, salt, rawEncryptionKey, rawHashKey };
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
      { name: 'AES-GCM', iv: new Uint8Array(ivBytes) },
      encryptionKey,
      new Uint8Array(ciphertextBytes)
    );

    const plaintext = textDecoder.decode(plaintextBuffer);
    return plaintext === 'yidhan-key-check-v1';
  } catch {
    // Decryption failed — wrong key
    return false;
  }
}

// ============================================================================
// URL-safe Base64 (for share links)
// ============================================================================

/** Convert bytes to URL-safe base64 (RFC 4648 S5): no +, /, or = padding */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Convert URL-safe base64 back to bytes */
export function fromBase64Url(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 1) throw new Error('Invalid base64url string: length cannot be 4n+1');
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  return fromBase64(b64);
}

// ============================================================================
// Share Encryption (capability-link model)
// ============================================================================

/**
 * Generate a share token: 16 random bytes → 22-char base64url (128-bit entropy).
 * Used as the server-side lookup key for the encrypted share payload.
 */
export function generateShareToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Generate a random 32-byte share key.
 * This key is ephemeral — it exists only in the URL fragment and the sharer's clipboard.
 */
export function generateShareKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Encrypt a share payload with a per-share random key.
 *
 * @param token - Share token (used in AAD to bind ciphertext to this share)
 * @param shareKey - 32-byte random AES key
 * @param payload - Plaintext share payload (title, content, tags, sharedAt)
 * @returns EncryptedShareData with ciphertext, IV, and version
 */
export async function encryptSharePayload(
  token: string,
  shareKey: Uint8Array,
  payload: SharePayload
): Promise<EncryptedShareData> {
  const plaintextBytes = textEncoder.encode(JSON.stringify(payload));
  const aad = textEncoder.encode(`share:${token}:v1`);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await importAesKey(shareKey);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    key,
    plaintextBytes
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    iv: toBase64(iv),
    version: ENCRYPTION_VERSION,
  };
}

/**
 * Decrypt a share payload using the key from the URL fragment.
 *
 * @param token - Share token (used to reconstruct AAD)
 * @param shareKeyBytes - 32-byte AES key from the URL fragment
 * @param encrypted - Encrypted share data from the server
 * @returns Decrypted SharePayload
 * @throws Error if decryption fails (wrong key, tampered data, wrong token)
 */
export async function decryptSharePayload(
  token: string,
  shareKeyBytes: Uint8Array,
  encrypted: EncryptedShareData
): Promise<SharePayload> {
  if (encrypted.version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported share encryption version: ${encrypted.version}`);
  }

  const ciphertextBytes = fromBase64(encrypted.ciphertext);
  const ivBytes = fromBase64(encrypted.iv);
  const aad = textEncoder.encode(`share:${token}:v1`);

  const key = await importAesKey(shareKeyBytes);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBytes), additionalData: aad },
    key,
    new Uint8Array(ciphertextBytes)
  );

  const plaintext = textDecoder.decode(plaintextBuffer);
  const payload = JSON.parse(plaintext);

  if (payload.version !== 1) {
    throw new Error(`Unsupported share payload version: ${payload.version}`);
  }
  if (typeof payload.title !== 'string' || typeof payload.content !== 'string' || !Array.isArray(payload.tags)) {
    throw new Error('Invalid share payload structure');
  }

  return payload as SharePayload;
}
