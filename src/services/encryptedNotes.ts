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
    const error = new Error(`Note ${note.id} is not encrypted; refusing to load plaintext note content`);
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
    const error = new Error(
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
    const error = new Error(`Note ${note.id} has encrypted fields but still contains plaintext columns`);
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
    throw error;
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
  // Validate and sanitize (same checks as createNoteOffline)
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
 * Fetch all notes and decrypt them.
 *
 * Fails closed if any note cannot be decrypted so the UI never silently
 * hides notes or exports partial data.
 */
export async function fetchDecryptedNotes(
  userId: string,
  keys: DerivedKeys
): Promise<Note[]> {
  const notes = await fetchNotesOffline(userId);

  const results = await Promise.allSettled(
    notes.map((note) => decryptNoteIfNeeded(note, userId, keys))
  );

  const decrypted: Note[] = [];
  let failedCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      decrypted.push(result.value);
    } else {
      failedCount++;
      console.error('Failed to decrypt note:', result.reason);
    }
  }

  if (failedCount > 0) {
    throw new Error(
      `Failed to decrypt ${failedCount} of ${notes.length} notes. Lock and unlock your vault, then try again.`
    );
  }

  return decrypted;
}

/**
 * Fetch faded (soft-deleted) notes and decrypt them.
 * Same fail-closed pattern as fetchDecryptedNotes.
 */
export async function fetchDecryptedFadedNotes(
  userId: string,
  keys: DerivedKeys
): Promise<Note[]> {
  const notes = await fetchFadedNotesOffline(userId);

  const results = await Promise.allSettled(
    notes.map((note) => decryptNoteIfNeeded(note, userId, keys))
  );

  const decrypted: Note[] = [];
  let failedCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      decrypted.push(result.value);
    } else {
      failedCount++;
      console.error('Failed to decrypt faded note:', result.reason);
    }
  }

  if (failedCount > 0) {
    throw new Error(
      `Failed to decrypt ${failedCount} of ${notes.length} faded notes. Lock and unlock your vault, then try again.`
    );
  }

  return decrypted;
}

/**
 * Search notes by decrypting all notes and filtering client-side.
 * Encrypted content cannot be searched on the server or in IndexedDB.
 */
export async function searchDecryptedNotes(
  userId: string,
  query: string,
  keys: DerivedKeys
): Promise<Note[]> {
  const allNotes = await fetchDecryptedNotes(userId, keys);

  if (!query.trim()) return allNotes;

  const lowerQuery = query.toLowerCase();
  return allNotes.filter((note) =>
    note.title.toLowerCase().includes(lowerQuery) ||
    // Strip HTML tags for content search
    note.content.replace(/<[^>]*>/g, '').toLowerCase().includes(lowerQuery)
  );
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

      // Encrypt BEFORE writing
      const encrypted = await encryptNote(noteId, userId, validatedTitle, sanitizedContent, keys);

      const localNote: LocalNote = {
        id: noteId,
        userId,
        title: '',
        content: '',
        pinned: false,
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
          pinned: false,
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
        pinned: false,
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
