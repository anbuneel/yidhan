/**
 * Offline Notes Service
 *
 * Provides offline-first note operations using IndexedDB (Dexie.js).
 * All writes go to IndexedDB first (optimistic), then queue for sync.
 * The sync engine (Phase 3) will process the queue when online.
 */

import { supabase } from '../lib/supabase';
import {
  getOfflineDb,
  clearOfflineDb,
  hasOfflineDb,
  createPendingSyncQueueEntry,
  type LocalNote,
  type LocalTag,
  type LocalNoteTag,
  type HydrationMetaRecord,
  type SyncQueueEntry,
  type SyncOperation,
  HYDRATION_META_KEY,
  OFFLINE_CACHE_SCHEMA_VERSION,
} from '../lib/offlineDb';
import type { Note, Tag, TagColor } from '../types';
import type { DbNote, DbTag } from '../types/database';
import {
  addReliabilityBreadcrumb as addHydrationBreadcrumb,
  reportReliabilityIssue,
} from '../utils/reliabilityTelemetry';
import {
  assertLaunchEncryptedAppNote,
  assertLaunchEncryptedDbNote,
} from '../utils/noteEncryptionInvariant';
import { sanitizeHtml } from '../utils/sanitize';
import { validateNoteTitle, validateNoteContentLength } from '../utils/validation';

// Convert LocalNote to App Note
function localNoteToNote(localNote: LocalNote, tags: Tag[] = []): Note {
  return {
    id: localNote.id,
    title: localNote.title,
    content: localNote.content,
    createdAt: new Date(localNote.createdAt),
    updatedAt: new Date(localNote.updatedAt),
    tags,
    pinned: localNote.pinned,
    deletedAt: localNote.deletedAt ? new Date(localNote.deletedAt) : null,
    syncStatus: localNote.syncStatus,
    encryptedPayload: localNote.encryptedPayload,
    encryptionIv: localNote.encryptionIv,
    encryptionVersion: localNote.encryptionVersion,
    contentHash: localNote.contentHash,
  };
}

// Convert LocalTag to App Tag
function localTagToTag(localTag: LocalTag): Tag {
  return {
    id: localTag.id,
    name: localTag.name,
    color: localTag.color as TagColor,
    createdAt: new Date(localTag.createdAt),
    updatedAt: localTag.serverUpdatedAt ? new Date(localTag.serverUpdatedAt) : undefined,
  };
}

// Convert DB Note to LocalNote
function dbNoteToLocal(dbNote: DbNote, userId: string): LocalNote {
  assertLaunchEncryptedDbNote(dbNote, dbNote.id, 'to cache');

  // Use server timestamp for lastSyncedAt to avoid clock skew issues
  const serverTime = new Date(dbNote.updated_at).getTime();
  const displayTime = new Date(dbNote.display_updated_at ?? dbNote.updated_at).getTime();
  return {
    id: dbNote.id,
    userId,
    title: '',
    content: '',
    pinned: dbNote.pinned ?? false,
    deletedAt: dbNote.deleted_at ? new Date(dbNote.deleted_at).getTime() : null,
    createdAt: new Date(dbNote.created_at).getTime(),
    updatedAt: displayTime,
    syncStatus: 'synced',
    lastSyncedAt: serverTime,
    serverUpdatedAt: serverTime,
    localUpdatedAt: serverTime,
    encryptedPayload: dbNote.encrypted_payload ?? null,
    encryptionIv: dbNote.encryption_iv ?? null,
    encryptionVersion: dbNote.encryption_version ?? null,
    contentHash: dbNote.content_hash ?? null,
  };
}

// Convert DB Tag to LocalTag
function dbTagToLocal(dbTag: DbTag, userId: string): LocalTag {
  const serverTime = new Date(dbTag.updated_at).getTime();
  return {
    id: dbTag.id,
    userId,
    name: dbTag.name,
    color: dbTag.color,
    createdAt: new Date(dbTag.created_at).getTime(),
    syncStatus: 'synced',
    lastSyncedAt: serverTime,
    serverUpdatedAt: serverTime,
    localUpdatedAt: serverTime,
  };
}

function getQueueEntryStatus(entry: SyncQueueEntry): 'pending' | 'blocked' {
  return entry.status ?? 'pending';
}

function assertLegacyPlaintextNoteWritesDisabled(): void {
  if (import.meta.env.MODE === 'test') {
    return;
  }

  throw new Error(
    'Plaintext offline note writes are disabled. Use encrypted note operations instead.'
  );
}

function buildHydrationMeta(
  current: HydrationMetaRecord | undefined,
  status: HydrationMetaRecord['status'],
  lastHydratedAt: number | null = current?.lastHydratedAt ?? null
): HydrationMetaRecord {
  return {
    key: HYDRATION_META_KEY,
    status,
    lastHydratedAt,
    cacheSchemaVersion: OFFLINE_CACHE_SCHEMA_VERSION,
    updatedAt: Date.now(),
  };
}

async function getHydrationMeta(
  userId: string
): Promise<HydrationMetaRecord | undefined> {
  const db = getOfflineDb(userId);
  return db.meta.get(HYDRATION_META_KEY);
}

async function setHydrationMeta(
  userId: string,
  status: HydrationMetaRecord['status'],
  lastHydratedAt?: number | null
): Promise<void> {
  const db = getOfflineDb(userId);
  const current = await db.meta.get(HYDRATION_META_KEY);
  await db.meta.put(buildHydrationMeta(current, status, lastHydratedAt));
}

async function hasQueuedSyncWork(userId: string): Promise<boolean> {
  const { pendingCount, blockedCount } = await getSyncQueueCounts(userId);
  return pendingCount > 0 || blockedCount > 0;
}

async function compactQueueForEntity(
  userId: string,
  operation: SyncOperation,
  entityType: 'note' | 'tag' | 'noteTag',
  entityId: string
): Promise<void> {
  const db = getOfflineDb(userId);
  const entries = await db.syncQueue
    .where('entityId')
    .equals(entityId)
    .and((entry) => entry.entityType === entityType)
    .toArray();

  const idsToDelete = entries
    .filter((entry) => {
      if (getQueueEntryStatus(entry) === 'blocked') {
        return false;
      }

      if (operation === 'update') {
        return entry.operation === 'update';
      }

      if (operation === 'pin') {
        return entry.operation === 'pin';
      }

      if (operation === 'delete') {
        return entry.operation !== 'create';
      }

      if (operation === 'soft_delete' || operation === 'restore') {
        return entry.operation === 'soft_delete' || entry.operation === 'restore';
      }

      if (entityType === 'noteTag') {
        return entry.operation === 'add_tag' || entry.operation === 'remove_tag';
      }

      return false;
    })
    .map((entry) => entry.id)
    .filter((id): id is number => typeof id === 'number');

  if (idsToDelete.length > 0) {
    await db.syncQueue.bulkDelete(idsToDelete);
  }
}

/**
 * Hydrate IndexedDB from Supabase
 * Called on login to populate local database with server data
 */
export async function hydrateFromServer(userId: string): Promise<void> {
  const db = getOfflineDb(userId);

  if (await hasQueuedSyncWork(userId)) {
    addHydrationBreadcrumb({
      category: 'hydration',
      message: 'Skipped hydration because queued local changes exist',
      level: 'warning',
      data: {
        reason: 'queued_local_changes',
      },
    });
    console.warn('Skipping startup hydration because local queued changes exist');
    return;
  }

  await setHydrationMeta(userId, 'in_progress');
  addHydrationBreadcrumb({
    category: 'hydration',
    message: 'Hydration started',
  });

  try {
    // Fetch all notes from server
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes for hydration:', notesError);
      throw notesError;
    }

    // Fetch all tags from server
    const { data: tagsData, error: tagsError } = await supabase
      .from('tags')
      .select('*');

    if (tagsError) {
      console.error('Error fetching tags for hydration:', tagsError);
      throw tagsError;
    }

    // Fetch all note-tag relationships
    const { data: noteTagsData, error: noteTagsError } = await supabase
      .from('note_tags')
      .select('note_id, tag_id');

    if (noteTagsError) {
      console.error('Error fetching note-tags for hydration:', noteTagsError);
      throw noteTagsError;
    }

    const hydratedAt = Date.now();

    // Merge server state into IndexedDB without wiping local state wholesale
    await db.transaction('rw', [db.notes, db.tags, db.noteTags, db.meta], async () => {
      const localNotes = await db.notes.toArray();
      const localTags = await db.tags.toArray();
      const localNoteTags = await db.noteTags.toArray();
      const localNotesById = new Map(localNotes.map((note) => [note.id, note]));
      const mergedNotes = (notesData || []).map((n) => {
        const serverNote = dbNoteToLocal(n as DbNote, userId);
        const localNote = localNotesById.get(serverNote.id);

        // Preserve unresolved local state so hydration cannot erase
        // conflict or otherwise non-synced edits after metadata resets.
        if (localNote && localNote.syncStatus !== 'synced') {
          return localNote;
        }

        return serverNote;
      });
      const mergedTags = (tagsData || []).map((t) => dbTagToLocal(t as DbTag, userId));
      const mergedNoteTags: LocalNoteTag[] = (noteTagsData || []).map((nt) => ({
        noteId: nt.note_id,
        tagId: nt.tag_id,
        syncStatus: 'synced' as const,
        lastSyncedAt: hydratedAt,
      }));

      const serverNoteIds = new Set((notesData || []).map((note) => note.id));
      const serverTagIds = new Set(mergedTags.map((tag) => tag.id));
      const serverNoteTagKeys = new Set(
        mergedNoteTags.map((noteTag) => `${noteTag.noteId}:${noteTag.tagId}`)
      );

      const syncedNoteIdsToDelete = localNotes
        .filter((note) => note.syncStatus === 'synced' && !serverNoteIds.has(note.id))
        .map((note) => note.id);
      if (syncedNoteIdsToDelete.length > 0) {
        await db.notes.bulkDelete(syncedNoteIdsToDelete);
      }

      const syncedTagIdsToDelete = localTags
        .filter((tag) => tag.syncStatus === 'synced' && !serverTagIds.has(tag.id))
        .map((tag) => tag.id);
      if (syncedTagIdsToDelete.length > 0) {
        await db.tags.bulkDelete(syncedTagIdsToDelete);
      }

      const syncedNoteTagsToDelete = localNoteTags
        .filter(
          (noteTag) =>
            noteTag.syncStatus === 'synced' &&
            !serverNoteTagKeys.has(`${noteTag.noteId}:${noteTag.tagId}`)
        )
        .map((noteTag) => [noteTag.noteId, noteTag.tagId] as [string, string]);
      for (const key of syncedNoteTagsToDelete) {
        await db.noteTags.delete(key);
      }

      if (mergedNotes.length > 0) {
        await db.notes.bulkPut(mergedNotes);
      }

      if (mergedTags.length > 0) {
        await db.tags.bulkPut(mergedTags);
      }

      if (mergedNoteTags.length > 0) {
        await db.noteTags.bulkPut(mergedNoteTags);
      }

      await db.meta.put({
        key: HYDRATION_META_KEY,
        status: 'complete',
        lastHydratedAt: hydratedAt,
        cacheSchemaVersion: OFFLINE_CACHE_SCHEMA_VERSION,
        updatedAt: hydratedAt,
      });
    });

    addHydrationBreadcrumb({
      category: 'hydration',
      message: 'Hydration completed',
      data: {
        noteCount: notesData?.length || 0,
        tagCount: tagsData?.length || 0,
        noteTagCount: noteTagsData?.length || 0,
      },
    });
    console.log(`Hydrated offline DB: ${notesData?.length || 0} notes, ${tagsData?.length || 0} tags`);
  } catch (error) {
    try {
      await setHydrationMeta(userId, 'never');
    } catch (metaError) {
      console.warn('Failed to reset hydration metadata after error:', metaError);
    }
    addHydrationBreadcrumb({
      category: 'hydration',
      message: 'Hydration failed',
      level: 'warning',
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

/**
 * Check if offline database needs hydration
 * Includes timeout protection for Android WebView where IndexedDB operations can hang
 */
export async function needsHydration(userId: string): Promise<boolean> {
  const TIMEOUT_MS = 5000; // 5 second timeout for entire operation

  try {
    // Wrap the entire operation in a timeout
    const checkHydration = async (): Promise<boolean> => {
      const exists = await hasOfflineDb(userId);
      if (!exists) return true;
      if (await hasQueuedSyncWork(userId)) return false;

      const meta = await getHydrationMeta(userId);
      if (!meta) return true;
      if (meta.cacheSchemaVersion !== OFFLINE_CACHE_SCHEMA_VERSION) return true;
      return meta.status !== 'complete';
    };

    // Use Promise.race with a timeout that properly resolves/rejects
    const result = await Promise.race([
      checkHydration(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('needsHydration timeout')), TIMEOUT_MS)
      ),
    ]);

    return result;
  } catch (error) {
    // If check fails or times out, assume we need hydration (safe default)
    // This triggers a fresh hydration from server which is the safest path
    console.warn('needsHydration check failed, assuming hydration needed:', error);
    return true;
  }
}

/**
 * Fetch all active notes from IndexedDB
 * Falls back to server if offline DB is empty
 */
export async function fetchNotesOffline(
  userId: string,
  filterTagIds?: string[]
): Promise<Note[]> {
  const db = getOfflineDb(userId);

  // Get all notes and filter in JS - Dexie null indexing is unreliable
  const notes = (await db.notes.toArray())
    .filter((n) => n.deletedAt === null)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return b.updatedAt - a.updatedAt;
    });

  // Get all tags for these notes
  const noteIds = notes.map((n) => n.id);
  const noteTags = await db.noteTags.where('noteId').anyOf(noteIds).toArray();
  const tagIds = [...new Set(noteTags.map((nt) => nt.tagId))];
  const tags = tagIds.length > 0 ? await db.tags.where('id').anyOf(tagIds).toArray() : [];
  const tagMap = new Map(tags.map((t) => [t.id, localTagToTag(t)]));

  // Build note-to-tags mapping
  const noteTagMap = new Map<string, Tag[]>();
  for (const nt of noteTags) {
    const tag = tagMap.get(nt.tagId);
    if (tag) {
      const existing = noteTagMap.get(nt.noteId) || [];
      existing.push(tag);
      noteTagMap.set(nt.noteId, existing);
    }
  }

  // Convert to app notes
  let result = notes.map((n) => localNoteToNote(n, noteTagMap.get(n.id) || []));

  // Apply tag filter if provided (AND logic)
  if (filterTagIds && filterTagIds.length > 0) {
    result = result.filter((note) => {
      const noteTagIds = note.tags.map((t) => t.id);
      return filterTagIds.every((tagId) => noteTagIds.includes(tagId));
    });
  }

  return result;
}

/**
 * Fetch all tags from IndexedDB
 */
export async function fetchTagsOffline(userId: string): Promise<Tag[]> {
  const db = getOfflineDb(userId);
  const tags = await db.tags.toArray();
  return tags.map(localTagToTag);
}

/**
 * Fetch faded (soft-deleted) notes from IndexedDB
 */
export async function fetchFadedNotesOffline(userId: string): Promise<Note[]> {
  const db = getOfflineDb(userId);

  // Get all soft-deleted notes, sorted by deletedAt descending (most recently deleted first)
  const notes = (await db.notes
    .filter((n) => n.deletedAt !== null)
    .toArray())
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  // Get tags for these notes (same as above)
  const noteIds = notes.map((n) => n.id);
  const noteTags = noteIds.length > 0
    ? await db.noteTags.where('noteId').anyOf(noteIds).toArray()
    : [];
  const tagIds = [...new Set(noteTags.map((nt) => nt.tagId))];
  const tags = tagIds.length > 0 ? await db.tags.where('id').anyOf(tagIds).toArray() : [];
  const tagMap = new Map(tags.map((t) => [t.id, localTagToTag(t)]));

  const noteTagMap = new Map<string, Tag[]>();
  for (const nt of noteTags) {
    const tag = tagMap.get(nt.tagId);
    if (tag) {
      const existing = noteTagMap.get(nt.noteId) || [];
      existing.push(tag);
      noteTagMap.set(nt.noteId, existing);
    }
  }

  return notes.map((n) => localNoteToNote(n, noteTagMap.get(n.id) || []));
}

/**
 * Search notes in IndexedDB
 */
export async function searchNotesOffline(userId: string, query: string): Promise<Note[]> {
  if (!query.trim()) {
    return fetchNotesOffline(userId);
  }

  const db = getOfflineDb(userId);
  const searchLower = query.toLowerCase();

  // Get all active notes, filter by search term, and sort
  const notes = (await db.notes
    .filter((n) =>
      n.deletedAt === null &&
      (n.title.toLowerCase().includes(searchLower) ||
       n.content.toLowerCase().includes(searchLower))
    )
    .toArray())
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return b.updatedAt - a.updatedAt;
    });

  // Get tags (same pattern as above)
  const noteIds = notes.map((n) => n.id);
  const noteTags = noteIds.length > 0
    ? await db.noteTags.where('noteId').anyOf(noteIds).toArray()
    : [];
  const tagIds = [...new Set(noteTags.map((nt) => nt.tagId))];
  const tags = tagIds.length > 0 ? await db.tags.where('id').anyOf(tagIds).toArray() : [];
  const tagMap = new Map(tags.map((t) => [t.id, localTagToTag(t)]));

  const noteTagMap = new Map<string, Tag[]>();
  for (const nt of noteTags) {
    const tag = tagMap.get(nt.tagId);
    if (tag) {
      const existing = noteTagMap.get(nt.noteId) || [];
      existing.push(tag);
      noteTagMap.set(nt.noteId, existing);
    }
  }

  return notes.map((n) => localNoteToNote(n, noteTagMap.get(n.id) || []));
}

/**
 * Count faded notes in IndexedDB
 */
export async function countFadedNotesOffline(userId: string): Promise<number> {
  const db = getOfflineDb(userId);
  return db.notes.filter((n) => n.deletedAt !== null).count();
}

/**
 * Clear offline database on logout
 */
export async function clearOfflineData(): Promise<void> {
  await clearOfflineDb();
}

// ============================================
// WRITE OPERATIONS (Phase 2)
// All writes go to IndexedDB first, then queue for sync
// ============================================

/**
 * Add an operation to the sync queue
 */
export async function queueSyncOperation(
  userId: string,
  operation: SyncOperation,
  entityType: 'note' | 'tag' | 'noteTag',
  entityId: string,
  payload: unknown
): Promise<string> {
  const db = getOfflineDb(userId);
  await compactQueueForEntity(userId, operation, entityType, entityId);

  const entry = createPendingSyncQueueEntry({
    operation,
    entityType,
    entityId,
    payload,
  });

  await db.syncQueue.add(entry);
  return entry.clientMutationId;
}

/**
 * Create a new note offline
 * Generates local UUID, writes to IndexedDB, queues for sync
 */
export async function createNoteOffline(
  userId: string,
  title: string = '',
  content: string = ''
): Promise<Note> {
  assertLegacyPlaintextNoteWritesDisabled();

  // Validate inputs
  const validatedTitle = validateNoteTitle(title);
  validateNoteContentLength(content);

  const db = getOfflineDb(userId);
  const now = Date.now();
  const noteId = crypto.randomUUID();

  const sanitizedContent = sanitizeHtml(content);

  const localNote: LocalNote = {
    id: noteId,
    userId,
    title: validatedTitle,
    content: sanitizedContent,
    pinned: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    lastSyncedAt: null,
    serverUpdatedAt: null,
    localUpdatedAt: now,
    encryptedPayload: null,
    encryptionIv: null,
    encryptionVersion: null,
    contentHash: null,
  };

  // Write to IndexedDB
  await db.notes.add(localNote);

  // Queue for sync
  await queueSyncOperation(userId, 'create', 'note', noteId, {
    title: validatedTitle,
    content: sanitizedContent,
    pinned: false,
  });

  return localNoteToNote(localNote, []);
}

/**
 * Create multiple notes offline (for batch imports)
 * Writes all notes to IndexedDB first, then queues for sync
 * Returns created notes with progress callback support
 */
export async function createNotesBatchOffline(
  userId: string,
  notes: Array<{
    title: string;
    content: string;
    createdAt?: Date;
    updatedAt?: Date;
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<Note[]> {
  assertLegacyPlaintextNoteWritesDisabled();

  const db = getOfflineDb(userId);
  const now = Date.now();
  const createdNotes: Note[] = [];

  // Process in batches to avoid blocking the UI
  const BATCH_SIZE = 50;
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);

    // Create local notes for this batch
    const localNotes: LocalNote[] = batch.map((noteData) => {
      // Validate inputs
      const validatedTitle = validateNoteTitle(noteData.title);
      validateNoteContentLength(noteData.content);

      const noteId = crypto.randomUUID();
      const createdAt = noteData.createdAt?.getTime() ?? now;
      const updatedAt = noteData.updatedAt?.getTime() ?? now;

      return {
        id: noteId,
        userId,
        title: validatedTitle,
        content: sanitizeHtml(noteData.content),
        pinned: false,
        deletedAt: null,
        createdAt,
        updatedAt,
        syncStatus: 'pending' as const,
        lastSyncedAt: null,
        serverUpdatedAt: null,
        localUpdatedAt: now,
        encryptedPayload: null,
        encryptionIv: null,
        encryptionVersion: null,
        contentHash: null,
      };
    });

    // Bulk add to IndexedDB
    await db.notes.bulkAdd(localNotes);

    // Queue sync operations for each note
    for (const localNote of localNotes) {
      await queueSyncOperation(userId, 'create', 'note', localNote.id, {
        title: localNote.title,
        content: localNote.content,
        pinned: false,
        createdAt: new Date(localNote.createdAt).toISOString(),
        updatedAt: new Date(localNote.updatedAt).toISOString(),
      });

      createdNotes.push(localNoteToNote(localNote, []));
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batch.length, notes.length), notes.length);
    }
  }

  return createdNotes;
}

/**
 * Update a note offline
 * Updates IndexedDB immediately, queues for sync
 */
export async function updateNoteOffline(
  userId: string,
  note: Note
): Promise<Note> {
  assertLegacyPlaintextNoteWritesDisabled();

  // Validate inputs
  const validatedTitle = validateNoteTitle(note.title);
  validateNoteContentLength(note.content);

  const db = getOfflineDb(userId);
  const now = Date.now();

  // Get current local note to preserve sync tracking fields
  const existing = await db.notes.get(note.id);
  if (!existing) {
    throw new Error(`Note ${note.id} not found in offline database`);
  }

  const sanitizedContent = sanitizeHtml(note.content);

  const localNote: LocalNote = {
    ...existing,
    title: validatedTitle,
    content: sanitizedContent,
    updatedAt: now,
    localUpdatedAt: now,
    syncStatus: existing.syncStatus === 'synced' ? 'pending' : existing.syncStatus,
  };

  // Update IndexedDB
  await db.notes.put(localNote);

  // Queue for sync (compaction will remove previous updates)
  await queueSyncOperation(userId, 'update', 'note', note.id, {
    title: validatedTitle,
    content: sanitizedContent,
  });

  return localNoteToNote(localNote, note.tags);
}

/**
 * Soft-delete a note offline (move to Faded Notes)
 */
export async function softDeleteNoteOffline(
  userId: string,
  noteId: string
): Promise<void> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  const existing = await db.notes.get(noteId);
  if (!existing) {
    throw new Error(`Note ${noteId} not found in offline database`);
  }

  // Update with soft-delete timestamp
  await db.notes.update(noteId, {
    deletedAt: now,
    updatedAt: now,
    localUpdatedAt: now,
    syncStatus: 'pending',
  });

  // Queue for sync
  await queueSyncOperation(userId, 'soft_delete', 'note', noteId, {
    deletedAt: new Date(now).toISOString(),
  });
}

/**
 * Restore a soft-deleted note offline
 */
export async function restoreNoteOffline(
  userId: string,
  noteId: string
): Promise<void> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  const existing = await db.notes.get(noteId);
  if (!existing) {
    throw new Error(`Note ${noteId} not found in offline database`);
  }

  // Clear soft-delete timestamp
  await db.notes.update(noteId, {
    deletedAt: null,
    updatedAt: now,
    localUpdatedAt: now,
    syncStatus: 'pending',
  });

  // Queue for sync
  await queueSyncOperation(userId, 'restore', 'note', noteId, {});
}

/**
 * Permanently delete a note offline
 */
export async function permanentDeleteNoteOffline(
  userId: string,
  noteId: string
): Promise<void> {
  const db = getOfflineDb(userId);

  // Delete from IndexedDB
  await db.transaction('rw', [db.notes, db.noteTags, db.syncQueue], async () => {
    // Remove note
    await db.notes.delete(noteId);

    // Remove related note-tag relationships
    await db.noteTags.where('noteId').equals(noteId).delete();

    // Remove any pending sync operations for this note
    await db.syncQueue.where('entityId').equals(noteId).delete();
  });

  // Queue for sync (server delete)
  await queueSyncOperation(userId, 'delete', 'note', noteId, {});
}

/**
 * Toggle pin status offline
 */
export async function toggleNotePinOffline(
  userId: string,
  noteId: string,
  pinned: boolean
): Promise<void> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  const existing = await db.notes.get(noteId);
  if (!existing) {
    throw new Error(`Note ${noteId} not found in offline database`);
  }

  // Update pin status
  await db.notes.update(noteId, {
    pinned,
    updatedAt: now,
    localUpdatedAt: now,
    syncStatus: 'pending',
  });

  // Queue for sync
  await queueSyncOperation(userId, 'pin', 'note', noteId, { pinned });
}

/**
 * Add a tag to a note offline
 */
export async function addTagToNoteOffline(
  userId: string,
  noteId: string,
  tagId: string,
  options?: { preserveUpdatedAt?: boolean }
): Promise<void> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  // Check if relationship already exists
  const existing = await db.noteTags
    .where('[noteId+tagId]')
    .equals([noteId, tagId])
    .first();

  if (existing) {
    return; // Already exists
  }

  // Add note-tag relationship
  const noteTag: LocalNoteTag = {
    noteId,
    tagId,
    syncStatus: 'pending',
    lastSyncedAt: null,
  };

  await db.noteTags.add(noteTag);

  if (!options?.preserveUpdatedAt) {
    // Tag changes count as note activity unless we're reconstructing an import.
    await db.notes.update(noteId, {
      updatedAt: now,
      localUpdatedAt: now,
    });
  }

  // Queue for sync
  await queueSyncOperation(userId, 'add_tag', 'noteTag', `${noteId}:${tagId}`, {
    noteId,
    tagId,
  });
}

/**
 * Remove a tag from a note offline
 */
export async function removeTagFromNoteOffline(
  userId: string,
  noteId: string,
  tagId: string
): Promise<void> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  // Remove note-tag relationship
  await db.noteTags.where('[noteId+tagId]').equals([noteId, tagId]).delete();

  // Update note's updatedAt
  await db.notes.update(noteId, {
    updatedAt: now,
    localUpdatedAt: now,
  });

  // Queue for sync
  await queueSyncOperation(userId, 'remove_tag', 'noteTag', `${noteId}:${tagId}`, {
    noteId,
    tagId,
  });
}

/**
 * Get pending sync queue entries
 * Returns entries in FIFO order, respecting dependencies
 */
export async function getPendingSyncQueue(userId: string): Promise<SyncQueueEntry[]> {
  const db = getOfflineDb(userId);

  const entries = (await db.syncQueue.orderBy('createdAt').toArray())
    .filter((entry) => getQueueEntryStatus(entry) === 'pending');

  // Dependency ordering: creates before add_tag, notes/tags before noteTags
  // Sort by: 1) create operations first, 2) note/tag entities before noteTag
  return entries.sort((a, b) => {
    // Creates always first
    if (a.operation === 'create' && b.operation !== 'create') return -1;
    if (b.operation === 'create' && a.operation !== 'create') return 1;

    // Notes and tags before noteTags
    if (a.entityType !== 'noteTag' && b.entityType === 'noteTag') return -1;
    if (b.entityType !== 'noteTag' && a.entityType === 'noteTag') return 1;

    // Otherwise maintain FIFO order
    return a.createdAt - b.createdAt;
  });
}

/**
 * Remove a processed sync queue entry
 */
export async function removeSyncQueueEntry(
  userId: string,
  clientMutationId: string,
  entryId?: number
): Promise<void> {
  const db = getOfflineDb(userId);
  if (typeof entryId === 'number') {
    await db.syncQueue.delete(entryId);
  } else {
    await db.syncQueue.where('clientMutationId').equals(clientMutationId).delete();
  }
}

export async function updateSyncQueueEntry(
  userId: string,
  entry: SyncQueueEntry,
  updates: Partial<SyncQueueEntry>
): Promise<void> {
  const db = getOfflineDb(userId);
  const payload = {
    ...updates,
    updatedAt: updates.updatedAt ?? Date.now(),
  };

  if (typeof entry.id === 'number') {
    await db.syncQueue.update(entry.id, payload);
  } else {
    await db.syncQueue
      .where('clientMutationId')
      .equals(entry.clientMutationId)
      .modify(payload);
  }
}

export async function markSyncQueueEntryBlocked(
  userId: string,
  entry: SyncQueueEntry,
  retryCount: number,
  lastError: string
): Promise<void> {
  const now = Date.now();
  await updateSyncQueueEntry(userId, entry, {
    status: 'blocked',
    retryCount,
    lastError,
    lastAttemptAt: now,
    blockedAt: now,
  });
}

export async function retryBlockedSyncEntries(userId: string): Promise<number> {
  const db = getOfflineDb(userId);
  const blockedEntries = await db.syncQueue
    .filter((entry) => getQueueEntryStatus(entry) === 'blocked')
    .toArray();

  if (blockedEntries.length === 0) {
    return 0;
  }

  const now = Date.now();
  await db.transaction('rw', db.syncQueue, async () => {
    for (const entry of blockedEntries) {
      await updateSyncQueueEntry(userId, entry, {
        status: 'pending',
        retryCount: 0,
        lastError: null,
        lastAttemptAt: null,
        blockedAt: null,
        updatedAt: now,
      });
    }
  });

  return blockedEntries.length;
}

/**
 * Mark a note as synced after successful server sync
 *
 * IMPORTANT: Uses server timestamp for lastSyncedAt to avoid clock skew issues.
 * Previously used Date.now() which caused false conflicts when client clock
 * was behind server clock (common with NTP differences between devices).
 */
export async function markNoteSynced(
  userId: string,
  noteId: string,
  serverUpdatedAt: Date
): Promise<void> {
  const db = getOfflineDb(userId);
  // Use server timestamp to keep all sync comparisons in same clock domain
  const serverTime = serverUpdatedAt.getTime();

  await db.notes.update(noteId, {
    syncStatus: 'synced',
    lastSyncedAt: serverTime,
    serverUpdatedAt: serverTime,
  });
}

/**
 * Get count of pending sync operations
 */
export async function getSyncQueueCounts(
  userId: string
): Promise<{ pendingCount: number; blockedCount: number }> {
  const db = getOfflineDb(userId);
  const [pendingCount, blockedCount] = await Promise.all([
    db.syncQueue.where('status').equals('pending').count(),
    db.syncQueue.where('status').equals('blocked').count(),
  ]);

  return { pendingCount, blockedCount };
}

/**
 * Counts and blocked reason from a single pass over the queue.
 *
 * Reading the count and the reason as separate queries lets them disagree when
 * a sync run lands between the two, which surfaces as "N blocked" with no
 * reason attached — the exact confusing state the reason exists to remove.
 */
export async function getSyncQueueSnapshot(userId: string): Promise<{
  pendingCount: number;
  blockedCount: number;
  blockedReason: string | null;
}> {
  const db = getOfflineDb(userId);

  return db.transaction('r', db.syncQueue, async () => {
    const entries = await db.syncQueue.toArray();
    const blocked = entries.filter((entry) => getQueueEntryStatus(entry) === 'blocked');
    const mostRecent = blocked.reduce<SyncQueueEntry | null>(
      (latest, entry) =>
        latest === null || (entry.blockedAt ?? 0) > (latest.blockedAt ?? 0) ? entry : latest,
      null
    );

    return {
      pendingCount: entries.filter((entry) => getQueueEntryStatus(entry) === 'pending').length,
      blockedCount: blocked.length,
      blockedReason: mostRecent?.lastError ?? null,
    };
  });
}

/**
 * Reason the most recently blocked queue entry failed.
 *
 * Blocked entries already record `lastError`, but nothing surfaced it, so a
 * blocked banner told the user a count and nothing else — and the retry button
 * cannot clear a deterministic failure. Showing the reason is what makes the
 * state diagnosable without opening IndexedDB by hand.
 */
export async function getBlockedSyncReason(userId: string): Promise<string | null> {
  const { blockedReason } = await getSyncQueueSnapshot(userId);
  return blockedReason;
}

export async function getPendingSyncCount(userId: string): Promise<number> {
  const { pendingCount } = await getSyncQueueCounts(userId);
  return pendingCount;
}

export async function getBlockedSyncCount(userId: string): Promise<number> {
  const { blockedCount } = await getSyncQueueCounts(userId);
  return blockedCount;
}

// ============================================
// REALTIME SYNC HELPERS
// These functions handle server->local updates from realtime subscriptions
// They don't queue sync operations since data comes from server
// ============================================

/**
 * Insert or update a note from server (realtime subscription)
 * Does NOT queue sync operation since this is server->local
 *
 * Uses server timestamp for lastSyncedAt to maintain consistent clock domain
 * with conflict detection (avoids false conflicts from client/server clock skew).
 */
export async function upsertNoteFromServer(
  userId: string,
  note: Note
): Promise<void> {
  assertLaunchEncryptedAppNote(note, note.id, 'to persist server note');

  const db = getOfflineDb(userId);
  // Use server timestamp to keep all sync comparisons in same clock domain
  const serverTime = note.updatedAt.getTime();

  const existing = await db.notes.get(note.id);

  if (existing) {
    // Only update if server version is newer (or if local has no pending changes)
    const shouldUpdate = existing.syncStatus === 'synced' ||
                        !existing.localUpdatedAt ||
                        serverTime > existing.localUpdatedAt;

    if (shouldUpdate) {
      await db.notes.update(note.id, {
        title: '',
        content: '',
        pinned: note.pinned,
        deletedAt: note.deletedAt?.getTime() ?? null,
        updatedAt: serverTime,
        serverUpdatedAt: serverTime,
        syncStatus: existing.syncStatus === 'pending' ? 'pending' : 'synced',
        lastSyncedAt: serverTime,
        encryptedPayload: note.encryptedPayload ?? null,
        encryptionIv: note.encryptionIv ?? null,
        encryptionVersion: note.encryptionVersion ?? null,
        contentHash: note.contentHash ?? null,
      });
    }
  } else {
    // New note from server
    const localNote: LocalNote = {
      id: note.id,
      userId,
      title: '',
      content: '',
      pinned: note.pinned,
      deletedAt: note.deletedAt?.getTime() ?? null,
      createdAt: note.createdAt.getTime(),
      updatedAt: serverTime,
      syncStatus: 'synced',
      lastSyncedAt: serverTime,
      serverUpdatedAt: serverTime,
      localUpdatedAt: serverTime,
      encryptedPayload: note.encryptedPayload ?? null,
      encryptionIv: note.encryptionIv ?? null,
      encryptionVersion: note.encryptionVersion ?? null,
      contentHash: note.contentHash ?? null,
    };
    await db.notes.add(localNote);
  }
}

export type DeleteNoteFromServerResult =
  | { deleted: true }
  | {
      deleted: false;
      localNote: LocalNote;
    };

type HardDeleteConflictPersistenceError = Error & {
  reason?: 'missing_local_note';
};

/**
 * Apply a realtime server delete to IndexedDB.
 *
 * Clean notes are removed immediately. Notes with unsynced local work are
 * converted into conflicts so the app can offer recovery instead of silently
 * deleting the local draft.
 */
export async function deleteNoteFromServer(
  userId: string,
  noteId: string
): Promise<DeleteNoteFromServerResult> {
  const db = getOfflineDb(userId);
  const existing = await db.notes.get(noteId);

  if (!existing) {
    return { deleted: true };
  }

  const hasPendingNoteSync = await db.syncQueue
    .where('entityId')
    .equals(noteId)
    .and((entry) => entry.entityType === 'note')
    .count();

  if (existing.syncStatus !== 'synced' || hasPendingNoteSync > 0) {
    const conflictedNote: LocalNote = {
      ...existing,
      syncStatus: 'conflict',
    };

    try {
      const updated = await db.notes.update(noteId, { syncStatus: 'conflict' });
      if (updated === 0) {
        const error = new Error('Failed to mark hard-delete conflict in IndexedDB') as HardDeleteConflictPersistenceError;
        error.reason = 'missing_local_note';
        throw error;
      }
    } catch (error) {
      const persistenceError = error as HardDeleteConflictPersistenceError;
      reportReliabilityIssue({
        category: 'sync',
        message: 'Failed to persist hard-delete conflict state',
        level: 'warning',
        data: {
          noteId,
          userId,
          ...(persistenceError.reason ? { reason: persistenceError.reason } : {}),
        },
      }, error);
      throw error;
    }

    return { deleted: false, localNote: conflictedNote };
  }

  // Remove note and its tag associations
  await db.transaction('rw', [db.notes, db.noteTags], async () => {
    await db.notes.delete(noteId);
    await db.noteTags.where('noteId').equals(noteId).delete();
  });

  return { deleted: true };
}

/**
 * Insert or update a tag from server (realtime subscription)
 * Does NOT queue sync operation since this is server->local
 */
export async function upsertTagFromServer(
  userId: string,
  tag: Tag
): Promise<void> {
  const db = getOfflineDb(userId);
  // Use updatedAt when available (post-migration), fall back to createdAt (server-origin)
  const serverTime = (tag.updatedAt ?? tag.createdAt).getTime();

  const existing = await db.tags.get(tag.id);

  if (existing?.syncStatus === 'synced') {
    await db.tags.update(tag.id, {
      name: tag.name,
      color: tag.color,
      lastSyncedAt: serverTime,
      serverUpdatedAt: serverTime,
    });
  } else if (!existing) {
    // New tag from server
    const localTag: LocalTag = {
      id: tag.id,
      userId,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.getTime(),
      syncStatus: 'synced',
      lastSyncedAt: serverTime,
      serverUpdatedAt: serverTime,
      localUpdatedAt: serverTime,
    };
    await db.tags.add(localTag);
  }
}

/**
 * Delete a tag from IndexedDB (realtime subscription - server delete)
 * Does NOT queue sync operation since this is server->local
 */
export async function deleteTagFromServer(
  userId: string,
  tagId: string
): Promise<void> {
  const db = getOfflineDb(userId);

  // Remove tag and its note associations
  await db.transaction('rw', [db.tags, db.noteTags], async () => {
    await db.tags.delete(tagId);
    await db.noteTags.where('tagId').equals(tagId).delete();
  });
}

// Re-export for convenience
export { getOfflineDb, hasOfflineDb };
