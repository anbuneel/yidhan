import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Note } from '../types';
import { groupNotesByChapter, type ChapterArrangement } from '../utils/temporalGrouping';

function isLibraryCardTarget(target: EventTarget | null, noteId: string | null): boolean {
  return target instanceof HTMLElement && target.dataset.libraryCardId === noteId;
}

function isLibraryBackgroundTarget(target: EventTarget | null): boolean {
  return target === document.body || target === document.documentElement;
}

interface UseLibraryCardNavigationOptions {
  notes: Note[];
  /**
   * The library's arrangement. It has to be the same one the cards are rendered with,
   * or the keyboard walks the notes in an order the reader cannot see.
   */
  arrangement?: ChapterArrangement;
  /** Preserve the relevance order supplied by the free-text search index. */
  isRankedSearch?: boolean;
  onOpen: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}

/** Keeps keyboard selection in the same chapter order readers see on screen. */
export function useLibraryCardNavigation({
  notes,
  arrangement,
  isRankedSearch = false,
  onOpen,
  onTogglePin,
  onDelete,
}: UseLibraryCardNavigationOptions) {
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);

  const navigableNotes = useMemo(
    () => (isRankedSearch
      ? notes
      : groupNotesByChapter(notes, arrangement).flatMap((chapter) => chapter.notes))
      .filter((note) => !note.decryptionFailed),
    [notes, arrangement, isRankedSearch]
  );

  useEffect(() => {
    setFocusedNoteId((current) =>
      current && !navigableNotes.some((note) => note.id === current) ? null : current
    );
  }, [navigableNotes]);

  const handleLibraryCardKeyDown = useCallback((event: KeyboardEvent): boolean => {
    if (event.metaKey || event.ctrlKey || event.altKey) return false;

    const key = event.key.toLowerCase();
    const isPrevious = key === 'arrowup' || key === 'arrowleft' || key === 'k';
    const isNext = key === 'arrowdown' || key === 'arrowright' || key === 'j';
    const isFocusedCardTarget = isLibraryCardTarget(event.target, focusedNoteId);

    if (isPrevious || isNext) {
      if (navigableNotes.length === 0) return false;
      if (focusedNoteId && !isFocusedCardTarget) return false;
      if (!focusedNoteId && !isLibraryBackgroundTarget(event.target)) return false;

      const currentIndex = navigableNotes.findIndex((note) => note.id === focusedNoteId);
      const nextIndex = currentIndex === -1
        ? (isPrevious ? navigableNotes.length - 1 : 0)
        : Math.max(
          0,
          Math.min(navigableNotes.length - 1, currentIndex + (isPrevious ? -1 : 1))
        );

      setFocusedNoteId(navigableNotes[nextIndex].id);
      return true;
    }

    const focusedNote = navigableNotes.find((note) => note.id === focusedNoteId);
    if (!focusedNote || !isFocusedCardTarget) return false;

    if (key === 'enter') {
      if (event.repeat) return true;
      onOpen(focusedNote.id);
      return true;
    }

    if (key === 'p') {
      if (event.repeat) return true;
      onTogglePin(focusedNote.id, !focusedNote.pinned);
      return true;
    }

    if (key === 'delete') {
      if (event.repeat) return true;
      onDelete(focusedNote.id);
      return true;
    }

    return false;
  }, [focusedNoteId, navigableNotes, onDelete, onOpen, onTogglePin]);

  return { focusedNoteId, handleLibraryCardKeyDown };
}
