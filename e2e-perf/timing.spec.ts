/**
 * Timing harness — item D1 in docs/plans/2026-11-27-shell-size-and-snappiness-proposal.md.
 *
 * Times a production build under 4x CPU throttling and writes the medians to
 * perf-results/. It is a before/after tool: run it on main, run it on a branch,
 * diff the two files (docs/setup/perf-harness.md).
 *
 * Signed-out cases use a seeded Practice Space at /demo: a real library and the
 * real Editor, no Supabase, the same notes every run. Unlock and the signed-in
 * library load need the shared test account. They sign in, unlock, reload and
 * count notes; they create and change nothing.
 *
 * The ceilings below are deliberately loose — several times a local median — so a
 * shared CI runner does not flake on them. They catch a step change, not drift.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import type { Server } from 'node:http';
import path from 'node:path';
import { buildForProduction, repoRoot, startStaticServer } from '../e2e-sw/productionBuild';
import { createClient } from '@supabase/supabase-js';
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
import { LONG_NOTE_TITLE, LONG_NOTE_WORDS, seededDemoState } from './seed';

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
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  return url !== '' && !url.includes('placeholder') && anonKey !== '' && !anonKey.includes('placeholder');
};

/** Close the sample's context even when an assertion throws, so no throttled page leaks. */
async function inSample(page: Page, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } finally {
    await page.context().close();
  }
}

/** The library, or an empty account's empty state, which is not inside library-view. */
const libraryOrEmpty = (page: Page) =>
  page.getByTestId('library-view').or(page.getByText('Your notes await', { exact: true }));

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
    await inSample(page, async () => {
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

    });
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
    await inSample(page, async () => {
      await page.goto(`${origin}/demo`);
      await expect(longNoteCard(page)).toBeVisible();
      await longNoteCard(page).click();

      const body = page.getByTestId('rich-text-editor').locator('.ProseMirror');
      await expect(body).toBeVisible();
      await body.click();
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
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

    });
  }

  results['typing.p50'] = metric(p50);
  results['typing.p95'] = metric(p95);
  results['typing.longTasks'] = metric(longTasks, 'count');
  results['typing.tbt'] = metric(tbt);
  notes.push(`typing: ${TYPED_TEXT.length} keystrokes per sample, ${TYPING_SAMPLES} samples, at the end of a ${LONG_NOTE_WORDS}-word note`);

  expect(median(p95)).toBeLessThan(CEILINGS['typing.p95']);
});

const SKIP_REASON =
  'Needs E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_PASSPHRASE and a real VITE_SUPABASE_URL in .env.local';

/** Sign in through the landing page and stop on the unlock form, passphrase typed. */
async function signInToUnlockForm(page: Page): Promise<void> {
  await page.goto(`${origin}/`);
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.getByLabel(/^email$/i).fill(TEST_USER.email);
  await page.getByLabel(/^password$/i).fill(TEST_USER.password);
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('heading', { name: 'Unlock your notes', exact: true })).toBeVisible();
  await page.getByLabel('Passphrase', { exact: true }).fill(TEST_USER.passphrase);
  await page.waitForLoadState('networkidle');
}

const unlockButton = (page: Page) => page.getByRole('button', { name: 'Unlock', exact: true });

/**
 * How many live notes the account holds, read from Node with the anon key. Read only.
 * Signs out with scope 'local', which ends this client's session and no other.
 */
async function countAccountNotes(): Promise<number> {
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  if (signInError || !data.user) throw new Error(`Note count sign-in failed: ${signInError?.message}`);
  const { count, error } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', data.user.id)
    .is('deleted_at', null);
  await supabase.auth.signOut({ scope: 'local' });
  if (error || count === null) throw new Error(`Note count failed: ${error?.message}`);
  return count;
}

test('unlock to library (shared test account)', async ({ browser }) => {
  test.skip(!E2E_CREDENTIALS_CONFIGURED || !hasRealSupabase(), SKIP_REASON);

  const unlock: number[] = [];
  const unlockLongTasks: number[] = [];
  const unlockTbt: number[] = [];
  const unlockLongest: number[] = [];
  const unlockFrameGap: number[] = [];
  const endedOn: string[] = [];
  // Each sample is a full password sign-in. Keep the count down for the auth rate limit.
  const samples = Math.min(SAMPLES, 3);

  for (let i = 0; i < samples; i++) {
    const context = await browser.newContext();
    const page = await throttledPage(context);
    await inSample(page, async () => {
      await signInToUnlockForm(page);

      // Pointerdown on Unlock to the library painting. Argon2id runs on the main
      // thread today, so the blocking numbers are what moving it to a worker changes.
      const span = await timeClick(page, 'unlocked', () => unlockButton(page).click());
      unlock.push(span.ms);
      unlockLongTasks.push(span.longTasks);
      unlockTbt.push(span.tbtMs);
      unlockLongest.push(span.longestTaskMs);
      unlockFrameGap.push(span.maxFrameGapMs ?? NaN);
      endedOn.push(span.endedOn ?? 'unknown');

    });
  }

  results['unlock.toLibrary'] = metric(unlock);
  results['unlock.longTasks'] = metric(unlockLongTasks, 'count');
  results['unlock.tbt'] = metric(unlockTbt);
  results['unlock.longestTask'] = metric(unlockLongest);
  results['unlock.maxFrameGap'] = metric(unlockFrameGap);
  if (endedOn.some((e) => e !== 'library')) {
    notes.push(`unlock: ended on ${endedOn.join(', ')} (the recovery-key offer stands in front of the library)`);
  }
  notes.push(`unlock: ${samples} samples, includes Argon2id`);
});

test('signed-in library load and decrypt (shared test account)', async ({ browser }) => {
  test.skip(!E2E_CREDENTIALS_CONFIGURED || !hasRealSupabase(), SKIP_REASON);

  const noteCount = await countAccountNotes();

  // One sign-in and unlock, then reloads. A reload restores the keys from
  // sessionStorage (after the key check), so each sample is a signed-in cold boot
  // of the app with no Argon2id in it. The static server sends no-cache with no
  // validators, so every reload fetches every asset again.
  const load: number[] = [];
  const toCards: number[] = [];
  const bootTbt: number[] = [];
  const bootLongest: number[] = [];
  const samples = Math.min(SAMPLES, 5);

  const context = await browser.newContext();
  const page = await throttledPage(context, { bootLibrary: true });
  try {
    await signInToUnlockForm(page);
    await unlockButton(page).click();
    const recoveryOffer = page.getByRole('heading', { name: 'Make a recovery key', exact: true });
    await expect(libraryOrEmpty(page).or(recoveryOffer).first()).toBeVisible();
    if (await recoveryOffer.isVisible()) {
      // Declining writes nothing; it only closes the offer for this session.
      await page.getByRole('button', { name: 'Not now', exact: true }).click();
    }
    await expect(libraryOrEmpty(page).first()).toBeVisible();
    await page.waitForLoadState('networkidle');

    for (let i = 0; i < samples; i++) {
      await page.reload({ waitUntil: 'commit' });
      const span = await perf(page).fromNavigation('library');
      if (span.endedOn === 'unlock-gate') {
        throw new Error('A reload asked for the passphrase again: the session restore did not hold the keys');
      }
      toCards.push(span.ms);
      bootTbt.push(span.tbtMs);
      bootLongest.push(span.longestTaskMs);

      // The app's own measure, from keys available to notes set. The first one after
      // navigation is the initial load; later ones are sync refreshes.
      await expect.poll(async () => (await perf(page).libraryLoads()).length).toBeGreaterThan(0);
      load.push((await perf(page).libraryLoads())[0].ms);
      await page.waitForLoadState('networkidle');
    }
  } finally {
    await context.close();
  }

  results['signedIn.libraryLoad'] = metric(load);
  results['signedIn.toCards'] = metric(toCards);
  results['signedIn.tbt'] = metric(bootTbt);
  results['signedIn.longestTask'] = metric(bootLongest);
  results['signedIn.noteCount'] = metric([noteCount], 'count');
  notes.push(
    `signedIn: ${samples} reloads of one unlocked session, ${noteCount} notes; ` +
      'libraryLoad is keys available to notes set (local read plus decrypt), toCards is navigation to cards painted'
  );
});
