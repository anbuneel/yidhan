import { test, expect } from './fixtures';
import { createNote } from './fixtures';

/**
 * One undecryptable note — item 41.
 *
 * Needs the authenticated fixture, so it skips until item 37 configures E2E
 * credentials in CI. The decrypt, export and card behaviour it drives are covered
 * without a browser in `src/services/encryptedNotes.test.ts`,
 * `src/utils/exportImport.test.ts` and `src/components/LockedNoteCard.test.tsx`.
 */

/** Corrupt exactly one note's ciphertext in IndexedDB, leaving every other row alone. */
async function corruptOneNote(page: import('@playwright/test').Page, title: string) {
  return page.evaluate(async (noteTitle: string) => {
    const dbs = await indexedDB.databases();
    const name = dbs.map((d) => d.name).find((n) => n?.startsWith('yidhan-offline-'));
    if (!name) throw new Error('offline database not found');

    return new Promise<string>((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('notes', 'readwrite');
        const store = tx.objectStore('notes');
        const all = store.getAll();
        all.onsuccess = () => {
          // The title column is empty on an encrypted row, so the note is found by
          // the id the caller captured from its URL instead.
          const target = all.result.find((row: { id: string }) => row.id === noteTitle);
          if (!target) {
            reject(new Error('note not found in the offline database'));
            return;
          }
          target.encryptedPayload = 'not-valid-ciphertext';
          store.put(target);
          tx.oncomplete = () => {
            db.close();
            resolve(target.id);
          };
          tx.onerror = () => reject(tx.error);
        };
        all.onerror = () => reject(all.error);
      };
    });
  }, title);
}

test.describe('A note that cannot be opened', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('leaves every other note readable', async ({ authenticatedPage: page }) => {
    const keeper = `Keeper ${Date.now()}`;
    const victim = `Victim ${Date.now()}`;

    await createNote(page, keeper);
    await page.goto('/');
    await createNote(page, victim);
    const victimId = page.url().split('/n/')[1];

    await page.goto('/');
    await corruptOneNote(page, victimId);
    await page.reload();

    // The library is still a library, not an empty page behind a toast.
    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect(page.locator('article').filter({ hasText: keeper })).toBeVisible();
    await expect(page.getByTestId('locked-note-card')).toHaveCount(1);
    await expect(page.getByText(/this note could not be opened/i)).toBeVisible();
  });

  test('the export says one note could not be included', async ({
    authenticatedPage: page,
  }) => {
    const victim = `Victim ${Date.now()}`;
    await createNote(page, victim);
    const victimId = page.url().split('/n/')[1];

    await page.goto('/');
    await corruptOneNote(page, victimId);
    await page.reload();
    await expect(page.getByTestId('locked-note-card')).toHaveCount(1);

    const download = page.waitForEvent('download');
    await page.getByTestId('avatar-button').click();
    await page.getByRole('menuitem', { name: /export.*json/i }).click();
    await download;

    await expect(page.getByText(/1 note could not be included/i)).toBeVisible();
  });

  test('opening a locked note returns to the library instead of a blank editor', async ({
    authenticatedPage: page,
  }) => {
    const victim = `Victim ${Date.now()}`;
    await createNote(page, victim);
    const victimUrl = page.url();
    const victimId = victimUrl.split('/n/')[1];

    await page.goto('/');
    await corruptOneNote(page, victimId);
    await page.goto(victimUrl);

    // An empty editor here would autosave over ciphertext another device can open.
    await expect(page.getByTestId('note-editor')).toBeHidden();
    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect(page.getByText(/could not be opened/i).first()).toBeVisible();
  });
});
