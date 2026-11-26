import { test, expect } from '@playwright/test';

/**
 * The landing shell: a static copy of the first screen inside `index.html`, painted
 * before the bundle arrives and replaced by React on mount. `public/boot.js` sets the
 * theme first and hides the shell off the home path or when a session exists.
 */
test.describe('Landing shell', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the offer is readable before the app loads', async ({ page }) => {
      await page.goto('/');

      await expect(
        page.getByRole('heading', { name: /a calm, private place to write/i })
      ).toBeVisible();
      await expect(page.getByText(/notes are encrypted on your device before they sync/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /^free and open source$/i })).toHaveAttribute(
        'href',
        'https://github.com/anbuneel/yidhan/blob/main/LICENSE'
      );
      await expect(page.getByRole('link', { name: /^try writing$/i })).toHaveAttribute(
        'href',
        '/demo/new'
      );
    });
  });

  test('the app replaces the shell rather than stacking on it', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: /^try writing$/i }).first()).toBeVisible();
    await expect(page.locator('.boot-landing')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('the theme is set before the app runs, from the stored choice', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('yidhan-theme', 'light');
    });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('a public page never shows the landing shell', async ({ page }) => {
    // Paused before the bundle can run: only boot.js has had its say.
    await page.route('**/src/main.tsx', (route) => route.abort());
    await page.goto('/privacy', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveClass(/boot-hidden/);
    await expect(page.locator('.boot-landing')).toBeHidden();
  });

  test('a signed-in visitor never sees the landing shell', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-test-auth-token', '{}');
    });
    await page.route('**/src/main.tsx', (route) => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveClass(/boot-hidden/);
    await expect(page.locator('.boot-landing')).toBeHidden();
  });

  test('the editor sheet top edge is inside the first screen on laptop (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('.landing-sheet')).toBeVisible();

    const box = await page.locator('.landing-sheet').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(0);
    // Old hero pushed the sheet to ~y=719; keep a tight bound so regressions fail here.
    expect(box!.y).toBeLessThan(550);
  });

  test('the editor sheet top edge is inside the first screen on phone (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.landing-sheet')).toBeVisible();

    const box = await page.locator('.landing-sheet').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(0);
    // Old hero pushed the sheet to ~y=715; keep a tight bound so regressions fail here.
    expect(box!.y).toBeLessThan(550);
  });

  test('hard-loading /demo/n/<id> opens that starter note directly in the practice space', async ({ page }) => {
    await page.goto('/demo/n/starter-revision');
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByLabel('Note title')).toHaveValue('Revision notes');
    await expect(page).toHaveURL(/\/demo$/);
  });

  test('each sample link opens its own note and does not duplicate an edited starter', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /open “why i still buy used books”/i }).click();
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByLabel('Note title')).toHaveValue('Why I still buy used books');
    await expect(page).toHaveURL(/\/demo$/);

    // Edit that starter, return home, and open the same sample link again.
    await page.getByLabel('Note title').fill('Edited used books note');
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem('yidhan-demo-state');
          const state = JSON.parse(raw ?? '{"notes":[]}') as {
            notes: { localId: string; title: string }[];
          };
          return state.notes.find((n) => n.localId === 'starter-used-books')?.title;
        })
      )
      .toBe('Edited used books note');

    await page.goto('/');
    await page.getByRole('link', { name: /open “why i still buy used books”/i }).click();
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByLabel('Note title')).toHaveValue('Edited used books note');

    const copies = await page.evaluate(() => {
      const raw = window.localStorage.getItem('yidhan-demo-state');
      const state = JSON.parse(raw ?? '{"notes":[]}') as {
        notes: { localId: string }[];
      };
      return state.notes.filter((n) => n.localId === 'starter-used-books').length;
    });
    expect(copies).toBe(1);
  });

  test('the landing page FAQ answers browsers/installing, free/funding, importing, and recovery', async ({ page }) => {
    await page.goto('/');
    const faq = page.getByRole('heading', { name: /common questions/i }).locator('..');
    await expect(faq).toBeVisible();
    await expect(faq).toContainText(/which browsers work, and can i install it\?/i);
    await expect(faq).toContainText(/what is free, and how is it paid for\?/i);
    await expect(faq).toContainText(/can i import or export my notes\?/i);
    await expect(faq).toContainText(/what if i forget my passphrase\?/i);
  });
});
