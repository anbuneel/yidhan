/**
 * syncEngine — conflict detection, and recovery from permanently blocked entries.
 *
 * Split from the former 2,386-line syncEngine.test.ts. Module mocks live in
 * src/test/syncEngineMocks.ts; builders and the reset helper in
 * src/test/syncEngineTestKit.ts.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import Dexie from 'dexie';

vi.mock('@capacitor/core', async () => (await import('../test/syncEngineMocks')).capacitorMock);
vi.mock('../lib/supabase', async () => (await import('../test/syncEngineMocks')).supabaseMock);
vi.mock('./offlineNotes', async () => (await import('../test/syncEngineMocks')).offlineNotesMock);
vi.mock('./offlineTags', async () => (await import('../test/syncEngineMocks')).offlineTagsMock);
vi.mock('../lib/encryption', async () => (await import('../test/syncEngineMocks')).encryptionMock);
vi.mock('./encryptedNotes', async () => (await import('../test/syncEngineMocks')).encryptedNotesMock);
vi.mock('./noteTagSync', async () => (await import('../test/syncEngineMocks')).noteTagSyncMock);

import { clearSyncState, processQueue, setConflictHandler } from './syncEngine';
import type { ConflictInfo } from './syncEngine';
import { getOfflineDb } from '../lib/offlineDb';
import type { SyncQueueEntry } from '../lib/offlineDb';
import { mockFrom, mockGetPendingSyncQueue, mockRemoveSyncQueueEntry, mockMarkNoteSynced, mockUpdateSyncQueueEntry, mockMarkSyncQueueEntryBlocked, mockQueueSyncOperation, mockClearQueuedNoteCreates } from '../test/syncEngineMocks';
import { TEST_USER_ID, resetSyncTestState, clearTestDb, buildChain, buildEntry, encryptedServerFields } from '../test/syncEngineTestKit';

describe('conflict detection via processQueue', () => {
  beforeEach(async () => {
    resetSyncTestState();
    await clearTestDb('notes', 'syncQueue');
  });

  afterEach(async () => {
    clearSyncState();
    await clearTestDb('notes', 'syncQueue');
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

    const result = await processQueue(TEST_USER_ID);

    // Conflict should have been detected
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].entityType).toBe('note');
    expect(conflicts[0].entityId).toBe(noteId);
    expect(result.conflicts).toBe(1);
    expect(result.processed).toBe(0);

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
      data: { id: noteId, updated_at: new Date(now + 5000).toISOString(), content_hash: sameHash },
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


describe('syncEngine — recovery from permanently blocked entries', () => {
  beforeEach(async () => {
    resetSyncTestState();
    await clearTestDb('notes', 'tags', 'noteTags', 'syncQueue');
  });

  afterEach(() => {
    clearSyncState();
  });

  /**
   * Chain mock that answers based on the write verb used, so a test can make
   * an UPDATE match zero rows while the recovery INSERT still succeeds.
   *
   * Each supabase.from() call gets a fresh builder, as the real client does —
   * a shared one would carry the previous call's verb into the next query and
   * answer a plain read with the previous write's result.
   */
  function buildVerbAwareChain(
    results: Partial<Record<'select' | 'insert' | 'update' | 'delete', { data?: unknown; error?: unknown }>>
  ) {
    const calls = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const factory = () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      let verb: 'select' | 'insert' | 'update' | 'delete' = 'select';

      for (const m of ['eq', 'gt', 'filter'] as const) {
        chain[m] = vi.fn().mockReturnValue(chain);
      }
      chain.select = vi.fn().mockImplementation((...args: unknown[]) => {
        calls.select(...args);
        return chain;
      });
      for (const m of ['insert', 'update', 'delete'] as const) {
        chain[m] = vi.fn().mockImplementation((...args: unknown[]) => {
          calls[m](...args);
          verb = m;
          return chain;
        });
      }

      const settle = async () => {
        const r = results[verb] ?? { data: null, error: null };
        return { data: r.data ?? null, error: r.error ?? null };
      };

      chain.maybeSingle = vi.fn().mockImplementation(settle);
      chain.single = vi.fn().mockImplementation(settle);
      return chain;
    };

    return { factory, calls };
  }

  /** Persist the entry so status writes land somewhere, and feed the queue. */
  async function enqueue(entry: SyncQueueEntry) {
    await getOfflineDb(TEST_USER_ID).syncQueue.put(entry);
    mockGetPendingSyncQueue.mockResolvedValue([entry]);
  }

  async function seedLocalNote(noteId: string, overrides: Record<string, unknown> = {}) {
    const db = getOfflineDb(TEST_USER_ID);
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
      lastSyncedAt: null,
      serverUpdatedAt: null,
      localUpdatedAt: Date.now(),
      encryptedPayload: `ciphertext-${noteId}`,
      encryptionIv: `iv-${noteId}`,
      encryptionVersion: 1,
      contentHash: `hash-${noteId}`,
      ...overrides,
    });
  }

  it('re-creates the note instead of blocking when a pin targets a row the server lost', async () => {
    const noteId = 'note-missing-pin';
    await seedLocalNote(noteId);

    const entry = buildEntry({
      id: 900,
      clientMutationId: 'mut-missing-pin',
      operation: 'pin',
      entityType: 'note',
      entityId: noteId,
      payload: { pinned: true },
    });
    await enqueue(entry);

    // UPDATE matches no rows; the recovery INSERT succeeds.
    const { factory, calls } = buildVerbAwareChain({
      update: { data: null },
      insert: { data: { updated_at: '2026-07-01T00:00:00.000Z' } },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.blocked).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.processed).toBe(1);
    expect(calls.insert).toHaveBeenCalledTimes(1);
    expect(mockMarkSyncQueueEntryBlocked).not.toHaveBeenCalled();
    expect(mockMarkNoteSynced).toHaveBeenCalledWith(
      TEST_USER_ID,
      noteId,
      new Date('2026-07-01T00:00:00.000Z')
    );
  });

  it('rebuilds the row from the local record when an update finds nothing to update', async () => {
    const noteId = 'note-missing-update';
    await seedLocalNote(noteId);

    const entry = buildEntry({
      id: 901,
      clientMutationId: 'mut-missing-update',
      operation: 'update',
      entityType: 'note',
      entityId: noteId,
      payload: {
        title: '',
        content: '',
        ...encryptedServerFields(noteId),
      },
    });
    await enqueue(entry);

    const { factory, calls } = buildVerbAwareChain({
      select: { data: null },
      update: { data: null },
      insert: { data: { updated_at: '2026-07-02T00:00:00.000Z' } },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.blocked).toBe(0);
    expect(result.processed).toBe(1);
    expect(calls.insert).toHaveBeenCalledTimes(1);
  });

  it('leaves a note-tag insert pending when its parent row has not synced yet', async () => {
    const entry = buildEntry({
      id: 902,
      clientMutationId: 'mut-fk-add-tag',
      operation: 'add_tag',
      entityType: 'noteTag',
      entityId: 'note-fk:tag-fk',
      payload: { noteId: 'note-fk', tagId: 'tag-fk' },
      retryCount: 0,
    });
    await enqueue(entry);

    const fkError = Object.assign(new Error('insert violates foreign key constraint'), {
      code: '23503',
    });
    const chain = buildChain({ error: fkError });
    // note_tags inserts resolve through the terminal insert call itself.
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: fkError });
    mockFrom.mockReturnValue(chain);

    const result = await processQueue(TEST_USER_ID);

    // Ordering, not corruption — the entry stays retryable rather than blocking.
    expect(result.blocked).toBe(0);
    expect(mockMarkSyncQueueEntryBlocked).not.toHaveBeenCalled();
    expect(mockUpdateSyncQueueEntry).toHaveBeenCalled();

    const persisted = await getOfflineDb(TEST_USER_ID).syncQueue.get(902);
    expect(persisted?.status).toBe('pending');
    // Keep the real reason: a bare retry would record "Unknown sync failure",
    // which is the opacity this whole change exists to remove.
    expect(persisted?.lastError).toContain('23503');
    expect(persisted?.lastError).not.toContain('Unknown sync failure');
  });

  it('drops a pin whose note no longer exists on this device', async () => {
    // Cross-device race: the note was hard-deleted elsewhere and is gone
    // locally too, so the queued pin has nothing left to act on.
    const entry = buildEntry({
      id: 904,
      clientMutationId: 'mut-pin-no-local',
      operation: 'pin',
      entityType: 'note',
      entityId: 'note-vanished',
      payload: { pinned: true },
    });
    await enqueue(entry);

    const { factory, calls } = buildVerbAwareChain({ update: { data: null } });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(1);
    expect(result.blocked).toBe(0);
    expect(calls.insert).not.toHaveBeenCalled();
    expect(mockMarkSyncQueueEntryBlocked).not.toHaveBeenCalled();
  });

  it('re-queues tag links when it rebuilds a note', async () => {
    // note_tags cascades on delete, so a rebuilt note comes back tagless.
    // hydrateFromServer prunes local 'synced' links absent from the server,
    // which would silently strip the tags on every device.
    const noteId = 'note-with-tags';
    await seedLocalNote(noteId);
    const db = getOfflineDb(TEST_USER_ID);
    await db.noteTags.put({
      noteId,
      tagId: 'tag-kept',
      syncStatus: 'synced',
      lastSyncedAt: Date.now(),
    });

    const entry = buildEntry({
      id: 907,
      clientMutationId: 'mut-note-with-tags',
      operation: 'pin',
      entityType: 'note',
      entityId: noteId,
      payload: { pinned: true },
    });
    await enqueue(entry);

    const { factory } = buildVerbAwareChain({
      select: { data: null },
      update: { data: null },
      insert: { data: { updated_at: '2026-07-04T00:00:00.000Z' } },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(1);
    expect(mockQueueSyncOperation).toHaveBeenCalledWith(
      TEST_USER_ID,
      'add_tag',
      'noteTag',
      `${noteId}:tag-kept`,
      { noteId, tagId: 'tag-kept' }
    );

    // Pending links survive hydration's prune of synced-but-absent rows.
    const link = await db.noteTags.get([noteId, 'tag-kept']);
    expect(link?.syncStatus).toBe('pending');

    await db.noteTags.clear();
  });

  it('retires the dead create entry once a rebuild satisfies it', async () => {
    // A blocked create is never compacted away, so without this the indicator
    // keeps reporting a block for a note that is actually synced.
    const noteId = 'note-stale-create';
    await seedLocalNote(noteId);

    const entry = buildEntry({
      id: 909,
      clientMutationId: 'mut-stale-create',
      operation: 'update',
      entityType: 'note',
      entityId: noteId,
      payload: { title: '', content: '', ...encryptedServerFields(noteId) },
    });
    await enqueue(entry);

    const { factory } = buildVerbAwareChain({
      select: { data: null },
      update: { data: null },
      insert: { data: { updated_at: '2026-07-05T00:00:00.000Z' } },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.processed).toBe(1);
    expect(mockClearQueuedNoteCreates).toHaveBeenCalledWith(TEST_USER_ID, noteId);
  });

  it('does not rebuild a row that is still on the server', async () => {
    // A null RETURNING row can mean the write landed but RLS filtered the
    // response. Inserting then would collide on the primary key (23505),
    // which is non-retryable — a permanent block from a transient condition.
    const noteId = 'note-returning-filtered';
    await seedLocalNote(noteId);

    const entry = buildEntry({
      id: 906,
      clientMutationId: 'mut-returning-filtered',
      operation: 'pin',
      entityType: 'note',
      entityId: noteId,
      payload: { pinned: true },
    });
    await enqueue(entry);

    const { factory, calls } = buildVerbAwareChain({
      update: { data: null },
      // The confirming read still finds the row.
      select: { data: { updated_at: '2026-07-03T00:00:00.000Z' } },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(calls.insert).not.toHaveBeenCalled();
    expect(result.blocked).toBe(0);

    const persisted = await getOfflineDb(TEST_USER_ID).syncQueue.get(906);
    expect(persisted?.status).toBe('pending');
    expect(persisted?.lastError).toContain('exists on the server');
    expect(persisted?.lastError).not.toContain('Unknown sync failure');
  });

  it('retries rather than blocking when a rebuilt note is not yet confirmed', async () => {
    // The user-facing copy for this failure says it will be retried, so it
    // has to actually retry — a plain Error here would block on first sight.
    const noteId = 'note-unconfirmed';
    await seedLocalNote(noteId);

    const entry = buildEntry({
      id: 908,
      clientMutationId: 'mut-unconfirmed',
      operation: 'pin',
      entityType: 'note',
      entityId: noteId,
      payload: { pinned: true },
      retryCount: 0,
    });
    await enqueue(entry);

    const { factory } = buildVerbAwareChain({
      select: { data: null },
      update: { data: null },
      insert: { data: null },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.blocked).toBe(0);
    expect(mockMarkSyncQueueEntryBlocked).not.toHaveBeenCalled();

    const persisted = await getOfflineDb(TEST_USER_ID).syncQueue.get(908);
    expect(persisted?.status).toBe('pending');
    expect(persisted?.retryCount).toBe(1);
  });

  it('names the failure when a rebuilt note never lands on the server', async () => {
    const noteId = 'note-rebuild-vanishes';
    await seedLocalNote(noteId);

    const entry = buildEntry({
      id: 905,
      clientMutationId: 'mut-rebuild-vanishes',
      operation: 'pin',
      entityType: 'note',
      entityId: noteId,
      payload: { pinned: true },
      retryCount: 4, // one attempt short of MAX_SYNC_RETRIES
    });
    await enqueue(entry);

    // Update matches nothing, the rebuild insert reports success but returns
    // no row, and the confirming read finds nothing either.
    const { factory } = buildVerbAwareChain({
      select: { data: null },
      update: { data: null },
      insert: { data: null },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.blocked).toBe(1);
    const persisted = await getOfflineDb(TEST_USER_ID).syncQueue.get(905);
    expect(persisted?.lastError).toContain('did not appear on the server');
    expect(persisted?.lastError).not.toContain('Unknown sync failure');
  });

  it('keeps the Postgres error code in lastError so a block can be diagnosed', async () => {
    const noteId = 'note-rls-blocked';
    await seedLocalNote(noteId);

    const entry = buildEntry({
      id: 903,
      clientMutationId: 'mut-rls-blocked',
      operation: 'create',
      entityType: 'note',
      entityId: noteId,
      payload: {
        title: '',
        content: '',
        pinned: false,
        ...encryptedServerFields(noteId),
      },
    });
    await enqueue(entry);

    const rlsError = Object.assign(
      new Error('new row violates row-level security policy for table "notes"'),
      { code: '42501' }
    );
    const { factory } = buildVerbAwareChain({
      select: { data: null },
      insert: { error: rlsError },
    });
    mockFrom.mockImplementation(factory);

    const result = await processQueue(TEST_USER_ID);

    expect(result.blocked).toBe(1);
    const persisted = await getOfflineDb(TEST_USER_ID).syncQueue.get(903);
    expect(persisted?.status).toBe('blocked');
    expect(persisted?.lastError).toContain('42501');
    expect(persisted?.lastError).toContain('row-level security');
  });
});

// File-level cleanup: close and delete the shared test DB after all tests
afterAll(async () => {
  const db = getOfflineDb(TEST_USER_ID);
  db.close();
  await Dexie.delete(db.name);
});
