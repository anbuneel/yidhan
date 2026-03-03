import * as Sentry from '@sentry/react';
import { supabase } from '../lib/supabase';
import type { Note, Tag, TagColor, NoteShare } from '../types';
import type { DbNote, DbTag, DbNoteShare } from '../types/database';
import type { EncryptedShareData, SharePayload } from '../lib/encryption';
import {
  generateShareToken,
  generateShareKey,
  encryptSharePayload,
} from '../lib/encryption';
import { sanitizeHtml } from '../utils/sanitize';
import { validateNoteTitle, validateNoteContentLength } from '../utils/validation';

// Convert database tag to app tag
function toTag(dbTag: DbTag): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    color: dbTag.color as TagColor,
    createdAt: new Date(dbTag.created_at),
    updatedAt: new Date(dbTag.updated_at),
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
    encryptedPayload: dbNote.encrypted_payload,
    encryptionIv: dbNote.encryption_iv,
    encryptionVersion: dbNote.encryption_version,
    contentHash: dbNote.content_hash,
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
  // Validate inputs
  const validatedTitle = validateNoteTitle(title);
  validateNoteContentLength(content);

  const insertData: {
    user_id: string;
    title: string;
    content: string;
    created_at?: string;
    updated_at?: string;
  } = {
    user_id: userId,
    title: validatedTitle,
    content: sanitizeHtml(content),
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
      // Validate inputs
      const validatedTitle = validateNoteTitle(note.title);
      validateNoteContentLength(note.content);

      const data: {
        user_id: string;
        title: string;
        content: string;
        created_at?: string;
        updated_at?: string;
      } = {
        user_id: userId,
        title: validatedTitle,
        content: sanitizeHtml(note.content),
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
  // Validate inputs
  const validatedTitle = validateNoteTitle(note.title);
  validateNoteContentLength(note.content);

  const { data, error } = await supabase
    .from('notes')
    .update({
      title: validatedTitle,
      content: sanitizeHtml(note.content),
      // updated_at is set by server-side trigger (notes_updated_at_trigger)
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

  // Sanitize query to prevent PostgREST filter injection
  // Remove double quotes to prevent breaking out of the quoted string
  const sanitizedQuery = query.replace(/"/g, '');

  const searchTerm = `%${sanitizedQuery}%`;

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
    // Wrap values in double quotes to handle special chars like commas in PostgREST syntax
    .or(`title.ilike."${searchTerm}",content.ilike."${searchTerm}"`)
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
    // Report to Sentry for visibility in production monitoring
    // Don't throw - cleanup is non-critical, app should continue
    Sentry.captureException(error, {
      tags: { operation: 'cleanupExpiredFadedNotes' },
      extra: { cutoffDate: cutoffDate.toISOString() },
    });
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

// ============================================
// Note Sharing Functions ("Share as Letter" — E2EE)
// ============================================

const MAX_EXPIRATION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Cap days at MAX_EXPIRATION_DAYS and return an ISO-8601 expiry timestamp */
function computeExpiresAt(days: number): string {
  const capped = Math.max(1, Math.min(MAX_EXPIRATION_DAYS, Math.floor(days)));
  return new Date(Date.now() + capped * MS_PER_DAY).toISOString();
}

function toNoteShare(dbShare: DbNoteShare): NoteShare {
  return {
    id: dbShare.id,
    noteId: dbShare.note_id,
    userId: dbShare.user_id,
    shareToken: dbShare.share_token,
    expiresAt: dbShare.expires_at ? new Date(dbShare.expires_at) : null,
    createdAt: new Date(dbShare.created_at),
    revokedAt: dbShare.revoked_at ? new Date(dbShare.revoked_at) : null,
  };
}

/**
 * Create an encrypted share link for a note.
 * Uses upsert: if a row exists for this note_id (revoked or expired), it's updated
 * with fresh token, payload, and revoked_at = null. Otherwise a new row is inserted.
 *
 * @returns { share, shareKey } — shareKey is ephemeral, only returned once for URL construction
 */
export async function createNoteShare(
  noteId: string,
  userId: string,
  note: Note,
  expiresInDays: number = 7
): Promise<{ share: NoteShare; shareKey: Uint8Array }> {
  const expiresAt = computeExpiresAt(expiresInDays);

  // Generate per-share random key and token
  const shareKey = generateShareKey();
  const token = generateShareToken();

  // Build the plaintext payload (snapshot)
  const payload: SharePayload = {
    version: 1,
    title: note.title,
    content: note.content,
    tags: note.tags.map(t => ({ name: t.name, color: t.color })),
    sharedAt: new Date().toISOString(),
  };

  // Encrypt with AES-256-GCM, AAD = share:<token>:v1
  const encrypted = await encryptSharePayload(token, shareKey, payload);

  // Shared fields between insert and update
  const encryptedFields = {
    share_token: token,
    encrypted_payload: encrypted.ciphertext,
    iv: encrypted.iv,
    encryption_version: encrypted.version,
    expires_at: expiresAt,
  };

  // Check for existing row (revoked or expired) — UNIQUE(note_id) constraint
  const { data: existing, error: checkError } = await supabase
    .from('note_shares')
    .select('id')
    .eq('note_id', noteId)
    .maybeSingle();

  if (checkError) {
    console.error('Error checking existing share:', checkError);
    throw checkError;
  }

  let data: DbNoteShare;
  if (existing) {
    const { data: updated, error } = await supabase
      .from('note_shares')
      .update({ ...encryptedFields, revoked_at: null })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating note share:', error);
      throw error;
    }
    data = updated;
  } else {
    // Insert new row — retry as update if unique constraint race condition
    const { data: inserted, error } = await supabase
      .from('note_shares')
      .insert({ note_id: noteId, user_id: userId, ...encryptedFields })
      .select()
      .single();

    if (error) {
      // Handle race condition: another tab may have inserted between our check and insert
      if (error.code === '23505') {
        // Unique violation — retry as update
        const { data: raced } = await supabase
          .from('note_shares')
          .select('id')
          .eq('note_id', noteId)
          .maybeSingle();
        if (raced) {
          const { data: updated, error: retryError } = await supabase
            .from('note_shares')
            .update({ ...encryptedFields, revoked_at: null })
            .eq('id', raced.id)
            .select()
            .single();
          if (retryError) {
            console.error('Error updating note share (race retry):', retryError);
            throw retryError;
          }
          data = updated;
        } else {
          throw new Error('Failed to create share link');
        }
      } else {
        console.error('Error creating note share:', error);
        throw error;
      }
    } else {
      data = inserted;
    }
  }

  return { share: toNoteShare(data), shareKey };
}

// Get existing active share for a note (if any -- filters revoked and expired)
export async function getNoteShare(noteId: string): Promise<NoteShare | null> {
  const { data, error } = await supabase
    .from('note_shares')
    .select('*')
    .eq('note_id', noteId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    console.error('Error fetching note share:', error);
    throw error;
  }

  if (!data) return null;

  // Check if expired client-side (server may not have cleaned up yet)
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return toNoteShare(data);
}

// Update share expiration (max 30 days, only active shares)
export async function updateNoteShareExpiration(
  noteId: string,
  expiresInDays: number
): Promise<NoteShare> {
  const { data, error } = await supabase
    .from('note_shares')
    .update({ expires_at: computeExpiresAt(expiresInDays) })
    .eq('note_id', noteId)
    .is('revoked_at', null)
    .select()
    .single();

  if (error) {
    console.error('Error updating note share:', error);
    throw error;
  }

  return toNoteShare(data);
}

// Revoke a share (soft-delete -- sets revoked_at, does not delete the row)
export async function revokeNoteShare(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('note_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('note_id', noteId)
    .is('revoked_at', null);

  if (error) {
    console.error('Error revoking note share:', error);
    throw error;
  }
}

/**
 * Fetch encrypted share data by token (public, no auth required).
 * Calls the `fetch_shared_note` RPC function which handles:
 * - Token validation
 * - Expiration check
 * - Revocation check
 * - Soft-deleted note check (JOIN notes)
 * Returns null for all error cases (uniform — no enumeration).
 */
export async function fetchSharedNote(token: string): Promise<EncryptedShareData | null> {
  const { data, error } = await supabase
    .rpc('fetch_shared_note', { share_token_param: token });

  if (error) {
    console.error('Error fetching shared note:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null; // Not found, expired, revoked, or note deleted — uniform
  }

  const row = data[0];
  if (!row.encrypted_payload || !row.iv || row.encryption_version == null) {
    console.error('fetchSharedNote: RPC returned incomplete data', row);
    return null;
  }

  return {
    ciphertext: row.encrypted_payload,
    iv: row.iv,
    version: row.encryption_version,
  };
}

// Share link export interface for full account backup
export interface NoteShareExport {
  noteTitle: string;
  noteId: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
}

// Fetch all active share links for the current user (for account backup)
export async function fetchAllNoteShares(): Promise<NoteShareExport[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('note_shares')
    .select(`
      share_token,
      expires_at,
      created_at,
      note_id,
      notes!inner(title)
    `)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching note shares:', error);
    return [];
  }

  if (!data) return [];

  return data.map((share) => ({
    noteTitle: (share.notes as { title: string })?.title || 'Untitled',
    noteId: share.note_id,
    token: share.share_token,
    expiresAt: share.expires_at,
    createdAt: share.created_at,
  }));
}
