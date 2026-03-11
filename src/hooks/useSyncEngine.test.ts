import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { getOfflineDb, type LocalNote } from '../lib/offlineDb';
import type { ConflictInfo } from '../services/syncEngine';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      throw new Error(`Unexpected Supabase call to table "${table}" in resolveConflict test`);
    }),
  },
}));

const TEST_USER_ID = 'test-user-sync-engine-conflicts';

function buildHardDeleteConflict(localNote: LocalNote): ConflictInfo {
  const now = new Date().toISOString();

  return {
    entityType: 'note',
    entityId: localNote.id,
    localVersion: localNote,
    serverVersion: {
      id: localNote.id,
      user_id: localNote.userId,
      title: localNote.title,
      content: localNote.content,
      pinned: localNote.pinned,
      deleted_at: now,
      created_at: new Date(localNote.createdAt).toISOString(),
      updated_at: now,
      encrypted_payload: localNote.encryptedPayload,
      encryption_iv: localNote.encryptionIv,
      encryption_version: localNote.encryptionVersion,
      content_hash: localNote.contentHash,
      hard_deleted: true,
    },
  };
}

describe('resolveConflict hard-delete handling', () => {
  beforeEach(async () => {
    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.noteTags.clear();
    await db.syncQueue.clear();
    await db.tags.clear();
    await db.conflicts.clear();
  });

  afterAll(async () => {
    const db = getOfflineDb(TEST_USER_ID);
    db.close();
    await Dexie.delete(db.name);
  });

  it('requeues a hard-deleted note as a create when keeping the local version offline', async () => {
    const { resolveConflict } = await import('./useSyncEngine');
    const db = getOfflineDb(TEST_USER_ID);
    const now = Date.now();
    const localNote: LocalNote = {
      id: 'note-hard-delete-local',
      userId: TEST_USER_ID,
      title: 'Recovered draft',
      content: '<p>Keep this</p>',
      pinned: true,
      deletedAt: null,
      createdAt: now - 5000,
      updatedAt: now,
      syncStatus: 'conflict',
      lastSyncedAt: now - 10000,
      serverUpdatedAt: now - 10000,
      localUpdatedAt: now,
      encryptedPayload: null,
      encryptionIv: null,
      encryptionVersion: null,
      contentHash: null,
    };

    await db.notes.add(localNote);
    await db.noteTags.add({
      noteId: localNote.id,
      tagId: 'tag-1',
      syncStatus: 'synced',
      lastSyncedAt: now - 10000,
    });
    await db.syncQueue.add({
      clientMutationId: 'stale-update',
      operation: 'update',
      entityType: 'note',
      entityId: localNote.id,
      payload: { title: localNote.title, content: localNote.content, pinned: localNote.pinned },
      createdAt: now - 1000,
      retryCount: 3,
      status: 'blocked',
    });

    const onlineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    await resolveConflict(TEST_USER_ID, buildHardDeleteConflict(localNote), 'local');
    onlineSpy.mockRestore();

    const stored = await db.notes.get(localNote.id);
    expect(stored?.syncStatus).toBe('pending');

    const queue = await db.syncQueue.orderBy('createdAt').toArray();
    expect(queue).toHaveLength(2);
    expect(queue.find((entry) => entry.entityType === 'note' && entry.operation === 'create')).toBeTruthy();
    expect(queue.find((entry) => entry.entityType === 'noteTag' && entry.operation === 'add_tag')).toBeTruthy();
    expect(queue.find((entry) => entry.operation === 'update')).toBeUndefined();

    const restoredTagLink = await db.noteTags.where('[noteId+tagId]').equals([localNote.id, 'tag-1']).first();
    expect(restoredTagLink?.syncStatus).toBe('pending');
  });

  it('fully removes the original note when keeping the deleted server version', async () => {
    const { resolveConflict } = await import('./useSyncEngine');
    const db = getOfflineDb(TEST_USER_ID);
    const now = Date.now();
    const localNote: LocalNote = {
      id: 'note-hard-delete-server',
      userId: TEST_USER_ID,
      title: 'Discarded draft',
      content: '<p>Remove me</p>',
      pinned: false,
      deletedAt: null,
      createdAt: now - 5000,
      updatedAt: now,
      syncStatus: 'conflict',
      lastSyncedAt: now - 10000,
      serverUpdatedAt: now - 10000,
      localUpdatedAt: now,
      encryptedPayload: null,
      encryptionIv: null,
      encryptionVersion: null,
      contentHash: null,
    };

    await db.notes.add(localNote);
    await db.noteTags.add({
      noteId: localNote.id,
      tagId: 'tag-2',
      syncStatus: 'synced',
      lastSyncedAt: now - 10000,
    });
    await db.syncQueue.add({
      clientMutationId: 'stale-update-server',
      operation: 'update',
      entityType: 'note',
      entityId: localNote.id,
      payload: { title: localNote.title, content: localNote.content },
      createdAt: now - 1000,
      retryCount: 1,
      status: 'blocked',
    });

    await resolveConflict(TEST_USER_ID, buildHardDeleteConflict(localNote), 'server');

    const stored = await db.notes.get(localNote.id);
    expect(stored).toBeUndefined();

    const noteTags = await db.noteTags.where('noteId').equals(localNote.id).toArray();
    expect(noteTags).toHaveLength(0);

    const queue = await db.syncQueue.toArray();
    expect(queue).toHaveLength(0);
  });
});
