/**
 * offlineNotes.test.ts — Phase 1 Offline/Encrypted Data Pipeline
 *
 * Tests offline-aware CRUD operations + sync queue management.
 * Every user action (create/update/delete/pin/tag) flows through this layer
 * before reaching the sync engine → Supabase.
 *
 * Uses fake-indexeddb for Dexie. Supabase is mocked at module level
 * (only needed for hydrateFromServer).
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import Dexie from 'dexie';

// jsdom doesn't provide crypto.subtle — polyfill from Node.js
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true,
    });
  }
});

// Mock Supabase before importing offlineNotes (it imports supabase at module level).
// The mock throws by default — offline-only tests should never hit Supabase.
// Tests that exercise server paths (e.g. hydrateFromServer) must override per-test.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      throw new Error(`Unexpected Supabase call to table "${table}" in offline-only test`);
    }),
  },
  // fetchAllPaginated is a safety net — returns empty data to prevent unintended
  // server fetches. Override in tests that exercise hydrateFromServer.
  fetchAllPaginated: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

import { getOfflineDb, type LocalTag } from '../lib/offlineDb';

const TEST_USER_ID = 'test-user-offline-notes';

/** Seed a synced tag in IndexedDB with minimal boilerplate */
async function seedTag(id: string, name: string, color: string): Promise<void> {
  const db = getOfflineDb(TEST_USER_ID);
  const now = Date.now();
  const tag: LocalTag = {
    id,
    userId: TEST_USER_ID,
    name,
    color,
    createdAt: now,
    syncStatus: 'synced',
    lastSyncedAt: now,
    serverUpdatedAt: now,
    localUpdatedAt: now,
  };
  await db.tags.add(tag);
}

describe('offlineNotes', () => {
  beforeEach(async () => {
    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.syncQueue.clear();
    await db.noteTags.clear();
    await db.tags.clear();
    await db.conflicts.clear();
  });

  afterAll(async () => {
    const db = getOfflineDb(TEST_USER_ID);
    db.close();
    await Dexie.delete(db.name);
  });

  // ──────────────────────────────────────────────────
  // createNoteOffline
  // ──────────────────────────────────────────────────

  describe('createNoteOffline', () => {
    it('should create a note in IndexedDB with correct fields', async () => {
      const { createNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'My Note', '<p>Content</p>');

      expect(note.id).toBeDefined();
      expect(note.title).toBe('My Note');
      expect(note.content).toBe('<p>Content</p>');
      expect(note.pinned).toBe(false);
      expect(note.deletedAt).toBeNull();
      expect(note.tags).toEqual([]);
      expect(note.syncStatus).toBe('pending');
    });

    it('should persist the note in IndexedDB', async () => {
      const { createNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Persisted', '<p>Check</p>');

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(note.id);

      expect(stored).toBeDefined();
      expect(stored!.title).toBe('Persisted');
      expect(stored!.syncStatus).toBe('pending');
    });

    it('should create a sync queue entry', async () => {
      const { createNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Queued', '<p>Q</p>');

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();

      expect(queue).toHaveLength(1);
      expect(queue[0].operation).toBe('create');
      expect(queue[0].entityType).toBe('note');
      expect(queue[0].entityId).toBe(note.id);
      expect(queue[0].retryCount).toBe(0);
    });

    it('should handle empty title and content', async () => {
      const { createNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID);

      expect(note.title).toBe('');
      expect(note.content).toBe('');
    });

    it('should generate unique IDs for each note', async () => {
      const { createNoteOffline } = await import('./offlineNotes');

      const note1 = await createNoteOffline(TEST_USER_ID, 'A');
      const note2 = await createNoteOffline(TEST_USER_ID, 'B');

      expect(note1.id).not.toBe(note2.id);
    });
  });

  // ──────────────────────────────────────────────────
  // updateNoteOffline
  // ──────────────────────────────────────────────────

  describe('updateNoteOffline', () => {
    it('should update title and content in IndexedDB', async () => {
      const { createNoteOffline, updateNoteOffline } = await import('./offlineNotes');

      const created = await createNoteOffline(TEST_USER_ID, 'Old Title', '<p>Old</p>');

      const updated = await updateNoteOffline(TEST_USER_ID, {
        ...created,
        title: 'New Title',
        content: '<p>New</p>',
      });

      expect(updated.title).toBe('New Title');
      expect(updated.content).toBe('<p>New</p>');

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(created.id);
      expect(stored!.title).toBe('New Title');
    });

    it('should mark status as pending after update', async () => {
      const { createNoteOffline, updateNoteOffline } = await import('./offlineNotes');

      const created = await createNoteOffline(TEST_USER_ID, 'Note', '<p>V1</p>');

      // Simulate synced state
      const db = getOfflineDb(TEST_USER_ID);
      await db.notes.update(created.id, { syncStatus: 'synced' });

      const updated = await updateNoteOffline(TEST_USER_ID, {
        ...created,
        title: 'Updated',
        content: '<p>V2</p>',
      });

      expect(updated.syncStatus).toBe('pending');
    });

    it('should compact previous update entries in sync queue', async () => {
      const { createNoteOffline, updateNoteOffline } = await import('./offlineNotes');

      const created = await createNoteOffline(TEST_USER_ID, 'Note', '<p>V1</p>');

      await updateNoteOffline(TEST_USER_ID, { ...created, title: 'V2', content: '<p>V2</p>' });
      await updateNoteOffline(TEST_USER_ID, { ...created, title: 'V3', content: '<p>V3</p>' });

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();
      const updates = queue.filter((e) => e.operation === 'update' && e.entityId === created.id);

      // Only 1 update should remain after compaction
      expect(updates).toHaveLength(1);
    });

    it('should throw for non-existent note', async () => {
      const { updateNoteOffline } = await import('./offlineNotes');

      await expect(
        updateNoteOffline(TEST_USER_ID, {
          id: 'non-existent',
          title: 'X',
          content: 'X',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          pinned: false,
          deletedAt: null,
        })
      ).rejects.toThrow('not found');
    });
  });

  // ──────────────────────────────────────────────────
  // softDeleteNoteOffline / restoreNoteOffline
  // ──────────────────────────────────────────────────

  describe('softDeleteNoteOffline', () => {
    it('should set deletedAt timestamp on the note', async () => {
      const { createNoteOffline, softDeleteNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'To Delete', '<p>Bye</p>');
      await softDeleteNoteOffline(TEST_USER_ID, note.id);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(note.id);

      expect(stored!.deletedAt).toBeTruthy();
      expect(stored!.syncStatus).toBe('pending');
    });

    it('should queue a soft_delete sync operation', async () => {
      const { createNoteOffline, softDeleteNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Del', '<p>D</p>');
      await softDeleteNoteOffline(TEST_USER_ID, note.id);

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();
      const deleteOps = queue.filter((e) => e.operation === 'soft_delete');

      expect(deleteOps).toHaveLength(1);
      expect(deleteOps[0].entityId).toBe(note.id);
    });
  });

  describe('restoreNoteOffline', () => {
    it('should clear deletedAt and queue restore operation', async () => {
      const { createNoteOffline, softDeleteNoteOffline, restoreNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Restore Me', '<p>R</p>');
      await softDeleteNoteOffline(TEST_USER_ID, note.id);
      await restoreNoteOffline(TEST_USER_ID, note.id);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(note.id);

      expect(stored!.deletedAt).toBeNull();

      const queue = await db.syncQueue.toArray();
      const restoreOps = queue.filter((e) => e.operation === 'restore');
      expect(restoreOps).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────
  // permanentDeleteNoteOffline
  // ──────────────────────────────────────────────────

  describe('permanentDeleteNoteOffline', () => {
    it('should remove note from IndexedDB and clean up associations', async () => {
      const { createNoteOffline, permanentDeleteNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Gone', '<p>G</p>');

      // Add a tag association
      const db = getOfflineDb(TEST_USER_ID);
      await db.noteTags.add({ noteId: note.id, tagId: 'tag-1', syncStatus: 'pending', lastSyncedAt: null });

      await permanentDeleteNoteOffline(TEST_USER_ID, note.id);

      const stored = await db.notes.get(note.id);
      expect(stored).toBeUndefined();

      const noteTags = await db.noteTags.where('noteId').equals(note.id).toArray();
      expect(noteTags).toHaveLength(0);
    });

    it('should queue a delete sync operation', async () => {
      const { createNoteOffline, permanentDeleteNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Perm Del', '<p>D</p>');
      await permanentDeleteNoteOffline(TEST_USER_ID, note.id);

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();
      const deleteOps = queue.filter((e) => e.operation === 'delete' && e.entityId === note.id);

      expect(deleteOps).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────
  // toggleNotePinOffline
  // ──────────────────────────────────────────────────

  describe('toggleNotePinOffline', () => {
    it('should toggle pin status and queue sync', async () => {
      const { createNoteOffline, toggleNotePinOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Pin Me', '<p>P</p>');

      await toggleNotePinOffline(TEST_USER_ID, note.id, true);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(note.id);
      expect(stored!.pinned).toBe(true);

      const queue = await db.syncQueue.toArray();
      const pinOps = queue.filter((e) => e.operation === 'pin');
      expect(pinOps).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────
  // fetchNotesOffline
  // ──────────────────────────────────────────────────

  describe('fetchNotesOffline', () => {
    it('should return only active notes (not soft-deleted)', async () => {
      const { createNoteOffline, softDeleteNoteOffline, fetchNotesOffline } = await import('./offlineNotes');

      await createNoteOffline(TEST_USER_ID, 'Active', '<p>A</p>');
      const toDelete = await createNoteOffline(TEST_USER_ID, 'Deleted', '<p>D</p>');
      await softDeleteNoteOffline(TEST_USER_ID, toDelete.id);

      const notes = await fetchNotesOffline(TEST_USER_ID);

      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Active');
    });

    it('should sort pinned notes first, then by updatedAt descending', async () => {
      const { createNoteOffline, toggleNotePinOffline, fetchNotesOffline } = await import('./offlineNotes');

      const note1 = await createNoteOffline(TEST_USER_ID, 'Older', '<p>1</p>');
      // Wait a tick so timestamps differ
      await new Promise((r) => setTimeout(r, 10));
      await createNoteOffline(TEST_USER_ID, 'Newer', '<p>2</p>');
      await toggleNotePinOffline(TEST_USER_ID, note1.id, true);

      const notes = await fetchNotesOffline(TEST_USER_ID);

      expect(notes[0].title).toBe('Older'); // pinned, comes first
      expect(notes[1].title).toBe('Newer'); // newer, second
    });

    it('should include tag associations', async () => {
      const { createNoteOffline, fetchNotesOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Tagged', '<p>T</p>');

      const db = getOfflineDb(TEST_USER_ID);
      await seedTag('tag-fetch-1', 'Important', 'terracotta');
      await db.noteTags.add({
        noteId: note.id,
        tagId: 'tag-fetch-1',
        syncStatus: 'synced',
        lastSyncedAt: Date.now(),
      });

      const notes = await fetchNotesOffline(TEST_USER_ID);

      expect(notes[0].tags).toHaveLength(1);
      expect(notes[0].tags[0].name).toBe('Important');
    });

    it('should apply tag filter with AND logic', async () => {
      const { createNoteOffline, addTagToNoteOffline, fetchNotesOffline } = await import('./offlineNotes');

      const note1 = await createNoteOffline(TEST_USER_ID, 'HasBoth', '<p>B</p>');
      const note2 = await createNoteOffline(TEST_USER_ID, 'HasOne', '<p>O</p>');

      await seedTag('tf-a', 'A', 'gold');
      await seedTag('tf-b', 'B', 'forest');

      await addTagToNoteOffline(TEST_USER_ID, note1.id, 'tf-a');
      await addTagToNoteOffline(TEST_USER_ID, note1.id, 'tf-b');
      await addTagToNoteOffline(TEST_USER_ID, note2.id, 'tf-a');

      // Filter by both tags (AND logic)
      const filtered = await fetchNotesOffline(TEST_USER_ID, ['tf-a', 'tf-b']);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('HasBoth');
    });
  });

  // ──────────────────────────────────────────────────
  // fetchFadedNotesOffline
  // ──────────────────────────────────────────────────

  describe('fetchFadedNotesOffline', () => {
    it('should return only soft-deleted notes', async () => {
      const { createNoteOffline, softDeleteNoteOffline, fetchFadedNotesOffline } = await import('./offlineNotes');

      await createNoteOffline(TEST_USER_ID, 'Active', '<p>A</p>');
      const faded = await createNoteOffline(TEST_USER_ID, 'Faded', '<p>F</p>');
      await softDeleteNoteOffline(TEST_USER_ID, faded.id);

      const notes = await fetchFadedNotesOffline(TEST_USER_ID);

      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Faded');
      expect(notes[0].deletedAt).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────
  // searchNotesOffline
  // ──────────────────────────────────────────────────

  describe('searchNotesOffline', () => {
    it('should find notes by title', async () => {
      const { createNoteOffline, searchNotesOffline } = await import('./offlineNotes');

      await createNoteOffline(TEST_USER_ID, 'Meeting Agenda', '<p>Items</p>');
      await createNoteOffline(TEST_USER_ID, 'Shopping List', '<p>Milk</p>');

      const results = await searchNotesOffline(TEST_USER_ID, 'meeting');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Meeting Agenda');
    });

    it('should find notes by content', async () => {
      const { createNoteOffline, searchNotesOffline } = await import('./offlineNotes');

      await createNoteOffline(TEST_USER_ID, 'Recipe', '<p>Add flour</p>');
      await createNoteOffline(TEST_USER_ID, 'Notes', '<p>Remember eggs</p>');

      const results = await searchNotesOffline(TEST_USER_ID, 'flour');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Recipe');
    });

    it('should return all notes for empty query', async () => {
      const { createNoteOffline, searchNotesOffline } = await import('./offlineNotes');

      await createNoteOffline(TEST_USER_ID, 'A');
      await createNoteOffline(TEST_USER_ID, 'B');

      const results = await searchNotesOffline(TEST_USER_ID, '');

      expect(results).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────
  // Tag association operations
  // ──────────────────────────────────────────────────

  describe('addTagToNoteOffline', () => {
    it('should create a note-tag association', async () => {
      const { createNoteOffline, addTagToNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Tagged', '<p>T</p>');

      await seedTag('tag-assoc-1', 'Work', 'indigo');
      await addTagToNoteOffline(TEST_USER_ID, note.id, 'tag-assoc-1');

      const db = getOfflineDb(TEST_USER_ID);
      const associations = await db.noteTags.where('noteId').equals(note.id).toArray();
      expect(associations).toHaveLength(1);
      expect(associations[0].tagId).toBe('tag-assoc-1');
    });

    it('should not duplicate existing association', async () => {
      const { createNoteOffline, addTagToNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Note', '<p>N</p>');

      await seedTag('tag-dup-1', 'Dup', 'stone');

      await addTagToNoteOffline(TEST_USER_ID, note.id, 'tag-dup-1');
      await addTagToNoteOffline(TEST_USER_ID, note.id, 'tag-dup-1');

      const db = getOfflineDb(TEST_USER_ID);
      const associations = await db.noteTags.where('noteId').equals(note.id).toArray();
      expect(associations).toHaveLength(1);
    });

    it('should queue add_tag sync operation', async () => {
      const { createNoteOffline, addTagToNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'N', '<p>N</p>');

      await seedTag('tag-q-1', 'Q', 'sage');
      await addTagToNoteOffline(TEST_USER_ID, note.id, 'tag-q-1');

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();
      const addTagOps = queue.filter((e) => e.operation === 'add_tag');
      expect(addTagOps).toHaveLength(1);
    });
  });

  describe('removeTagFromNoteOffline', () => {
    it('should remove the note-tag association and queue sync', async () => {
      const { createNoteOffline, addTagToNoteOffline, removeTagFromNoteOffline } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'N', '<p>N</p>');

      await seedTag('tag-rm-1', 'Remove', 'plum');

      await addTagToNoteOffline(TEST_USER_ID, note.id, 'tag-rm-1');
      await removeTagFromNoteOffline(TEST_USER_ID, note.id, 'tag-rm-1');

      const db = getOfflineDb(TEST_USER_ID);
      const associations = await db.noteTags.where('noteId').equals(note.id).toArray();
      expect(associations).toHaveLength(0);

      const queue = await db.syncQueue.toArray();
      const removeOps = queue.filter((e) => e.operation === 'remove_tag');
      expect(removeOps).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────
  // Sync queue helpers
  // ──────────────────────────────────────────────────

  describe('getPendingSyncQueue', () => {
    it('should return entries in dependency order (creates first)', async () => {
      const { createNoteOffline, addTagToNoteOffline, getPendingSyncQueue } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'N', '<p>N</p>');

      await seedTag('tag-order-1', 'Order', 'clay');
      await addTagToNoteOffline(TEST_USER_ID, note.id, 'tag-order-1');

      const queue = await getPendingSyncQueue(TEST_USER_ID);

      // Creates should come before add_tag
      const createIdx = queue.findIndex((e) => e.operation === 'create');
      const addTagIdx = queue.findIndex((e) => e.operation === 'add_tag');
      expect(createIdx).toBeLessThan(addTagIdx);
    });
  });

  describe('getPendingSyncCount', () => {
    it('should return count of pending operations', async () => {
      const { createNoteOffline, getPendingSyncCount } = await import('./offlineNotes');

      expect(await getPendingSyncCount(TEST_USER_ID)).toBe(0);

      await createNoteOffline(TEST_USER_ID, 'A');
      await createNoteOffline(TEST_USER_ID, 'B');

      expect(await getPendingSyncCount(TEST_USER_ID)).toBe(2);
    });
  });

  // ──────────────────────────────────────────────────
  // Server → local realtime sync
  // ──────────────────────────────────────────────────

  describe('upsertNoteFromServer', () => {
    it('should insert new note from server', async () => {
      const { upsertNoteFromServer } = await import('./offlineNotes');

      const serverNote = {
        id: 'server-note-1',
        title: 'From Server',
        content: '<p>Server content</p>',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        pinned: false,
        deletedAt: null,
      };

      await upsertNoteFromServer(TEST_USER_ID, serverNote);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get('server-note-1');

      expect(stored).toBeDefined();
      expect(stored!.title).toBe('From Server');
      expect(stored!.syncStatus).toBe('synced');
    });

    it('should update existing synced note from server', async () => {
      const { createNoteOffline, upsertNoteFromServer } = await import('./offlineNotes');

      const local = await createNoteOffline(TEST_USER_ID, 'Local', '<p>L</p>');

      // Mark as synced
      const db = getOfflineDb(TEST_USER_ID);
      await db.notes.update(local.id, { syncStatus: 'synced' });

      const serverNote = {
        id: local.id,
        title: 'Updated From Server',
        content: '<p>Server version</p>',
        createdAt: local.createdAt,
        updatedAt: new Date(Date.now() + 10000), // newer
        tags: [],
        pinned: true,
        deletedAt: null,
      };

      await upsertNoteFromServer(TEST_USER_ID, serverNote);

      const stored = await db.notes.get(local.id);
      expect(stored!.title).toBe('Updated From Server');
      expect(stored!.pinned).toBe(true);
    });

    it('should NOT overwrite local note with pending changes', async () => {
      const { createNoteOffline, upsertNoteFromServer } = await import('./offlineNotes');

      const local = await createNoteOffline(TEST_USER_ID, 'My Edit', '<p>Edited</p>');

      const serverNote = {
        id: local.id,
        title: 'Server Override',
        content: '<p>Override</p>',
        createdAt: local.createdAt,
        updatedAt: new Date(Date.now() + 10000),
        tags: [],
        pinned: false,
        deletedAt: null,
      };

      await upsertNoteFromServer(TEST_USER_ID, serverNote);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(local.id);

      // Local pending changes should be preserved — syncStatus stays pending
      // (upsertNoteFromServer preserves pending status even if it updates data)
      expect(stored!.syncStatus).toBe('pending');
    });

    it('should not create sync queue entries (server → local path)', async () => {
      const { upsertNoteFromServer } = await import('./offlineNotes');

      const serverNote = {
        id: 'no-queue-note',
        title: 'No Queue',
        content: '<p>NQ</p>',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        pinned: false,
        deletedAt: null,
      };

      await upsertNoteFromServer(TEST_USER_ID, serverNote);

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();

      expect(queue).toHaveLength(0);
    });
  });

  describe('deleteNoteFromServer', () => {
    it('should remove note and tag associations from IndexedDB', async () => {
      const { createNoteOffline, deleteNoteFromServer } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'To Remove', '<p>R</p>');

      const db = getOfflineDb(TEST_USER_ID);
      await db.noteTags.add({ noteId: note.id, tagId: 'some-tag', syncStatus: 'synced', lastSyncedAt: Date.now() });

      // Clear the sync queue from the create operation
      await db.syncQueue.clear();

      await deleteNoteFromServer(TEST_USER_ID, note.id);

      const stored = await db.notes.get(note.id);
      expect(stored).toBeUndefined();

      const associations = await db.noteTags.where('noteId').equals(note.id).toArray();
      expect(associations).toHaveLength(0);

      // Should NOT have created any sync queue entries
      const queue = await db.syncQueue.toArray();
      expect(queue).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────
  // Batch operations
  // ──────────────────────────────────────────────────

  describe('createNotesBatchOffline', () => {
    it('should bulk-create notes with sync queue entries', async () => {
      const { createNotesBatchOffline, fetchNotesOffline } = await import('./offlineNotes');

      const batch = [
        { title: 'Batch 1', content: '<p>B1</p>' },
        { title: 'Batch 2', content: '<p>B2</p>' },
        { title: 'Batch 3', content: '<p>B3</p>' },
      ];

      const results = await createNotesBatchOffline(TEST_USER_ID, batch);

      expect(results).toHaveLength(3);

      const allNotes = await fetchNotesOffline(TEST_USER_ID);
      expect(allNotes).toHaveLength(3);

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();
      expect(queue).toHaveLength(3);
    });

    it('should report progress', async () => {
      const { createNotesBatchOffline } = await import('./offlineNotes');

      const batch = Array.from({ length: 5 }, (_, i) => ({
        title: `Note ${i}`,
        content: `<p>${i}</p>`,
      }));

      const progressCalls: Array<[number, number]> = [];
      await createNotesBatchOffline(TEST_USER_ID, batch, (completed, total) => {
        progressCalls.push([completed, total]);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      const last = progressCalls[progressCalls.length - 1];
      expect(last[0]).toBe(5);
      expect(last[1]).toBe(5);
    });
  });

  // ──────────────────────────────────────────────────
  // markNoteSynced
  // ──────────────────────────────────────────────────

  describe('markNoteSynced', () => {
    it('should update sync status and server timestamp', async () => {
      const { createNoteOffline, markNoteSynced } = await import('./offlineNotes');

      const note = await createNoteOffline(TEST_USER_ID, 'Sync Me', '<p>S</p>');
      const serverTime = new Date('2026-01-15T12:00:00Z');

      await markNoteSynced(TEST_USER_ID, note.id, serverTime);

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(note.id);

      expect(stored!.syncStatus).toBe('synced');
      expect(stored!.lastSyncedAt).toBe(serverTime.getTime());
      expect(stored!.serverUpdatedAt).toBe(serverTime.getTime());
    });
  });
});
