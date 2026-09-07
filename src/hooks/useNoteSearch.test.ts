import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as sanitize from '../utils/sanitize';
import { createMockNote } from '../test/factories';
import { useNoteSearch } from './useNoteSearch';
afterEach(() => vi.restoreAllMocks());
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
}, 20000);

it('finds edited text even when the caller left the content hash behind', () => {
  const note = createMockNote({ id: '1', title: 'Groceries', content: '<p>milk, eggs</p>', contentHash: 'stale' });
  const { result, rerender } = renderHook(({ items, query }) => useNoteSearch(items, query), { initialProps: { items: [note], query: 'bread' } });
  expect(result.current).toHaveLength(0);
  // An optimistic update can spread the pre-edit note, carrying its old hash.
  rerender({ items: [{ ...note, content: '<p>milk, eggs, bread</p>' }], query: 'bread' });
  expect(result.current.map(n => n.id)).toEqual(['1']);
  rerender({ items: [{ ...note, content: '<p>milk, eggs, bread</p>' }], query: 'eggs' });
  expect(result.current.map(n => n.id)).toEqual(['1']);
});
