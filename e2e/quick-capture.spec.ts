import type { Page } from '@playwright/test';
import { test, expect, TEST_USER } from './fixtures';

/**
 * Quick capture, item 44: `/n/new` (the PWA "New note" shortcut) and Ctrl+Alt+N.
 *
 * The test account is shared with other specs running at the same time, and their
 * notes reach this page through realtime. So a create is counted by the note rows
 * this page itself sends to the server, not by the library or IndexedDB.
 */

const NOTE_URL = /\/n\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The ids of note rows this page inserts on the server. */
function watchNoteInserts(page: Page): Set<string> {
  const ids = new Set<string>();
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !/\/rest\/v1\/notes(\?|$)/.test(request.url())) return;
    const body: unknown = request.postDataJSON();
    for (const row of Array.isArray(body) ? body : [body]) {
      const id = (row as { id?: unknown } | null)?.id;
      if (typeof id === 'string') ids.add(id);
    }
  });
  return ids;
}

/** The note's id, from the address the editor replaced `/n/new` with. */
function noteIdFrom(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

/** Wait for this page's creates to reach the server, then give a stray second one time to show. */
async function expectOneInsert(page: Page, ids: Set<string>, noteId: string) {
  await expect.poll(() => [...ids], { timeout: 20000 }).toContain(noteId);
  await page.waitForTimeout(1500);
  expect([...ids]).toEqual([noteId]);
}

test.describe('Quick capture (item 44)', () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 800 } });

  test('/n/new creates one note, opens it with the cursor in it, and replaces itself', async ({ authenticatedPage: page }) => {
    const inserts = watchNoteInserts(page);

    await page.goto('/n/new');

    await expect(page).toHaveURL(NOTE_URL, { timeout: 15000 });
    const noteUrl = page.url();
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByPlaceholder(/untitled/i)).toBeFocused();

    // A reload opens the same note, and Back does not return to /n/new.
    await page.reload();
    await expect(page.getByTestId('note-editor')).toBeVisible({ timeout: 15000 });
    expect(page.url()).toBe(noteUrl);
    await page.goBack();
    await expect(page.getByTestId('library-view')).toBeVisible();
    expect(page.url()).not.toMatch(/\/n\/new$/);

    await expectOneInsert(page, inserts, noteIdFrom(noteUrl));
  });

  test('a locked vault unlocks first, then /n/new creates', async ({ authenticatedPage: page }) => {
    // Drop this tab's copy of the key. The session stays, so the vault gate shows.
    await page.evaluate(() => sessionStorage.clear());
    const inserts = watchNoteInserts(page);

    await page.goto('/n/new');
    await expect(page.getByRole('heading', { name: 'Unlock your notes', exact: true })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    expect(inserts.size).toBe(0);
    await expect(page).toHaveURL(/\/n\/new$/);

    await page.getByLabel('Passphrase', { exact: true }).fill(TEST_USER.passphrase);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    const recoveryOffer = page.getByRole('heading', { name: 'Make a recovery key', exact: true });
    const editor = page.getByTestId('note-editor');
    await expect(editor.or(recoveryOffer).first()).toBeVisible({ timeout: 30000 });
    if (await recoveryOffer.isVisible()) {
      await page.getByRole('button', { name: 'Not now', exact: true }).click();
    }

    await expect(page).toHaveURL(NOTE_URL, { timeout: 15000 });
    await expect(editor).toBeVisible();
    await expectOneInsert(page, inserts, noteIdFrom(page.url()));
  });

  test('Ctrl+Alt+N in the editor saves and opens a second note', async ({ authenticatedPage: page }) => {
    await page.goto('/n/new');
    await expect(page).toHaveURL(NOTE_URL, { timeout: 15000 });
    const firstUrl = page.url();
    const title = `Quick capture ${Date.now()}`;
    await page.getByPlaceholder(/untitled/i).fill(title);

    await page.keyboard.press('Control+Alt+n');

    await expect(page).toHaveURL(NOTE_URL);
    await expect.poll(() => page.url()).not.toBe(firstUrl);
    await expect(page.getByPlaceholder(/untitled/i)).toHaveValue('');
    await expect(page.getByPlaceholder(/untitled/i)).toBeFocused();

    // The first note kept its title.
    await page.goBack();
    await expect(page.getByPlaceholder(/untitled/i)).toHaveValue(title);
  });
});

test.describe('Quick capture, signed out', () => {
  test('/n/new asks for sign-in and creates nothing', async ({ page }) => {
    const inserts = watchNoteInserts(page);
    await page.goto('/n/new');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15000 });
    expect(inserts.size).toBe(0);
  });
});
