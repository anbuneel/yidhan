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
        page.getByRole('heading', { name: /a quiet home for your personal notes/i })
      ).toBeVisible();
      await expect(page.getByText(/not even us/i)).toBeVisible();
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
});
