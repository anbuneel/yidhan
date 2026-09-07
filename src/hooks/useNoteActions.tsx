/**
 * What a reader can do to a note: save it, let it fade, pin it.
 *
 * Every one is offline-first — IndexedDB immediately, sync queued after — and every
 * one is optimistic, so each also owns its rollback. That pairing is why they belong
 * together rather than beside the rendering.
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { VaultLockedSaveError } from '../utils/saveErrors';
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
  setFadedNotesCount: Dispatch<SetStateAction<number>>;
  openNoteIdRef: React.RefObject<string | null>;
  /** Close the editor when the note it is showing is the one being deleted. */
  onOpenNoteClosed: () => void;
  triggerCoalescedSync: () => void;
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
  setFadedNotesCount,
  openNoteIdRef,
  onOpenNoteClosed,
  triggerCoalescedSync,
}: UseNoteActionsOptions): NoteActions {
  // Note update with offline-first approach
  // Writes to IndexedDB immediately, queues for sync
  // Returns a Promise so Editor can track save status accurately
  const handleNoteUpdate = useCallback(async (updatedNote: Note): Promise<void> => {
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
      const savedNote = await updateEncryptedNote(userId, updatedNote.id, updatedNote.title, updatedNote.content, keys);

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
  }, [userId, keys, notes, notesRef, setNotes, triggerCoalescedSync]);

  // Soft delete a note (move to Faded Notes)
  // Returns true on success, false on failure (for UI recovery in swipe gestures)
  const handleNoteDelete = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    // Find the note before deleting (for potential undo) — read from ref for callback stability
    const deletedNote = notesRef.current.find((n) => n.id === id);

    try {
      await softDeleteNoteOffline(userId, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setFadedNotesCount((prev) => prev + 1);
      if (openNoteIdRef.current === id) {
        onOpenNoteClosed();
      }

      // Show toast with undo button
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span>Note moved to Faded Notes</span>
            <button type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await restoreNoteOffline(userId, id);
                  if (deletedNote) {
                    setNotes((prev) => [{ ...deletedNote, deletedAt: null }, ...prev]);
                  }
                  setFadedNotesCount((prev) => Math.max(0, prev - 1));
                  toast.success('Note restored');
                } catch {
                  toast.error('Failed to undo');
                }
              }}
              className="px-2 py-1 text-sm font-medium rounded transition-colors"
              style={{
                background: 'var(--color-cta-bg)',
                color: 'var(--color-cta-text)',
              }}
            >
              Undo
            </button>
          </div>
        ),
        { duration: 5000 }
      );
      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
      return false;
    }
  }, [userId, notesRef, setNotes, setFadedNotesCount, openNoteIdRef, onOpenNoteClosed]);

  const handleTogglePin = useCallback(async (id: string, pinned: boolean) => {
    if (!userId) return;

    try {
      // Update local state immediately for responsiveness
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned } : n))
      );
      // Persist to IndexedDB, queue for sync
      await toggleNotePinOffline(userId, id, pinned);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      // Revert on error
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: !pinned } : n))
      );
    }
  }, [userId, setNotes]);


  return { handleNoteUpdate, handleNoteDelete, handleTogglePin };
}
