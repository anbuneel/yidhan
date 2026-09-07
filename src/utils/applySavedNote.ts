import type { Note } from '../types';

/**
 * Fold a completed save back into the note held in React state.
 *
 * The editor sends its update as a spread of the note it was opened with, so
 * the optimistic write pairs new text with the contentHash of the old text —
 * and the search index is keyed on that hash. Only the fields the save itself
 * produced are taken back: `pinned` and `deletedAt` on the saved note come
 * from a read predating the encrypt and write, so a pin toggle or soft delete
 * arriving mid-save must survive rather than be reverted here.
 *
 * `expected` is the draft that was submitted. A save that lands after the user
 * has typed on is a stale acknowledgement and is dropped, as are the note's
 * tags, which the save does not carry.
 */
export function applySavedNote(current: Note, saved: Note, expected: Pick<Note, 'title' | 'content'>): Note {
  if (current.id !== saved.id) return current;
  if (current.title !== expected.title || current.content !== expected.content) return current;
  return {
    ...current,
    content: saved.content,
    contentHash: saved.contentHash,
    updatedAt: saved.updatedAt,
    encryptedPayload: saved.encryptedPayload,
    encryptionIv: saved.encryptionIv,
    encryptionVersion: saved.encryptionVersion,
  };
}
