/**
 * Encrypted Notes Service
 *
 * Wrapper layer between App and offlineNotes.
 * All note reads are decrypted; all writes encrypt BEFORE persisting.
 *
 * CRITICAL INVARIANT: Plaintext title/content NEVER touches IndexedDB or the
 * sync queue. Encryption happens before the first write.
 */

import type { Note, Tag } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import type { LocalNote, SyncQueueEntry } from '../lib/offlineDb';
import { encryptNote, decryptNote } from '../lib/encryption';
import {
  fetchNotesOffline,
  fetchFadedNotesOffline,
} from './offlineNotes';
import { getOfflineDb, createPendingSyncQueueEntry } from '../lib/offlineDb';
import { validateNoteTitle, validateNoteContentLength } from '../utils/validation';
import { sanitizeHtml } from '../utils/sanitize';
import { reportReliabilityIssue } from '../utils/reliabilityTelemetry';
import { hasEmptyPlaintextColumns } from '../utils/noteEncryptionInvariant';

/**
 * Decrypt a single note in-place if it has encrypted fields.
 * Returns the note with plaintext title and content.
 *
 * Throws on partial encryption state (payload without IV or vice versa)
 * to surface data corruption immediately rather than silently returning
 * an empty note.
 */
/**
 * Why a note could not be read (item 41).
 *
 * The distinction is the whole point. `plaintext` means the row is not encrypted, or
 * still carries plaintext columns — a violation of the launch invariant, and the read
 * must fail closed, hard, for the whole library. `undecryptable` means the row *is*
 * encrypted and the ciphertext would not open: a wrong key, or corruption. That is one
 * locked note, not a reason to hide every other note the reader has.
 */
export type NoteDecryptionFailure = 'plaintext' | 'undecryptable';

export class NoteDecryptionError extends Error {
  readonly noteId: string;
  readonly reason: NoteDecryptionFailure;

  constructor(noteId: string, reason: NoteDecryptionFailure, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'NoteDecryptionError';
    this.noteId = noteId;
    this.reason = reason;
  }
}

/**
 * A note we know exists but cannot read. Title and content are empty by construction —
 * the ciphertext never opened, so there is nothing to show and nothing to leak.
 */
function toLockedNote(note: Note): Note {
  return { ...note, title: '', content: '', decryptionFailed: true };
}

async function decryptNoteIfNeeded(
  note: Note,
  userId: string,
  keys: DerivedKeys
): Promise<Note> {
  const hasPayload = Boolean(note.encryptedPayload);
  const hasIv = Boolean(note.encryptionIv);
  const hasVersion = note.encryptionVersion != null;
  const hasHash = Boolean(note.contentHash);

  // Detect partial encryption state — this should never happen
  if (!hasPayload && !hasIv && !hasVersion && !hasHash) {
    const error = new NoteDecryptionError(
      note.id,
      'plaintext',
      `Note ${note.id} is not encrypted; refusing to load plaintext note content`
    );
    reportReliabilityIssue({
      category: 'vault',
      message: 'Encrypted note decryption failed',
      level: 'warning',
      data: {
        source: 'note_decryption',
      },
    }, error);
    throw error;
  }

  if (!hasPayload || !hasIv || !hasVersion || !hasHash) {
    // Half-encrypted: some of the payload is there and some is not. The row cannot be
    // opened, and it is not a plaintext note either — it is corruption, so it locks.
    const error = new NoteDecryptionError(
      note.id,
      'undecryptable',
      `Note ${note.id} has corrupted encryption state: ` +
      `payload=${hasPayload}, iv=${hasIv}, version=${hasVersion}, hash=${hasHash}`
    );
    reportReliabilityIssue({
      category: 'vault',
      message: 'Encrypted note decryption failed',
      level: 'warning',
      data: {
        source: 'note_decryption',
      },
    }, error);
    throw error;
  }

  if (!hasEmptyPlaintextColumns(note)) {
    const error = new NoteDecryptionError(
      note.id,
      'plaintext',
      `Note ${note.id} has encrypted fields but still contains plaintext columns`
    );
    reportReliabilityIssue({
      category: 'vault',
      message: 'Encrypted note decryption failed',
      level: 'warning',
      data: {
        source: 'note_decryption',
      },
    }, error);
    throw error;
  }

  try {
    const { title, content } = await decryptNote(
      note.id,
      userId,
      { ciphertext: note.encryptedPayload!, iv: note.encryptionIv! },
      keys.encryptionKey
    );

    return { ...note, title, content };
  } catch (error) {
    reportReliabilityIssue({
      category: 'vault',
      message: 'Encrypted note decryption failed',
      level: 'warning',
      data: {
        source: 'note_decryption',
      },
    }, error);
    throw new NoteDecryptionError(
      note.id,
      'undecryptable',
      `Note ${note.id} could not be decrypted`,
      error
    );
  }
}

/**
 * Create a new encrypted note.
 *
 * Encrypts title/content BEFORE writing to IndexedDB — no plaintext window.
 * The note in IndexedDB and sync queue only ever contains ciphertext.
 */
export async function createEncryptedNote(
  userId: string,
  title: string,
  content: string,
  keys: DerivedKeys,
  pinned = false
): Promise<Note> {
  // Validate and sanitize before encryption
  const validatedTitle = validateNoteTitle(title);
  validateNoteContentLength(content);
  const sanitizedContent = sanitizeHtml(content);

  const db = getOfflineDb(userId);
  const now = Date.now();
  const noteId = crypto.randomUUID();

  // Encrypt BEFORE any write — no plaintext touches storage
  const encrypted = await encryptNote(noteId, userId, validatedTitle, sanitizedContent, keys);

  // Write note + sync queue entry in a single Dexie transaction.
  // If the app crashes between writes, either both or neither are persisted.
  const localNote: LocalNote = {
    id: noteId,
    userId,
    title: '',
    content: '',
    pinned,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    lastSyncedAt: null,
    serverUpdatedAt: null,
    localUpdatedAt: now,
    encryptedPayload: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionVersion: encrypted.version,
    contentHash: encrypted.contentHash,
  };

  const syncEntry: SyncQueueEntry = createPendingSyncQueueEntry({
    operation: 'create',
    entityType: 'note',
    entityId: noteId,
    payload: {
      title: '',
      content: '',
      pinned,
      encrypted_payload: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_version: encrypted.version,
      content_hash: encrypted.contentHash,
    },
    createdAt: now,
  });

  await db.transaction('rw', db.notes, db.syncQueue, async () => {
    await db.notes.add(localNote);
    await db.syncQueue.add(syncEntry);
  });

  // Return decrypted note for React state (UI needs plaintext)
  return {
    id: noteId,
    title: validatedTitle,
    content: sanitizedContent,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    tags: [],
    pinned,
    deletedAt: null,
    syncStatus: 'pending',
    encryptedPayload: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionVersion: encrypted.version,
    contentHash: encrypted.contentHash,
  };
}

/**
 * Update an existing encrypted note.
 *
 * Encrypts the new title/content BEFORE writing to IndexedDB.
 * Updates IDB and sync queue atomically with encrypted fields.
 */
export async function updateEncryptedNote(
  userId: string,
  noteId: string,
  title: string,
  content: string,
  keys: DerivedKeys
): Promise<Note> {
  // Validate and sanitize
  const validatedTitle = validateNoteTitle(title);
  validateNoteContentLength(content);
  const sanitizedContent = sanitizeHtml(content);

  // Encrypt BEFORE any write
  const encrypted = await encryptNote(noteId, userId, validatedTitle, sanitizedContent, keys);

  const db = getOfflineDb(userId);
  const now = Date.now();

  // Get existing note to preserve sync tracking fields
  const existing = await db.notes.get(noteId);
  if (!existing) {
    throw new Error(`Note ${noteId} not found in offline database`);
  }

  // Update note + sync queue in a single Dexie transaction.
  // Compacts previous pending updates to same entity.
  const syncEntry: SyncQueueEntry = createPendingSyncQueueEntry({
    operation: 'update',
    entityType: 'note',
    entityId: noteId,
    payload: {
      title: '',
      content: '',
      encrypted_payload: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_version: encrypted.version,
      content_hash: encrypted.contentHash,
    },
    createdAt: now,
  });

  await db.transaction('rw', db.notes, db.syncQueue, async () => {
    await db.notes.update(noteId, {
      title: '',
      content: '',
      updatedAt: now,
      localUpdatedAt: now,
      syncStatus: existing.syncStatus === 'synced' ? 'pending' : existing.syncStatus,
      encryptedPayload: encrypted.ciphertext,
      encryptionIv: encrypted.iv,
      encryptionVersion: encrypted.version,
      contentHash: encrypted.contentHash,
    });

    // Compact: remove previous pending updates to same note
    await db.syncQueue
      .where('entityId')
      .equals(noteId)
      .and((e) => e.operation === 'update' && e.entityType === 'note')
      .delete();

    await db.syncQueue.add(syncEntry);
  });

  // Return decrypted note for React state
  return {
    id: noteId,
    title: validatedTitle,
    content: sanitizedContent,
    createdAt: new Date(existing.createdAt),
    updatedAt: new Date(now),
    tags: [],
    pinned: existing.pinned,
    deletedAt: existing.deletedAt ? new Date(existing.deletedAt) : null,
    syncStatus: 'pending',
    encryptedPayload: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionVersion: encrypted.version,
    contentHash: encrypted.contentHash,
  };
}

/**
 * Resolve a batch of decryption attempts.
 *
 * A `plaintext` failure is a violation of the launch invariant and still fails the
 * whole read, closed — the library must never present an unencrypted row as a note.
 * An `undecryptable` one locks that note and nothing else: before item 41, a single
 * corrupt payload threw here, App caught it, and the reader's entire library went
 * empty behind a toast telling them to lock and unlock their vault.
 */
function resolveDecryptionResults(
  notes: Note[],
  results: PromiseSettledResult<Note>[],
  label: string
): Note[] {
  const resolved: Note[] = [];
  let lockedCount = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      resolved.push(result.value);
      return;
    }

    const reason: unknown = result.reason;
    if (reason instanceof NoteDecryptionError && reason.reason === 'plaintext') {
      throw reason;
    }

    console.error(`Failed to decrypt ${label}:`, reason);
    lockedCount++;
    resolved.push(toLockedNote(notes[index]));
  });

  if (lockedCount > 0) {
    console.warn(`[vault] ${lockedCount} of ${notes.length} ${label}s could not be decrypted`);
  }

  return resolved;
}

/**
 * Fetch all notes and decrypt them.
 *
 * A note whose ciphertext will not open comes back locked (item 41), so the rest of
 * the library stays readable. A note that is not encrypted at all still throws.
 */
export async function fetchDecryptedNotes(
  userId: string,
  keys: DerivedKeys
): Promise<Note[]> {
  const notes = await fetchNotesOffline(userId);

  const results = await Promise.allSettled(
    notes.map((note) => decryptNoteIfNeeded(note, userId, keys))
  );

  return resolveDecryptionResults(notes, results, 'note');
}

/**
 * Fetch faded (soft-deleted) notes and decrypt them.
 * Same rule as fetchDecryptedNotes: one locked note, not an empty view.
 */
export async function fetchDecryptedFadedNotes(
  userId: string,
  keys: DerivedKeys
): Promise<Note[]> {
  const notes = await fetchFadedNotesOffline(userId);

  const results = await Promise.allSettled(
    notes.map((note) => decryptNoteIfNeeded(note, userId, keys))
  );

  return resolveDecryptionResults(notes, results, 'faded note');
}

/**
 * Decrypt a single note from a server event (realtime subscription).
 */
export async function decryptNoteFromServer(
  note: Note,
  userId: string,
  keys: DerivedKeys
): Promise<Note> {
  return decryptNoteIfNeeded(note, userId, keys);
}

/**
 * Batch create encrypted notes (for import).
 *
 * Each note is encrypted BEFORE writing to IndexedDB.
 * Uses index-based correlation (not content matching) to avoid mismatches.
 */
export async function createEncryptedNotesBatch(
  userId: string,
  notesData: Array<{
    title: string;
    content: string;
    createdAt?: Date;
    updatedAt?: Date;
    tags?: Tag[];
    pinned?: boolean;
  }>,
  keys: DerivedKeys,
  onProgress?: (completed: number, total: number) => void
): Promise<Note[]> {
  const db = getOfflineDb(userId);
  const now = Date.now();
  const encryptedNotes: Note[] = [];

  const BATCH_SIZE = 50;
  for (let i = 0; i < notesData.length; i += BATCH_SIZE) {
    const batch = notesData.slice(i, i + BATCH_SIZE);

    for (const noteData of batch) {
      const validatedTitle = validateNoteTitle(noteData.title);
      validateNoteContentLength(noteData.content);
      const sanitizedContent = sanitizeHtml(noteData.content);

      const noteId = crypto.randomUUID();
      const createdAt = noteData.createdAt?.getTime() ?? now;
      const updatedAt = noteData.updatedAt?.getTime() ?? now;
      const pinned = noteData.pinned ?? false;

      // Encrypt BEFORE writing
      const encrypted = await encryptNote(noteId, userId, validatedTitle, sanitizedContent, keys);

      const localNote: LocalNote = {
        id: noteId,
        userId,
        title: '',
        content: '',
        pinned,
        deletedAt: null,
        createdAt,
        updatedAt,
        syncStatus: 'pending',
        lastSyncedAt: null,
        serverUpdatedAt: null,
        localUpdatedAt: now,
        encryptedPayload: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        encryptionVersion: encrypted.version,
        contentHash: encrypted.contentHash,
      };

      const syncEntry: SyncQueueEntry = createPendingSyncQueueEntry({
        operation: 'create',
        entityType: 'note',
        entityId: noteId,
        payload: {
          title: '',
          content: '',
          pinned,
          createdAt: new Date(createdAt).toISOString(),
          updatedAt: new Date(updatedAt).toISOString(),
          encrypted_payload: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          encryption_version: encrypted.version,
          content_hash: encrypted.contentHash,
        },
        createdAt: now,
      });

      await db.transaction('rw', db.notes, db.syncQueue, async () => {
        await db.notes.add(localNote);
        await db.syncQueue.add(syncEntry);
      });

      encryptedNotes.push({
        id: noteId,
        title: validatedTitle,
        content: sanitizedContent,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        tags: [],
        pinned,
        deletedAt: null,
        syncStatus: 'pending',
        encryptedPayload: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
        encryptionVersion: encrypted.version,
        contentHash: encrypted.contentHash,
      });
    }

    if (onProgress) {
      onProgress(Math.min(i + batch.length, notesData.length), notesData.length);
    }
  }

  return encryptedNotes;
}
