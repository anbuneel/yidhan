/**
 * The save in flight for each note, across Editor instances (issue #288).
 *
 * Leaving a note and coming back mounts a new Editor while the old one's save may
 * still run. The new one's saves wait for it, so two writes for one note never race.
 */
const inFlight = new Map<string, Promise<boolean>>();

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
};

/** Test helper: forget every save, including ones a test left unresolved. */
export function resetNoteSaveQueue(): void {
  inFlight.clear();
}
