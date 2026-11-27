import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLockedNotes } from './useLockedNotes';
import type { Note } from '../types';
import type { DerivedKeys } from '../lib/encryption';

const reloadFromStorage = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastPlain = vi.hoisted(() => vi.fn());

vi.mock('react-hot-toast', () => ({
  default: Object.assign(toastPlain, { error: toastError }),
}));

const keys = {} as DerivedKeys;

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: '',
    content: '',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    pinned: false,
    tags: [],
    ...overrides,
  } as Note;
}

describe('useLockedNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The whole point of item 41: a note that would not decrypt must not reach the
   * editor, because its title and content are empty by construction and the first
   * autosave would write that emptiness over ciphertext another device can still read.
   */
  it('sends the reader back when the open note could not be decrypted', () => {
    const onLockedNoteOpened = vi.fn();
    renderHook(() =>
      useLockedNotes({
        openNote: note({ decryptionFailed: true }),
        userId: 'user-1',
        keys,
        reloadFromStorage,
        onLockedNoteOpened,
      })
    );

    expect(onLockedNoteOpened).toHaveBeenCalledTimes(1);
    expect(toastPlain).toHaveBeenCalledWith('That note could not be opened on this device.');
  });

  it('leaves a readable note alone', () => {
    const onLockedNoteOpened = vi.fn();
    renderHook(() =>
      useLockedNotes({
        openNote: note({ title: 'Readable' }),
        userId: 'user-1',
        keys,
        reloadFromStorage,
        onLockedNoteOpened,
      })
    );

    expect(onLockedNoteOpened).not.toHaveBeenCalled();
    expect(toastPlain).not.toHaveBeenCalled();
  });

  it('does nothing when no note is open', () => {
    const onLockedNoteOpened = vi.fn();
    renderHook(() =>
      useLockedNotes({
        openNote: undefined,
        userId: 'user-1',
        keys,
        reloadFromStorage,
        onLockedNoteOpened,
      })
    );

    expect(onLockedNoteOpened).not.toHaveBeenCalled();
  });

  it('re-reads the library when the reader retries a locked card', async () => {
    reloadFromStorage.mockResolvedValue({ status: 'applied', notes: [note({ title: 'Now readable' })] });

    const { result } = renderHook(() =>
      useLockedNotes({
        openNote: undefined,
        userId: 'user-1',
        keys,
        reloadFromStorage,
        onLockedNoteOpened: vi.fn(),
      })
    );

    await result.current.retryLockedNotes();

    // Through the guarded reload, so a note created meanwhile is not dropped.
    await waitFor(() => expect(reloadFromStorage).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('says what to try when the retry fails, rather than failing silently', async () => {
    reloadFromStorage.mockRejectedValue(new Error('still locked'));

    const { result } = renderHook(() =>
      useLockedNotes({
        openNote: undefined,
        userId: 'user-1',
        keys,
        reloadFromStorage,
        onLockedNoteOpened: vi.fn(),
      })
    );

    await result.current.retryLockedNotes();

    expect(toastError).toHaveBeenCalledWith(
      'Could not open those notes. Lock and unlock your vault, then try again.'
    );
  });

  /** A locked vault has no key to retry with; asking the server would only fail again. */
  it('does not reach the server without a key', async () => {
    const { result } = renderHook(() =>
      useLockedNotes({
        openNote: undefined,
        userId: 'user-1',
        keys: null,
        reloadFromStorage,
        onLockedNoteOpened: vi.fn(),
      })
    );

    await result.current.retryLockedNotes();
    expect(reloadFromStorage).not.toHaveBeenCalled();
  });
});
