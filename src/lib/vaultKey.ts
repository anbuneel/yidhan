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
 * Everything here is pure: no React, no Supabase. Loaded with `import()` so the
 * entry chunk carries only `vaultMetadata.ts`.
 */

import { argon2id } from './argon2';
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
import {
  KEK_SALT_LENGTH_BYTES,
  MASTER_KEY_LENGTH_BYTES,
  VAULT_VERSION,
  WRAP_IV_LENGTH_BYTES,
} from './vaultMetadata';
import type { VaultMetadata } from './vaultMetadata';

// ============================================================================
// Constants
// ============================================================================

/** `wrapVersion` a migrated vault starts at. Every later key change increments it. */
export const INITIAL_WRAP_VERSION = 1;

/** `keyCheckVersion` a migrated vault starts at. Bumped on every key change (§2.2). */
const INITIAL_VAULT_KEY_CHECK_VERSION = 1;

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

class VaultUnwrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultUnwrapError';
  }
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
    return await sealVault({ passphrase, master, keys, legacySalt, userId, now });
  } finally {
    zeroKeys(keys);
  }
}

/**
 * Wrap `K` under a KEK from `passphrase` and a fresh `kekSalt`, with a key-check
 * under `K`, at the first wrap version. Shared by the migration and a new account,
 * so the two always write the same vault.
 *
 * Self-check before returning: the vault must reopen with this KEK to exactly
 * these 64 bytes, and its key-check must verify under them. A vault that fails is
 * never returned, so it can never be written.
 */
async function sealVault({
  passphrase,
  master,
  keys,
  legacySalt,
  userId,
  now,
}: {
  passphrase: string;
  master: Uint8Array;
  /** `K` imported; used for the key-check, not modified. */
  keys: DerivedKeys;
  legacySalt: Uint8Array;
  userId: string;
  now: Date;
}): Promise<VaultMetadata> {
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

  const reopened = await openVaultWithKek(kek, vault, userId, legacySalt);
  try {
    if (!reopened || !keysMatchMaster(reopened, master)) {
      throw new Error('Built vault did not reopen to the same master key');
    }
  } finally {
    if (reopened) zeroKeys(reopened);
  }
  return vault;
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
  return openUnwrappedVault(master, vault, userId, legacySalt);
}

/**
 * Import 64 unwrapped bytes and verify them against the vault key-check (§1.2).
 * Every unlock path ends here, the recovery key included: nothing is returned,
 * so nothing is decrypted, until the key-check verifies. Zeroes `master`.
 */
export async function openUnwrappedVault(
  master: Uint8Array,
  vault: Pick<VaultMetadata, 'keyCheck' | 'keyCheckIv'>,
  userId: string,
  legacySalt: Uint8Array
): Promise<DerivedKeys | null> {
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

/** Whether 64 bytes of `K` verify the vault key-check. Does not modify `master`. */
export async function masterVerifiesVault(
  master: Uint8Array,
  vault: Pick<VaultMetadata, 'keyCheck' | 'keyCheckIv'>,
  userId: string
): Promise<boolean> {
  const keys = await openUnwrappedVault(master.slice(), vault, userId, new Uint8Array(0));
  if (!keys) return false;
  zeroKeys(keys);
  return true;
}

// ============================================================================
// A new account (item 27)
// ============================================================================

const LEGACY_SALT_LENGTH_BYTES = 16;

export interface NewVault {
  /** `K` imported, carrying `legacySalt`. The account's keys from here on; the caller zeroes them if it drops them. */
  keys: DerivedKeys;
  /** 64 random bytes of `K`. The caller zeroes it. */
  master: Uint8Array;
  /** A fresh `encryption_salt`. The legacy derivation never runs for this account. */
  legacySalt: Uint8Array;
  /** The vault, without `recoveryWrap`: the caller adds it in the same write. */
  vault: Omit<VaultMetadata, 'recoveryWrap'>;
  /** A legacy key-check that no passphrase verifies (DECISIONS.md, 2026-11-08). */
  retiredLegacyKeyCheck: LegacyKeyCheckFields;
}

/**
 * The vault for an account being set up (item 27). `K` is 64 random bytes, never
 * derived from the passphrase (§1). The KEK is Argon2id over the passphrase and a
 * fresh `kekSalt`, as for a migrated account (`sealVault`).
 *
 * The legacy fields are written too, because `encryption_salt` is what marks an
 * account as set up and what the keys carry. The legacy key-check is a retired
 * one, as after a passphrase change: the legacy derivation can never produce a
 * random `K`, so an old client, and the legacy fallback, answer "wrong
 * passphrase" and fail closed instead of opening with the wrong key.
 *
 * On any failure every copy of `K` made here is zeroed before the error leaves.
 */
export async function buildNewVault({
  passphrase,
  userId,
  now = new Date(),
}: {
  passphrase: string;
  userId: string;
  now?: Date;
}): Promise<NewVault> {
  const master = crypto.getRandomValues(new Uint8Array(MASTER_KEY_LENGTH_BYTES));
  const legacySalt = crypto.getRandomValues(new Uint8Array(LEGACY_SALT_LENGTH_BYTES));
  let keys: DerivedKeys | null = null;
  try {
    keys = await importMasterKey(master, legacySalt);
    const vault = await sealVault({ passphrase, master, keys, legacySalt, userId, now });
    return {
      keys,
      master,
      legacySalt,
      vault,
      retiredLegacyKeyCheck: await createRetiredLegacyKeyCheck(userId),
    };
  } catch (err) {
    master.fill(0);
    if (keys) zeroKeys(keys);
    throw err;
  }
}

// ============================================================================
// Re-wrap under a new passphrase (§2.1)
// ============================================================================

export interface RewrapVaultOptions {
  passphrase: string;
  /** 64 bytes of `K`. Not modified. */
  master: Uint8Array;
  /** The vault as the server holds it now. */
  vault: VaultMetadata;
  /** The legacy `encryption_salt`, decoded. */
  legacySalt: Uint8Array;
  userId: string;
}

/** The legacy key-check fields, as written to `user_metadata`. */
interface LegacyKeyCheckFields {
  encryption_key_check: string;
  encryption_key_check_iv: string;
  encryption_key_check_version: KeyCheckVersion;
}

export interface RewrapVaultResult {
  /** The new vault without `recoveryWrap`: the caller carries the stored one over. */
  vault: Omit<VaultMetadata, 'recoveryWrap'>;
  /** A legacy key-check that no passphrase verifies (§3.3; DECISIONS.md, 2026-11-08). */
  retiredLegacyKeyCheck: LegacyKeyCheckFields;
}

/**
 * A key-check under a random key that is thrown away. Written over
 * `encryption_key_check` when the passphrase changes, so the legacy derivation
 * stops verifying for every passphrase, the retired one included: an old client
 * and the legacy fallback both answer "wrong passphrase" instead of opening.
 *
 * Re-encrypting it so the *new* passphrase verifies on the legacy path is not
 * possible: that path uses whatever Argon2id derives as the note key, and that
 * can never be `K` for a new passphrase. It would unlock with the wrong key.
 */
async function createRetiredLegacyKeyCheck(userId: string): Promise<LegacyKeyCheckFields> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  try {
    const throwaway = await importAesKey(raw);
    const { keyCheck, keyCheckIv, keyCheckVersion } = await createKeyCheck(throwaway, userId);
    return {
      encryption_key_check: keyCheck,
      encryption_key_check_iv: keyCheckIv,
      encryption_key_check_version: keyCheckVersion,
    };
  } finally {
    raw.fill(0);
  }
}

/**
 * Build the vault for a new passphrase (§2.1 steps 2–5). `K` does not change, so
 * no note is touched. `wrapVersion` and `keyCheckVersion` each advance by one.
 *
 * Refuses unless `master` verifies the current vault key-check, and self-checks
 * that the new vault reopens with the new passphrase's KEK before returning it.
 */
export async function rewrapVault({
  passphrase,
  master,
  vault,
  legacySalt,
  userId,
}: RewrapVaultOptions): Promise<RewrapVaultResult> {
  if (!(await masterVerifiesVault(master, vault, userId))) {
    throw new Error('Master key does not verify the vault key-check; refusing to re-wrap it');
  }

  const currentSalt = fromBase64(vault.kekSalt);
  let kekSalt: Uint8Array;
  do {
    kekSalt = generateKekSalt(legacySalt);
  } while (toBase64(kekSalt) === toBase64(currentSalt));

  const kek = await deriveKek(passphrase, kekSalt);
  const wrapVersion = vault.wrapVersion + 1;
  const { wrappedKey, wrapIv } = await wrapMasterKey(kek, master, userId, wrapVersion);
  const keys = await importMasterKey(master, legacySalt);
  let keyCheck: string;
  let keyCheckIv: string;
  try {
    ({ keyCheck, keyCheckIv } = await createKeyCheck(keys.encryptionKey, userId));
  } finally {
    zeroKeys(keys);
  }

  const next: VaultMetadata = {
    version: VAULT_VERSION,
    wrapVersion,
    kekSalt: toBase64(kekSalt),
    wrappedKey,
    wrapIv,
    keyCheck,
    keyCheckIv,
    keyCheckVersion: vault.keyCheckVersion + 1,
    migratedAt: vault.migratedAt,
  };

  const reopened = await openVaultWithKek(kek, next, userId, legacySalt);
  try {
    if (!reopened || !keysMatchMaster(reopened, master)) {
      throw new Error('Re-wrapped vault did not reopen to the same master key');
    }
  } finally {
    if (reopened) zeroKeys(reopened);
  }

  return { vault: next, retiredLegacyKeyCheck: await createRetiredLegacyKeyCheck(userId) };
}
