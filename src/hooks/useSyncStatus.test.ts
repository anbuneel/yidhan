import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { clearOfflineDb, createPendingSyncQueueEntry, getOfflineDb } from '../lib/offlineDb';
import { getSyncQueueSnapshot } from '../services/offlineNotes';
import { useSyncStatus } from './useSyncStatus';

const { mockUser, mockOnline, actualGetSyncQueueSnapshot } = vi.hoisted(() => ({
  mockUser: { value: { id: 'sync-status-user' } as { id: string } | null },
  mockOnline: { value: true },
  actualGetSyncQueueSnapshot: { fn: null as null | typeof getSyncQueueSnapshot },
}));

vi.mock('../services/offlineNotes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/offlineNotes')>();
  actualGetSyncQueueSnapshot.fn = actual.getSyncQueueSnapshot;
  return {
    ...actual,
    getSyncQueueSnapshot: vi.fn((userId: string) => actual.getSyncQueueSnapshot(userId)),
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.value }),
}));

vi.mock('./useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockOnline.value }),
}));

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  });
}

describe('useSyncStatus (C23)', () => {
  beforeEach(async () => {
    mockUser.value = { id: 'sync-status-user' };
    mockOnline.value = true;
    setDocumentHidden(false);
    vi.mocked(getSyncQueueSnapshot).mockReset();
    if (actualGetSyncQueueSnapshot.fn) {
      vi.mocked(getSyncQueueSnapshot).mockImplementation(actualGetSyncQueueSnapshot.fn);
    }
    const db = getOfflineDb('sync-status-user');
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    setDocumentHidden(false);
    await clearOfflineDb();
  });

  // Where it must NOT fire.
  it('does not poll IndexedDB periodically when idle or while the tab is hidden', async () => {
    vi.useFakeTimers();
    setDocumentHidden(true);
    const snapshotSpy = vi.mocked(getSyncQueueSnapshot);

    renderHook(() => useSyncStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(snapshotSpy).not.toHaveBeenCalled();

    // Returning to visible runs one read, then stays quiet without a 10s interval.
    setDocumentHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    const readsAfterVisible = snapshotSpy.mock.calls.length;
    expect(readsAfterVisible).toBeGreaterThanOrEqual(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(snapshotSpy.mock.calls.length).toBe(readsAfterVisible);
  });

  it('skips React state updates when a refresh returns unchanged counts', async () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useSyncStatus();
    });

    await act(async () => {
      await result.current.refresh();
    });
    const rendersAfterFirst = renderCount;

    await act(async () => {
      await result.current.refresh();
      await result.current.refresh();
    });
    expect(renderCount).toBe(rendersAfterFirst);
  });

  it('detaches Dexie queue hooks on unmount so later writes do not read IndexedDB', async () => {
    const snapshotSpy = vi.mocked(getSyncQueueSnapshot);
    const { unmount } = renderHook(() => useSyncStatus());
    await waitFor(() => expect(snapshotSpy).toHaveBeenCalled());

    unmount();
    snapshotSpy.mockClear();

    const db = getOfflineDb('sync-status-user');
    await db.syncQueue.add(
      createPendingSyncQueueEntry({
        operation: 'update',
        entityType: 'note',
        entityId: 'after-unmount',
        payload: {},
      })
    );
    await new Promise((r) => setTimeout(r, 80));
    expect(snapshotSpy).not.toHaveBeenCalled();
  });

  // Where it must fire.
  it('updates promptly when queue entries are added, blocked, and cleared', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => expect(result.current.isSynced).toBe(true));

    const db = getOfflineDb('sync-status-user');
    const id = await db.syncQueue.add(
      createPendingSyncQueueEntry({
        operation: 'update',
        entityType: 'note',
        entityId: 'note-1',
        payload: {},
      })
    );

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1);
      expect(result.current.isSynced).toBe(false);
    });

    await db.syncQueue.update(id, {
      status: 'blocked',
      blockedAt: Date.now(),
      lastError: 'permission denied (42501)',
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.blockedCount).toBe(1);
      expect(result.current.blockedReason).toBeTruthy();
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    await db.syncQueue.delete(id);

    await waitFor(() => {
      expect(result.current.blockedCount).toBe(0);
      expect(result.current.isSynced).toBe(true);
    });
  });

  it('marks lingering pending work as stuck after 30 seconds without polling every 10 seconds', async () => {
    vi.useFakeTimers();
    const snapshotSpy = vi
      .mocked(getSyncQueueSnapshot)
      .mockResolvedValue({ pendingCount: 1, blockedCount: 0, blockedReason: null });

    const { result } = renderHook(() => useSyncStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.isStuck).toBe(false);
    const readsAfterInit = snapshotSpy.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(result.current.isStuck).toBe(false);
    // No 10s polling ticks fired during the 29s wait.
    expect(snapshotSpy.mock.calls.length).toBe(readsAfterInit);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.isStuck).toBe(true);
    expect(snapshotSpy.mock.calls.length).toBe(readsAfterInit + 1);
  });
});
