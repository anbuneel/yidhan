import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Note } from '../types';

// Issue #205: a delete from another device used to unmount the editor and take an
// unsaved draft with it. The decision to drop words belongs to the person who wrote
// them, so a draft the editor still holds keeps the editor open until they choose.

/** What the open editor reports about its own words. */
export interface OpenDraftState {
  noteId: string;
  /** True while the screen holds words the note on disk does not: dirty, saving, or a failed save. */
  unsaved: boolean;
}

export interface DraftReport {
  draft: OpenDraftState | null;
  /** The editor calls this whenever its unsaved state changes, and with null on unmount. */
  reportDraft: (state: OpenDraftState | null) => void;
  /** Read by the realtime handlers: true when the open editor holds unsaved words for this note. */
  holdsUnsavedDraft: (noteId: string) => boolean;
}

export function useDraftReport(): DraftReport {
  // State, so the render that loses the note can see the draft and keep the editor.
  const [draft, setDraft] = useState<OpenDraftState | null>(null);
  // Ref, so realtime handlers read the latest report without waiting for a render.
  const draftRef = useRef<OpenDraftState | null>(null);

  const reportDraft = useCallback((state: OpenDraftState | null) => {
    draftRef.current = state;
    setDraft((prev) =>
      prev?.noteId === state?.noteId && prev?.unsaved === state?.unsaved ? prev : state
    );
  }, []);

  const holdsUnsavedDraft = useCallback(
    (noteId: string) => draftRef.current?.noteId === noteId && draftRef.current.unsaved,
    []
  );

  return { draft, reportDraft, holdsUnsavedDraft };
}

/**
 * Resolve the note the editor should show. When the open note has left the library
 * while the editor holds unsaved words, this returns the last committed copy and
 * `released: true`, so the editor stays mounted and the words stay on screen.
 *
 * Once released, it stays released until the note comes back or the address changes,
 * even if the draft later compares clean: a save that lands after the release, or an
 * edit undone back to the original, must not snatch the editor away mid-thought.
 */
export function useReleasedOpenNote(
  draft: OpenDraftState | null,
  selectedNoteId: string | null,
  selectedNoteRecord: Note | undefined
): { note: Note | undefined; released: boolean } {
  // Both refs are written only after commit, so a render React discards cannot
  // leave behind a copy of the note that never reached the screen.
  const lastOpenNoteRef = useRef<Note | null>(null);
  const releasedIdRef = useRef<string | null>(null);

  const lastOpenNote = lastOpenNoteRef.current;
  let released = false;
  if (
    !selectedNoteRecord &&
    selectedNoteId &&
    lastOpenNote?.id === selectedNoteId &&
    !lastOpenNote.decryptionFailed
  ) {
    const keepsDraft = draft?.noteId === selectedNoteId && draft.unsaved;
    released = keepsDraft || releasedIdRef.current === selectedNoteId;
  }

  useLayoutEffect(() => {
    if (selectedNoteRecord) lastOpenNoteRef.current = selectedNoteRecord;
    else if (lastOpenNoteRef.current?.id !== selectedNoteId) lastOpenNoteRef.current = null;
    releasedIdRef.current = released ? selectedNoteId : null;
  });

  return {
    note: selectedNoteRecord ?? (released ? lastOpenNote ?? undefined : undefined),
    released,
  };
}
