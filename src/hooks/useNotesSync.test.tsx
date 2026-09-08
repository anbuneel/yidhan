import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedKeys } from '../lib/encryption';
import type { Note } from '../types';

const mocks = vi.hoisted(() => ({
  fadedIds: new Set<string>(),
  onNoteUpdate: undefined as ((note: Note) => void) | undefined,
  onSyncPullComplete: undefined as (() => void) | undefined,
  cleanupExpiredFadedNotes: vi.fn(),
  countFadedNotesOffline: vi.fn(),
  upsertNoteFromServer: vi.fn(),
  deleteNoteFromServer: vi.fn(),
}));

vi.mock('../services/notes', () => ({
  cleanupExpiredFadedNotes: mocks.cleanupExpiredFadedNotes,
  subscribeToNotes: (_userId: string, _onInsert: (note: Note) => void, onUpdate: (note: Note) => void) => {
    mocks.onNoteUpdate = onUpdate;
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
  fetchDecryptedNotes: vi.fn().mockResolvedValue([]),
  decryptNoteFromServer: vi.fn().mockImplementation(async (note: Note) => note),
}));
vi.mock('../services/offlineTags', () => ({ fetchTagsOffline: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/noteTagSync', () => ({ subscribeToNoteTags: () => vi.fn() }));
vi.mock('./useStoragePersistence', () => ({ useStoragePersistence: vi.fn() }));
vi.mock('./useSyncEngine', () => ({
  useSyncEngine: (_onSyncComplete?: unknown, onSyncPullComplete?: () => void) => {
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
