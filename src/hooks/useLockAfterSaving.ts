/**
 * Locking the vault saves what is on screen first (issue #288).
 *
 * - Auto-lock: flush the open Editor, wait for saves still running from Editors the
 *   writer left, retry held saves, then drop whatever is still held and lock. Local
 *   writes survive an auto-lock, so this is worth it. It is bounded: a save that hangs
 *   never keeps the vault open longer than SAVE_BEFORE_LOCK_MS.
 * - Sign-out, and any other reason: drop held words and lock at once. Sign-out deletes
 *   the offline database (`clearOfflineData`), so a flush to it would be deleted too.
 * - Lock now: the same saving, bounded. If anything is still unsaved, do not lock;
 *   the caller shows the held words with Retry, Copy and "Lock anyway".
 *
 * Held words are decrypted text, so none outlive the vault. When a lock drops words,
 * a toast says so.
 */
import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import type { LockReason } from '../contexts/EncryptionContext';
import { heldSaves } from '../stores/heldSaves';
import { noteSaveQueue } from '../stores/noteSaveQueue';

/** The longest a lock waits for saves. A lock is a security control; it must not hang. */
const SAVE_BEFORE_LOCK_MS = 3000;

export interface LockAfterSaving {
  /** Drop-in for `lockVault`, for the idle and session guards. */
  lockVaultAfterSaving: (reason?: LockReason) => void;
  /** "Lock now". Resolves false when unsaved words kept the vault open. */
  lockNow: () => Promise<boolean>;
  /** "Lock anyway": drop held words and lock. */
  lockAnyway: () => void;
  /** Where to find the retry for held saves, which the app builds later. */
  retryHeldSavesRef: React.RefObject<() => Promise<boolean>>;
}

function within<T>(ms: number, work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([work, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

function closeAndReport(): void {
  const dropped = heldSaves.close();
  if (dropped > 0) {
    toast.error(dropped === 1
      ? 'One note had words that could not be saved. They were not kept.'
      : `${dropped} notes had words that could not be saved. They were not kept.`);
  }
}

export function useLockAfterSaving(lockVault: (reason?: LockReason) => void): LockAfterSaving {
  const lockVaultRef = useRef(lockVault);
  lockVaultRef.current = lockVault;
  const retryHeldSavesRef = useRef<() => Promise<boolean>>(async () => true);
  const autoLockingRef = useRef(false);

  /** Resolves true when everything was saved in time. */
  const saveFirst = useCallback(async (): Promise<boolean> => {
    const work = (async () => {
      const flushed = await heldSaves.flushOpenEditors();
      const drained = await noteSaveQueue.drain(SAVE_BEFORE_LOCK_MS);
      const retried = await retryHeldSavesRef.current();
      return flushed && drained && retried;
    })();
    return within(SAVE_BEFORE_LOCK_MS, work, false);
  }, []);

  const lockVaultAfterSaving = useCallback((reason: LockReason = 'manual') => {
    if (reason !== 'auto-lock') {
      heldSaves.close();
      lockVaultRef.current(reason);
      return;
    }
    if (autoLockingRef.current) return;
    autoLockingRef.current = true;
    void saveFirst().catch(() => false).finally(() => {
      autoLockingRef.current = false;
      closeAndReport();
      lockVaultRef.current('auto-lock');
    });
  }, [saveFirst]);

  const lockNow = useCallback(async (): Promise<boolean> => {
    const saved = await saveFirst().catch(() => false);
    if (!saved || heldSaves.getSnapshot().length > 0) return false;
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
