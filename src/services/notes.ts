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
  };
}

// Fetch all notes for the current user (with optional tag filtering)
export async function fetchNotes(filterTagIds?: string[]): Promise<Note[]> {
  // First, get all notes with their tags via join
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

// Delete a note
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting note:', error);
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

// Search notes by title and content
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
