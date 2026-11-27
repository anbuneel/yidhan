/**
 * Timing harness — item D1 in docs/plans/2026-11-27-shell-size-and-snappiness-proposal.md.
 *
 * Times a production build under 4x CPU throttling and writes the medians to
 * perf-results/. It is a before/after tool: run it on main, run it on a branch,
 * diff the two files (docs/setup/perf-harness.md).
 *
 * Signed-out cases use a seeded Practice Space at /demo: a real library and the
 * real Editor, no Supabase, the same notes every run. Only unlock needs the shared
 * test account. It signs in and unlocks; it creates and changes nothing.
 *
 * The ceilings below are deliberately loose — several times a local median — so a
 * shared CI runner does not flake on them. They catch a step change, not drift.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import type { Server } from 'node:http';
import path from 'node:path';
import { buildForProduction, repoRoot, startStaticServer } from '../e2e-sw/productionBuild';
import { E2E_CREDENTIALS_CONFIGURED, TEST_USER } from '../e2e/fixtures';
import {
  CPU_THROTTLE,
  SAMPLES,
  metric,
  perf,
  quantile,
  median,
  throttledPage,
  timeClick,
  writeResults,
  type Results,
} from './harness';
import { LONG_NOTE_TITLE, seededDemoState } from './seed';

/** Generous ceilings in ms, checked only on the median. See the header. */
const CEILINGS: Record<string, number> = {
  'boot.toLibrary': 15_000,
  'open.cold': 8_000,
  'open.warm': 8_000,
  'typing.p95': 1_500,
};

const TYPED_TEXT = ' and then the evening came in slowly through the open window';
const TYPING_SAMPLES = Math.max(3, Math.ceil(SAMPLES / 2));

const results: Results = {};
const notes: string[] = [];
let server: Server | undefined;
let origin = '';

const hasRealSupabase = () => {
  const url = process.env.VITE_SUPABASE_URL ?? '';
  return url !== '' && !url.includes('placeholder');
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // PERF_SKIP_BUILD=1 reuses dist/ as it is, for repeat runs of one build.
  if (process.env.PERF_SKIP_BUILD !== '1') buildForProduction();
  const started = await startStaticServer({ current: path.join(repoRoot, 'dist') }, { spaFallback: true });
  server = started.server;
  origin = `http://127.0.0.1:${started.port}`;
});

test.afterAll(async ({ browser }) => {
  server?.close();
  notes.unshift(`CPU throttle ${CPU_THROTTLE}x via CDP, service worker blocked`);
  for (const [name, ceiling] of Object.entries(CEILINGS)) {
    if (results[name]) notes.push(`${name} ceiling ${ceiling} ms`);
  }
  writeResults(results, notes, browser.version());
});

/** A fresh, throttled context with the seeded Practice Space. */
async function seededDemoPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript((state) => {
    if (!window.localStorage.getItem('yidhan-demo-state')) {
      window.localStorage.setItem('yidhan-demo-state', state);
    }
  }, JSON.stringify(seededDemoState(Date.now())));
  return throttledPage(context);
}

function longNoteCard(page: Page) {
  return page.getByRole('group', { name: `Note: ${LONG_NOTE_TITLE}`, exact: true });
}

test('cold boot to library, then note open cold and warm (Practice Space)', async ({ browser }) => {
  const boot: number[] = [];
  const fcp: number[] = [];
  const bootLongTasks: number[] = [];
  const bootTbt: number[] = [];
  const settledLongTasks: number[] = [];
  const settledTbt: number[] = [];
  const cold: number[] = [];
  const coldTbt: number[] = [];
  const warm: number[] = [];
  const warmTbt: number[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const page = await seededDemoPage(browser);
    await page.goto(`${origin}/demo`, { waitUntil: 'commit' });

    const span = await perf(page).fromNavigation('library');
    boot.push(span.ms);
    bootLongTasks.push(span.longTasks);
    bootTbt.push(span.tbtMs);
    fcp.push((await perf(page).fcp()) ?? NaN);

    // What runs after first paint (gesture libraries, preloads) still blocks input.
    // The library preloads the Editor chunk, so wait for the network too: "cold"
    // below is the first Editor mount, not the chunk download.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const settled = await perf(page).sinceNavigation();
    settledLongTasks.push(settled.longTasks);
    settledTbt.push(settled.tbtMs);

    const first = await timeClick(page, 'editor', () => longNoteCard(page).click());
    cold.push(first.ms);
    coldTbt.push(first.tbtMs);

    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Yidhan', exact: true }).click();
    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect(longNoteCard(page)).toBeVisible();
    await page.waitForTimeout(500);

    const second = await timeClick(page, 'editor', () => longNoteCard(page).click());
    warm.push(second.ms);
    warmTbt.push(second.tbtMs);

    await page.context().close();
  }

  results['boot.toLibrary'] = metric(boot);
  results['boot.fcp'] = metric(fcp);
  results['boot.longTasks'] = metric(bootLongTasks, 'count');
  results['boot.tbt'] = metric(bootTbt);
  results['boot.settled.longTasks'] = metric(settledLongTasks, 'count');
  results['boot.settled.tbt'] = metric(settledTbt);
  results['open.cold'] = metric(cold);
  results['open.cold.tbt'] = metric(coldTbt);
  results['open.warm'] = metric(warm);
  results['open.warm.tbt'] = metric(warmTbt);

  expect(median(boot)).toBeLessThan(CEILINGS['boot.toLibrary']);
  expect(median(cold)).toBeLessThan(CEILINGS['open.cold']);
  expect(median(warm)).toBeLessThan(CEILINGS['open.warm']);
});

test('typing latency in a long note (Practice Space)', async ({ browser }) => {
  const p50: number[] = [];
  const p95: number[] = [];
  const longTasks: number[] = [];
  const tbt: number[] = [];

  for (let i = 0; i < TYPING_SAMPLES; i++) {
    const page = await seededDemoPage(browser);
    await page.goto(`${origin}/demo`);
    await expect(longNoteCard(page)).toBeVisible();
    await longNoteCard(page).click();

    const body = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await expect(body).toBeVisible();
    await body.click();
    await page.keyboard.press('Control+End');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const start = await perf(page).startTyping();
    // 100 ms apart: a fast typist. Slower than that and a slow keystroke can hide.
    await page.keyboard.type(TYPED_TEXT, { delay: 100 });
    await page.waitForTimeout(500);
    const run = await perf(page).stopTyping(start);

    expect(run.latencies.length).toBe(TYPED_TEXT.length);
    await expect(body).toContainText(TYPED_TEXT.trim());
    p50.push(median(run.latencies));
    p95.push(quantile(run.latencies, 0.95));
    longTasks.push(run.longTasks);
    tbt.push(run.tbtMs);

    await page.context().close();
  }

  results['typing.p50'] = metric(p50);
  results['typing.p95'] = metric(p95);
  results['typing.longTasks'] = metric(longTasks, 'count');
  results['typing.tbt'] = metric(tbt);
  notes.push(`typing: ${TYPED_TEXT.length} keystrokes per sample, ${TYPING_SAMPLES} samples, at the end of a 2,500-word note`);

  expect(median(p95)).toBeLessThan(CEILINGS['typing.p95']);
});

test('unlock to library (shared test account)', async ({ browser }) => {
  test.skip(
    !E2E_CREDENTIALS_CONFIGURED || !hasRealSupabase(),
    'Needs E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_PASSPHRASE and a real VITE_SUPABASE_URL in .env.local'
  );

  const unlock: number[] = [];
  const unlockTbt: number[] = [];
  const endedOn: string[] = [];
  // Each sample is a full password sign-in. Keep the count down for the auth rate limit.
  const samples = Math.min(SAMPLES, 3);

  for (let i = 0; i < samples; i++) {
    const context = await browser.newContext();
    const page = await throttledPage(context);
    await page.goto(`${origin}/`);

    await page.getByRole('button', { name: /sign in/i }).first().click();
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await page.getByLabel(/^email$/i).fill(TEST_USER.email);
    await page.getByLabel(/^password$/i).fill(TEST_USER.password);
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('heading', { name: 'Unlock your notes', exact: true })).toBeVisible();
    await page.getByLabel('Passphrase', { exact: true }).fill(TEST_USER.passphrase);
    await page.waitForLoadState('networkidle');

    const span = await timeClick(page, 'unlocked', () =>
      page.getByRole('button', { name: 'Unlock', exact: true }).click()
    );
    unlock.push(span.ms);
    unlockTbt.push(span.tbtMs);
    endedOn.push(span.endedOn ?? 'unknown');

    await context.close();
  }

  results['unlock.toLibrary'] = metric(unlock);
  results['unlock.tbt'] = metric(unlockTbt);
  if (endedOn.some((e) => e !== 'library')) {
    notes.push(`unlock: ended on ${endedOn.join(', ')} (the recovery-key offer stands in front of the library)`);
  }
  notes.push(`unlock: ${samples} samples, includes Argon2id`);
});
