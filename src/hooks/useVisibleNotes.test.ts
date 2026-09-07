import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibleNotes } from './useVisibleNotes';
import type { Note, Tag } from '../types';

const journal: Tag = {
  id: 'tag-journal',
  name: 'Journal',
  color: 'terracotta',
  createdAt: new Date('2026-01-01'),
};
const ideas: Tag = {
  id: 'tag-ideas',
  name: 'Ideas',
  color: 'gold',
  createdAt: new Date('2026-01-01'),
};

function note(overrides: Partial<Note> & { id: string }): Note {
  return {
    title: overrides.id,
    content: '',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    tags: [],
    pinned: false,
    ...overrides,
  };
}

const OLD_PINNED = note({
  id: 'old-pinned',
  pinned: true,
  updatedAt: new Date('2026-01-01'),
  tags: [journal],
});
const RECENT = note({ id: 'recent', updatedAt: new Date('2026-06-01'), tags: [journal, ideas] });
const MIDDLE = note({ id: 'middle', updatedAt: new Date('2026-03-01'), tags: [ideas] });

const ALL = [MIDDLE, RECENT, OLD_PINNED];

function ids(notes: Note[]): string[] {
  return notes.map((n) => n.id);
}

describe('useVisibleNotes', () => {
  it('puts pinned notes first, even when they are the oldest', () => {
    const { result } = renderHook(() => useVisibleNotes(ALL, [], ''));
    expect(ids(result.current)).toEqual(['old-pinned', 'recent', 'middle']);
  });

  it('orders unpinned notes by most recently edited', () => {
    const { result } = renderHook(() => useVisibleNotes([MIDDLE, RECENT], [], ''));
    expect(ids(result.current)).toEqual(['recent', 'middle']);
  });

  it('does not mutate the array it was given', () => {
    const input = [...ALL];
    renderHook(() => useVisibleNotes(input, [], ''));
    expect(ids(input)).toEqual(['middle', 'recent', 'old-pinned']);
  });

  it('requires every selected tag, not any of them', () => {
    const { result } = renderHook(() =>
      useVisibleNotes(ALL, ['tag-journal', 'tag-ideas'], '')
    );
    expect(ids(result.current)).toEqual(['recent']);
  });

  it('filters by a single tag', () => {
    const { result } = renderHook(() => useVisibleNotes(ALL, ['tag-ideas'], ''));
    expect(ids(result.current)).toEqual(['recent', 'middle']);
  });

  it('keeps the pinned-first order inside a tag filter', () => {
    const { result } = renderHook(() => useVisibleNotes(ALL, ['tag-journal'], ''));
    expect(ids(result.current)).toEqual(['old-pinned', 'recent']);
  });

  it('searches within the tag filter rather than across everything', () => {
    const withTitles = [
      note({ id: 'a', title: 'harvest', tags: [ideas], updatedAt: new Date('2026-05-01') }),
      note({ id: 'b', title: 'harvest', tags: [journal], updatedAt: new Date('2026-04-01') }),
    ];

    const { result } = renderHook(() => useVisibleNotes(withTitles, ['tag-ideas'], 'harvest'));
    expect(ids(result.current)).toEqual(['a']);
  });

  it('shows everything when there is no filter and no query', () => {
    const { result } = renderHook(() => useVisibleNotes(ALL, [], ''));
    expect(result.current).toHaveLength(3);
  });

  it('recomputes when the tag filter changes', () => {
    const { result, rerender } = renderHook(
      ({ tagIds }: { tagIds: string[] }) => useVisibleNotes(ALL, tagIds, ''),
      { initialProps: { tagIds: [] as string[] } }
    );
    expect(result.current).toHaveLength(3);

    rerender({ tagIds: ['tag-ideas'] });
    expect(ids(result.current)).toEqual(['recent', 'middle']);
  });
});
