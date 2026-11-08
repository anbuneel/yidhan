import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Note } from '../types';

// Issue #205: a delete from another device used to unmount the editor and take an
// unsaved draft with it. The decision to drop words belongs to the person who wrote
// them, so a draft the editor still holds keeps the editor open until they choose.

/** What the open editor reports about its own words, written by the editor into a ref. */
export interface OpenDraftState {
  noteId: string;
  /** True while the screen holds words the note on disk does not: dirty, saving, or a failed save. */
  unsaved: boolean;
}

/** True when the open editor has reported unsaved words for this note. */
export function holdsUnsavedDraft(draftRef: RefObject<OpenDraftState | null>, noteId: string | null): boolean {
  return draftRef.current?.noteId === noteId && draftRef.current.unsaved;
}

/**
 * Resolve the note the editor should show. When the open note has left the library
 * while the editor holds unsaved words, this returns the last committed copy and
 * `released: true`, so the editor stays mounted and the words stay on screen.
 *
 * The draft is a ref, not state: the note leaving the library is itself a render, and
 * that render reads the latest report. The editor writes it after each commit.
 *
 * Once released, it stays released until the note comes back or the address changes,
 * even if the draft later compares clean: a save that lands after the release, or an
 * edit undone back to the original, must not snatch the editor away mid-thought.
 */
export function useReleasedOpenNote(
  draftRef: RefObject<OpenDraftState | null>,
  selectedNoteId: string | null,
  selectedNoteRecord: Note | undefined
): { note: Note | undefined; released: boolean } {
  // Both refs are written only after commit, so a render React discards cannot
  // leave behind a copy of the note that never reached the screen.
  const lastOpenNoteRef = useRef<Note | null>(null);
  const releasedIdRef = useRef<string | null>(null);

  const lastOpenNote = lastOpenNoteRef.current;
  const released =
    !selectedNoteRecord &&
    lastOpenNote !== null &&
    lastOpenNote.id === selectedNoteId &&
    !lastOpenNote.decryptionFailed &&
    (holdsUnsavedDraft(draftRef, selectedNoteId) || releasedIdRef.current === selectedNoteId);

  useLayoutEffect(() => {
    if (selectedNoteRecord) lastOpenNoteRef.current = selectedNoteRecord;
    else if (lastOpenNoteRef.current?.id !== selectedNoteId) lastOpenNoteRef.current = null;
    releasedIdRef.current = released ? selectedNoteId : null;
  });

  return { note: selectedNoteRecord ?? (released ? lastOpenNote : undefined), released };
}
