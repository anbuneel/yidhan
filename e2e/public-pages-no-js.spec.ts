import { test, expect, type Page } from '@playwright/test';
import { changelog } from '../src/data/changelog';
import { roadmap } from '../src/data/roadmap';

/**
 * Item 60: the six public pages are readable with JavaScript off. Each has a static
 * document built from the page component (src/prerender/publicPageDocument.tsx), served
 * by the dev server here and written to dist/<page>.html by the build. With JavaScript
 * on, boot.js hides the static copy and the app renders the page as before.
 */

const PAGES = [
  { path: '/privacy', heading: 'Privacy', text: /how yidhan handles your data, honestly and simply/i, title: 'Privacy · Yidhan' },
  { path: '/terms', heading: 'Terms', text: /plain language, no legalese/i, title: 'Terms · Yidhan' },
  { path: '/support', heading: 'Support', text: /questions, issues, or just want to say hello/i, title: 'Support · Yidhan' },
  {
    path: '/security',
    heading: 'Security',
    text: /what is protected, what is visible, and what we have not solved yet/i,
    title: 'Security · Yidhan',
  },
  { path: '/changelog', heading: "What's New", text: /what we remember/i, title: 'Changelog · Yidhan' },
  { path: '/roadmap', heading: 'Roadmap', text: /some thoughts have settled/i, title: 'Roadmap · Yidhan' },
];

const APP_SHELL_MODULE = '**/src/shells/AppShell.tsx*';

async function expectLandingShell(page: Page) {
  await expect(page.locator('.boot-landing')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { level: 1, name: /a quiet home for your personal notes/i })
  ).toBeVisible();
  await expect(page.locator('.static-page')).toHaveCount(0);
}

test.describe('Public pages without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const { path, heading, text, title } of PAGES) {
    test(`${path} shows its own content, not the landing shell`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      await expect(page.getByText(text)).toBeVisible();
      await expect(page).toHaveTitle(title);
      await expect(page.locator('.boot-landing')).toHaveCount(0);
      await expect(page.getByText(/a quiet home for your personal notes\./i)).toHaveCount(0);
      // Controls that need JavaScript are not offered.
      await expect(page.getByTestId('theme-toggle')).toBeHidden();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeHidden();
    });
  }

  test('/changelog shows the current entries, not faded out', async ({ page }) => {
    await page.goto('/changelog');

    const [latest] = changelog;
    await expect(page.getByText(latest.version, { exact: true })).toBeVisible();
    await expect(page.getByText(latest.changes[0].text, { exact: true })).toBeVisible();
    // Items fade in from an IntersectionObserver in the app; here nothing runs it.
    await expect(page.locator('.changelog-item').first()).not.toHaveCSS('opacity', '0');
    const oldest = changelog[changelog.length - 1];
    await expect(page.getByText(oldest.version, { exact: true })).toHaveCount(1);
  });

  test('/roadmap shows the current roadmap, not faded out', async ({ page }) => {
    await page.goto('/roadmap');

    for (const item of roadmap) {
      await expect(page.getByText(item.title, { exact: true })).toHaveCount(1);
    }
    await expect(page.getByText(roadmap[0].title, { exact: true })).toBeVisible();
    await expect(page.locator('.roadmap-item').first()).not.toHaveCSS('opacity', '0');
  });

  test('footer links are real links between the pages', async ({ page }) => {
    await page.goto('/privacy');

    await page.getByRole('link', { name: 'Terms', exact: true }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Terms', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Changelog', exact: true }).click();
    await expect(page).toHaveURL(/\/changelog$/);
    await expect(page.getByRole('heading', { level: 1, name: "What's New" })).toBeVisible();
  });

  test('the theme follows the OS preference', async ({ browser }) => {
    for (const [colorScheme, background] of [
      ['dark', 'rgb(21, 28, 24)'],
      ['light', 'rgb(242, 247, 240)'],
    ] as const) {
      const context = await browser.newContext({ javaScriptEnabled: false, colorScheme });
      const page = await context.newPage();
      await page.goto('/privacy');
      await expect(page.locator('.static-page > div').first()).toHaveCSS('background-color', background);
      await context.close();
    }
  });

  test('/ still shows the landing shell', async ({ page }) => {
    await page.goto('/');
    await expectLandingShell(page);
  });

  for (const path of ['/demo', '/s/abc', '/no-such-page', '/privacy/extra']) {
    test(`${path} gets no static page document`, async ({ page }) => {
      await page.goto(path);
      await expectLandingShell(page);
    });
  }
});

test.describe('Public pages with JavaScript', () => {
  for (const { path, heading, title } of PAGES) {
    test(`${path} renders in the public shell, with the static copy replaced`, async ({ page }) => {
      const appShellRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/src/shells/AppShell.tsx')) appShellRequests.push(request.url());
      });
      await page.goto(path);

      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('.static-page')).toHaveCount(0);
      await expect(page.getByTestId('theme-toggle')).toBeVisible();
      await expect(page).toHaveTitle(title);
      expect(appShellRequests).toEqual([]);
    });
  }

  test('the static copy is hidden before the app renders', async ({ page }) => {
    // Paused before the bundle can run: only boot.js has had its say.
    await page.route('**/src/main.tsx', (route) => route.abort());
    await page.goto('/privacy', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveClass(/boot-hidden/);
    await expect(page.locator('.static-page')).toHaveCount(1);
    await expect(page.locator('.static-page')).toBeHidden();
  });

  test('theme toggle, home and sign-in work as before', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy', exact: true })).toBeVisible();

    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.getByTestId('theme-toggle').click();
    await expect(html).not.toHaveAttribute('data-theme', before ?? '');

    // Sign in hands over to the app shell, which opens the auth modal. The modal needs
    // Supabase configured; the handoff is what this page owns.
    const appShell = page.waitForRequest(APP_SHELL_MODULE);
    await page.getByRole('button', { name: /sign in/i }).click();
    await appShell;
  });

  test('the logo leads home to the landing page', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms', exact: true })).toBeVisible();

    await page.getByRole('banner').getByRole('button', { name: /yidhan/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: /^try writing$/i }).first()).toBeVisible();
  });

  test('a signed-in-looking visitor on /privacy still starts the app shell', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-test-auth-token', '{}');
    });
    const appShell = page.waitForRequest(APP_SHELL_MODULE);
    await page.goto('/privacy');

    await appShell;
    await expect(page.locator('.static-page')).toHaveCount(0);
  });
});
