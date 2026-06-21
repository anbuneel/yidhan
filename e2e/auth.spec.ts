import { test, expect } from '@playwright/test';
import { TEST_USER, loginUser, logoutUser, E2E_CREDENTIALS_CONFIGURED } from './fixtures';

// Skip tests that require real credentials if not configured
const testWithCredentials = E2E_CREDENTIALS_CONFIGURED ? test : test.skip;

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Landing Page', () => {
    test('shows landing page for unauthenticated users', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /begin where you are/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /start writing/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('starts writing from the landing page', async ({ page }) => {
      await page.getByRole('button', { name: /start writing/i }).first().click();

      const isMobileViewport = (page.viewportSize()?.width ?? 0) <= 768;
      if (isMobileViewport) {
        await expect(page).toHaveURL(/\/demo/);
        await expect(page.getByText(/write freely, no account needed/i)).toBeVisible();
        return;
      }

      const landingEditor = page.getByRole('textbox', { name: /your writing/i });
      await expect(landingEditor).toBeVisible();
      await landingEditor.fill('Testing the landing editor');
      await expect(page.locator('.landing-seal')).toBeVisible();
      await expect(page.getByRole('button', { name: /continue in yidhan/i })).toBeVisible();
    });
  });

  test.describe('Login Flow', () => {
    test('opens auth modal when clicking Sign In', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    });

    test('shows validation error for empty fields', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();

      // Try to submit empty form
      await page.locator('form').getByRole('button', { name: /sign in/i }).click();

      // HTML5 validation should prevent submission
      const emailInput = page.getByRole('textbox', { name: /email/i });
      await expect(emailInput).toBeFocused();
    });

    test('shows error for invalid credentials', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();

      await page.getByRole('textbox', { name: /email/i }).fill('wrong@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.locator('form').getByRole('button', { name: /sign in/i }).click();

      // Should show a user-facing auth or connectivity error.
      await expect(page.getByText(/invalid|incorrect|wrong|network error|check your connection/i)).toBeVisible({ timeout: 10000 });
    });

    testWithCredentials('logs in with valid credentials', async ({ page }) => {
      await loginUser(page, TEST_USER.email, TEST_USER.password);

      // Should be on library page
      await expect(page.getByTestId('library-view')).toBeVisible();

      // Avatar should show user initials
      await expect(page.getByTestId('avatar-button')).toBeVisible();
    });

    testWithCredentials('persists login across page reload', async ({ page }) => {
      await loginUser(page, TEST_USER.email, TEST_USER.password);

      // Reload page
      await page.reload();

      // Should still be logged in
      await expect(page.getByTestId('library-view')).toBeVisible();
    });
  });

  test.describe('Signup Flow', () => {
    test('switches to signup mode', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.getByRole('button', { name: /create.*account|sign up/i }).click();

      await expect(page.getByRole('heading', { name: /create.*account|sign up/i })).toBeVisible();
      await expect(page.getByLabel(/^email$/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
    });

    test('shows password requirements', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.getByRole('button', { name: /create.*account|sign up/i }).click();

      // Password hint should be visible (shows "8+ characters")
      await expect(page.getByText(/8\+?\s*characters/i)).toBeVisible();
    });

    test('validates password length', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.getByRole('button', { name: /create.*account|sign up/i }).click();

      await page.getByLabel(/^email$/i).fill('newuser@example.com');
      await page.getByLabel(/^password$/i).fill('short');
      await page.getByRole('button', { name: /sign up|create/i }).click();

      // Password hint shows "8+ characters"
      await expect(page.getByText(/8\+?\s*characters/i)).toBeVisible();
    });
  });

  test.describe('Forgot Password', () => {
    test('shows forgot password form', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.getByRole('button', { name: /forgot.*password/i }).click();

      await expect(page.getByRole('heading', { name: /reset.*password/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /send.*reset.*link/i })).toBeVisible();
    });

    testWithCredentials('sends reset email', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.getByRole('button', { name: /forgot.*password/i }).click();

      await page.getByRole('textbox', { name: /email/i }).fill(TEST_USER.email);
      await page.getByRole('button', { name: /send.*reset.*link/i }).click();

      // Should show success message
      await expect(page.getByText(/check.*email|sent/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Logout', () => {
    testWithCredentials('logs out user', async ({ page }) => {
      await loginUser(page, TEST_USER.email, TEST_USER.password);
      await logoutUser(page);

      // Should be back on landing page
      await expect(page.getByRole('button', { name: /start writing/i })).toBeVisible();
    });
  });

  test.describe('OAuth Buttons', () => {
    test('shows Google OAuth button', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    });

    test('shows GitHub OAuth button', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
    });
  });

  test.describe('Theme Toggle', () => {
    test('toggles theme on landing page', async ({ page }) => {
      const themeToggle = page.getByTestId('theme-toggle');
      await expect(themeToggle).toBeVisible();

      // Get initial theme
      const html = page.locator('html');
      const initialTheme = await html.getAttribute('data-theme');

      // Toggle
      await themeToggle.click();

      // Theme should change
      const newTheme = await html.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);
    });
  });

  test.describe('Modal Behavior', () => {
    test('closes modal on Escape', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('shows confirmation when closing dirty form', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();

      // Type something to make form dirty
      await page.getByLabel(/^email$/i).fill('test@example.com');

      // Try to close
      await page.keyboard.press('Escape');

      // Should show confirmation dialog with heading
      await expect(page.getByRole('heading', { name: /discard changes/i })).toBeVisible();
    });
  });
});
