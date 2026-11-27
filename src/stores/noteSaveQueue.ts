/**
 * Saves for each note, across Editor instances (issue #288).
 *
 * - The write in flight per note. Leaving a note and coming back mounts a new Editor
 *   while the old one's save may still run. Later saves wait for it, so two writes
 *   for one note never race.
 * - The newest draft waiting to be written per note. A reopened Editor starts from it
 *   instead of the older text the list holds, so words queued behind a slow save are
 *   on screen and are not typed over.
 *
 * Saves still running, which a lock waits for, are counted in `heldSaves`, so the
 * app shell does not load this module.
 */
import { heldSaves } from './heldSaves';

export interface PendingDraft {
  title: string;
  content: string;
}

interface SessionDraft extends PendingDraft {
  session: number;
}

const inFlight = new Map<string, Promise<boolean>>();
const pendingDrafts = new Map<string, SessionDraft>();
const draftKeys = new WeakMap<PendingDraft, SessionDraft>();

export const noteSaveQueue = {
  get(noteId: string): Promise<boolean> | undefined {
    return inFlight.get(noteId);
  },
  set(noteId: string, save: Promise<boolean>): void {
    inFlight.set(noteId, save);
  },
  /** Clears the entry only if it is still this save. */
  settle(noteId: string, save: Promise<boolean>): void {
    if (inFlight.get(noteId) === save) inFlight.delete(noteId);
  },

  /** Resolves once no write for this note is in flight. */
  async waitIdle(noteId: string): Promise<void> {
    let pending = inFlight.get(noteId);
    while (pending) {
      await pending.catch(() => false);
      const next = inFlight.get(noteId);
      if (next === pending) return;
      pending = next;
    }
  },

  /** Run a write for this note in turn, after any in flight. */
  async run<T>(noteId: string, write: () => Promise<T>): Promise<T> {
    // Check and take the slot in one synchronous step, so no other write slips in.
    for (let pending = inFlight.get(noteId); pending; pending = inFlight.get(noteId)) {
      await pending.catch(() => false);
    }
    let done!: (ok: boolean) => void;
    const slot = new Promise<boolean>((resolve) => { done = resolve; });
    inFlight.set(noteId, slot);
    try {
      const result = await write();
      done(true);
      return result;
    } catch (error) {
      done(false);
      throw error;
    } finally {
      noteSaveQueue.settle(noteId, slot);
    }
  },

  /**
   * The newest draft waiting to be written for this note, from the current vault
   * session only. A draft from before a lock is decrypted text from a vault since
   * closed; it is dropped, never shown again.
   */
  pendingDraft(noteId: string): PendingDraft | undefined {
    const draft = pendingDrafts.get(noteId);
    if (!draft) return undefined;
    if (!heldSaves.isCurrent(draft.session)) {
      pendingDrafts.delete(noteId);
      return undefined;
    }
    return { title: draft.title, content: draft.content };
  },
  setPendingDraft(noteId: string, draft: PendingDraft): void {
    const stored = { ...draft, session: heldSaves.session() };
    draftKeys.set(draft, stored);
    pendingDrafts.set(noteId, stored);
  },
  /** Clears the draft only if it is still this one. */
  clearPendingDraft(noteId: string, draft: PendingDraft): void {
    if (pendingDrafts.get(noteId) === draftKeys.get(draft)) pendingDrafts.delete(noteId);
  },
  /** Vault locked: forget every waiting draft. */
  clearPendingDrafts(): void {
    pendingDrafts.clear();
  },

};

// Waiting drafts are decrypted text: every lock or user change drops them.
heldSaves.onClose(() => noteSaveQueue.clearPendingDrafts());

/** Test helper: forget every save, including ones a test left unresolved. */
export function resetNoteSaveQueue(): void {
  inFlight.clear();
  pendingDrafts.clear();
}
