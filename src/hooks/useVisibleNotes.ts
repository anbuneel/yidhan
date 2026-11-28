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
import { useOptionalAuth } from '../contexts/authState';
import { useOptionalEncryption } from '../contexts/EncryptionContext';
import { useNoteSearchResults } from './useNoteSearch';

export function useVisibleNoteSearch(
  notes: Note[],
  selectedTagIds: string[],
  searchQuery: string
) {
  const auth = useOptionalAuth();
  const encryption = useOptionalEncryption();
  const hasVaultProviders = auth !== null || encryption !== null;
  const vaultEnabled = hasVaultProviders
    ? Boolean(auth?.user && encryption?.isUnlocked && encryption?.keys)
    : true;
  const userId = auth?.user?.id ?? null;
  const keys = encryption?.keys ?? null;
  const sessionKey = useMemo(
    () => (vaultEnabled && hasVaultProviders ? { userId, keys } : null),
    [vaultEnabled, hasVaultProviders, userId, keys]
  );

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

  return useNoteSearchResults(tagFilteredNotes, searchQuery, {
    enabled: vaultEnabled,
    sessionKey,
  });
}

export function useVisibleNotes(
  notes: Note[],
  selectedTagIds: string[],
  searchQuery: string
): Note[] {
  return useVisibleNoteSearch(notes, selectedTagIds, searchQuery).notes;
}
