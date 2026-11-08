/**
 * Item 27: a new account is set up straight into the wrapped vault, with a
 * recovery key, in one write.
 *
 * - `prepareAccountSetup` runs at the end of step 1: it makes `K`, wraps it under
 *   the passphrase and keeps everything in memory. Nothing is written yet.
 * - `prepareRecoveryKit` makes the recovery key for step 2.
 * - The kit's `commit`, once the writer has typed the key back, writes
 *   `encryption_salt`, a retired legacy key-check, and the whole vault with its
 *   key-check and `recoveryWrap`, in one `updateUser` call.
 *
 * So there is no state in which the account has a vault and no recovery key: an
 * interruption before the write leaves an account that is not set up, and the
 * next sign-in starts setup again; after it, the account is complete.
 *
 * The passphrase and the recovery key never leave the device and are never
 * logged or sent to telemetry; only the wraps are written.
 *
 * Loaded with import() from `EncryptionContext`. Never import it statically from
 * app code.
 */

import { supabase } from '../lib/supabase';
import type { DerivedKeys } from '../lib/encryption';
import { toBase64 } from '../lib/encryption';
import { buildNewVault } from '../lib/vaultKey';
import type { NewVault } from '../lib/vaultKey';
import { unwrapWithRecoveryKey, wrapWithRecoveryKey } from '../lib/recoveryKey';
import { formatRecoveryKey, generateRecoveryKey } from '../lib/recoveryKeyFormat';
import { readVaultMetadata } from '../lib/vaultMetadata';
import type { RecoveryWrapMetadata } from '../lib/vaultMetadata';
import { addReliabilityBreadcrumb, reportReliabilityIssue } from '../utils/reliabilityTelemetry';
import { RecoveryKitError } from './recoveryKit';
import { KdfLoadError } from '../lib/argon2';
import type { PreparedRecoveryKit } from './recoveryKit';

/** The first recovery key an account has. */
const FIRST_RECOVERY_VERSION = 1;

export interface PreparedAccountSetup {
  /** The keys the account will open with. Valid until `discard`, or for good once a kit commits. */
  readonly keys: DerivedKeys;
  /**
   * Make a recovery key for step 2. Each call makes a new one and puts the
   * previous one away. Its `commit` is the write that sets the account up.
   */
  prepareRecoveryKit(): PreparedRecoveryKit;
  /** True once a kit's commit has landed. */
  readonly committed: boolean;
  /**
   * True once a commit has sent its write, landed or not. From then on the server
   * may hold this setup, so the caller must not put it away to start another.
   */
  readonly writeAttempted: boolean;
  /** Zero `K` and the keys, unless a commit landed: then the caller owns the keys. */
  discard(): void;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function readMetadata(userId: string): Promise<Record<string, unknown>> {
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
  return (user.user_metadata ?? {}) as Record<string, unknown>;
}

/** Whether `metadata` holds exactly the setup this device wrote. */
function holdsSetup(
  metadata: Record<string, unknown>,
  built: NewVault,
  recoveryWrap: RecoveryWrapMetadata
): boolean {
  if (metadata.encryption_salt !== toBase64(built.legacySalt)) return false;
  const read = readVaultMetadata(metadata.vault);
  return read.status === 'valid'
    && read.vault.wrappedKey === built.vault.wrappedKey
    && read.vault.keyCheck === built.vault.keyCheck
    && read.vault.recoveryWrap?.wrappedKey === recoveryWrap.wrappedKey;
}

/** Report without the error's own text when it is ours, and return a `RecoveryKitError`. */
function reportSetupError(message: string, err: unknown): RecoveryKitError {
  // A key-derivation chunk that did not load while offline is the offline case.
  const code = err instanceof RecoveryKitError
    ? err.code
    : err instanceof KdfLoadError && isOffline() ? 'offline' : 'failed';
  reportReliabilityIssue({
    category: 'vault',
    message,
    level: 'warning',
    data: { source: 'account_setup', code },
  }, err instanceof RecoveryKitError ? undefined : err);
  return err instanceof RecoveryKitError ? err : new RecoveryKitError(code, message);
}

/**
 * Step 1 to step 2: make `K` and wrap it under `passphrase`. One Argon2id run.
 * The caller has checked the passphrase against the policy.
 */
export async function prepareAccountSetup({
  passphrase,
  userId,
}: {
  passphrase: string;
  userId: string;
}): Promise<PreparedAccountSetup> {
  let built: NewVault;
  try {
    built = await buildNewVault({ passphrase, userId });
  } catch (err) {
    throw reportSetupError('Preparing the account setup failed', err);
  }
  const keys: DerivedKeys = built.keys;

  let committed = false;
  let writeAttempted = false;
  let discarded = false;
  let currentKit: { discard(): void } | null = null;

  const discard = () => {
    discarded = true;
    currentKit?.discard();
    currentKit = null;
    built.master.fill(0);
    if (!committed) {
      keys.rawEncryptionKey.fill(0);
      keys.rawHashKey.fill(0);
    }
  };

  const prepareRecoveryKit = (): PreparedRecoveryKit => {
    if (discarded) throw new RecoveryKitError('failed', 'This setup was already put away');
    if (committed) throw new RecoveryKitError('exists', 'This account is already set up');
    // A write may have landed unconfirmed: retry that kit, never replace it.
    if (writeAttempted) throw new RecoveryKitError('failed', 'This setup already sent its write');
    currentKit?.discard();

    const rk = generateRecoveryKey();
    const displayKey = formatRecoveryKey(rk);
    let kitDone = false;
    /** The wrap this kit's last commit wrote, so a landed write reported as an error is recognised. */
    let written: RecoveryWrapMetadata | null = null;

    const kitDiscard = () => {
      kitDone = true;
      rk.fill(0);
    };

    const commit = async () => {
      if (kitDone || discarded) throw new RecoveryKitError('failed', 'This recovery key was already put away');
      // Copies taken before the first await: `discard` zeroes the originals in
      // place, and a wrap of zeroes must never be written.
      const ownRk = rk.slice();
      const ownMaster = built.master.slice();
      try {
        const before = await readMetadata(userId);
        if (written && holdsSetup(before, built, written)) {
          // The last attempt landed and only its confirmation was lost.
        } else {
          if (before.encryption_salt) {
            // Set up elsewhere (another tab or device) since this page loaded.
            // Never overwrite it: notes may already be written under that key.
            throw new RecoveryKitError('changed', 'The account was set up on another device');
          }
          const recoveryWrap = written ?? await wrapWithRecoveryKey(ownRk, ownMaster, userId, FIRST_RECOVERY_VERSION);
          // Self-check before writing: the wrap must open with this key to these bytes.
          const reopened = await unwrapWithRecoveryKey(ownRk, recoveryWrap, userId);
          try {
            if (!reopened || !reopened.every((b, i) => b === ownMaster[i])) {
              throw new RecoveryKitError('failed', 'The recovery wrap did not reopen');
            }
          } finally {
            reopened?.fill(0);
          }
          if (kitDone || discarded) throw new RecoveryKitError('failed', 'The setup was put away before saving');

          written = recoveryWrap;
          writeAttempted = true;
          // One write. The vault key-check travels with the vault, and the
          // recovery wrap with both, so the account is never half set up.
          let error: { message: string } | null;
          try {
            ({ error } = await supabase.auth.updateUser({
              data: {
                encryption_salt: toBase64(built.legacySalt),
                ...built.retiredLegacyKeyCheck,
                encryption_version: 1,
                vault: { ...built.vault, recoveryWrap },
              },
            }));
          } catch {
            throw new RecoveryKitError(isOffline() ? 'offline' : 'failed', 'The write did not reach the server');
          }
          if (error) {
            throw new RecoveryKitError(isOffline() ? 'offline' : 'failed', 'The server did not accept the write');
          }
        }

        const after = await readMetadata(userId);
        if (!holdsSetup(after, built, written)) {
          throw new RecoveryKitError('failed', 'The setup was not persisted');
        }
        if (discarded) {
          // Put away while the write was in flight: the keys are already zeroed.
          // The account is set up on the server; the next sign-in unlocks it.
          throw new RecoveryKitError('failed', 'The setup was put away while saving');
        }

        committed = true;
        kitDiscard();
        currentKit = null;
        built.master.fill(0);
        addReliabilityBreadcrumb({
          category: 'vault',
          message: 'Account set up with a wrapped vault and a recovery key',
          level: 'info',
          data: { source: 'account_setup' },
        });
      } catch (err) {
        throw reportSetupError('Saving the account setup failed', err);
      } finally {
        ownRk.fill(0);
        ownMaster.fill(0);
      }
    };

    const kit: PreparedRecoveryKit = { displayKey, commit, discard: kitDiscard };
    currentKit = kit;
    return kit;
  };

  return {
    keys,
    prepareRecoveryKit,
    get committed() { return committed; },
    get writeAttempted() { return writeAttempted; },
    discard,
  };
}
