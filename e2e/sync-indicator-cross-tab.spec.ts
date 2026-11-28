import { test, expect } from './fixtures';

/**
 * The sync indicator follows the offline queue through a Dexie liveQuery, so a change
 * another tab makes to the queue shows here without a poll. The second tab writes
 * through its own Dexie connection, as a real second tab of the app does; Dexie carries
 * the change between tabs over a BroadcastChannel. Only this browser's local
 * IndexedDB is touched.
 */
test.describe('Sync indicator across tabs', () => {
  test('shows and clears a blocked entry written by another tab', async ({ authenticatedPage: page }) => {
    const other = await page.context().newPage();
    await other.goto('/');

    const dbName = await other.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.map((d) => d.name).find((n) => n?.startsWith('yidhan-offline-')) ?? null;
    });
    expect(dbName, 'offline database for the signed-in user').not.toBeNull();

    const writeFromOtherTab = (op: 'add' | 'remove') =>
      other.evaluate(
        async ({ name, op }) => {
          // Served by the Vite dev server: a Dexie instance of the other tab's own.
          const { default: Dexie } = await import('/node_modules/dexie/dist/dexie.mjs');
          const db = new Dexie(name);
          await db.open();
          const queue = db.table('syncQueue');
          if (op === 'add') {
            await queue.add({
              operation: 'update',
              entityType: 'note',
              entityId: 'cross-tab-probe',
              payload: {},
              status: 'blocked',
              retryCount: 3,
              createdAt: Date.now(),
              blockedAt: Date.now(),
              lastError: 'cross-tab probe',
              clientMutationId: 'cross-tab-probe',
            });
          } else {
            await queue.where('entityId').equals('cross-tab-probe').delete();
          }
          db.close();
        },
        { name: dbName!, op }
      );

    await writeFromOtherTab('add');
    await expect(page.getByLabel(/1 change blocked/i).first()).toBeVisible({ timeout: 5000 });

    await writeFromOtherTab('remove');
    await expect(page.getByLabel(/change blocked/i)).toHaveCount(0, { timeout: 5000 });

    await other.close();
  });
});
