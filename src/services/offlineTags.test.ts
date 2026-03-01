/**
 * offlineTags.test.ts — Phase 1 Offline/Encrypted Data Pipeline
 *
 * Tests offline-first tag CRUD operations using IndexedDB (Dexie).
 * Covers creation, update, deletion, duplicate detection, name validation,
 * and sync queue management.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Dexie from 'dexie';
import { getOfflineDb } from '../lib/offlineDb';

const TEST_USER_ID = 'test-user-offline-tags';

describe('offlineTags', () => {
  beforeEach(async () => {
    const db = getOfflineDb(TEST_USER_ID);
    await db.tags.clear();
    await db.noteTags.clear();
    await db.syncQueue.clear();
    await db.notes.clear();
  });

  afterAll(async () => {
    const db = getOfflineDb(TEST_USER_ID);
    db.close();
    await Dexie.delete(db.name);
  });

  // ──────────────────────────────────────────────────
  // createTagOffline
  // ──────────────────────────────────────────────────

  describe('createTagOffline', () => {
    it('should create a tag and return it', async () => {
      const { createTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Work', 'terracotta');

      expect(tag.id).toBeDefined();
      expect(tag.name).toBe('Work');
      expect(tag.color).toBe('terracotta');
      expect(tag.createdAt).toBeInstanceOf(Date);
    });

    it('should persist the tag in IndexedDB', async () => {
      const { createTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Personal', 'gold');

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.tags.get(tag.id);

      expect(stored).toBeDefined();
      expect(stored!.name).toBe('Personal');
      expect(stored!.syncStatus).toBe('pending');
    });

    it('should create a sync queue entry', async () => {
      const { createTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Queued', 'forest');

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();

      expect(queue).toHaveLength(1);
      expect(queue[0].operation).toBe('create');
      expect(queue[0].entityType).toBe('tag');
      expect(queue[0].entityId).toBe(tag.id);
    });

    it('should reject duplicate tag names (case-insensitive)', async () => {
      const { createTagOffline } = await import('./offlineTags');

      await createTagOffline(TEST_USER_ID, 'Work', 'terracotta');

      await expect(
        createTagOffline(TEST_USER_ID, 'work', 'gold') // lowercase duplicate
      ).rejects.toThrow('already exists');
    });

    it('should trim whitespace from tag names', async () => {
      const { createTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, '  Trimmed  ', 'stone');

      expect(tag.name).toBe('Trimmed');
    });

    it('should reject tag names that are too short', async () => {
      const { createTagOffline } = await import('./offlineTags');

      await expect(
        createTagOffline(TEST_USER_ID, '', 'indigo')
      ).rejects.toThrow('1-20 characters');
    });

    it('should reject tag names that are too long', async () => {
      const { createTagOffline } = await import('./offlineTags');

      const longName = 'a'.repeat(21);
      await expect(
        createTagOffline(TEST_USER_ID, longName, 'clay')
      ).rejects.toThrow('1-20 characters');
    });
  });

  // ──────────────────────────────────────────────────
  // updateTagOffline
  // ──────────────────────────────────────────────────

  describe('updateTagOffline', () => {
    it('should update tag name', async () => {
      const { createTagOffline, updateTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Old Name', 'terracotta');
      const updated = await updateTagOffline(TEST_USER_ID, tag.id, { name: 'New Name' });

      expect(updated.name).toBe('New Name');

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.tags.get(tag.id);
      expect(stored!.name).toBe('New Name');
    });

    it('should update tag color', async () => {
      const { createTagOffline, updateTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Colored', 'terracotta');
      const updated = await updateTagOffline(TEST_USER_ID, tag.id, { color: 'gold' });

      expect(updated.color).toBe('gold');
    });

    it('should reject duplicate name on update', async () => {
      const { createTagOffline, updateTagOffline } = await import('./offlineTags');

      await createTagOffline(TEST_USER_ID, 'Existing', 'terracotta');
      const tag2 = await createTagOffline(TEST_USER_ID, 'Rename Me', 'gold');

      await expect(
        updateTagOffline(TEST_USER_ID, tag2.id, { name: 'Existing' })
      ).rejects.toThrow('already exists');
    });

    it('should throw for non-existent tag', async () => {
      const { updateTagOffline } = await import('./offlineTags');

      await expect(
        updateTagOffline(TEST_USER_ID, 'non-existent', { name: 'X' })
      ).rejects.toThrow('not found');
    });

    it('should compact previous update entries in sync queue', async () => {
      const { createTagOffline, updateTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Compact', 'stone');
      await updateTagOffline(TEST_USER_ID, tag.id, { name: 'V2' });
      await updateTagOffline(TEST_USER_ID, tag.id, { name: 'V3' });

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();
      const updates = queue.filter((e) => e.operation === 'update' && e.entityId === tag.id);

      expect(updates).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────
  // deleteTagOffline
  // ──────────────────────────────────────────────────

  describe('deleteTagOffline', () => {
    it('should remove tag from IndexedDB', async () => {
      const { createTagOffline, deleteTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Delete Me', 'plum');
      await deleteTagOffline(TEST_USER_ID, tag.id);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.tags.get(tag.id);
      expect(stored).toBeUndefined();
    });

    it('should remove note-tag associations for deleted tag', async () => {
      const { createTagOffline, deleteTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Associated', 'sage');

      // Add note-tag association
      const db = getOfflineDb(TEST_USER_ID);
      await db.noteTags.add({
        noteId: 'some-note',
        tagId: tag.id,
        syncStatus: 'synced',
        lastSyncedAt: Date.now(),
      });

      await deleteTagOffline(TEST_USER_ID, tag.id);

      const associations = await db.noteTags.where('tagId').equals(tag.id).toArray();
      expect(associations).toHaveLength(0);
    });

    it('should remove pending sync operations for deleted tag', async () => {
      const { createTagOffline, deleteTagOffline } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Pending', 'clay');

      // Verify create entry exists
      const db = getOfflineDb(TEST_USER_ID);
      let queue = await db.syncQueue.toArray();
      expect(queue.some((e) => e.entityId === tag.id && e.operation === 'create')).toBe(true);

      await deleteTagOffline(TEST_USER_ID, tag.id);

      // Create entry should be removed, but delete entry should exist
      queue = await db.syncQueue.toArray();
      const createOps = queue.filter((e) => e.entityId === tag.id && e.operation === 'create');
      const deleteOps = queue.filter((e) => e.entityId === tag.id && e.operation === 'delete');
      expect(createOps).toHaveLength(0);
      expect(deleteOps).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────
  // fetchTagsOffline
  // ──────────────────────────────────────────────────

  describe('fetchTagsOffline', () => {
    it('should return all tags sorted alphabetically', async () => {
      const { createTagOffline, fetchTagsOffline } = await import('./offlineTags');

      await createTagOffline(TEST_USER_ID, 'Zebra', 'terracotta');
      await createTagOffline(TEST_USER_ID, 'Apple', 'gold');
      await createTagOffline(TEST_USER_ID, 'Mango', 'forest');

      const tags = await fetchTagsOffline(TEST_USER_ID);

      expect(tags).toHaveLength(3);
      expect(tags[0].name).toBe('Apple');
      expect(tags[1].name).toBe('Mango');
      expect(tags[2].name).toBe('Zebra');
    });

    it('should return empty array when no tags exist', async () => {
      const { fetchTagsOffline } = await import('./offlineTags');

      const tags = await fetchTagsOffline(TEST_USER_ID);
      expect(tags).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────
  // markTagSynced
  // ──────────────────────────────────────────────────

  describe('markTagSynced', () => {
    it('should update sync status and server timestamp', async () => {
      const { createTagOffline, markTagSynced } = await import('./offlineTags');

      const tag = await createTagOffline(TEST_USER_ID, 'Sync Tag', 'indigo');
      const serverTime = new Date('2026-01-15T12:00:00Z');

      await markTagSynced(TEST_USER_ID, tag.id, serverTime);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.tags.get(tag.id);

      expect(stored!.syncStatus).toBe('synced');
      expect(stored!.lastSyncedAt).toBe(serverTime.getTime());
      expect(stored!.serverUpdatedAt).toBe(serverTime.getTime());
    });
  });
});
