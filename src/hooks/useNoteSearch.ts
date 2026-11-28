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
  source: string;
}

interface SearchIndexState {
  documents: Map<string, SearchDocument>;
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
    documents: new Map(),
    index: MiniSearchCtor
      ? new MiniSearchCtor<SearchDocument>({
          fields: ['title', 'content'],
          idField: 'id',
        })
      : null,
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

function reconcileSearchState(state: SearchIndexState, notes: Note[]): void {
  const retainedIds = new Set<string>();

  for (const note of notes) {
    if (note.decryptionFailed) continue;

    retainedIds.add(note.id);
    const previous = state.documents.get(note.id);
    if (previous && matchesNote(previous, note)) continue;

    const next = searchDocument(note);
    if (state.index) {
      if (previous) state.index.remove(previous);
      state.index.add(next);
    }
    state.documents.set(note.id, next);
  }

  for (const [id, document] of state.documents) {
    if (retainedIds.has(id)) continue;
    state.index?.remove(document);
    state.documents.delete(id);
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
    for (const document of existing.documents.values()) {
      index.add(document);
    }
    return {
      documents: existing.documents,
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
  documents: Map<string, SearchDocument>,
  terms: SearchTextTerm[]
): RankedResult[] {
  let matches: Map<string, RankedResult> | null = null;

  for (const term of terms) {
    const termMatches = new Map<string, RankedResult>();
    for (const result of searchTerm(index, term)) {
      const id = String(result.id);
      const document = documents.get(id);
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

function tokenizeForFallback(text: string): string[] {
  return text.toLowerCase().split(FALLBACK_TOKEN_SPLIT).filter(Boolean);
}

function matchFallbackToken(tokens: string[], queryToken: string): string | null {
  const allowPrefix = queryToken.length >= 2;
  for (const token of tokens) {
    if (allowPrefix ? token.startsWith(queryToken) : token === queryToken) {
      return token;
    }
  }
  return null;
}

/**
 * Synchronous plain-text fallback used while the MiniSearch chunk is still
 * loading (or if its import failed). Matches exact 1-char tokens, >=2-char
 * prefixes, and exact quoted phrases, with title matches ranked first. Once
 * MiniSearch loads, the active query upgrades automatically to BM25 + fuzzy.
 */
function fallbackTextMatches(
  documents: Map<string, SearchDocument>,
  terms: SearchTextTerm[]
): RankedResult[] {
  const results: RankedResult[] = [];

  for (const document of documents.values()) {
    let titleTokens: string[] | null = null;
    let contentTokens: string[] | null = null;
    let score = 0;
    let titleMatches = 0;
    const matchedTerms = new Set<string>();
    let allMatched = true;

    for (const term of terms) {
      if (term.quoted) {
        const inTitle = phraseMatchesTitle(document, term);
        const inContent = document.content.toLowerCase().includes(term.normalized);
        if (!inTitle && !inContent) {
          allMatched = false;
          break;
        }
        if (inTitle) {
          titleMatches += 1;
          score += SEARCH_OPTIONS.boost.title;
        } else {
          score += SEARCH_OPTIONS.boost.content;
        }
        matchedTerms.add(term.normalized);
        continue;
      }

      if (titleTokens === null) titleTokens = tokenizeForFallback(document.title);
      if (contentTokens === null) contentTokens = tokenizeForFallback(document.content);

      const queryTokens = tokenizeForFallback(term.normalized);
      if (queryTokens.length === 0) {
        allMatched = false;
        break;
      }

      let termMatchedTitle = false;
      for (const queryToken of queryTokens) {
        const titleHit = matchFallbackToken(titleTokens, queryToken);
        const contentHit = titleHit ? null : matchFallbackToken(contentTokens, queryToken);
        if (!titleHit && !contentHit) {
          allMatched = false;
          break;
        }
        if (titleHit) {
          termMatchedTitle = true;
          score += SEARCH_OPTIONS.boost.title;
          matchedTerms.add(titleHit);
        } else if (contentHit) {
          score += SEARCH_OPTIONS.boost.content;
          matchedTerms.add(contentHit);
        }
      }
      if (!allMatched) break;
      if (termMatchedTitle) titleMatches += 1;
    }

    if (allMatched) {
      results.push({ id: document.id, score, titleMatches, matchedTerms });
    }
  }

  return results.sort((left, right) =>
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
      ? rankedTextMatches(searchState.index, searchState.documents, parsedQuery.textTerms)
      : fallbackTextMatches(searchState.documents, parsedQuery.textTerms);
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
