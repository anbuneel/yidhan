/**
 * Item 26: the recovery kit (design §2.4).
 *
 * - `prepareRecoveryKit` makes a recovery key and, once the writer has confirmed
 *   it, stores `wrap(RK, K)` as `vault.recoveryWrap`.
 * - `recoveryUnlock` opens the vault with a recovery key and verifies the vault
 *   key-check before handing back any key.
 * - `RecoveryReset.setPassphrase` then runs §2.1: a new passphrase wrap, both
 *   versions advanced, the legacy key-check retired, in one `updateUser` write.
 *
 * The recovery key itself never leaves the device. It is not logged, not sent to
 * telemetry and not stored; only the wrap is written.
 *
 * `user_metadata` has no compare-and-set (item 136). Each write is preceded by a
 * fresh read and followed by a read-back. That narrows the window but does not
 * close it; the pull request and `DECISIONS.md` (2026-11-08) say so.
 *
 * Loaded with import() from `EncryptionContext`. Never import it statically from
 * app code.
 */

import { supabase } from '../lib/supabase';
import type { DerivedKeys } from '../lib/encryption';
import { copyMasterKey, masterVerifiesVault, rewrapVault } from '../lib/vaultKey';
import { openVaultWithRecoveryKey, unwrapWithRecoveryKey, wrapWithRecoveryKey } from '../lib/recoveryKey';
import { formatRecoveryKey, generateRecoveryKey, parseRecoveryKey } from '../lib/recoveryKeyFormat';
import { readRecoveryWrap, readVaultMetadata } from '../lib/vaultMetadata';
import type { VaultMetadata } from '../lib/vaultMetadata';
import { addReliabilityBreadcrumb, reportReliabilityIssue } from '../utils/reliabilityTelemetry';
import { migrationInFlight } from './vaultUnlock';
import { KdfLoadError } from '../lib/argon2';

/**
 * Why a recovery-kit step did not finish. The UI turns the code into copy.
 *
 * - `offline`: the server could not be reached. Nothing changed.
 * - `not-ready`: the account has no usable vault yet (the migration has not landed).
 * - `changed`: the vault changed on another device since this one read it.
 * - `exists`: a recovery key exists and the caller did not ask to replace it.
 * - `failed`: anything else. Nothing is reported as done.
 */
export type RecoveryKitErrorCode = 'offline' | 'not-ready' | 'changed' | 'exists' | 'failed';

export class RecoveryKitError extends Error {
  readonly code: RecoveryKitErrorCode;
  constructor(code: RecoveryKitErrorCode, message: string) {
    super(message);
    this.name = 'RecoveryKitError';
    this.code = code;
  }
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

interface FreshVault {
  raw: Record<string, unknown>;
  vault: VaultMetadata;
}

/** Read the server's current vault for `userId`. Throws a `RecoveryKitError`. */
async function readFreshVault(userId: string): Promise<FreshVault> {
  let result: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    result = await supabase.auth.getUser();
  } catch {
    throw new RecoveryKitError(isOffline() ? 'offline' : 'failed', 'Could not read the account');
  }
  const { data: { user }, error } = result;
  if (error || !user) {
    throw new RecoveryKitError(isOffline() ? 'offline' : 'failed', 'Could not read the account');
  }
  if (user.id !== userId) {
    throw new RecoveryKitError('changed', 'The signed-in account changed');
  }
  const raw = user.user_metadata?.vault;
  const read = readVaultMetadata(raw);
  if (read.status !== 'valid') {
    throw new RecoveryKitError('not-ready', 'The account has no usable vault');
  }
  return { raw: raw as Record<string, unknown>, vault: read.vault };
}

async function writeMetadata(data: Record<string, unknown>): Promise<void> {
  let error: { message: string } | null;
  try {
    ({ error } = await supabase.auth.updateUser({ data }));
  } catch {
    throw new RecoveryKitError(isOffline() ? 'offline' : 'failed', 'The write did not reach the server');
  }
  if (error) {
    throw new RecoveryKitError(isOffline() ? 'offline' : 'failed', 'The server did not accept the write');
  }
}

// ============================================================================
// Making a recovery key
// ============================================================================

export interface PreparedRecoveryKit {
  /** The recovery key, grouped. Shown once; nothing else keeps it. */
  readonly displayKey: string;
  /**
   * Store `wrap(RK, K)`. Resolves only once a read-back shows the new wrap on the
   * server. Can be retried after a failure; the same key is written.
   */
  commit(): Promise<void>;
  /** Zero the recovery key and `K`. Safe to call more than once. */
  discard(): void;
}

/**
 * Make a recovery key for the unlocked vault.
 *
 * Copies `K` out of `keys` before its first await. Refuses up front, before any
 * key is shown, when the account has no usable vault yet, when `keys` no longer
 * verify it (a lock zeroed them), or when a recovery key already exists and
 * `replace` is not set: a device with stale metadata must not silently replace a
 * key made elsewhere.
 */
export async function prepareRecoveryKit({
  keys,
  userId,
  replace = false,
}: {
  keys: DerivedKeys;
  userId: string;
  replace?: boolean;
}): Promise<PreparedRecoveryKit> {
  const master = copyMasterKey(keys);
  /** The stored wrap this kit replaces, or null. Checked again at commit. */
  let expected: string | null;
  try {
    // An account that has just migrated has its vault only once the migration
    // lands: migrate first, then make the key. A failed migration retries only
    // on the next passphrase unlock, so a key shown now could never be saved.
    if ((await migrationInFlight(userId)) === false) {
      throw new RecoveryKitError('not-ready', 'The migration did not land');
    }
    const fresh = await readFreshVault(userId);
    if (!(await masterVerifiesVault(master, fresh.vault, userId))) {
      throw new RecoveryKitError('failed', 'The vault key is no longer available');
    }
    const existing = readRecoveryWrap(fresh.raw.recoveryWrap);
    if (existing.status === 'unsupported') {
      // A newer app made it. Do not overwrite what this one cannot read.
      throw new RecoveryKitError('failed', 'The stored recovery wrap has a newer format');
    }
    if (existing.status === 'valid' && !replace) {
      throw new RecoveryKitError('exists', 'A recovery key already exists');
    }
    expected = existing.status === 'valid' ? existing.recoveryWrap.wrappedKey : null;
  } catch (err) {
    master.fill(0);
    throw reportKitError('Preparing the recovery key failed', 'recovery_kit', err);
  }

  const rk = generateRecoveryKey();
  const displayKey = formatRecoveryKey(rk);
  let done = false;
  /** The wrap the last commit wrote, so a landed write reported as an error is recognised. */
  let written: string | null = null;

  const discard = () => {
    done = true;
    rk.fill(0);
    master.fill(0);
  };

  const commit = async () => {
    if (done) throw new RecoveryKitError('failed', 'This recovery key was already put away');
    // Work on copies taken before the first await: `discard` (an unmount, a lock)
    // zeroes the originals in place, and a wrap of zeroes must never be written.
    const ownRk = rk.slice();
    const ownMaster = master.slice();
    try {
      const fresh = await readFreshVault(userId);
      const current = fresh.vault.recoveryWrap?.wrappedKey ?? null;
      if (written !== null && current === written) {
        // The last attempt landed and only its confirmation was lost.
        discard();
        return;
      }
      if (current !== expected || readRecoveryWrap(fresh.raw.recoveryWrap).status === 'unsupported') {
        throw new RecoveryKitError('changed', 'The recovery key changed on another device');
      }
      if (!(await masterVerifiesVault(ownMaster, fresh.vault, userId))) {
        throw new RecoveryKitError('changed', 'The vault key changed on another device');
      }
      const recoveryVersion = (fresh.vault.recoveryWrap?.recoveryVersion ?? 0) + 1;
      const recoveryWrap = await wrapWithRecoveryKey(ownRk, ownMaster, userId, recoveryVersion);

      // Self-check before writing: the wrap must open with this key to these bytes.
      const reopened = await unwrapWithRecoveryKey(ownRk, recoveryWrap, userId);
      try {
        if (!reopened || !reopened.every((b, i) => b === ownMaster[i])) {
          throw new RecoveryKitError('failed', 'The recovery wrap did not reopen');
        }
      } finally {
        reopened?.fill(0);
      }
      if (done) throw new RecoveryKitError('failed', 'The recovery key was put away before saving');

      written = recoveryWrap.wrappedKey;
      await writeMetadata({ vault: { ...fresh.raw, recoveryWrap } });

      const after = await readFreshVault(userId);
      if (after.vault.recoveryWrap?.wrappedKey !== recoveryWrap.wrappedKey) {
        throw new RecoveryKitError('failed', 'The recovery wrap was not persisted');
      }

      addReliabilityBreadcrumb({
        category: 'vault',
        message: 'Recovery key saved',
        level: 'info',
        data: { source: 'recovery_kit', recoveryVersion },
      });
      discard();
    } catch (err) {
      throw reportKitError('Saving the recovery key failed', 'recovery_kit', err);
    } finally {
      ownRk.fill(0);
      ownMaster.fill(0);
    }
  };

  return { displayKey, commit, discard };
}

/** Report a failure without the error's own text when it is ours, and return a `RecoveryKitError`. */
function reportKitError(message: string, source: string, err: unknown): RecoveryKitError {
  // A key-derivation chunk that did not load while offline is the offline case.
  const code = err instanceof RecoveryKitError
    ? err.code
    : err instanceof KdfLoadError && isOffline() ? 'offline' : 'failed';
  reportReliabilityIssue({
    category: 'vault',
    message,
    level: 'warning',
    data: { source, code },
  }, err instanceof RecoveryKitError ? undefined : err);
  return err instanceof RecoveryKitError ? err : new RecoveryKitError(code, message);
}

// ============================================================================
// Unlocking with a recovery key
// ============================================================================

export interface RecoveryReset {
  /**
   * Re-wrap `K` under a new passphrase (§2.1). Resolves once the server holds
   * the new wrap. Throws `RecoveryKitError`; on `changed` the caller must drop
   * the recovery and ask the user to unlock again.
   */
  setPassphrase(passphrase: string): Promise<void>;
  /** Zero this reset's copy of `K`. */
  discard(): void;
}

export type RecoveryUnlockResult =
  | { status: 'ok'; keys: DerivedKeys; reset: RecoveryReset }
  /** Not a recovery key: the wrong length or characters. */
  | { status: 'invalid' }
  /** A well-formed key that does not open this vault. */
  | { status: 'wrong' }
  /** The account has no recovery key to open. */
  | { status: 'unavailable' };

/**
 * Unlock with a recovery key. On `ok` the keys have passed the vault key-check;
 * the caller holds them back until `reset.setPassphrase` succeeds.
 */
export async function recoveryUnlock({
  recoveryKey,
  userId,
  salt,
  metadata,
}: {
  recoveryKey: string;
  userId: string;
  /** The legacy `encryption_salt`, decoded. Carried on the keys, as on every unlock. */
  salt: Uint8Array;
  /** The metadata this client already holds. Used when the server cannot be read. */
  metadata: Record<string, unknown> | undefined;
}): Promise<RecoveryUnlockResult> {
  const rk = parseRecoveryKey(recoveryKey);
  if (!rk) return { status: 'invalid' };

  try {
    // Prefer the server's current vault: a key made on another device after this
    // tab loaded is only there.
    let vault: VaultMetadata | null = null;
    try {
      vault = (await readFreshVault(userId)).vault;
    } catch (err) {
      if (err instanceof RecoveryKitError && err.code === 'changed') throw err;
      const local = readVaultMetadata(metadata?.vault);
      vault = local.status === 'valid' ? local.vault : null;
    }
    if (!vault?.recoveryWrap) return { status: 'unavailable' };

    const keys = await openVaultWithRecoveryKey(rk, vault, userId, salt);
    if (!keys) {
      addReliabilityBreadcrumb({
        category: 'vault',
        message: 'Recovery key did not open the vault',
        level: 'info',
        data: { source: 'recovery_unlock' },
      });
      return { status: 'wrong' };
    }

    addReliabilityBreadcrumb({
      category: 'vault',
      message: 'Vault opened with the recovery key',
      level: 'info',
      data: { source: 'recovery_unlock' },
    });
    return { status: 'ok', keys, reset: createRecoveryReset(keys, vault, userId, salt) };
  } finally {
    rk.fill(0);
  }
}

function createRecoveryReset(
  keys: DerivedKeys,
  unlockedVault: VaultMetadata,
  userId: string,
  legacySalt: Uint8Array
): RecoveryReset {
  const master = copyMasterKey(keys);
  /** The vault the next write is computed from. */
  let base = unlockedVault;
  /** Passphrase wraps this reset wrote, so a landed write reported as an error is recognised. */
  const ownWraps = new Set<string>();
  let discarded = false;

  const setPassphrase = async (passphrase: string) => {
    if (discarded) throw new RecoveryKitError('failed', 'This recovery was already closed');
    // A copy taken before the first await: `discard` (a lock, a sign-out, a user
    // change) zeroes `master` in place, and a wrap of zeroes must never be written.
    const own = master.slice();
    try {
      // Read before deriving, so a retry after a landed-but-unconfirmed write
      // builds on it with one Argon2id run, not two.
      let fresh = await readFreshVault(userId);
      if (fresh.vault.wrappedKey !== base.wrappedKey) {
        if (!ownWraps.has(fresh.vault.wrappedKey)) {
          throw new RecoveryKitError('changed', 'The passphrase was changed on another device');
        }
        base = fresh.vault;
      }

      const { vault: next, retiredLegacyKeyCheck } = await rewrapVault({
        passphrase,
        master: own,
        vault: base,
        legacySalt,
        userId,
      });

      // Read again as late as possible: Argon2id ran above, and the write follows.
      fresh = await readFreshVault(userId);
      if (fresh.vault.wrappedKey !== base.wrappedKey) {
        throw new RecoveryKitError('changed', 'The passphrase was changed on another device');
      }
      if (discarded) throw new RecoveryKitError('failed', 'The recovery was closed before saving');

      ownWraps.add(next.wrappedKey);
      // One write: the new wrap, both versions advanced, and the legacy
      // key-check retired. The stored recovery wrap is carried over untouched,
      // so whatever happens to this write the recovery key still opens the
      // vault.
      await writeMetadata({
        vault: { ...fresh.raw, ...next },
        ...retiredLegacyKeyCheck,
      });

      const after = await readFreshVault(userId);
      if (after.vault.wrappedKey !== next.wrappedKey) {
        throw new RecoveryKitError('failed', 'The new passphrase was not persisted');
      }
      base = after.vault;
      addReliabilityBreadcrumb({
        category: 'vault',
        message: 'New passphrase set after recovery',
        level: 'info',
        data: { source: 'recovery_reset', wrapVersion: next.wrapVersion },
      });
    } catch (err) {
      throw reportKitError('Setting a new passphrase after recovery failed', 'recovery_reset', err);
    } finally {
      own.fill(0);
    }
  };

  return {
    setPassphrase,
    discard: () => {
      discarded = true;
      master.fill(0);
    },
  };
}
