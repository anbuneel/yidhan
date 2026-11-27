/**
 * Saves for each note, across Editor instances (issue #288).
 *
 * - The write in flight per note. Leaving a note and coming back mounts a new Editor
 *   while the old one's save may still run. Later saves wait for it, so two writes
 *   for one note never race.
 * - The newest draft waiting to be written per note. A reopened Editor starts from it
 *   instead of the older text the list holds, so words queued behind a slow save are
 *   on screen and are not typed over.
 * - Every save still running, including ones from Editors already gone, so a lock
 *   can wait for them before it decides.
 */
export interface PendingDraft {
  title: string;
  content: string;
}

const inFlight = new Map<string, Promise<boolean>>();
const pendingDrafts = new Map<string, PendingDraft>();
const running = new Set<Promise<unknown>>();

function timeout(ms: number): Promise<'timeout'> {
  return new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
}

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
    await noteSaveQueue.waitIdle(noteId);
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

  pendingDraft(noteId: string): PendingDraft | undefined {
    return pendingDrafts.get(noteId);
  },
  setPendingDraft(noteId: string, draft: PendingDraft): void {
    pendingDrafts.set(noteId, draft);
  },
  /** Clears the draft only if it is still this one. */
  clearPendingDraft(noteId: string, draft: PendingDraft): void {
    if (pendingDrafts.get(noteId) === draft) pendingDrafts.delete(noteId);
  },

  /** Count a save as running until it settles. Returns the same promise. */
  track<T>(save: Promise<T>): Promise<T> {
    running.add(save);
    void save.finally(() => running.delete(save)).catch(() => {});
    return save;
  },

  /** Resolves true once every running save has settled, false if `ms` ran out first. */
  async drain(ms: number): Promise<boolean> {
    const deadline = timeout(ms);
    while (running.size > 0) {
      const settled = Promise.allSettled([...running]).then(() => 'settled' as const);
      if ((await Promise.race([settled, deadline])) === 'timeout') return false;
    }
    return true;
  },
};

/** Test helper: forget every save, including ones a test left unresolved. */
export function resetNoteSaveQueue(): void {
  inFlight.clear();
  pendingDrafts.clear();
  running.clear();
}
