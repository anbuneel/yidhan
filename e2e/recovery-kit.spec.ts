import type { Page } from '@playwright/test';
import { test, expect, createNote, openSettings, TEST_USER } from './fixtures';

/**
 * Item 26 — the recovery kit, end to end (design test 26-T2).
 *
 * Make a recovery key in Settings, lock the vault, open it with the recovery key
 * instead of the passphrase, see the notes, set a new passphrase, and confirm the
 * server no longer holds the old passphrase wrap.
 *
 * Needs the authenticated fixture, so it skips without E2E credentials.
 *
 * The "new" passphrase is E2E_TEST_PASSPHRASE again, on purpose. The suite shares
 * one account, and CI retries failed tests: a run that died after setting some
 * other passphrase would leave every later spec, and every later run, unable to
 * unlock, with the only recovery key gone with the dead test. Re-using the same
 * passphrase still exercises the whole path — a fresh KEK salt and a new wrap at
 * the next `wrapVersion` replace the old wrap — and every interruption point
 * leaves the account opening with E2E_TEST_PASSPHRASE. That the *old* passphrase
 * stops working when it differs is covered without a browser in
 * `src/contexts/EncryptionContext.recovery.test.tsx`.
 */

interface StoredVault {
  wrapVersion: number;
  keyCheckVersion: number;
  kekSalt: string;
  wrappedKey: string;
  recoveryWrap?: { recoveryVersion: number; wrappedKey: string };
}

/** The vault object supabase-js keeps in the stored session, updated by every `updateUser`. */
async function readStoredVault(page: Page): Promise<StoredVault | null> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
      const session = JSON.parse(localStorage.getItem(key) ?? 'null');
      return session?.user?.user_metadata?.vault ?? null;
    }
    return null;
  });
}

async function openSecuritySettings(page: Page) {
  await openSettings(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Security', exact: true }).click();
}

test.describe('Recovery kit', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a forgotten passphrase: the recovery key opens the notes, and a new passphrase replaces the old wrap', async ({ authenticatedPage: page }) => {
    test.setTimeout(120_000);
    const title = `Recovery ${Date.now()}`;
    await createNote(page, title);
    await page.goto('/');
    await expect(page.getByTestId('library-view')).toBeVisible();

    // 1. Make a recovery key.
    await openSecuritySettings(page);
    await page.getByRole('button', { name: /^Make a (new )?recovery key$/ }).click();
    const shown = page.getByTestId('recovery-key');
    await expect(shown).toBeVisible({ timeout: 15000 });
    const recoveryKey = (await shown.textContent())?.trim() ?? '';
    expect(recoveryKey).toMatch(/^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/);

    await page.getByRole('button', { name: 'I’ve saved it' }).click();
    // Not saved until it is typed back.
    const save = page.getByRole('button', { name: 'Save recovery key' });
    await expect(save).toBeDisabled();
    await page.getByLabel('Recovery key', { exact: true }).fill(recoveryKey);
    await save.click();
    await expect(page.getByText('Recovery key saved.')).toBeVisible({ timeout: 15000 });
    // 26-T3: nothing on screen can show it again.
    await expect(page.getByTestId('recovery-key')).toHaveCount(0);
    expect(await page.content()).not.toContain(recoveryKey);

    const before = await readStoredVault(page);
    expect(before?.recoveryWrap).toBeDefined();

    // 2. Forget the passphrase: lock the vault.
    await page.getByRole('button', { name: 'Lock vault now' }).click();
    await expect(page.getByRole('heading', { name: 'Unlock your notes', exact: true })).toBeVisible();

    // 3. Unlock with the recovery key.
    await page.getByRole('button', { name: 'Use your recovery key' }).click();
    await page.getByLabel('Recovery key', { exact: true }).fill(recoveryKey);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    // 4. A new passphrase is required before the library opens.
    await expect(page.getByRole('heading', { name: 'Choose a new passphrase' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('library-view')).toHaveCount(0);
    await page.getByLabel('New passphrase', { exact: true }).fill(TEST_USER.passphrase);
    await page.getByLabel('Confirm new passphrase', { exact: true }).fill(TEST_USER.passphrase);
    await page.getByRole('button', { name: 'Save passphrase' }).click();

    // 5. The notes are there.
    await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });

    // 6. The old wrap is gone from the server's vault; the recovery wrap is kept.
    const after = await readStoredVault(page);
    expect(after).not.toBeNull();
    expect(after!.wrapVersion).toBe(before!.wrapVersion + 1);
    expect(after!.keyCheckVersion).toBe(before!.keyCheckVersion + 1);
    expect(after!.kekSalt).not.toBe(before!.kekSalt);
    expect(after!.wrappedKey).not.toBe(before!.wrappedKey);
    expect(JSON.stringify(after)).not.toContain(before!.wrappedKey);
    expect(after!.recoveryWrap).toEqual(before!.recoveryWrap);

    // 7. The new wrap opens with the passphrase.
    await openSecuritySettings(page);
    await page.getByRole('button', { name: 'Lock vault now' }).click();
    await page.getByLabel('Passphrase', { exact: true }).fill(TEST_USER.passphrase);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
  });
});
