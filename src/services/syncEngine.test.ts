/**
 * syncEngine.test.ts — Sync Engine Tests
 *
 * Unit + behavior tests for the offline sync engine.
 *
 * Existing tests (22): pure-logic state management, mapSyncOutcome,
 * and server timestamp authority assertions.
 *
 * New behavior tests (18): processQueue with mocked Supabase,
 * pauseSync/resumeSync gating, conflict detection, pullRemoteChanges
 * with IndexedDB integration.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import Dexie from 'dexie';

// --- Hoisted mock functions (created before vi.mock factories execute) ---
const {
  mockFrom,
  mockFetchAllPaginated,
  mockGetPendingSyncQueue,
  mockRemoveSyncQueueEntry,
  mockMarkNoteSynced,
  mockMarkTagSynced,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockFetchAllPaginated: vi.fn(),
  mockGetPendingSyncQueue: vi.fn(),
  mockRemoveSyncQueueEntry: vi.fn(),
  mockMarkNoteSynced: vi.fn(),
  mockMarkTagSynced: vi.fn(),
}));

// --- Module-level mocks ---
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  fetchAllPaginated: (...args: unknown[]) => mockFetchAllPaginated(...args),
}));

vi.mock('./offlineNotes', () => ({
  getPendingSyncQueue: (...args: unknown[]) => mockGetPendingSyncQueue(...args),
  removeSyncQueueEntry: (...args: unknown[]) => mockRemoveSyncQueueEntry(...args),
  markNoteSynced: (...args: unknown[]) => mockMarkNoteSynced(...args),
}));

vi.mock('./offlineTags', () => ({
  markTagSynced: (...args: unknown[]) => mockMarkTagSynced(...args),
}));

// --- Imports (after mocks so syncEngine receives mocked dependencies) ---
import {
  isPendingMutation,
  addPendingMutation,
  removePendingMutation,
  clearSyncState,
  isSyncInProgress,
  processQueue,
  pullRemoteChanges,
  fullSync,
  pauseSync,
  resumeSync,
  setConflictHandler,
  type FullSyncResult,
  type PullError,
  type ConflictInfo,
} from './syncEngine';
import { mapSyncOutcome } from '../hooks/useSyncEngine';
import { getOfflineDb, type SyncQueueEntry } from '../lib/offlineDb';

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────

const TEST_USER_ID = 'test-user-sync';

/** Build a chainable mock simulating supabase.from(table).method()...terminal() */
function buildChain(result: { data?: unknown; error?: unknown } = {}) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'gt', 'filter']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  chain.single = vi.fn().mockResolvedValue(resolved);
  return chain;
}

/** Build a SyncQueueEntry for testing */
function buildEntry(overrides: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    id: 1,
    clientMutationId: 'mut-' + Math.random().toString(36).slice(2, 8),
    operation: 'create',
    entityType: 'note',
    entityId: 'note-1',
    payload: {
      title: 'Test Note',
      content: '<p>Hello</p>',
      pinned: false,
      encrypted_payload: null,
      encryption_iv: null,
      encryption_version: null,
      content_hash: null,
    },
    createdAt: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

// --- Helper: build a FullSyncResult with sensible defaults ---
function buildResult(overrides: Partial<FullSyncResult> = {}): FullSyncResult {
  return {
    processed: 0,
    failed: 0,
    conflicts: 0,
    errors: [],
    pulled: { notes: 0, tags: 0 },
    deleted: { notes: 0, tags: 0 },
    pullErrors: [],
    ...overrides,
  };
}

function dataError(entity: 'notes' | 'tags', msg = 'fetch failed'): PullError {
  return { entity, operation: 'data', error: new Error(msg) };
}

function membershipError(entity: 'notes' | 'tags', msg = 'membership failed'): PullError {
  return { entity, operation: 'membership', error: new Error(msg) };
}

// ══════════════════════════════════════════════════
// EXISTING TESTS (22 cases — unchanged)
// ══════════════════════════════════════════════════

describe('syncEngine', () => {
  beforeEach(() => {
    // Clear state before each test
    clearSyncState();
  });

  afterEach(() => {
    // Clean up after each test
    clearSyncState();
  });

  describe('pending mutations (self-ignore)', () => {
    it('should track pending mutations', () => {
      const mutationId = 'test-mutation-id';

      expect(isPendingMutation(mutationId)).toBe(false);

      addPendingMutation(mutationId);
      expect(isPendingMutation(mutationId)).toBe(true);

      removePendingMutation(mutationId);
      expect(isPendingMutation(mutationId)).toBe(false);
    });

    it('should handle multiple mutations', () => {
      const id1 = 'mutation-1';
      const id2 = 'mutation-2';
      const id3 = 'mutation-3';

      addPendingMutation(id1);
      addPendingMutation(id2);
      addPendingMutation(id3);

      expect(isPendingMutation(id1)).toBe(true);
      expect(isPendingMutation(id2)).toBe(true);
      expect(isPendingMutation(id3)).toBe(true);

      removePendingMutation(id2);
      expect(isPendingMutation(id1)).toBe(true);
      expect(isPendingMutation(id2)).toBe(false);
      expect(isPendingMutation(id3)).toBe(true);
    });

    it('should clear all mutations on clearSyncState', () => {
      addPendingMutation('mutation-1');
      addPendingMutation('mutation-2');

      expect(isPendingMutation('mutation-1')).toBe(true);
      expect(isPendingMutation('mutation-2')).toBe(true);

      clearSyncState();

      expect(isPendingMutation('mutation-1')).toBe(false);
      expect(isPendingMutation('mutation-2')).toBe(false);
    });
  });

  describe('sync state', () => {
    it('should report sync not in progress initially', () => {
      expect(isSyncInProgress()).toBe(false);
    });

    it('should reset sync state on clearSyncState', () => {
      clearSyncState();
      expect(isSyncInProgress()).toBe(false);
    });
  });

  describe('timeout cleanup', () => {
    it('should clear pending timeouts on clearSyncState', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      clearSyncState();
      clearSyncState();

      expect(clearTimeoutSpy).toBeDefined();

      clearTimeoutSpy.mockRestore();
    });
  });
});

describe('mapSyncOutcome', () => {
  // --- Happy path ---
  it('returns "ok" when no errors and no failures', () => {
    const result = buildResult({ pulled: { notes: 5, tags: 2 } });
    expect(mapSyncOutcome(result)).toBe('ok');
  });

  it('returns "ok" when zero pulled but no errors', () => {
    const result = buildResult();
    expect(mapSyncOutcome(result)).toBe('ok');
  });

  // --- Full error (both entity data pulls fail with zero data) ---
  it('returns "error" when both notes and tags data pulls fail with zero data', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), dataError('tags')],
      pulled: { notes: 0, tags: 0 },
    });
    expect(mapSyncOutcome(result)).toBe('error');
  });

  // --- Partial success: both data errors but some data was applied ---
  it('returns "partial" when both data pulls error but some notes were applied', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), dataError('tags')],
      pulled: { notes: 50, tags: 0 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" when both data pulls error but some tags were applied', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), dataError('tags')],
      pulled: { notes: 0, tags: 3 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Single entity data pull failure ---
  it('returns "partial" when only notes data pull fails', () => {
    const result = buildResult({
      pullErrors: [dataError('notes')],
      pulled: { notes: 0, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" when only tags data pull fails', () => {
    const result = buildResult({
      pullErrors: [dataError('tags')],
      pulled: { notes: 10, tags: 0 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Push failures ---
  it('returns "partial" when push has failures but pull succeeded', () => {
    const result = buildResult({
      failed: 2,
      pulled: { notes: 10, tags: 3 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Membership query failures ---
  it('returns "partial" when only membership queries fail', () => {
    const result = buildResult({
      pullErrors: [membershipError('notes')],
      pulled: { notes: 10, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" when both membership queries fail but data pulls succeed', () => {
    const result = buildResult({
      pullErrors: [membershipError('notes'), membershipError('tags')],
      pulled: { notes: 10, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  it('returns "partial" not "error" for membership-only errors (even with zero pulled)', () => {
    const result = buildResult({
      pullErrors: [membershipError('notes'), membershipError('tags')],
      pulled: { notes: 0, tags: 0 },
    });
    // Membership failures don't affect data freshness, so not 'error'
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Mixed errors ---
  it('returns "partial" when data error + membership error on different entities', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), membershipError('tags')],
      pulled: { notes: 0, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // --- Pagination partial: mid-pagination error with applied data ---
  it('returns "partial" for mid-pagination failure on both entities with partial data', () => {
    const result = buildResult({
      pullErrors: [
        dataError('notes', 'page 4 of 5 failed'),
        dataError('tags', 'page 2 of 3 failed'),
      ],
      pulled: { notes: 3000, tags: 1000 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });
});

describe('server timestamp authority', () => {
  // These tests document the contract that push paths must NOT send client
  // timestamps. The server-side trigger (notes_updated_at_trigger) is the
  // sole authority. We verify the source code does not contain client-time
  // assignments in note update payloads.

  it('syncEngine processNoteMutation update path does not send updated_at', async () => {
    // Read the source and verify no client timestamp in the update payload.
    // This is a static assertion — if someone adds `updated_at: new Date()`
    // back, this test should fail.
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, './syncEngine.ts'),
      'utf-8'
    );

    // Find the update case payload (between .update({ and }) for notes)
    // The pattern: .update({ ... updated_at: new Date() ... })
    // Should NOT match because we removed it.
    const updatePayloadPattern = /\.update\(\{[^}]*updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(updatePayloadPattern);
  });

  it('notes.ts updateNote does not send updated_at', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, './notes.ts'),
      'utf-8'
    );

    const updatePayloadPattern = /\.update\(\{[^}]*updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(updatePayloadPattern);
  });

  it('useSyncEngine resolveConflict does not send updated_at', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, '../hooks/useSyncEngine.ts'),
      'utf-8'
    );

    const updatePayloadPattern = /\.update\(\{[^}]*updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(updatePayloadPattern);
  });
});

// ══════════════════════════════════════════════════
// NEW BEHAVIOR TESTS (18 cases)
// ══════════════════════════════════════════════════

describe('processQueue behavior', () => {
  beforeEach(() => {
    clearSyncState();
    vi.clearAllMocks();
    // Ensure we're "online" for most tests
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    clearSyncState();
    resumeSync(); // clean up pause state if any test set it
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
    const entry = buildEntry({
      clientMutationId: 'mut-create-note',
      operation: 'create',
      entityType: 'note',
      entityId: 'note-abc',
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
    expect(mockRemoveSyncQueueEntry).toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-create-note',
      entry.id
    );
    expect(mockMarkNoteSynced).toHaveBeenCalledWith(
      TEST_USER_ID,
      'note-abc',
      new Date('2026-01-15T00:00:00Z')
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

    // Make the idempotency check throw a network error (retryable)
    const failChain = buildChain();
    failChain.maybeSingle.mockRejectedValue(new Error('network timeout'));
    mockFrom.mockReturnValue(failChain);

    const result = await processQueue(TEST_USER_ID);

    // Should not be marked as processed (retryable)
    expect(result.processed).toBe(0);

    // Verify retry count was incremented in DB
    const updated = await db.syncQueue.get(100);
    expect(updated?.retryCount).toBe(1);

    // Clean up
    await db.syncQueue.clear();
  });

  it('should remove entry after max retries (5)', async () => {
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
      title: 'Test',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending',
      lastSyncedAt: null,
      serverUpdatedAt: null,
      localUpdatedAt: Date.now(),
      encryptedPayload: null,
      encryptionIv: null,
      encryptionVersion: null,
      contentHash: null,
    });

    // Make server call throw a retryable error
    const failChain = buildChain();
    failChain.maybeSingle.mockRejectedValue(new Error('fetch timeout'));
    mockFrom.mockReturnValue(failChain);

    const result = await processQueue(TEST_USER_ID);

    // Entry should be removed from queue after exceeding max retries
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(mockRemoveSyncQueueEntry).toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-exhausted',
      200
    );

    // Clean up
    await db.syncQueue.clear();
    await db.notes.clear();
  });

  it('should clean up stale non-create entries older than 1 hour', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a stale update entry (>1hr old, retryCount >= 3)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    await db.syncQueue.put({
      clientMutationId: 'mut-stale',
      operation: 'update',
      entityType: 'note',
      entityId: 'note-stale',
      payload: {},
      createdAt: twoHoursAgo,
      retryCount: 3,
    });

    mockGetPendingSyncQueue.mockResolvedValue([]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);

    await processQueue(TEST_USER_ID);

    // Stale entry should have been cleaned up
    expect(mockRemoveSyncQueueEntry).toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-stale',
      expect.any(Number)
    );

    // Clean up
    await db.syncQueue.clear();
  });

  it('should NOT clean up stale create entries (preserves user data)', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a stale CREATE entry (>1hr old, retryCount >= 3)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    await db.syncQueue.put({
      clientMutationId: 'mut-stale-create',
      operation: 'create', // Create operations are protected
      entityType: 'note',
      entityId: 'note-stale-create',
      payload: {},
      createdAt: twoHoursAgo,
      retryCount: 5,
    });

    mockGetPendingSyncQueue.mockResolvedValue([]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);

    await processQueue(TEST_USER_ID);

    // Create entries should NOT be cleaned up by stale cleanup
    expect(mockRemoveSyncQueueEntry).not.toHaveBeenCalledWith(
      TEST_USER_ID,
      'mut-stale-create',
      expect.any(Number)
    );

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
});

describe('pauseSync / resumeSync', () => {
  beforeEach(() => {
    clearSyncState();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

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

describe('conflict detection via processQueue', () => {
  beforeEach(async () => {
    clearSyncState();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    clearSyncState();
    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.syncQueue.clear();
  });

  it('should trigger conflict handler when HMAC content_hash differs', async () => {
    const noteId = 'note-conflict';
    const db = getOfflineDb(TEST_USER_ID);

    // Seed local note with a content hash
    await db.notes.put({
      id: noteId,
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending',
      lastSyncedAt: Date.now() - 10000, // synced 10s ago
      serverUpdatedAt: Date.now() - 10000,
      localUpdatedAt: Date.now(),
      encryptedPayload: 'encrypted-local',
      encryptionIv: 'iv-local',
      encryptionVersion: 1,
      contentHash: 'local-hmac-hash', // different from server
    });

    const entry = buildEntry({
      clientMutationId: 'mut-conflict',
      operation: 'update',
      entityType: 'note',
      entityId: noteId,
      payload: {
        title: '',
        content: '',
        encrypted_payload: 'encrypted-local',
        encryption_iv: 'iv-local',
        encryption_version: 1,
        content_hash: 'local-hmac-hash',
      },
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);

    // Server note has a DIFFERENT content_hash and newer timestamp
    const serverChain = buildChain({
      data: {
        id: noteId,
        title: '',
        content: '',
        updated_at: new Date(Date.now() + 5000).toISOString(), // newer than lastSyncedAt
        encrypted_payload: 'encrypted-server',
        encryption_iv: 'iv-server',
        encryption_version: 1,
        content_hash: 'server-hmac-hash', // DIFFERENT from local
      },
    });
    mockFrom.mockReturnValue(serverChain);

    // Register conflict handler
    const conflicts: ConflictInfo[] = [];
    setConflictHandler((c) => conflicts.push(c));

    await processQueue(TEST_USER_ID);

    // Conflict should have been detected
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].entityType).toBe('note');
    expect(conflicts[0].entityId).toBe(noteId);

    // Local note should be marked as conflict
    const localNote = await db.notes.get(noteId);
    expect(localNote?.syncStatus).toBe('conflict');
  });

  it('should skip conflict when content_hash matches (timestamp drift only)', async () => {
    const noteId = 'note-no-conflict';
    const db = getOfflineDb(TEST_USER_ID);
    const now = Date.now();
    const sameHash = 'identical-hmac-hash';

    // Seed local note
    await db.notes.put({
      id: noteId,
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
      lastSyncedAt: now - 10000,
      serverUpdatedAt: now - 10000,
      localUpdatedAt: now,
      encryptedPayload: 'encrypted',
      encryptionIv: 'iv',
      encryptionVersion: 1,
      contentHash: sameHash,
    });

    const entry = buildEntry({
      clientMutationId: 'mut-no-conflict',
      operation: 'update',
      entityType: 'note',
      entityId: noteId,
      payload: {
        title: '',
        content: '',
        encrypted_payload: 'encrypted',
        encryption_iv: 'iv',
        encryption_version: 1,
        content_hash: sameHash,
      },
    });
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
    mockRemoveSyncQueueEntry.mockResolvedValue(undefined);
    mockMarkNoteSynced.mockResolvedValue(undefined);

    // Server has SAME content_hash but newer timestamp
    // First call: conflict check (select *)
    const checkChain = buildChain({
      data: {
        id: noteId,
        title: '',
        content: '',
        updated_at: new Date(now + 5000).toISOString(),
        encrypted_payload: 'encrypted',
        encryption_iv: 'iv',
        encryption_version: 1,
        content_hash: sameHash, // SAME as local
      },
    });
    // Second call: actual update
    const updateChain = buildChain({
      data: { id: noteId, updated_at: new Date(now + 5000).toISOString() },
    });
    mockFrom
      .mockReturnValueOnce(checkChain) // select * for conflict check
      .mockReturnValueOnce(updateChain); // update

    const conflicts: ConflictInfo[] = [];
    setConflictHandler((c) => conflicts.push(c));

    await processQueue(TEST_USER_ID);

    // No conflict should be raised
    expect(conflicts).toHaveLength(0);
    // Entry should be processed normally
    expect(mockRemoveSyncQueueEntry).toHaveBeenCalled();
  });
});

describe('pullRemoteChanges behavior', () => {
  beforeEach(async () => {
    clearSyncState();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.tags.clear();
    await db.noteTags.clear();
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    clearSyncState();
    resumeSync();
    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.tags.clear();
    await db.noteTags.clear();
    await db.syncQueue.clear();
  });

  it('should apply pulled notes to IndexedDB', async () => {
    const serverNote = {
      id: 'pulled-note-1',
      title: 'Server Note',
      content: '<p>From server</p>',
      pinned: false,
      deleted_at: null,
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      encrypted_payload: null,
      encryption_iv: null,
      encryption_version: null,
      content_hash: null,
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
    expect(stored!.title).toBe('Server Note');
    expect(stored!.syncStatus).toBe('synced');
  });

  it('should skip notes with pending syncStatus', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a local note with pending changes
    await db.notes.put({
      id: 'pending-note',
      userId: TEST_USER_ID,
      title: 'Local Edit',
      content: '<p>My local changes</p>',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending', // <-- pending
      lastSyncedAt: null,
      serverUpdatedAt: null,
      localUpdatedAt: Date.now(),
      encryptedPayload: null,
      encryptionIv: null,
      encryptionVersion: null,
      contentHash: null,
    });

    const serverNote = {
      id: 'pending-note',
      title: 'Server Version',
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
      .mockResolvedValueOnce({ data: [serverNote], error: null }) // notes pull
      .mockResolvedValueOnce({ data: [{ id: 'pending-note' }], error: null }) // notes membership
      .mockResolvedValueOnce({ data: [], error: null }) // tags pull
      .mockResolvedValueOnce({ data: [], error: null }); // tags membership

    const result = await pullRemoteChanges(TEST_USER_ID);

    // Note should be skipped (not counted as pulled)
    expect(result.pulledNotes).toBe(0);

    // Local version should be preserved
    const stored = await db.notes.get('pending-note');
    expect(stored!.title).toBe('Local Edit');
    expect(stored!.syncStatus).toBe('pending');
  });

  it('should delete synced-only notes missing from server membership', async () => {
    const db = getOfflineDb(TEST_USER_ID);

    // Seed a synced note that no longer exists on server
    await db.notes.put({
      id: 'deleted-on-server',
      userId: TEST_USER_ID,
      title: 'Gone',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'synced',
      lastSyncedAt: Date.now(),
      serverUpdatedAt: Date.now(),
      localUpdatedAt: Date.now(),
      encryptedPayload: null,
      encryptionIv: null,
      encryptionVersion: null,
      contentHash: null,
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
    clearSyncState();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.tags.clear();
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    clearSyncState();
    resumeSync();
    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.tags.clear();
    await db.syncQueue.clear();
  });

  it('should combine pull and push results', async () => {
    const serverNote = {
      id: 'full-sync-note',
      title: 'Pulled',
      content: '',
      pinned: false,
      deleted_at: null,
      created_at: '2026-01-10T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      encrypted_payload: null,
      encryption_iv: null,
      encryption_version: null,
      content_hash: null,
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
});

// File-level cleanup: close and delete the shared test DB after all tests
afterAll(async () => {
  const db = getOfflineDb(TEST_USER_ID);
  db.close();
  await Dexie.delete(db.name);
});
