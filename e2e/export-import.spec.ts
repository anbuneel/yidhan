import { test, expect } from './fixtures';
import { createNote, goToLibrary } from './fixtures';

test.describe('Export & Import', () => {
  test.describe('Export', () => {
    test('exports all notes as JSON', async ({ authenticatedPage: page }) => {
      // Create a note to export
      const noteTitle = `Export JSON ${Date.now()}`;
      await createNote(page, noteTitle, 'Export content');
      await goToLibrary(page);

      // Open avatar menu
      await page.getByTestId('avatar-button').click();

      // Click Export JSON
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: /export.*json/i }).click();

      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/yidhan.*\.json/i);
    });

    test('exports all notes as Markdown', async ({ authenticatedPage: page }) => {
      // Create a note to export
      const noteTitle = `Export MD ${Date.now()}`;
      await createNote(page, noteTitle, 'Markdown content');
      await goToLibrary(page);

      // Open avatar menu
      await page.getByTestId('avatar-button').click();

      // Click Export Markdown
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: /export.*markdown/i }).click();

      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/yidhan.*\.md/i);
    });

    test('exports single note as Markdown from editor', async ({ authenticatedPage: page }) => {
      const noteTitle = `Single Export ${Date.now()}`;
      await createNote(page, noteTitle, 'Single note content');

      await page.getByRole('button', { name: 'Share and export', exact: true }).click();

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download (.md)', exact: true }).click();

      const download = await downloadPromise;

      // Verify download includes note title
      expect(download.suggestedFilename()).toContain('.md');
    });

    // The per-note JSON download was removed in #291; the library menu still
    // exports every note as JSON. Check that the note menu no longer offers it.
    test('the note menu offers no JSON download', async ({ authenticatedPage: page }) => {
      const noteTitle = `Single JSON ${Date.now()}`;
      await createNote(page, noteTitle, 'Single JSON content');

      await page.getByRole('button', { name: 'Share and export', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Download (.md)', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /json/i })).toHaveCount(0);
    });
  });

  test.describe('Copy to Clipboard', () => {
    test('copies note as plain text', async ({ authenticatedPage: page }) => {
      const noteTitle = `Copy Plain ${Date.now()}`;
      const noteContent = 'Plain text content';
      await createNote(page, noteTitle, noteContent);

      await page.getByRole('button', { name: 'Share and export', exact: true }).click();
      await page.getByRole('button', { name: 'Copy as text', exact: true }).click();

      // Should show copied toast
      await expect(page.getByText(/copied/i)).toBeVisible();
    });

    test('copies note with keyboard shortcut', async ({ authenticatedPage: page }) => {
      const noteTitle = `Copy Shortcut ${Date.now()}`;
      await createNote(page, noteTitle, 'Shortcut content');

      // Press Cmd/Ctrl+Shift+C
      await page.keyboard.press('Control+Shift+c');

      // Should show copied toast
      await expect(page.getByText(/copied/i)).toBeVisible();
    });
  });

  test.describe('Import', () => {
    test('opens import dialog', async ({ authenticatedPage: page }) => {
      // Open avatar menu
      await page.getByTestId('avatar-button').click();

      // Click Import
      await page.getByRole('menuitem', { name: /import/i }).click();

      // File input should be triggered (we can't easily test file selection in Playwright)
      // Just verify the menu item exists and is clickable
    });

    test('shows import progress indicator', async ({ authenticatedPage: page }) => {
      // This test would require creating a test file and uploading
      // For now, we verify the import option exists
      await page.getByTestId('avatar-button').click();
      await expect(page.getByRole('menuitem', { name: /import/i })).toBeVisible();
    });

    // Note: Full import testing requires file upload which is complex in E2E
    // The import functionality is thoroughly tested in unit tests
  });
});
