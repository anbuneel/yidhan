import { act, renderHook, waitFor } from '@testing-library/react';
import MiniSearch from 'minisearch';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sanitize from '../utils/sanitize';
import {
  loadMiniSearch,
  resetMiniSearchRuntimeForTests,
  setMiniSearchImporterForTests,
  signalSearchIntent,
} from '../utils/miniSearchRuntime';
import { createMockNote } from '../test/factories';
import { useNoteSearch, useNoteSearchResults } from './useNoteSearch';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('lazy loading, lock lifecycle, and chunk failure recovery (A4)', () => {
  beforeEach(() => {
    resetMiniSearchRuntimeForTests();
  });

  afterEach(() => {
    resetMiniSearchRuntimeForTests();
  });

  it('does not load MiniSearch or parse notes during initial render with an empty query', () => {
    const importer = vi.fn(() => Promise.resolve({ default: MiniSearch }));
    setMiniSearchImporterForTests(importer);
    const text = vi.spyOn(sanitize, 'htmlToPlainText');
    const notes = [
      createMockNote({ id: '1', title: 'Morning', content: '<p>Coffee on the porch</p>' }),
      createMockNote({ id: '2', title: 'Evening', content: '<p>Quiet walk home</p>' }),
    ];

    const { result } = renderHook(() => useNoteSearch(notes, ''));

    expect(result.current).toBe(notes);
    expect(importer).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it('does not request MiniSearch on idle when preloadOnIdle is false (e.g. /demo before search)', async () => {
    vi.useFakeTimers();
    const importer = vi.fn(() => Promise.resolve({ default: MiniSearch }));
    setMiniSearchImporterForTests(importer);
    const text = vi.spyOn(sanitize, 'htmlToPlainText');
    const notes = [
      createMockNote({ id: '1', title: 'Practice', content: '<p>Draft note</p>' }),
    ];

    renderHook(() => useNoteSearch(notes, '', { preloadOnIdle: false }));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(importer).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it('builds no index for a locked vault, ignores search intent and queries, and drops the index on lock', async () => {
    vi.useFakeTimers();
    const importer = vi.fn(() => Promise.resolve({ default: MiniSearch }));
    setMiniSearchImporterForTests(importer);
    const text = vi.spyOn(sanitize, 'htmlToPlainText');
    const secret = createMockNote({ id: 'secret', title: 'Private', content: '<p>Vault plaintext</p>' });

    const { result, rerender } = renderHook(
      ({ enabled, sessionKey, query }) =>
        useNoteSearch([secret], query, { enabled, sessionKey }),
      { initialProps: { enabled: false, sessionKey: null as string | null, query: 'vault' } }
    );

    expect(result.current).toEqual([]);
    act(() => {
      signalSearchIntent();
      vi.advanceTimersByTime(5000);
    });
    expect(importer).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();

    // Unlock and build the index via search intent.
    rerender({ enabled: true, sessionKey: 'session-1', query: '' });
    await act(async () => {
      signalSearchIntent();
      await Promise.resolve();
    });
    expect(importer).toHaveBeenCalledTimes(1);
    expect(text).toHaveBeenCalledTimes(1);

    rerender({ enabled: true, sessionKey: 'session-1', query: 'vault' });
    expect(result.current).toEqual([secret]);

    // Lock the vault: index drops immediately and search returns nothing.
    rerender({ enabled: false, sessionKey: null, query: 'vault' });
    expect(result.current).toEqual([]);

    // Re-unlock with a new session: old index did not survive, so a fresh build runs on intent.
    rerender({ enabled: true, sessionKey: 'session-2', query: '' });
    expect(text).toHaveBeenCalledTimes(1);
    await act(async () => {
      signalSearchIntent();
      await Promise.resolve();
    });
    expect(text).toHaveBeenCalledTimes(2);
  });

  it('does not repopulate the index when a build is in flight as the vault locks', async () => {
    const pending = deferred<{ default: typeof MiniSearch }>();
    const importer = vi.fn(() => pending.promise);
    setMiniSearchImporterForTests(importer);
    const text = vi.spyOn(sanitize, 'htmlToPlainText');
    const secret = createMockNote({ id: 'secret', title: 'Private', content: '<p>In-flight secret</p>' });

    const { rerender } = renderHook(
      ({ enabled, sessionKey }) =>
        useNoteSearch([secret], '', { enabled, sessionKey, preloadOnIdle: false }),
      { initialProps: { enabled: true, sessionKey: 'session-1' as string | null } }
    );

    // Focus starts loading MiniSearch while unlocked.
    act(() => {
      signalSearchIntent();
    });
    expect(importer).toHaveBeenCalledTimes(1);
    expect(text).not.toHaveBeenCalled();

    // Vault locks before the chunk resolves.
    rerender({ enabled: false, sessionKey: null });

    await act(async () => {
      pending.resolve({ default: MiniSearch });
      await Promise.resolve();
    });

    // The resolved chunk must NOT build an index or parse plaintext while locked.
    expect(text).not.toHaveBeenCalled();
  });

  it('finds matches for a query typed before the index is ready, then upgrades without reparsing', async () => {
    const pending = deferred<{ default: typeof MiniSearch }>();
    const importer = vi.fn(() => pending.promise);
    setMiniSearchImporterForTests(importer);
    const text = vi.spyOn(sanitize, 'htmlToPlainText');

    const notes = [
      createMockNote({ id: 'content', title: 'Field notes', content: '<p>Autumn harvest notes</p>' }),
      createMockNote({ id: 'title', title: 'Autumn harvest', content: '<p>Quiet afternoon</p>' }),
      createMockNote({ id: 'other', title: 'Winter', content: '<p>Snowfall</p>' }),
    ];

    const { result, rerender } = renderHook(
      ({ query }) => useNoteSearchResults(notes, query, { preloadOnIdle: false }),
      { initialProps: { query: 'harvest' } }
    );

    // Before MiniSearch resolves, the fallback scan finds matches immediately and ranks title first.
    expect(result.current.notes.map((n) => n.id)).toEqual(['title', 'content']);
    expect(result.current.matchedTermsByNoteId.get('title')).toEqual(['harvest']);
    expect(result.current.isRankedSearch).toBe(true);
    expect(text).toHaveBeenCalledTimes(3);

    // Typing a typo query before MiniSearch resolves waits for the chunk, then resolves cleanly.
    rerender({ query: 'harvst' });
    expect(text).toHaveBeenCalledTimes(3);

    await act(async () => {
      pending.resolve({ default: MiniSearch });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.notes.map((n) => n.id)).toEqual(['title', 'content']);
    });
    expect(result.current.matchedTermsByNoteId.get('title')).toEqual(['harvest']);
    // Documents extracted during fallback scan were reused when attaching MiniSearch.
    expect(text).toHaveBeenCalledTimes(3);
  });

  it('leaves the library usable when chunk loading fails and retries on next search focus', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let attempts = 0;
    const importer = vi.fn(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
        : Promise.resolve({ default: MiniSearch });
    });
    setMiniSearchImporterForTests(importer);

    const note = createMockNote({ id: '1', title: 'Autumn harvest', content: '<p>Warm cider</p>' });
    const { result, rerender } = renderHook(
      ({ query }) => useNoteSearchResults([note], query, { preloadOnIdle: false }),
      { initialProps: { query: 'harvest' } }
    );

    // First attempt fails gracefully; fallback search keeps working and warns once.
    await waitFor(() => expect(warnSpy).toHaveBeenCalledTimes(1));
    expect(importer).toHaveBeenCalledTimes(1);
    expect(result.current.notes).toEqual([note]);

    // Typing further queries does not spam retries in a loop.
    rerender({ query: 'harvst' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(importer).toHaveBeenCalledTimes(1);
    expect(result.current.notes).toEqual([]);

    // Focusing search retries the chunk load, succeeds, and upgrades to fuzzy MiniSearch.
    await act(async () => {
      signalSearchIntent();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.notes).toEqual([note]));
    expect(importer).toHaveBeenCalledTimes(2);
    expect(result.current.matchedTermsByNoteId.get('1')).toEqual(['harvest']);
  });

  it('loads MiniSearch after library paint on idle when preloadOnIdle is true', async () => {
    vi.useFakeTimers();
    const importer = vi.fn(() => Promise.resolve({ default: MiniSearch }));
    setMiniSearchImporterForTests(importer);
    const text = vi.spyOn(sanitize, 'htmlToPlainText');
    const notes = [
      createMockNote({ id: '1', title: 'Idle note', content: '<p>Indexed after paint</p>' }),
    ];

    renderHook(() => useNoteSearch(notes, ''));

    expect(importer).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(importer).toHaveBeenCalledTimes(1);
    expect(text).toHaveBeenCalledTimes(1);
  });

  it('drops the index when sessionKey changes (user switch)', async () => {
    const importer = vi.fn(() => Promise.resolve({ default: MiniSearch }));
    setMiniSearchImporterForTests(importer);
    const text = vi.spyOn(sanitize, 'htmlToPlainText');
    const userANote = createMockNote({ id: 'a', title: 'Alice note', content: '<p>Alice body</p>' });
    const userBNote = createMockNote({ id: 'b', title: 'Bob note', content: '<p>Bob body</p>' });

    const { result, rerender } = renderHook(
      ({ items, query, sessionKey }) =>
        useNoteSearch(items, query, { sessionKey, preloadOnIdle: false }),
      { initialProps: { items: [userANote], query: 'alice', sessionKey: 'user-a' } }
    );

    await waitFor(() => expect(importer).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual([userANote]);
    expect(text).toHaveBeenCalledTimes(1);

    // Switch to User B: User A's index is dropped and Alice does not match.
    rerender({ items: [userBNote], query: 'alice', sessionKey: 'user-b' });
    expect(result.current).toEqual([]);
    rerender({ items: [userBNote], query: 'bob', sessionKey: 'user-b' });
    expect(result.current).toEqual([userBNote]);
  });
});

describe('indexed search reconciliation and query semantics', () => {
  beforeAll(async () => {
    resetMiniSearchRuntimeForTests();
    await loadMiniSearch();
  });

  function search(notes: ReturnType<typeof createMockNote>[], query: string) {
    return renderHook(() => useNoteSearch(notes, query, { preloadOnIdle: false })).result.current;
  }

  it('parses 2,000 notes once, then searches without any parser work; changed hashes refresh only that note', () => {
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    const text = vi.spyOn(sanitize, 'htmlToPlainText');
    const notes = Array.from({ length: 2000 }, (_, i) => createMockNote({ id: String(i), title: 'Thought', content: '<p>Flour and sugar</p>', contentHash: String(i) }));
    const { result, rerender } = renderHook(({ items, query }) => useNoteSearch(items, query, { preloadOnIdle: false }), { initialProps: { items: notes, query: 'flour' } });
    expect(result.current).toHaveLength(2000);
    expect(text).toHaveBeenCalledTimes(2000);
    const calls = parse.mock.calls.length;
    for (const query of ['s', 'su', 'sug', 'sugar']) rerender({ items: notes, query });
    expect(parse).toHaveBeenCalledTimes(calls);
    expect(text).toHaveBeenCalledTimes(2000);
    rerender({ items: notes.map((n, i) => i ? n : { ...n, contentHash: 'new', content: '<p>Salt</p>' }), query: 'salt' });
    expect(result.current.map(n => n.id)).toEqual(['0']);
    expect(text).toHaveBeenCalledTimes(2001);
    rerender({ items: notes, query: 'thought' });
    expect(result.current).toHaveLength(2000);
    rerender({ items: notes, query: ' ' });
    expect(result.current).toBe(notes);
    // 60s, not 20s. Every assertion here is a call count, never an elapsed time, so a
    // longer budget weakens nothing — but parsing 2,000 notes is heavy enough that the
    // 20s budget expired under full-suite parallel load, failing a test that was not
    // measuring speed in the first place.
  }, 60000);

  it('reflects an edit, a delete, and a title-only rename at once after the index exists, even with a stale content hash', () => {
    const note = createMockNote({ id: '1', title: 'Groceries', content: '<p>milk, eggs</p>', contentHash: 'stale' });
    const { result, rerender } = renderHook(({ items, query }) => useNoteSearch(items, query, { preloadOnIdle: false }), { initialProps: { items: [note], query: 'bread' } });
    expect(result.current).toHaveLength(0);
    // An optimistic update can spread the pre-edit note, carrying its old hash.
    const edited = { ...note, content: '<p>milk, eggs, bread</p>' };
    rerender({ items: [edited], query: 'bread' });
    expect(result.current.map(n => n.id)).toEqual(['1']);
    rerender({ items: [edited], query: 'eggs' });
    expect(result.current.map(n => n.id)).toEqual(['1']);

    // Title-only rename (content and hash untouched) reindexes immediately.
    const renamed = { ...edited, title: 'Bakery list' };
    rerender({ items: [renamed], query: 'bakery' });
    expect(result.current.map(n => n.id)).toEqual(['1']);
    rerender({ items: [renamed], query: 'groceries' });
    expect(result.current).toEqual([]);

    rerender({ items: [], query: 'bread' });
    expect(result.current).toEqual([]);
    // Reusing the ID proves the old posting was removed, not merely hidden because
    // its note happened to be absent from this render.
    rerender({ items: [{ ...note, content: '<p>milk only</p>' }], query: 'bread' });
    expect(result.current).toEqual([]);
  });

  it('indexes a note created while the query is already active', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useNoteSearch(items, 'newborn', { preloadOnIdle: false }),
      { initialProps: { items: [] as ReturnType<typeof createMockNote>[] } }
    );
    expect(result.current).toEqual([]);

    const created = createMockNote({ id: 'created', content: '<p>A newborn thought.</p>' });
    rerender({ items: [created] });
    expect(result.current).toEqual([created]);
  });

  it('keeps the plaintext index inside memory and performs no persistence or network writes', () => {
    const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const indexedDbOpen = vi.fn();
    const fetchRequest = vi.fn();
    vi.stubGlobal('indexedDB', { open: indexedDbOpen });
    vi.stubGlobal('fetch', fetchRequest);

    const note = createMockNote({ id: 'private', title: 'Private', content: '<p>Plaintext thought</p>' });
    const { rerender } = renderHook(
      ({ items, query }) => useNoteSearch(items, query, { preloadOnIdle: false }),
      { initialProps: { items: [note], query: 'plaintext' } }
    );
    rerender({ items: [{ ...note, content: '<p>Changed plaintext thought</p>' }], query: 'changed' });

    expect(localStorageWrite).not.toHaveBeenCalled();
    expect(indexedDbOpen).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  describe('query semantics', () => {
    it('ranks a title match above the same match in content', () => {
      const notes = [
        createMockNote({ id: 'content', title: 'Field notes', content: '<p>Quiet harvest</p>' }),
        createMockNote({ id: 'title', title: 'Quiet harvest', content: '<p>Field notes</p>' }),
      ];

      expect(search(notes, 'harvest').map(({ id }) => id)).toEqual(['title', 'content']);
    });

    it('finds a longer term with one missing character', () => {
      const note = createMockNote({ id: 'fuzzy', title: 'Autumn harvest' });

      expect(search([note], 'harvst')).toEqual([note]);
    });

    it('reports the indexed token that satisfied a fuzzy match', () => {
      const note = createMockNote({ id: 'fuzzy', title: 'Autumn harvest' });
      const { result } = renderHook(() => useNoteSearchResults([note], 'harvst', { preloadOnIdle: false }));

      expect(result.current.notes).toEqual([note]);
      expect(result.current.matchedTermsByNoteId.get('fuzzy')).toEqual(['harvest']);
    });

    it('does not use prefix or fuzzy matching for a one-character query', () => {
      const notes = [
        createMockNote({ id: 'alpha', title: 'Alpha' }),
        createMockNote({ id: 'apricot', content: '<p>Apricot</p>' }),
        createMockNote({ id: 'beta', content: '<p>Beta</p>' }),
      ];

      expect(search(notes, 'a')).toEqual([]);
    });

    it('requires every free-text term, across title and content', () => {
      const notes = [
        createMockNote({ id: 'both', title: 'Quiet harvest', content: '<p>golden field</p>' }),
        createMockNote({ id: 'one', title: 'Quiet room', content: '<p>stillness</p>' }),
      ];

      expect(search(notes, 'quiet field').map(({ id }) => id)).toEqual(['both']);
    });

    it('matches a quoted phrase as one exact, case-insensitive term', () => {
      const notes = [
        createMockNote({ id: 'phrase', content: '<p>An Exact Phrase remains.</p>' }),
        createMockNote({ id: 'apart', content: '<p>Exact words do not form the phrase.</p>' }),
      ];

      expect(search(notes, '"exact phrase"').map(({ id }) => id)).toEqual(['phrase']);
    });

    it('applies tag: to tag fields case-insensitively, not literal note content', () => {
      const journal = { id: 'journal', name: 'Journal', color: 'terracotta' as const, createdAt: new Date() };
      const notes = [
        createMockNote({ id: 'tagged', tags: [journal] }),
        createMockNote({ id: 'literal', content: '<p>This says tag:journal.</p>' }),
      ];

      expect(search(notes, 'tag:journal').map(({ id }) => id)).toEqual(['tagged']);
      expect(search(notes, 'tag:Journal').map(({ id }) => id)).toEqual(['tagged']);
    });

    it('applies is:pinned to the pinned field', () => {
      const notes = [
        createMockNote({ id: 'pinned', pinned: true }),
        createMockNote({ id: 'ordinary', pinned: false, content: '<p>is:pinned</p>' }),
      ];

      expect(search(notes, 'is:pinned').map(({ id }) => id)).toEqual(['pinned']);
    });

    it('makes before: inclusive of the named updated calendar day', () => {
      const notes = [
        createMockNote({ id: 'before', updatedAt: new Date(2026, 2, 14, 12) }),
        createMockNote({ id: 'boundary', updatedAt: new Date(2026, 2, 15, 23, 59) }),
        createMockNote({ id: 'after', updatedAt: new Date(2026, 2, 16, 0, 1) }),
      ];

      expect(search(notes, 'before:2026-03-15').map(({ id }) => id))
        .toEqual(['before', 'boundary']);
    });

    it('makes after: inclusive of the named updated calendar day', () => {
      const notes = [
        createMockNote({ id: 'before', updatedAt: new Date(2026, 2, 14, 23, 59) }),
        createMockNote({ id: 'boundary', updatedAt: new Date(2026, 2, 15, 0, 1) }),
        createMockNote({ id: 'after', updatedAt: new Date(2026, 2, 16, 12) }),
      ];

      expect(search(notes, 'after:2026-03-15').map(({ id }) => id))
        .toEqual(['boundary', 'after']);
    });

    it('ignores malformed supported operators without hiding notes', () => {
      const notes = [
        createMockNote({ id: 'empty-tag', content: '<p>Keep the literal tag: token.</p>' }),
        createMockNote({ id: 'bad-date', content: '<p>Reminder: before:notadate</p>' }),
      ];

      expect(search(notes, 'tag:')).toEqual(notes);
      expect(search(notes, 'before:notadate')).toEqual(notes);
    });

    it('treats an operator inside a quoted phrase as literal text', () => {
      const journal = { id: 'journal', name: 'Journal', color: 'terracotta' as const, createdAt: new Date() };
      const notes = [
        createMockNote({ id: 'literal', content: '<p>Written as tag:journal.</p>' }),
        createMockNote({ id: 'tagged-only', tags: [journal] }),
      ];

      expect(search(notes, '"tag:journal"').map(({ id }) => id)).toEqual(['literal']);
    });

    it('never indexes locked notes and removes an entry when decryption later fails', () => {
      const text = vi.spyOn(sanitize, 'htmlToPlainText');
      const locked = createMockNote({
        id: 'locked',
        title: '',
        content: '',
        decryptionFailed: true,
        pinned: true,
      });

      const { result, rerender } = renderHook(
        ({ items, query }) => useNoteSearch(items, query, { preloadOnIdle: false }),
        { initialProps: { items: [locked], query: '' } }
      );
      expect(result.current).toEqual([locked]);
      expect(text).not.toHaveBeenCalled();

      rerender({ items: [locked], query: 'anything' });
      expect(result.current).toEqual([]);
      rerender({ items: [locked], query: 'is:pinned' });
      expect(result.current).toEqual([locked]);

      const unlocked = { ...locked, title: 'Recovered thought', decryptionFailed: false };
      rerender({ items: [unlocked], query: 'recovered' });
      expect(result.current).toEqual([unlocked]);
      expect(text).toHaveBeenCalledTimes(1);

      rerender({ items: [locked], query: 'recovered' });
      expect(result.current).toEqual([]);
    });

    it('combines tag, month boundary, and phrase filters with AND semantics', () => {
      const journal = { id: 'journal', name: 'Journal', color: 'terracotta' as const, createdAt: new Date() };
      const notes = [
        createMockNote({
          id: 'match',
          tags: [journal],
          updatedAt: new Date(2026, 2, 31, 23, 59),
          content: '<p>The exact phrase is here.</p>',
        }),
        createMockNote({
          id: 'too-late',
          tags: [journal],
          updatedAt: new Date(2026, 3, 1),
          content: '<p>The exact phrase is here.</p>',
        }),
        createMockNote({
          id: 'wrong-tag',
          updatedAt: new Date(2026, 2, 20),
          content: '<p>The exact phrase is here.</p>',
        }),
      ];

      expect(search(notes, 'tag:journal before:2026-03 "exact phrase"').map(({ id }) => id))
        .toEqual(['match']);
    });
  });
});
