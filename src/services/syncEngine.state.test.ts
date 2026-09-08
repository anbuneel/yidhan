/**
 * syncEngine — state, outcome mapping, timestamp authority and queue batching.
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

import { isPendingMutation, addPendingMutation, removePendingMutation, clearSyncState, isSyncInProgress, buildQueueBatches, invalidateSyncPullCursors } from './syncEngine';
import { mapSyncOutcome } from '../hooks/useSyncEngine';
import { MIGRATION_SYNC_SENTINEL, getOfflineDb } from '../lib/offlineDb';
import { TEST_USER_ID, buildEntry, buildResult, dataError, membershipError } from '../test/syncEngineTestKit';

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
    it('should safely handle clearSyncState when no timeouts are pending', () => {
      // clearSyncState iterates pendingTimeouts and calls clearTimeout for each.
      // When no sync has run, pendingTimeouts is empty — verify no-throw behavior.
      expect(() => {
        clearSyncState();
        clearSyncState(); // idempotent — safe to call multiple times
      }).not.toThrow();
    });
  });

  describe('invalidateSyncPullCursors', () => {
    it('resets synced note and tag cursors to the migration sentinel', async () => {
      const db = getOfflineDb(TEST_USER_ID);
      await db.notes.put({
        id: 'note-synced',
        userId: TEST_USER_ID,
        title: '',
        content: '',
        pinned: false,
        deletedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'synced',
        lastSyncedAt: 1234,
        serverUpdatedAt: 1234,
        localUpdatedAt: 1234,
        encryptedPayload: 'ciphertext-note-synced',
        encryptionIv: 'iv-note-synced',
        encryptionVersion: 1,
        contentHash: 'hash-note-synced',
      });
      await db.notes.put({
        id: 'note-pending',
        userId: TEST_USER_ID,
        title: '',
        content: '',
        pinned: false,
        deletedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'pending',
        lastSyncedAt: 9999,
        serverUpdatedAt: 9999,
        localUpdatedAt: 9999,
        encryptedPayload: 'ciphertext-note-pending',
        encryptionIv: 'iv-note-pending',
        encryptionVersion: 1,
        contentHash: 'hash-note-pending',
      });
      await db.tags.put({
        id: 'tag-synced',
        userId: TEST_USER_ID,
        name: 'Tag',
        color: 'gold',
        createdAt: Date.now(),
        syncStatus: 'synced',
        lastSyncedAt: 5678,
        serverUpdatedAt: 5678,
        localUpdatedAt: 5678,
      });

      await invalidateSyncPullCursors(TEST_USER_ID);

      const syncedNote = await db.notes.get('note-synced');
      const pendingNote = await db.notes.get('note-pending');
      const syncedTag = await db.tags.get('tag-synced');

      expect(syncedNote?.lastSyncedAt).toBe(MIGRATION_SYNC_SENTINEL);
      expect(pendingNote?.lastSyncedAt).toBe(9999);
      expect(syncedTag?.lastSyncedAt).toBe(MIGRATION_SYNC_SENTINEL);
    });
  });
});

describe('mapSyncOutcome', () => {
  // Happy path
  it('returns "ok" when no errors and no failures', () => {
    const result = buildResult({ pulled: { notes: 5, tags: 2 } });
    expect(mapSyncOutcome(result)).toBe('ok');
  });

  it('returns "ok" when zero pulled but no errors', () => {
    const result = buildResult();
    expect(mapSyncOutcome(result)).toBe('ok');
  });

  // Full error (both entity data pulls fail with zero data)
  it('returns "error" when both notes and tags data pulls fail with zero data', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), dataError('tags')],
      pulled: { notes: 0, tags: 0 },
    });
    expect(mapSyncOutcome(result)).toBe('error');
  });

  // Partial success: both data errors but some data was applied
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

  // Single entity data pull failure
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

  // Push failures
  it('returns "partial" when push has failures but pull succeeded', () => {
    const result = buildResult({
      failed: 2,
      pulled: { notes: 10, tags: 3 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // Membership query failures
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

  // Mixed errors
  it('returns "partial" when data error + membership error on different entities', () => {
    const result = buildResult({
      pullErrors: [dataError('notes'), membershipError('tags')],
      pulled: { notes: 0, tags: 5 },
    });
    expect(mapSyncOutcome(result)).toBe('partial');
  });

  // Pagination partial: mid-pagination error with applied data
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
  // timestamps into server-authoritative sync columns. The server-side trigger
  // owns updated_at and advances display_updated_at on ordinary updates.

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
    const displayPayloadPattern = /\.update\(\{[^}]*display_updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(displayPayloadPattern);
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
    const displayPayloadPattern = /\.update\(\{[^}]*display_updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(displayPayloadPattern);
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
    const displayPayloadPattern = /\.update\(\{[^}]*display_updated_at:\s*new Date\(\)/s;
    expect(source).not.toMatch(displayPayloadPattern);
  });
});

describe('buildQueueBatches', () => {
  it('starts a new batch when the same entity appears twice', () => {
    const first = buildEntry({ entityType: 'note', entityId: 'note-a', operation: 'update' });
    const second = buildEntry({ entityType: 'note', entityId: 'note-a', operation: 'pin' });

    const batches = buildQueueBatches([first, second]);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual([first]);
    expect(batches[1]).toEqual([second]);
  });

  it('uses noteTag operations as a dependency barrier', () => {
    const note = buildEntry({ entityType: 'note', entityId: 'note-a', operation: 'update' });
    const noteTag = buildEntry({ entityType: 'noteTag', entityId: 'note-a:tag-a', operation: 'add_tag' });
    const tag = buildEntry({ entityType: 'tag', entityId: 'tag-a', operation: 'update' });

    const batches = buildQueueBatches([note, noteTag, tag]);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toEqual([note]);
    expect(batches[1]).toEqual([noteTag]);
    expect(batches[2]).toEqual([tag]);
  });

  it('allows independent noteTag operations to share a batch', () => {
    const first = buildEntry({ entityType: 'noteTag', entityId: 'note-a:tag-a', operation: 'add_tag' });
    const second = buildEntry({ entityType: 'noteTag', entityId: 'note-b:tag-b', operation: 'remove_tag' });

    const batches = buildQueueBatches([first, second]);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([first, second]);
  });
});
