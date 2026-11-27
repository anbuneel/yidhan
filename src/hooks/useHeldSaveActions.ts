/**
 * Retry and Copy for held saves (issue #288): words from a note the writer left whose
 * save failed. The rule for Retry is in `utils/retryHeldSave`; this hook gives it the
 * app's notes, the save path and the way to keep words as a new note.
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DerivedKeys } from '../lib/encryption';
import type { Note, Tag } from '../types';
import { heldSaves } from '../stores/heldSaves';
import { retryHeldSave } from '../utils/retryHeldSave';
import { VaultLockedSaveError } from '../utils/saveErrors';

export interface UseHeldSaveActionsOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  notesRef: React.RefObject<Note[]>;
  tags: Tag[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  saveNote: (note: Note) => Promise<void>;
  triggerCoalescedSync: () => void;
}

export interface HeldSaveActions {
  /** Resolves true when the entry is dealt with. */
  retry: (key: string) => Promise<boolean>;
  /** Resolves true when every entry is dealt with. */
  retryAll: () => Promise<boolean>;
  /** Resolves true when the words reached the clipboard; the entry is then dropped. */
  copy: (key: string) => Promise<boolean>;
}

export function useHeldSaveActions({
  userId,
  keys,
  notesRef,
  tags,
  setNotes,
  saveNote,
  triggerCoalescedSync,
}: UseHeldSaveActionsOptions): HeldSaveActions {
  const retry = useCallback(async (key: string): Promise<boolean> => {
    const entry = heldSaves.get(key);
    if (!entry) return true;
    try {
      await retryHeldSave(entry, {
        current: notesRef.current.find((n) => n.id === entry.noteId),
        saveOver: saveNote,
        keepAsCopy: async (held, current) => {
          // Loaded on demand: this path is rare, and keeps the module out of the app shell.
          const { keepReleasedDraft } = await import('../utils/keepReleasedDraft');
          const kept = await keepReleasedDraft(userId, keys, held.title, held.content, current, tags);
          setNotes((prev) => [kept, ...prev]);
          triggerCoalescedSync();
        },
      });
      heldSaves.release(key);
      return true;
    } catch (error) {
      console.error('Retry of a held save failed:', error);
      const still = heldSaves.get(key);
      if (still) {
        heldSaves.hold({
          ...still,
          attemptedAt: Date.now(),
          detail: error instanceof VaultLockedSaveError ? error.message : '',
        });
      }
      return false;
    }
  }, [userId, keys, notesRef, tags, setNotes, saveNote, triggerCoalescedSync]);

  const retryAll = useCallback(async (): Promise<boolean> => {
    let allDone = true;
    for (const entry of heldSaves.getSnapshot()) {
      if (!(await retry(entry.key))) allDone = false;
    }
    return allDone;
  }, [retry]);

  const copy = useCallback(async (key: string): Promise<boolean> => {
    const entry = heldSaves.get(key);
    if (!entry) return true;
    try {
      const { copyNoteToClipboard } = await import('../utils/exportImport');
      const current = notesRef.current.find((n) => n.id === entry.noteId);
      const base: Note = current ?? {
        id: entry.noteId,
        title: '',
        content: '',
        createdAt: new Date(entry.attemptedAt),
        updatedAt: new Date(entry.attemptedAt),
        tags: [],
        pinned: false,
        deletedAt: null,
      };
      await copyNoteToClipboard({ ...base, title: entry.title, content: entry.content });
      heldSaves.release(key);
      return true;
    } catch (error) {
      console.error('Copy of a held save failed:', error);
      return false;
    }
  }, [notesRef]);

  return { retry, retryAll, copy };
}
