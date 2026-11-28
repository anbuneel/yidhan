import type MiniSearch from 'minisearch';
import type { SearchResult } from 'minisearch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '../types';
import { htmlToPlainText } from '../utils/sanitize';
import {
  getLoadedMiniSearch,
  loadMiniSearch,
  subscribeSearchIntent,
  type MiniSearchConstructor,
} from '../utils/miniSearchRuntime';
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
}

interface IndexedEntry {
  document: SearchDocument;
  /**
   * Points to the latest live `note.content` string reference. Comparing with `===`
   * stays fast across sync refreshes (V8 native compare), and rebinding to the
   * incoming string on match lets older decrypted allocations be GC'd so only one
   * copy of the HTML is retained in memory. Never passed to MiniSearch.
   */
  contentRef: string;
}

interface SearchIndexState {
  entries: Map<string, IndexedEntry>;
  seenNotes: WeakMap<Note, IndexedEntry>;
  index: MiniSearch<SearchDocument> | null;
}

interface RankedResult {
  id: string;
  score: number;
  titleMatches: number;
  matchedTerms: Set<string>;
}

export interface NoteSearchResults {
  notes: Note[];
  matchedTermsByNoteId: ReadonlyMap<string, readonly string[]>;
  isRankedSearch: boolean;
}

export interface UseNoteSearchOptions {
  /**
   * Whether indexing and searching are permitted. False when the vault is locked
   * or signed out: drops any existing index immediately and cancels in-flight builds.
   */
  enabled?: boolean;
  /**
   * Session/vault identity (e.g. user id + keys). Changing it drops any existing
   * index and cancels any in-flight build so plaintext never crosses sessions.
   */
  sessionKey?: unknown;
  /**
   * Load MiniSearch and build the index on idle after the library paints.
   * Defaults to true; Practice Space (/demo) passes false so MiniSearch is not
   * fetched before search is used.
   */
  preloadOnIdle?: boolean;
}

const SEARCH_OPTIONS = {
  boost: { title: 8, content: 1 },
  combineWith: 'AND' as const,
  maxFuzzy: 2,
  weights: { fuzzy: 0.65, prefix: 0.85 },
};

/** Longest the post-paint idle index build waits for the main thread to go quiet. */
const SEARCH_IDLE_TIMEOUT_MS = 1500;
/** Fallback delay after paint where requestIdleCallback is unavailable (e.g. Safari). */
const SEARCH_IDLE_FALLBACK_MS = 300;
const FALLBACK_TOKEN_SPLIT = /[\s\p{P}]+/u;
const EMPTY_MATCH_TERMS: ReadonlyMap<string, readonly string[]> = new Map();

function createSearchState(MiniSearchCtor: MiniSearchConstructor | null): SearchIndexState {
  return {
    entries: new Map(),
    seenNotes: new WeakMap(),
    index: MiniSearchCtor
      ? new MiniSearchCtor<SearchDocument>({
          fields: ['title', 'content'],
          idField: 'id',
        })
      : null,
  };
}

function reconcileSearchState(state: SearchIndexState, notes: Note[]): void {
  const retainedIds = new Set<string>();

  for (const note of notes) {
    if (note.decryptionFailed) continue;

    retainedIds.add(note.id);
    const previous = state.entries.get(note.id);
    // O(1) fast path for untouched Note references. Comparing the WeakMap value
    // against `previous` guarantees a rollback restoring an earlier Note object
    // still reindexes instead of looking up to date.
    if (previous && state.seenNotes.get(note) === previous) continue;

    const contentUnchanged = previous !== undefined && previous.contentRef === note.content;
    if (previous && contentUnchanged) {
      // Rebind to the current live string reference so a sync refresh does not
      // leave an older decrypted copy pinned beside React's note list.
      previous.contentRef = note.content;
      if (previous.document.title === note.title) {
        state.seenNotes.set(note, previous);
        continue;
      }
    }

    const nextEntry: IndexedEntry = {
      document: {
        id: note.id,
        title: note.title,
        content: contentUnchanged ? previous.document.content : htmlToPlainText(note.content),
      },
      contentRef: note.content,
    };

    if (state.index) {
      if (previous) state.index.remove(previous.document);
      state.index.add(nextEntry.document);
    }
    state.entries.set(note.id, nextEntry);
    state.seenNotes.set(note, nextEntry);
  }

  for (const [id, entry] of state.entries) {
    if (retainedIds.has(id)) continue;
    state.index?.remove(entry.document);
    state.entries.delete(id);
  }
}

function attachMiniSearchIndex(
  existing: SearchIndexState | null,
  MiniSearchCtor: MiniSearchConstructor,
  notes: Note[]
): SearchIndexState {
  if (existing?.index) {
    reconcileSearchState(existing, notes);
    return existing;
  }

  const index = new MiniSearchCtor<SearchDocument>({
    fields: ['title', 'content'],
    idField: 'id',
  });

  if (existing) {
    // Reuse plain-text documents already extracted by a pre-load fallback scan
    // so htmlToPlainText runs at most once per note. Return a fresh wrapper so
    // downstream memos see the transition from fallback scan to MiniSearch.
    reconcileSearchState(existing, notes);
    for (const entry of existing.entries.values()) {
      index.add(entry.document);
    }
    return {
      entries: existing.entries,
      seenNotes: existing.seenNotes,
      index,
    };
  }

  const created = createSearchState(MiniSearchCtor);
  reconcileSearchState(created, notes);
  return created;
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

function searchTerm(
  index: MiniSearch<SearchDocument>,
  term: SearchTextTerm
): SearchResult[] {
  return index.search(term.value, {
    ...SEARCH_OPTIONS,
    // Prefixes keep type-ahead useful, but a single character must mean an exact
    // one-character token rather than almost every word in the library.
    prefix: term.quoted ? false : (token) => token.length >= 2,
    // Short fuzzy terms create noise much faster than signal. Four characters is
    // the floor; longer terms allow at most two edits.
    fuzzy: term.quoted ? false : (token) => token.length >= 4 ? 0.2 : false,
  });
}

function rankedTextMatches(
  index: MiniSearch<SearchDocument>,
  entries: Map<string, IndexedEntry>,
  terms: SearchTextTerm[]
): RankedResult[] {
  let matches: Map<string, RankedResult> | null = null;

  for (const term of terms) {
    const termMatches = new Map<string, RankedResult>();
    for (const result of searchTerm(index, term)) {
      const id = String(result.id);
      const document = entries.get(id)?.document;
      if (!document || !matchesExactPhrase(document, term)) continue;

      termMatches.set(id, {
        id,
        score: result.score,
        titleMatches: (term.quoted
          ? phraseMatchesTitle(document, term)
          : hasTitleMatch(result)) ? 1 : 0,
        // MiniSearch reports the indexed token that satisfied a fuzzy or prefix
        // query. Cards use that exact token so every visible result can show why
        // it matched. Quoted phrases remain one literal highlight.
        matchedTerms: new Set(term.quoted
          ? [term.normalized]
          : Object.keys(result.match)),
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
      next.matchedTerms.forEach((matchedTerm) => aggregate.matchedTerms.add(matchedTerm));
    }
  }

  return [...(matches?.values() ?? [])]
    .sort((left, right) =>
      right.titleMatches - left.titleMatches
      || right.score - left.score
      || left.id.localeCompare(right.id)
    );
}

function fallbackTextMatches(
  entries: Map<string, IndexedEntry>,
  terms: SearchTextTerm[]
): RankedResult[] {
  const results: RankedResult[] = [];

  for (const { document } of entries.values()) {
    const titleLower = document.title.toLowerCase();
    const contentLower = document.content.toLowerCase();
    let titleTokens: string[] | null = null;
    let contentTokens: string[] | null = null;
    let score = 0;
    let titleMatches = 0;
    const matchedTerms = new Set<string>();
    let matched = true;

    for (const term of terms) {
      if (term.quoted) {
        const inTitle = titleLower.includes(term.normalized);
        if (!inTitle && !contentLower.includes(term.normalized)) {
          matched = false;
          break;
        }
        if (inTitle) titleMatches += 1;
        score += inTitle ? SEARCH_OPTIONS.boost.title : SEARCH_OPTIONS.boost.content;
        matchedTerms.add(term.normalized);
        continue;
      }

      titleTokens ??= titleLower.split(FALLBACK_TOKEN_SPLIT).filter(Boolean);
      contentTokens ??= contentLower.split(FALLBACK_TOKEN_SPLIT).filter(Boolean);
      const queryTokens = term.normalized.split(FALLBACK_TOKEN_SPLIT).filter(Boolean);
      if (queryTokens.length === 0) {
        matched = false;
        break;
      }

      let hitTitle = false;
      for (const q of queryTokens) {
        const matchToken = (list: string[]) =>
          list.find((token) => (q.length >= 2 ? token.startsWith(q) : token === q));
        const titleHit = matchToken(titleTokens);
        const contentHit = titleHit ? undefined : matchToken(contentTokens);
        if (!titleHit && !contentHit) {
          matched = false;
          break;
        }
        if (titleHit) {
          hitTitle = true;
          score += SEARCH_OPTIONS.boost.title;
          matchedTerms.add(titleHit);
        } else if (contentHit) {
          score += SEARCH_OPTIONS.boost.content;
          matchedTerms.add(contentHit);
        }
      }
      if (!matched) break;
      if (hitTitle) titleMatches += 1;
    }

    if (matched) results.push({ id: document.id, score, titleMatches, matchedTerms });
  }

  return results.sort(
    (left, right) =>
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

function scheduleAfterPaintIdle(callback: () => void): () => void {
  let cancelled = false;
  let frameId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let idleId: number | null = null;

  const runOnIdle = () => {
    timerId = null;
    if (cancelled) return;
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(
        () => {
          idleId = null;
          if (!cancelled) callback();
        },
        { timeout: SEARCH_IDLE_TIMEOUT_MS }
      );
    } else {
      timerId = setTimeout(() => {
        timerId = null;
        if (!cancelled) callback();
      }, SEARCH_IDLE_FALLBACK_MS);
    }
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      if (cancelled) return;
      // Macrotask inside rAF runs after the browser commits and paints this frame.
      timerId = setTimeout(runOnIdle, 0);
    });
  } else {
    timerId = setTimeout(runOnIdle, 0);
  }

  return () => {
    cancelled = true;
    if (frameId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(frameId);
    }
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    if (idleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleId);
    }
  };
}

export function useNoteSearchResults(
  notes: Note[],
  query: string,
  options?: UseNoteSearchOptions
): NoteSearchResults {
  const enabled = options?.enabled ?? true;
  const sessionKey = options?.sessionKey;
  const preloadOnIdle = options?.preloadOnIdle ?? true;

  // This mounted library owns the index. Its plaintext never leaves process memory.
  const stateRef = useRef<SearchIndexState | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const failedChunkAttemptRef = useRef(false);
  const cancelIdleRef = useRef<(() => void) | null>(null);

  const prevScopeRef = useRef<{ enabled: boolean; sessionKey: unknown }>({
    enabled,
    sessionKey,
  });
  if (
    prevScopeRef.current.enabled !== enabled ||
    !Object.is(prevScopeRef.current.sessionKey, sessionKey)
  ) {
    prevScopeRef.current = { enabled, sessionKey };
    stateRef.current = null;
    generationRef.current += 1;
    failedChunkAttemptRef.current = false;
  }

  const parsedQuery = useMemo(() => parseSearchQuery(query), [query]);
  const hasTextQuery = parsedQuery.textTerms.length > 0;
  const hasIndexableNotes = useMemo(
    () => notes.some((note) => !note.decryptionFailed),
    [notes]
  );

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const latestNotesRef = useRef(notes);
  latestNotesRef.current = notes;
  const hasTextQueryRef = useRef(hasTextQuery);
  hasTextQueryRef.current = hasTextQuery;

  const [indexRevision, setIndexRevision] = useState(0);

  const triggerIndexLoad = useCallback((isUserRetry: boolean) => {
    if (!enabledRef.current || !mountedRef.current) return;
    if (stateRef.current?.index) return;
    if (!isUserRetry && failedChunkAttemptRef.current) return;
    if (isUserRetry) {
      failedChunkAttemptRef.current = false;
    }

    cancelIdleRef.current?.();
    cancelIdleRef.current = null;

    const buildGeneration = generationRef.current;
    const loadedCtor = getLoadedMiniSearch();
    if (loadedCtor) {
      stateRef.current = attachMiniSearchIndex(
        stateRef.current,
        loadedCtor,
        latestNotesRef.current
      );
      if (hasTextQueryRef.current) {
        setIndexRevision((rev) => rev + 1);
      }
      return;
    }

    void loadMiniSearch().then((MiniSearchCtor) => {
      if (
        !mountedRef.current ||
        !enabledRef.current ||
        generationRef.current !== buildGeneration
      ) {
        return;
      }
      if (!MiniSearchCtor) {
        failedChunkAttemptRef.current = true;
        return;
      }
      failedChunkAttemptRef.current = false;
      stateRef.current = attachMiniSearchIndex(
        stateRef.current,
        MiniSearchCtor,
        latestNotesRef.current
      );
      if (hasTextQueryRef.current) {
        setIndexRevision((rev) => rev + 1);
      }
    });
  }, []);

  // Drop plaintext and invalidate any in-flight build on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelIdleRef.current?.();
      cancelIdleRef.current = null;
      stateRef.current = null;
      generationRef.current += 1;
    };
  }, []);

  // Subscribe to search focus and shortcut intent only while the vault is enabled.
  useEffect(() => {
    if (!enabled) return;
    return subscribeSearchIntent(() => {
      triggerIndexLoad(true);
    });
  }, [enabled, sessionKey, triggerIndexLoad]);

  // If the reader starts typing a free-text query before MiniSearch is loaded,
  // kick off the chunk load immediately (without retrying automatically after a
  // failed load until the next search focus).
  useEffect(() => {
    if (!enabled || !hasTextQuery) return;
    triggerIndexLoad(false);
  }, [enabled, sessionKey, hasTextQuery, triggerIndexLoad]);

  // Schedule idle load + index build strictly after the library paints.
  useEffect(() => {
    if (!enabled || !preloadOnIdle || !hasIndexableNotes) return;
    if (stateRef.current?.index || failedChunkAttemptRef.current) return;

    const cancel = scheduleAfterPaintIdle(() => {
      cancelIdleRef.current = null;
      triggerIndexLoad(false);
    });
    cancelIdleRef.current = cancel;

    return () => {
      cancel();
      if (cancelIdleRef.current === cancel) {
        cancelIdleRef.current = null;
      }
    };
  }, [enabled, sessionKey, preloadOnIdle, hasIndexableNotes, triggerIndexLoad]);

  // Once the index (or a fallback document cache) exists, reconcile synchronously
  // on every notes change so edits, deletes, and locked notes never lag.
  const searchState = useMemo(() => {
    if (!enabled) return null;

    if (stateRef.current) {
      const loadedCtor = getLoadedMiniSearch();
      if (!stateRef.current.index && loadedCtor && hasTextQuery) {
        stateRef.current = attachMiniSearchIndex(stateRef.current, loadedCtor, notes);
      } else {
        reconcileSearchState(stateRef.current, notes);
      }
      return stateRef.current;
    }

    if (!hasTextQuery) return null;

    const loadedCtor = getLoadedMiniSearch();
    stateRef.current = loadedCtor
      ? attachMiniSearchIndex(null, loadedCtor, notes)
      : createSearchState(null);
    if (!loadedCtor) {
      reconcileSearchState(stateRef.current, notes);
    }
    return stateRef.current;
    // `indexRevision` and `sessionKey` intentionally re-read the updated ref state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionKey, notes, hasTextQuery, indexRevision]);

  return useMemo(() => {
    if (!enabled) {
      return { notes: [], matchedTermsByNoteId: EMPTY_MATCH_TERMS, isRankedSearch: false };
    }

    if (!query.trim()) {
      return { notes, matchedTermsByNoteId: EMPTY_MATCH_TERMS, isRankedSearch: false };
    }

    if (parsedQuery.textTerms.length === 0) {
      return {
        notes: notes.filter((note) => matchesFilters(note, parsedQuery.filters)),
        matchedTermsByNoteId: EMPTY_MATCH_TERMS,
        isRankedSearch: false,
      };
    }

    if (!searchState) {
      return { notes: [], matchedTermsByNoteId: EMPTY_MATCH_TERMS, isRankedSearch: true };
    }

    const notesById = new Map(notes.map((note) => [note.id, note]));
    const rawMatches = searchState.index
      ? rankedTextMatches(searchState.index, searchState.entries, parsedQuery.textTerms)
      : fallbackTextMatches(searchState.entries, parsedQuery.textTerms);
    const rankedMatches = rawMatches.filter(({ id }) => {
      const note = notesById.get(id);
      return note !== undefined && matchesFilters(note, parsedQuery.filters);
    });

    return {
      notes: rankedMatches
        .map(({ id }) => notesById.get(id))
        .filter((note): note is Note => note !== undefined),
      matchedTermsByNoteId: new Map(
        rankedMatches.map(({ id, matchedTerms }) => [id, [...matchedTerms]])
      ),
      isRankedSearch: true,
    };
  }, [enabled, notes, query, searchState, parsedQuery]);
}

/** Compatibility wrapper for callers that only need the ranked notes. */
export function useNoteSearch(
  notes: Note[],
  query: string,
  options?: UseNoteSearchOptions
): Note[] {
  return useNoteSearchResults(notes, query, options).notes;
}
