import { supabase } from '../lib/supabase';
import type { Tag, TagColor } from '../types';
import type { DbTag } from '../types/database';

// Validation constants
const MAX_TAG_NAME_LENGTH = 20;
const MIN_TAG_NAME_LENGTH = 1;

/**
 * Validate tag name and throw if invalid
 */
function validateTagName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length < MIN_TAG_NAME_LENGTH) {
    throw new Error('Tag name cannot be empty');
  }

  if (trimmed.length > MAX_TAG_NAME_LENGTH) {
    throw new Error(`Tag name must be ${MAX_TAG_NAME_LENGTH} characters or less`);
  }

  return trimmed;
}

// Convert database tag to app tag
function toTag(dbTag: DbTag): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    color: dbTag.color as TagColor,
    createdAt: new Date(dbTag.created_at),
  };
}

// Fetch all tags for the current user
export async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }

  return (data || []).map(toTag);
}

// Create a new tag
export async function createTag(
  userId: string,
  name: string,
  color: TagColor
): Promise<Tag> {
  // Validate tag name before sending to database
  const validatedName = validateTagName(name);

  const { data, error } = await supabase
    .from('tags')
    .insert({
      user_id: userId,
      name: validatedName,
      color,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating tag:', error);
    throw error;
  }

  return toTag(data);
}

// Update an existing tag
export async function updateTag(
  id: string,
  updates: { name?: string; color?: TagColor }
): Promise<Tag> {
  // Validate tag name if provided
  const validatedName = updates.name ? validateTagName(updates.name) : undefined;

  const { data, error } = await supabase
    .from('tags')
    .update({
      ...(validatedName && { name: validatedName }),
      ...(updates.color && { color: updates.color }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating tag:', error);
    throw error;
  }

  return toTag(data);
}

// Delete a tag
export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
}

// Add a tag to a note
export async function addTagToNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tags')
    .insert({ note_id: noteId, tag_id: tagId });

  if (error) {
    // Ignore duplicate key errors (tag already added)
    if (error.code !== '23505') {
      console.error('Error adding tag to note:', error);
      throw error;
    }
  }
}

// Remove a tag from a note
export async function removeTagFromNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('note_tags')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId);

  if (error) {
    console.error('Error removing tag from note:', error);
    throw error;
  }
}

// Get all tags for a specific note
export async function getNoteTags(noteId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('note_tags')
    .select('tag_id, tags(*)')
    .eq('note_id', noteId);

  if (error) {
    console.error('Error fetching note tags:', error);
    throw error;
  }

  return (data || [])
    .map((row) => row.tags as unknown as DbTag)
    .filter(Boolean)
    .map(toTag);
}

// Subscribe to real-time tag changes
export function subscribeToTags(
  userId: string,
  onInsert: (tag: Tag) => void,
  onUpdate: (tag: Tag) => void,
  onDelete: (id: string) => void
) {
  const channel = supabase
    .channel('tags-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'tags',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(toTag(payload.new as DbTag))
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tags',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate(toTag(payload.new as DbTag))
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'tags',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onDelete((payload.old as { id: string }).id)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
