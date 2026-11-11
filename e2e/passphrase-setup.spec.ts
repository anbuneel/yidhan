import type { Page, Route } from '@playwright/test';
import { test, expect, E2E_CREDENTIALS_CONFIGURED, TEST_USER } from './fixtures';

/**
 * Item 27 — the three-step setup, in a real browser with real Argon2id.
 *
 * A fresh account needs a confirmed email, and the E2E fixtures have no inbox.
 * So this signs in as the shared test account and then plays the server for its
 * `user_metadata` inside the browser: every auth response the app sees carries an
 * empty metadata object, as a new account's would, and every metadata write the
 * app makes lands in that in-browser copy. **The real account's metadata is never
 * written:** `PUT /auth/v1/user` is answered here and never forwarded. Note, tag
 * and membership writes are blocked too, so the starter notes, encrypted under a
 * key the real account does not hold, never reach the shared database.
 *
 * What this does not cover, and why:
 * - Sign-up and email confirmation. The fixtures have no inbox.
 * - The setup write landing on a real Supabase server, and the starter notes
 *   syncing. Both would orphan data on the shared account. The write itself is
 *   covered against a fake server in `src/contexts/EncryptionContext.setup.test.tsx`.
 *
 * Skips without E2E credentials.
 */

type Metadata = Record<string, unknown>;

interface FakeServer {
  metadata: Metadata;
  /** Every metadata write the app made, in order. */
  writes: Metadata[];
}

async function playMetadataServer(page: Page): Promise<FakeServer> {
  const fake: FakeServer = { metadata: {}, writes: [] };
  let realUser: Record<string, unknown> | null = null;

  const withFakeMetadata = (user: Record<string, unknown>) => ({
    ...user,
    user_metadata: structuredClone(fake.metadata),
  });

  // Sign-in and token refresh: the session's user carries the fake metadata.
  await page.route(/\/auth\/v1\/token(\?|$)/, async (route: Route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body?.user) {
      realUser = body.user;
      body.user = withFakeMetadata(body.user);
    }
    await route.fulfill({ response, json: body });
  });

  await page.route(/\/auth\/v1\/user(\?|$)/, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      // Never forwarded: the shared account keeps its own vault.
      const data = (request.postDataJSON()?.data ?? {}) as Metadata;
      fake.writes.push(structuredClone(data));
      fake.metadata = { ...fake.metadata, ...structuredClone(data) };
      if (!realUser) {
        await route.fulfill({ status: 500, json: { message: 'no user yet' } });
        return;
      }
      await route.fulfill({ status: 200, json: withFakeMetadata(realUser) });
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    realUser = body;
    await route.fulfill({ response, json: withFakeMetadata(body) });
  });

  // No note, tag or membership write leaves the browser.
  await page.route(/\/rest\/v1\/(notes|tags|note_tags)(\?|$|\/)/, async (route: Route) => {
    if (route.request().method() === 'GET' || route.request().method() === 'HEAD') {
      await route.continue();
      return;
    }
    await route.abort('blockedbyclient');
  });

  return fake;
}

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel(/^email$/i).fill(TEST_USER.email);
  await page.getByLabel(/^password$/i).fill(TEST_USER.password);
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
}

const stepOne = (page: Page) => page.getByRole('heading', { name: 'Choose a passphrase', exact: true });

test.describe('Three-step passphrase setup', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(!E2E_CREDENTIALS_CONFIGURED, 'E2E credentials not configured. Set E2E_TEST_EMAIL, E2E_TEST_PASSWORD and E2E_TEST_PASSPHRASE');

  test('passphrase, recovery key, done; an interruption before the key is saved changes nothing', async ({ page, browserName }) => {
    test.setTimeout(180_000);

    const fake = await playMetadataServer(page);
    await signIn(page);

    // Step 1: a generated passphrase is the default.
    await expect(stepOne(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    const firstSuggestion = (await page.getByTestId('suggested-passphrase').textContent())?.trim() ?? '';
    expect(firstSuggestion).toMatch(/^[a-z]{3,8}(-[a-z]{3,8}){5}$/);
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: 'Copy', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(firstSuggestion);
    }

    // Step 2: the recovery key, with no way past it.
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByTestId('recovery-key')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await expect(page.getByRole('button', { name: /not now|skip/i })).toHaveCount(0);
    expect(fake.writes).toHaveLength(0);

    // Interruption: the tab goes away before the key is saved. Nothing was
    // written, so the next load starts the setup again at step 1.
    await page.reload();
    await expect(stepOne(page)).toBeVisible({ timeout: 20_000 });
    expect(fake.writes).toHaveLength(0);
    const passphrase = (await page.getByTestId('suggested-passphrase').textContent())?.trim() ?? '';
    expect(passphrase).not.toBe(firstSuggestion);

    // Back from step 2 returns to step 1, not forward.
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByTestId('recovery-key')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(stepOne(page)).toBeVisible();
    await expect(page.getByTestId('suggested-passphrase')).toHaveText(passphrase);

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const shown = page.getByTestId('recovery-key');
    await expect(shown).toBeVisible({ timeout: 30_000 });
    const recoveryKey = (await shown.textContent())?.trim() ?? '';
    expect(recoveryKey).toMatch(/^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/);

    await page.getByRole('button', { name: 'I’ve saved it' }).click();
    const save = page.getByRole('button', { name: 'Save recovery key' });
    await expect(save).toBeDisabled();
    await page.getByLabel('Recovery key', { exact: true }).fill(recoveryKey);
    await save.click();

    // Step 3: done.
    await expect(page.getByRole('heading', { name: 'Your notes are ready', exact: true })).toBeVisible({ timeout: 30_000 });
    expect(fake.writes).toHaveLength(1);
    const vault = fake.metadata.vault as { recoveryWrap?: { recoveryVersion: number }; keyCheck?: string } | undefined;
    expect(fake.metadata.encryption_salt).toEqual(expect.any(String));
    expect(vault?.keyCheck).toEqual(expect.any(String));
    expect(vault?.recoveryWrap?.recoveryVersion).toBe(1);
    const written = JSON.stringify(fake.writes);
    expect(written).not.toContain(passphrase);
    expect(written).not.toContain(recoveryKey);

    await page.getByRole('button', { name: 'Open my notes', exact: true }).click();
    await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 20_000 });

    // The next sign-in: a fresh tab session asks for the passphrase, and the
    // generated one opens the vault. A recovery key exists, so no offer follows.
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Unlock your notes', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Passphrase', { exact: true }).fill(passphrase);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Make a recovery key' })).toHaveCount(0);
    await expect(stepOne(page)).toHaveCount(0);
    expect(fake.writes).toHaveLength(1);
  });
});
