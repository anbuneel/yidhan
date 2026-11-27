/**
 * A note whose ciphertext would not open on this device (item 41).
 *
 * Two rules, and both of them are about not destroying words. A locked note is never
 * opened in the editor — its title and content are empty by construction, so the first
 * autosave would write nothing over ciphertext another device can still read. And the
 * reader is offered a retry rather than a dead card, because the usual cause is a vault
 * unlocked with the wrong passphrase, which the next unlock fixes.
 */

import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Note } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import type { NotesSync } from './useNotesSync';

export interface UseLockedNotesOptions {
  /** The note the address names, locked or not. Null when no note is open. */
  openNote: Note | undefined;
  userId: string | undefined;
  keys: DerivedKeys | null;
  /** The guarded re-read from IndexedDB (useNotesSync). */
  reloadFromStorage: NotesSync['reloadFromStorage'];
  /** Correct the address away from a note that cannot be opened. */
  onLockedNoteOpened: () => void;
}

export function useLockedNotes({
  openNote,
  userId,
  keys,
  reloadFromStorage,
  onLockedNoteOpened,
}: UseLockedNotesOptions): { retryLockedNotes: () => Promise<void> } {
  // Under the router the open note *is* the address, so refusing to open a locked note
  // means correcting the address rather than clearing a selection beside it.
  useEffect(() => {
    if (!openNote?.decryptionFailed) return;
    onLockedNoteOpened();
    toast('That note could not be opened on this device.');
  }, [openNote, onLockedNoteOpened]);

  const retryLockedNotes = useCallback(async () => {
    if (!userId || !keys) return;
    try {
      // Deferred or superseded: a later refresh applies the list, so no notice here.
      await reloadFromStorage();
    } catch (error) {
      console.error('Failed to re-read notes:', error);
      toast.error('Could not open those notes. Lock and unlock your vault, then try again.');
    }
  }, [userId, keys, reloadFromStorage]);

  return { retryLockedNotes };
}
