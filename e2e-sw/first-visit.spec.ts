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
 * Not asserted yet, on purpose:
 * - No Sentry chunk before `load`. Sentry is still in the entry path; step 2 of the
 *   proposal defers it and adds that assertion here.
 * - No Supabase or Dexie chunk before `load`. Both are still in the entry path;
 *   step 5 splits the public routes out and adds those assertions here.
 * See docs/plans/2026-11-07-first-visit-weight-proposal.md.
 */

import { test, expect, type Request } from '@playwright/test';
import type { Server } from 'node:http';
import path from 'node:path';
import { KB, readBudget, transferBytes } from '../scripts/bundle-budget-lib.mjs';
import { buildForProduction, repoRoot, startStaticServer } from './productionBuild';

const distDir = path.join(repoRoot, 'dist');

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
    await page.route(/cormorant-garamond-latin-[^/]*\.woff2$/, async (route) => {
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

    expect(jsBeforeLoad / KB, 'JS requested before load, KB gzip').toBeLessThanOrEqual(
      budget.landingJsBeforeLoad.limitKB
    );
    expect(pageTotal / KB, 'everything the page requests until network idle, KB').toBeLessThanOrEqual(
      budget.landingPageTotal.limitKB
    );

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
      expect.arrayContaining([expect.stringMatching(/Cormorant Garamond/), expect.stringMatching(/Source Sans 3/)])
    );

    // The practice space is the library a visitor without an account reaches.
    await page.goto(`${baseURL}/demo`, { waitUntil: 'load' });
    await expect(page.getByTestId('library-view')).toBeVisible();

    // The changelog is a lazy chunk since step 3; it must be in the precache.
    await page.goto(`${baseURL}/changelog`, { waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.changelog-item').first()).toBeAttached();
    await expect.poll(loadedFamilies).toEqual(
      expect.arrayContaining([expect.stringMatching(/Cormorant Garamond/)])
    );
  });
});
