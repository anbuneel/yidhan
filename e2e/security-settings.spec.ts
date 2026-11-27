import type { Page } from '@playwright/test';
import { test, expect, openSettings } from './fixtures';

/**
 * The Security tab, signed in (PRs #290, #293).
 *
 * "On this device" offers three presets, reads the current one back from the
 * stored settings, and applies a preset to the controls under Details. The
 * "Change passphrase" row points to the recovery route.
 *
 * Settings are stored per browser, and each run starts in a fresh browser
 * context, so nothing here changes the shared test account. The test never
 * picks "Stay unlocked", which would keep keys in this browser.
 *
 * Needs the authenticated fixture, so it skips without E2E credentials.
 */

async function openSecurityTab(page: Page) {
  await openSettings(page);
  const dialog = page.getByRole('dialog');
  await dialog.locator('button, [role="tab"]').filter({ hasText: /^Security$/ }).click();
  await expect(dialog.getByText('On this device', { exact: true })).toBeVisible();
  return dialog;
}

test.describe('Security settings', () => {
  // `openSettings` walks the desktop avatar menu. The Settings modal is the same
  // component at every width, so one desktop viewport covers it.
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  // Only a brand-new account starts on "My device". An existing account in a browser
  // with nothing stored keeps the old defaults (auto-lock off), which match no preset,
  // so "Custom" shows. Decided 2026-11-27: existing readers' behaviour does not change.
  test('an existing account in a fresh browser shows the three presets and Custom', async ({ authenticatedPage: page }) => {
    const dialog = await openSecurityTab(page);

    for (const name of ['Shared device', 'My device', 'Stay unlocked']) {
      await expect(dialog.getByRole('radio', { name: new RegExp(name) })).toBeVisible();
    }
    await expect(dialog.getByRole('radio', { name: /Custom/ })).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Lock now' })).toBeVisible();
  });

  test('applying Shared device sets a 15-minute auto-lock, and My device sets 1 hour', async ({ authenticatedPage: page }) => {
    const dialog = await openSecurityTab(page);

    await dialog.getByRole('radio', { name: /Shared device/ }).check();
    await expect(dialog.getByRole('radio', { name: /Shared device/ })).toBeChecked();

    await dialog.getByText('Details', { exact: true }).click();
    await expect(dialog.locator('#vault-auto-lock')).toHaveValue('15');
    await expect(dialog.getByRole('switch', { name: 'Remember this browser' })).toHaveAttribute('aria-checked', 'false');

    await dialog.getByRole('radio', { name: /My device/ }).check();
    await expect(dialog.getByRole('radio', { name: /My device/ })).toBeChecked();
    await expect(dialog.locator('#vault-auto-lock')).toHaveValue('60');
    // Custom is a state, not a choice: it goes once a preset matches.
    await expect(dialog.getByRole('radio', { name: /Custom/ })).toHaveCount(0);
    await expect(dialog.getByRole('alert')).toHaveCount(0);
  });

  test('the Change passphrase row points to the recovery route', async ({ authenticatedPage: page }) => {
    const dialog = await openSecurityTab(page);

    await expect(dialog.getByText('Change passphrase', { exact: true })).toBeVisible();
    // With a recovery key the row explains the route; without one it asks for a key first.
    await expect(
      dialog.getByText(/recovery key/i).filter({ hasText: /passphrase/i }).first(),
    ).toBeVisible();
  });
});
