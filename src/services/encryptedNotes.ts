/**
 * Encrypted Notes Service
 *
 * Wrapper layer between App and offlineNotes.
 * All note reads are decrypted; all writes are encrypted.
 *
 * This module never stores plaintext in the database — title and content
 * in Supabase/IndexedDB are empty strings for encrypted notes.
 */

import type { Note, Tag } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { encryptNote, decryptNote } from '../lib/encryption';
import {
  createNoteOffline,
  updateNoteOffline,
  fetchNotesOffline,
  fetchFadedNotesOffline,
  createNotesBatchOffline,
} from './offlineNotes';
import { getOfflineDb } from '../lib/offlineDb';

/**
 * Decrypt a single note in-place if it has encrypted fields.
 * Returns the note with plaintext title and content.
 */
async function decryptNoteIfNeeded(
  note: Note,
  userId: string,
  keys: DerivedKeys
): Promise<Note> {
  if (!note.encryptedPayload || !note.encryptionIv) {
    // Not encrypted — return as-is (legacy note or already decrypted)
    return note;
  }

  const { title, content } = await decryptNote(
    note.id,
    userId,
    { ciphertext: note.encryptedPayload, iv: note.encryptionIv },
    keys.encryptionKey
  );

  return { ...note, title, content };
}

/**
 * Create a new encrypted note.
 * Encrypts title/content, writes encrypted payload to IndexedDB, and queues for sync.
 */
export async function createEncryptedNote(
  userId: string,
  title: string,
  content: string,
  keys: DerivedKeys
): Promise<Note> {
  // Create the note first (gets an ID)
  const note = await createNoteOffline(userId, title, content);

  // Encrypt the note
  const encrypted = await encryptNote(note.id, userId, title, content, keys);

  // Update the local note with encrypted fields and clear plaintext
  const db = getOfflineDb(userId);
  await db.notes.update(note.id, {
    title: '',
    content: '',
    encryptedPayload: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionVersion: encrypted.version,
    contentHash: encrypted.contentHash,
  });

  // Update the queued sync operation payload to use encrypted fields
  const queueEntry = await db.syncQueue
    .where('entityId').equals(note.id)
    .first();
  if (queueEntry?.id != null) {
    await db.syncQueue.update(queueEntry.id, {
      payload: {
        title: '',
        content: '',
        encrypted_payload: encrypted.ciphertext,
        encryption_iv: encrypted.iv,
        encryption_version: encrypted.version,
        content_hash: encrypted.contentHash,
      },
    });
  }

  // Return the decrypted note to the caller (React state holds plaintext)
  return {
    ...note,
    encryptedPayload: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionVersion: encrypted.version,
    contentHash: encrypted.contentHash,
  };
}

/**
 * Update an existing encrypted note.
 * Encrypts the new title/content, updates IndexedDB, and queues for sync.
 */
export async function updateEncryptedNote(
  userId: string,
  noteId: string,
  title: string,
  content: string,
  keys: DerivedKeys
): Promise<Note> {
  // Encrypt new content
  const encrypted = await encryptNote(noteId, userId, title, content, keys);

  const db = getOfflineDb(userId);

  // Get the existing note to construct a proper Note object for updateNoteOffline
  const existing = await db.notes.get(noteId);
  if (!existing) {
    throw new Error(`Note ${noteId} not found in offline database`);
  }

  // Update via offlineNotes first (handles sync queue, validation, etc.)
  const note = await updateNoteOffline(userId, {
    id: noteId,
    title,
    content,
    createdAt: new Date(existing.createdAt),
    updatedAt: new Date(existing.updatedAt),
    tags: [],
    pinned: existing.pinned,
    deletedAt: existing.deletedAt ? new Date(existing.deletedAt) : null,
  });
  await db.notes.update(noteId, {
    title: '',
    content: '',
    encryptedPayload: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionVersion: encrypted.version,
    contentHash: encrypted.contentHash,
  });

  // Update the queued sync operation payload
  const queueEntry = await db.syncQueue
    .where('entityId').equals(noteId)
    .last();
  if (queueEntry?.id != null) {
    const existingPayload = queueEntry.payload as Record<string, unknown> | undefined;
    await db.syncQueue.update(queueEntry.id, {
      payload: {
        ...existingPayload,
        title: '',
        content: '',
        encrypted_payload: encrypted.ciphertext,
        encryption_iv: encrypted.iv,
        encryption_version: encrypted.version,
        content_hash: encrypted.contentHash,
      },
    });
  }

  // Return decrypted note for React state
  return {
    ...note,
    title,
    content,
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
  // First try to search using the offline search (works for unencrypted notes)
  // For encrypted notes, we need to decrypt all and search in memory
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
  // Create notes via the batch function first
  const createdNotes = await createNotesBatchOffline(
    userId,
    notesData,
    onProgress
  );

  // Encrypt each note and update in IndexedDB
  const db = getOfflineDb(userId);
  const encryptedNotes: Note[] = [];

  for (const note of createdNotes) {
    const originalData = notesData.find(
      (d) => d.title === note.title || d.content === note.content
    ) ?? { title: note.title, content: note.content };

    const encrypted = await encryptNote(note.id, userId, originalData.title, originalData.content, keys);

    await db.notes.update(note.id, {
      title: '',
      content: '',
      encryptedPayload: encrypted.ciphertext,
      encryptionIv: encrypted.iv,
      encryptionVersion: encrypted.version,
      contentHash: encrypted.contentHash,
    });

    // Update queued sync payload
    const queueEntry = await db.syncQueue
      .where('entityId').equals(note.id)
      .first();
    if (queueEntry?.id != null) {
      await db.syncQueue.update(queueEntry.id, {
        payload: {
          title: '',
          content: '',
          encrypted_payload: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          encryption_version: encrypted.version,
          content_hash: encrypted.contentHash,
        },
      });
    }

    encryptedNotes.push({
      ...note,
      encryptedPayload: encrypted.ciphertext,
      encryptionIv: encrypted.iv,
      encryptionVersion: encrypted.version,
      contentHash: encrypted.contentHash,
    });
  }

  return encryptedNotes;
}
