/**
 * Service worker update guard.
 *
 * This exists because the app once shipped `registerType: 'prompt'` while
 * nothing ever posted the SKIP_WAITING message that mode requires. New workers
 * installed, parked in `waiting`, and stayed there — browsers kept serving
 * whichever shell they first precached, for months, and clients ran old code
 * against a migrated database. Nothing caught it: unit tests do not run a
 * service worker, and the main e2e suite runs against the dev server, which
 * does not produce one.
 *
 * So this drives the real production build in a real browser: install a
 * worker, deploy a new version while the tab stays open, and assert the client
 * actually moves to it. Run with `npm run e2e:sw`.
 *
 * The two versions come from one build — a deploy is simulated by changing
 * index.html and its precache revision, which is exactly what a real deploy
 * does — so the test never mutates tracked source.
 */

import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The precache revision v2's index.html is stamped with. Both the patch below and the
 * assertion that the client moved read it, because "did the new build take over?" is
 * exactly "is this revision the one being served?".
 */
const V2_REVISION = 'f'.repeat(32);

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Serve whatever `dirRef.current` points at, so the fixture can swap the
 * deployed build under a running browser the way a real deploy does.
 */
function startStaticServer(dirRef: { current: string }): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
    const filePath = path.join(dirRef.current, relative);

    // path.relative rather than startsWith: a prefix test lets a sibling
    // directory through when it shares the prefix (…/v1 vs …/v10).
    const escapesRoot = path.relative(dirRef.current, filePath).startsWith('..');

    if (escapesRoot || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      // A service worker script must never be served stale, or the update
      // check this test depends on cannot see the new version.
      'Cache-Control': 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}

test.describe('service worker updates', () => {
  test.describe.configure({ mode: 'serial' });

  let workspace = '';
  let server: Server | undefined;
  let baseURL = '';
  const servedDir = { current: '' };

  test.beforeAll(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), 'yidhan-sw-'));

    execFileSync('npm', ['run', 'build'], {
      cwd: repoRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
      },
    });

    const v1 = path.join(workspace, 'v1');
    const v2 = path.join(workspace, 'v2');
    await cp(path.join(repoRoot, 'dist'), v1, { recursive: true });
    await cp(path.join(repoRoot, 'dist'), v2, { recursive: true });

    // Simulate the next deploy: index.html changes, and its precache revision
    // changes with it. That is what makes the browser see a new worker.
    const markup = await readFile(path.join(v2, 'index.html'), 'utf8');
    await writeFile(
      path.join(v2, 'index.html'),
      markup.replace('<body>', '<body><div id="sw-smoke-marker">v2</div>', 1)
    );

    const worker = await readFile(path.join(v2, 'sw.js'), 'utf8');
    const bumped = worker.replace(
      /(\{url:"index\.html",revision:")[0-9a-f]+(")/,
      `$1${V2_REVISION}$2`
    );
    expect(bumped, 'index.html precache revision should be patchable').not.toBe(worker);
    await writeFile(path.join(v2, 'sw.js'), bumped);

    servedDir.current = v1;
    const started = await startStaticServer(servedDir);
    server = started.server;
    baseURL = `http://127.0.0.1:${started.port}`;
  });

  test.afterAll(async () => {
    server?.close();
    if (workspace) await rm(workspace, { recursive: true, force: true });
  });

  test('a client on an old build moves to a new one', async ({ page }) => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle' });

    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await expect(page.locator('#sw-smoke-marker')).toHaveCount(0);

    // Deploy, without the tab ever closing.
    servedDir.current = path.join(workspace, 'v2');

    // The periodic check in serviceWorkerUpdates.ts does exactly this for a
    // long-lived tab, which browsers otherwise only do on navigation.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });

    // The regression this guards: under `prompt` the new worker parks in `waiting`
    // forever, because nothing in the running (old) page can release it.
    //
    // Asking only "is `waiting` empty?" does not guard it. That is true *before* the
    // update is found and while the new worker is still `installing`, so the poll
    // resolves on its first tick and the reload below races an install that has not
    // finished — whichever finishes first decides whether the test passes. It held
    // only while installing happened to beat the next line; 12 KiB more precache was
    // enough to lose that race.
    //
    // So wait for the outcome instead: v2's revision precached, and nothing left
    // installing or waiting. Under `prompt` this never arrives, which is the point.
    // The page reloads itself when the new worker claims it, so an evaluate can be
    // torn down mid-flight — that is progress, not failure, and polls again.
    await expect
      .poll(
        () => page.evaluate(async ([revision]) => {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration?.installing) return 'installing';
          if (registration?.waiting) return 'waiting';
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            for (const request of await cache.keys()) {
              if (request.url.includes(revision)) return 'live';
            }
          }
          return 'old build';
        }, [V2_REVISION]).catch(() => 'reloading'),
        { message: 'new worker should activate itself, not wait for the page' }
      )
      .toBe('live');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#sw-smoke-marker')).toHaveCount(1);
  });

  /**
   * The other thing the worker must not do. `navigateFallback` answers every
   * navigation with index.html so the app opens offline, and `/.well-known/` holds a
   * real file (security.txt) that a navigation must reach on the network. This is the
   * denylist's job, and only a real worker can show it doing that job.
   */
  test('a navigation to .well-known reaches the file, not the app shell', async ({ page }) => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);

    const response = await page.goto(`${baseURL}/.well-known/security.txt`, {
      waitUntil: 'load',
    });

    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toMatch(/text\/plain/);
    await expect(page.locator('#root')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.innerText)).toMatch(/^Contact: mailto:/m);
  });

  test('the built worker activates without being told to', async ({ page }) => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });

    const source = await page.evaluate(async () => {
      const response = await fetch('/sw.js', { cache: 'no-store' });
      return response.text();
    });

    // Under `registerType: 'prompt'` skipWaiting() appears only inside a
    // message handler, so this assertion is what separates the two modes.
    expect(source, 'sw.js should call skipWaiting() unconditionally').toMatch(
      /self\.skipWaiting\(\)/
    );
    expect(source).toContain('clientsClaim()');
  });
});
