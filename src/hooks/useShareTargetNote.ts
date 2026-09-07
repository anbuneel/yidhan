/**
 * A share arriving from another app becomes a note.
 *
 * Waits for the vault keys before creating anything: without that guard the fallback
 * path would write a plaintext note before the passphrase gate had even rendered.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { createEncryptedNote } from '../services/encryptedNotes';
import { formatSharedContent, type SharedData } from './useShareTarget';

export interface UseShareTargetNoteOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  sharedData: SharedData | null;
  clearSharedData: () => void;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  onNoteCreated: (noteId: string) => void;
  onNoteTracked: () => void;
  runInTransition: (fn: () => void) => void;
}

export function useShareTargetNote({
  userId,
  keys,
  sharedData,
  clearSharedData,
  setNotes,
  onNoteCreated,
  onNoteTracked,
  runInTransition,
}: UseShareTargetNoteOptions): void {
  const isCreatingNoteFromShare = useRef(false);
  const onNoteCreatedRef = useRef(onNoteCreated);
  onNoteCreatedRef.current = onNoteCreated;

  // Handle Share Target data for authenticated users
  useEffect(() => {
    if (!userId || !sharedData) return;
    // Prevent duplicate note creation (race condition in Strict Mode)
    if (isCreatingNoteFromShare.current) return;

    // Wait for encryption keys before creating note.
    // Without this guard, the fallback would create a plaintext note
    // before the passphrase gate renders.
    if (!keys) return;

    isCreatingNoteFromShare.current = true;

    const { title, content } = formatSharedContent(sharedData);

    createEncryptedNote(userId, title, content, keys)
      .then((newNote) => {
        clearSharedData();
        onNoteTracked();
        toast.success('Note created from share');
        runInTransition(() => {
          setNotes((prev) => [newNote, ...prev]);
          onNoteCreatedRef.current(newNote.id);
        });
      })
      .catch((error: unknown) => {
        console.error('Failed to create note from share:', error);
        toast.error('Failed to create note from share');
      })
      .finally(() => {
        // Reset flag to allow future share-target launches in same session
        isCreatingNoteFromShare.current = false;
      });
  }, [userId, sharedData, keys, clearSharedData, setNotes, onNoteTracked, runInTransition]);
}
