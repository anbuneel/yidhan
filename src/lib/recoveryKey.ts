/**
 * Recovery key (item 26, design §2.4).
 *
 * `RK` is 32 random bytes. `vault.recoveryWrap = wrap(RK, K)`: AES-256-GCM with RK
 * as the key, a fresh 12-byte IV and AAD `vault-recovery:<userId>:<recoveryVersion>`.
 * RK is already a uniformly random 256-bit key, so there is no KDF in front of it.
 * The AAD prefix differs from the passphrase wrap's, so neither wrap can stand in
 * for the other.
 *
 * Unlocking with RK unwraps `K` and then verifies the vault key-check under `K`
 * (`openUnwrappedVault`), like every other unlock path.
 *
 * The key is shown as RFC 4648 base32, 52 characters in groups of four
 * (`recoveryKeyFormat.ts`). RK never leaves the device: only the wrap is stored.
 *
 * Pure: no React, no Supabase. Loaded with `import()`.
 */

import { fromBase64, importAesKey, toBase64 } from './encryption';
import type { DerivedKeys } from './encryption';
import { openUnwrappedVault } from './vaultKey';
import {
  MASTER_KEY_LENGTH_BYTES,
  RECOVERY_WRAP_VERSION,
  WRAP_IV_LENGTH_BYTES,
} from './vaultMetadata';
import type { RecoveryWrapMetadata, VaultMetadata } from './vaultMetadata';
import { RECOVERY_KEY_BYTES } from './recoveryKeyFormat';


// ============================================================================
// Wrapping
// ============================================================================

function buildRecoveryAad(userId: string, recoveryVersion: number): Uint8Array {
  return new TextEncoder().encode(`vault-recovery:${userId}:${recoveryVersion}`);
}

async function importRecoveryKey(rk: Uint8Array): Promise<CryptoKey> {
  if (rk.length !== RECOVERY_KEY_BYTES) {
    throw new Error('A recovery key is 32 bytes');
  }
  return importAesKey(rk);
}

/** `wrap(RK, K)`. */
export async function wrapWithRecoveryKey(
  rk: Uint8Array,
  master: Uint8Array,
  userId: string,
  recoveryVersion: number,
  now: Date = new Date()
): Promise<RecoveryWrapMetadata> {
  if (master.length !== MASTER_KEY_LENGTH_BYTES) {
    throw new Error(`Invalid master key length: expected ${MASTER_KEY_LENGTH_BYTES}, got ${master.length}`);
  }
  const key = await importRecoveryKey(rk);
  const iv = crypto.getRandomValues(new Uint8Array(WRAP_IV_LENGTH_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: buildRecoveryAad(userId, recoveryVersion) as BufferSource },
    key,
    master as BufferSource
  );
  return {
    version: RECOVERY_WRAP_VERSION,
    recoveryVersion,
    wrappedKey: toBase64(new Uint8Array(ciphertext)),
    wrapIv: toBase64(iv),
    createdAt: now.toISOString(),
  };
}

/** Unwrap `K` with RK. Null on a wrong key, wrong user, wrong version or tampering. */
export async function unwrapWithRecoveryKey(
  rk: Uint8Array,
  recoveryWrap: RecoveryWrapMetadata,
  userId: string
): Promise<Uint8Array | null> {
  const key = await importRecoveryKey(rk);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(recoveryWrap.wrapIv) as BufferSource,
        additionalData: buildRecoveryAad(userId, recoveryWrap.recoveryVersion) as BufferSource,
      },
      key,
      fromBase64(recoveryWrap.wrappedKey) as BufferSource
    );
  } catch {
    return null;
  }
  const master = new Uint8Array(plaintext);
  if (master.length !== MASTER_KEY_LENGTH_BYTES) {
    master.fill(0);
    return null;
  }
  return master;
}

/**
 * Unlock with a recovery key: unwrap `K`, then verify the vault key-check under
 * it. Null when the key does not open this vault. The caller must not unlock on
 * null.
 */
export async function openVaultWithRecoveryKey(
  rk: Uint8Array,
  vault: VaultMetadata,
  userId: string,
  legacySalt: Uint8Array
): Promise<DerivedKeys | null> {
  if (!vault.recoveryWrap) return null;
  const master = await unwrapWithRecoveryKey(rk, vault.recoveryWrap, userId);
  if (!master) return null;
  return openUnwrappedVault(master, vault, userId, legacySalt);
}
