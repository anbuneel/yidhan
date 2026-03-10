import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import Dexie from 'dexie';
import { getOfflineDb, HYDRATION_META_KEY } from './offlineDb';

const TEST_USER_ID = 'test-user-offline-db-upgrade';
const DB_NAME = `yidhan-offline-${TEST_USER_ID}`;

class LegacyOfflineDb extends Dexie {
  constructor() {
    super(DB_NAME);
    this.version(4).stores({
      notes: 'id, userId, syncStatus, deletedAt, pinned, updatedAt',
      tags: 'id, name, syncStatus',
      noteTags: '[noteId+tagId], noteId, tagId, syncStatus',
      syncQueue: '++id, clientMutationId, entityType, entityId, createdAt',
      conflicts: '++id, entityType, entityId, detectedAt',
    });
  }
}

afterEach(async () => {
  const db = getOfflineDb(TEST_USER_ID);
  db.close();
  await Dexie.delete(db.name);
});

describe('offlineDb', () => {
  it('upgrades legacy queue entries to v5 blocked-sync metadata without creating hydration rows', async () => {
    const legacyDb = new LegacyOfflineDb();

    await legacyDb.open();
    await legacyDb.table('syncQueue').add({
      clientMutationId: 'legacy-entry',
      operation: 'update',
      entityType: 'note',
      entityId: 'note-1',
      payload: { title: 'legacy' },
      createdAt: 1234,
      retryCount: 2,
    });
    legacyDb.close();

    const upgradedDb = getOfflineDb(TEST_USER_ID);
    await upgradedDb.open();

    const entry = await upgradedDb.syncQueue
      .where('clientMutationId')
      .equals('legacy-entry')
      .first();
    const hydrationMeta = await upgradedDb.meta.get(HYDRATION_META_KEY);

    expect(entry).toBeDefined();
    expect(entry?.status).toBe('pending');
    expect(entry?.lastError).toBeNull();
    expect(entry?.lastAttemptAt).toBeNull();
    expect(entry?.blockedAt).toBeNull();
    expect(entry?.updatedAt).toBe(1234);
    expect(hydrationMeta).toBeUndefined();
  });
});
