import type { Locator, Page } from '@playwright/test';
import { test, expect, openSettings, closeModal, toggleTheme, TEST_USER } from './fixtures';

// "New password" also matches "Confirm new password", so both are matched exactly.
function newPasswordField(page: Page): Locator {
  return page.getByLabel('New password', { exact: true });
}

function currentPasswordField(page: Page): Locator {
  return page.locator('#settings-current-password');
}

// Never the real password: these tests must not be able to change it.
const WRONG_CURRENT_PASSWORD = 'not-the-real-password';

function confirmPasswordField(page: Page): Locator {
  return page.getByLabel('Confirm new password', { exact: true });
}

/** The Profile tab's way into offboarding. It reads "Let go of Yidhan →". */
function letGoButton(page: Page): Locator {
  return page.getByRole('button', { name: /let go of yidhan/i });
}

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

      // The email is the value of a disabled field, not text on the page.
      await expect(page.getByLabel('Email', { exact: true })).toHaveValue(/@/);
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

      const nameField = page.getByLabel('Display name', { exact: true });
      const saveButton = page.getByRole('button', { name: 'Save profile', exact: true });
      const originalName = (await nameField.inputValue()) || TEST_USER.name;
      const newName = `Test User ${Date.now()}`;

      await nameField.fill(newName);
      await saveButton.click();
      await expect(page.getByText('Profile updated successfully!')).toBeVisible();

      // Put the name back. The account is shared and teardown only removes notes
      // and tags, so a name left here would stay. The success message is already
      // on screen from the first save, so wait for the request itself.
      await nameField.fill(originalName);
      const restored = page.waitForResponse(
        (response) =>
          response.url().includes('/auth/v1/user') && response.request().method() === 'PUT'
      );
      await saveButton.click();
      expect((await restored).ok()).toBe(true);
    });

    test('shows theme toggle in settings', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      await expect(page.getByRole('button', { name: /theme|dark|light/i })).toBeVisible();
    });
  });

  test.describe('Password Settings', () => {
    test('shows password tab for email users', async ({ authenticatedPage: page }) => {
      await requirePasswordTab(page);

      await expect(newPasswordField(page)).toBeVisible();
      await expect(confirmPasswordField(page)).toBeVisible();
    });

    // The form's own checks run first: every field is `required` and the new
    // password has `minLength={8}`. A short password is stopped by the browser, so
    // the app's "at least 8 characters" message never renders. Assert the block.
    test('validates password length', async ({ authenticatedPage: page }) => {
      await requirePasswordTab(page);

      await currentPasswordField(page).fill(WRONG_CURRENT_PASSWORD);
      // Typed, not filled: `tooShort` is only set by user edits.
      await newPasswordField(page).pressSequentially('short');
      await confirmPasswordField(page).pressSequentially('short');
      await page.getByRole('button', { name: /update.*password/i }).click();

      const tooShort = await newPasswordField(page).evaluate(
        (input: HTMLInputElement) => input.validity.tooShort
      );
      expect(tooShort).toBe(true);
      await expect(page.getByText(/password updated|current password is incorrect/i)).toHaveCount(0);
    });

    test('validates password match', async ({ authenticatedPage: page }) => {
      await requirePasswordTab(page);

      // The current password is required before the form submits at all. The
      // mismatch is caught before it is checked, so a wrong one is enough.
      await currentPasswordField(page).fill(WRONG_CURRENT_PASSWORD);
      await newPasswordField(page).fill('password123');
      await confirmPasswordField(page).fill('different123');
      await page.getByRole('button', { name: /update.*password/i }).click();

      await expect(page.getByText('Passwords do not match')).toBeVisible();
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

      await letGoButton(page).scrollIntoViewIfNeeded();

      await expect(letGoButton(page)).toBeVisible();
    });

    test('opens offboarding modal', async ({ authenticatedPage: page }) => {
      await openSettings(page);

      await letGoButton(page).click();

      // Offboarding modal should open
      await expect(page.getByRole('heading', { name: 'Letting go', exact: true })).toBeVisible();
      await expect(page.getByText(/will be deleted on/i)).toBeVisible();
    });

    // Note: We don't actually complete offboarding in E2E tests to avoid data loss
  });
});
