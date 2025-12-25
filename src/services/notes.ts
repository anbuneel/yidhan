import { supabase } from '../lib/supabase';
import type { Note, Tag, TagColor } from '../types';
import type { DbNote, DbTag } from '../types/database';

// Convert database tag to app tag
function toTag(dbTag: DbTag): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    color: dbTag.color as TagColor,
    createdAt: new Date(dbTag.created_at),
  };
}

// Convert database note to app note
function toNote(dbNote: DbNote, tags: Tag[] = []): Note {
  return {
    id: dbNote.id,
    title: dbNote.title,
    content: dbNote.content,
    createdAt: new Date(dbNote.created_at),
    updatedAt: new Date(dbNote.updated_at),
    tags,
    pinned: dbNote.pinned ?? false,
    deletedAt: dbNote.deleted_at ? new Date(dbNote.deleted_at) : null,
  };
}

// Fetch all active notes for the current user (excludes soft-deleted)
export async function fetchNotes(filterTagIds?: string[]): Promise<Note[]> {
  // Get all active notes (not soft-deleted) with their tags via join
  // Order by pinned first, then by updated_at
  const { data, error } = await supabase
    .from('notes')
    .select(`
      *,
      note_tags (
        tag_id,
        tags (*)
      )
    `)
    .is('deleted_at', null)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }

  // Transform the data
  let notes = (data || []).map((row) => {
    const tags = (row.note_tags || [])
      .map((nt: { tags: DbTag | null }) => nt.tags)
      .filter((tag): tag is DbTag => tag !== null)
      .map(toTag);
    return toNote(row as DbNote, tags);
  });

  // Apply tag filter if provided (AND logic: notes must have ALL selected tags)
  if (filterTagIds && filterTagIds.length > 0) {
    notes = notes.filter((note) => {
      const noteTagIds = note.tags.map((t) => t.id);
      return filterTagIds.every((tagId) => noteTagIds.includes(tagId));
    });
  }

  return notes;
}

// Create a new note
export async function createNote(
  userId: string,
  title: string = '',
  content: string = '',
  options?: { createdAt?: Date; updatedAt?: Date }
): Promise<Note> {
  const insertData: {
    user_id: string;
    title: string;
    content: string;
    created_at?: string;
    updated_at?: string;
  } = {
    user_id: userId,
    title,
    content,
  };

  // Preserve original timestamps if provided (e.g., during import)
  if (options?.createdAt) {
    insertData.created_at = options.createdAt.toISOString();
  }
  if (options?.updatedAt) {
    insertData.updated_at = options.updatedAt.toISOString();
  }

  const { data, error } = await supabase
    .from('notes')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
    throw error;
  }

  return toNote(data, []);
}

// Batch create multiple notes (for efficient imports)
// Supabase recommends batches of ~1000 rows max
const BATCH_SIZE = 500;

export interface BatchNoteData {
  title: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function createNotesBatch(
  userId: string,
  notes: BatchNoteData[],
  onProgress?: (completed: number, total: number) => void
): Promise<Note[]> {
  const allCreatedNotes: Note[] = [];
  const total = notes.length;

  // Process in batches to avoid hitting Supabase limits
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);

    const insertData = batch.map(note => {
      const data: {
        user_id: string;
        title: string;
        content: string;
        created_at?: string;
        updated_at?: string;
      } = {
        user_id: userId,
        title: note.title,
        content: note.content,
      };

      if (note.createdAt) {
        data.created_at = note.createdAt.toISOString();
      }
      if (note.updatedAt) {
        data.updated_at = note.updatedAt.toISOString();
      }

      return data;
    });

    const { data, error } = await supabase
      .from('notes')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Error batch creating notes:', error);
      throw error;
    }

    const createdNotes = (data || []).map(row => toNote(row, []));
    allCreatedNotes.push(...createdNotes);

    // Report progress after each batch
    if (onProgress) {
      onProgress(Math.min(i + batch.length, total), total);
    }
  }

  return allCreatedNotes;
}

// Update an existing note
export async function updateNote(note: Note): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update({
      title: note.title,
      content: note.content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', note.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating note:', error);
    throw error;
  }

  // Preserve existing tags
  return toNote(data, note.tags);
}

// Soft delete a note (move to Faded Notes)
export async function softDeleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error soft-deleting note:', error);
    throw error;
  }
}

// Restore a soft-deleted note
export async function restoreNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    console.error('Error restoring note:', error);
    throw error;
  }
}

// Permanently delete a note (cannot be recovered)
export async function permanentDeleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error permanently deleting note:', error);
    throw error;
  }
}

// Toggle pin status of a note
export async function toggleNotePin(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ pinned })
    .eq('id', id);

  if (error) {
    console.error('Error toggling note pin:', error);
    throw error;
  }
}

// Search active notes by title and content (excludes soft-deleted)
export async function searchNotes(query: string): Promise<Note[]> {
  if (!query.trim()) {
    return fetchNotes();
  }

  const searchTerm = `%${query}%`;

  const { data, error } = await supabase
    .from('notes')
    .select(`
      *,
      note_tags (
        tag_id,
        tags (*)
      )
    `)
    .is('deleted_at', null)
    .or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error searching notes:', error);
    throw error;
  }

  return (data || []).map((row) => {
    const tags = (row.note_tags || [])
      .map((nt: { tags: DbTag | null }) => nt.tags)
      .filter((tag): tag is DbTag => tag !== null)
      .map(toTag);
    return toNote(row as DbNote, tags);
  });
}

// Fetch all soft-deleted (faded) notes for the current user
export async function fetchFadedNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(`
      *,
      note_tags (
        tag_id,
        tags (*)
      )
    `)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching faded notes:', error);
    throw error;
  }

  return (data || []).map((row) => {
    const tags = (row.note_tags || [])
      .map((nt: { tags: DbTag | null }) => nt.tags)
      .filter((tag): tag is DbTag => tag !== null)
      .map(toTag);
    return toNote(row as DbNote, tags);
  });
}

// Count soft-deleted notes (for badge display)
export async function countFadedNotes(): Promise<number> {
  const { count, error } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })
    .not('deleted_at', 'is', null);

  if (error) {
    console.error('Error counting faded notes:', error);
    throw error;
  }

  return count || 0;
}

// Empty all faded notes (permanent delete)
export async function emptyFadedNotes(): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .not('deleted_at', 'is', null);

  if (error) {
    console.error('Error emptying faded notes:', error);
    throw error;
  }
}

// Cleanup expired faded notes (older than 30 days)
// This runs client-side on app load to auto-release expired notes
const FADED_NOTES_RETENTION_DAYS = 30;

export async function cleanupExpiredFadedNotes(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - FADED_NOTES_RETENTION_DAYS);

  const { data, error } = await supabase
    .from('notes')
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    console.error('Error cleaning up expired faded notes:', error);
    // Don't throw - cleanup is non-critical, app should continue
    return 0;
  }

  const deletedCount = data?.length || 0;
  if (deletedCount > 0) {
    console.log(`Released ${deletedCount} expired note(s)`);
  }

  return deletedCount;
}

// Subscribe to real-time changes
export function subscribeToNotes(
  userId: string,
  onInsert: (note: Note) => void,
  onUpdate: (note: Note) => void,
  onDelete: (id: string) => void
) {
  const channel = supabase
    .channel('notes-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notes',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(toNote(payload.new as DbNote))
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notes',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate(toNote(payload.new as DbNote))
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notes',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onDelete((payload.old as { id: string }).id)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
