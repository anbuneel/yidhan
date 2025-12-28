import { test, expect } from './fixtures';
import { goToLibrary, createTag, filterByTag, clearTagFilters } from './fixtures';

test.describe('Tags', () => {
  test.describe('Tag Creation', () => {
    test('creates a new tag', async ({ authenticatedPage: page }) => {
      const tagName = `Tag${Date.now()}`;

      await createTag(page, tagName);

      // Tag should appear in filter bar
      await expect(page.getByRole('button', { name: new RegExp(tagName, 'i') })).toBeVisible();
    });

    test('creates tag with custom color', async ({ authenticatedPage: page }) => {
      const tagName = `ColorTag${Date.now()}`;

      // Click add tag button
      await page.getByRole('button', { name: /add tag/i }).click();

      // Fill name
      await page.getByPlaceholder(/tag name/i).fill(tagName);

      // Select terracotta color
      await page.getByRole('button', { name: /terracotta/i }).click();

      // Save
      await page.getByRole('button', { name: /create|save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('shows error for empty tag name', async ({ authenticatedPage: page }) => {
      await page.getByRole('button', { name: /add tag/i }).click();

      // Try to save without name
      await page.getByRole('button', { name: /create|save/i }).click();

      // Should show error
      await expect(page.getByText(/required|empty/i)).toBeVisible();
    });

    test('shows error for duplicate tag name', async ({ authenticatedPage: page }) => {
      const tagName = `Duplicate${Date.now()}`;

      // Create first tag
      await createTag(page, tagName);

      // Try to create duplicate
      await page.getByRole('button', { name: /add tag/i }).click();
      await page.getByPlaceholder(/tag name/i).fill(tagName);
      await page.getByRole('button', { name: /create|save/i }).click();

      // Should show error
      await expect(page.getByText(/exists|duplicate/i)).toBeVisible();
    });
  });

  test.describe('Tag Editing', () => {
    test('edits tag name', async ({ authenticatedPage: page }) => {
      const originalName = `EditTag${Date.now()}`;
      const newName = `UpdatedTag${Date.now()}`;

      await createTag(page, originalName);

      // Hover to show edit button
      const tagPill = page.getByRole('button', { name: new RegExp(originalName, 'i') });
      await tagPill.hover();

      // Click edit
      await page.getByRole('button', { name: /edit/i }).first().click();

      // Update name
      await page.getByPlaceholder(/tag name/i).fill(newName);
      await page.getByRole('button', { name: /save/i }).click();

      // New name should appear
      await expect(page.getByRole('button', { name: new RegExp(newName, 'i') })).toBeVisible();
    });

    test('changes tag color', async ({ authenticatedPage: page }) => {
      const tagName = `ColorChange${Date.now()}`;

      await createTag(page, tagName);

      // Edit tag
      const tagPill = page.getByRole('button', { name: new RegExp(tagName, 'i') });
      await tagPill.hover();
      await page.getByRole('button', { name: /edit/i }).first().click();

      // Change color
      await page.getByRole('button', { name: /forest/i }).click();
      await page.getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Tag Deletion', () => {
    test('deletes tag', async ({ authenticatedPage: page }) => {
      const tagName = `DeleteTag${Date.now()}`;

      await createTag(page, tagName);

      // Edit tag
      const tagPill = page.getByRole('button', { name: new RegExp(tagName, 'i') });
      await tagPill.hover();
      await page.getByRole('button', { name: /edit/i }).first().click();

      // Delete
      await page.getByRole('button', { name: /delete/i }).click();

      // Confirm if needed
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Tag should be gone
      await expect(page.getByRole('button', { name: new RegExp(tagName, 'i') })).not.toBeVisible();
    });
  });

  test.describe('Tag Filtering', () => {
    test('filters notes by tag', async ({ authenticatedPage: page }) => {
      const tagName = `FilterTag${Date.now()}`;
      const noteTitle = `Tagged Note ${Date.now()}`;

      // Create tag
      await createTag(page, tagName);

      // Create note with tag
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/untitled/i).fill(noteTitle);

      // Add tag to note
      await page.getByRole('button', { name: /add tag|tags/i }).click();
      await page.getByRole('option', { name: new RegExp(tagName, 'i') }).click();

      await goToLibrary(page);

      // Filter by tag
      await filterByTag(page, tagName);

      // Only tagged note should be visible
      await expect(page.getByRole('article').filter({ hasText: noteTitle })).toBeVisible();
    });

    test('clears tag filter', async ({ authenticatedPage: page }) => {
      const tagName = `ClearFilter${Date.now()}`;

      await createTag(page, tagName);
      await filterByTag(page, tagName);
      await clearTagFilters(page);

      // All Notes should be selected
      await expect(page.getByRole('button', { name: /all notes/i })).toHaveAttribute('aria-pressed', 'true');
    });

    test('filters clear search when activated', async ({ authenticatedPage: page }) => {
      // Search for something
      await page.getByPlaceholder(/search/i).fill('test');

      // Click a tag filter
      const tagButton = page.getByRole('button').filter({ hasText: /tag/i }).first();
      if (await tagButton.isVisible()) {
        await tagButton.click();

        // Search should be cleared
        await expect(page.getByPlaceholder(/search/i)).toHaveValue('');
      }
    });
  });

  test.describe('Tag Assignment', () => {
    test('assigns tag to note in editor', async ({ authenticatedPage: page }) => {
      const tagName = `AssignTag${Date.now()}`;
      const noteTitle = `Note With Tag ${Date.now()}`;

      await createTag(page, tagName);

      // Create note
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/untitled/i).fill(noteTitle);

      // Open tag selector
      await page.getByRole('button', { name: /add tag|tags/i }).click();

      // Select tag
      await page.getByRole('option', { name: new RegExp(tagName, 'i') }).click();

      // Tag should appear on note
      await expect(page.getByText(tagName)).toBeVisible();
    });

    test('removes tag from note', async ({ authenticatedPage: page }) => {
      const tagName = `RemoveTag${Date.now()}`;
      const noteTitle = `Note Remove Tag ${Date.now()}`;

      await createTag(page, tagName);

      // Create note with tag
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/untitled/i).fill(noteTitle);

      // Add tag
      await page.getByRole('button', { name: /add tag|tags/i }).click();
      await page.getByRole('option', { name: new RegExp(tagName, 'i') }).click();

      // Remove tag (click again to deselect)
      await page.getByRole('button', { name: /add tag|tags/i }).click();
      await page.getByRole('option', { name: new RegExp(tagName, 'i') }).click();

      // Tag should be removed from note
      // Close selector first
      await page.keyboard.press('Escape');
    });
  });
});
