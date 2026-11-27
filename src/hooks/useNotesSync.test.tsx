import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedKeys } from '../lib/encryption';
import type { Note } from '../types';

const mocks = vi.hoisted(() => ({
  fadedIds: new Set<string>(),
  onNoteUpdate: undefined as ((note: Note) => void) | undefined,
  onNoteDelete: undefined as ((id: string) => void) | undefined,
  onSyncPullComplete: undefined as (() => void) | undefined,
  onSyncComplete: undefined as (() => Promise<void> | void) | undefined,
  fetchDecryptedNotes: vi.fn(),
  cleanupExpiredFadedNotes: vi.fn(),
  countFadedNotesOffline: vi.fn(),
  upsertNoteFromServer: vi.fn(),
  deleteNoteFromServer: vi.fn(),
}));

vi.mock('../services/notes', () => ({
  cleanupExpiredFadedNotes: mocks.cleanupExpiredFadedNotes,
  subscribeToNotes: (
    _userId: string,
    _onInsert: (note: Note) => void,
    onUpdate: (note: Note) => void,
    onDelete: (id: string) => void
  ) => {
    mocks.onNoteUpdate = onUpdate;
    mocks.onNoteDelete = onDelete;
    return vi.fn();
  },
}));
vi.mock('../services/tags', () => ({ subscribeToTags: () => vi.fn() }));
vi.mock('../services/offlineNotes', () => ({
  countFadedNotesOffline: mocks.countFadedNotesOffline,
  upsertNoteFromServer: mocks.upsertNoteFromServer,
  deleteNoteFromServer: mocks.deleteNoteFromServer,
  upsertTagFromServer: vi.fn(),
  deleteTagFromServer: vi.fn(),
}));
vi.mock('../services/encryptedNotes', () => ({
  fetchDecryptedNotes: mocks.fetchDecryptedNotes,
  decryptNoteFromServer: vi.fn().mockImplementation(async (note: Note) => note),
}));
vi.mock('../services/offlineTags', () => ({ fetchTagsOffline: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/noteTagSync', () => ({ subscribeToNoteTags: () => vi.fn() }));
vi.mock('./useStoragePersistence', () => ({ useStoragePersistence: vi.fn() }));
vi.mock('./useSyncEngine', () => ({
  useSyncEngine: (onSyncComplete?: () => Promise<void> | void, onSyncPullComplete?: () => void) => {
    mocks.onSyncComplete = onSyncComplete;
    mocks.onSyncPullComplete = onSyncPullComplete;
    return { conflicts: [], removeConflict: vi.fn(), triggerSync: vi.fn() };
  },
}));
vi.mock('../services/syncEngine', () => ({
  invalidateSyncPullCursors: vi.fn(),
  reportConflict: vi.fn(),
}));
vi.mock('../utils/reliabilityTelemetry', () => ({ reportReliabilityIssue: vi.fn() }));

import { useNotesSync } from './useNotesSync';

const KEYS = {
  encryptionKey: {} as CryptoKey,
  hashKey: {} as CryptoKey,
  salt: new Uint8Array(16),
  rawEncryptionKey: new Uint8Array(32),
  rawHashKey: new Uint8Array(32),
} satisfies DerivedKeys;

function serverNote(id: string, deletedAt: Date | null): Note {
  const now = new Date();
  return {
    id, userId: 'faded-count-user', title: '', content: '', pinned: false, tags: [], deletedAt,
    createdAt: now, updatedAt: now, syncStatus: 'synced', encryptedPayload: 'ciphertext',
    encryptionIv: 'iv', encryptionVersion: 1, contentHash: `hash-${id}`,
  };
}

const settleRealtimeRecount = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('useNotesSync faded count', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.fetchDecryptedNotes.mockResolvedValue([]);
    mocks.fadedIds.clear();
    mocks.fadedIds.add('already-faded');
    mocks.fadedIds.add('expired');
    mocks.onNoteUpdate = undefined;
    mocks.onSyncPullComplete = undefined;
    mocks.cleanupExpiredFadedNotes.mockResolvedValue(0);
    mocks.countFadedNotesOffline.mockImplementation(async () => mocks.fadedIds.size);
    mocks.upsertNoteFromServer.mockImplementation(async (_userId: string, note: Note) => {
      if (note.deletedAt) mocks.fadedIds.add(note.id);
      else mocks.fadedIds.delete(note.id);
    });
    mocks.deleteNoteFromServer.mockResolvedValue({ deleted: true });
  });

  it('equals the faded list length through local changes, realtime events, sync pulls, and expiry cleanup', async () => {
    const { result, rerender } = renderHook(
      ({ isHydrating }) => useNotesSync({
        userId: 'faded-count-user', keys: KEYS, isHydrating,
        openNoteIdRef: { current: null }, onOpenNoteRemoved: vi.fn(),
      }),
      { initialProps: { isHydrating: false } }
    );

    await waitFor(() => expect(result.current.fadedNotesCount).toBe(mocks.fadedIds.size));

    // useNoteActions updates IndexedDB before calling this public recount callback.
    mocks.fadedIds.add('local');
    await result.current.refreshFadedNotesCount();
    await waitFor(() => expect(result.current.fadedNotesCount).toBe(mocks.fadedIds.size));

    // Undo follows the same path and never subtracts a stale optimistic value.
    mocks.fadedIds.delete('local');
    await result.current.refreshFadedNotesCount();
    await waitFor(() => expect(result.current.fadedNotesCount).toBe(mocks.fadedIds.size));

    // A duplicate remote delete remains one member of the faded list.
    act(() => { mocks.onNoteUpdate?.(serverNote('already-faded', new Date())); });
    await settleRealtimeRecount();
    await waitFor(() => expect(result.current.fadedNotesCount).toBe(mocks.fadedIds.size));

    // A remote restore the client never saw faded cannot drive the badge negative.
    act(() => { mocks.onNoteUpdate?.(serverNote('remote-restore', null)); });
    await settleRealtimeRecount();
    await waitFor(() => expect(result.current.fadedNotesCount).toBe(mocks.fadedIds.size));
    expect(result.current.fadedNotesCount).toBeGreaterThanOrEqual(0);

    // A pull can change the persisted list without emitting a realtime event.
    mocks.fadedIds.add('pulled-faded');
    act(() => { mocks.onSyncPullComplete?.(); });
    await settleRealtimeRecount();
    await waitFor(() => expect(result.current.fadedNotesCount).toBe(mocks.fadedIds.size));

    mocks.cleanupExpiredFadedNotes.mockImplementation(async () => {
      mocks.fadedIds.delete('expired');
      return 1;
    });
    rerender({ isHydrating: true });
    rerender({ isHydrating: false });
    await waitFor(() => expect(result.current.fadedNotesCount).toBe(mocks.fadedIds.size));
    expect(result.current.fadedNotesCount).toBe(2);
  });
});

// Issue #205: the hook reports that the open note left; App decides whether to close
// it. These pin which events report, and that the faded count is unaffected.
describe('useNotesSync open-note removal', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.fetchDecryptedNotes.mockResolvedValue([]);
    mocks.fadedIds.clear();
    mocks.cleanupExpiredFadedNotes.mockResolvedValue(0);
    mocks.countFadedNotesOffline.mockImplementation(async () => mocks.fadedIds.size);
    mocks.upsertNoteFromServer.mockImplementation(async (_userId: string, note: Note) => {
      if (note.deletedAt) mocks.fadedIds.add(note.id);
      else mocks.fadedIds.delete(note.id);
    });
    mocks.deleteNoteFromServer.mockResolvedValue({ deleted: true });
  });

  function setup(openNoteId: string | null) {
    const onOpenNoteRemoved = vi.fn();
    const hook = renderHook(() => useNotesSync({
      userId: 'faded-count-user', keys: KEYS, isHydrating: false,
      openNoteIdRef: { current: openNoteId }, onOpenNoteRemoved,
    }));
    return { ...hook, onOpenNoteRemoved };
  }

  it('reports a soft delete of the open note with its id, and keeps the faded count', async () => {
    const { result, onOpenNoteRemoved } = setup('open');
    await waitFor(() => expect(mocks.onNoteUpdate).toBeDefined());
    act(() => { mocks.onNoteUpdate?.(serverNote('open', new Date())); });
    await waitFor(() => expect(onOpenNoteRemoved).toHaveBeenCalledWith('open'));
    await settleRealtimeRecount();
    await waitFor(() => expect(result.current.fadedNotesCount).toBe(1));
  });

  it('reports a hard delete of the open note with its id', async () => {
    const { onOpenNoteRemoved } = setup('open');
    await waitFor(() => expect(mocks.onNoteDelete).toBeDefined());
    act(() => { mocks.onNoteDelete?.('open'); });
    await waitFor(() => expect(onOpenNoteRemoved).toHaveBeenCalledWith('open'));
  });

  it('does not report a delete of a different note', async () => {
    const { onOpenNoteRemoved } = setup('open');
    await waitFor(() => expect(mocks.onNoteUpdate).toBeDefined());
    act(() => { mocks.onNoteUpdate?.(serverNote('other', new Date())); });
    act(() => { mocks.onNoteDelete?.('other'); });
    await settleRealtimeRecount();
    expect(onOpenNoteRemoved).not.toHaveBeenCalled();
  });

  it('does not report an ordinary update to the open note, such as its own echo', async () => {
    const { onOpenNoteRemoved } = setup('open');
    await waitFor(() => expect(mocks.onNoteUpdate).toBeDefined());
    act(() => { mocks.onNoteUpdate?.(serverNote('open', null)); });
    await settleRealtimeRecount();
    expect(onOpenNoteRemoved).not.toHaveBeenCalled();
  });

  it('does not report a hard delete that conflicts with local work', async () => {
    mocks.deleteNoteFromServer.mockResolvedValue({ deleted: false, localNote: {
      id: 'open', userId: 'faded-count-user', title: '', content: '', pinned: false, deletedAt: null,
      createdAt: 0, updatedAt: 0, syncStatus: 'conflict',
    } });
    const { onOpenNoteRemoved } = setup('open');
    await waitFor(() => expect(mocks.onNoteDelete).toBeDefined());
    act(() => { mocks.onNoteDelete?.('open'); });
    await settleRealtimeRecount();
    expect(onOpenNoteRemoved).not.toHaveBeenCalled();
  });
});

// A sync refresh reads IndexedDB, decrypts every note, then replaces the list. A note
// created while that read was in flight is in IndexedDB and on screen, but not in the
// snapshot. Applying the snapshot dropped it, and App then closed the editor with
// "That note is no longer here."
describe('useNotesSync refresh after a sync', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.cleanupExpiredFadedNotes.mockResolvedValue(0);
    mocks.countFadedNotesOffline.mockResolvedValue(0);
    mocks.deleteNoteFromServer.mockResolvedValue({ deleted: true });
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
  }

  async function setup(initial: Note[]) {
    mocks.fetchDecryptedNotes.mockResolvedValue(initial);
    const openNoteIdRef = { current: null };
    const onOpenNoteRemoved = vi.fn();
    const hook = renderHook(() => useNotesSync({
      userId: 'faded-count-user', keys: KEYS, isHydrating: false,
      openNoteIdRef, onOpenNoteRemoved,
    }));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.notes.map((n) => n.id)).toEqual(initial.map((n) => n.id));
    expect(mocks.fetchDecryptedNotes).toHaveBeenCalledTimes(1);
    return hook;
  }

  const ids = (notes: Note[]) => notes.map((n) => n.id).sort();

  it('keeps a note created while the refresh was reading', async () => {
    const existing = serverNote('existing', null);
    const created = serverNote('created', null);
    const { result } = await setup([existing]);

    // The refresh reads IndexedDB before the new note is written.
    const staleRead = deferred<Note[]>();
    mocks.fetchDecryptedNotes.mockReturnValueOnce(staleRead.promise);
    // Any later read sees the note, because the create wrote it first.
    mocks.fetchDecryptedNotes.mockResolvedValue([created, existing]);
    let refresh!: Promise<void> | void;
    act(() => { refresh = mocks.onSyncComplete?.(); });

    // handleNewNote: written to IndexedDB, then added to the list.
    act(() => { result.current.setNotes((prev) => [created, ...prev]); });

    await act(async () => {
      staleRead.resolve([existing]);
      await refresh;
    });

    await waitFor(() => expect(mocks.fetchDecryptedNotes).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(ids(result.current.notes)).toEqual(['created', 'existing']));
    // Never dropped, not even for one render.
    expect(result.current.notes.some((n) => n.id === 'created')).toBe(true);
  });

  it('does not let an older refresh overwrite a newer one', async () => {
    const existing = serverNote('existing', null);
    const pulled = serverNote('pulled', null);
    const { result } = await setup([existing]);

    const older = deferred<Note[]>();
    const newer = deferred<Note[]>();
    mocks.fetchDecryptedNotes.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    let first!: Promise<void> | void;
    let second!: Promise<void> | void;
    act(() => { first = mocks.onSyncComplete?.(); });
    act(() => { second = mocks.onSyncComplete?.(); });

    await act(async () => {
      newer.resolve([pulled, existing]);
      await second;
    });
    expect(ids(result.current.notes)).toEqual(['existing', 'pulled']);

    await act(async () => {
      older.resolve([existing]);
      await first;
    });
    expect(ids(result.current.notes)).toEqual(['existing', 'pulled']);
  });

  // Where it should still fire: a note deleted on another device and removed by the
  // pull leaves the list, so App still says it is no longer here.
  it('still removes a note the pull deleted when nothing changed locally', async () => {
    const existing = serverNote('existing', null);
    const gone = serverNote('gone', null);
    const { result } = await setup([gone, existing]);

    mocks.fetchDecryptedNotes.mockResolvedValue([existing]);
    await act(async () => { await mocks.onSyncComplete?.(); });

    expect(ids(result.current.notes)).toEqual(['existing']);
  });

  it('does not bring back a note deleted elsewhere while the refresh was reading', async () => {
    const existing = serverNote('existing', null);
    const gone = serverNote('gone', null);
    const { result } = await setup([gone, existing]);

    const staleRead = deferred<Note[]>();
    mocks.fetchDecryptedNotes.mockReturnValueOnce(staleRead.promise);
    mocks.fetchDecryptedNotes.mockResolvedValue([existing]);
    let refresh!: Promise<void> | void;
    act(() => { refresh = mocks.onSyncComplete?.(); });

    act(() => { mocks.onNoteDelete?.('gone'); });
    await waitFor(() => expect(ids(result.current.notes)).toEqual(['existing']));

    await act(async () => {
      staleRead.resolve([gone, existing]);
      await refresh;
    });
    expect(ids(result.current.notes)).toEqual(['existing']);
  });

  it('still removes a pulled delete after retrying past a local change', async () => {
    const existing = serverNote('existing', null);
    const gone = serverNote('gone', null);
    const { result } = await setup([gone, existing]);

    const staleRead = deferred<Note[]>();
    mocks.fetchDecryptedNotes.mockReturnValueOnce(staleRead.promise);
    mocks.fetchDecryptedNotes.mockResolvedValue([{ ...existing, title: 'edited' }]);
    let refresh!: Promise<void> | void;
    act(() => { refresh = mocks.onSyncComplete?.(); });
    act(() => {
      result.current.setNotes((prev) => prev.map((n) => (n.id === 'existing' ? { ...n, title: 'edited' } : n)));
    });
    await act(async () => {
      staleRead.resolve([existing]);
      await refresh;
    });

    await waitFor(() => expect(ids(result.current.notes)).toEqual(['existing']));
    expect(result.current.notes[0].title).toBe('edited');
  });
});
