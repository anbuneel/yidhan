import { test as base, expect, Page } from '@playwright/test';

/**
 * E2E Test Fixtures for Yidhan
 * Provides reusable test helpers and page objects
 */

// Test user credentials - MUST be set via environment variables
// Set these in .env.local (git-ignored) or as CI secrets
// See .env.example for documentation
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || '',
  password: process.env.E2E_TEST_PASSWORD || '',
  name: 'E2E Test User',
};

// Check if E2E credentials are configured
export const E2E_CREDENTIALS_CONFIGURED = Boolean(
  TEST_USER.email && TEST_USER.password
);

// Extend base test with custom fixtures
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  // Authenticated page fixture - logs in before each test
  // Skips test if E2E credentials are not configured
  authenticatedPage: async ({ page }, use, testInfo) => {
    if (!E2E_CREDENTIALS_CONFIGURED) {
      testInfo.skip(true, 'E2E credentials not configured. Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local');
      return;
    }
    await loginUser(page, TEST_USER.email, TEST_USER.password);
    await use(page);
  },
});

export { expect };

/**
 * Login helper - navigates to app and logs in
 */
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');

  // Click Sign In button on landing page
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for auth modal with dialog role
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  // Fill in credentials using accessible label associations
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);

  // Submit login (use form's submit button, not header button)
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to library
  await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 10000 });
}

/**
 * Logout helper
 */
export async function logoutUser(page: Page): Promise<void> {
  // Click avatar to open menu
  await page.getByTestId('avatar-button').click();

  // Click sign out
  await page.getByRole('menuitem', { name: /sign out/i }).click();

  // Wait for landing page
  await expect(page.getByRole('button', { name: /start writing/i })).toBeVisible();
}

/**
 * Create a new note
 */
export async function createNote(
  page: Page,
  title: string,
  content?: string
): Promise<void> {
  // Click new note button (use aria-label to avoid matching note card text)
  await page.getByRole('button', { name: 'New note', exact: true }).click();

  // Wait for editor
  await expect(page.getByTestId('note-editor')).toBeVisible();

  // Fill title
  await page.getByPlaceholder(/untitled/i).fill(title);

  // Fill content if provided
  if (content) {
    await page.getByTestId('rich-text-editor').click();
    await page.keyboard.type(content);
  }

  // Wait for auto-save
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate back to library from editor
 */
export async function goToLibrary(page: Page): Promise<void> {
  // Logo is a button, not a link
  await page.getByRole('button', { name: /yidhan/i }).click();
  await expect(page.getByTestId('library-view')).toBeVisible();
}

/**
 * Delete a note from the library view
 */
export async function deleteNoteFromLibrary(page: Page, title: string): Promise<void> {
  // Note cards are <article> elements with role="button"
  const noteCard = page.locator('article').filter({ hasText: title });

  // Hover to reveal delete button
  await noteCard.hover();

  // Click delete
  await noteCard.getByRole('button', { name: /delete/i }).click();

  // Wait for undo toast (use button with exact role to avoid matching note titles)
  await expect(page.getByRole('button', { name: /^undo$/i })).toBeVisible({ timeout: 3000 });
}

/**
 * Create a tag
 */
export async function createTag(page: Page, name: string, color?: string): Promise<void> {
  // Click add tag button in filter bar
  await page.getByRole('button', { name: /add tag/i }).click();

  // Wait for modal
  await expect(page.getByRole('dialog')).toBeVisible();

  // Fill tag name
  await page.getByPlaceholder(/tag name/i).fill(name);

  // Select color if provided
  if (color) {
    await page.getByRole('button', { name: new RegExp(color, 'i') }).click();
  }

  // Save
  await page.getByRole('button', { name: /create|save/i }).click();

  // Wait for modal to close
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

/**
 * Filter notes by tag
 */
export async function filterByTag(page: Page, tagName: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(tagName, 'i') }).click();
}

/**
 * Clear tag filters
 */
export async function clearTagFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: /all notes/i }).click();
}

/**
 * Search for notes (uses first visible search input for desktop/mobile)
 */
export async function searchNotes(page: Page, query: string): Promise<void> {
  await page.getByPlaceholder(/search/i).first().fill(query);
  // Wait for search results to update
  await page.waitForTimeout(500);
}

/**
 * Clear search
 */
export async function clearSearch(page: Page): Promise<void> {
  await page.getByPlaceholder(/search/i).first().clear();
}

/**
 * Open settings modal
 */
export async function openSettings(page: Page): Promise<void> {
  await page.getByTestId('avatar-button').click();
  await page.getByRole('menuitem', { name: /settings/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Close any open modal
 */
export async function closeModal(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

/**
 * Toggle theme
 */
export async function toggleTheme(page: Page): Promise<void> {
  await page.getByTestId('theme-toggle').click();
}

