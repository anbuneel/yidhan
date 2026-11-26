import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockNote } from '../test/factories';

const mocks = vi.hoisted(() => ({
  softDeleteNoteOffline: vi.fn(),
  restoreNoteOffline: vi.fn(),
  permanentDeleteNoteOffline: vi.fn(),
  removeFadedNotesAfterServerEmpty: vi.fn(),
  toggleNotePinOffline: vi.fn(),
  updateEncryptedNote: vi.fn(),
  fetchDecryptedFadedNotes: vi.fn(),
  emptyFadedNotes: vi.fn(),
  toast: vi.fn(),
  toastDismiss: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(mocks.toast, {
    dismiss: mocks.toastDismiss,
    error: mocks.toastError,
    success: mocks.toastSuccess,
  }),
}));

vi.mock('../services/offlineNotes', () => ({
  softDeleteNoteOffline: mocks.softDeleteNoteOffline,
  restoreNoteOffline: mocks.restoreNoteOffline,
  permanentDeleteNoteOffline: mocks.permanentDeleteNoteOffline,
  removeFadedNotesAfterServerEmpty: mocks.removeFadedNotesAfterServerEmpty,
  toggleNotePinOffline: mocks.toggleNotePinOffline,
}));

vi.mock('../services/encryptedNotes', () => ({
  updateEncryptedNote: mocks.updateEncryptedNote,
  fetchDecryptedFadedNotes: mocks.fetchDecryptedFadedNotes,
}));

vi.mock('../services/notes', () => ({
  emptyFadedNotes: mocks.emptyFadedNotes,
}));

import { useFadedNotes } from './useFadedNotes';
import { useNoteActions } from './useNoteActions';

describe('note deletion feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failure to NoteCard without also showing a toast', async () => {
    const note = createMockNote({ id: 'note-to-fade' });
    const failure = new Error('IndexedDB write failed');
    mocks.softDeleteNoteOffline.mockRejectedValue(failure);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useNoteActions({
      userId: 'user-1',
      keys: null,
      notes: [note],
      notesRef: { current: [note] },
      setNotes: vi.fn(),
      refreshFadedNotesCount: vi.fn(),
      openNoteIdRef: { current: null },
      onOpenNoteClosed: vi.fn(),
      triggerCoalescedSync: vi.fn(),
    }));

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.handleNoteDelete(note.id);
    });

    expect(deleted).toBe(false);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Failed to delete note:', failure);
    consoleError.mockRestore();
  });

  function renderDeleteHook(note: ReturnType<typeof createMockNote>) {
    return renderHook(() => useNoteActions({
      userId: 'user-1',
      keys: null,
      notes: [note],
      notesRef: { current: [note] },
      setNotes: vi.fn(),
      refreshFadedNotesCount: vi.fn(),
      openNoteIdRef: { current: null },
      onOpenNoteClosed: vi.fn(),
      triggerCoalescedSync: vi.fn(),
    }));
  }

  /** Render the undo toast the hook passed to `toast()` and click Undo. */
  async function clickUndo() {
    const [renderToast, options] = mocks.toast.mock.calls[0] as [
      (t: { id: string }) => ReactElement,
      { duration: number },
    ];
    render(renderToast({ id: 'toast-1' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    return options;
  }

  it('keeps the undo toast up for 8 seconds', async () => {
    const note = createMockNote({ id: 'note-to-fade' });
    mocks.softDeleteNoteOffline.mockResolvedValue(undefined);
    const { result } = renderDeleteHook(note);
    await act(async () => {
      await result.current.handleNoteDelete(note.id);
    });
    expect(mocks.toast.mock.calls[0][1]).toEqual({ duration: 8000 });
  });

  it('says the note is still in Faded notes when undo fails', async () => {
    const note = createMockNote({ id: 'note-to-fade' });
    mocks.softDeleteNoteOffline.mockResolvedValue(undefined);
    mocks.restoreNoteOffline.mockRejectedValue(new Error('IndexedDB write failed'));
    const { result } = renderDeleteHook(note);
    await act(async () => {
      await result.current.handleNoteDelete(note.id);
    });
    await clickUndo();
    expect(mocks.toastError).toHaveBeenCalledWith("Couldn't restore the note. It's still in Faded notes.");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('still restores on undo, with no error', async () => {
    const note = createMockNote({ id: 'note-to-fade' });
    mocks.softDeleteNoteOffline.mockResolvedValue(undefined);
    mocks.restoreNoteOffline.mockResolvedValue(undefined);
    const { result } = renderDeleteHook(note);
    await act(async () => {
      await result.current.handleNoteDelete(note.id);
    });
    await clickUndo();
    expect(mocks.restoreNoteOffline).toHaveBeenCalledWith('user-1', note.id);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Note restored');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('keeps the permanent-delete failure toast in Faded Notes', async () => {
    mocks.permanentDeleteNoteOffline.mockRejectedValue(new Error('IndexedDB write failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useFadedNotes({
      userId: 'user-1',
      keys: null,
      isViewingFaded: false,
      setNotes: vi.fn(),
      refreshFadedNotesCount: vi.fn(),
    }));

    await act(async () => {
      await result.current.handlePermanentDelete('faded-note');
    });

    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.toastError).toHaveBeenCalledWith('Failed to delete note');
    consoleError.mockRestore();
  });
});
