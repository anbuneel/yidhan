/**
 * Demo Migration Service
 *
 * Handles migrating demo notes and tags to an authenticated user's account.
 * Separated from demoStorage.ts since it touches offline DB operations.
 */

import type { Note, Tag } from '../types';
import {
  getDemoDataForMigration,
  clearDemoState,
  hasDemoState,
} from './demoStorage';
import { fetchTagsOffline } from './offlineTags';
import { createTagOffline } from './offlineTags';
import { createNoteOffline, addTagToNoteOffline } from './offlineNotes';
import { sanitizeHtml } from '../utils/sanitize';

// ============================================================================
// Types
// ============================================================================

export interface MigrationResult {
  /** Notes that were created (with tags populated) */
  migratedNotes: Note[];
  /** Tags that were newly created (not existing ones) */
  newTags: Tag[];
  /** Count of notes migrated */
  noteCount: number;
}

// ============================================================================
// Migration Function
// ============================================================================

/**
 * Migrate demo notes and tags to authenticated user's account.
 *
 * This function:
 * 1. Fetches existing tags from IndexedDB (avoids race condition with state)
 * 2. Creates new tags or maps demo tags to existing ones
 * 3. Creates notes with proper tag relationships
 * 4. Clears demo state after successful migration
 *
 * @param userId - The authenticated user's ID
 * @returns Migration result with notes and tags for UI state updates
 * @throws Error if migration fails (demo state is NOT cleared on error)
 */
export async function migrateDemoToAccount(
  userId: string
): Promise<MigrationResult> {
  // Get demo data (includes edited welcome note if applicable)
  const { notes: demoNotes, tags: demoTags } = getDemoDataForMigration();

  if (demoNotes.length === 0) {
    clearDemoState();
    return { migratedNotes: [], newTags: [], noteCount: 0 };
  }

  // Fetch existing tags from IndexedDB to avoid race condition with tags state
  // (tags state might still be empty when migration runs post-hydration)
  const existingTags = await fetchTagsOffline(userId);

  // Build tag ID mapping (demo localId -> server id) and track new tags
  const tagIdMap = new Map<string, string>();
  const tagObjectMap = new Map<string, Tag>();
  const newTags: Tag[] = [];

  for (const demoTag of demoTags) {
    const existingTag = existingTags.find(
      (t) => t.name.toLowerCase() === demoTag.name.toLowerCase()
    );
    if (existingTag) {
      tagIdMap.set(demoTag.localId, existingTag.id);
      tagObjectMap.set(existingTag.id, existingTag);
    } else {
      const newTag = await createTagOffline(userId, demoTag.name, demoTag.color);
      tagIdMap.set(demoTag.localId, newTag.id);
      tagObjectMap.set(newTag.id, newTag);
      newTags.push(newTag);
    }
  }

  // Create notes with populated tag objects
  const migratedNotes: Note[] = [];

  for (const demoNote of demoNotes) {
    const newNote = await createNoteOffline(
      userId,
      demoNote.title,
      sanitizeHtml(demoNote.content)
    );

    // Collect tag objects for this note
    const noteTags: Tag[] = [];

    // Add tags to note
    for (const localTagId of demoNote.tagIds) {
      const newTagId = tagIdMap.get(localTagId);
      if (newTagId) {
        await addTagToNoteOffline(userId, newNote.id, newTagId);
        const tagObj = tagObjectMap.get(newTagId);
        if (tagObj) noteTags.push(tagObj);
      }
    }

    // Add note with populated tags array
    migratedNotes.push({ ...newNote, tags: noteTags });
  }

  // Clear demo state after successful migration
  clearDemoState();

  return {
    migratedNotes,
    newTags,
    noteCount: demoNotes.length,
  };
}

/**
 * Check if there's demo data to migrate
 */
export { hasDemoState };
