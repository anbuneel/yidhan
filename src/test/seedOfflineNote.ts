import { getOfflineDb } from '../lib/offlineDb';
import { queueSyncOperation } from '../services/offlineNotes';
import type { Note } from '../types';
export async function seedOfflineNote(userId: string, title = '', content = ''): Promise<Note> {
  const id = crypto.randomUUID(), now = Date.now();
  await getOfflineDb(userId).notes.add({ id, userId, title, content, pinned: false, deletedAt: null,
    createdAt: now, updatedAt: now, localUpdatedAt: now, syncStatus: 'pending', lastSyncedAt: null, serverUpdatedAt: null });
  await queueSyncOperation(userId, 'create', 'note', id, { title, content, pinned: false });
  return { id, title, content, pinned: false, tags: [], deletedAt: null, createdAt: new Date(now), updatedAt: new Date(now), syncStatus: 'pending' };
}
