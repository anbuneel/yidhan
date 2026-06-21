import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { getOfflineDb, type LocalNote } from '../lib/offlineDb';
import type { ConflictInfo } from '../services/syncEngine';
import type { DerivedKeys } from '../lib/encryption';

const upsertSingleMock = vi.fn();
const upsertSelectMock = vi.fn(() => ({ single: upsertSingleMock }));
const upsertMock = vi.fn(() => ({ select: upsertSelectMock }));
const updateSingleMock = vi.fn();
const updateSelectMock = vi.fn(() => ({ single: updateSingleMock }));
const updateEqMock = vi.fn(() => ({ select: updateSelectMock }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== 'notes') {
        throw new Error(`Unexpected Supabase call to table "${table}" in resolveConflict test`);
      }

      return {
        upsert: upsertMock,
        update: updateMock,
      };
    }),
  },
}));

vi.mock('../lib/encryption', () => ({
  decryptNote: vi.fn().mockResolvedValue({
    title: 'Copied draft',
    content: '<p>Keep me as a copy</p>',
  }),
  encryptNote: vi.fn().mockResolvedValue({
    ciphertext: 'ciphertext-copy',
    iv: 'iv-copy',
    version: 1,
    contentHash: 'hash-copy',
  }),
}));

const TEST_USER_ID = 'test-user-sync-engine-conflicts';
const TEST_KEYS = {
  encryptionKey: {} as CryptoKey,
  hashKey: {} as CryptoKey,
  salt: new Uint8Array(16),
  rawEncryptionKey: new Uint8Array(32),
  rawHashKey: new Uint8Array(32),
} satisfies DerivedKeys;

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
    vi.clearAllMocks();
    upsertMock.mockImplementation(() => ({ select: upsertSelectMock }));
    upsertSelectMock.mockImplementation(() => ({ single: upsertSingleMock }));
    upsertSingleMock.mockImplementation(() => {
      throw new Error('Unexpected hard-delete upsert in resolveConflict test');
    });
    updateMock.mockImplementation(() => ({ eq: updateEqMock }));
    updateEqMock.mockImplementation(() => ({ select: updateSelectMock }));
    updateSelectMock.mockImplementation(() => ({ single: updateSingleMock }));
    updateSingleMock.mockImplementation(() => {
      throw new Error('Unexpected note update in resolveConflict test');
    });

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
      title: '',
      content: '',
      pinned: true,
      deletedAt: null,
      createdAt: now - 5000,
      updatedAt: now,
      syncStatus: 'conflict',
      lastSyncedAt: now - 10000,
      serverUpdatedAt: now - 10000,
      localUpdatedAt: now,
      encryptedPayload: 'ciphertext-hard-delete-local',
      encryptionIv: 'iv-hard-delete-local',
      encryptionVersion: 1,
      contentHash: 'hash-hard-delete-local',
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
      payload: {
        title: '',
        content: '',
        pinned: localNote.pinned,
        encrypted_payload: localNote.encryptedPayload,
        encryption_iv: localNote.encryptionIv,
        encryption_version: localNote.encryptionVersion,
        content_hash: localNote.contentHash,
      },
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
  }, 10000);

  it('falls back to a queued recreate when the online hard-delete restore fails', async () => {
    const { resolveConflict } = await import('./useSyncEngine');
    const db = getOfflineDb(TEST_USER_ID);
    const now = Date.now();
    const localNote: LocalNote = {
      id: 'note-hard-delete-online-fallback',
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: now - 5000,
      updatedAt: now,
      syncStatus: 'conflict',
      lastSyncedAt: now - 10000,
      serverUpdatedAt: now - 10000,
      localUpdatedAt: now,
      encryptedPayload: 'ciphertext-hard-delete-online-fallback',
      encryptionIv: 'iv-hard-delete-online-fallback',
      encryptionVersion: 1,
      contentHash: 'hash-hard-delete-online-fallback',
    };

    await db.notes.add(localNote);
    upsertSingleMock.mockResolvedValue({
      data: null,
      error: new Error('upsert failed'),
    });

    const onlineSpy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await resolveConflict(TEST_USER_ID, buildHardDeleteConflict(localNote), 'local');
    onlineSpy.mockRestore();
    warnSpy.mockRestore();

    const stored = await db.notes.get(localNote.id);
    expect(stored?.syncStatus).toBe('pending');

    const queue = await db.syncQueue.toArray();
    const recreatedEntries = queue.filter((entry) =>
      entry.entityType === 'note' &&
      entry.operation === 'create' &&
      entry.entityId === localNote.id
    );

    expect(recreatedEntries).toHaveLength(1);
    expect(recreatedEntries[0]).toMatchObject({
      operation: 'create',
      entityType: 'note',
      entityId: localNote.id,
    });
  }, 10000);

  it('fully removes the original note when keeping the deleted server version', async () => {
    const { resolveConflict } = await import('./useSyncEngine');
    const db = getOfflineDb(TEST_USER_ID);
    const now = Date.now();
    const localNote: LocalNote = {
      id: 'note-hard-delete-server',
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: false,
      deletedAt: null,
      createdAt: now - 5000,
      updatedAt: now,
      syncStatus: 'conflict',
      lastSyncedAt: now - 10000,
      serverUpdatedAt: now - 10000,
      localUpdatedAt: now,
      encryptedPayload: 'ciphertext-hard-delete-server',
      encryptionIv: 'iv-hard-delete-server',
      encryptionVersion: 1,
      contentHash: 'hash-hard-delete-server',
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
      payload: {
        title: '',
        content: '',
        encrypted_payload: localNote.encryptedPayload,
        encryption_iv: localNote.encryptionIv,
        encryption_version: localNote.encryptionVersion,
        content_hash: localNote.contentHash,
      },
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

  it('creates a copy and removes the deleted original when keeping both after a hard delete', async () => {
    const { resolveConflict } = await import('./useSyncEngine');
    const db = getOfflineDb(TEST_USER_ID);
    const now = Date.now();
    const localNote: LocalNote = {
      id: 'note-hard-delete-both',
      userId: TEST_USER_ID,
      title: '',
      content: '',
      pinned: true,
      deletedAt: null,
      createdAt: now - 5000,
      updatedAt: now,
      syncStatus: 'conflict',
      lastSyncedAt: now - 10000,
      serverUpdatedAt: now - 10000,
      localUpdatedAt: now,
      encryptedPayload: 'ciphertext-hard-delete-both',
      encryptionIv: 'iv-hard-delete-both',
      encryptionVersion: 1,
      contentHash: 'hash-hard-delete-both',
    };

    await db.notes.add(localNote);
    await db.noteTags.add({
      noteId: localNote.id,
      tagId: 'tag-copy',
      syncStatus: 'synced',
      lastSyncedAt: now - 10000,
    });
    await db.syncQueue.add({
      clientMutationId: 'stale-update-both',
      operation: 'update',
      entityType: 'note',
      entityId: localNote.id,
      payload: {
        title: '',
        content: '',
        encrypted_payload: localNote.encryptedPayload,
        encryption_iv: localNote.encryptionIv,
        encryption_version: localNote.encryptionVersion,
        content_hash: localNote.contentHash,
      },
      createdAt: now - 1000,
      retryCount: 1,
      status: 'blocked',
    });

    await resolveConflict(TEST_USER_ID, buildHardDeleteConflict(localNote), 'both', TEST_KEYS);

    const original = await db.notes.get(localNote.id);
    expect(original).toBeUndefined();

    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      title: '',
      content: '',
      syncStatus: 'pending',
      userId: TEST_USER_ID,
      encryptedPayload: 'ciphertext-copy',
      encryptionIv: 'iv-copy',
      encryptionVersion: 1,
      contentHash: 'hash-copy',
    });
    expect(notes[0].id).not.toBe(localNote.id);

    const queue = await db.syncQueue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      operation: 'create',
      entityType: 'note',
      entityId: notes[0].id,
    });

    const originalNoteTags = await db.noteTags.where('noteId').equals(localNote.id).toArray();
    expect(originalNoteTags).toHaveLength(0);
  });
});
