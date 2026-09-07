import { describe, it, expect } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupFormatError,
  BackupPassphraseError,
  buildBackupFilename,
  createEncryptedBackup,
  openEncryptedBackup,
  parseBackupEnvelope,
  type EncryptedBackupEnvelope,
} from './encryptedBackup';
import { exportFullAccountData, parseImportedJSON } from './exportImport';
import type { Note, Tag } from '../types';

const PASSPHRASE = 'a-long-enough-backup-passphrase';

/**
 * Argon2id at 64 MB is slow by design. These tests derive real keys rather than mocking
 * the KDF, because the thing being tested is that a real file opens.
 */
const KDF_TIMEOUT = 30_000;

const journal: Tag = {
  id: 'tag-journal',
  name: 'Journal',
  color: 'terracotta',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const NOTES: Note[] = [
  {
    id: 'note-1',
    title: 'A pinned thought',
    content: '<p>Kept at the top.</p>',
    createdAt: new Date('2026-02-01T09:00:00.000Z'),
    updatedAt: new Date('2026-03-04T17:30:00.000Z'),
    tags: [journal],
    pinned: true,
  },
  {
    id: 'note-2',
    title: 'An ordinary one',
    content: '<p>Not pinned.</p>',
    createdAt: new Date('2026-02-02T09:00:00.000Z'),
    updatedAt: new Date('2026-02-02T09:00:00.000Z'),
    tags: [],
    pinned: false,
  },
];

function makePayload(): string {
  return exportFullAccountData(NOTES, [journal], [], {
    displayName: 'A Writer',
    email: 'writer@example.com',
  });
}

describe('createEncryptedBackup', () => {
  it('produces an envelope that names its own format and parameters', async () => {
    const file = await createEncryptedBackup(makePayload(), PASSPHRASE);
    const envelope = JSON.parse(file) as EncryptedBackupEnvelope;

    expect(envelope.format).toBe(BACKUP_FORMAT);
    expect(envelope.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(envelope.kdf.name).toBe('argon2id');
    expect(envelope.cipher.name).toBe('AES-256-GCM');
    expect(envelope.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, KDF_TIMEOUT);

  it('leaks nothing of the payload into the file', async () => {
    const file = await createEncryptedBackup(makePayload(), PASSPHRASE);

    expect(file).not.toContain('A pinned thought');
    expect(file).not.toContain('Kept at the top');
    expect(file).not.toContain('writer@example.com');
    expect(file).not.toContain('Journal');
  }, KDF_TIMEOUT);

  it('uses a fresh salt and nonce every time', async () => {
    const a = JSON.parse(await createEncryptedBackup('{}', PASSPHRASE)) as EncryptedBackupEnvelope;
    const b = JSON.parse(await createEncryptedBackup('{}', PASSPHRASE)) as EncryptedBackupEnvelope;

    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  }, KDF_TIMEOUT);

  it('refuses to seal without a passphrase', async () => {
    await expect(createEncryptedBackup('{}', '')).rejects.toBeInstanceOf(BackupFormatError);
  });
});

describe('a backup restores what went into it', () => {
  it('round-trips notes, tags, pinned state and original timestamps', async () => {
    const file = await createEncryptedBackup(makePayload(), PASSPHRASE);
    const restored = parseImportedJSON(await openEncryptedBackup(file, PASSPHRASE));

    expect(restored.version).toBe(2);
    expect(restored.notes).toHaveLength(2);

    const pinned = restored.notes.find((n) => n.title === 'A pinned thought');
    expect(pinned?.pinned).toBe(true);
    expect(pinned?.tags).toEqual(['Journal']);
    // The chronology is the point of a backup: a restore that renames every note
    // "today" has lost something even though every word survived.
    expect(pinned?.createdAt).toBe('2026-02-01T09:00:00.000Z');
    expect(pinned?.updatedAt).toBe('2026-03-04T17:30:00.000Z');

    const ordinary = restored.notes.find((n) => n.title === 'An ordinary one');
    expect(ordinary?.pinned).toBe(false);
    expect(ordinary?.tags).toEqual([]);

    expect(restored.tags.map((t) => t.name)).toEqual(['Journal']);
  }, KDF_TIMEOUT);

  it('survives a payload with no notes at all', async () => {
    const empty = exportFullAccountData([], [], [], { displayName: null, email: 'a@b.c' });
    const file = await createEncryptedBackup(empty, PASSPHRASE);

    const restored = parseImportedJSON(await openEncryptedBackup(file, PASSPHRASE));
    expect(restored.notes).toEqual([]);
  }, KDF_TIMEOUT);
});

describe('a backup that will not open', () => {
  it('rejects the wrong passphrase as a passphrase problem', async () => {
    const file = await createEncryptedBackup(makePayload(), PASSPHRASE);

    await expect(openEncryptedBackup(file, 'not-the-passphrase')).rejects.toBeInstanceOf(
      BackupPassphraseError
    );
  }, KDF_TIMEOUT);

  it('rejects a truncated file as damaged, not as a wrong passphrase', async () => {
    const file = await createEncryptedBackup(makePayload(), PASSPHRASE);
    const truncated = file.slice(0, Math.floor(file.length / 2));

    // The two failures need different messages: only one of them is something the
    // reader can do anything about.
    await expect(openEncryptedBackup(truncated, PASSPHRASE)).rejects.toBeInstanceOf(
      BackupFormatError
    );
    await expect(openEncryptedBackup(truncated, PASSPHRASE)).rejects.toThrow(
      /incomplete or damaged/i
    );
  }, KDF_TIMEOUT);

  it('rejects a file that is not a backup at all', () => {
    expect(() => parseBackupEnvelope(JSON.stringify({ version: 1, notes: [] }))).toThrow(
      /does not look like a Yidhan backup/i
    );
  });

  it('rejects a file that is not JSON', () => {
    expect(() => parseBackupEnvelope('not json at all')).toThrow(/incomplete or damaged/i);
  });

  it('rejects an array', () => {
    expect(() => parseBackupEnvelope('[]')).toThrow(/does not look like a Yidhan backup/i);
  });

  it('says so when the backup is from a newer version', () => {
    const envelope = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION + 1,
      createdAt: new Date().toISOString(),
      kdf: { name: 'argon2id', salt: 'x', iterations: 3, memorySize: 1, parallelism: 1 },
      cipher: { name: 'AES-256-GCM', iv: 'x' },
      ciphertext: 'x',
    };

    expect(() => parseBackupEnvelope(JSON.stringify(envelope))).toThrow(
      /newer version of Yidhan/i
    );
  });

  async function envelopeWith(
    mutate: (envelope: EncryptedBackupEnvelope) => void
  ): Promise<string> {
    const envelope = JSON.parse(
      await createEncryptedBackup('{}', PASSPHRASE)
    ) as EncryptedBackupEnvelope;
    mutate(envelope);
    return JSON.stringify(envelope);
  }

  it('rejects a salt of the wrong length', async () => {
    const file = await envelopeWith((e) => {
      e.kdf.salt = 'AAAA';
    });
    expect(() => parseBackupEnvelope(file)).toThrow(/salt is the wrong length/i);
  }, KDF_TIMEOUT);

  it('rejects a nonce of the wrong length', async () => {
    const file = await envelopeWith((e) => {
      e.cipher.iv = 'AAAA';
    });
    expect(() => parseBackupEnvelope(file)).toThrow(/nonce is the wrong length/i);
  }, KDF_TIMEOUT);

  it('rejects a ciphertext too short to carry an authentication tag', async () => {
    const file = await envelopeWith((e) => {
      e.ciphertext = 'AAAA';
    });
    expect(() => parseBackupEnvelope(file)).toThrow(/contents are missing/i);
  }, KDF_TIMEOUT);

  it('rejects non-numeric KDF parameters', async () => {
    const file = await envelopeWith((e) => {
      (e.kdf as unknown as Record<string, unknown>).iterations = 'three';
    });
    expect(() => parseBackupEnvelope(file)).toThrow(/iterations is not a number/i);
  }, KDF_TIMEOUT);

  it('refuses an envelope whose salt was swapped for another file’s', async () => {
    // The salt is bound into the AAD, so relabelling one part of the header breaks
    // the seal rather than silently deriving a different key.
    const original = JSON.parse(
      await createEncryptedBackup(makePayload(), PASSPHRASE)
    ) as EncryptedBackupEnvelope;
    const other = JSON.parse(
      await createEncryptedBackup('{}', PASSPHRASE)
    ) as EncryptedBackupEnvelope;

    original.kdf.salt = other.kdf.salt;

    await expect(
      openEncryptedBackup(JSON.stringify(original), PASSPHRASE)
    ).rejects.toBeInstanceOf(BackupPassphraseError);
  }, KDF_TIMEOUT);
});

describe('buildBackupFilename', () => {
  it('names the file for when it was made and ends in .yidhan', () => {
    const name = buildBackupFilename(new Date('2026-09-07T14:25:30Z'));
    expect(name).toMatch(/^yidhan-backup-2026-09-07-\d{6}\.yidhan$/);
  });
});
