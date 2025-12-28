import { test as base, expect, Page } from '@playwright/test';

/**
 * E2E Test Fixtures for Zenote
 * Provides reusable test helpers and page objects
 */

// Test user credentials (use test accounts in Supabase)
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || 'e2e-test@zenote.app',
  password: process.env.E2E_TEST_PASSWORD || 'TestPassword123!',
  name: 'E2E Test User',
};

// Extend base test with custom fixtures
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  // Authenticated page fixture - logs in before each test
  authenticatedPage: async ({ page }, use) => {
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

  // Wait for auth modal
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  // Fill in credentials
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Submit login
  await page.getByRole('button', { name: /sign in/i }).click();

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
  // Click new note button
  await page.getByRole('button', { name: /new note/i }).click();

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
  await page.getByRole('link', { name: /zenote/i }).click();
  await expect(page.getByTestId('library-view')).toBeVisible();
}

/**
 * Open a note by title
 */
export async function openNote(page: Page, title: string): Promise<void> {
  await page.getByRole('article').filter({ hasText: title }).click();
  await expect(page.getByTestId('note-editor')).toBeVisible();
}

/**
 * Delete a note from the library view
 */
export async function deleteNoteFromLibrary(page: Page, title: string): Promise<void> {
  const noteCard = page.getByRole('article').filter({ hasText: title });

  // Hover to reveal delete button
  await noteCard.hover();

  // Click delete
  await noteCard.getByRole('button', { name: /delete/i }).click();

  // Wait for undo toast or confirmation
  await expect(page.getByText(/undo/i)).toBeVisible({ timeout: 3000 });
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
 * Search for notes
 */
export async function searchNotes(page: Page, query: string): Promise<void> {
  await page.getByPlaceholder(/search/i).fill(query);
  // Wait for search results to update
  await page.waitForTimeout(500);
}

/**
 * Clear search
 */
export async function clearSearch(page: Page): Promise<void> {
  await page.getByPlaceholder(/search/i).clear();
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

/**
 * Wait for toast message
 */
export async function expectToast(page: Page, message: string | RegExp): Promise<void> {
  await expect(page.getByText(message)).toBeVisible({ timeout: 5000 });
}

/**
 * Get note count in library
 */
export async function getNoteCount(page: Page): Promise<number> {
  const notes = page.getByRole('article');
  return await notes.count();
}

/**
 * Check if note exists in library
 */
export async function noteExists(page: Page, title: string): Promise<boolean> {
  const noteCard = page.getByRole('article').filter({ hasText: title });
  return await noteCard.isVisible();
}
