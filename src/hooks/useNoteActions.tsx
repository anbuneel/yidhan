/**
 * What a reader can do to a note: save it, let it fade, pin it.
 *
 * Every one is offline-first — IndexedDB immediately, sync queued after — and every
 * one is optimistic, so each also owns its rollback. That pairing is why they belong
 * together rather than beside the rendering.
 */

import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { VaultLockedSaveError } from '../utils/saveErrors';
import { UNDO_TOAST_MS } from '../utils/undoToast';
import { applySavedNote } from '../utils/applySavedNote';
import { updateEncryptedNote } from '../services/encryptedNotes';
import {
  softDeleteNoteOffline,
  restoreNoteOffline,
  toggleNotePinOffline,
} from '../services/offlineNotes';

export interface UseNoteActionsOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  notes: Note[];
  /** Stable read of the notes array, so the delete callback does not change identity. */
  notesRef: React.RefObject<Note[]>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  refreshFadedNotesCount: () => Promise<void>;
  openNoteIdRef: React.RefObject<string | null>;
  /** Close the editor when the note it is showing is the one being deleted. */
  onOpenNoteClosed: () => void;
  triggerCoalescedSync: () => void;
  /** Wraps a write whose change is already in the list, so a sync refresh waits for it. */
  trackLocalWrite: <T>(write: () => Promise<T>) => Promise<T>;
}

export interface NoteActions {
  handleNoteUpdate: (note: Note) => Promise<void>;
  handleNoteDelete: (id: string) => Promise<boolean>;
  handleTogglePin: (id: string, pinned: boolean) => Promise<void>;
}

export function useNoteActions({
  userId,
  keys,
  notes,
  notesRef,
  setNotes,
  refreshFadedNotesCount,
  openNoteIdRef,
  onOpenNoteClosed,
  triggerCoalescedSync,
  trackLocalWrite,
}: UseNoteActionsOptions): NoteActions {
  // Read at call time, not from the render that made the callback. An Editor that
  // unmounts as the vault locks or the user signs out still holds the older callback
  // (issue #288); its save must fail closed, not encrypt with keys the app let go of.
  const sessionRef = useRef({ userId, keys });
  sessionRef.current = { userId, keys };

  // Note update with offline-first approach
  // Writes to IndexedDB immediately, queues for sync
  // Returns a Promise so Editor can track save status accurately
  const handleNoteUpdate = useCallback(async (updatedNote: Note): Promise<void> => {
    const { userId, keys } = sessionRef.current;
    // Only the locked vault gets the unlock message; a missing user is a
    // different failure and must not be told to unlock anything.
    if (!userId) throw new Error('Cannot save without a signed-in user');
    if (!keys) throw new VaultLockedSaveError();
    // Backstop for App's locked-note redirect: never write over a note this device
    // could not read. An empty save here would destroy the ciphertext another device
    // can still open (item 41).
    if (notesRef.current.find((n) => n.id === updatedNote.id)?.decryptionFailed) {
      throw new Error('This note could not be opened on this device, so it was not saved.');
    }

    // Store previous state for potential rollback
    const previousNote = notes.find((n) => n.id === updatedNote.id);

    // Update local state immediately for responsiveness (optimistic update)
    // Set syncStatus: 'pending' so the pending→synced transition is observable (3A)
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? { ...updatedNote, syncStatus: 'pending' as const } : n))
    );

    try {
      // Encrypt and save to IndexedDB (immediate, works offline)
      // Sync engine will push encrypted payload to server when online
      const savedNote = await trackLocalWrite(() =>
        updateEncryptedNote(userId, updatedNote.id, updatedNote.title, updatedNote.content, keys)
      );

      // applySavedNote carries the same late-acknowledgement guard and also
      // keeps a pin or soft delete that landed mid-save.
      setNotes((prev) => prev.map((n) => applySavedNote(n, savedNote, updatedNote)));

      // Trigger coalesced sync (2s after last save) to push changes promptly
      triggerCoalescedSync();
    } catch (error) {
      console.error('Note save failed:', error);

      // Rollback optimistic update
      if (previousNote) {
        setNotes((prev) =>
          prev.map((n) => (n.id === updatedNote.id ? previousNote : n))
        );
      }

      // Re-throw so the editor can show its persistent "Not saved" banner,
      // which carries the Retry and Copy actions. A toast here would be a
      // second, auto-dismissing notice for the same failure.
      throw error;
    }
  }, [notes, notesRef, setNotes, triggerCoalescedSync, trackLocalWrite]);

  // Soft delete a note (move to Faded Notes)
  // Returns true on success, false on failure (for UI recovery in swipe gestures)
  const handleNoteDelete = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    // Find the note before deleting (for potential undo) — read from ref for callback stability
    const deletedNote = notesRef.current.find((n) => n.id === id);

    try {
      await softDeleteNoteOffline(userId, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      await refreshFadedNotesCount();
      if (openNoteIdRef.current === id) {
        onOpenNoteClosed();
      }

      // Show toast with undo button
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span>Note moved to Faded notes</span>
            <button type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await restoreNoteOffline(userId, id);
                  if (deletedNote) {
                    setNotes((prev) => [{ ...deletedNote, deletedAt: null }, ...prev]);
                  }
                  await refreshFadedNotesCount();
                  toast.success('Note restored');
                } catch {
                  toast.error("Couldn't restore the note. It's still in Faded notes.");
                }
              }}
              className="px-2 py-1 text-sm font-medium rounded-[var(--radius-button)] transition-colors"
              style={{
                background: 'var(--color-cta-bg)',
                color: 'var(--color-cta-text)',
              }}
            >
              Undo
            </button>
          </div>
        ),
        { duration: UNDO_TOAST_MS }
      );
      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
  }, [userId, notesRef, setNotes, refreshFadedNotesCount, openNoteIdRef, onOpenNoteClosed]);

  const handleTogglePin = useCallback(async (id: string, pinned: boolean) => {
    if (!userId) return;

    try {
      // Update local state immediately for responsiveness
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned } : n))
      );
      // Persist to IndexedDB, queue for sync
      await trackLocalWrite(() => toggleNotePinOffline(userId, id, pinned));
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      // Revert on error
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: !pinned } : n))
      );
    }
  }, [userId, setNotes, trackLocalWrite]);


  return { handleNoteUpdate, handleNoteDelete, handleTogglePin };
}
