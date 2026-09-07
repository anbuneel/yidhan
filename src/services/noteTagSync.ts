import { supabase } from '../lib/supabase';
import { getOfflineDb } from '../lib/offlineDb';

// Junction rows have no clock column. Realtime pulls only the affected note;
// a complete, ordered membership scan repairs events missed while disconnected.
export async function reconcileNoteTags(userId: string, noteId?: string): Promise<number> {
  const rows: { note_id: string; tag_id: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from('note_tags').select('note_id, tag_id').order('note_id').order('tag_id');
    if (noteId) query = query.eq('note_id', noteId);
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw error; // Never infer removals from a partial listing.
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const db = getOfflineDb(userId);
  let changed = 0;
  await db.transaction('rw', db.notes, db.noteTags, db.syncQueue, async () => {
    const queued = await db.syncQueue.where('entityType').equals('noteTag').toArray();
    const protectedLinks = new Set(queued.map(entry => entry.entityId));
    const local = noteId ? await db.noteTags.where('noteId').equals(noteId).toArray() : await db.noteTags.toArray();
    for (const link of local) if (link.syncStatus !== 'synced') protectedLinks.add(`${link.noteId}:${link.tagId}`);
    const localMembership = new Set(local.map(link => `${link.noteId}:${link.tagId}`));
    const membership = new Set(rows.map(row => `${row.note_id}:${row.tag_id}`));
    const knownNotes = new Set((await db.notes.toArray()).map(note => note.id));
    for (const row of rows) {
      if (!knownNotes.has(row.note_id) || protectedLinks.has(`${row.note_id}:${row.tag_id}`)) continue;
      if (!localMembership.has(`${row.note_id}:${row.tag_id}`)) changed++;
      await db.noteTags.put({ noteId: row.note_id, tagId: row.tag_id, syncStatus: 'synced', lastSyncedAt: Date.now() });
    }
    for (const link of local) {
      const id = `${link.noteId}:${link.tagId}`;
      if (!protectedLinks.has(id) && !membership.has(id)) { await db.noteTags.delete([link.noteId, link.tagId]); changed++; }
    }
  });
  return changed;
}

export function subscribeToNoteTags(userId: string, onChange: () => void): () => void {
  let stopped = false;
  let work = Promise.resolve();
  const channel = supabase.channel(`note-tags-${userId}`).on('postgres_changes', {
    event: '*', schema: 'public', table: 'note_tags',
  }, payload => {
    const noteId = ('note_id' in payload.new ? payload.new.note_id : undefined) ??
      ('note_id' in payload.old ? payload.old.note_id : undefined);
    if (typeof noteId !== 'string') return;
    work = work.then(async () => {
      if (stopped || !await getOfflineDb(userId).notes.get(noteId)) return;
      await reconcileNoteTags(userId, noteId);
      if (!stopped) onChange();
    }).catch(error => { if (!stopped) console.warn('Tag links could not be refreshed', error); });
  }).subscribe(status => { if (!stopped && status === 'SUBSCRIBED') onChange(); });
  return () => { stopped = true; void supabase.removeChannel(channel); };
}
