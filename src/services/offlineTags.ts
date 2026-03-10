/**
 * Offline Tags Service
 *
 * Provides offline-first tag operations using IndexedDB (Dexie.js).
 * All writes go to IndexedDB first (optimistic), then queue for sync.
 */

import {
  getOfflineDb,
  type LocalTag,
} from '../lib/offlineDb';
import type { Tag, TagColor } from '../types';
import { queueSyncOperation } from './offlineNotes';

// Convert LocalTag to App Tag
function localTagToTag(localTag: LocalTag): Tag {
  return {
    id: localTag.id,
    name: localTag.name,
    color: localTag.color as TagColor,
    createdAt: new Date(localTag.createdAt),
    updatedAt: localTag.serverUpdatedAt ? new Date(localTag.serverUpdatedAt) : undefined,
  };
}

/**
 * Fetch all tags from IndexedDB
 */
export async function fetchTagsOffline(userId: string): Promise<Tag[]> {
  const db = getOfflineDb(userId);
  const tags = await db.tags.toArray();
  return tags.map(localTagToTag).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Create a new tag offline
 */
export async function createTagOffline(
  userId: string,
  name: string,
  color: TagColor
): Promise<Tag> {
  const db = getOfflineDb(userId);
  const now = Date.now();
  const tagId = crypto.randomUUID();

  // Validate tag name
  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 20) {
    throw new Error('Tag name must be 1-20 characters');
  }

  // Check for duplicate name
  const existing = await db.tags
    .filter((t) => t.name.toLowerCase() === trimmedName.toLowerCase())
    .first();
  if (existing) {
    throw new Error('A tag with this name already exists');
  }

  const localTag: LocalTag = {
    id: tagId,
    userId,
    name: trimmedName,
    color,
    createdAt: now,
    syncStatus: 'pending',
    lastSyncedAt: null,
    serverUpdatedAt: null,
    localUpdatedAt: now,
  };

  // Write to IndexedDB
  await db.tags.add(localTag);

  // Queue for sync
  await queueSyncOperation(userId, 'create', 'tag', tagId, {
    name: trimmedName,
    color,
  });

  return localTagToTag(localTag);
}

/**
 * Update a tag offline
 */
export async function updateTagOffline(
  userId: string,
  tagId: string,
  updates: { name?: string; color?: TagColor }
): Promise<Tag> {
  const db = getOfflineDb(userId);
  const now = Date.now();

  const existing = await db.tags.get(tagId);
  if (!existing) {
    throw new Error(`Tag ${tagId} not found in offline database`);
  }

  // Validate and check duplicate name if updating
  const newName = updates.name?.trim();
  if (newName !== undefined) {
    if (newName.length < 1 || newName.length > 20) {
      throw new Error('Tag name must be 1-20 characters');
    }

    // Check for duplicate name (excluding self)
    const duplicate = await db.tags
      .filter(
        (t) =>
          t.id !== tagId && t.name.toLowerCase() === newName.toLowerCase()
      )
      .first();
    if (duplicate) {
      throw new Error('A tag with this name already exists');
    }
  }

  const updateData: Partial<LocalTag> = {
    localUpdatedAt: now,
    syncStatus: 'pending',
  };

  if (newName !== undefined) {
    updateData.name = newName;
  }
  if (updates.color !== undefined) {
    updateData.color = updates.color;
  }

  // Update IndexedDB
  await db.tags.update(tagId, updateData);

  // Get updated tag
  const updated = await db.tags.get(tagId);
  if (!updated) {
    throw new Error('Failed to update tag');
  }

  // Queue for sync
  await queueSyncOperation(userId, 'update', 'tag', tagId, {
    name: updated.name,
    color: updated.color,
  });

  return localTagToTag(updated);
}

/**
 * Delete a tag offline
 */
export async function deleteTagOffline(
  userId: string,
  tagId: string
): Promise<void> {
  const db = getOfflineDb(userId);

  // Delete from IndexedDB in a transaction
  await db.transaction('rw', [db.tags, db.noteTags, db.syncQueue], async () => {
    // Remove tag
    await db.tags.delete(tagId);

    // Remove all note-tag relationships for this tag
    await db.noteTags.where('tagId').equals(tagId).delete();

    // Remove any pending sync operations for this tag
    await db.syncQueue.where('entityId').equals(tagId).delete();
  });

  // Queue for sync (server delete)
  await queueSyncOperation(userId, 'delete', 'tag', tagId, {});
}

/**
 * Mark a tag as synced after successful server sync
 */
/**
 * Mark a tag as synced after successful server sync.
 * Uses the server's timestamp for lastSyncedAt to keep the cursor
 * in the same time domain as the incremental pull query (updated_at / created_at).
 */
export async function markTagSynced(
  userId: string,
  tagId: string,
  serverUpdatedAt: Date
): Promise<void> {
  const db = getOfflineDb(userId);
  const serverTime = serverUpdatedAt.getTime();

  await db.tags.update(tagId, {
    syncStatus: 'synced',
    lastSyncedAt: serverTime,
    serverUpdatedAt: serverTime,
  });
}

