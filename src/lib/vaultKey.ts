/**
 * Wrapped master key (item 24).
 *
 * The design is `docs/plans/2026-09-07-key-migration-and-rotation-design.md`.
 *
 * - `K` is the 64 bytes the legacy derivation already produces:
 *   `rawEncryptionKey || rawHashKey`. The migration adopts them as-is, so no note
 *   is re-encrypted and every `content_hash` stays valid. §1, §3.
 * - The KEK is Argon2id over the passphrase and a fresh 16-byte `kekSalt`, with the
 *   legacy cost constants but a 32-byte output: it is one AES-256-GCM key. §1.
 * - `wrap(KEK, K)` is AES-256-GCM with AAD `vault:<userId>:<wrapVersion>`. §1.
 * - The vault key-check is encrypted under `K`, not the KEK, because the restore
 *   paths never run an unwrap. §1.2.
 *
 * Everything here is pure: no React, no Supabase.
 */

import { argon2id } from 'hash-wasm';
import {
  ARGON2_PARAMS,
  KEY_CHECK_VERSION,
  createKeyCheck,
  fromBase64,
  importAesKey,
  importHmacKey,
  toBase64,
  verifyKeyCheck,
} from './encryption';
import type { DerivedKeys, KeyCheckVersion } from './encryption';

// ============================================================================
// Constants
// ============================================================================

/** Wrap schema version (`vault.version`). */
export const VAULT_VERSION = 1;

/** `wrapVersion` a migrated vault starts at. Every later key change increments it. */
export const INITIAL_WRAP_VERSION = 1;

/** `keyCheckVersion` a migrated vault starts at. Bumped on every key change (§2.2). */
const INITIAL_VAULT_KEY_CHECK_VERSION = 1;

const MASTER_KEY_LENGTH_BYTES = 64;
const KEK_SALT_LENGTH_BYTES = 16;
const WRAP_IV_LENGTH_BYTES = 12;
/** AES-GCM ciphertext of the 64-byte `K` plus the 16-byte tag. */
const WRAPPED_KEY_LENGTH_BYTES = MASTER_KEY_LENGTH_BYTES + 16;

/**
 * KEK derivation parameters: the legacy cost, but 32 bytes of output. The legacy
 * `hashLength` is 64 because that derivation is split into two keys; a KEK is one
 * AES-256-GCM key and 64 bytes cannot be imported as one (test 24-T8).
 */
export const KEK_ARGON2_PARAMS = {
  parallelism: ARGON2_PARAMS.parallelism,
  iterations: ARGON2_PARAMS.iterations,
  memorySize: ARGON2_PARAMS.memorySize,
  hashLength: 32,
} as const;

// ============================================================================
// Types
// ============================================================================

/** The `user_metadata.vault` object (§1.1). */
export interface VaultMetadata {
  version: typeof VAULT_VERSION;
  wrapVersion: number;
  kekSalt: string;      // base64, 16 bytes
  wrappedKey: string;   // base64, AES-GCM(KEK, K)
  wrapIv: string;       // base64, 12 bytes
  keyCheck: string;     // base64, key-check under K
  keyCheckIv: string;   // base64
  keyCheckVersion: number;
  migratedAt: string;   // ISO timestamp
}

/**
 * What a client finds in `user_metadata.vault`.
 *
 * - `absent`: never migrated. Legacy unlock, then migrate.
 * - `valid`: unwrap path.
 * - `unsupported`: a vault version this client does not know. Behave like an old
 *   client (§3.3): use the legacy fields, never overwrite the vault.
 * - `malformed`: a version-1 vault that is not complete. §3.2 says this is not
 *   reachable by the migration, so it is corruption: use the legacy fields and
 *   leave it alone rather than overwrite something we cannot read.
 */
export type VaultReadResult =
  | { status: 'absent' }
  | { status: 'valid'; vault: VaultMetadata }
  | { status: 'unsupported'; version: unknown }
  | { status: 'malformed' };

class VaultUnwrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultUnwrapError';
  }
}

// ============================================================================
// Reading the metadata
// ============================================================================

/** Decoded byte length of a base64 string, or -1 if it is not base64. */
function base64ByteLength(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) return -1;
  try {
    return atob(value).length;
  } catch {
    return -1;
  }
}

function isBase64OfLength(value: unknown, length: number): value is string {
  return base64ByteLength(value) === length;
}

function isNonEmptyBase64(value: unknown): value is string {
  return base64ByteLength(value) > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** Classify `user_metadata.vault`. Never throws. */
export function readVaultMetadata(raw: unknown): VaultReadResult {
  if (raw == null) {
    return { status: 'absent' };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'malformed' };
  }

  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== VAULT_VERSION) {
    return { status: 'unsupported', version: candidate.version };
  }

  if (
    !isPositiveInteger(candidate.wrapVersion)
    || !isBase64OfLength(candidate.kekSalt, KEK_SALT_LENGTH_BYTES)
    || !isBase64OfLength(candidate.wrappedKey, WRAPPED_KEY_LENGTH_BYTES)
    || !isBase64OfLength(candidate.wrapIv, WRAP_IV_LENGTH_BYTES)
    || !isNonEmptyBase64(candidate.keyCheck)
    || !isBase64OfLength(candidate.keyCheckIv, WRAP_IV_LENGTH_BYTES)
    || !isPositiveInteger(candidate.keyCheckVersion)
    || typeof candidate.migratedAt !== 'string'
    || candidate.migratedAt.length === 0
  ) {
    return { status: 'malformed' };
  }

  return {
    status: 'valid',
    vault: {
      version: VAULT_VERSION,
      wrapVersion: candidate.wrapVersion,
      kekSalt: candidate.kekSalt,
      wrappedKey: candidate.wrappedKey,
      wrapIv: candidate.wrapIv,
      keyCheck: candidate.keyCheck,
      keyCheckIv: candidate.keyCheckIv,
      keyCheckVersion: candidate.keyCheckVersion,
      migratedAt: candidate.migratedAt,
    },
  };
}

/**
 * The key-check a restore path must verify against (§1.2, §2.2). A migrated
 * account verifies `K` against the vault's key-check; anything else uses the
 * legacy one.
 */
export function selectKeyCheck(metadata: Record<string, unknown> | undefined): {
  source: 'vault' | 'legacy';
  keyCheck: string | undefined;
  keyCheckIv: string | undefined;
  keyCheckVersion: unknown;
} {
  const vault = readVaultMetadata(metadata?.vault);
  if (vault.status === 'valid') {
    return {
      source: 'vault',
      keyCheck: vault.vault.keyCheck,
      keyCheckIv: vault.vault.keyCheckIv,
      // The vault key-check is always written in the current key-check format.
      // `vault.keyCheckVersion` is a generation counter, not the format.
      keyCheckVersion: KEY_CHECK_VERSION,
    };
  }
  return {
    source: 'legacy',
    keyCheck: metadata?.encryption_key_check as string | undefined,
    keyCheckIv: metadata?.encryption_key_check_iv as string | undefined,
    keyCheckVersion: metadata?.encryption_key_check_version,
  };
}

// ============================================================================
// Key material
// ============================================================================

/** Zero both raw halves of a key set. */
function zeroKeys(keys: DerivedKeys): void {
  keys.rawEncryptionKey.fill(0);
  keys.rawHashKey.fill(0);
}

/** Constant-length byte comparison without making copies of the key. */
function keysMatchMaster(keys: DerivedKeys, master: Uint8Array): boolean {
  if (keys.rawEncryptionKey.length !== 32 || keys.rawHashKey.length !== 32) return false;
  if (master.length !== MASTER_KEY_LENGTH_BYTES) return false;
  let diff = 0;
  for (let i = 0; i < 32; i++) {
    diff |= keys.rawEncryptionKey[i] ^ master[i];
    diff |= keys.rawHashKey[i] ^ master[32 + i];
  }
  return diff === 0;
}

function buildWrapAad(userId: string, wrapVersion: number): Uint8Array {
  return new TextEncoder().encode(`vault:${userId}:${wrapVersion}`);
}

/**
 * Copy `K` out of a key set: `rawEncryptionKey || rawHashKey`.
 *
 * Call this synchronously, before any `await`: locking the vault zeroes the
 * originals in place, and a copy taken after that would be 64 zero bytes.
 */
export function copyMasterKey(keys: DerivedKeys): Uint8Array {
  if (keys.rawEncryptionKey.length !== 32 || keys.rawHashKey.length !== 32) {
    throw new Error('Master key halves must be 32 bytes each');
  }
  const master = new Uint8Array(MASTER_KEY_LENGTH_BYTES);
  master.set(keys.rawEncryptionKey, 0);
  master.set(keys.rawHashKey, 32);
  return master;
}

/** Re-import 64 bytes of `K` as the AES half and the HMAC half. */
export async function importMasterKey(master: Uint8Array, salt: Uint8Array): Promise<DerivedKeys> {
  if (master.length !== MASTER_KEY_LENGTH_BYTES) {
    throw new Error(`Invalid master key length: expected ${MASTER_KEY_LENGTH_BYTES}, got ${master.length}`);
  }
  const rawEncryptionKey = master.slice(0, 32);
  const rawHashKey = master.slice(32, 64);
  const encryptionKey = await importAesKey(rawEncryptionKey);
  const hashKey = await importHmacKey(rawHashKey);
  return { encryptionKey, hashKey, salt, rawEncryptionKey, rawHashKey };
}

/** Import 32 raw bytes as a non-extractable AES-256-GCM KEK. Throws on any other length. */
export async function importKek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Argon2id over the passphrase and `kekSalt`, 32 bytes out. */
export async function deriveKekBytes(passphrase: string, kekSalt: Uint8Array): Promise<Uint8Array> {
  if (kekSalt.length !== KEK_SALT_LENGTH_BYTES) {
    throw new Error(`Invalid KEK salt length: expected ${KEK_SALT_LENGTH_BYTES}, got ${kekSalt.length}`);
  }
  return argon2id({
    password: passphrase,
    salt: kekSalt,
    parallelism: KEK_ARGON2_PARAMS.parallelism,
    iterations: KEK_ARGON2_PARAMS.iterations,
    memorySize: KEK_ARGON2_PARAMS.memorySize,
    hashLength: KEK_ARGON2_PARAMS.hashLength,
    outputType: 'binary',
  });
}

/** Derive the KEK as a CryptoKey. The raw bytes are zeroed after import. */
export async function deriveKek(passphrase: string, kekSalt: Uint8Array): Promise<CryptoKey> {
  const raw = await deriveKekBytes(passphrase, kekSalt);
  try {
    return await importKek(raw);
  } finally {
    raw.fill(0);
  }
}

/** `wrap(KEK, K)`: AES-256-GCM, fresh 12-byte IV, AAD `vault:<userId>:<wrapVersion>`. */
export async function wrapMasterKey(
  kek: CryptoKey,
  master: Uint8Array,
  userId: string,
  wrapVersion: number
): Promise<{ wrappedKey: string; wrapIv: string }> {
  if (master.length !== MASTER_KEY_LENGTH_BYTES) {
    throw new Error(`Invalid master key length: expected ${MASTER_KEY_LENGTH_BYTES}, got ${master.length}`);
  }
  const iv = crypto.getRandomValues(new Uint8Array(WRAP_IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: buildWrapAad(userId, wrapVersion) as BufferSource },
    kek,
    master as BufferSource
  );
  return { wrappedKey: toBase64(new Uint8Array(ciphertext)), wrapIv: toBase64(iv) };
}

/** Unwrap `K`. Throws `VaultUnwrapError` on a wrong KEK, wrong user, wrong version or tampering. */
export async function unwrapMasterKey(
  kek: CryptoKey,
  vault: Pick<VaultMetadata, 'wrappedKey' | 'wrapIv' | 'wrapVersion'>,
  userId: string
): Promise<Uint8Array> {
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(vault.wrapIv) as BufferSource,
        additionalData: buildWrapAad(userId, vault.wrapVersion) as BufferSource,
      },
      kek,
      fromBase64(vault.wrappedKey) as BufferSource
    );
  } catch {
    throw new VaultUnwrapError('Vault key did not unwrap');
  }
  const master = new Uint8Array(plaintext);
  if (master.length !== MASTER_KEY_LENGTH_BYTES) {
    master.fill(0);
    throw new VaultUnwrapError('Unwrapped vault key has the wrong length');
  }
  return master;
}

// ============================================================================
// Migration (§3)
// ============================================================================

function generateKekSalt(legacySalt: Uint8Array): Uint8Array {
  // The KEK salt must not be the legacy salt (§1, 24-T6). A collision between two
  // random 16-byte values is not going to happen, but the check costs nothing.
  for (;;) {
    const salt = crypto.getRandomValues(new Uint8Array(KEK_SALT_LENGTH_BYTES));
    if (toBase64(salt) !== toBase64(legacySalt)) return salt;
  }
}

export interface BuildVaultOptions {
  passphrase: string;
  /** 64 bytes of `K`, taken with `copyMasterKey`. Not modified. */
  master: Uint8Array;
  /** The legacy `encryption_salt`, decoded. */
  legacySalt: Uint8Array;
  userId: string;
  /** The legacy key-check. `K` must verify against it before anything is wrapped. */
  legacyKeyCheck: { keyCheck: string; keyCheckIv: string; keyCheckVersion: KeyCheckVersion };
  now?: Date;
}

/**
 * Build the complete `vault` object for a first migration (§3.1 step 2).
 *
 * Pure computation, then three self-checks before the caller writes anything:
 * `K` still verifies the legacy key-check (so it is the real key, not zeroed
 * memory), the new wrap unwraps to the same 64 bytes with the same passphrase,
 * and the new key-check verifies under `K`. A vault that fails any of these is
 * never returned, so it can never be written.
 */
export async function buildMigratedVault({
  passphrase,
  master,
  legacySalt,
  userId,
  legacyKeyCheck,
  now = new Date(),
}: BuildVaultOptions): Promise<VaultMetadata> {
  const keys = await importMasterKey(master, legacySalt);
  try {
    const legacyOk = await verifyKeyCheck(
      keys.encryptionKey,
      legacyKeyCheck.keyCheck,
      legacyKeyCheck.keyCheckIv,
      userId,
      legacyKeyCheck.keyCheckVersion
    );
    if (!legacyOk) {
      throw new Error('Master key does not verify the legacy key-check; refusing to wrap it');
    }

    const kekSalt = generateKekSalt(legacySalt);
    const kek = await deriveKek(passphrase, kekSalt);
    const wrapVersion = INITIAL_WRAP_VERSION;
    const { wrappedKey, wrapIv } = await wrapMasterKey(kek, master, userId, wrapVersion);
    const { keyCheck, keyCheckIv } = await createKeyCheck(keys.encryptionKey, userId);

    const vault: VaultMetadata = {
      version: VAULT_VERSION,
      wrapVersion,
      kekSalt: toBase64(kekSalt),
      wrappedKey,
      wrapIv,
      keyCheck,
      keyCheckIv,
      keyCheckVersion: INITIAL_VAULT_KEY_CHECK_VERSION,
      migratedAt: now.toISOString(),
    };

    // Self-check: the vault we are about to write must open with this KEK and
    // yield exactly these 64 bytes, and its key-check must verify under them.
    const reopened = await openVaultWithKek(kek, vault, userId, legacySalt);
    try {
      if (!reopened || !keysMatchMaster(reopened, master)) {
        throw new Error('Built vault did not reopen to the same master key');
      }
    } finally {
      if (reopened) zeroKeys(reopened);
    }

    return vault;
  } finally {
    zeroKeys(keys);
  }
}

/**
 * Unlock through the vault: derive the KEK, unwrap `K`, verify the vault
 * key-check under `K`.
 *
 * Returns `null` when the passphrase does not open the vault — a wrong
 * passphrase, or a vault whose wrap or key-check does not hold. The caller
 * decides what to do next; it must not unlock on `null`.
 */
export async function unlockVault(
  passphrase: string,
  vault: VaultMetadata,
  userId: string,
  legacySalt: Uint8Array
): Promise<DerivedKeys | null> {
  const kek = await deriveKek(passphrase, fromBase64(vault.kekSalt));
  return openVaultWithKek(kek, vault, userId, legacySalt);
}

async function openVaultWithKek(
  kek: CryptoKey,
  vault: VaultMetadata,
  userId: string,
  legacySalt: Uint8Array
): Promise<DerivedKeys | null> {
  let master: Uint8Array;
  try {
    master = await unwrapMasterKey(kek, vault, userId);
  } catch (err) {
    if (err instanceof VaultUnwrapError) return null;
    throw err;
  }

  try {
    const keys = await importMasterKey(master, legacySalt);
    const ok = await verifyKeyCheck(keys.encryptionKey, vault.keyCheck, vault.keyCheckIv, userId, KEY_CHECK_VERSION);
    if (!ok) {
      zeroKeys(keys);
      return null;
    }
    return keys;
  } finally {
    master.fill(0);
  }
}
