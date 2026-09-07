import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { getOfflineDb, type LocalNote } from '../lib/offlineDb';
import { reconcileNoteTags, subscribeToNoteTags } from './noteTagSync';

const transport = vi.hoisted(() => ({ rows: [] as { note_id: string; tag_id: string }[], handlers: [] as ((event: unknown) => void)[], fail: false }));
vi.mock('../lib/supabase', () => ({ supabase: {
  from: () => {
    let id: string | undefined;
    const q = { select: () => q, order: () => q, eq: (_: string, value: string) => { id = value; return q; },
      range: (from: number, to: number) => Promise.resolve({ data: transport.rows.filter(row => !id || row.note_id === id).slice(from, to + 1), error: transport.fail ? new Error('Disconnected') : null }) };
    return q;
  },
  channel: () => {
    const c = { on: (_event: string, _filter: unknown, handler: (event: unknown) => void) => { transport.handlers.push(handler); return c; }, subscribe: (ready: (status: string) => void) => { ready('SUBSCRIBED'); return c; } };
    return c;
  }, removeChannel: vi.fn(),
} }));
vi.mock('../lib/offlineDb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/offlineDb')>();
  // Each simulated browser owns its own database connection.
  const stores = new Map<string, InstanceType<typeof actual.YidhanDB>>();
  return { ...actual, getOfflineDb: (id: string) => {
    if (!stores.has(id)) stores.set(id, new actual.YidhanDB(id));
    return stores.get(id)!;
  } };
});
const clients = ['tag-client-a', 'tag-client-b'];
afterEach(async () => {
  for (const id of clients) { const db = getOfflineDb(id); await db.notes.clear(); await db.noteTags.clear(); await db.syncQueue.clear(); }
  transport.rows = []; transport.handlers = []; transport.fail = false;
});
async function seed() {
  for (const id of clients) await getOfflineDb(id).notes.put({ id: 'shared-note', userId: id } as LocalNote);
}
it('makes an added tag visible in two isolated client stores without changing the note or signing in again', async () => {
  await seed();
  const changedA = vi.fn(), changedB = vi.fn();
  const ready = vi.fn();
  const stopA = subscribeToNoteTags(clients[0], changedA, ready), stopB = subscribeToNoteTags(clients[1], changedB, ready);
  expect(ready).toHaveBeenCalledTimes(2);
  expect(changedA).not.toHaveBeenCalled();
  const start = Date.now();
  transport.rows.push({ note_id: 'shared-note', tag_id: 'journal' });
  for (const handler of transport.handlers) handler({ new: transport.rows[0], old: {} });
  await waitFor(() => { expect(changedA).toHaveBeenCalled(); expect(changedB).toHaveBeenCalled(); }, { timeout: 5000 });
  for (const id of clients) expect(await getOfflineDb(id).noteTags.get(['shared-note', 'journal'])).toBeDefined();
  expect(Date.now() - start).toBeLessThan(5000);
  expect(ready).toHaveBeenCalledTimes(2); // Targeted events do not trigger another full catch-up.
  stopA(); stopB();
});
it('retains local queued removals and never deletes links from a failed listing', async () => {
  await seed();
  const db = getOfflineDb(clients[0]);
  await db.noteTags.put({ noteId: 'shared-note', tagId: 'old', syncStatus: 'synced', lastSyncedAt: 1 });
  transport.fail = true;
  await expect(reconcileNoteTags(clients[0])).rejects.toThrow();
  expect(await db.noteTags.count()).toBe(1);
  transport.fail = false;
  await db.syncQueue.add({ clientMutationId: 'remove', operation: 'remove_tag', entityType: 'noteTag', entityId: 'shared-note:journal', payload: {}, createdAt: 1, retryCount: 0 });
  transport.rows = [{ note_id: 'shared-note', tag_id: 'journal' }];
  await reconcileNoteTags(clients[0]);
  expect(await db.noteTags.count()).toBe(0);
});
