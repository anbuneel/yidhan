import Dexie, { type Table } from 'dexie';

// Sync status for local entities
export type SyncStatus = 'synced' | 'pending' | 'conflict';

// Sync operation types
export type SyncOperation =
  | 'create'
  | 'update'
  | 'delete'
  | 'soft_delete'
  | 'restore'
  | 'pin'
  | 'add_tag'
  | 'remove_tag';

// Entity types for sync queue
export type EntityType = 'note' | 'tag' | 'noteTag';

// Local note with sync tracking fields
export interface LocalNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  pinned: boolean;
  deletedAt: number | null; // Timestamp for soft-delete
  createdAt: number;
  updatedAt: number;
  // Sync tracking
  syncStatus: SyncStatus;
  lastSyncedAt: number | null; // Last successful sync timestamp
  serverUpdatedAt: number | null; // Server's updated_at from last sync
  localUpdatedAt: number; // Local modification timestamp
  // E2EE fields (null for unencrypted/legacy notes)
  encryptedPayload: string | null;
  encryptionIv: string | null;
  encryptionVersion: number | null;
  contentHash: string | null;
}

// Local tag with sync tracking
export interface LocalTag {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: number;
  // Sync tracking
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  serverUpdatedAt: number | null;
  localUpdatedAt: number;
}

// Junction table for note-tag relationships
export interface LocalNoteTag {
  noteId: string;
  tagId: string;
  // Sync tracking
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
}

// Sync queue entry for pending operations
export interface SyncQueueEntry {
  id?: number; // Auto-increment
  clientMutationId: string; // UUID for idempotency
  operation: SyncOperation;
  entityType: EntityType;
  entityId: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
}

// Conflict record for unresolved conflicts
export interface ConflictRecord {
  id?: number;
  entityType: EntityType;
  entityId: string;
  localVersion: unknown;
  serverVersion: unknown;
  detectedAt: number;
}

// Sentinel value for lastSyncedAt after migration: forces full re-pull
// while keeping conflict detection active (truthy, so the `lastSyncedAt`
// guard in processNoteOperation still fires).
export const MIGRATION_SYNC_SENTINEL = 1;

// Yidhan offline database
class YidhanDB extends Dexie {
  notes!: Table<LocalNote, string>;
  tags!: Table<LocalTag, string>;
  noteTags!: Table<LocalNoteTag, [string, string]>;
  syncQueue!: Table<SyncQueueEntry, number>;
  conflicts!: Table<ConflictRecord, number>;

  constructor(userId: string) {
    // Per-user database naming for isolation
    super(`yidhan-offline-${userId}`);

    this.version(1).stores({
      // Notes indexed by id, userId, and sync status
      notes: 'id, userId, syncStatus, deletedAt, pinned, updatedAt',
      // Tags indexed by id and name (for duplicate checking)
      tags: 'id, name, syncStatus',
      // Note-tags compound key
      noteTags: '[noteId+tagId], noteId, tagId, syncStatus',
      // Sync queue with auto-increment id
      syncQueue: '++id, entityType, entityId, createdAt',
      // Conflicts with auto-increment id
      conflicts: '++id, entityType, entityId, detectedAt',
    });

    this.version(2).stores({
      notes: 'id, userId, syncStatus, deletedAt, pinned, updatedAt',
      tags: 'id, name, syncStatus',
      noteTags: '[noteId+tagId], noteId, tagId, syncStatus',
      syncQueue: '++id, clientMutationId, entityType, entityId, createdAt',
      conflicts: '++id, entityType, entityId, detectedAt',
    });

    // v3: One-time sync cursor migration (Phase 3C)
    // Reset lastSyncedAt to force full re-pull with server timestamps.
    // Uses 1 (not 0) so conflict detection remains active — the truthy check
    // at processNoteOperation guards against silent overwrites on first edit.
    // Pending/conflict entries keep their cursors for safe conflict detection.
    this.version(3).stores({
      notes: 'id, userId, syncStatus, deletedAt, pinned, updatedAt',
      tags: 'id, name, syncStatus',
      noteTags: '[noteId+tagId], noteId, tagId, syncStatus',
      syncQueue: '++id, clientMutationId, entityType, entityId, createdAt',
      conflicts: '++id, entityType, entityId, detectedAt',
    }).upgrade(async (tx) => {
      await tx.table('notes')
        .where('syncStatus').equals('synced')
        .modify({ lastSyncedAt: MIGRATION_SYNC_SENTINEL });
      await tx.table('tags')
        .where('syncStatus').equals('synced')
        .modify({ lastSyncedAt: MIGRATION_SYNC_SENTINEL });
    });

    // v4: E2EE encryption fields on notes
    // Additive change — new fields default to null for existing notes.
    // Same indexes (encryption fields don't need indexing).
    this.version(4).stores({
      notes: 'id, userId, syncStatus, deletedAt, pinned, updatedAt',
      tags: 'id, name, syncStatus',
      noteTags: '[noteId+tagId], noteId, tagId, syncStatus',
      syncQueue: '++id, clientMutationId, entityType, entityId, createdAt',
      conflicts: '++id, entityType, entityId, detectedAt',
    }).upgrade(async (tx) => {
      // Set encryption fields to null for all existing notes
      await tx.table('notes').toCollection().modify({
        encryptedPayload: null,
        encryptionIv: null,
        encryptionVersion: null,
        contentHash: null,
      });
    });
  }
}

// Database instance cache (one per user)
let dbInstance: YidhanDB | null = null;
let currentUserId: string | null = null;

/**
 * Get or create the offline database for a user
 */
export function getOfflineDb(userId: string): YidhanDB {
  if (dbInstance && currentUserId === userId) {
    return dbInstance;
  }

  // Close existing database if switching users
  if (dbInstance && currentUserId !== userId) {
    dbInstance.close();
  }

  dbInstance = new YidhanDB(userId);
  currentUserId = userId;
  return dbInstance;
}

/**
 * Close and delete the database (for logout)
 */
export async function clearOfflineDb(): Promise<void> {
  if (dbInstance) {
    const dbName = dbInstance.name;
    dbInstance.close();
    await Dexie.delete(dbName);
    dbInstance = null;
    currentUserId = null;
  }
}

/**
 * Check if offline database exists for a user
 * Includes timeout protection for Android WebView where indexedDB.databases() can hang
 */
export async function hasOfflineDb(userId: string): Promise<boolean> {
  const dbName = `yidhan-offline-${userId}`;
  const TIMEOUT_MS = 3000; // 3 second timeout

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getDatabaseNames timeout')), TIMEOUT_MS)
    );

    const databases = await Promise.race([
      Dexie.getDatabaseNames(),
      timeoutPromise
    ]);

    return databases.includes(dbName);
  } catch (error) {
    // If getDatabaseNames hangs or fails, assume DB doesn't exist
    // This is safe because needsHydration will return true, triggering a fresh hydration
    console.warn('hasOfflineDb check failed, assuming DB does not exist:', error);
    return false;
  }
}

/**
 * Generate a client mutation ID for sync operations
 */
export function generateMutationId(): string {
  return crypto.randomUUID();
}

export { YidhanDB };
