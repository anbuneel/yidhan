import type { Note } from '../types';

/**
 * Put notes at the top of the list, replacing any copy already there.
 *
 * A note is written to IndexedDB before it is added to the list. A refresh that reads
 * in between already holds it, so a plain prepend would show it twice.
 */
export function withNotesFirst(prev: Note[], added: Note[]): Note[] {
  const ids = new Set(added.map((note) => note.id));
  return [...added, ...prev.filter((note) => !ids.has(note.id))];
}
