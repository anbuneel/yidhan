import { test, expect } from './fixtures';
import { createNote } from './fixtures';

test.describe('Share as Letter', () => {
  test.describe('Share Creation', () => {
    test('creates share link for note', async ({ authenticatedPage: page }) => {
      const noteTitle = `Share Test ${Date.now()}`;

      await createNote(page, noteTitle, 'Content to share');

      // Click share button
      await page.getByRole('button', { name: /share/i }).click();

      // Share modal should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/share as letter/i)).toBeVisible();

      // Create share
      await page.getByRole('button', { name: /create.*link|share/i }).click();

      // Link should appear
      await expect(page.getByText(/zenote\.vercel\.app\/s\//i)).toBeVisible();
    });

    test('creates share with 7-day expiration', async ({ authenticatedPage: page }) => {
      const noteTitle = `Expiring Share ${Date.now()}`;

      await createNote(page, noteTitle, 'Expiring content');

      await page.getByRole('button', { name: /share/i }).click();

      // Select 7 days
      await page.getByRole('combobox').selectOption('7');

      // Create share
      await page.getByRole('button', { name: /create.*link|share/i }).click();

      // Should show expiration info
      await expect(page.getByText(/7 days|expires/i)).toBeVisible();
    });

    test('creates share that never expires', async ({ authenticatedPage: page }) => {
      const noteTitle = `Permanent Share ${Date.now()}`;

      await createNote(page, noteTitle, 'Permanent content');

      await page.getByRole('button', { name: /share/i }).click();

      // Select never
      await page.getByRole('combobox').selectOption('never');

      // Create share
      await page.getByRole('button', { name: /create.*link|share/i }).click();

      // Should show never expires
      await expect(page.getByText(/never expires/i)).toBeVisible();
    });
  });

  test.describe('Share Link Management', () => {
    test('copies share link to clipboard', async ({ authenticatedPage: page }) => {
      const noteTitle = `Copy Link Test ${Date.now()}`;

      await createNote(page, noteTitle, 'Copy me');

      await page.getByRole('button', { name: /share/i }).click();
      await page.getByRole('button', { name: /create.*link|share/i }).click();

      // Click copy button
      await page.getByRole('button', { name: /copy/i }).click();

      // Should show copied confirmation
      await expect(page.getByText(/copied/i)).toBeVisible();
    });

    test('updates share expiration', async ({ authenticatedPage: page }) => {
      const noteTitle = `Update Expiry ${Date.now()}`;

      await createNote(page, noteTitle, 'Update expiry');

      // Create share
      await page.getByRole('button', { name: /share/i }).click();
      await page.getByRole('button', { name: /create.*link|share/i }).click();

      // Change expiration
      await page.getByRole('combobox').selectOption('30');

      // Should update
      await expect(page.getByText(/30 days/i)).toBeVisible();
    });

    test('revokes share link', async ({ authenticatedPage: page }) => {
      const noteTitle = `Revoke Share ${Date.now()}`;

      await createNote(page, noteTitle, 'Revoke me');

      // Create share
      await page.getByRole('button', { name: /share/i }).click();
      await page.getByRole('button', { name: /create.*link|share/i }).click();

      // Revoke
      await page.getByRole('button', { name: /revoke|remove/i }).click();

      // Confirm if needed
      const confirmButton = page.getByRole('button', { name: /confirm|yes|revoke/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Should show create button again
      await expect(page.getByRole('button', { name: /create.*link|share/i })).toBeVisible();
    });
  });

  test.describe('Shared Note View', () => {
    test('views shared note as anonymous user', async ({ page, authenticatedPage }) => {
      const noteTitle = `View Share ${Date.now()}`;
      const noteContent = 'Shared content visible to all';

      // Create and share note
      await createNote(authenticatedPage, noteTitle, noteContent);
      await authenticatedPage.getByRole('button', { name: /share/i }).click();
      await authenticatedPage.getByRole('button', { name: /create.*link|share/i }).click();

      // Get the share link
      const linkText = await authenticatedPage.getByText(/zenote\.vercel\.app\/s\//i).textContent();
      const shareUrl = linkText?.match(/https?:\/\/[^\s]+/)?.[0];

      if (shareUrl) {
        // Open share link in incognito context (new page without auth)
        await page.goto(shareUrl.replace('https://zenote.vercel.app', ''));

        // Should see shared note
        await expect(page.getByText(noteTitle)).toBeVisible();
        await expect(page.getByText(noteContent)).toBeVisible();

        // Should be read-only (no edit controls)
        await expect(page.getByRole('button', { name: /delete/i })).not.toBeVisible();
      }
    });

    test('shows expired message for expired share', async ({ page }) => {
      // Navigate to a fake expired share link
      await page.goto('/s/expiredtoken12345');

      // Should show expired or not found message
      await expect(page.getByText(/expired|not found|unavailable/i)).toBeVisible();
    });
  });
});
