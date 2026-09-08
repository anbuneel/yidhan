import { useMemo, useRef } from 'react';
import type { Note } from '../types';
import { htmlToPlainText } from '../utils/sanitize';
import { parseSearchQuery, type SearchDateFilter, type SearchQueryFilters } from '../utils/searchQuery';
import { matchesSearchText } from '../utils/searchText';

interface Entry { revision: string; source: string; text: string }

function calendarKey(date: Date, filter: SearchDateFilter): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  if (filter.precision === 'month') return `${year}-${month}`;
  return `${year}-${month}-${date.getDate().toString().padStart(2, '0')}`;
}

function matchesFilters(note: Note, filters: SearchQueryFilters): boolean {
  const noteTags = note.tags.map(({ name }) => name.toLowerCase());
  if (!filters.tags.every((tag) => noteTags.includes(tag))) return false;
  if (filters.pinned !== null && note.pinned !== filters.pinned) return false;
  if (!filters.before.every((date) => calendarKey(note.updatedAt, date) <= date.value)) return false;
  if (!filters.after.every((date) => calendarKey(note.updatedAt, date) >= date.value)) return false;
  return true;
}

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
  const parsedQuery = useMemo(() => parseSearchQuery(query), [query]);
  return useMemo(() => {
    if (!query.trim()) return notes;

    return notes.filter((note) => {
      if (!matchesFilters(note, parsedQuery.filters)) return false;
      if (parsedQuery.textTerms.length === 0) return true;
      if (note.decryptionFailed) return false;
      return matchesSearchText(
        note.title.toLowerCase(),
        index.get(note.id)!.text,
        parsedQuery.textTerms
      );
    });
  }, [notes, query, index, parsedQuery]);
}
