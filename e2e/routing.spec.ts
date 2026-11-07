import { test as base, expect } from '@playwright/test';
import { test, createNote, deleteNoteFromLibrary } from './fixtures';
import { NAVIGATE_FALLBACK_DENYLIST } from '../src/pwa/navigateFallbackDenylist';

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
  /**
   * The security page says the contact address is published at
   * `/.well-known/security.txt`. For a while that was a claim without a file: the
   * SPA rewrite answered with the app and the visitor met the 404 page. The file is
   * a real static asset; this asserts it is served as one.
   */
  base('security.txt is a real file, not the app shell', async ({ page }) => {
    const response = await page.request.get('/.well-known/security.txt');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/text\/plain/);
    const body = await response.text();
    expect(body).toMatch(/^Contact: mailto:/m);
    expect(body).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m);
    expect(body).not.toContain('<html');
  });

  /**
   * Item 155. Every route used to share index.html's one title, so a tab or a search
   * result could not say which page it was. Public pages now name themselves; the
   * signed-in app keeps the default, and a note's title never reaches the tab.
   */
  for (const [path, page_] of [
    ['/security', 'Security'],
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms'],
    ['/support', 'Support'],
    ['/changelog', 'Changelog'],
    ['/roadmap', 'Roadmap'],
    ['/demo', 'Practice Space'],
    ['/definitely-not-a-route', 'Not found'],
  ] as const) {
    base(`${path} has a title that names the page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(`${page_} · Yidhan`);
    });
  }

  base('the title follows in-app navigation and returns home with it', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/^Yidhan — /);

    await page.getByRole('button', { name: /privacy/i }).first().click();
    await expect(page).toHaveTitle('Privacy · Yidhan');

    await page.goBack();
    await expect(page).toHaveTitle(/^Yidhan — /);
  });

  base('sitemap.xml is a real XML file listing the public pages', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);
    const body = await response.text();
    expect(body).toMatch(/^<\?xml /);
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(body).not.toContain('<html');
    for (const path of ['/', '/demo', '/security', '/privacy', '/terms', '/support', '/changelog', '/roadmap']) {
      expect(body).toContain(`<loc>https://yidhan.vercel.app${path}</loc>`);
    }

    const robots = await (await page.request.get('/robots.txt')).text();
    expect(robots).toMatch(/^Sitemap: https:\/\/yidhan\.vercel\.app\/sitemap\.xml$/m);
  });

  /**
   * The dev server has no service worker, so this checks the list the worker is
   * built from (`vite.config.ts` imports the same module). `npm run e2e:sw` covers
   * a real worker doing the job.
   */
  base('the service worker navigation fallback leaves sitemap.xml to the network', () => {
    const denied = (path: string) => NAVIGATE_FALLBACK_DENYLIST.some((rule) => rule.test(path));

    expect(denied('/sitemap.xml')).toBe(true);
    expect(denied('/.well-known/security.txt')).toBe(true);
    // Pages themselves must still open offline.
    for (const path of ['/', '/privacy', '/security', '/demo', '/n/abc']) {
      expect(denied(path)).toBe(false);
    }
  });

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
