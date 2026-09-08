/**
 * syncEngine — pullRemoteChanges and fullSync.
 *
 * Split from the former 2,386-line syncEngine.test.ts. Module mocks live in
 * src/test/syncEngineMocks.ts; builders and the reset helper in
 * src/test/syncEngineTestKit.ts.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@capacitor/core', async () => (await import('../test/syncEngineMocks')).capacitorMock);
vi.mock('../lib/supabase', async () => (await import('../test/syncEngineMocks')).supabaseMock);
vi.mock('./offlineNotes', async () => (await import('../test/syncEngineMocks')).offlineNotesMock);
vi.mock('./offlineTags', async () => (await import('../test/syncEngineMocks')).offlineTagsMock);
vi.mock('../lib/encryption', async () => (await import('../test/syncEngineMocks')).encryptionMock);
vi.mock('./encryptedNotes', async () => (await import('../test/syncEngineMocks')).encryptedNotesMock);
vi.mock('./noteTagSync', async () => (await import('../test/syncEngineMocks')).noteTagSyncMock);

import { clearSyncState, isSyncInProgress, processQueue, pullRemoteChanges, fullSync, resumeSync } from './syncEngine';
import { getOfflineDb } from '../lib/offlineDb';
import type { SyncQueueEntry } from '../lib/offlineDb';
import { mockFrom, mockFetchAllPaginated, mockGetPendingSyncQueue } from '../test/syncEngineMocks';
import { TEST_USER_ID, resetSyncTestState, clearTestDb, createDeferred, encryptedServerFields } from '../test/syncEngineTestKit';

describe('pullRemoteChanges behavior', () => {
  beforeEach(async () => {
    resetSyncTestState();
    await clearTestDb('notes', 'tags', 'noteTags', 'syncQueue');
  });

  afterEach(async () => {
    clearSyncState();
    resumeSync();
    await clearTestDb('notes', 'tags', 'noteTags', 'syncQueue');
  });

  it('should apply pulled notes to IndexedDB', async () => {
    const serverNote = {
      id: 'pulled-note-1',
      title: '',
      content: '',
      pinned: false,
      deleted_at: null,
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      ...encryptedServerFields('pulled-note-1'),
    };

    // Notes data pull
    mockFetchAllPaginated
      .mockResolvedValueOnce({ data: [serverNote], error: null }) // notes pull
      .mockResolvedValueOnce({ data: [{ id: 'pulled-note-1' }], error: null }) // notes membership
      .mockResolvedValueOnce({ data: [], error: null }) // tags pull
      .mockResolvedValueOnce({ data: [], error: null }); // tags membership

    const result = await pullRemoteChanges(TEST_USER_ID);

    expect(result.pulledNotes).toBe(1);
    expect(result.errors).toHaveLength(0);

    const db = getOfflineDb(TEST_USER_ID);
    const stored = await db.notes.get('pulled-note-1');
    expect(stored).toBeDefined();
    expect(stored!.title).toBe('');
    expect(stored!.encryptedPayload).toBe('ciphertext-pulled-note-1');
    expect(stored!.syncStatus).toBe('synced');
    // Simulate an existing synced note from before hash acknowledgements shipped.
    await db.notes.update(serverNote.id, { confirmedContentHash: undefined });
    const gt = vi.fn().mockReturnThis();
    const query = { select: () => query, gt };
    mockFrom.mockReturnValue(query);
    for (const requiresConfirmation of [true, false]) {
      gt.mockClear();
      mockFetchAllPaginated
        .mockImplementationOnce(async factory => {
          factory();
          if (requiresConfirmation) expect(gt).not.toHaveBeenCalled();
          else expect(gt).toHaveBeenCalledWith('updated_at', serverNote.updated_at.replace('Z', '.000Z'));
          return { data: [serverNote], error: null };
        })
        .mockResolvedValueOnce({ data: [{ id: serverNote.id }], error: null })
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [], error: null });
      await pullRemoteChanges(TEST_USER_ID);
      expect((await db.notes.get(serverNote.id))?.confirmedContentHash).toBe(serverNote.content_hash);
    }
  });

  it('should reject plaintext notes pulled from the server', async () => {
    const serverNote = {
      id: 'plaintext-pulled-note',
      title: 'Plaintext',
      content: '<p>Server content</p>',
      pinned: false,
      deleted_at: null,
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      encrypted_payload: null,
      encryption_iv: null,
      encryption_version: null,
      content_hash: null,
    };

    mockFetchAllPaginated
      .mockResolvedValueOnce({ data: [serverNote], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'plaintext-pulled-note' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await pullRemoteChanges(TEST_USER_ID);

    expect(result.pulledNotes).toBe(0);
    expect(result.errors[0]?.error.message).toContain('Refusing to store plaintext server note');

    const db = getOfflineDb(TEST_USER_ID);
    await expect(db.notes.get('plaintext-pulled-note')).resolves.toBeUndefined();
  });

  it('should keep display chronology separate from the sync cursor when pulling notes', async () => {
    const serverNote = {
      id: 'pulled-imported-note',
      title: '',
      content: '',
      pinned: false,
      deleted_at: null,
      created_at: '2024-01-10T00:00:00Z',
      display_updated_at: '2024-01-12T00:00:00Z',
      updated_at: '2026-03-12T00:00:00Z',
      ...encryptedServerFields('pulled-imported-note'),
    };

    mockFetchAllPaginated
      .mockResolvedValueOnce({ data: [serverNote], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'pulled-imported-note' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await pullRemoteChanges(TEST_USER_ID);

    const db = getOfflineDb(TEST_USER_ID);
    const stored = await db.notes.get('pulled-imported-note');
    expect(stored?.updatedAt).toBe(new Date('2024-01-12T00:00:00Z').getTime());
    expect(stored?.serverUpdatedAt).toBe(new Date('2026-03-12T00:00:00Z').getTime());
    expect(stored?.lastSyncedAt).toBe(new Date('2026-03-12T00:00:00Z').getTime());
  });

  it('should skip notes with pending syncStatus', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a local note with pending changes
    await db.notes.put({
      id: 'pending-note',
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending', // <-- pending
      lastSyncedAt: null,
      serverUpdatedAt: null,
      localUpdatedAt: Date.now(),
      encryptedPayload: 'ciphertext-pending-note',
      encryptionIv: 'iv-pending-note',
      encryptionVersion: 1,
      contentHash: 'hash-pending-note',
    });

    const serverNote = {
      id: 'pending-note',
      title: '',
      content: '',
      pinned: false,
      deleted_at: null,
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      ...encryptedServerFields('pending-note'),
    };

    mockFetchAllPaginated
      .mockResolvedValueOnce({ data: [serverNote], error: null }) // notes pull
      .mockResolvedValueOnce({ data: [{ id: 'pending-note' }], error: null }) // notes membership
      .mockResolvedValueOnce({ data: [], error: null }) // tags pull
      .mockResolvedValueOnce({ data: [], error: null }); // tags membership

    const result = await pullRemoteChanges(TEST_USER_ID);

    // Note should be skipped (not counted as pulled)
    expect(result.pulledNotes).toBe(0);

    // Local version should be preserved
    const stored = await db.notes.get('pending-note');
    expect(stored!.encryptedPayload).toBe('ciphertext-pending-note');
    expect(stored!.syncStatus).toBe('pending');
  });

  it('should delete synced-only notes missing from server membership', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a synced note that no longer exists on server
    await db.notes.put({
      id: 'deleted-on-server',
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'synced',
      lastSyncedAt: Date.now(),
      serverUpdatedAt: Date.now(),
      localUpdatedAt: Date.now(),
      encryptedPayload: 'ciphertext-deleted-on-server',
      encryptionIv: 'iv-deleted-on-server',
      encryptionVersion: 1,
      contentHash: 'hash-deleted-on-server',
    });

    mockFetchAllPaginated
      .mockResolvedValueOnce({ data: [], error: null }) // notes pull (no updates)
      .mockResolvedValueOnce({ data: [], error: null }) // notes membership (empty = note was deleted)
      .mockResolvedValueOnce({ data: [], error: null }) // tags pull
      .mockResolvedValueOnce({ data: [], error: null }); // tags membership

    const result = await pullRemoteChanges(TEST_USER_ID);

    expect(result.deletedNotes).toBe(1);

    // Note should be removed from IndexedDB
    const stored = await db.notes.get('deleted-on-server');
    expect(stored).toBeUndefined();
  });

  it('should return errors when notes pull fails but still process tags', async () => {
    const serverTag = {
      id: 'tag-1',
      name: 'Work',
      color: 'terracotta',
      created_at: '2026-01-10T00:00:00Z',
    };

    mockFetchAllPaginated
      .mockResolvedValueOnce({ data: [], error: new Error('notes fetch failed') }) // notes pull ERROR
      .mockResolvedValueOnce({ data: [], error: null }) // notes membership
      .mockResolvedValueOnce({ data: [serverTag], error: null }) // tags pull (succeeds)
      .mockResolvedValueOnce({ data: [{ id: 'tag-1' }], error: null }); // tags membership

    const result = await pullRemoteChanges(TEST_USER_ID);

    // Notes error should be recorded
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].entity).toBe('notes');
    expect(result.errors[0].operation).toBe('data');

    // Tags should still be pulled successfully
    expect(result.pulledTags).toBe(1);
    const db = getOfflineDb(TEST_USER_ID);
    const storedTag = await db.tags.get('tag-1');
    expect(storedTag).toBeDefined();
    expect(storedTag!.name).toBe('Work');
  });
});

describe('fullSync', () => {
  beforeEach(async () => {
    resetSyncTestState();
    await clearTestDb('notes', 'tags', 'syncQueue');
  });

  afterEach(async () => {
    clearSyncState();
    resumeSync();
    await clearTestDb('notes', 'tags', 'syncQueue');
  });

  it('should combine pull and push results', async () => {
    const serverNote = {
      id: 'full-sync-note',
      title: '',
      content: '',
      pinned: false,
      deleted_at: null,
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      ...encryptedServerFields('full-sync-note'),
    };

    // Pull phase: return 1 note
    mockFetchAllPaginated
      .mockResolvedValueOnce({ data: [serverNote], error: null }) // notes pull
      .mockResolvedValueOnce({ data: [{ id: 'full-sync-note' }], error: null }) // notes membership
      .mockResolvedValueOnce({ data: [], error: null }) // tags pull
      .mockResolvedValueOnce({ data: [], error: null }); // tags membership

    // Push phase: empty queue
    mockGetPendingSyncQueue.mockResolvedValue([]);

    const result = await fullSync(TEST_USER_ID);

    expect(result.pulled.notes).toBe(1);
    expect(result.pulled.tags).toBe(0);
    expect(result.processed).toBe(0); // empty push queue
    expect(result.pullErrors).toHaveLength(0);
  });

  it('reports sync activity until a deferred full sync completes', async () => {
    const pullGate = createDeferred<{ data: never[]; error: null }>();
    mockFetchAllPaginated
      .mockReturnValueOnce(pullGate.promise)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mockGetPendingSyncQueue.mockResolvedValue([]);

    const run = fullSync(TEST_USER_ID);
    expect(isSyncInProgress()).toBe(true);
    await vi.waitFor(() => expect(mockFetchAllPaginated).toHaveBeenCalledTimes(1));
    expect(isSyncInProgress()).toBe(true);

    pullGate.resolve({ data: [], error: null });
    await run;

    expect(isSyncInProgress()).toBe(false);
  });

  it('holds queue ownership continuously across the full-sync pull and push phases', async () => {
    const pullGate = createDeferred<{ data: never[]; error: null }>();
    const fullSyncPushGate = createDeferred<SyncQueueEntry[]>();
    const concurrentQueueGate = createDeferred<SyncQueueEntry[]>();
    const queueOrder: string[] = [];

    mockFetchAllPaginated
      .mockReturnValueOnce(pullGate.promise)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mockGetPendingSyncQueue
      .mockImplementationOnce(async () => {
        queueOrder.push('full-sync-push');
        return fullSyncPushGate.promise;
      })
      .mockImplementationOnce(async () => {
        queueOrder.push('concurrent-queue');
        return concurrentQueueGate.promise;
      });

    const fullRun = fullSync(TEST_USER_ID);
    await vi.waitFor(() => expect(mockFetchAllPaginated).toHaveBeenCalledTimes(1));

    const concurrentQueueRun = processQueue(TEST_USER_ID);
    await Promise.resolve();
    expect(mockGetPendingSyncQueue).not.toHaveBeenCalled();

    pullGate.resolve({ data: [], error: null });
    await vi.waitFor(() => expect(mockGetPendingSyncQueue).toHaveBeenCalledTimes(1));
    expect(queueOrder).toEqual(['full-sync-push']);

    // Keep the full-sync push open long enough to prove the concurrent public
    // queue run cannot enter in a lock gap between pull and push.
    await Promise.resolve();
    expect(mockGetPendingSyncQueue).toHaveBeenCalledTimes(1);

    fullSyncPushGate.resolve([]);
    await fullRun;
    await vi.waitFor(() => expect(mockGetPendingSyncQueue).toHaveBeenCalledTimes(2));
    expect(isSyncInProgress()).toBe(true);

    concurrentQueueGate.resolve([]);
    await concurrentQueueRun;

    expect(queueOrder).toEqual(['full-sync-push', 'concurrent-queue']);
    expect(isSyncInProgress()).toBe(false);
  });
});
