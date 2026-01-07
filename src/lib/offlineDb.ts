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

// Zenote offline database
class ZenoteDB extends Dexie {
  notes!: Table<LocalNote, string>;
  tags!: Table<LocalTag, string>;
  noteTags!: Table<LocalNoteTag, [string, string]>;
  syncQueue!: Table<SyncQueueEntry, number>;
  conflicts!: Table<ConflictRecord, number>;

  constructor(userId: string) {
    // Per-user database naming for isolation
    super(`zenote-offline-${userId}`);

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
  }
}

// Database instance cache (one per user)
let dbInstance: ZenoteDB | null = null;
let currentUserId: string | null = null;

/**
 * Get or create the offline database for a user
 */
export function getOfflineDb(userId: string): ZenoteDB {
  if (dbInstance && currentUserId === userId) {
    return dbInstance;
  }

  // Close existing database if switching users
  if (dbInstance && currentUserId !== userId) {
    dbInstance.close();
  }

  dbInstance = new ZenoteDB(userId);
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
 */
export async function hasOfflineDb(userId: string): Promise<boolean> {
  const dbName = `zenote-offline-${userId}`;
  const databases = await Dexie.getDatabaseNames();
  return databases.includes(dbName);
}

/**
 * Generate a client mutation ID for sync operations
 */
export function generateMutationId(): string {
  return crypto.randomUUID();
}

export { ZenoteDB };
