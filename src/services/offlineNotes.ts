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
  generateMutationId,
  type LocalNote,
  type LocalTag,
  type LocalNoteTag,
  type SyncQueueEntry,
  type SyncOperation,
} from '../lib/offlineDb';
import type { Note, Tag, TagColor } from '../types';
import type { DbNote, DbTag } from '../types/database';

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
  };
}

// Convert LocalTag to App Tag
function localTagToTag(localTag: LocalTag): Tag {
  return {
    id: localTag.id,
    name: localTag.name,
    color: localTag.color as TagColor,
    createdAt: new Date(localTag.createdAt),
  };
}

// Convert DB Note to LocalNote
function dbNoteToLocal(dbNote: DbNote, userId: string): LocalNote {
  const now = Date.now();
  return {
    id: dbNote.id,
    userId,
    title: dbNote.title,
    content: dbNote.content,
    pinned: dbNote.pinned ?? false,
    deletedAt: dbNote.deleted_at ? new Date(dbNote.deleted_at).getTime() : null,
    createdAt: new Date(dbNote.created_at).getTime(),
    updatedAt: new Date(dbNote.updated_at).getTime(),
    syncStatus: 'synced',
    lastSyncedAt: now,
    serverUpdatedAt: new Date(dbNote.updated_at).getTime(),
    localUpdatedAt: new Date(dbNote.updated_at).getTime(),
  };
}

// Convert DB Tag to LocalTag
function dbTagToLocal(dbTag: DbTag, userId: string): LocalTag {
  const now = Date.now();
  return {
    id: dbTag.id,
    userId,
    name: dbTag.name,
    color: dbTag.color,
    createdAt: new Date(dbTag.created_at).getTime(),
    syncStatus: 'synced',
    lastSyncedAt: now,
    serverUpdatedAt: now,
    localUpdatedAt: now,
  };
}

/**
 * Hydrate IndexedDB from Supabase
 * Called on login to populate local database with server data
 */
export async function hydrateFromServer(userId: string): Promise<void> {
  const db = getOfflineDb(userId);

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

  // Clear existing data and populate fresh
  await db.transaction('rw', [db.notes, db.tags, db.noteTags], async () => {
    // Clear existing data
    await db.notes.clear();
    await db.tags.clear();
    await db.noteTags.clear();

    // Insert notes
    const localNotes = (notesData || []).map((n) => dbNoteToLocal(n as DbNote, userId));
    if (localNotes.length > 0) {
      await db.notes.bulkAdd(localNotes);
    }

    // Insert tags
    const localTags = (tagsData || []).map((t) => dbTagToLocal(t as DbTag, userId));
    if (localTags.length > 0) {
      await db.tags.bulkAdd(localTags);
    }

    // Insert note-tag relationships
    const localNoteTags: LocalNoteTag[] = (noteTagsData || []).map((nt) => ({
      noteId: nt.note_id,
      tagId: nt.tag_id,
      syncStatus: 'synced' as const,
      lastSyncedAt: Date.now(),
    }));
    if (localNoteTags.length > 0) {
      await db.noteTags.bulkAdd(localNoteTags);
    }
  });

  console.log(`Hydrated offline DB: ${notesData?.length || 0} notes, ${tagsData?.length || 0} tags`);
}

/**
 * Check if offline database needs hydration
 */
export async function needsHydration(userId: string): Promise<boolean> {
  const exists = await hasOfflineDb(userId);
  if (!exists) return true;

  const db = getOfflineDb(userId);
  const noteCount = await db.notes.count();

  // If we have notes locally, assume we're hydrated
  // In a more robust implementation, we'd check a lastHydratedAt timestamp
  return noteCount === 0;
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

  // Get all active notes (not soft-deleted)
  let notes = await db.notes
    .where('deletedAt')
    .equals(null as unknown as number) // Dexie quirk for null comparison
    .or('deletedAt')
    .equals(0)
    .toArray();

  // Filter to only null deletedAt (active notes)
  notes = notes.filter((n) => n.deletedAt === null);

  // Sort: pinned first, then by updatedAt descending
  notes.sort((a, b) => {
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

  // Get all soft-deleted notes
  const notes = await db.notes
    .filter((n) => n.deletedAt !== null)
    .toArray();

  // Sort by deletedAt descending (most recently deleted first)
  notes.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

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

  // Get all active notes and filter by search term
  const notes = await db.notes
    .filter((n) =>
      n.deletedAt === null &&
      (n.title.toLowerCase().includes(searchLower) ||
       n.content.toLowerCase().includes(searchLower))
    )
    .toArray();

  // Sort: pinned first, then by updatedAt descending
  notes.sort((a, b) => {
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
 * Get a single note by ID from IndexedDB
 */
export async function getNoteOffline(userId: string, noteId: string): Promise<Note | null> {
  const db = getOfflineDb(userId);
  const note = await db.notes.get(noteId);

  if (!note) return null;

  // Get tags for this note
  const noteTags = await db.noteTags.where('noteId').equals(noteId).toArray();
  const tagIds = noteTags.map((nt) => nt.tagId);
  const tags = tagIds.length > 0 ? await db.tags.where('id').anyOf(tagIds).toArray() : [];

  return localNoteToNote(note, tags.map(localTagToTag));
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
  const clientMutationId = generateMutationId();
  const now = Date.now();

  const entry: SyncQueueEntry = {
    clientMutationId,
    operation,
    entityType,
    entityId,
    payload,
    createdAt: now,
    retryCount: 0,
  };

  // Queue compaction: remove previous pending updates to same entity
  // (keep creates and deletes, only compact consecutive updates)
  if (operation === 'update') {
    await db.syncQueue
      .where('entityId')
      .equals(entityId)
      .and((e) => e.operation === 'update' && e.entityType === entityType)
      .delete();
  }

  await db.syncQueue.add(entry);
  return clientMutationId;
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
  const db = getOfflineDb(userId);
  const now = Date.now();
  const noteId = crypto.randomUUID();

  const localNote: LocalNote = {
    id: noteId,
    userId,
    title,
    content,
    pinned: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    lastSyncedAt: null,
    serverUpdatedAt: null,
    localUpdatedAt: now,
  };

  // Write to IndexedDB
  await db.notes.add(localNote);

  // Queue for sync
  await queueSyncOperation(userId, 'create', 'note', noteId, {
    title,
    content,
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
  const db = getOfflineDb(userId);
  const now = Date.now();
  const createdNotes: Note[] = [];

  // Process in batches to avoid blocking the UI
  const BATCH_SIZE = 50;
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);

    // Create local notes for this batch
    const localNotes: LocalNote[] = batch.map((noteData) => {
      const noteId = crypto.randomUUID();
      const createdAt = noteData.createdAt?.getTime() ?? now;
      const updatedAt = noteData.updatedAt?.getTime() ?? now;

      return {
        id: noteId,
        userId,
        title: noteData.title,
        content: noteData.content,
        pinned: false,
        deletedAt: null,
        createdAt,
        updatedAt,
        syncStatus: 'pending' as const,
        lastSyncedAt: null,
        serverUpdatedAt: null,
        localUpdatedAt: now,
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
  const db = getOfflineDb(userId);
  const now = Date.now();

  // Get current local note to preserve sync tracking fields
  const existing = await db.notes.get(note.id);
  if (!existing) {
    throw new Error(`Note ${note.id} not found in offline database`);
  }

  const localNote: LocalNote = {
    ...existing,
    title: note.title,
    content: note.content,
    updatedAt: now,
    localUpdatedAt: now,
    syncStatus: existing.syncStatus === 'synced' ? 'pending' : existing.syncStatus,
  };

  // Update IndexedDB
  await db.notes.put(localNote);

  // Queue for sync (compaction will remove previous updates)
  await queueSyncOperation(userId, 'update', 'note', note.id, {
    title: note.title,
    content: note.content,
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
  tagId: string
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

  // Update note's updatedAt
  await db.notes.update(noteId, {
    updatedAt: now,
    localUpdatedAt: now,
  });

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

  const entries = await db.syncQueue.orderBy('createdAt').toArray();

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
  clientMutationId: string
): Promise<void> {
  const db = getOfflineDb(userId);
  await db.syncQueue.where('clientMutationId').equals(clientMutationId).delete();
}

/**
 * Mark a note as synced after successful server sync
 */
export async function markNoteSynced(
  userId: string,
  noteId: string,
  serverUpdatedAt: Date
): Promise<void> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  await db.notes.update(noteId, {
    syncStatus: 'synced',
    lastSyncedAt: now,
    serverUpdatedAt: serverUpdatedAt.getTime(),
  });
}

/**
 * Get count of pending sync operations
 */
export async function getPendingSyncCount(userId: string): Promise<number> {
  const db = getOfflineDb(userId);
  return db.syncQueue.count();
}

// ============================================
// REALTIME SYNC HELPERS
// These functions handle server->local updates from realtime subscriptions
// They don't queue sync operations since data comes from server
// ============================================

/**
 * Insert or update a note from server (realtime subscription)
 * Does NOT queue sync operation since this is server->local
 */
export async function upsertNoteFromServer(
  userId: string,
  note: Note
): Promise<void> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  const existing = await db.notes.get(note.id);

  if (existing) {
    // Only update if server version is newer (or if local has no pending changes)
    if (existing.syncStatus === 'synced' || !existing.localUpdatedAt ||
        note.updatedAt.getTime() > existing.localUpdatedAt) {
      await db.notes.update(note.id, {
        title: note.title,
        content: note.content,
        pinned: note.pinned,
        deletedAt: note.deletedAt?.getTime() ?? null,
        updatedAt: note.updatedAt.getTime(),
        serverUpdatedAt: note.updatedAt.getTime(),
        syncStatus: existing.syncStatus === 'pending' ? 'pending' : 'synced',
        lastSyncedAt: now,
      });
    }
  } else {
    // New note from server
    const localNote: LocalNote = {
      id: note.id,
      userId,
      title: note.title,
      content: note.content,
      pinned: note.pinned,
      deletedAt: note.deletedAt?.getTime() ?? null,
      createdAt: note.createdAt.getTime(),
      updatedAt: note.updatedAt.getTime(),
      syncStatus: 'synced',
      lastSyncedAt: now,
      serverUpdatedAt: note.updatedAt.getTime(),
      localUpdatedAt: note.updatedAt.getTime(),
    };
    await db.notes.add(localNote);
  }
}

/**
 * Delete a note from IndexedDB (realtime subscription - server delete)
 * Does NOT queue sync operation since this is server->local
 */
export async function deleteNoteFromServer(
  userId: string,
  noteId: string
): Promise<void> {
  const db = getOfflineDb(userId);

  // Remove note and its tag associations
  await db.transaction('rw', [db.notes, db.noteTags], async () => {
    await db.notes.delete(noteId);
    await db.noteTags.where('noteId').equals(noteId).delete();
  });
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
  const now = Date.now();

  const existing = await db.tags.get(tag.id);

  if (existing) {
    // Only update if not pending local changes
    if (existing.syncStatus === 'synced') {
      await db.tags.update(tag.id, {
        name: tag.name,
        color: tag.color,
        lastSyncedAt: now,
        serverUpdatedAt: now,
      });
    }
  } else {
    // New tag from server
    const localTag: LocalTag = {
      id: tag.id,
      userId,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.getTime(),
      syncStatus: 'synced',
      lastSyncedAt: now,
      serverUpdatedAt: now,
      localUpdatedAt: now,
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
