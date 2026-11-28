/**
 * Shell-size plan C1: the Argon2id worker, as a browser runs it. Unit tests drive the
 * worker's handler behind a fake Worker (jsdom has none); this is where the real
 * file runs.
 *
 * Production build, served with vercel.json's headers, so the worker and its wasm
 * run under the production CSP. Checks:
 * - the built worker file is in the precache, and derives offline from it;
 * - it produces the vectors captured from the main-thread code before the change
 *   (src/lib/__tests__/argon2.test.ts), for the 64-byte legacy key and the 32-byte KEK;
 * - the page reports no CSP violation while it does.
 */
import { test, expect, type Page } from '@playwright/test';
import type { Server } from 'node:http';
import path from 'node:path';
import { readPrecacheUrls } from '../scripts/bundle-budget-lib.mjs';
import { buildForProduction, repoRoot, startStaticServer, vercelHeaders } from './productionBuild';

const distDir = path.join(repoRoot, 'dist');

const VECTOR = {
  passphrase: 'Ünïcødé passphrase — 🔐 with emoji',
  salt: 'a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5',
  legacy:
    'f27fd0bb365a8443d0400c1ee53e2b11de506696e748ab3d93d52cec43582b2553978581d4fdece8d6cfc686f8dbd321360aec92ba70f772d461d485eb4710d9',
  kek: '507536609830fd96c9dbe50da7c8334b808cb04d5260fd6228f9c137a68e83d4',
};

let server: Server;
let baseURL: string;
let workerUrl: string;

/** Run one derivation in a fresh real worker, the way src/lib/argon2.ts does. */
function deriveInWorker(page: Page, hashLength: number) {
  return page.evaluate(
    ({ url, passphrase, saltHex, hashLength }) =>
      new Promise<{ hex?: string; error?: string; violations: string[] }>((resolve) => {
        const violations: string[] = [];
        document.addEventListener('securitypolicyviolation', (e) => violations.push(e.violatedDirective));
        const salt = Uint8Array.from(saltHex.match(/../g)!, (h) => parseInt(h, 16));
        const worker = new Worker(url, { type: 'module' });
        worker.onerror = (e) => {
          worker.terminate();
          resolve({ error: `worker error: ${e.message}`, violations });
        };
        worker.onmessage = (e: MessageEvent) => {
          worker.terminate();
          const reply = e.data as { type: string; hash?: ArrayBuffer };
          if (reply.type !== 'result' || !(reply.hash instanceof ArrayBuffer)) {
            resolve({ error: `reply: ${JSON.stringify(reply)}`, violations });
            return;
          }
          const hex = Array.from(new Uint8Array(reply.hash), (b) => b.toString(16).padStart(2, '0')).join('');
          resolve({ hex, violations });
        };
        worker.postMessage(
          { type: 'derive', id: 1, password: passphrase, salt, parallelism: 1, iterations: 3, memorySize: 65536, hashLength },
          [salt.buffer]
        );
      }),
    { url: workerUrl, passphrase: VECTOR.passphrase, saltHex: VECTOR.salt, hashLength }
  );
}

test.describe('Argon2id worker (production build, production CSP)', () => {
  test.beforeAll(async () => {
    buildForProduction();
    const started = await startStaticServer({ current: distDir }, { spaFallback: true, headers: vercelHeaders() });
    server = started.server;
    baseURL = `http://127.0.0.1:${started.port}`;
    const urls = readPrecacheUrls(distDir).filter((url) => /^assets\/argon2\.worker-[^/]+\.js$/.test(url));
    expect(urls, 'the worker file is in the precache').toHaveLength(1);
    workerUrl = `/${urls[0]}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('serves the production CSP, and the worker derives the captured vectors under it', async ({ page }) => {
    const response = await page.goto(baseURL, { waitUntil: 'networkidle' });
    expect(response?.headers()['content-security-policy']).toContain("worker-src 'self' blob:");
    expect(response?.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'");

    const legacy = await deriveInWorker(page, 64);
    expect(legacy).toEqual({ hex: VECTOR.legacy, violations: [] });
    const kek = await deriveInWorker(page, 32);
    expect(kek).toEqual({ hex: VECTOR.kek, violations: [] });
  });

  test('offline, the worker loads from the precache and still derives', async ({ page, context }) => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    const result = await deriveInWorker(page, 32);
    expect(result).toEqual({ hex: VECTOR.kek, violations: [] });
    await context.setOffline(false);
  });
});
