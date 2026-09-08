/**
 * syncEngine — processQueue behaviour, and pause/resume gating.
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

import { isPendingMutation, clearSyncState, processQueue, pauseSync, resumeSync, SYNC_BATCH_CONCURRENCY_LIMIT } from './syncEngine';
import type { ConflictInfo } from './syncEngine';
import { resolveConflict } from '../hooks/useSyncEngine';
import { getOfflineDb } from '../lib/offlineDb';
import type { LocalNote } from '../lib/offlineDb';
import { mockFrom, mockGetPendingSyncQueue, mockRemoveSyncQueueEntry, mockMarkNoteSynced, mockMarkTagSynced, mockUpdateSyncQueueEntry, mockMarkSyncQueueEntryBlocked } from '../test/syncEngineMocks';
import { TEST_USER_ID, TEST_KEYS, resetSyncTestState, clearTestDb, buildChain, createDeferred, buildEntry, encryptedServerFields } from '../test/syncEngineTestKit';

describe('processQueue behavior', () => {
  beforeEach(() => resetSyncTestState());

  afterEach(() => {
    clearSyncState();
    resumeSync();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('should return zero counts for empty queue', async () => {
    mockGetPendingSyncQueue.mockResolvedValue([]);

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.conflicts).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should return early when offline (no queue processing)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(0);
    // getPendingSyncQueue should NOT be called when offline
    expect(mockGetPendingSyncQueue).not.toHaveBeenCalled();
  });

  it('should process a create-note entry successfully', async () => {
    const importedCreatedAt = '2026-01-10T00:00:00.000Z';
    const importedUpdatedAt = '2026-01-12T00:00:00.000Z';
    const entry = buildEntry({
      clientMutationId: 'mut-create-note',
      operation: 'create',
      entityType: 'note',
      entityId: 'note-abc',
      payload: {
        title: '',
        content: '',
        pinned: false,
        createdAt: importedCreatedAt,
        updatedAt: importedUpdatedAt,
        ...encryptedServerFields('note-abc'),
      },
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);
    mockMarkNoteSynced.mockResolvedValue(undefined);

    // First chain: idempotency check (note doesn't exist on server)
    const idempotencyChain = buildChain({ data: null });
    // Second chain: insert succeeds
    const insertChain = buildChain({
      data: { id: 'note-abc', updated_at: '2026-01-15T00:00:00Z' },
    });
    mockFrom
      .mockReturnValueOnce(idempotencyChain)
      .mockReturnValueOnce(insertChain);

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      created_at: importedCreatedAt,
      display_updated_at: importedUpdatedAt,
    }));
    expect(mockRemoveSyncQueueEntry).toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-create-note',
      entry.id
    );
    expect(mockMarkNoteSynced).toHaveBeenCalledWith(
      TEST_USER_ID,
      'note-abc',
      new Date('2026-01-15T00:00:00Z'),
      'hash-note-abc'
    );
  });

  it('should process a create-tag entry successfully', async () => {
    const entry = buildEntry({
      clientMutationId: 'mut-create-tag',
      operation: 'create',
      entityType: 'tag',
      entityId: 'tag-xyz',
      payload: { name: 'Work', color: 'terracotta' },
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);
    mockMarkTagSynced.mockResolvedValue(undefined);

    // Idempotency check: tag doesn't exist
    const idempotencyChain = buildChain({ data: null });
    // Insert succeeds
    const insertChain = buildChain({
      data: { id: 'tag-xyz', created_at: '2026-01-15T00:00:00Z' },
    });
    mockFrom
      .mockReturnValueOnce(idempotencyChain)
      .mockReturnValueOnce(insertChain);

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(1);
    expect(mockMarkTagSynced).toHaveBeenCalled();
  });

  it('should process independent entities in parallel batches', async () => {
    const noteEntry = buildEntry({
      clientMutationId: 'mut-batch-note',
      operation: 'create',
      entityType: 'note',
      entityId: 'note-batch',
      payload: {
        title: '',
        content: '',
        pinned: false,
        ...encryptedServerFields('note-batch'),
      },
    });
    const tagEntry = buildEntry({
      clientMutationId: 'mut-batch-tag',
      operation: 'create',
      entityType: 'tag',
      entityId: 'tag-batch',
      payload: { name: 'Batch Tag', color: 'gold' },
    });

    mockGetPendingSyncQueue.mockResolvedValue([noteEntry, tagEntry]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);
    mockMarkNoteSynced.mockResolvedValue(undefined);
    mockMarkTagSynced.mockResolvedValue(undefined);

    const noteIdempotencyDeferred = createDeferred<{ data: null; error: null }>();
    const tagIdempotencyDeferred = createDeferred<{ data: null; error: null }>();
    const noteIdempotencyChain = buildChain();
    const tagIdempotencyChain = buildChain();
    const noteInsertChain = buildChain({
      data: { id: 'note-batch', updated_at: '2026-03-12T00:00:00Z' },
    });
    const tagInsertChain = buildChain({
      data: { id: 'tag-batch', created_at: '2026-03-12T00:00:00Z' },
    });

    noteIdempotencyChain.maybeSingle.mockReturnValue(noteIdempotencyDeferred.promise);
    tagIdempotencyChain.maybeSingle.mockReturnValue(tagIdempotencyDeferred.promise);

    let noteCalls = 0;
    let tagCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notes') {
        noteCalls += 1;
        return noteCalls === 1 ? noteIdempotencyChain : noteInsertChain;
      }
      if (table === 'tags') {
        tagCalls += 1;
        return tagCalls === 1 ? tagIdempotencyChain : tagInsertChain;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const syncPromise = processQueue(TEST_USER_ID);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(noteIdempotencyChain.maybeSingle).toHaveBeenCalledTimes(1);
    expect(tagIdempotencyChain.maybeSingle).toHaveBeenCalledTimes(1);

    noteIdempotencyDeferred.resolve({ data: null, error: null });
    tagIdempotencyDeferred.resolve({ data: null, error: null });

    const result = await syncPromise;

    expect(result.processed).toBe(2);
    expect(mockRemoveSyncQueueEntry).toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-batch-note',
      noteEntry.id
    );
    expect(mockRemoveSyncQueueEntry).toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-batch-tag',
      tagEntry.id
    );
  });

  it('should cap concurrency within a batch', async () => {
    const entries = Array.from({ length: SYNC_BATCH_CONCURRENCY_LIMIT + 2 }, (_, index) =>
      buildEntry({
        clientMutationId: `mut-batch-cap-${index}`,
        operation: 'create',
        entityType: 'note',
        entityId: `note-batch-cap-${index}`,
        payload: {
          title: '',
          content: '',
          pinned: false,
          ...encryptedServerFields(`note-batch-cap-${index}`),
        },
      })
    );

    mockGetPendingSyncQueue.mockResolvedValue(entries);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);
    mockMarkNoteSynced.mockResolvedValue(undefined);

    const deferredReads = entries.map(() =>
      createDeferred<{ data: null; error: null }>()
    );
    const pendingReads = [...deferredReads];
    // The idempotency read is what the test gates on; the insert that follows
    // it resolves immediately. Both terminate with maybeSingle, so the chain
    // tracks which verb it is completing.
    const existenceRead = vi.fn(() => pendingReads.shift()!.promise);
    const insertRead = vi.fn().mockResolvedValue({
      data: { id: 'created-note', updated_at: '2026-03-12T00:00:00Z' },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table !== 'notes') {
        throw new Error(`Unexpected table: ${table}`);
      }

      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      let isInsert = false;
      for (const method of ['select', 'update', 'delete', 'eq', 'gt', 'filter']) {
        chain[method] = vi.fn().mockReturnValue(chain);
      }
      chain.insert = vi.fn().mockImplementation(() => {
        isInsert = true;
        return chain;
      });

      const terminal = () => (isInsert ? insertRead() : existenceRead());
      chain.maybeSingle = vi.fn().mockImplementation(terminal);
      chain.single = vi.fn().mockImplementation(terminal);
      return chain;
    });

    const syncPromise = processQueue(TEST_USER_ID);
    await vi.waitFor(() => {
      expect(existenceRead).toHaveBeenCalledTimes(SYNC_BATCH_CONCURRENCY_LIMIT);
    });

    deferredReads[0].resolve({ data: null, error: null });
    await vi.waitFor(() => {
      expect(existenceRead).toHaveBeenCalledTimes(SYNC_BATCH_CONCURRENCY_LIMIT + 1);
    });

    for (const deferred of deferredReads.slice(1)) {
      deferred.resolve({ data: null, error: null });
    }

    const result = await syncPromise;
    expect(result.processed).toBe(entries.length);
    expect(insertRead).toHaveBeenCalledTimes(entries.length);
  });

  it('should increment retry count on retryable network error', async () => {
    const entry = buildEntry({
      id: 100,
      clientMutationId: 'mut-retry',
      operation: 'create',
      entityType: 'note',
      entityId: 'note-retry',
      retryCount: 0,
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);

    // Seed the DB with the entry so updateRetryCount can find it
    const db = getOfflineDb(TEST_USER_ID);
    await db.syncQueue.put({ ...entry, id: 100 });

    // Fetch reports a transport failure as a TypeError.
    const failChain = buildChain();
    failChain.maybeSingle.mockRejectedValue(new TypeError('Failed to fetch'));
    mockFrom.mockReturnValue(failChain);

    const result = await processQueue(TEST_USER_ID);

    // Should not be marked as processed (retryable)
    expect(result.processed).toBe(0);

    // Verify retry count was incremented in DB
    const updated = await db.syncQueue.get(100);
    expect(updated?.retryCount).toBe(1);
    expect(updated?.status).toBe('pending');
    expect(updated?.lastError).toContain('Failed to fetch');

    // Clean up
    await db.syncQueue.clear();
  });

  it('should block entry after max retries (5)', async () => {
    const entry = buildEntry({
      id: 200,
      clientMutationId: 'mut-exhausted',
      operation: 'update',
      entityType: 'note',
      entityId: 'note-exhausted',
      retryCount: 4, // Will become 5 after this attempt
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);

    // Seed the DB with the entry
    const db = getOfflineDb(TEST_USER_ID);
    await db.syncQueue.put({ ...entry, id: 200 });

    // Seed a local note so processNoteOperation doesn't exit early
    await db.notes.put({
      id: 'note-exhausted',
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending',
      lastSyncedAt: null,
      serverUpdatedAt: null,
      localUpdatedAt: Date.now(),
      encryptedPayload: 'ciphertext-note-exhausted',
      encryptionIv: 'iv-note-exhausted',
      encryptionVersion: 1,
      contentHash: 'hash-note-exhausted',
    });

    // Structured HTTP status, not message prose, makes this retryable.
    const failChain = buildChain();
    failChain.maybeSingle.mockRejectedValue(
      Object.assign(new Error('service unavailable'), { status: 503 })
    );
    mockFrom.mockReturnValue(failChain);

    const result = await processQueue(TEST_USER_ID);

    // Entry should remain in the queue but move to blocked state
    expect(result.failed).toBe(0);
    expect(result.blocked).toBe(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(mockUpdateSyncQueueEntry).not.toHaveBeenCalled();
    expect(mockMarkSyncQueueEntryBlocked).toHaveBeenCalledTimes(1);
    expect(mockRemoveSyncQueueEntry).not.toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-exhausted',
      200
    );

    const updated = await db.syncQueue.get(200);
    expect(updated?.retryCount).toBe(5);
    expect(updated?.status).toBe('blocked');
    expect(updated?.lastError).toContain('service unavailable');

    // Clean up
    await db.syncQueue.clear();
    await db.notes.clear();
  });

  it('should block exhausted exception paths without writing pending retry metadata first', async () => {
    const entry = buildEntry({
      id: 205,
      clientMutationId: 'mut-exception-exhausted',
      operation: 'create',
      entityType: 'note',
      entityId: 'note-exception-exhausted',
      retryCount: 4,
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
    mockMarkNoteSynced.mockResolvedValue(undefined);
    mockRemoveSyncQueueEntry.mockRejectedValue(new Error('remove failed'));

    const db = getOfflineDb(TEST_USER_ID);
    await db.syncQueue.put({ ...entry, id: 205 });

    const idempotencyChain = buildChain({ data: null });
    const insertChain = buildChain({
      data: {
        id: 'note-exception-exhausted',
        updated_at: '2026-03-10T00:00:00Z',
      },
    });
    mockFrom
      .mockReturnValueOnce(idempotencyChain)
      .mockReturnValueOnce(insertChain);

    const result = await processQueue(TEST_USER_ID);

    expect(result.failed).toBe(0);
    expect(result.blocked).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(mockUpdateSyncQueueEntry).not.toHaveBeenCalled();
    expect(mockMarkSyncQueueEntryBlocked).toHaveBeenCalledTimes(1);

    const updated = await db.syncQueue.get(205);
    expect(updated?.retryCount).toBe(5);
    expect(updated?.status).toBe('blocked');
    expect(updated?.lastError).toContain('remove failed');

    await db.syncQueue.clear();
  });

  it('should block non-retryable failures instead of dropping them', async () => {
    const entry = buildEntry({
      id: 210,
      clientMutationId: 'mut-non-retryable',
      operation: 'create',
      entityType: 'note',
      entityId: 'note-non-retryable',
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);

    const db = getOfflineDb(TEST_USER_ID);
    await db.syncQueue.put({ ...entry, id: 210 });

    const failChain = buildChain();
    failChain.maybeSingle.mockRejectedValue(
      Object.assign(new Error('permission denied'), { status: 400 })
    );
    mockFrom.mockReturnValue(failChain);

    const result = await processQueue(TEST_USER_ID);

    expect(result.failed).toBe(0);
    expect(result.blocked).toBe(1);
    expect(mockRemoveSyncQueueEntry).not.toHaveBeenCalled();

    const blocked = await db.syncQueue.get(210);
    expect(blocked?.status).toBe('blocked');
    expect(blocked?.lastError).toContain('permission denied');

    await db.syncQueue.clear();
  });

  it('does not retry a server error merely because its message says network', async () => {
    const entry = buildEntry({
      id: 211,
      clientMutationId: 'mut-message-network',
      operation: 'create',
      entityType: 'note',
      entityId: 'note-message-network',
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);

    const db = getOfflineDb(TEST_USER_ID);
    await db.syncQueue.put(entry);

    const failChain = buildChain();
    failChain.maybeSingle.mockRejectedValue(
      Object.assign(new Error('network access is forbidden by policy'), { code: '42501' })
    );
    mockFrom.mockReturnValue(failChain);

    const result = await processQueue(TEST_USER_ID);

    expect(result.failed).toBe(0);
    expect(result.blocked).toBe(1);
    expect(mockUpdateSyncQueueEntry).not.toHaveBeenCalled();
    expect((await db.syncQueue.get(211))?.status).toBe('blocked');

    await db.syncQueue.clear();
  });

  it('does not suppress a delete error whose message says 0 rows', async () => {
    const entry = buildEntry({
      id: 212,
      clientMutationId: 'mut-delete-zero-rows',
      operation: 'delete',
      entityType: 'note',
      entityId: 'note-delete-zero-rows',
      payload: {},
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);

    const db = getOfflineDb(TEST_USER_ID);
    await db.syncQueue.put(entry);
    const deleteError = Object.assign(new Error('permission denied after 0 rows'), {
      code: '42501',
    });
    mockFrom.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: deleteError }),
      })),
    });

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(0);
    expect(result.blocked).toBe(1);
    expect((await db.syncQueue.get(212))?.lastError).toContain('42501');

    await db.syncQueue.clear();
  });

  it('should block stale non-create entries older than 24 hours', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a stale update entry (>24hr old, retryCount >= 3)
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
    await db.syncQueue.put({
      clientMutationId: 'mut-stale',
      operation: 'update',
      entityType: 'note',
      entityId: 'note-stale',
      payload: {},
      createdAt: twoDaysAgo,
      retryCount: 3,
      status: 'pending',
      lastError: null,
      lastAttemptAt: null,
      blockedAt: null,
      updatedAt: twoDaysAgo,
    });

    mockGetPendingSyncQueue.mockResolvedValue([]);

    const result = await processQueue(TEST_USER_ID);

    expect(result.failed).toBe(0);
    expect(result.blocked).toBe(1);
    expect(mockRemoveSyncQueueEntry).not.toHaveBeenCalled();

    const blocked = await db.syncQueue.toArray();
    expect(blocked[0]?.status).toBe('blocked');
    expect(blocked[0]?.lastError).toContain('manual retry');

    // Clean up
    await db.syncQueue.clear();
  });

  it('should not block retrying entries before the 24-hour stale threshold', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    await db.syncQueue.put({
      clientMutationId: 'mut-not-stale-yet',
      operation: 'update',
      entityType: 'note',
      entityId: 'note-not-stale-yet',
      payload: {},
      createdAt: twoHoursAgo,
      retryCount: 4,
      status: 'pending',
      lastError: null,
      lastAttemptAt: null,
      blockedAt: null,
      updatedAt: twoHoursAgo,
    });

    mockGetPendingSyncQueue.mockResolvedValue([]);

    const result = await processQueue(TEST_USER_ID);

    expect(result.blocked).toBe(0);
    const pending = await db.syncQueue.toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe('pending');

    await db.syncQueue.clear();
  });

  it('should NOT clean up stale create entries (preserves user data)', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a stale CREATE entry (>24hr old, retryCount >= 3)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    await db.syncQueue.put({
      clientMutationId: 'mut-stale-create',
      operation: 'create', // Create operations are protected
      entityType: 'note',
      entityId: 'note-stale-create',
      payload: {},
      createdAt: twoHoursAgo,
      retryCount: 5,
      status: 'pending',
      lastError: null,
      lastAttemptAt: null,
      blockedAt: null,
      updatedAt: twoHoursAgo,
    });

    mockGetPendingSyncQueue.mockResolvedValue([]);

    await processQueue(TEST_USER_ID);

    const preserved = await db.syncQueue.toArray();
    expect(preserved).toHaveLength(1);
    expect(preserved[0]?.status).toBe('pending');
    expect(mockRemoveSyncQueueEntry).not.toHaveBeenCalled();

    // Clean up
    await db.syncQueue.clear();
  });

  it('should deduplicate concurrent processQueue calls', async () => {
    mockGetPendingSyncQueue.mockResolvedValue([]);

    // Fire two processQueue calls concurrently
    const [result1, result2] = await Promise.all([
      processQueue(TEST_USER_ID),
      processQueue(TEST_USER_ID),
    ]);

    // Both should resolve (second piggybacks on first)
    expect(result1.processed).toBe(0);
    expect(result2.processed).toBe(0);

    // getPendingSyncQueue should only be called once
    expect(mockGetPendingSyncQueue).toHaveBeenCalledTimes(1);
  });

  it('should add clientMutationId to pendingMutations during processing', async () => {
    const mutId = 'mut-self-echo-check';
    const entry = buildEntry({
      clientMutationId: mutId,
      operation: 'create',
      entityType: 'note',
      entityId: 'note-echo',
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);
    mockMarkNoteSynced.mockResolvedValue(undefined);

    // Make note creation succeed
    const idempotencyChain = buildChain({ data: null });
    const insertChain = buildChain({
      data: { id: 'note-echo', updated_at: '2026-01-15T00:00:00Z' },
    });
    mockFrom
      .mockReturnValueOnce(idempotencyChain)
      .mockReturnValueOnce(insertChain);

    await processQueue(TEST_USER_ID);

    // The mutation ID should have been added during processing.
    // After the 2s timeout it gets removed, but immediately after
    // processQueue returns it should still be pending.
    expect(isPendingMutation(mutId)).toBe(true);
  });

  it('reapplies the selected server version after an already-dequeued stale update', async () => {
    await clearTestDb('notes', 'noteTags', 'syncQueue');
    const db = getOfflineDb(TEST_USER_ID);
    const now = Date.now();
    const noteId = 'note-in-flight-conflict';
    const localNote: LocalNote = {
      id: noteId,
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: now - 10_000,
      updatedAt: now,
      syncStatus: 'conflict',
      lastSyncedAt: now - 20_000,
      serverUpdatedAt: now - 20_000,
      localUpdatedAt: now,
      encryptedPayload: 'local-current-ciphertext',
      encryptionIv: 'local-current-iv',
      encryptionVersion: 1,
      contentHash: 'local-current-hash',
    };
    const staleEntry = buildEntry({
      id: 1200,
      clientMutationId: 'already-dequeued-stale-update',
      operation: 'update',
      entityType: 'note',
      entityId: noteId,
      payload: {
        title: '',
        content: '',
        encrypted_payload: 'stale-ciphertext',
        encryption_iv: 'stale-iv',
        encryption_version: 1,
        content_hash: 'stale-hash',
      },
    });
    await db.notes.put(localNote);
    await db.syncQueue.put(staleEntry);
    mockGetPendingSyncQueue.mockResolvedValue([staleEntry]);

    const staleRead = buildChain({ data: null });
    const staleWrite = buildChain();
    const staleWriteDeferred = createDeferred<{
      data: { updated_at: string; content_hash: string };
      error: null;
    }>();
    staleWrite.maybeSingle.mockReturnValue(staleWriteDeferred.promise);
    const selectedWrite = buildChain({
      data: { updated_at: '2026-09-07T18:03:00.000Z' },
    });
    mockFrom
      .mockReturnValueOnce(staleRead)
      .mockReturnValueOnce(staleWrite)
      .mockReturnValueOnce(selectedWrite);

    const queueRun = processQueue(TEST_USER_ID);
    await vi.waitFor(() => expect(staleWrite.update).toHaveBeenCalledTimes(1));

    const conflict: ConflictInfo = {
      entityType: 'note',
      entityId: noteId,
      localVersion: localNote,
      serverVersion: {
        id: noteId,
        user_id: TEST_USER_ID,
        title: '',
        content: '',
        pinned: true,
        deleted_at: null,
        created_at: new Date(localNote.createdAt).toISOString(),
        display_updated_at: '2026-09-07T17:59:00.000Z',
        updated_at: '2026-09-07T18:00:00.000Z',
        encrypted_payload: 'selected-server-ciphertext',
        encryption_iv: 'selected-server-iv',
        encryption_version: 1,
        content_hash: 'selected-server-hash',
      },
    };
    let resolutionSettled = false;
    const resolution = resolveConflict(TEST_USER_ID, conflict, 'server', TEST_KEYS)
      .then(() => { resolutionSettled = true; });

    await Promise.resolve();
    expect(resolutionSettled).toBe(false);
    expect(selectedWrite.update).not.toHaveBeenCalled();

    staleWriteDeferred.resolve({
      data: {
        updated_at: '2026-09-07T18:02:00.000Z',
        content_hash: 'stale-hash',
      },
      error: null,
    });
    await queueRun;
    await resolution;

    expect(staleWrite.update).toHaveBeenCalledWith(expect.objectContaining({
      content_hash: 'stale-hash',
    }));
    expect(selectedWrite.update).toHaveBeenCalledWith(expect.objectContaining({
      pinned: true,
      encrypted_payload: 'selected-server-ciphertext',
      content_hash: 'selected-server-hash',
    }));
    expect(await db.syncQueue
      .filter((entry) => entry.entityType === 'note' && entry.entityId === noteId)
      .count()).toBe(0);
    expect(await db.notes.get(noteId)).toMatchObject({
      pinned: true,
      syncStatus: 'synced',
      contentHash: 'selected-server-hash',
      confirmedContentHash: 'selected-server-hash',
    });

    await clearTestDb('notes', 'noteTags', 'syncQueue');
  });
});

describe('pauseSync / resumeSync', () => {
  beforeEach(() => resetSyncTestState());

  afterEach(() => {
    clearSyncState();
    resumeSync();
  });

  it('should gate processQueue while paused and release on resume', async () => {
    mockGetPendingSyncQueue.mockResolvedValue([]);

    pauseSync();

    // Start processQueue — it should wait
    let resolved = false;
    const promise = processQueue(TEST_USER_ID).then((r) => {
      resolved = true;
      return r;
    });

    // Give it a tick to confirm it's waiting
    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // Resume should unblock
    resumeSync();
    const result = await promise;

    expect(resolved).toBe(true);
    expect(result.processed).toBe(0);
  });

  it('should be idempotent (double pause does not break resume)', async () => {
    mockGetPendingSyncQueue.mockResolvedValue([]);

    pauseSync();
    pauseSync(); // second pause should be no-op

    let resolved = false;
    const promise = processQueue(TEST_USER_ID).then((r) => {
      resolved = true;
      return r;
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    resumeSync(); // single resume should unblock
    await promise;
    expect(resolved).toBe(true);
  });

  it('should no-op when resuming without pause', () => {
    // Should not throw
    expect(() => resumeSync()).not.toThrow();
  });
});
