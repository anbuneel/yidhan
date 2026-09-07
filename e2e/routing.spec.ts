import { test, expect } from './fixtures';
import { createNote, deleteNoteFromLibrary } from './fixtures';

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

  test('a malformed note address is a 404, not a blank page', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/n/a/b');

    await expect(page.getByText(/404|not found|lost/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/n\/a\/b$/);
  });
});
