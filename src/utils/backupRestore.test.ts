/**
 * The restore test item 38's "done when" asks for.
 *
 * It goes the whole way: a real account export, sealed under a real backup passphrase,
 * opened again and imported into an **empty** offline database — the "fresh browser
 * profile" of the acceptance criterion, which is what `fake-indexeddb` starting from
 * nothing gives us. Then it checks that what came out is what went in: the words, the
 * tags, the pinned state, and the original timestamps.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { deriveKeys } from '../lib/encryption';
import type { DerivedKeys } from '../lib/encryption';
import { exportFullAccountData, parseImportedJSON } from './exportImport';
import { sanitizeHtml } from './sanitize';
import {
  BackupFormatError,
  BackupPassphraseError,
  createEncryptedBackup,
  openEncryptedBackup,
} from './encryptedBackup';
import { createEncryptedNotesBatch, fetchDecryptedNotes } from '../services/encryptedNotes';
import { createTagOffline, fetchTagsOffline } from '../services/offlineTags';
import { addTagToNoteOffline } from '../services/offlineNotes';
import { clearOfflineDb, getOfflineDb } from '../lib/offlineDb';
import type { Note, Tag } from '../types';

vi.mock('../utils/reliabilityTelemetry', () => ({
  reportReliabilityIssue: vi.fn(),
}));

const RESTORING_USER = 'restoring-user';
const BACKUP_PASSPHRASE = 'a-long-enough-backup-passphrase';

/** Argon2id at 64MB is slow by design; these tests derive real keys twice over. */
const SLOW = 60_000;

const journal: Tag = {
  id: 'tag-journal',
  name: 'Journal',
  color: 'terracotta',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const ORIGINAL_NOTES: Note[] = [
  {
    id: 'note-pinned',
    title: 'The one I keep at the top',
    content: '<p>Pinned, tagged, and old.</p>',
    createdAt: new Date('2026-02-01T09:00:00.000Z'),
    updatedAt: new Date('2026-03-04T17:30:00.000Z'),
    tags: [journal],
    pinned: true,
  },
  {
    id: 'note-plain',
    title: 'An ordinary one',
    content: '<p>Untagged and unpinned.</p>',
    createdAt: new Date('2026-02-02T09:00:00.000Z'),
    updatedAt: new Date('2026-02-02T09:00:00.000Z'),
    tags: [],
    pinned: false,
  },
];

/** Everything the app does when a reader opens a `.yidhan` file and confirms. */
async function restoreInto(userId: string, keys: DerivedKeys, backupFile: string) {
  const payload = await openEncryptedBackup(backupFile, BACKUP_PASSPHRASE);
  const data = parseImportedJSON(payload);

  const tagIdsByName = new Map<string, string>();
  for (const tag of data.tags) {
    const created = await createTagOffline(userId, tag.name, tag.color);
    tagIdsByName.set(tag.name, created.id);
  }

  const created = await createEncryptedNotesBatch(
    userId,
    data.notes.map((note) => ({
      title: note.title,
      content: sanitizeHtml(note.content),
      pinned: note.pinned,
      // Same conversion the app's import path does — the export carries ISO strings.
      createdAt: note.createdAt ? new Date(note.createdAt) : undefined,
      updatedAt: note.updatedAt ? new Date(note.updatedAt) : undefined,
    })),
    keys
  );

  for (const [index, note] of created.entries()) {
    for (const tagName of data.notes[index].tags) {
      const tagId = tagIdsByName.get(tagName);
      if (tagId) await addTagToNoteOffline(userId, note.id, tagId, { preserveUpdatedAt: true });
    }
  }

  return created;
}

describe('restoring a .yidhan backup into a fresh profile', () => {
  let keys: DerivedKeys;
  let backupFile: string;

  beforeEach(async () => {
    // A fresh browser profile: no notes, no tags, no queue.
    getOfflineDb(RESTORING_USER);
    await clearOfflineDb();
    keys = await deriveKeys(BACKUP_PASSPHRASE);
    backupFile = await createEncryptedBackup(
      exportFullAccountData(ORIGINAL_NOTES, [journal], [], {
        displayName: 'A Writer',
        email: 'writer@example.com',
      }),
      BACKUP_PASSPHRASE
    );
  }, SLOW);

  it('brings back every note, its tags, its pin and its dates', async () => {
    await restoreInto(RESTORING_USER, keys, backupFile);

    const restored = await fetchDecryptedNotes(RESTORING_USER, keys);
    expect(restored).toHaveLength(2);

    const pinned = restored.find((n) => n.title === 'The one I keep at the top');
    expect(pinned).toBeDefined();
    expect(pinned!.content).toBe('<p>Pinned, tagged, and old.</p>');
    expect(pinned!.pinned).toBe(true);
    expect(pinned!.tags.map((t) => t.name)).toEqual(['Journal']);
    // A restore that stamps every note "today" has lost the chronology, which is half
    // of what a library of old notes is.
    expect(pinned!.createdAt.toISOString()).toBe('2026-02-01T09:00:00.000Z');
    expect(pinned!.updatedAt.toISOString()).toBe('2026-03-04T17:30:00.000Z');

    const plain = restored.find((n) => n.title === 'An ordinary one');
    expect(plain!.pinned).toBe(false);
    expect(plain!.tags).toEqual([]);
    expect(plain!.createdAt.toISOString()).toBe('2026-02-02T09:00:00.000Z');
  }, SLOW);

  it('brings back the tags themselves, not only the links', async () => {
    await restoreInto(RESTORING_USER, keys, backupFile);

    const tags = await fetchTagsOffline(RESTORING_USER);
    expect(tags.map((t) => t.name)).toEqual(['Journal']);
    expect(tags[0].color).toBe('terracotta');
  }, SLOW);

  it('stores the restored notes encrypted, not as plaintext', async () => {
    const created = await restoreInto(RESTORING_USER, keys, backupFile);

    // The restore goes through the ordinary encrypted create path, so the fresh
    // profile is no less protected than the one the backup came from.
    for (const note of created) {
      expect(note.encryptedPayload).toBeTruthy();
      expect(note.encryptionIv).toBeTruthy();
    }
  }, SLOW);

  it('refuses a truncated file before it writes anything', async () => {
    const truncated = backupFile.slice(0, Math.floor(backupFile.length / 2));

    await expect(restoreInto(RESTORING_USER, keys, truncated)).rejects.toBeInstanceOf(
      BackupFormatError
    );

    // Nothing half-restored: the file is rejected before the first note is created.
    expect(await fetchDecryptedNotes(RESTORING_USER, keys)).toEqual([]);
  }, SLOW);

  it('refuses the wrong passphrase before it writes anything', async () => {
    await expect(
      openEncryptedBackup(backupFile, 'not-the-backup-passphrase')
    ).rejects.toBeInstanceOf(BackupPassphraseError);

    expect(await fetchDecryptedNotes(RESTORING_USER, keys)).toEqual([]);
  }, SLOW);
});
