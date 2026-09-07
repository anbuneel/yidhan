import { useMemo, useRef } from 'react';
import type { Note } from '../types';
import { htmlToPlainText } from '../utils/sanitize';

export function useNoteSearch(notes: Note[], query: string): Note[] {
  // This mounted library owns the cache; plaintext is never persisted.
  const cache = useRef(new Map<string, { revision: string; text: string }>());
  const index = useMemo(() => {
    const next = new Map<string, { revision: string; text: string }>();
    for (const note of notes) {
      const revision = note.contentHash ?? note.content;
      const old = cache.current.get(note.id);
      next.set(note.id, old?.revision === revision ? old : { revision, text: htmlToPlainText(note.content).toLowerCase() });
    }
    cache.current = next;
    return next;
  }, [notes]);
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter(note => note.title.toLowerCase().includes(q) || index.get(note.id)!.text.includes(q)) : notes;
  }, [notes, query, index]);
}
