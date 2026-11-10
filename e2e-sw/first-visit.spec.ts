/**
 * First-visit weight (item 61).
 *
 * A fresh browser loads `/` from the production build. This checks what that
 * visitor pays before the page is usable, and that the service worker waits for
 * them: the precache is for the next visit, so it must not compete with this one.
 * Then it goes offline and checks the precache still holds what an offline visit
 * reads, after step 1 removed what it does not.
 *
 * Sizes come from `dist/` (gzip level 9 for text, as stored for images and fonts),
 * so the numbers do not depend on how this server compresses. They are counted the
 * same way as scripts/check-bundle-budget.mjs, and checked against the same limits
 * in scripts/bundle-budget.json.
 *
 * Sentry (step 2) loads after `load`: none of its chunks may be requested before it.
 * Replay waits for the app shell (step 5), so an anonymous landing visit never
 * requests it, and it is never requested on a shared-note route.
 *
 * The landing page renders from the public shell (step 5): no Supabase, Dexie or
 * app-shell chunk is requested before `load`, and none at all until the visitor opens
 * sign-in or leaves the public routes. Sign-in then loads the app shell without a
 * reload.
 * See docs/plans/2026-11-07-first-visit-weight-proposal.md.
 */

import { test, expect, type Request } from '@playwright/test';
import type { Server } from 'node:http';
import path from 'node:path';
import { KB, readBudget, transferBytes } from '../scripts/bundle-budget-lib.mjs';
import { buildForProduction, repoRoot, startStaticServer } from './productionBuild';

const distDir = path.join(repoRoot, 'dist');

/** Sentry's chunks: vendor-sentry, vendor-sentry-replay, and our sentryClient and sentryReplay. */
const SENTRY_CHUNK = /\/assets\/(vendor-sentry|sentryClient|sentryReplay)[-.]/;
const REPLAY_CHUNK = /\/assets\/(vendor-sentry-replay|sentryReplay)[-.]/;
/** The app shell and the two vendor chunks only it imports (step 5). */
const APP_CHUNK = /\/assets\/(AppShell|vendor-supabase|vendor-dexie)-/;

interface Budget {
  landingJsBeforeLoad: { limitKB: number };
  landingPageTotal: { limitKB: number };
}

const budget = readBudget(repoRoot) as unknown as Budget;

/** Bytes for a request to this server, measured from the file in dist/. */
function bytesFor(url: string, origin: string): number {
  const parsed = new URL(url);
  if (parsed.origin !== origin) return 0;
  const relative = parsed.pathname === '/' || !path.extname(parsed.pathname) ? 'index.html' : parsed.pathname;
  const bytes = transferBytes(distDir, relative);
  if (bytes === null) throw new Error(`Requested ${parsed.pathname}, which is not in dist/`);
  return bytes;
}

test.describe('first visit', () => {
  test.describe.configure({ mode: 'serial' });

  let server: Server | undefined;
  let baseURL = '';

  test.beforeAll(async () => {
    buildForProduction();
    const started = await startStaticServer({ current: distDir }, { spaFallback: true });
    server = started.server;
    baseURL = `http://127.0.0.1:${started.port}`;
  });

  test.afterAll(() => {
    server?.close();
  });

  test('the landing page loads before the service worker starts', async ({ page, context }) => {
    // When registration happens, seen from inside the page. The worker cannot fetch
    // anything before it is registered, so this is the exact form of "the precache
    // starts after load".
    await page.addInitScript(() => {
      const container = navigator.serviceWorker;
      if (!container) return;
      const register = container.register.bind(container);
      container.register = (...args: Parameters<ServiceWorkerContainer['register']>) => {
        (window as unknown as { __swRegisteredAt: string }).__swRegisteredAt = document.readyState;
        return register(...args);
      };
    });

    let loaded = false;
    const beforeLoad: Request[] = [];
    const untilIdle: Request[] = [];
    const workerBeforeLoad: string[] = [];

    page.on('request', (request) => {
      if (request.url().startsWith('data:')) return;
      untilIdle.push(request);
      if (!loaded) beforeLoad.push(request);
    });
    page.on('load', () => {
      loaded = true;
    });
    // Requests the worker makes (its precache) arrive on the context, not the page.
    context.on('request', (request) => {
      if (request.serviceWorker() && !loaded) workerBeforeLoad.push(request.url());
    });

    // Hold `load` back the way a slow connection does. Unthrottled, `load` fires
    // within a few hundred ms, before the old code reached `register()` either, so
    // without this the test passed against the code it guards against. A preloaded
    // font delays `load`; registering from main.js would now land before it.
    await page.route(/newsreader-roman-latin-[^/]*\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.goto(baseURL, { waitUntil: 'load' });
    loaded = true;
    await page.waitForLoadState('networkidle');

    const scriptsBeforeLoad = beforeLoad.filter((request) => request.resourceType() === 'script');
    const jsBeforeLoad = scriptsBeforeLoad.reduce((sum, r) => sum + bytesFor(r.url(), baseURL), 0);
    const pageTotal = untilIdle.reduce((sum, r) => sum + bytesFor(r.url(), baseURL), 0);

    console.log(
      `first visit: ${(jsBeforeLoad / KB).toFixed(1)} KB JS before load ` +
        `(${scriptsBeforeLoad.length} scripts), ${(pageTotal / KB).toFixed(1)} KB until network idle ` +
        `(${untilIdle.length} requests)`
    );

    const fonts = untilIdle.filter((r) => /\.woff2$/.test(new URL(r.url()).pathname));
    for (const font of fonts) {
      console.log(`first visit font: ${new URL(font.url()).pathname} ${(bytesFor(font.url(), baseURL) / KB).toFixed(1)} KB`);
    }
    // Literata is the Cyrillic and Greek fallback. The landing is latin only.
    expect(fonts.map((r) => r.url()).filter((url) => /literata/.test(url)), 'Literata on the first visit').toEqual([]);
    // Only Newsreader latin: roman, italic, and the display cut for the headline.
    // Courier Prime is for code, which the landing does not show; it used to load
    // for the toolbar's "</>" label.
    expect(
      fonts
        .map((r) => new URL(r.url()).pathname)
        .filter((path) => !/\/newsreader-(roman|italic|display-roman)-latin-/.test(path)),
      'fonts other than Newsreader latin on the first visit'
    ).toEqual([]);

    expect(jsBeforeLoad / KB, 'JS requested before load, KB gzip').toBeLessThanOrEqual(
      budget.landingJsBeforeLoad.limitKB
    );
    expect(pageTotal / KB, 'everything the page requests until network idle, KB').toBeLessThanOrEqual(
      budget.landingPageTotal.limitKB
    );

    // Step 2: Sentry is deferred, not dropped. None of it before load; all of it after.
    expect(
      scriptsBeforeLoad.map((r) => r.url()).filter((url) => SENTRY_CHUNK.test(url)),
      'Sentry chunks fetched before load'
    ).toEqual([]);
    const requestedAfterLoad = () =>
      untilIdle.filter((r) => !beforeLoad.includes(r)).map((r) => new URL(r.url()).pathname);
    await expect
      .poll(() => requestedAfterLoad().filter((url) => SENTRY_CHUNK.test(url)).length, {
        message: 'Sentry loads after the load event',
      })
      .toBeGreaterThanOrEqual(2);
    // Step 5: Replay waits for the app shell, which an anonymous landing never starts.
    expect(requestedAfterLoad().filter((url) => REPLAY_CHUNK.test(url)), 'Replay on the landing').toEqual([]);

    // Step 5: the landing is the public shell. Nothing that needs Supabase or Dexie,
    // and not the app shell, before load or after it.
    expect(
      scriptsBeforeLoad.map((r) => r.url()).filter((url) => APP_CHUNK.test(url)),
      'Supabase, Dexie or app-shell chunks fetched before load'
    ).toEqual([]);
    expect(
      requestedAfterLoad().filter((url) => APP_CHUNK.test(url)),
      'Supabase, Dexie or app-shell chunks fetched by an anonymous landing visit'
    ).toEqual([]);

    // Step 6: registration waits for load, and the worker fetched nothing before it.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __swRegisteredAt?: string }).__swRegisteredAt))
      .toBe('complete');
    expect(workerBeforeLoad, 'service worker requests before load').toEqual([]);
    expect(
      scriptsBeforeLoad.map((r) => r.url()).filter((url) => /pwa-register|workbox-window/.test(url)),
      'registration code fetched before load'
    ).toEqual([]);
  });

  test('sign-in from the landing loads the app shell without a reload', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
    });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    expect(scripts.filter((url) => APP_CHUNK.test(url))).toEqual([]);
    // A marker on the window survives only if the page is not reloaded.
    await page.evaluate(() => {
      (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
    });

    await page.getByRole('button', { name: /^sign in$/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    expect(scripts.some((url) => /\/assets\/AppShell-/.test(url))).toBe(true);
    expect(scripts.some((url) => /\/assets\/vendor-supabase-/.test(url))).toBe(true);
    expect(
      await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)
    ).toBe(true);
    // Replay follows the app shell.
    await expect.poll(() => scripts.some((url) => REPLAY_CHUNK.test(url))).toBe(true);
  });

  test('a signed-in visitor on / loads the app shell at once', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
    });
    // A stored session, as Supabase writes it. The build points at a placeholder
    // project, so the session cannot refresh; what matters is that the gate and
    // boot.js both see it and skip the landing.
    await page.addInitScript(() => {
      localStorage.setItem('sb-placeholder-auth-token', JSON.stringify({ access_token: 'x' }));
    });
    await page.goto(baseURL, { waitUntil: 'load' });
    await expect(page.locator('html')).toHaveClass(/boot-hidden/);
    await expect.poll(() => scripts.some((url) => /\/assets\/AppShell-/.test(url))).toBe(true);
    expect(scripts.some((url) => /\/assets\/vendor-supabase-/.test(url))).toBe(true);
  });

  test('an OAuth callback on / loads the app shell at once', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
    });
    await page.goto(`${baseURL}/#access_token=not-real&refresh_token=not-real&token_type=bearer`, {
      waitUntil: 'load',
    });
    await expect.poll(() => scripts.some((url) => /\/assets\/vendor-supabase-/.test(url))).toBe(true);
  });

  test('a shared note loads Sentry but never Replay', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
    });

    // The share does not exist (the build points at a placeholder Supabase); the page
    // only has to reach the point where monitoring starts.
    await page.goto(`${baseURL}/s/abcdefghijklmnopqrstuvwx#k=not-a-real-key`, { waitUntil: 'load' });
    await expect
      .poll(() => scripts.filter((url) => /\/assets\/sentryClient-/.test(url)).length, {
        message: 'Sentry starts on the shared route',
      })
      .toBe(1);
    await page.waitForLoadState('networkidle');
    expect(scripts.filter((url) => REPLAY_CHUNK.test(url)), 'Replay requested on /s/*').toEqual([]);
  });

  test('the landing, the library and the changelog open offline', async ({ page, context }) => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);

    await context.setOffline(true);

    const loadedFamilies = () =>
      page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family);
      });

    await page.goto(baseURL, { waitUntil: 'load' });
    await expect(page.getByRole('button', { name: /^try writing$/i }).first()).toBeVisible();
    await expect(page.locator('.boot-landing')).toHaveCount(0);
    await expect.poll(loadedFamilies).toEqual(
      expect.arrayContaining([expect.stringMatching(/Newsreader/)])
    );

    // The practice space is the library a visitor without an account reaches.
    await page.goto(`${baseURL}/demo`, { waitUntil: 'load' });
    await expect(page.getByTestId('library-view')).toBeVisible();

    // The changelog is a lazy chunk since step 3; it must be in the precache.
    await page.goto(`${baseURL}/changelog`, { waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.changelog-item').first()).toBeAttached();
    await expect.poll(loadedFamilies).toEqual(
      expect.arrayContaining([expect.stringMatching(/Newsreader/)])
    );
  });
});
