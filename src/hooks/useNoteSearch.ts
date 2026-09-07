import { useMemo, useRef } from 'react';
import type { Note } from '../types';
import { htmlToPlainText } from '../utils/sanitize';

interface Entry { revision: string; source: string; text: string }

export function useNoteSearch(notes: Note[], query: string): Note[] {
  // This mounted library owns the cache; plaintext is never persisted.
  const cache = useRef(new Map<string, Entry>());
  const index = useMemo(() => {
    const next = new Map<string, Entry>();
    for (const note of notes) {
      const revision = note.contentHash ?? note.content;
      const old = cache.current.get(note.id);
      // The hash alone would trust every caller to recompute it on edit; also
      // holding the source keeps a note whose hash lagged its text searchable.
      const reusable = old?.revision === revision && old.source === note.content;
      next.set(note.id, reusable ? old : { revision, source: note.content, text: htmlToPlainText(note.content).toLowerCase() });
    }
    // Idempotent memoization only: every entry is checked against this render's revision.
    // Updating synchronously lets consecutive renders reuse text without an effect lag.
    cache.current = next;
    return next;
  }, [notes]);
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter(note => note.title.toLowerCase().includes(q) || index.get(note.id)!.text.includes(q)) : notes;
  }, [notes, query, index]);
}
