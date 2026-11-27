/**
 * Retry and Copy for held saves (issue #288): words from a note the writer left whose
 * save failed. The rule for Retry is in `utils/retryHeldSave`; this hook gives it the
 * app's notes, the save path and the way to keep words as a new note.
 */
import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type { DerivedKeys } from '../lib/encryption';
import type { Note, Tag } from '../types';
import { heldSaves } from '../stores/heldSaves';
import { noteSaveQueue } from '../stores/noteSaveQueue';
import { retryHeldSave } from '../utils/retryHeldSave';
import { VaultLockedSaveError } from '../utils/saveErrors';
import { keepReleasedDraft } from '../utils/keepReleasedDraft';
import { copyNoteToClipboard } from '../utils/exportImport';

export interface UseHeldSaveActionsOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  notesRef: React.RefObject<Note[]>;
  tags: Tag[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  saveNote: (note: Note) => Promise<void>;
  triggerCoalescedSync: () => void;
  /** Marks a write a list refresh must wait for (`useNotesSync`). */
  trackLocalWrite: <T>(write: () => Promise<T>) => Promise<T>;
  /** True when an open Editor on this note holds words its stored copy does not. */
  hasOpenDraft: (noteId: string) => boolean;
}

export interface HeldSaveActions {
  /** Resolves true when the entry is dealt with. */
  retry: (key: string) => Promise<boolean>;
  /** Resolves true when every entry is dealt with. */
  retryAll: () => Promise<boolean>;
  /** Resolves true when the words reached the clipboard; the entry is then dropped. */
  copy: (key: string) => Promise<boolean>;
}

const RETRY_FAILED = 'Still not saved. Try again, or copy the words.';
/** How long Retry waits for an earlier write of the note before it gives up. */
const RETRY_WAIT_MS = 5000;

class RetryTimedOut extends Error {}

export function useHeldSaveActions({
  userId,
  keys,
  notesRef,
  tags,
  setNotes,
  saveNote,
  triggerCoalescedSync,
  trackLocalWrite,
  hasOpenDraft,
}: UseHeldSaveActionsOptions): HeldSaveActions {
  // One retry per entry at a time: a click and a lock's retry share it, so the words
  // are never kept as two new notes.
  const retriesRef = useRef(new Map<string, Promise<boolean>>());

  const runRetry = useCallback(async (key: string): Promise<boolean> => {
    const entry = heldSaves.get(key);
    if (!entry) return true;
    const fromSession = heldSaves.session();
    try {
      // Let any write for this note finish first. The list then shows what is stored,
      // not an optimistic copy that may still fail.
      const idle = await Promise.race([
        noteSaveQueue.waitIdle(entry.noteId).then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), RETRY_WAIT_MS)),
      ]);
      if (!idle) throw new RetryTimedOut();
      if (!heldSaves.isCurrent(fromSession)) return false;
      await retryHeldSave(entry, {
        current: notesRef.current.find((n) => n.id === entry.noteId),
        // An open Editor with its own unsaved words on this note counts as a change:
        // saving over the stored copy would race those words.
        openDraft: hasOpenDraft(entry.noteId),
        saveOver: (note) => noteSaveQueue.run(note.id, () => {
          // The vault may have locked, or the note changed, while this waited its turn.
          // A change makes this attempt fail; the next Retry keeps a copy instead.
          if (!heldSaves.isCurrent(fromSession)) throw new VaultLockedSaveError();
          const now = notesRef.current.find((n) => n.id === note.id);
          if (!now || now.title !== entry.baseTitle || now.content !== entry.baseContent) {
            throw new Error('The note changed while Retry waited.');
          }
          return saveNote(note);
        }),
        keepAsCopy: async (held, original) => {
          if (!heldSaves.isCurrent(fromSession)) throw new VaultLockedSaveError();
          const kept = await trackLocalWrite(() =>
            keepReleasedDraft(userId, keys, held.title, held.content, original, tags)
          );
          // The vault locked during the write: the note is stored, encrypted, and
          // loads with the list next time. Decrypted text stays out of app state.
          if (!heldSaves.isCurrent(fromSession)) return;
          setNotes((prev) => [kept, ...prev]);
          triggerCoalescedSync();
        },
      });
      heldSaves.release(key, entry.revision);
      return true;
    } catch (error) {
      console.error('Retry of a held save failed:', error);
      const still = heldSaves.get(key);
      if (still && still.revision === entry.revision) {
        heldSaves.hold({
          ...still,
          attemptedAt: Date.now(),
          detail: error instanceof VaultLockedSaveError ? error.message : RETRY_FAILED,
        }, fromSession);
      }
      return false;
    }
  }, [userId, keys, notesRef, tags, setNotes, saveNote, triggerCoalescedSync, trackLocalWrite, hasOpenDraft]);

  const retry = useCallback((key: string): Promise<boolean> => {
    const running = retriesRef.current.get(key);
    if (running) return running;
    const attempt = runRetry(key).finally(() => retriesRef.current.delete(key));
    retriesRef.current.set(key, attempt);
    return attempt;
  }, [runRetry]);

  const retryAll = useCallback(async (): Promise<boolean> => {
    let allDone = true;
    for (const entry of heldSaves.getSnapshot()) {
      if (!(await retry(entry.key))) allDone = false;
    }
    return allDone;
  }, [retry]);

  const copy = useCallback(async (key: string): Promise<boolean> => {
    // Copy never waits on the save path: it is the way out when saving hangs.
    const entry = heldSaves.get(key);
    if (!entry) return true;
    try {
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
      // Only the words that reached the clipboard: a newer failure stays held.
      heldSaves.release(key, entry.revision);
      return true;
    } catch (error) {
      console.error('Copy of a held save failed:', error);
      return false;
    }
  }, [notesRef]);

  return { retry, retryAll, copy };
}
