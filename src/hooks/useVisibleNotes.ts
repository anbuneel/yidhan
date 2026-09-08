/**
 * What the library actually shows: pinned first, then tag-filtered, then searched.
 *
 * The order matters. Sorting before filtering keeps the chapter grouping stable, and
 * searching last means the tag filter is the baseline a query narrows rather than
 * something the query has to reproduce.
 *
 * This is the baseline order only. What the reader sees inside a chapter is decided by
 * `groupNotesByChapter`, which sorts by their chosen key — so that both the cards and
 * the keyboard read one ordering rather than two that can drift apart.
 */

import { useMemo } from 'react';
import type { Note } from '../types';
import { useNoteSearch } from './useNoteSearch';

export function useVisibleNotes(
  notes: Note[],
  selectedTagIds: string[],
  searchQuery: string
): Note[] {
  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      }),
    [notes]
  );

  const tagFilteredNotes = useMemo(() => {
    if (selectedTagIds.length === 0) return sortedNotes;

    return sortedNotes.filter((note) => {
      const noteTagIds = note.tags.map((t) => t.id);
      return selectedTagIds.every((tagId) => noteTagIds.includes(tagId));
    });
  }, [sortedNotes, selectedTagIds]);

  return useNoteSearch(tagFilteredNotes, searchQuery);
}
