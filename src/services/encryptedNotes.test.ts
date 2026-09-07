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
import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from 'vitest';
import Dexie from 'dexie';
import type { DerivedKeys } from '../lib/encryption';
import { getOfflineDb } from '../lib/offlineDb';

const mockReportReliabilityIssue = vi.fn();

vi.mock('../utils/reliabilityTelemetry', () => ({
  reportReliabilityIssue: mockReportReliabilityIssue,
}));

// Helper: derive real crypto keys for testing (lightweight, no Argon2id)
async function deriveTestKeys(): Promise<DerivedKeys> {
  const c = globalThis.crypto;
  const rawEnc = c.getRandomValues(new Uint8Array(32));
  const rawHash = c.getRandomValues(new Uint8Array(32));
  const salt = c.getRandomValues(new Uint8Array(16));

  const encryptionKey = await c.subtle.importKey(
    'raw', rawEnc, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
  const hashKey = await c.subtle.importKey(
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

  it('refreshes readable tag labels when their definition arrives after membership', async () => {
    const { createEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');
    const { upsertTagFromServer } = await import('./offlineNotes');
    const note = await createEncryptedNote(TEST_USER_ID, 'Journal', '<p>Words</p>', keys);
    await getOfflineDb(TEST_USER_ID).noteTags.put({ noteId: note.id, tagId: 'late-tag', syncStatus: 'synced', lastSyncedAt: 1 });
    expect((await fetchDecryptedNotes(TEST_USER_ID, keys))[0].tags).toEqual([]);
    await upsertTagFromServer(TEST_USER_ID, { id: 'late-tag', name: 'Journal', color: 'sage', createdAt: new Date(1) });
    expect((await fetchDecryptedNotes(TEST_USER_ID, keys))[0].tags[0].name).toBe('Journal');
  });

  it.each(['local', 'server'] as const)('preserves both encrypted bodies when choosing %s', async choice => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { createEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');
    const { encryptNote } = await import('../lib/encryption');
    const { resolveConflict } = await import('../hooks/useSyncEngine');
    const note = await createEncryptedNote(TEST_USER_ID, 'L'.repeat(200), '<p>Local words</p>', keys);
    const local = (await getOfflineDb(TEST_USER_ID).notes.get(note.id))!;
    const remote = await encryptNote(note.id, TEST_USER_ID, 'R'.repeat(200), '<p>Remote words</p>', keys);
    await resolveConflict(TEST_USER_ID, { entityType: 'note', entityId: note.id, localVersion: local,
      serverVersion: { id: note.id, title: '', content: '', pinned: false, deleted_at: null,
        created_at: new Date(1).toISOString(), updated_at: new Date(2).toISOString(),
        encrypted_payload: remote.ciphertext, encryption_iv: remote.iv, encryption_version: 1, content_hash: remote.contentHash,
      } }, choice, keys);
    const restored = await fetchDecryptedNotes(TEST_USER_ID, keys);
    expect(restored.map(n => n.content).sort()).toEqual(['<p>Local words</p>', '<p>Remote words</p>']);
    expect(restored.find(n => n.id !== note.id)?.title).toContain('(conflict copy)');
    expect(restored.find(n => n.id !== note.id)?.title).toHaveLength(200);
    expect((await getOfflineDb(TEST_USER_ID).notes.toArray()).every(n => n.title === '' && n.content === '')).toBe(true);
  });

  it('reuses the conflict copy when a failed resolution is retried', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { createEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');
    const { encryptNote } = await import('../lib/encryption');
    const { resolveConflict } = await import('../hooks/useSyncEngine');
    const db = getOfflineDb(TEST_USER_ID);
    const note = await createEncryptedNote(TEST_USER_ID, 'Local', '<p>Local words</p>', keys);
    const local = (await db.notes.get(note.id))!;
    const remote = await encryptNote(note.id, TEST_USER_ID, 'Remote', '<p>Remote words</p>', keys);
    const conflict = { entityType: 'note' as const, entityId: note.id, localVersion: local,
      serverVersion: { id: note.id, title: '', content: '', pinned: false, deleted_at: null,
        created_at: new Date(1).toISOString(), updated_at: new Date(2).toISOString(),
        encrypted_payload: remote.ciphertext, encryption_iv: remote.iv, encryption_version: 1, content_hash: remote.contentHash,
      } };

    // Fail once immediately after the losing version has been copied.
    const where = vi.spyOn(db.noteTags, 'where').mockImplementationOnce(() => { throw new Error('Queue unavailable'); });
    await expect(resolveConflict(TEST_USER_ID, conflict, 'local', keys)).rejects.toThrow('Queue unavailable');
    where.mockRestore();

    await resolveConflict(TEST_USER_ID, conflict, 'local', keys);
    const restored = await fetchDecryptedNotes(TEST_USER_ID, keys);
    expect(restored.filter(n => n.title.includes('(conflict copy)'))).toHaveLength(1);
    expect(restored.map(n => n.content).sort()).toEqual(['<p>Local words</p>', '<p>Remote words</p>']);
  });

  // ──────────────────────────────────────────────────
  // createEncryptedNote
  // ──────────────────────────────────────────────────

  it('reopens the durable checkpoint and never acknowledges newer local content as synced', async () => {
    const { createEncryptedNote, updateEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');
    const { markNoteSynced } = await import('./offlineNotes');
    const original = await createEncryptedNote(TEST_USER_ID, 'Before', '<p>Before</p>', keys);
    const saved = await updateEncryptedNote(TEST_USER_ID, original.id, 'Checkpoint', '<p>Durable words</p>', keys);
    const db = getOfflineDb(TEST_USER_ID);
    const stored = await db.notes.get(original.id);
    expect(stored?.title).toBe('');
    expect(stored?.content).toBe('');
    expect(JSON.stringify(stored)).not.toContain('Durable words');
    const reopened = await fetchDecryptedNotes(TEST_USER_ID, keys);
    expect(reopened.find(note => note.id === original.id)?.content).toBe('<p>Durable words</p>');
    await markNoteSynced(TEST_USER_ID, original.id, new Date(), original.contentHash);
    expect((await db.notes.get(original.id))?.syncStatus).toBe('pending');
    await markNoteSynced(TEST_USER_ID, original.id, new Date(), saved.contentHash);
    expect((await db.notes.get(original.id))?.syncStatus).toBe('synced');
    await markNoteSynced(TEST_USER_ID, original.id, new Date(), null);
    expect((await db.notes.get(original.id))?.confirmedContentHash).toBeNull();
    expect((await db.notes.get(original.id))?.syncStatus).toBe('pending');
  });

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

    it('should fail closed when any note is corrupted', async () => {
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
      await expect(fetchDecryptedNotes(TEST_USER_ID, keys)).rejects.toThrow(
        'Failed to decrypt 1 of 2 notes'
      );

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'vault',
          message: 'Encrypted note decryption failed',
        }),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('should fail to decrypt with wrong keys', async () => {
      const { createEncryptedNote, fetchDecryptedNotes } = await import('./encryptedNotes');

      await createEncryptedNote(TEST_USER_ID, 'Secret', '<p>Secret</p>', keys);

      const wrongKeys = await deriveTestKeys();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(fetchDecryptedNotes(TEST_USER_ID, wrongKeys)).rejects.toThrow(
        'Failed to decrypt 1 of 1 notes'
      );

      // Decryption with wrong key should fail — note skipped
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockReportReliabilityIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'vault',
          message: 'Encrypted note decryption failed',
        }),
        expect.anything()
      );

      consoleSpy.mockRestore();
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

    it('should reject unencrypted server notes', async () => {
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

      await expect(
        decryptNoteFromServer(plainNote, TEST_USER_ID, keys)
      ).rejects.toThrow('is not encrypted');
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
