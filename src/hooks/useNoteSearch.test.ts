import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as sanitize from '../utils/sanitize';
import { createMockNote } from '../test/factories';
import { useNoteSearch } from './useNoteSearch';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function search(notes: ReturnType<typeof createMockNote>[], query: string) {
  return renderHook(() => useNoteSearch(notes, query)).result.current;
}

it('parses 2,000 notes once, then searches without any parser work; changed hashes refresh only that note', () => {
  const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
  const text = vi.spyOn(sanitize, 'htmlToPlainText');
  const notes = Array.from({ length: 2000 }, (_, i) => createMockNote({ id: String(i), title: 'Thought', content: '<p>Flour and sugar</p>', contentHash: String(i) }));
  const { result, rerender } = renderHook(({ items, query }) => useNoteSearch(items, query), { initialProps: { items: notes, query: 'flour' } });
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

it('updates an edited entry and fully removes a deleted one, even with a stale content hash', () => {
  const note = createMockNote({ id: '1', title: 'Groceries', content: '<p>milk, eggs</p>', contentHash: 'stale' });
  const { result, rerender } = renderHook(({ items, query }) => useNoteSearch(items, query), { initialProps: { items: [note], query: 'bread' } });
  expect(result.current).toHaveLength(0);
  // An optimistic update can spread the pre-edit note, carrying its old hash.
  rerender({ items: [{ ...note, content: '<p>milk, eggs, bread</p>' }], query: 'bread' });
  expect(result.current.map(n => n.id)).toEqual(['1']);
  rerender({ items: [{ ...note, content: '<p>milk, eggs, bread</p>' }], query: 'eggs' });
  expect(result.current.map(n => n.id)).toEqual(['1']);

  rerender({ items: [], query: 'bread' });
  expect(result.current).toEqual([]);
  // Reusing the ID proves the old posting was removed, not merely hidden because
  // its note happened to be absent from this render.
  rerender({ items: [{ ...note, content: '<p>milk only</p>' }], query: 'bread' });
  expect(result.current).toEqual([]);
});

it('indexes a note created while the query is already active', () => {
  const { result, rerender } = renderHook(
    ({ items }) => useNoteSearch(items, 'newborn'),
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
    ({ items, query }) => useNoteSearch(items, query),
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
      ({ items, query }) => useNoteSearch(items, query),
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
