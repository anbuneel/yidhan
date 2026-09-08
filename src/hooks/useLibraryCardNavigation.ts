import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Note } from '../types';
import { groupNotesByChapter } from '../utils/temporalGrouping';

interface UseLibraryCardNavigationOptions {
  notes: Note[];
  onOpen: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}

/** Keeps keyboard selection in the same chapter order readers see on screen. */
export function useLibraryCardNavigation({
  notes,
  onOpen,
  onTogglePin,
  onDelete,
}: UseLibraryCardNavigationOptions) {
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);

  const navigableNotes = useMemo(
    () => groupNotesByChapter(notes)
      .flatMap((chapter) => chapter.notes)
      .filter((note) => !note.decryptionFailed),
    [notes]
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

    if (isPrevious || isNext) {
      if (navigableNotes.length === 0) return false;

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
    if (!focusedNote) return false;

    if (key === 'enter') {
      if (event.repeat) return true;
      onOpen(focusedNote.id);
      return true;
    }

    if (key === 'p') {
      if (event.repeat) return true;
      onTogglePin(focusedNote.id, focusedNote.pinned);
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
