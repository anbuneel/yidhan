/**
 * Locking the vault saves what is on screen first (issue #288).
 *
 * - Auto-lock: flush the open Editor, retry held saves, then drop whatever is still
 *   held and lock. Local writes survive an auto-lock, so the flush is worth it.
 * - Sign-out, and any other reason: drop held words and lock at once. Sign-out deletes
 *   the offline database (`clearOfflineData`), so a flush to it would be deleted too.
 * - Lock now: flush and retry. If words are still held, do not lock; the caller shows
 *   them with Retry, Copy and "Lock anyway".
 *
 * Held words are decrypted text, so none outlive the vault.
 */
import { useCallback, useRef } from 'react';
import type { LockReason } from '../contexts/EncryptionContext';
import { heldSaves } from '../stores/heldSaves';

export interface LockAfterSaving {
  /** Drop-in for `lockVault`, for the idle and session guards. */
  lockVaultAfterSaving: (reason?: LockReason) => void;
  /** "Lock now". Resolves false when held words kept the vault open. */
  lockNow: () => Promise<boolean>;
  /** "Lock anyway": drop held words and lock. */
  lockAnyway: () => void;
  /** Where to find the retry for held saves, which the app builds later. */
  retryHeldSavesRef: React.RefObject<() => Promise<boolean>>;
}

export function useLockAfterSaving(lockVault: (reason?: LockReason) => void): LockAfterSaving {
  const lockVaultRef = useRef(lockVault);
  lockVaultRef.current = lockVault;
  const retryHeldSavesRef = useRef<() => Promise<boolean>>(async () => true);

  const saveFirst = useCallback(async (): Promise<boolean> => {
    await heldSaves.flushOpenEditors();
    return retryHeldSavesRef.current();
  }, []);

  const lockVaultAfterSaving = useCallback((reason: LockReason = 'manual') => {
    if (reason !== 'auto-lock') {
      heldSaves.close();
      lockVaultRef.current(reason);
      return;
    }
    void saveFirst().finally(() => {
      heldSaves.close();
      lockVaultRef.current('auto-lock');
    });
  }, [saveFirst]);

  const lockNow = useCallback(async (): Promise<boolean> => {
    if (!(await saveFirst()) || heldSaves.getSnapshot().length > 0) return false;
    heldSaves.close();
    lockVaultRef.current('manual');
    return true;
  }, [saveFirst]);

  const lockAnyway = useCallback(() => {
    heldSaves.close();
    lockVaultRef.current('manual');
  }, []);

  return { lockVaultAfterSaving, lockNow, lockAnyway, retryHeldSavesRef };
}
