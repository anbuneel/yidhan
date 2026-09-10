import { test as base, expect } from '@playwright/test';
import { test, createNote, deleteNoteFromLibrary } from './fixtures';

/**
 * Note addresses — items 28 and 29.
 *
 * These are the "done when" tests for the two items. They need the authenticated
 * fixture, so they skip until item 37 configures E2E credentials in CI; the routing
 * logic itself is covered without a browser in `src/routing/*.test.ts`.
 */
test.describe('Note addresses', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a note has its own address', async ({ authenticatedPage: page }) => {
    await createNote(page, `Addressable ${Date.now()}`);

    await expect(page).toHaveURL(/\/n\/[A-Za-z0-9_-]+$/);
  });

  test('refresh reopens the note', async ({ authenticatedPage: page }) => {
    const title = `Refresh ${Date.now()}`;
    await createNote(page, title);

    const noteUrl = page.url();
    await page.reload();

    await expect(page).toHaveURL(noteUrl);
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByPlaceholder(/untitled/i)).toHaveValue(title);
  });

  test('Back from a note returns to the library at the same scroll position', async ({
    authenticatedPage: page,
  }) => {
    const library = page.getByTestId('library-view');
    await expect(library).toBeVisible();

    // Only meaningful once the library is taller than the viewport.
    const scrollable = await library.evaluate((el) => el.scrollHeight - el.clientHeight);
    test.skip(scrollable < 200, 'library is too short to scroll — needs the #80 fixture');

    const target = Math.min(400, scrollable);
    await library.evaluate((el, offset) => {
      el.scrollTop = offset;
    }, target);
    const before = await library.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(0);

    await page.locator('article').first().click();
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page).toHaveURL(/\/n\//);

    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('library-view').evaluate((el) => el.scrollTop))
      .toBe(before);
  });

  test('the faded view has an address of its own', async ({ authenticatedPage: page }) => {
    await page.goto('/faded');

    await expect(page.getByRole('heading', { name: /faded/i })).toBeVisible();
    await expect(page).toHaveURL(/\/faded$/);
  });

  test('opening a deleted note lands on the library with a quiet notice', async ({
    authenticatedPage: page,
  }) => {
    const title = `Deleted ${Date.now()}`;
    await createNote(page, title);
    const noteUrl = page.url();

    await page.goto('/');
    await deleteNoteFromLibrary(page, title);
    // Let the undo toast expire so the delete is final.
    await expect(page.getByRole('button', { name: /^undo$/i })).toBeHidden({ timeout: 10000 });

    await page.goto(noteUrl);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect(page.getByText(/no longer here/i)).toBeVisible();
  });

});

/**
 * Addresses that resolve without an account. Unlike the specs above these run in CI
 * today, so the router itself has real-browser coverage before item 37 lands.
 */
base.describe('Addresses without an account', () => {
  base('a malformed note address is a 404, and keeps the bad URL visible', async ({ page }) => {
    await page.goto('/n/a/b');

    await expect(page.getByText(/this path leads nowhere/i)).toBeVisible();
    await expect(page).toHaveURL(/\/n\/a\/b$/);
  });

  base('an unknown address is a 404', async ({ page }) => {
    await page.goto('/definitely-not-a-route');

    await expect(page.getByText(/this path leads nowhere/i)).toBeVisible();
    await expect(page).toHaveURL(/\/definitely-not-a-route$/);
  });

  base('a trailing slash names the same place', async ({ page }) => {
    await page.goto('/privacy/');
    await expect(page.getByRole('heading', { name: /privacy/i }).first()).toBeVisible();
  });

  base('the 404 page leads home', async ({ page }) => {
    await page.goto('/nope');
    await page.getByRole('button', { name: /return home/i }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  base('public pages push history, so Back returns to where you were', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /privacy/i }).first().click();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.getByRole('button', { name: /terms/i }).first().click();
    await expect(page).toHaveURL(/\/terms$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  base('a signed-out visitor at /faded lands on the landing page, not a blank one',
    async ({ page }) => {
      await page.goto('/faded');

      await expect(page.getByRole('button', { name: /^try writing$/i }).first()).toBeVisible();
    });

  /**
   * `/security` arrived with Lane B against the pre-router App, where public pages were
   * a `ROUTEABLE_VIEWS` string list. Carrying it into the route table is the kind of
   * port that fails silently — the page still builds, the link still renders, and the
   * address simply 404s. This is the test that would have caught that.
   */
  base('the threat model has an address, reached from /privacy', async ({ page }) => {
    await page.goto('/privacy');
    await page.getByRole('button', { name: /security page/i }).click();

    await expect(page).toHaveURL(/\/security$/);
    await expect(page.getByRole('heading', { name: /^security$/i }).first()).toBeVisible();

    // And directly, because a link someone was sent has to resolve too.
    await page.goto('/security');
    await expect(page.getByText(/what is visible to us, even so/i)).toBeVisible();
  });
});
