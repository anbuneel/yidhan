import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockNote } from '../test/factories';
import type { Note } from '../types';
import { holdsUnsavedDraft, useReleasedOpenNote, type OpenDraftState } from './useReleasedDraft';

// Issue #205. App resolves the open note through this hook on every render; these
// cases are the renders around a note leaving the library.
const note = createMockNote({ id: 'open', title: 'Open note' });

interface Props { draft: OpenDraftState | null; selectedNoteId: string | null; record: Note | undefined }

// The editor writes the ref after commit; each rerender here stands for one App render.
function setup(initial: Props) {
  const draftRef: { current: OpenDraftState | null } = { current: initial.draft };
  const hook = renderHook(
    ({ draft, selectedNoteId, record }: Props) => {
      draftRef.current = draft;
      return useReleasedOpenNote(draftRef, selectedNoteId, record);
    },
    { initialProps: initial }
  );
  return { ...hook, draftRef };
}

const dirty = { noteId: 'open', unsaved: true };
const clean = { noteId: 'open', unsaved: false };

describe('holdsUnsavedDraft', () => {
  it('is true only for an unsaved draft of the named note', () => {
    expect(holdsUnsavedDraft({ current: dirty }, 'open')).toBe(true);
    expect(holdsUnsavedDraft({ current: dirty }, 'other')).toBe(false);
    expect(holdsUnsavedDraft({ current: clean }, 'open')).toBe(false);
    expect(holdsUnsavedDraft({ current: null }, 'open')).toBe(false);
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
    const other = { noteId: 'other', unsaved: true };
    const { result, rerender } = setup({ draft: other, selectedNoteId: 'open', record: note });
    rerender({ draft: other, selectedNoteId: 'open', record: undefined });
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
    rerender({ draft: null, selectedNoteId: 'open', record: undefined });
    expect(result.current).toEqual({ note: undefined, released: false });
  });

  it('ends the release when the note comes back', () => {
    const { result, rerender } = setup({ draft: dirty, selectedNoteId: 'open', record: note });
    rerender({ draft: dirty, selectedNoteId: 'open', record: undefined });
    const restored = { ...note, title: 'Restored elsewhere' };
    rerender({ draft: dirty, selectedNoteId: 'open', record: restored });
    expect(result.current).toEqual({ note: restored, released: false });
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
