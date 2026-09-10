import { test as base, expect, Page } from '@playwright/test';

/**
 * E2E Test Fixtures for Yidhan
 * Provides reusable test helpers and page objects
 */

// Test user credentials - MUST be set via environment variables
// Set these in .env.local (git-ignored) or as CI secrets
// See .env.example for documentation
//
// The passphrase is not optional. Every account is end-to-end encrypted, so
// signing in lands on the vault gate, not the library. Without it the fixture
// could sign in and go no further.
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || '',
  password: process.env.E2E_TEST_PASSWORD || '',
  passphrase: process.env.E2E_TEST_PASSPHRASE || '',
  name: 'E2E Test User',
};

// Check if E2E credentials are configured
export const E2E_CREDENTIALS_CONFIGURED = Boolean(
  TEST_USER.email && TEST_USER.password && TEST_USER.passphrase
);

// Extend base test with custom fixtures
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  // Authenticated page fixture - logs in before each test
  // Skips test if E2E credentials are not configured
  authenticatedPage: async ({ page }, use, testInfo) => {
    if (!E2E_CREDENTIALS_CONFIGURED) {
      testInfo.skip(true, 'E2E credentials not configured. Set E2E_TEST_EMAIL, E2E_TEST_PASSWORD and E2E_TEST_PASSPHRASE in .env.local');
      return;
    }
    await loginUser(page, TEST_USER.email, TEST_USER.password);
    await use(page);
  },
});

export { expect };

/**
 * Login helper - navigates to app, signs in, and unlocks the vault.
 *
 * Signing in is not enough to reach the library. Every account is end-to-end
 * encrypted, so `renderAccountGate` stands one of two screens in the way:
 * `PassphraseUnlock` when the vault exists, `PassphraseSetup` when it does not.
 * This walks the unlock; it deliberately refuses to walk the setup.
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string,
  passphrase: string = TEST_USER.passphrase
): Promise<void> {
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

  await unlockVault(page, passphrase);
}

/**
 * Wait out the vault gate after a sign-in, unlocking if asked.
 *
 * Three screens can follow a sign-in, so wait for whichever arrives first rather
 * than guessing. Both passphrase forms carry `id="passphrase"`, so they are told
 * apart by their headings.
 */
async function unlockVault(page: Page, passphrase: string): Promise<void> {
  const library = page.getByTestId('library-view');
  const unlockGate = page.getByRole('heading', { name: 'Unlock Your Notes', exact: true });
  const setupGate = page.getByRole('heading', { name: 'Protect Your Notes', exact: true });

  await expect(library.or(unlockGate).or(setupGate).first()).toBeVisible({ timeout: 15000 });

  // A vault that does not exist yet is a provisioning problem, not a test step.
  // Creating one here would derive a fresh key against whatever passphrase the
  // environment happens to hold, orphaning every note the account already has —
  // and a rerun against a half-provisioned account would do it silently. Fail
  // loudly and let a human create the vault once.
  if (await setupGate.isVisible()) {
    throw new Error(
      'The E2E test account has no vault. Sign in as this account once by hand, ' +
      'create its vault using the passphrase in E2E_TEST_PASSPHRASE, then re-run. ' +
      'The fixture will not create the vault: doing so on a half-provisioned ' +
      'account would silently create a second one and strand the existing notes.'
    );
  }

  if (await unlockGate.isVisible()) {
    if (!passphrase) {
      throw new Error(
        'The vault is locked but E2E_TEST_PASSPHRASE is not set. Set it in ' +
        '.env.local (locally) or as a repository secret (CI).'
      );
    }

    await page.getByLabel('Passphrase', { exact: true }).fill(passphrase);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();

    // Argon2id at 64 MB and 3 iterations is seconds of work in wasm, and a wrong
    // passphrase surfaces as the unlock form simply staying put.
    await expect(unlockGate).toBeHidden({ timeout: 20000 });
  }

  await expect(library).toBeVisible({ timeout: 15000 });
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
  await expect(page.getByRole('button', { name: /^try writing$/i }).first()).toBeVisible();
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

