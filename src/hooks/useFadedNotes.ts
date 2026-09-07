/**
 * The faded view: the notes themselves, their loading state, and the three things that
 * can happen to one.
 *
 * The *count* deliberately lives in the data layer instead, because realtime updates
 * it from another device; this hook owns only what the view shows.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { emptyFadedNotes } from '../services/notes';
import { fetchDecryptedFadedNotes } from '../services/encryptedNotes';
import {
  restoreNoteOffline,
  permanentDeleteNoteOffline,
} from '../services/offlineNotes';

export interface UseFadedNotesOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  /** True while the faded route is showing, which is what triggers the load. */
  isViewingFaded: boolean;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setFadedNotesCount: Dispatch<SetStateAction<number>>;
}

export interface FadedNotes {
  fadedNotes: Note[];
  fadedNotesLoading: boolean;
  handleRestoreNote: (id: string) => Promise<void>;
  handlePermanentDelete: (id: string) => Promise<void>;
  handleEmptyFadedNotes: () => Promise<void>;
}

export function useFadedNotes({
  userId,
  keys,
  isViewingFaded,
  setNotes,
  setFadedNotesCount,
}: UseFadedNotesOptions): FadedNotes {
  const [fadedNotes, setFadedNotes] = useState<Note[]>([]);
  const [fadedNotesLoading, setFadedNotesLoading] = useState(false);

  // The list is per-user; a sign-out must not leave the previous account's notes
  // sitting in memory behind the landing page.
  useEffect(() => {
    if (!userId) setFadedNotes([]);
  }, [userId]);

  // Restore a note from Faded Notes
  const handleRestoreNote = async (id: string) => {
    if (!userId) return;

    try {
      await restoreNoteOffline(userId, id);
      // Find the note in fadedNotes and move it back
      const restoredNote = fadedNotes.find((n) => n.id === id);
      if (restoredNote) {
        setFadedNotes((prev) => prev.filter((n) => n.id !== id));
        setNotes((prev) => [{ ...restoredNote, deletedAt: null }, ...prev]);
      }
      setFadedNotesCount((prev) => Math.max(0, prev - 1));
      toast.success('Note restored');
    } catch (error) {
      console.error('Failed to restore note:', error);
      toast.error('Failed to restore note');
    }
  };

  // Permanently delete a note
  const handlePermanentDelete = async (id: string) => {
    if (!userId) return;

    try {
      await permanentDeleteNoteOffline(userId, id);
      setFadedNotes((prev) => prev.filter((n) => n.id !== id));
      setFadedNotesCount((prev) => Math.max(0, prev - 1));
      toast.success('Note permanently deleted');
    } catch (error) {
      console.error('Failed to permanently delete note:', error);
      toast.error('Failed to delete note');
    }
  };

  // Empty all faded notes
  const handleEmptyFadedNotes = async () => {
    try {
      await emptyFadedNotes();
      setFadedNotes([]);
      setFadedNotesCount(0);
      toast.success('All faded notes deleted');
    } catch (error) {
      console.error('Failed to empty faded notes:', error);
      toast.error('Failed to empty faded notes');
    }
  };

  // `/faded` is an address now, so the fetch hangs off being *on* the route rather
  // than off the click that used to be the only way to get there. Direct entry, a
  // refresh, and Back into the view all load the same way.
  const loadFadedNotes = useCallback(async (ownerId: string, vaultKeys: DerivedKeys) => {
    setFadedNotesLoading(true);
    try {
      setFadedNotes(await fetchDecryptedFadedNotes(ownerId, vaultKeys));
    } catch (error) {
      console.error('Failed to fetch faded notes:', error);
      toast.error('Failed to load faded notes');
    } finally {
      setFadedNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isViewingFaded || !userId || !keys) return;
    void loadFadedNotes(userId, keys);
  }, [isViewingFaded, userId, keys, loadFadedNotes]);

  return {
    fadedNotes,
    fadedNotesLoading,
    handleRestoreNote,
    handlePermanentDelete,
    handleEmptyFadedNotes,
  };
}
