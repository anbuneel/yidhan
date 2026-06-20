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
  MIGRATION_SYNC_SENTINEL,
  type SyncQueueEntry,
  type LocalNote,
  type LocalTag,
} from '../lib/offlineDb';
import {
  getPendingSyncQueue,
  removeSyncQueueEntry,
  markNoteSynced,
  markSyncQueueEntryBlocked,
  updateSyncQueueEntry,
} from './offlineNotes';
import { markTagSynced } from './offlineTags';
import {
  addReliabilityBreadcrumb,
  reportReliabilityIssue,
} from '../utils/reliabilityTelemetry';
import type { Database } from '../types/database';

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

const MAX_SYNC_RETRIES = 5;
const STALE_SYNC_ENTRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STALE_SYNC_ENTRY_MIN_RETRIES = 3;
export const SYNC_BATCH_CONCURRENCY_LIMIT = 6;

// Sync state
let isSyncing = false;
let syncPromise: Promise<SyncResult> | null = null;

// Pause/resume state for E2EE (gate sync during migration or key rotation)
// Uses a shared Promise so all concurrent waiters resolve when resumed
// (previous single-resolver pattern caused deadlocks when multiple sync
// functions called waitForUnpause concurrently).
let isPaused = false;
let pausePromise: Promise<void> | null = null;
let pauseResolve: (() => void) | null = null;

/**
 * Pause sync operations. Any in-flight sync will complete,
 * but new fullSync/pullRemoteChanges/processQueue calls will wait.
 */
export function pauseSync(): void {
  if (!isPaused) {
    isPaused = true;
    pausePromise = new Promise<void>((resolve) => {
      pauseResolve = resolve;
    });
  }
}

/**
 * Resume sync operations. All waiting calls will proceed.
 */
export function resumeSync(): void {
  isPaused = false;
  if (pauseResolve) {
    pauseResolve();
    pauseResolve = null;
  }
  pausePromise = null;
}

/** Wait for sync to be unpaused (returns immediately if not paused) */
async function waitForUnpause(): Promise<void> {
  if (!isPaused || !pausePromise) return;
  return pausePromise;
}

export interface SyncResult {
  processed: number;
  failed: number;
  blocked: number;
  conflicts: number;
  errors: Error[];
}

export interface ServerNoteVersion {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  display_updated_at?: string | null;
  updated_at: string;
  encrypted_payload: string | null;
  encryption_iv: string | null;
  encryption_version: number | null;
  content_hash: string | null;
}

export interface HardDeletedServerNoteVersion extends ServerNoteVersion {
  user_id: string;
  deleted_at: string;
  hard_deleted: true;
}

export type NoteConflictServerVersion =
  | (ServerNoteVersion & { hard_deleted?: false })
  | HardDeletedServerNoteVersion;

function isEncryptedServerNote(note: ServerNoteVersion): boolean {
  return Boolean(note.encrypted_payload && note.encryption_iv && note.encryption_version != null && note.content_hash);
}

function createPlaintextServerNoteError(noteId: string): Error {
  return new Error(`Refusing to store plaintext server note ${noteId}`);
}

function getDisplayUpdatedAt(
  note: Pick<ServerNoteVersion, 'updated_at' | 'display_updated_at'>
): string {
  return note.display_updated_at ?? note.updated_at;
}

export interface NoteConflictInfo {
  entityType: 'note';
  entityId: string;
  localVersion: LocalNote;
  serverVersion: NoteConflictServerVersion;
}

export interface TagConflictInfo {
  entityType: 'tag';
  entityId: string;
  localVersion: LocalTag;
  serverVersion: LocalTag;
}

export type ConflictInfo = NoteConflictInfo | TagConflictInfo;

export interface PullError {
  entity: 'notes' | 'tags';
  operation: 'data' | 'membership';
  error: Error;
}

export interface PullResult {
  pulledNotes: number;
  pulledTags: number;
  deletedNotes: number;
  deletedTags: number;
  errors: PullError[];
}

export interface FullSyncResult extends SyncResult {
  pulled: { notes: number; tags: number };
  deleted: { notes: number; tags: number };
  pullErrors: PullError[];
}

// Callbacks for conflict handling (set by App.tsx)
let onConflictDetected: ((conflict: ConflictInfo) => void) | null = null;

type QueueEntryOutcome = 'processed' | 'retry' | 'blocked' | 'conflict';

interface QueueEntryResult {
  outcome: QueueEntryOutcome;
  error?: Error;
}

class SyncConflictError extends Error {
  constructor(entityId: string) {
    super(`Sync conflict detected for ${entityId}`);
    this.name = 'SyncConflictError';
  }
}

/**
 * Register a conflict handler
 */
export function setConflictHandler(
  handler: (conflict: ConflictInfo) => void
): void {
  onConflictDetected = handler;
}

export function reportConflict(conflict: ConflictInfo): void {
  onConflictDetected?.(conflict);
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
 * Process a single sync queue entry.
 */
async function processQueueEntry(
  userId: string,
  entry: SyncQueueEntry
): Promise<QueueEntryResult> {
  const { operation, entityType, entityId, payload, clientMutationId } = entry;

  // Add to pending mutations for self-ignore
  addPendingMutation(clientMutationId);

  try {
    switch (entityType) {
      case 'note':
        return {
          outcome: await processNoteOperation(userId, operation, entityId, payload)
            ? 'processed'
            : 'retry',
        };
      case 'tag':
        return {
          outcome: await processTagOperation(userId, operation, entityId, payload)
            ? 'processed'
            : 'retry',
        };
      case 'noteTag':
        return {
          outcome: await processNoteTagOperation(operation, payload)
            ? 'processed'
            : 'retry',
        };
      default:
        console.warn(`Unknown entity type: ${entityType}`);
        return { outcome: 'processed' };
    }
  } catch (error) {
    if (error instanceof SyncConflictError) {
      return {
        outcome: 'conflict',
        error,
      };
    }

    console.error(`Sync error for ${entityType}/${entityId}:`, error);

    if (isRetryableError(error)) {
      return {
        outcome: 'retry',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }

    return {
      outcome: 'blocked',
      error: error instanceof Error ? error : new Error(String(error)),
    };
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
        .select('id, updated_at')
        .eq('id', noteId)
        .maybeSingle();

      if (existing) {
        // Already created, mark as synced using server timestamp
        await markNoteSynced(userId, noteId, new Date(existing.updated_at));
        return true;
      }

      const insertPayload: Database['public']['Tables']['notes']['Insert'] = {
        id: noteId,
        user_id: userId,
        title: (data.title as string) ?? '',
        content: (data.content as string) ?? '',
        pinned: (data.pinned as boolean) ?? false,
        encrypted_payload: (data.encrypted_payload as string | null) ?? null,
        encryption_iv: (data.encryption_iv as string | null) ?? null,
        encryption_version: (data.encryption_version as number | null) ?? null,
        content_hash: (data.content_hash as string | null) ?? null,
      };

      if (typeof data.createdAt === 'string') {
        insertPayload.created_at = data.createdAt;
      }
      if (typeof data.updatedAt === 'string') {
        insertPayload.display_updated_at = data.updatedAt;
      }

      const { data: created, error } = await supabase
        .from('notes')
        .insert(insertPayload)
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
          // For E2EE notes, compare content_hash instead of plaintext.
          // Fallback to plaintext comparison ONLY for unencrypted notes —
          // encrypted notes always have empty title/content in storage,
          // so plaintext comparison would always return true (false negative).
          const isEncrypted = Boolean(localNote.contentHash || serverNote.content_hash);
          const contentIdentical = isEncrypted
            ? (localNote.contentHash != null && serverNote.content_hash != null &&
               serverNote.content_hash === localNote.contentHash)
            : serverNote.title === localNote.title &&
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
            reportConflict({
              entityType: 'note',
              entityId: noteId,
              localVersion: localNote,
              serverVersion: serverNote,
            });
            // Mark as conflict in local DB
            await db.notes.update(noteId, { syncStatus: 'conflict' });
            throw new SyncConflictError(noteId);
          }
        }
      }

      // Build the update payload — include encrypted fields when present
      const updatePayload: Record<string, unknown> = {
        title: data.title as string,
        content: data.content as string,
        // updated_at is set by server-side trigger (notes_updated_at_trigger)
      };
      if (data.encrypted_payload !== undefined) {
        updatePayload.encrypted_payload = data.encrypted_payload;
        updatePayload.encryption_iv = data.encryption_iv;
        updatePayload.encryption_version = data.encryption_version;
        updatePayload.content_hash = data.content_hash;
      }

      const { data: updated, error } = await supabase
        .from('notes')
        .update(updatePayload)
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      await markNoteSynced(userId, noteId, new Date(updated.updated_at));
      return true;
    }

    case 'soft_delete': {
      const { data: softDeleted, error } = await supabase
        .from('notes')
        .update({ deleted_at: data.deletedAt as string })
        .eq('id', noteId)
        .select('updated_at')
        .single();

      if (error) throw error;
      await markNoteSynced(userId, noteId, new Date(softDeleted.updated_at));
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
        .select('id, created_at, updated_at')
        .eq('id', tagId)
        .maybeSingle();

      if (existing) {
        // Use server timestamp for cursor consistency (updated_at when available)
        const existingRecord = existing as Record<string, unknown>;
        const serverTime = existingRecord.updated_at
          ? new Date(existingRecord.updated_at as string)
          : new Date(existing.created_at);
        await markTagSynced(userId, tagId, serverTime);
        return true;
      }

      const { data: created, error } = await supabase.from('tags').insert({
        id: tagId,
        user_id: userId,
        name: data.name as string,
        color: data.color as string,
      }).select().maybeSingle();

      if (error) throw error;
      if (!created) {
        // Insert returned no row — unexpected but not retryable.
        // Delete local tag to prevent stuck-pending state.
        const db = getOfflineDb(userId);
        await db.tags.delete(tagId);
        return true;
      }
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
        .maybeSingle();

      if (error) throw error;
      if (!updated) {
        // Tag was deleted on server — remove local copy to prevent
        // stuck-pending state. Membership cleanup only removes 'synced'
        // tags, so we must handle 'pending' orphans here.
        const db = getOfflineDb(userId);
        await db.tags.delete(tagId);
        return true;
      }
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'Unknown sync failure';
}

async function updateRetryMetadata(
  userId: string,
  entry: SyncQueueEntry,
  retryCount: number,
  lastError: string | null
): Promise<void> {
  await updateSyncQueueEntry(userId, entry, {
    status: 'pending',
    retryCount,
    lastError,
    lastAttemptAt: Date.now(),
    blockedAt: null,
  });
}

async function blockQueueEntry(
  userId: string,
  entry: SyncQueueEntry,
  retryCount: number,
  reason: 'stale_cleanup' | 'retry_exhausted' | 'exception_exhausted' | 'non_retryable',
  lastError: string
): Promise<void> {
  await markSyncQueueEntryBlocked(userId, entry, retryCount, lastError);
  reportReliabilityIssue({
    category: 'sync',
    message: 'Sync queue entry blocked',
    level: 'warning',
    data: {
      reason,
      operation: entry.operation,
      entityType: entry.entityType,
      entityId: entry.entityId,
      retryCount,
    },
  });
}

function createEmptySyncResult(): SyncResult {
  return {
    processed: 0,
    failed: 0,
    blocked: 0,
    conflicts: 0,
    errors: [],
  };
}

function mergeSyncResult(target: SyncResult, delta: SyncResult): void {
  target.processed += delta.processed;
  target.failed += delta.failed;
  target.blocked += delta.blocked;
  target.conflicts += delta.conflicts;
  target.errors.push(...delta.errors);
}

export function buildQueueBatches(queue: SyncQueueEntry[]): SyncQueueEntry[][] {
  const batches: SyncQueueEntry[][] = [];
  let currentBatch: SyncQueueEntry[] = [];
  let currentBatchKind: 'entity' | 'noteTag' | null = null;
  const currentBatchKeys = new Set<string>();

  for (const entry of queue) {
    const batchKind = entry.entityType === 'noteTag' ? 'noteTag' : 'entity';
    const entityKey = `${entry.entityType}:${entry.entityId}`;
    // noteTag operations depend on their note/tag already existing on the server,
    // so they always start a new batch when crossing the entity <-> noteTag boundary.
    const shouldStartNewBatch =
      currentBatch.length > 0
      && (currentBatchKind !== batchKind || currentBatchKeys.has(entityKey));

    if (shouldStartNewBatch) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchKeys.clear();
    }

    currentBatch.push(entry);
    currentBatchKind = batchKind;
    currentBatchKeys.add(entityKey);
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function processBatchWithLimit(
  userId: string,
  batch: SyncQueueEntry[],
  concurrencyLimit: number = SYNC_BATCH_CONCURRENCY_LIMIT
): Promise<SyncResult[]> {
  const results: SyncResult[] = new Array(batch.length);
  let nextIndex = 0;

  // Independent queue entries can run in parallel, but keep concurrency bounded
  // and convert any unexpected throw into a per-entry SyncResult.
  const worker = async () => {
    while (nextIndex < batch.length) {
      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = await processQueuedEntryAndPersist(userId, batch[currentIndex]);
      } catch (unexpectedError) {
        results[currentIndex] = {
          processed: 0,
          failed: 1,
          blocked: 0,
          conflicts: 0,
          errors: [unexpectedError instanceof Error ? unexpectedError : new Error(String(unexpectedError))],
        };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrencyLimit, batch.length) }, () => worker())
  );

  return results;
}

export async function invalidateSyncPullCursors(userId: string): Promise<void> {
  const db = getOfflineDb(userId);

  await db.transaction('rw', [db.notes, db.tags], async () => {
    await db.notes
      .where('syncStatus')
      .equals('synced')
      .modify({ lastSyncedAt: MIGRATION_SYNC_SENTINEL });

    await db.tags
      .where('syncStatus')
      .equals('synced')
      .modify({ lastSyncedAt: MIGRATION_SYNC_SENTINEL });
  });
}

async function processQueuedEntryAndPersist(
  userId: string,
  entry: SyncQueueEntry
): Promise<SyncResult> {
  const result = createEmptySyncResult();

  try {
    const queueResult = await processQueueEntry(userId, entry);

    if (queueResult.outcome === 'processed') {
      await removeSyncQueueEntry(userId, entry.clientMutationId, entry.id);
      result.processed++;
    } else if (queueResult.outcome === 'retry') {
      const newRetryCount = entry.retryCount + 1;
      const lastError = getErrorMessage(queueResult.error);
      const retryError = queueResult.error ?? new Error(lastError);
      result.errors.push(retryError);

      if (newRetryCount >= MAX_SYNC_RETRIES) {
        await blockQueueEntry(
          userId,
          entry,
          newRetryCount,
          'retry_exhausted',
          lastError
        );
        result.blocked++;
      } else {
        await updateRetryMetadata(userId, entry, newRetryCount, lastError);
        result.failed++;
      }
    } else if (queueResult.outcome === 'conflict') {
      await removeSyncQueueEntry(userId, entry.clientMutationId, entry.id);
      result.conflicts++;
    } else {
      const blockedError = queueResult.error ?? new Error('Non-retryable sync failure');
      const blockedRetryCount = entry.retryCount + 1;
      await blockQueueEntry(
        userId,
        entry,
        blockedRetryCount,
        'non_retryable',
        getErrorMessage(blockedError)
      );
      result.blocked++;
      result.errors.push(blockedError);
    }
  } catch (error) {
    const syncError = error instanceof Error ? error : new Error(String(error));
    result.errors.push(syncError);

    try {
      const newRetryCount = entry.retryCount + 1;
      const lastError = getErrorMessage(syncError);

      if (newRetryCount >= MAX_SYNC_RETRIES) {
        await blockQueueEntry(
          userId,
          entry,
          newRetryCount,
          'exception_exhausted',
          lastError
        );
        result.blocked++;
        console.warn(
          `Blocking failed sync entry after ${newRetryCount} retries: ${entry.entityType}/${entry.entityId}`
        );
      } else {
        await updateRetryMetadata(userId, entry, newRetryCount, lastError);
        result.failed++;
      }
    } catch (dbError) {
      console.error('Failed to update retry count:', dbError);
      result.failed++;
    }
  }

  return result;
}

/**
 * Process the entire sync queue
 * Called when coming back online or periodically
 */
export async function processQueue(userId: string): Promise<SyncResult> {
  // Wait if sync is paused (E2EE migration, key rotation)
  await waitForUnpause();

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
  const result = createEmptySyncResult();

  // Check if online (uses Capacitor Network on native for reliable detection)
  if (!(await isOnline())) {
    return result;
  }

  // Cleanup stale sync entries to prevent permanent "pending" state
  // Only removes non-create operations (creates could lose user data if removed)
  // Entries older than 24 hours with 3+ retries are considered abandoned.
  // Mobile devices can legitimately sleep through long offline windows.
  try {
    const db = getOfflineDb(userId);
    const staleCutoff = Date.now() - STALE_SYNC_ENTRY_MAX_AGE_MS;
    const staleEntries = await db.syncQueue
      .where('createdAt')
      .below(staleCutoff)
      .filter(
        (entry) =>
          (entry.status ?? 'pending') === 'pending' &&
          entry.retryCount >= STALE_SYNC_ENTRY_MIN_RETRIES &&
          entry.operation !== 'create'
      )
      .toArray();

    if (staleEntries.length > 0) {
      console.warn(
        `Blocking ${staleEntries.length} stale sync entries (age > 24hr, retries >= 3)`
      );
      for (const entry of staleEntries) {
        await blockQueueEntry(
          userId,
          entry,
          entry.retryCount,
          'stale_cleanup',
          'Change has been pending for over 24 hours and now needs manual retry.'
        );
        result.blocked++;
        result.errors.push(
          new Error(`Blocked stale sync entry for ${entry.entityType}/${entry.entityId}`)
        );
      }
      addReliabilityBreadcrumb({
        category: 'sync',
        message: 'Stale sync entries blocked',
        level: 'warning',
        data: { count: staleEntries.length },
      });
    }
  } catch (cleanupError) {
    // Non-fatal: if cleanup fails, continue with normal sync
    console.warn('Stale entry cleanup failed:', cleanupError);
  }

  const queue = await getPendingSyncQueue(userId);

  for (const batch of buildQueueBatches(queue)) {
    const batchResults = await processBatchWithLimit(userId, batch);

    for (const batchResult of batchResults) {
      mergeSyncResult(result, batchResult);
    }
  }

  console.log(
    `Sync complete: ${result.processed} processed, ${result.failed} failed, ${result.blocked} blocked, ${result.conflicts} conflicts`
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
  // Wait if sync is paused (E2EE migration, key rotation)
  await waitForUnpause();

  const db = getOfflineDb(userId);
  const errors: PullError[] = [];
  let pulledNotes = 0;
  let pulledTags = 0;
  let deletedNotes = 0;
  let deletedTags = 0;

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
    if (!isEncryptedServerNote(serverNote)) {
      errors.push({ entity: 'notes', operation: 'data', error: createPlaintextServerNoteError(serverNote.id) });
      continue;
    }

    const localNote = await db.notes.get(serverNote.id);

    // Skip if local has pending or conflict changes
    if (localNote && (localNote.syncStatus === 'pending' || localNote.syncStatus === 'conflict')) {
      continue;
    }

    // Use server timestamp for lastSyncedAt (not Date.now())
    const serverTime = new Date(serverNote.updated_at).getTime();
    const displayTime = new Date(getDisplayUpdatedAt(serverNote)).getTime();
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
      updatedAt: displayTime,
      syncStatus: 'synced',
      lastSyncedAt: serverTime,
      serverUpdatedAt: serverTime,
      localUpdatedAt: serverTime,
      encryptedPayload: serverNote.encrypted_payload ?? null,
      encryptionIv: serverNote.encryption_iv ?? null,
      encryptionVersion: serverNote.encryption_version ?? null,
      contentHash: serverNote.content_hash ?? null,
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
        deletedNotes++;
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
  let tagResult = lastTagSync > 0
    ? await fetchAllPaginated(() =>
        supabase.from('tags').select('*').gt('updated_at', new Date(lastTagSync).toISOString())
      )
    : await fetchAllPaginated(() => supabase.from('tags').select('*'));

  // Fall back to full pull if updated_at column doesn't exist (42703 error)
  const errCode = (tagResult.error as Error & { code?: string })?.code;
  if (tagResult.error && (errCode === '42703' || tagResult.error.message.includes('updated_at'))) {
    tagResult = await fetchAllPaginated(() => supabase.from('tags').select('*'));
  }

  const tagPullData = tagResult.data;
  const tagPullError = tagResult.error;

  if (tagPullError) {
    console.error('Error pulling remote tags:', tagPullError);
    errors.push({ entity: 'tags', operation: 'data', error: tagPullError });
  }

  // Process fetched tags — only count actually-changed tags
  for (const serverTag of tagPullData || []) {
    const localTag = localTags.find(t => t.id === serverTag.id);

    // Skip if local has pending changes
    if (localTag?.syncStatus === 'pending') continue;

    // Use updated_at for cursor when available, fall back to created_at.
    // This keeps the cursor in the same time domain as the incremental query.
    const tagRecord = serverTag as Record<string, unknown>;
    const serverTimestamp = tagRecord.updated_at
      ? new Date(tagRecord.updated_at as string).getTime()
      : new Date(serverTag.created_at).getTime();

    // Only count as "pulled" if data actually differs
    const hasChanges = !localTag || localTag.name !== serverTag.name || localTag.color !== serverTag.color;

    if (!hasChanges) {
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
        deletedTags++;
      }
    }
  }

  return { pulledNotes, pulledTags, deletedNotes, deletedTags, errors };
}

/**
 * Full sync: pull remote changes then push local queue.
 * Returns FullSyncResult with both pull and push outcomes.
 */
export async function fullSync(userId: string): Promise<FullSyncResult> {
  // Wait if sync is paused (E2EE migration, key rotation)
  await waitForUnpause();

  // Pull first to get latest server state
  const pullResult = await pullRemoteChanges(userId);

  // Then process our queue
  const pushResult = await processQueue(userId);

  return {
    ...pushResult,
    pulled: { notes: pullResult.pulledNotes, tags: pullResult.pulledTags },
    deleted: { notes: pullResult.deletedNotes, tags: pullResult.deletedTags },
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
