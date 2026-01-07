/**
 * Offline Notes Service
 *
 * Provides offline-first note operations using IndexedDB (Dexie.js).
 * Phase 1: Read-only offline support - hydrate from Supabase, read from IndexedDB.
 * Phase 2+: Will add offline writes and sync queue.
 */

import { supabase } from '../lib/supabase';
import {
  getOfflineDb,
  clearOfflineDb,
  hasOfflineDb,
  type LocalNote,
  type LocalTag,
  type LocalNoteTag,
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

// Re-export for convenience
export { getOfflineDb, hasOfflineDb };
