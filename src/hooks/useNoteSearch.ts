import MiniSearch, { type SearchResult } from 'minisearch';
import { useMemo, useRef } from 'react';
import type { Note } from '../types';
import { htmlToPlainText } from '../utils/sanitize';
import {
  parseSearchQuery,
  type SearchDateFilter,
  type SearchQueryFilters,
  type SearchTextTerm,
} from '../utils/searchQuery';

interface SearchDocument {
  id: string;
  title: string;
  content: string;
  source: string;
}

interface SearchIndexState {
  documents: Map<string, SearchDocument>;
  index: MiniSearch<SearchDocument>;
}

interface RankedResult {
  id: string;
  score: number;
  titleMatches: number;
}

const SEARCH_OPTIONS = {
  boost: { title: 8, content: 1 },
  combineWith: 'AND' as const,
  maxFuzzy: 2,
  weights: { fuzzy: 0.65, prefix: 0.85 },
};

function createSearchIndex(): SearchIndexState {
  return {
    documents: new Map(),
    index: new MiniSearch<SearchDocument>({
      fields: ['title', 'content'],
      idField: 'id',
    }),
  };
}

function searchDocument(note: Note): SearchDocument {
  return {
    id: note.id,
    title: note.title,
    content: htmlToPlainText(note.content),
    source: note.content,
  };
}

function matchesNote(document: SearchDocument, note: Note): boolean {
  return document.title === note.title && document.source === note.content;
}

function reconcileSearchIndex(state: SearchIndexState, notes: Note[]): void {
  const retainedIds = new Set<string>();

  for (const note of notes) {
    if (note.decryptionFailed) continue;

    retainedIds.add(note.id);
    const previous = state.documents.get(note.id);
    if (previous && matchesNote(previous, note)) continue;

    const next = searchDocument(note);
    if (previous) state.index.remove(previous);
    state.index.add(next);
    state.documents.set(note.id, next);
  }

  for (const [id, document] of state.documents) {
    if (retainedIds.has(id)) continue;
    state.index.remove(document);
    state.documents.delete(id);
  }
}

function hasTitleMatch(result: SearchResult): boolean {
  return Object.values(result.match).some((fields) => fields.includes('title'));
}

function matchesExactPhrase(document: SearchDocument, term: SearchTextTerm): boolean {
  if (!term.quoted) return true;
  return document.title.toLowerCase().includes(term.normalized)
    || document.content.toLowerCase().includes(term.normalized);
}

function phraseMatchesTitle(document: SearchDocument, term: SearchTextTerm): boolean {
  return term.quoted && document.title.toLowerCase().includes(term.normalized);
}

function searchTerm(state: SearchIndexState, term: SearchTextTerm): SearchResult[] {
  return state.index.search(term.value, {
    ...SEARCH_OPTIONS,
    // Prefixes keep type-ahead useful, but a single character must mean an exact
    // one-character token rather than almost every word in the library.
    prefix: term.quoted ? false : (token) => token.length >= 2,
    // Short fuzzy terms create noise much faster than signal. Four characters is
    // the floor; longer terms allow at most two edits.
    fuzzy: term.quoted ? false : (token) => token.length >= 4 ? 0.2 : false,
  });
}

function rankedTextMatches(state: SearchIndexState, terms: SearchTextTerm[]): RankedResult[] {
  let matches: Map<string, RankedResult> | null = null;

  for (const term of terms) {
    const termMatches = new Map<string, RankedResult>();
    for (const result of searchTerm(state, term)) {
      const id = String(result.id);
      const document = state.documents.get(id);
      if (!document || !matchesExactPhrase(document, term)) continue;

      termMatches.set(id, {
        id,
        score: result.score,
        titleMatches: (term.quoted
          ? phraseMatchesTitle(document, term)
          : hasTitleMatch(result)) ? 1 : 0,
      });
    }

    if (matches === null) {
      matches = termMatches;
      continue;
    }

    for (const [id, aggregate] of matches) {
      const next = termMatches.get(id);
      if (!next) {
        matches.delete(id);
        continue;
      }
      aggregate.score += next.score;
      aggregate.titleMatches += next.titleMatches;
    }
  }

  return [...(matches?.values() ?? [])]
    .sort((left, right) =>
      right.titleMatches - left.titleMatches
      || right.score - left.score
      || left.id.localeCompare(right.id)
    );
}

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
  // This mounted library owns the index. Its plaintext never leaves process memory.
  const state = useRef<SearchIndexState | null>(null);
  if (!state.current) state.current = createSearchIndex();

  const indexState = useMemo(() => {
    reconcileSearchIndex(state.current!, notes);
    return state.current!;
  }, [notes]);
  const parsedQuery = useMemo(() => parseSearchQuery(query), [query]);
  return useMemo(() => {
    if (!query.trim()) return notes;

    if (parsedQuery.textTerms.length === 0) {
      return notes.filter((note) => matchesFilters(note, parsedQuery.filters));
    }

    const notesById = new Map(notes.map((note) => [note.id, note]));
    return rankedTextMatches(indexState, parsedQuery.textTerms)
      .map(({ id }) => notesById.get(id))
      .filter((note): note is Note => note !== undefined)
      .filter((note) => matchesFilters(note, parsedQuery.filters));
  }, [notes, query, indexState, parsedQuery]);
}
