/**
 * Sync Engine
 *
 * Processes the offline sync queue when online.
 * Handles conflict detection and self-ignore for realtime events.
 */

import { Capacitor } from '@capacitor/core';
import { supabase, fetchAllPaginated } from '../lib/supabase';
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
import type { DbTag } from '../types/database';

// Lazy check for native platform (avoids issues at module initialization)
let _isNative: boolean | null = null;
function isNativePlatform(): boolean {
  if (_isNative === null) {
    try {
      _isNative = Capacitor.isNativePlatform();
    } catch {
      _isNative = false;
    }
  }
  return _isNative;
}

// Check if online - uses Capacitor Network on native, navigator.onLine on web
async function isOnline(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      // Dynamic import to avoid module initialization issues
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      return status.connected;
    } catch (error) {
      // Fail safe: assume offline to prevent burning through retries
      // This preserves queued operations until network is properly detected
      console.warn('Capacitor Network plugin failed, assuming offline:', error);
      return false;
    }
  }
  return navigator.onLine;
}

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

export interface PullError {
  entity: 'notes' | 'tags';
  operation: 'data' | 'membership';
  error: Error;
}

export interface PullResult {
  pulledNotes: number;
  pulledTags: number;
  errors: PullError[];
}

export interface FullSyncResult extends SyncResult {
  pulled: { notes: number; tags: number };
  pullErrors: PullError[];
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
        .select('*')
        .eq('id', noteId)
        .maybeSingle();

      if (serverNote && localNote.lastSyncedAt) {
        const serverUpdatedAt = new Date(serverNote.updated_at).getTime();
        // Conflict: server was updated after our last sync
        if (serverUpdatedAt > localNote.lastSyncedAt) {
          // Safety check: compare actual content before triggering conflict
          // If content is identical, no real conflict - just timestamp drift
          const contentIdentical =
            serverNote.title === localNote.title &&
            serverNote.content === localNote.content;

          if (contentIdentical) {
            // No actual conflict - update lastSyncedAt to server time and continue
            await db.notes.update(noteId, {
              lastSyncedAt: serverUpdatedAt,
              serverUpdatedAt: serverUpdatedAt,
            });
            // Continue with the update (will just bump server timestamp)
          } else if (onConflictDetected) {
            // Real conflict: content differs
            onConflictDetected({
              entityType: 'note',
              entityId: noteId,
              localVersion: localNote,
              serverVersion: serverNote,
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
        .select('id, created_at')
        .eq('id', tagId)
        .maybeSingle();

      if (existing) {
        // Use server timestamp for cursor consistency
        await markTagSynced(userId, tagId, new Date(existing.created_at));
        return true;
      }

      const { data: created, error } = await supabase.from('tags').insert({
        id: tagId,
        user_id: userId,
        name: data.name as string,
        color: data.color as string,
      }).select().single();

      if (error) throw error;
      // Use server-generated created_at (or updated_at when available)
      const createdRecord = created as Record<string, unknown>;
      const serverTime = createdRecord.updated_at
        ? new Date(createdRecord.updated_at as string)
        : new Date(created.created_at);
      await markTagSynced(userId, tagId, serverTime);
      return true;
    }

    case 'update': {
      const { data: updated, error } = await supabase
        .from('tags')
        .update({
          name: data.name as string,
          color: data.color as string,
        })
        .eq('id', tagId)
        .select()
        .single();

      if (error) throw error;
      // Use server timestamp — updated_at when available, else created_at
      const updatedRecord = updated as Record<string, unknown>;
      const serverTime = updatedRecord.updated_at
        ? new Date(updatedRecord.updated_at as string)
        : new Date(updated.created_at);
      await markTagSynced(userId, tagId, serverTime);
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

async function updateRetryCount(
  userId: string,
  entry: SyncQueueEntry,
  retryCount: number
): Promise<void> {
  const db = getOfflineDb(userId);
  if (typeof entry.id === 'number') {
    await db.syncQueue.update(entry.id, { retryCount });
    return;
  }
  await db.syncQueue
    .where('clientMutationId')
    .equals(entry.clientMutationId)
    .modify({ retryCount });
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

  // Check if online (uses Capacitor Network on native for reliable detection)
  if (!(await isOnline())) {
    return result;
  }

  // Cleanup stale sync entries to prevent permanent "pending" state
  // Only removes non-create operations (creates could lose user data if removed)
  // Entries older than 1 hour with 3+ retries are considered abandoned
  try {
    const db = getOfflineDb(userId);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const staleEntries = await db.syncQueue
      .where('createdAt')
      .below(oneHourAgo)
      .filter((entry) => entry.retryCount >= 3 && entry.operation !== 'create')
      .toArray();

    if (staleEntries.length > 0) {
      console.warn(
        `Cleaning up ${staleEntries.length} stale sync entries (age > 1hr, retries >= 3)`
      );
      for (const entry of staleEntries) {
        await removeSyncQueueEntry(userId, entry.clientMutationId, entry.id);
      }
    }
  } catch (cleanupError) {
    // Non-fatal: if cleanup fails, continue with normal sync
    console.warn('Stale entry cleanup failed:', cleanupError);
  }

  const queue = await getPendingSyncQueue(userId);

  for (const entry of queue) {
    try {
      const success = await processQueueEntry(userId, entry);

      if (success) {
        await removeSyncQueueEntry(userId, entry.clientMutationId, entry.id);
        result.processed++;
      } else {
        // Increment retry count
        const newRetryCount = entry.retryCount + 1;
        await updateRetryCount(userId, entry, newRetryCount);

        // If too many retries, remove from queue
        if (newRetryCount >= 5) {
          await removeSyncQueueEntry(userId, entry.clientMutationId, entry.id);
          result.failed++;
          result.errors.push(
            new Error(`Max retries exceeded for ${entry.entityType}/${entry.entityId}`)
          );
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error : new Error(String(error)));

      // Check if sync status is 'conflict'
      if (error instanceof Error && error.message.includes('conflict')) {
        result.conflicts++;
      }

      // FIX: Increment retry count for exceptions too (prevents infinite pending state)
      // Previously, exceptions left entries stuck forever with retryCount never incrementing
      try {
        const newRetryCount = entry.retryCount + 1;
        await updateRetryCount(userId, entry, newRetryCount);

        // Remove from queue if too many retries
        if (newRetryCount >= 5) {
          await removeSyncQueueEntry(userId, entry.clientMutationId, entry.id);
          result.failed++;
          console.warn(
            `Removing failed sync entry after ${newRetryCount} retries: ${entry.entityType}/${entry.entityId}`
          );
        }
      } catch (dbError) {
        // If we can't update the retry count, log and continue
        // The stale entry cleanup will handle it eventually
        console.error('Failed to update retry count:', dbError);
        result.failed++;
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
 * Called before processing queue to get latest server state.
 *
 * Returns PullResult with counts of pulled entities and any errors.
 * Both entity pulls (notes, tags) run independently — a notes error
 * does not prevent the tag pull from executing.
 */
export async function pullRemoteChanges(userId: string): Promise<PullResult> {
  const db = getOfflineDb(userId);
  const errors: PullError[] = [];
  let pulledNotes = 0;
  let pulledTags = 0;

  // Compute pull cursor from synced entries only (pending/conflict may have skewed timestamps)
  const allNotes = await db.notes.toArray();
  const syncedNotes = allNotes.filter(n => n.syncStatus === 'synced');
  const lastSync = Math.max(...syncedNotes.map(n => n.lastSyncedAt || 0), 0);

  // --- Note data pull (always runs, no early return) ---
  // Full pull when lastSync is 0 (empty DB, post-migration, or failed hydration);
  // incremental pull otherwise.
  const { data: updatedNotes, error: notesError } = await fetchAllPaginated(() => {
    const q = supabase.from('notes').select('*');
    return lastSync > 0
      ? q.gt('updated_at', new Date(lastSync).toISOString())
      : q;
  });

  if (notesError) {
    console.error('Error pulling remote notes:', notesError);
    errors.push({ entity: 'notes', operation: 'data', error: notesError });
  }

  // Always process whatever data was fetched (even partial on mid-pagination error)
  for (const serverNote of updatedNotes) {
    const localNote = await db.notes.get(serverNote.id);

    // Skip if local has pending or conflict changes
    if (localNote && (localNote.syncStatus === 'pending' || localNote.syncStatus === 'conflict')) {
      continue;
    }

    // Use server timestamp for lastSyncedAt (not Date.now())
    const serverTime = new Date(serverNote.updated_at).getTime();
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
      updatedAt: serverTime,
      syncStatus: 'synced',
      lastSyncedAt: serverTime,
      serverUpdatedAt: serverTime,
      localUpdatedAt: serverTime,
    });
    pulledNotes++;
  }

  // --- Note membership query (deletion reconciliation for hard-deleted notes) ---
  const { data: allNoteIds, error: noteMembershipError } = await fetchAllPaginated<{ id: string }>(() =>
    supabase.from('notes').select('id')
  );

  if (noteMembershipError) {
    errors.push({ entity: 'notes', operation: 'membership', error: noteMembershipError });
    // Do NOT run deletion reconciliation — incomplete ID set would cause false deletes
  } else {
    const serverNoteIds = new Set(allNoteIds.map(n => n.id));
    const localNotesForDeletion = await db.notes.toArray();
    for (const localNote of localNotesForDeletion) {
      if (!serverNoteIds.has(localNote.id) && localNote.syncStatus === 'synced') {
        await db.notes.delete(localNote.id);
      }
    }
  }

  // --- Tag data pull (always runs regardless of notes outcome) ---
  // Tags currently lack updated_at, so fetch all (full pull).
  // When tags.updated_at migration lands, this will become incremental.
  const localTags = await db.tags.toArray();
  const syncedTags = localTags.filter(t => t.syncStatus === 'synced');
  const lastTagSync = Math.max(...syncedTags.map(t => t.lastSyncedAt || 0), 0);

  // Try incremental tag pull first; fall back to full pull if column doesn't exist
  let tagPullData: DbTag[] = [];
  let tagPullError: Error | null = null;

  if (lastTagSync > 0) {
    // Attempt incremental pull (will fail with 42703 if updated_at column doesn't exist yet)
    const result = await fetchAllPaginated(() =>
      supabase.from('tags').select('*').gt('updated_at', new Date(lastTagSync).toISOString())
    );
    if (result.error && (result.error.message.includes('42703') || result.error.message.includes('updated_at'))) {
      // Fall back to full tag pull — column doesn't exist yet
      const fallback = await fetchAllPaginated(() => supabase.from('tags').select('*'));
      tagPullData = fallback.data;
      tagPullError = fallback.error;
    } else {
      tagPullData = result.data;
      tagPullError = result.error;
    }
  } else {
    // Full pull (first sync or post-migration)
    const result = await fetchAllPaginated(() => supabase.from('tags').select('*'));
    tagPullData = result.data;
    tagPullError = result.error;
  }

  if (tagPullError) {
    console.error('Error pulling remote tags:', tagPullError);
    errors.push({ entity: 'tags', operation: 'data', error: tagPullError });
  }

  // Process fetched tags — only count actually-changed tags
  for (const serverTag of tagPullData || []) {
    const localTag = localTags.find(t => t.id === serverTag.id);

    // Skip if local has pending changes
    if (localTag && localTag.syncStatus === 'pending') {
      continue;
    }

    // Use updated_at for cursor when available, fall back to created_at.
    // This keeps the cursor in the same time domain as the incremental query.
    const tagRecord = serverTag as Record<string, unknown>;
    const serverTimestamp = tagRecord.updated_at
      ? new Date(tagRecord.updated_at as string).getTime()
      : new Date(serverTag.created_at).getTime();

    // Only count as "pulled" if data actually differs
    if (localTag &&
        localTag.name === serverTag.name &&
        localTag.color === serverTag.color) {
      // No actual change — still update sync cursor but don't count
      await db.tags.update(serverTag.id, {
        lastSyncedAt: serverTimestamp,
        serverUpdatedAt: serverTimestamp,
      });
      continue;
    }

    await db.tags.put({
      id: serverTag.id,
      userId,
      name: serverTag.name,
      color: serverTag.color,
      createdAt: new Date(serverTag.created_at).getTime(),
      syncStatus: 'synced',
      lastSyncedAt: serverTimestamp,
      serverUpdatedAt: serverTimestamp,
      localUpdatedAt: serverTimestamp,
    });
    pulledTags++;
  }

  // --- Tag membership query (deletion detection) ---
  const { data: allTagIds, error: tagMembershipError } = await fetchAllPaginated<{ id: string }>(() =>
    supabase.from('tags').select('id')
  );

  if (tagMembershipError) {
    errors.push({ entity: 'tags', operation: 'membership', error: tagMembershipError });
    // Do NOT run deletion — incomplete ID set would cause false deletes
  } else {
    const serverTagIds = new Set(allTagIds.map(t => t.id));
    const currentLocalTags = await db.tags.toArray();
    for (const localTag of currentLocalTags) {
      if (!serverTagIds.has(localTag.id) && localTag.syncStatus === 'synced') {
        await db.tags.delete(localTag.id);
      }
    }
  }

  return { pulledNotes, pulledTags, errors };
}

/**
 * Full sync: pull remote changes then push local queue.
 * Returns FullSyncResult with both pull and push outcomes.
 */
export async function fullSync(userId: string): Promise<FullSyncResult> {
  // Pull first to get latest server state
  const pullResult = await pullRemoteChanges(userId);

  // Then process our queue
  const pushResult = await processQueue(userId);

  return {
    ...pushResult,
    pulled: { notes: pullResult.pulledNotes, tags: pullResult.pulledTags },
    pullErrors: pullResult.errors,
  };
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
