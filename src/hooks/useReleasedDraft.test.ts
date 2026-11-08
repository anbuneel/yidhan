import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockNote } from '../test/factories';
import type { Note } from '../types';
import { useDraftReport, useReleasedOpenNote, type OpenDraftState } from './useReleasedDraft';

// Issue #205. App resolves the open note through these hooks on every render; these
// cases are the renders around a note leaving the library.
const note = createMockNote({ id: 'open', title: 'Open note' });

interface Props { draft: OpenDraftState | null; selectedNoteId: string | null; record: Note | undefined }

function setup(initial: Props) {
  return renderHook(
    ({ draft, selectedNoteId, record }: Props) => useReleasedOpenNote(draft, selectedNoteId, record),
    { initialProps: initial }
  );
}

const dirty = { noteId: 'open', unsaved: true };
const clean = { noteId: 'open', unsaved: false };

describe('useDraftReport', () => {
  it('lets a realtime handler read the latest report before any render', () => {
    const { result } = renderHook(() => useDraftReport());
    const { holdsUnsavedDraft, reportDraft } = result.current;
    reportDraft(dirty);
    expect(holdsUnsavedDraft('open')).toBe(true);
    expect(holdsUnsavedDraft('other')).toBe(false);
    reportDraft(null);
    expect(holdsUnsavedDraft('open')).toBe(false);
  });

  it('keeps the same state object for a repeated report', () => {
    const { result } = renderHook(() => useDraftReport());
    act(() => result.current.reportDraft(dirty));
    const first = result.current.draft;
    act(() => result.current.reportDraft({ ...dirty }));
    expect(result.current.draft).toBe(first);
  });
});

describe('useReleasedOpenNote', () => {
  it('passes a present note straight through', () => {
    const { result } = setup({ draft: dirty, selectedNoteId: 'open', record: note });
    expect(result.current).toEqual({ note, released: false });
  });

  it('lets a clean note go when it leaves the library', () => {
    const { result, rerender } = setup({ draft: clean, selectedNoteId: 'open', record: note });
    rerender({ draft: clean, selectedNoteId: 'open', record: undefined });
    expect(result.current).toEqual({ note: undefined, released: false });
  });

  it('holds the last copy when the note leaves with unsaved words', () => {
    const { result, rerender } = setup({ draft: dirty, selectedNoteId: 'open', record: note });
    rerender({ draft: dirty, selectedNoteId: 'open', record: undefined });
    expect(result.current).toEqual({ note, released: true });
  });

  it('stays released when the draft later compares clean', () => {
    const { result, rerender } = setup({ draft: dirty, selectedNoteId: 'open', record: note });
    rerender({ draft: dirty, selectedNoteId: 'open', record: undefined });
    rerender({ draft: clean, selectedNoteId: 'open', record: undefined });
    expect(result.current).toEqual({ note, released: true });
  });

  it('does not hold for a draft that belongs to another note', () => {
    const { result, rerender } = setup({ draft: { noteId: 'other', unsaved: true }, selectedNoteId: 'open', record: note });
    rerender({ draft: { noteId: 'other', unsaved: true }, selectedNoteId: 'open', record: undefined });
    expect(result.current.released).toBe(false);
  });

  it('treats an address it never showed as missing, not released', () => {
    const { result, rerender } = setup({ draft: dirty, selectedNoteId: 'open', record: note });
    rerender({ draft: { noteId: 'elsewhere', unsaved: true }, selectedNoteId: 'elsewhere', record: undefined });
    expect(result.current).toEqual({ note: undefined, released: false });
  });

  it('ends the release once the writer leaves, and does not bring it back', () => {
    const { result, rerender } = setup({ draft: dirty, selectedNoteId: 'open', record: note });
    rerender({ draft: dirty, selectedNoteId: 'open', record: undefined });
    rerender({ draft: null, selectedNoteId: null, record: undefined });
    expect(result.current.released).toBe(false);
    // Back to the old address: the copy is forgotten, so it is simply missing.
    rerender({ draft: null, selectedNoteId: 'open', record: undefined });
    expect(result.current).toEqual({ note: undefined, released: false });
  });

  it('ends the release when the note comes back', () => {
    const { result, rerender } = setup({ draft: dirty, selectedNoteId: 'open', record: note });
    rerender({ draft: dirty, selectedNoteId: 'open', record: undefined });
    const restored = { ...note, title: 'Restored elsewhere' };
    rerender({ draft: dirty, selectedNoteId: 'open', record: restored });
    expect(result.current).toEqual({ note: restored, released: false });
    // And a later clean removal closes normally.
    rerender({ draft: clean, selectedNoteId: 'open', record: undefined });
    expect(result.current.released).toBe(false);
  });

  it('never holds a locked note', () => {
    const locked = { ...note, decryptionFailed: true };
    const { result, rerender } = setup({ draft: dirty, selectedNoteId: 'open', record: locked });
    rerender({ draft: dirty, selectedNoteId: 'open', record: undefined });
    expect(result.current.released).toBe(false);
  });
});
