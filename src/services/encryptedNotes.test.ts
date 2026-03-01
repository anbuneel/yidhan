/**
 * encryptedNotes.test.ts — Phase 1 Offline/Encrypted Data Pipeline
 *
 * Tests the encrypt/decrypt wrapper layer that sits between the app and
 * IndexedDB storage. Every note passes through this layer — a bug here
 * means data corruption or loss.
 *
 * Uses fake-indexeddb for Dexie and real Web Crypto for encryption roundtrips.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import Dexie from 'dexie';
import type { DerivedKeys } from '../lib/encryption';
import { getOfflineDb } from '../lib/offlineDb';

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

// Helper: derive real crypto keys for testing (lightweight, no Argon2id)
async function deriveTestKeys(): Promise<DerivedKeys> {
  const c = globalThis.crypto;
  const rawEnc = c.getRandomValues(new Uint8Array(32));
  const rawHash = c.getRandomValues(new Uint8Array(32));
  const salt = c.getRandomValues(new Uint8Array(16));

  const encryptionKey = await crypto.subtle.importKey(
    'raw', rawEnc, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
  const hashKey = await crypto.subtle.importKey(
    'raw', rawHash, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );

  return { encryptionKey, hashKey, salt, rawEncryptionKey: rawEnc, rawHashKey: rawHash };
}

const TEST_USER_ID = 'test-user-encrypted';

describe('encryptedNotes', () => {
  let keys: DerivedKeys;

  beforeEach(async () => {
    keys = await deriveTestKeys();
    // Clear tables between tests (don't close — getOfflineDb caches the instance)
    const db = getOfflineDb(TEST_USER_ID);
    await db.notes.clear();
    await db.syncQueue.clear();
    await db.noteTags.clear();
    await db.tags.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    // Full cleanup: close and delete the database after all tests
    const db = getOfflineDb(TEST_USER_ID);
    db.close();
    await Dexie.delete(db.name);
  });

  // ──────────────────────────────────────────────────
  // createEncryptedNote
  // ──────────────────────────────────────────────────

  describe('createEncryptedNote', () => {
    it('should create a note and return decrypted title/content', async () => {
      const { createEncryptedNote } = await import('./encryptedNotes');

      const result = await createEncryptedNote(
        TEST_USER_ID, 'My Title', '<p>Hello world</p>', keys
      );

      expect(result.title).toBe('My Title');
      expect(result.content).toBe('<p>Hello world</p>');
      expect(result.id).toBeDefined();
      expect(result.tags).toEqual([]);
      expect(result.pinned).toBe(false);
      expect(result.syncStatus).toBe('pending');
    });

    it('should store encrypted payload in IndexedDB (not plaintext)', async () => {
      const { createEncryptedNote } = await import('./encryptedNotes');

      const result = await createEncryptedNote(
        TEST_USER_ID, 'Secret Title', '<p>Secret content</p>', keys
      );

      const db = getOfflineDb(TEST_USER_ID);
      const stored = await db.notes.get(result.id);

      expect(stored).toBeDefined();
      // Title and content in IDB should be empty strings (ciphertext is in encryptedPayload)
      expect(stored!.title).toBe('');
      expect(stored!.content).toBe('');
      // Encrypted fields should be set
      expect(stored!.encryptedPayload).toBeTruthy();
      expect(stored!.encryptionIv).toBeTruthy();
      expect(stored!.encryptionVersion).toBe(1);
      expect(stored!.contentHash).toBeTruthy();
    });

    it('should create a sync queue entry with encrypted payload', async () => {
      const { createEncryptedNote } = await import('./encryptedNotes');

      const result = await createEncryptedNote(
        TEST_USER_ID, 'Queue Test', '<p>Queued</p>', keys
      );

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();

      expect(queue).toHaveLength(1);
      expect(queue[0].operation).toBe('create');
      expect(queue[0].entityType).toBe('note');
      expect(queue[0].entityId).toBe(result.id);

      const payload = queue[0].payload as Record<string, unknown>;
      expect(payload.title).toBe('');
      expect(payload.content).toBe('');
      expect(payload.encrypted_payload).toBeTruthy();
      expect(payload.encryption_iv).toBeTruthy();
    });

    it('should produce unique IVs for each note', async () => {
      const { createEncryptedNote } = await import('./encryptedNotes');

      const note1 = await createEncryptedNote(TEST_USER_ID, 'Note 1', 'Content 1', keys);
      const note2 = await createEncryptedNote(TEST_USER_ID, 'Note 2', 'Content 2', keys);

      expect(note1.encryptionIv).not.toBe(note2.encryptionIv);
    });

    it('should handle empty title gracefully', async () => {
      const { createEncryptedNote } = await import('./encryptedNotes');

      const result = await createEncryptedNote(TEST_USER_ID, '', '<p>Content</p>', keys);

      expect(result.title).toBe('');
      expect(result.content).toBe('<p>Content</p>');
    });

    it('should handle empty content gracefully', async () => {
      const { createEncryptedNote } = await import('./encryptedNotes');

      const result = await createEncryptedNote(TEST_USER_ID, 'Title Only', '', keys);

      expect(result.title).toBe('Title Only');
      expect(result.content).toBe('');
    });
  });

  // ──────────────────────────────────────────────────
  // updateEncryptedNote
  // ──────────────────────────────────────────────────

  describe('updateEncryptedNote', () => {
    it('should update a note and return new decrypted content', async () => {
      const { createEncryptedNote, updateEncryptedNote } = await import('./encryptedNotes');

      const created = await createEncryptedNote(
        TEST_USER_ID, 'Original', '<p>Original content</p>', keys
      );

      const updated = await updateEncryptedNote(
        TEST_USER_ID, created.id, 'Updated Title', '<p>Updated content</p>', keys
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('<p>Updated content</p>');
      expect(updated.id).toBe(created.id);
      expect(updated.syncStatus).toBe('pending');
    });

    it('should re-encrypt with a new IV on update', async () => {
      const { createEncryptedNote, updateEncryptedNote } = await import('./encryptedNotes');

      const created = await createEncryptedNote(
        TEST_USER_ID, 'Original', '<p>Content</p>', keys
      );
      const originalIv = created.encryptionIv;

      const updated = await updateEncryptedNote(
        TEST_USER_ID, created.id, 'Updated', '<p>New content</p>', keys
      );

      expect(updated.encryptionIv).not.toBe(originalIv);
    });

    it('should compact previous update entries in sync queue', async () => {
      const { createEncryptedNote, updateEncryptedNote } = await import('./encryptedNotes');

      const created = await createEncryptedNote(
        TEST_USER_ID, 'Note', '<p>V1</p>', keys
      );

      await updateEncryptedNote(TEST_USER_ID, created.id, 'Note', '<p>V2</p>', keys);
      await updateEncryptedNote(TEST_USER_ID, created.id, 'Note', '<p>V3</p>', keys);

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();
      const updateEntries = queue.filter(
        (e) => e.operation === 'update' && e.entityId === created.id
      );

      // Should have compacted to 1 update entry (plus the original create)
      expect(updateEntries).toHaveLength(1);
    });

    it('should throw for non-existent note', async () => {
      const { updateEncryptedNote } = await import('./encryptedNotes');

      await expect(
        updateEncryptedNote(TEST_USER_ID, 'non-existent-id', 'Title', 'Content', keys)
      ).rejects.toThrow('not found');
    });
  });

  // ──────────────────────────────────────────────────
  // fetchDecryptedNotes
  // ──────────────────────────────────────────────────

  describe('fetchDecryptedNotes', () => {
    it('should decrypt all notes and return plaintext', async () => {
      const { createEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');

      await createEncryptedNote(TEST_USER_ID, 'Note A', '<p>Content A</p>', keys);
      await createEncryptedNote(TEST_USER_ID, 'Note B', '<p>Content B</p>', keys);

      const notes = await fetchDecryptedNotes(TEST_USER_ID, keys);

      expect(notes).toHaveLength(2);
      const titles = notes.map((n) => n.title).sort();
      expect(titles).toEqual(['Note A', 'Note B']);
    });

    it('should return empty array when no notes exist', async () => {
      const { fetchDecryptedNotes } = await import('./encryptedNotes');

      const notes = await fetchDecryptedNotes(TEST_USER_ID, keys);

      expect(notes).toEqual([]);
    });

    it('should skip corrupted notes without blocking others', async () => {
      const { createEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');

      // Create a valid note
      await createEncryptedNote(TEST_USER_ID, 'Valid Note', '<p>Valid</p>', keys);

      // Manually insert a corrupted note into IDB
      const db = getOfflineDb(TEST_USER_ID);
      await db.notes.add({
        id: 'corrupted-note',
        userId: TEST_USER_ID,
        title: '',
        content: '',
        pinned: false,
        deletedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncStatus: 'synced',
        lastSyncedAt: null,
        serverUpdatedAt: null,
        localUpdatedAt: Date.now(),
        encryptedPayload: 'this-is-not-valid-base64-ciphertext!!!',
        encryptionIv: 'also-not-valid',
        encryptionVersion: 1,
        contentHash: null,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const notes = await fetchDecryptedNotes(TEST_USER_ID, keys);

      // Should return the valid note, skipping the corrupted one
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Valid Note');

      // Should have logged the failure
      expect(consoleSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 failed'),
      );

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should fail to decrypt with wrong keys', async () => {
      const { createEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');

      await createEncryptedNote(TEST_USER_ID, 'Secret', '<p>Secret</p>', keys);

      const wrongKeys = await deriveTestKeys();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const notes = await fetchDecryptedNotes(TEST_USER_ID, wrongKeys);

      // Decryption with wrong key should fail — note skipped
      expect(notes).toHaveLength(0);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  // ──────────────────────────────────────────────────
  // fetchDecryptedFadedNotes
  // ──────────────────────────────────────────────────

  describe('fetchDecryptedFadedNotes', () => {
    it('should return only soft-deleted notes, decrypted', async () => {
      const { createEncryptedNote, fetchDecryptedFadedNotes } = await import('./encryptedNotes');

      // Create a regular note
      await createEncryptedNote(TEST_USER_ID, 'Active', '<p>Active</p>', keys);

      // Create a soft-deleted note directly in IDB
      const { encryptNote } = await import('../lib/encryption');
      const fadedId = 'faded-note-id';
      const encrypted = await encryptNote(fadedId, TEST_USER_ID, 'Faded', '<p>Faded</p>', keys);

      const db = getOfflineDb(TEST_USER_ID);
      await db.notes.add({
        id: fadedId,
        userId: TEST_USER_ID,
        title: '',
        content: '',
        pinned: false,
        deletedAt: Date.now(),
        createdAt: Date.now() - 10000,
        updatedAt: Date.now(),
        syncStatus: 'synced',
        lastSyncedAt: null,
        serverUpdatedAt: null,
        localUpdatedAt: Date.now(),
        encryptedPayload: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        encryptionVersion: encrypted.version,
        contentHash: encrypted.contentHash,
      });

      const fadedNotes = await fetchDecryptedFadedNotes(TEST_USER_ID, keys);

      expect(fadedNotes).toHaveLength(1);
      expect(fadedNotes[0].title).toBe('Faded');
      expect(fadedNotes[0].deletedAt).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────
  // searchDecryptedNotes
  // ──────────────────────────────────────────────────

  describe('searchDecryptedNotes', () => {
    it('should find notes by title', async () => {
      const { createEncryptedNote, searchDecryptedNotes } = await import('./encryptedNotes');

      await createEncryptedNote(TEST_USER_ID, 'Meeting Notes', '<p>Agenda</p>', keys);
      await createEncryptedNote(TEST_USER_ID, 'Shopping List', '<p>Milk</p>', keys);

      const results = await searchDecryptedNotes(TEST_USER_ID, 'meeting', keys);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Meeting Notes');
    });

    it('should find notes by content (stripping HTML)', async () => {
      const { createEncryptedNote, searchDecryptedNotes } = await import('./encryptedNotes');

      await createEncryptedNote(TEST_USER_ID, 'Recipe', '<p>Add <b>flour</b> and sugar</p>', keys);
      await createEncryptedNote(TEST_USER_ID, 'Todo', '<p>Buy eggs</p>', keys);

      const results = await searchDecryptedNotes(TEST_USER_ID, 'flour', keys);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Recipe');
    });

    it('should return all notes for empty query', async () => {
      const { createEncryptedNote, searchDecryptedNotes } = await import('./encryptedNotes');

      await createEncryptedNote(TEST_USER_ID, 'A', '<p>A</p>', keys);
      await createEncryptedNote(TEST_USER_ID, 'B', '<p>B</p>', keys);

      const results = await searchDecryptedNotes(TEST_USER_ID, '  ', keys);

      expect(results).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────
  // decryptNoteFromServer
  // ──────────────────────────────────────────────────

  describe('decryptNoteFromServer', () => {
    it('should decrypt an encrypted note from server event', async () => {
      const { decryptNoteFromServer } = await import('./encryptedNotes');
      const { encryptNote } = await import('../lib/encryption');

      const noteId = 'server-note-123';
      const encrypted = await encryptNote(noteId, TEST_USER_ID, 'Server Note', '<p>From server</p>', keys);

      const serverNote = {
        id: noteId,
        title: '',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        pinned: false,
        deletedAt: null,
        encryptedPayload: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        encryptionVersion: encrypted.version,
        contentHash: encrypted.contentHash,
      };

      const decrypted = await decryptNoteFromServer(serverNote, TEST_USER_ID, keys);

      expect(decrypted.title).toBe('Server Note');
      expect(decrypted.content).toBe('<p>From server</p>');
    });

    it('should return unencrypted note as-is', async () => {
      const { decryptNoteFromServer } = await import('./encryptedNotes');

      const plainNote = {
        id: 'plain-note',
        title: 'Plain Title',
        content: '<p>Plain content</p>',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        pinned: false,
        deletedAt: null,
      };

      const result = await decryptNoteFromServer(plainNote, TEST_USER_ID, keys);

      expect(result.title).toBe('Plain Title');
      expect(result.content).toBe('<p>Plain content</p>');
    });

    it('should throw on partial encryption state (payload but no IV)', async () => {
      const { decryptNoteFromServer } = await import('./encryptedNotes');

      const corruptNote = {
        id: 'corrupt-note',
        title: '',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        pinned: false,
        deletedAt: null,
        encryptedPayload: 'some-payload',
        encryptionIv: null,
      };

      await expect(
        decryptNoteFromServer(corruptNote, TEST_USER_ID, keys)
      ).rejects.toThrow('corrupted encryption state');
    });
  });

  // ──────────────────────────────────────────────────
  // createEncryptedNotesBatch
  // ──────────────────────────────────────────────────

  describe('createEncryptedNotesBatch', () => {
    it('should batch-create multiple encrypted notes', async () => {
      const { createEncryptedNotesBatch, fetchDecryptedNotes } = await import('./encryptedNotes');

      const batch = [
        { title: 'Batch 1', content: '<p>Content 1</p>' },
        { title: 'Batch 2', content: '<p>Content 2</p>' },
        { title: 'Batch 3', content: '<p>Content 3</p>' },
      ];

      const results = await createEncryptedNotesBatch(TEST_USER_ID, batch, keys);

      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Batch 1');
      expect(results[2].title).toBe('Batch 3');

      // Verify they can be read back
      const allNotes = await fetchDecryptedNotes(TEST_USER_ID, keys);
      expect(allNotes).toHaveLength(3);
    });

    it('should report progress', async () => {
      const { createEncryptedNotesBatch } = await import('./encryptedNotes');

      const batch = Array.from({ length: 5 }, (_, i) => ({
        title: `Note ${i}`,
        content: `<p>Content ${i}</p>`,
      }));

      const progressCalls: Array<[number, number]> = [];
      await createEncryptedNotesBatch(TEST_USER_ID, batch, keys, (completed, total) => {
        progressCalls.push([completed, total]);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      // Last progress call should report all complete
      const last = progressCalls[progressCalls.length - 1];
      expect(last[0]).toBe(5);
      expect(last[1]).toBe(5);
    });

    it('should preserve custom timestamps', async () => {
      const { createEncryptedNotesBatch } = await import('./encryptedNotes');

      const customDate = new Date('2024-06-15T10:00:00Z');
      const batch = [
        { title: 'Old Note', content: '<p>Old</p>', createdAt: customDate, updatedAt: customDate },
      ];

      const results = await createEncryptedNotesBatch(TEST_USER_ID, batch, keys);

      expect(results[0].createdAt.getTime()).toBe(customDate.getTime());
      expect(results[0].updatedAt.getTime()).toBe(customDate.getTime());
    });

    it('should create sync queue entries for each note', async () => {
      const { createEncryptedNotesBatch } = await import('./encryptedNotes');

      const batch = [
        { title: 'A', content: '<p>A</p>' },
        { title: 'B', content: '<p>B</p>' },
      ];

      await createEncryptedNotesBatch(TEST_USER_ID, batch, keys);

      const db = getOfflineDb(TEST_USER_ID);
      const queue = await db.syncQueue.toArray();

      expect(queue).toHaveLength(2);
      expect(queue.every((e) => e.operation === 'create')).toBe(true);
    });
  });
});
