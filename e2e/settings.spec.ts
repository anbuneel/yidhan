import type { Page } from '@playwright/test';
import { test, expect, openSettings, closeModal, toggleTheme } from './fixtures';

/**
 * Skip test if the password tab is not visible (OAuth users don't have one).
 * Opens settings and clicks into the password tab.
 */
async function requirePasswordTab(page: Page): Promise<void> {
  await openSettings(page);
  const passwordTab = page.getByRole('tab', { name: /password/i });
  const isEmailUser = await passwordTab.isVisible().catch(() => false);
  test.skip(!isEmailUser, 'Test user is OAuth — password tab not available');
  await passwordTab.click();
}

test.describe('Settings', () => {
  test.describe('Settings Modal', () => {
    test('opens settings from avatar menu', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });

    test('shows profile tab by default', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      // Profile tab should be active
      await expect(page.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true');

      // Email should be displayed
      await expect(page.getByText(/@/)).toBeVisible();
    });

    test('closes settings with Escape', async ({ authenticatedPage: page }) => {
      await openSettings(page);
      await closeModal(page);

      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Profile Settings', () => {
    test('displays user email', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      // Email field should be visible and read-only
      const emailField = page.getByLabel(/email/i);
      await expect(emailField).toBeVisible();
      await expect(emailField).toBeDisabled();
    });

    test('updates display name', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      const newName = `Test User ${Date.now()}`;

      // Fill new name
      await page.getByLabel(/name/i).fill(newName);

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // Should show success
      await expect(page.getByText(/saved|updated/i)).toBeVisible();
    });

    test('shows theme toggle in settings', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      await expect(page.getByRole('button', { name: /theme|dark|light/i })).toBeVisible();
    });
  });

  test.describe('Password Settings', () => {
    test('shows password tab for email users', async ({ authenticatedPage: page }) => {
      await requirePasswordTab(page);

      await expect(page.getByLabel(/new password/i)).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    });

    test('validates password length', async ({ authenticatedPage: page }) => {
      await requirePasswordTab(page);

      await page.getByLabel(/new password/i).fill('short');
      await page.getByRole('button', { name: /update.*password/i }).click();

      await expect(page.getByText(/8 characters/i)).toBeVisible();
    });

    test('validates password match', async ({ authenticatedPage: page }) => {
      await requirePasswordTab(page);

      await page.getByLabel(/new password/i).fill('password123');
      await page.getByLabel(/confirm password/i).fill('different123');
      await page.getByRole('button', { name: /update.*password/i }).click();

      await expect(page.getByText(/match/i)).toBeVisible();
    });
  });

  test.describe('Theme Toggle', () => {
    test('toggles between light and dark theme', async ({ authenticatedPage: page }) => {
      const html = page.locator('html');
      const initialTheme = await html.getAttribute('data-theme');

      await toggleTheme(page);

      const newTheme = await html.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);

      // Toggle back
      await toggleTheme(page);

      const finalTheme = await html.getAttribute('data-theme');
      expect(finalTheme).toBe(initialTheme);
    });

    test('persists theme preference', async ({ authenticatedPage: page }) => {
      const html = page.locator('html');
      const initialTheme = await html.getAttribute('data-theme');

      // Toggle to the opposite theme
      await toggleTheme(page);
      const toggledTheme = await html.getAttribute('data-theme');
      expect(toggledTheme).toBeTruthy();
      expect(toggledTheme).not.toBe(initialTheme);

      // Reload and verify the toggled theme persisted
      await page.reload();
      await expect(html).toHaveAttribute('data-theme', toggledTheme as string);

      // Restore original theme to avoid polluting other tests
      await toggleTheme(page);
    });
  });

  test.describe('Offboarding', () => {
    test('shows letting go option in settings', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      // Scroll to bottom if needed
      await page.getByText(/letting go|leave|depart/i).scrollIntoViewIfNeeded();

      await expect(page.getByText(/letting go|leave|depart/i)).toBeVisible();
    });

    test('opens offboarding modal', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      // Click letting go link
      await page.getByText(/letting go|leave|depart/i).click();

      // Offboarding modal should open
      await expect(page.getByText(/keepsakes|departure|leaving/i)).toBeVisible();
    });

    // Note: We don't actually complete offboarding in E2E tests to avoid data loss
  });
});
