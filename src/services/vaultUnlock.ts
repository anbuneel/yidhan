/**
 * Item 24: passphrase unlock through the wrapped master key, and the migration
 * to it (design §3.1–§3.3).
 *
 * Loaded with import() from `EncryptionContext` on a passphrase unlock, so it
 * stays out of the entry chunk. Never import this module statically from app code.
 */

import { supabase } from '../lib/supabase';
import { KEY_CHECK_VERSION, deriveKeys, parseKeyCheckVersion, verifyKeyCheck } from '../lib/encryption';
import type { DerivedKeys, KeyCheckVersion } from '../lib/encryption';
import { buildMigratedVault, copyMasterKey, unlockVault } from '../lib/vaultKey';
import { readVaultMetadata } from '../lib/vaultMetadata';

export { selectKeyCheck } from '../lib/vaultMetadata';
import {
  addReliabilityBreadcrumb,
  reportReliabilityIssue,
} from '../utils/reliabilityTelemetry';

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 2000 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export interface MigrationOptions {
  userId: string;
  passphrase: string;
  /** 64 bytes of `K`, copied before the unlock committed. Zeroed when done. */
  master: Uint8Array;
  legacySalt: Uint8Array;
  legacyKeyCheck: { keyCheck: string; keyCheckIv: string; keyCheckVersion: KeyCheckVersion };
}

/**
 * Item 24: wrap the existing key under a passphrase-derived KEK and store it as
 * `user_metadata.vault` (design §3.1).
 *
 * Runs after the unlock has committed and never affects it. The write is one
 * `updateUser` call carrying the whole vault object, so an interruption at any
 * point leaves either no vault (retried on the next passphrase unlock) or a
 * complete one (§3.2). The legacy fields are not touched.
 */
export async function migrateToWrappedKey({
  userId,
  passphrase,
  master,
  legacySalt,
  legacyKeyCheck,
}: MigrationOptions): Promise<void> {
  try {
    // The KEK derivation is a full Argon2id run on the main thread. Let the
    // unlocked library paint first.
    await waitForIdle();

    const vault = await buildMigratedVault({ passphrase, master, legacySalt, userId, legacyKeyCheck });

    // The session may have changed while Argon2id ran. A vault written into
    // another account would not unwrap there (the AAD binds the user id).
    const { data: { user: current }, error: currentError } = await supabase.auth.getUser();
    if (currentError || !current) {
      throw new Error(currentError?.message ?? 'Could not read the current user before migrating');
    }
    if (current.id !== userId) {
      addReliabilityBreadcrumb({
        category: 'vault',
        message: 'Vault migration skipped: session changed',
        level: 'info',
        data: { source: 'vault_migration' },
      });
      return;
    }
    // Another device may have migrated meanwhile. This is a read, not a
    // conditional write: two devices can both pass it and the later write wins.
    // That is harmless here because both wrap the same K with the same
    // passphrase. Items 25 and 103 need a real compare-and-set (item 136).
    if (readVaultMetadata(current.user_metadata?.vault).status !== 'absent') {
      addReliabilityBreadcrumb({
        category: 'vault',
        message: 'Vault migration skipped: vault already present',
        level: 'info',
        data: { source: 'vault_migration' },
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ data: { vault } });
    if (error) {
      throw new Error(error.message);
    }

    // §3.1 step 4: the migration is done when a complete vault reads back.
    const { data: { user: after }, error: afterError } = await supabase.auth.getUser();
    if (afterError) {
      throw new Error(afterError.message);
    }
    if (readVaultMetadata(after?.user_metadata?.vault).status !== 'valid') {
      throw new Error('Vault metadata was not persisted');
    }

    addReliabilityBreadcrumb({
      category: 'vault',
      message: 'Vault migrated to wrapped master key',
      level: 'info',
      data: { source: 'vault_migration' },
    });
  } catch (err) {
    reportReliabilityIssue({
      category: 'vault',
      message: 'Vault migration to wrapped master key failed',
      level: 'warning',
      data: { source: 'vault_migration' },
    }, err);
  } finally {
    master.fill(0);
  }
}

interface LegacyUnlockResult {
  keys: DerivedKeys;
  keyCheck: { keyCheck: string; keyCheckIv: string; keyCheckVersion: KeyCheckVersion };
  upgradeKeyCheck: boolean;
}

/**
 * The pre-item-24 unlock: derive from `encryption_salt` and verify
 * `encryption_key_check`. Returns null for a wrong passphrase.
 *
 * With `throwOnBadMetadata`, missing or unsupported key-check metadata throws,
 * because then the legacy path is the only path and a "wrong passphrase" answer
 * would be a lie. Without it (a vault was readable and did not open), the same
 * case is a wrong passphrase.
 */
async function unlockWithLegacyKeys(
  passphrase: string,
  salt: Uint8Array,
  userId: string,
  metadata: Record<string, unknown> | undefined,
  throwOnBadMetadata: boolean
): Promise<LegacyUnlockResult | null> {
  const keyCheck = metadata?.encryption_key_check as string | undefined;
  const keyCheckIv = metadata?.encryption_key_check_iv as string | undefined;

  if (!keyCheck || !keyCheckIv) {
    if (!throwOnBadMetadata) return null;
    reportReliabilityIssue({
      category: 'vault',
      message: 'Passphrase unlock missing key-check metadata',
      level: 'warning',
      data: { source: 'unlock_passphrase', userId },
    });
    throw new Error('Vault metadata is incomplete. Please sign out and sign back in.');
  }

  const keyCheckVersion = parseKeyCheckVersion(metadata?.encryption_key_check_version);
  if (keyCheckVersion === null) {
    if (!throwOnBadMetadata) return null;
    reportReliabilityIssue({
      category: 'vault',
      message: 'Passphrase unlock encountered unsupported key-check metadata version',
      level: 'warning',
      data: { source: 'unlock_passphrase', userId },
    });
    throw new Error('Vault metadata uses an unsupported format. Please sign out and sign back in.');
  }

  const keys = await deriveKeys(passphrase, salt);
  const isValid = await verifyKeyCheck(keys.encryptionKey, keyCheck, keyCheckIv, userId, keyCheckVersion);
  if (!isValid) {
    keys.rawEncryptionKey.fill(0);
    keys.rawHashKey.fill(0);
    return null;
  }

  return {
    keys,
    keyCheck: { keyCheck, keyCheckIv, keyCheckVersion },
    upgradeKeyCheck: keyCheckVersion !== KEY_CHECK_VERSION,
  };
}

export interface PassphraseUnlockResult {
  keys: DerivedKeys;
  /** The legacy key-check is in the v1 format and should be rewritten. */
  upgradeKeyCheck: boolean;
  /** Set when the account has no vault: what the migration needs besides the passphrase. */
  migration: Pick<MigrationOptions, 'master' | 'legacyKeyCheck'> | null;
}

/**
 * Unlock with a passphrase. Returns null for a wrong passphrase. Throws when the
 * legacy metadata is missing or unsupported and there is no vault to use.
 *
 * Design §3.3: read the wrapped key first; fall back to the legacy derivation.
 */
export async function passphraseUnlock({
  passphrase,
  salt,
  userId,
  metadata,
}: {
  passphrase: string;
  salt: Uint8Array;
  userId: string;
  metadata: Record<string, unknown> | undefined;
}): Promise<PassphraseUnlockResult | null> {
  const vaultRead = readVaultMetadata(metadata?.vault);
  if (vaultRead.status === 'valid') {
    const vaultKeys = await unlockVault(passphrase, vaultRead.vault, userId, salt);
    if (vaultKeys) {
      return { keys: vaultKeys, upgradeKeyCheck: false, migration: null };
    }
    // Either a wrong passphrase or a vault that does not open. The legacy
    // fields still describe the same K, so try them before reporting a wrong
    // passphrase: a broken vault must not lock the user out (DECISIONS.md,
    // 2026-11-08). The vault is never overwritten here.
    const legacy = await unlockWithLegacyKeys(passphrase, salt, userId, metadata, false);
    if (!legacy) return null;
    reportReliabilityIssue({
      category: 'vault',
      message: 'Wrapped vault key did not open; unlocked through the legacy key path',
      level: 'warning',
      data: { source: 'unlock_passphrase', userId },
    });
    return { keys: legacy.keys, upgradeKeyCheck: legacy.upgradeKeyCheck, migration: null };
  }

  if (vaultRead.status !== 'absent') {
    reportReliabilityIssue({
      category: 'vault',
      message: vaultRead.status === 'unsupported'
        ? 'Vault metadata has an unsupported version; using the legacy key path'
        : 'Vault metadata is malformed; using the legacy key path',
      level: 'warning',
      data: { source: 'unlock_passphrase', userId },
    });
  }

  const legacy = await unlockWithLegacyKeys(passphrase, salt, userId, metadata, true);
  if (!legacy) return null;

  return {
    keys: legacy.keys,
    upgradeKeyCheck: legacy.upgradeKeyCheck,
    // Copy K now: a lock zeroes the key bytes in place, and the migration runs
    // after the unlock has committed.
    migration: vaultRead.status === 'absent'
      ? { master: copyMasterKey(legacy.keys), legacyKeyCheck: legacy.keyCheck }
      : null,
  };
}
