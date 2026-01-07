/**
 * Sync Engine
 *
 * Processes the offline sync queue when online.
 * Handles conflict detection and self-ignore for realtime events.
 */

import { supabase } from '../lib/supabase';
import {
  getOfflineDb,
  type SyncQueueEntry,
  type LocalNote,
  type LocalTag,
} from '../lib/offlineDb';
import {
  getPendingSyncQueue,
  removeSyncQueueEntry,
  markNoteSynced,
} from './offlineNotes';
import { markTagSynced } from './offlineTags';

// Track pending mutations to self-ignore realtime events
const pendingMutations = new Set<string>();

// Track timeout IDs to prevent memory leaks
const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

// Sync state
let isSyncing = false;
let syncPromise: Promise<SyncResult> | null = null;

export interface SyncResult {
  processed: number;
  failed: number;
  conflicts: number;
  errors: Error[];
}

export interface ConflictInfo {
  entityType: 'note' | 'tag';
  entityId: string;
  localVersion: LocalNote | LocalTag;
  serverVersion: unknown;
}

// Callbacks for conflict handling (set by App.tsx)
let onConflictDetected: ((conflict: ConflictInfo) => void) | null = null;

/**
 * Register a conflict handler
 */
export function setConflictHandler(
  handler: (conflict: ConflictInfo) => void
): void {
  onConflictDetected = handler;
}

/**
 * Check if a mutation ID is pending (for self-ignore)
 */
export function isPendingMutation(clientMutationId: string): boolean {
  return pendingMutations.has(clientMutationId);
}

/**
 * Add a mutation ID to pending set
 */
export function addPendingMutation(clientMutationId: string): void {
  pendingMutations.add(clientMutationId);
}

/**
 * Remove a mutation ID from pending set (after server confirms)
 */
export function removePendingMutation(clientMutationId: string): void {
  pendingMutations.delete(clientMutationId);
}

/**
 * Process a single sync queue entry
 * Returns true if successful, false if should retry
 */
async function processQueueEntry(
  userId: string,
  entry: SyncQueueEntry
): Promise<boolean> {
  const { operation, entityType, entityId, payload, clientMutationId } = entry;

  // Add to pending mutations for self-ignore
  addPendingMutation(clientMutationId);

  try {
    switch (entityType) {
      case 'note':
        return await processNoteOperation(userId, operation, entityId, payload);
      case 'tag':
        return await processTagOperation(userId, operation, entityId, payload);
      case 'noteTag':
        return await processNoteTagOperation(operation, payload);
      default:
        console.warn(`Unknown entity type: ${entityType}`);
        return true; // Don't retry unknown types
    }
  } catch (error) {
    console.error(`Sync error for ${entityType}/${entityId}:`, error);

    // Check if it's a retryable error
    if (isRetryableError(error)) {
      return false; // Retry later
    }

    // Non-retryable error (4xx client errors)
    return true; // Remove from queue
  } finally {
    // Remove from pending after a delay to allow realtime to process
    const timeoutId = setTimeout(() => {
      removePendingMutation(clientMutationId);
      pendingTimeouts.delete(timeoutId);
    }, 2000);
    pendingTimeouts.add(timeoutId);
  }
}

/**
 * Process note operations
 */
async function processNoteOperation(
  userId: string,
  operation: string,
  noteId: string,
  payload: unknown
): Promise<boolean> {
  const db = getOfflineDb(userId);
  const data = payload as Record<string, unknown>;

  switch (operation) {
    case 'create': {
      // Check if note already exists on server (idempotency)
      const { data: existing } = await supabase
        .from('notes')
        .select('id')
        .eq('id', noteId)
        .maybeSingle();

      if (existing) {
        // Already created, mark as synced
        await markNoteSynced(userId, noteId, new Date());
        return true;
      }

      const { data: created, error } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          user_id: userId,
          title: data.title as string,
          content: data.content as string,
          pinned: data.pinned as boolean,
        })
        .select()
        .single();

      if (error) throw error;
      await markNoteSynced(userId, noteId, new Date(created.updated_at));
      return true;
    }

    case 'update': {
      // Check for conflicts before updating
      const localNote = await db.notes.get(noteId);
      if (!localNote) return true; // Note deleted locally

      const { data: serverNote } = await supabase
        .from('notes')
        .select('updated_at')
        .eq('id', noteId)
        .maybeSingle();

      if (serverNote && localNote.lastSyncedAt) {
        const serverUpdatedAt = new Date(serverNote.updated_at).getTime();
        // Conflict: server was updated after our last sync
        if (serverUpdatedAt > localNote.lastSyncedAt) {
          // Fetch full server version for conflict resolution
          const { data: fullServerNote } = await supabase
            .from('notes')
            .select('*')
            .eq('id', noteId)
            .single();

          if (fullServerNote && onConflictDetected) {
            onConflictDetected({
              entityType: 'note',
              entityId: noteId,
              localVersion: localNote,
              serverVersion: fullServerNote,
            });
            // Mark as conflict in local DB
            await db.notes.update(noteId, { syncStatus: 'conflict' });
            return true; // Remove from queue, conflict handler takes over
          }
        }
      }

      const { data: updated, error } = await supabase
        .from('notes')
        .update({
          title: data.title as string,
          content: data.content as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      await markNoteSynced(userId, noteId, new Date(updated.updated_at));
      return true;
    }

    case 'soft_delete': {
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: data.deletedAt as string })
        .eq('id', noteId);

      if (error) throw error;
      await markNoteSynced(userId, noteId, new Date());
      return true;
    }

    case 'restore': {
      const { data: restored, error } = await supabase
        .from('notes')
        .update({ deleted_at: null })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      await markNoteSynced(userId, noteId, new Date(restored.updated_at));
      return true;
    }

    case 'delete': {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      // Ignore "not found" errors for deletes
      if (error && !error.message.includes('0 rows')) throw error;
      return true;
    }

    case 'pin': {
      const { data: pinned, error } = await supabase
        .from('notes')
        .update({ pinned: data.pinned as boolean })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      await markNoteSynced(userId, noteId, new Date(pinned.updated_at));
      return true;
    }

    default:
      console.warn(`Unknown note operation: ${operation}`);
      return true;
  }
}

/**
 * Process tag operations
 */
async function processTagOperation(
  userId: string,
  operation: string,
  tagId: string,
  payload: unknown
): Promise<boolean> {
  const data = payload as Record<string, unknown>;

  switch (operation) {
    case 'create': {
      // Check if tag already exists (idempotency)
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('id', tagId)
        .maybeSingle();

      if (existing) {
        await markTagSynced(userId, tagId, new Date());
        return true;
      }

      const { error } = await supabase.from('tags').insert({
        id: tagId,
        user_id: userId,
        name: data.name as string,
        color: data.color as string,
      });

      if (error) throw error;
      await markTagSynced(userId, tagId, new Date());
      return true;
    }

    case 'update': {
      const { error } = await supabase
        .from('tags')
        .update({
          name: data.name as string,
          color: data.color as string,
        })
        .eq('id', tagId);

      if (error) throw error;
      await markTagSynced(userId, tagId, new Date());
      return true;
    }

    case 'delete': {
      const { error } = await supabase.from('tags').delete().eq('id', tagId);

      // Ignore "not found" errors
      if (error && !error.message.includes('0 rows')) throw error;
      return true;
    }

    default:
      console.warn(`Unknown tag operation: ${operation}`);
      return true;
  }
}

/**
 * Process note-tag operations
 */
async function processNoteTagOperation(
  operation: string,
  payload: unknown
): Promise<boolean> {
  const data = payload as { noteId: string; tagId: string };

  switch (operation) {
    case 'add_tag': {
      const { error } = await supabase.from('note_tags').insert({
        note_id: data.noteId,
        tag_id: data.tagId,
      });

      // Ignore duplicate key errors (23505)
      if (error && error.code !== '23505') throw error;
      return true;
    }

    case 'remove_tag': {
      const { error } = await supabase
        .from('note_tags')
        .delete()
        .eq('note_id', data.noteId)
        .eq('tag_id', data.tagId);

      if (error) throw error;
      return true;
    }

    default:
      console.warn(`Unknown noteTag operation: ${operation}`);
      return true;
  }
}

/**
 * Check if an error is retryable (5xx, network errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return true;
    }
  }

  // Check for HTTP status codes
  const err = error as { status?: number; code?: string };
  if (err.status && err.status >= 500) {
    return true;
  }

  // PostgreSQL/Supabase error codes that are retryable
  if (err.code === '40001' || err.code === '40P01') {
    return true; // Serialization failure, deadlock
  }

  return false;
}

/**
 * Process the entire sync queue
 * Called when coming back online or periodically
 */
export async function processQueue(userId: string): Promise<SyncResult> {
  // Prevent concurrent syncs
  if (isSyncing && syncPromise) {
    return syncPromise;
  }

  isSyncing = true;
  syncPromise = doProcessQueue(userId);

  try {
    return await syncPromise;
  } finally {
    isSyncing = false;
    syncPromise = null;
  }
}

async function doProcessQueue(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    failed: 0,
    conflicts: 0,
    errors: [],
  };

  // Check if online
  if (!navigator.onLine) {
    return result;
  }

  const queue = await getPendingSyncQueue(userId);

  for (const entry of queue) {
    try {
      const success = await processQueueEntry(userId, entry);

      if (success) {
        await removeSyncQueueEntry(userId, entry.clientMutationId);
        result.processed++;
      } else {
        // Increment retry count
        const db = getOfflineDb(userId);
        await db.syncQueue
          .where('clientMutationId')
          .equals(entry.clientMutationId)
          .modify({ retryCount: entry.retryCount + 1 });

        // If too many retries, remove from queue
        if (entry.retryCount >= 5) {
          await removeSyncQueueEntry(userId, entry.clientMutationId);
          result.failed++;
          result.errors.push(
            new Error(`Max retries exceeded for ${entry.entityType}/${entry.entityId}`)
          );
        }
      }
    } catch (error) {
      result.failed++;
      result.errors.push(error instanceof Error ? error : new Error(String(error)));

      // Check if sync status is 'conflict'
      if (error instanceof Error && error.message.includes('conflict')) {
        result.conflicts++;
      }
    }
  }

  console.log(
    `Sync complete: ${result.processed} processed, ${result.failed} failed, ${result.conflicts} conflicts`
  );

  return result;
}

/**
 * Pull remote changes and apply to IndexedDB
 * Called before processing queue to get latest server state
 */
export async function pullRemoteChanges(userId: string): Promise<void> {
  const db = getOfflineDb(userId);

  // Get the most recent lastSyncedAt from our local notes
  const notes = await db.notes.toArray();
  const lastSync = Math.max(
    ...notes.map((n) => n.lastSyncedAt || 0),
    0
  );

  // If we've never synced, skip (initial hydration handles this)
  if (lastSync === 0) {
    return;
  }

  // Fetch notes updated after our last sync
  const { data: updatedNotes, error: notesError } = await supabase
    .from('notes')
    .select('*')
    .gt('updated_at', new Date(lastSync).toISOString());

  if (notesError) {
    console.error('Error pulling remote notes:', notesError);
    return;
  }

  // Apply updates to local DB (skip notes with pending changes)
  for (const serverNote of updatedNotes || []) {
    const localNote = await db.notes.get(serverNote.id);

    // Skip if local has pending changes
    if (localNote && localNote.syncStatus === 'pending') {
      continue;
    }

    // Skip if local has conflict
    if (localNote && localNote.syncStatus === 'conflict') {
      continue;
    }

    // Update local with server version
    const now = Date.now();
    await db.notes.put({
      id: serverNote.id,
      userId,
      title: serverNote.title,
      content: serverNote.content,
      pinned: serverNote.pinned ?? false,
      deletedAt: serverNote.deleted_at
        ? new Date(serverNote.deleted_at).getTime()
        : null,
      createdAt: new Date(serverNote.created_at).getTime(),
      updatedAt: new Date(serverNote.updated_at).getTime(),
      syncStatus: 'synced',
      lastSyncedAt: now,
      serverUpdatedAt: new Date(serverNote.updated_at).getTime(),
      localUpdatedAt: new Date(serverNote.updated_at).getTime(),
    });
  }

  // Similarly for tags
  const { data: updatedTags, error: tagsError } = await supabase
    .from('tags')
    .select('*');

  if (tagsError) {
    console.error('Error pulling remote tags:', tagsError);
    return;
  }

  // Sync tags (last-write-wins, simpler than notes)
  const localTags = await db.tags.toArray();

  for (const serverTag of updatedTags || []) {
    const localTag = localTags.find((t) => t.id === serverTag.id);

    // Skip if local has pending changes
    if (localTag && localTag.syncStatus === 'pending') {
      continue;
    }

    const now = Date.now();
    await db.tags.put({
      id: serverTag.id,
      userId,
      name: serverTag.name,
      color: serverTag.color,
      createdAt: new Date(serverTag.created_at).getTime(),
      syncStatus: 'synced',
      lastSyncedAt: now,
      serverUpdatedAt: now,
      localUpdatedAt: now,
    });
  }

  // Handle deleted tags (tags on server but not in our pending creates)
  const serverTagIds = new Set((updatedTags || []).map((t) => t.id));
  for (const localTag of localTags) {
    if (!serverTagIds.has(localTag.id) && localTag.syncStatus === 'synced') {
      // Tag was deleted on server
      await db.tags.delete(localTag.id);
    }
  }
}

/**
 * Full sync: pull then push
 */
export async function fullSync(userId: string): Promise<SyncResult> {
  // Pull first to get latest server state
  await pullRemoteChanges(userId);

  // Then process our queue
  return processQueue(userId);
}

/**
 * Get sync status
 */
export function isSyncInProgress(): boolean {
  return isSyncing;
}

/**
 * Clear all sync state (call on logout)
 * Cleans up pending timeouts and mutations to prevent memory leaks
 */
export function clearSyncState(): void {
  // Clear all pending timeouts
  pendingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  pendingTimeouts.clear();

  // Clear pending mutations
  pendingMutations.clear();

  // Reset sync state
  isSyncing = false;
  syncPromise = null;

  // Clear conflict handler
  onConflictDetected = null;
}
