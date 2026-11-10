import AxeBuilder from '@axe-core/playwright';
import type { Page, Route, TestInfo } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Item 160 — a one-time accessibility pass on the rendered app. Tagged @a11y.
 *
 * axe-core (WCAG 2.0/2.1/2.2 A and AA rules) on six screens: the landing page, the
 * library, the editor, the unlock screen, the three-step passphrase setup and
 * Settings. Each runs in both themes (Light and Dark), at 100% and
 * 200% zoom, with `prefers-reduced-motion: reduce`.
 *
 * **200% zoom** is a 640×360 CSS viewport at deviceScaleFactor 2: what Chrome does
 * at 200% on a 1280×720 window. The layout viewport halves, `devicePixelRatio`
 * doubles and media queries respond, so the app lays out exactly as it would for a
 * reader who zoomed. CSS `zoom` on the root does none of that: breakpoints keep
 * matching the desktop width, so it would test a layout nobody sees.
 *
 * **No server.** The library and editor are the Practice Space (`/demo`), which
 * needs no account. Setup, unlock and Settings need a session, so this plants a
 * placeholder one in localStorage and answers every Supabase request inside the
 * browser: auth, `user_metadata` and the REST tables. Nothing is forwarded, so a
 * run with real `VITE_SUPABASE_*` values still never reaches that server. The setup
 * runs for real (Argon2id in wasm), which gives the unlock screen and Settings a
 * real vault to open.
 *
 * Not in CI yet: roadmap item 67 is the CI version. It skips unless `A11Y_AUDIT=1`:
 *   A11Y_AUDIT=1 npx playwright test e2e/accessibility.spec.ts --project=chromium
 * Set `A11Y_REPORT_DIR` to also write each scan's violations as JSON.
 */

const AUDIT = process.env.A11Y_AUDIT === '1';
const REPORT_DIR = process.env.A11Y_REPORT_DIR;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://placeholder.invalid';
const SUPABASE_ORIGIN = new URL(SUPABASE_URL).origin;
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

const THEMES = [
  { name: 'Light', value: 'light' },
  { name: 'Dark', value: 'dark' },
] as const;

const ZOOMS = [
  { name: '100%', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  { name: '200%', viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 },
] as const;

interface Finding {
  rule: string;
  impact: string | null | undefined;
  help: string;
  nodes: number;
  targets: string[];
  html: string[];
}

/** Scan the page; return violations rather than fail, so one run reports everything. */
async function scan(page: Page, testInfo: TestInfo, screen: string, label: string): Promise<Finding[]> {
  // Reduced motion collapses transitions to 0.01ms, but React may still be settling.
  await page.waitForTimeout(150);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const findings = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
    targets: v.nodes.map((n) => {
      // Contrast failures carry the colours and ratio; worth keeping for the fix.
      const data = n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;
      const colours = data?.fgColor ? ` [${data.fgColor} on ${data.bgColor}: ${data.contrastRatio}]` : '';
      return `${n.target.join(' ')}${colours}`;
    }),
    html: v.nodes.map((n) => n.html.slice(0, 200)),
  }));
  const name = `${label} · ${screen}`;
  await testInfo.attach(`${name}.json`, {
    body: JSON.stringify(findings, null, 2),
    contentType: 'application/json',
  });
  if (REPORT_DIR) {
    mkdirSync(REPORT_DIR, { recursive: true });
    const file = name.replace(/[^a-z0-9%]+/gi, '_');
    writeFileSync(join(REPORT_DIR, `${file}.json`), JSON.stringify({ screen, label, findings }, null, 2));
    if (findings.length > 0) {
      await page.screenshot({ path: join(REPORT_DIR, `${file}.png`), fullPage: true });
    }
  }
  return findings;
}

function writeMotion(label: string, group: string, motion: Record<string, string[]>) {
  if (!REPORT_DIR) return;
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, `motion_${label.replace(/[^a-z0-9%]+/gi, '_')}_${group}.txt`), JSON.stringify(motion, null, 2));
}

/**
 * CSS animations and transitions still running once reduced motion has had its say.
 * Web Animations only: motion driven from JavaScript frame by frame (react-spring in
 * the mobile bottom sheet) does not appear in `getAnimations()`.
 */
async function runningAnimations(page: Page): Promise<string[]> {
  // Guard the guard: a misplaced option once left reduced motion off without a sound.
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.waitForTimeout(100);
  return page.evaluate(() =>
    document
      .getAnimations()
      // Reduced motion collapses durations to 0.01ms, so one can still be caught in
      // the frame it starts. What must not survive is real motion: anything longer.
      .filter((a) => a.playState === 'running' && Number(a.effect?.getComputedTiming().activeDuration ?? 0) > 1)
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? 'script';
        return `${name} on ${target?.tagName.toLowerCase() ?? '?'}.${target?.className ?? ''}`;
      })
  );
}

function fakeJwt(sub: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, exp, role: 'authenticated', aud: 'authenticated' })}.signature`;
}

/**
 * A placeholder account: a stored session plus a Supabase that lives in the page.
 * The account starts with no vault, as a new one would, so the app opens the setup.
 */
async function playSupabase(page: Page) {
  const userId = '00000000-0000-4000-8000-000000000160';
  let metadata: Record<string, unknown> = {};
  const user = () => ({
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'a11y@example.invalid',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: structuredClone(metadata),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });
  const session = () => ({
    access_token: fakeJwt(userId),
    refresh_token: 'placeholder-refresh',
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
    user: user(),
  });

  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
    },
    [STORAGE_KEY, JSON.stringify(session())] as const
  );

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.startsWith('/auth/v1/user')) {
      if (method === 'PUT') {
        const data = (request.postDataJSON()?.data ?? {}) as Record<string, unknown>;
        metadata = { ...metadata, ...structuredClone(data) };
      }
      await route.fulfill({ json: user() });
      return;
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      await route.fulfill({ json: session() });
      return;
    }
    if (url.pathname.startsWith('/auth/v1/logout')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (url.pathname.startsWith('/auth/v1/')) {
      await route.fulfill({ json: {} });
      return;
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      if (url.pathname === '/rest/v1/schema_version') {
        await route.fulfill({ json: wantsObject ? { version: 1 } : [{ version: 1 }] });
        return;
      }
      if (method === 'GET' || method === 'HEAD') {
        await route.fulfill({ json: wantsObject ? null : [], headers: { 'content-range': '*/0' } });
        return;
      }
      // Writes: echo the payload back, as `return=representation` would.
      const body = request.postDataJSON();
      const rows = Array.isArray(body) ? body : body ? [body] : [];
      await route.fulfill({ status: 201, json: wantsObject ? rows[0] ?? null : rows });
      return;
    }
    // Realtime, storage, functions: nothing to say.
    await route.abort('blockedbyclient');
  });
}

for (const theme of THEMES) {
  for (const zoom of ZOOMS) {
    const label = `${theme.name} ${zoom.name}`;

    test.describe(`Accessibility · ${label} @a11y`, () => {
      test.skip(!AUDIT, 'Set A11Y_AUDIT=1 to run the accessibility pass (item 160).');
      test.use({
        viewport: zoom.viewport,
        deviceScaleFactor: zoom.deviceScaleFactor,
        // Not a top-level option: `reducedMotion` only takes effect as a context option.
        contextOptions: { reducedMotion: 'reduce' },
        colorScheme: theme.value,
        storageState: { cookies: [], origins: [] },
      });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => window.localStorage.setItem('yidhan-theme', value), theme.value);
      });

      test('landing, library and editor', async ({ page }, testInfo) => {
        const all: Record<string, Finding[]> = {};
        const motion: Record<string, string[]> = {};

        await page.goto('/');
        await expect(page.getByRole('button', { name: /^try writing$/i }).first()).toBeVisible();
        all.landing = await scan(page, testInfo, 'landing', label);
        motion.landing = await runningAnimations(page);

        await page.goto('/demo');
        await expect(page.getByTestId('library-view')).toBeVisible();
        all.library = await scan(page, testInfo, 'library', label);
        motion.library = await runningAnimations(page);

        await page.goto('/demo/new');
        await expect(page.getByTestId('note-editor')).toBeVisible();
        await page.getByPlaceholder(/untitled/i).fill('A title');
        all.editor = await scan(page, testInfo, 'editor', label);
        motion.editor = await runningAnimations(page);

        writeMotion(label, 'public', motion);
        expect.soft(motion, 'animations left running under reduced motion').toEqual({ landing: [], library: [], editor: [] });
        expect(all).toEqual({ landing: [], library: [], editor: [] });
      });

      test('setup, unlock and settings', async ({ page }, testInfo) => {
        test.setTimeout(180_000);
        const all: Record<string, Finding[]> = {};
        const motion: Record<string, string[]> = {};
        await playSupabase(page);

        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Choose a passphrase', exact: true })).toBeVisible({ timeout: 20_000 });
        all['setup step 1'] = await scan(page, testInfo, 'setup step 1', label);
        motion['setup step 1'] = await runningAnimations(page);

        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        const shown = page.getByTestId('recovery-key');
        await expect(shown).toBeVisible({ timeout: 30_000 });
        all['setup step 2'] = await scan(page, testInfo, 'setup step 2', label);
        const recoveryKey = (await shown.textContent())?.trim() ?? '';
        await page.getByRole('button', { name: 'I’ve saved it' }).click();
        await page.getByLabel('Recovery key', { exact: true }).fill(recoveryKey);
        all['setup step 2 confirm'] = await scan(page, testInfo, 'setup step 2 confirm', label);
        await page.getByRole('button', { name: 'Save recovery key' }).click();

        await expect(page.getByRole('heading', { name: 'Your notes are ready', exact: true })).toBeVisible({ timeout: 30_000 });
        all['setup step 3'] = await scan(page, testInfo, 'setup step 3', label);
        await page.getByRole('button', { name: 'Open my notes', exact: true }).click();
        await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 20_000 });

        await page.getByTestId('avatar-button').click();
        await page.getByRole('menuitem', { name: /settings/i }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        all['settings profile'] = await scan(page, testInfo, 'settings profile', label);
        motion.settings = await runningAnimations(page);
        await dialog.getByRole('button', { name: 'Password', exact: true }).click();
        all['settings password'] = await scan(page, testInfo, 'settings password', label);
        await dialog.getByRole('button', { name: 'Security', exact: true }).click();
        all['settings security'] = await scan(page, testInfo, 'settings security', label);

        // What axe cannot see: Tab stays in the open dialog, and Escape closes it.
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press('Tab');
          expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${i + 1} left Settings`).toBe(true);
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();

        // A new tab session: the vault asks for the passphrase.
        await page.evaluate(() => sessionStorage.clear());
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Unlock Your Notes', exact: true })).toBeVisible({ timeout: 20_000 });
        all.unlock = await scan(page, testInfo, 'unlock', label);
        motion.unlock = await runningAnimations(page);

        writeMotion(label, 'account', motion);
        expect.soft(motion, 'animations left running under reduced motion').toEqual({
          'setup step 1': [],
          settings: [],
          unlock: [],
        });
        expect(Object.fromEntries(Object.entries(all).filter(([, f]) => f.length > 0))).toEqual({});
      });
    });
  }
}
