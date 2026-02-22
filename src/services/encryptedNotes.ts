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
import type { LocalNote } from '../lib/offlineDb';
import { encryptNote, decryptNote } from '../lib/encryption';
import {
  fetchNotesOffline,
  fetchFadedNotesOffline,
  queueSyncOperation,
} from './offlineNotes';
import { getOfflineDb } from '../lib/offlineDb';
import { validateNoteTitle, validateNoteContentLength } from '../utils/validation';
import { sanitizeHtml } from '../utils/sanitize';

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

  // Detect partial encryption state — this should never happen
  if (hasPayload !== hasIv) {
    throw new Error(
      `Note ${note.id} has corrupted encryption state: ` +
      `payload=${hasPayload}, iv=${hasIv}`
    );
  }

  if (!hasPayload) {
    // Not encrypted — return as-is (legacy note or already decrypted)
    return note;
  }

  const { title, content } = await decryptNote(
    note.id,
    userId,
    { ciphertext: note.encryptedPayload!, iv: note.encryptionIv! },
    keys.encryptionKey
  );

  return { ...note, title, content };
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
  keys: DerivedKeys
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

  // Write to IndexedDB with empty title/content and encrypted fields
  const localNote: LocalNote = {
    id: noteId,
    userId,
    title: '',
    content: '',
    pinned: false,
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

  await db.notes.add(localNote);

  // Queue sync with encrypted payload (never plaintext)
  await queueSyncOperation(userId, 'create', 'note', noteId, {
    title: '',
    content: '',
    pinned: false,
    encrypted_payload: encrypted.ciphertext,
    encryption_iv: encrypted.iv,
    encryption_version: encrypted.version,
    content_hash: encrypted.contentHash,
  });

  // Return decrypted note for React state (UI needs plaintext)
  return {
    id: noteId,
    title: validatedTitle,
    content: sanitizedContent,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    tags: [],
    pinned: false,
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

  // Update IndexedDB: empty title/content + encrypted fields in single operation
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

  // Queue sync with encrypted payload (compaction removes previous updates)
  await queueSyncOperation(userId, 'update', 'note', noteId, {
    title: '',
    content: '',
    encrypted_payload: encrypted.ciphertext,
    encryption_iv: encrypted.iv,
    encryption_version: encrypted.version,
    content_hash: encrypted.contentHash,
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
 */
export async function fetchDecryptedNotes(
  userId: string,
  keys: DerivedKeys
): Promise<Note[]> {
  const notes = await fetchNotesOffline(userId);

  const decrypted = await Promise.all(
    notes.map((note) => decryptNoteIfNeeded(note, userId, keys))
  );

  return decrypted;
}

/**
 * Fetch faded (soft-deleted) notes and decrypt them.
 */
export async function fetchDecryptedFadedNotes(
  userId: string,
  keys: DerivedKeys
): Promise<Note[]> {
  const notes = await fetchFadedNotesOffline(userId);

  const decrypted = await Promise.all(
    notes.map((note) => decryptNoteIfNeeded(note, userId, keys))
  );

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

      await db.notes.add(localNote);

      await queueSyncOperation(userId, 'create', 'note', noteId, {
        title: '',
        content: '',
        pinned: false,
        createdAt: new Date(createdAt).toISOString(),
        updatedAt: new Date(updatedAt).toISOString(),
        encrypted_payload: encrypted.ciphertext,
        encryption_iv: encrypted.iv,
        encryption_version: encrypted.version,
        content_hash: encrypted.contentHash,
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
