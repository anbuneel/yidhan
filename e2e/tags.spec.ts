import { test, expect } from './fixtures';
import { goToLibrary, createTag, filterByTag, clearTagFilters } from './fixtures';

const MAX_E2E_TAG_NAME_LENGTH = 18;

// Tag names are capped at 20 characters (MAX_TAG_NAME_LENGTH in
// src/utils/exportImport.ts) and TagModal rejects anything longer, leaving the
// dialog open. A full Date.now() is 13 digits, so build the suffix from the
// last six plus two random characters and throw if a prefix ever grows past
// the headroom.
function uniqueTagName(prefix: string): string {
  const stamp = String(Date.now()).slice(-6);
  const random = Math.random().toString(36).slice(2, 4).padEnd(2, 'x');
  const name = `${prefix}${stamp}${random}`;
  if (name.length > MAX_E2E_TAG_NAME_LENGTH) {
    throw new Error(
      `Tag name "${name}" is ${name.length} characters; this spec allows ${MAX_E2E_TAG_NAME_LENGTH}.`
    );
  }
  return name;
}

test.describe('Tags', () => {
  test.describe('Tag Creation', () => {
    test('creates a new tag', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('Tag');

      await createTag(page, tagName);

      // Tag should appear in filter bar
      await expect(page.getByRole('button', { name: new RegExp(tagName, 'i') })).toBeVisible();
    });

    test('creates tag with custom color', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('ColorTag');

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
      const tagName = uniqueTagName('Duplicate');

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
      const originalName = uniqueTagName('EditTag');
      const newName = uniqueTagName('UpdatedTag');

      await createTag(page, originalName);

      // Hover to show edit button
      const tagPill = page.getByRole('button', { name: new RegExp(originalName, 'i') });
      await tagPill.hover();

      // Click edit
      await page.getByRole('button', { name: 'Edit tag' }).first().click();

      // Update name
      await page.getByPlaceholder(/tag name/i).fill(newName);
      await page.getByRole('button', { name: /save/i }).click();

      // New name should appear
      await expect(page.getByRole('button', { name: new RegExp(newName, 'i') })).toBeVisible();
    });

    test('changes tag color', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('ColorChg');

      await createTag(page, tagName);

      // Edit tag
      const tagPill = page.getByRole('button', { name: new RegExp(tagName, 'i') });
      await tagPill.hover();
      await page.getByRole('button', { name: 'Edit tag' }).first().click();

      // Change color
      await page.getByRole('button', { name: /forest/i }).click();
      await page.getByRole('button', { name: /save/i }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Tag Deletion', () => {
    test('deletes tag', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('DeleteTag');

      await createTag(page, tagName);

      // Edit tag
      const tagPill = page.getByRole('button', { name: new RegExp(tagName, 'i') });
      await tagPill.hover();
      await page.getByRole('button', { name: 'Edit tag' }).first().click();

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
      const tagName = uniqueTagName('FilterTag');
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
      const tagName = uniqueTagName('ClrFilter');

      await createTag(page, tagName);
      await filterByTag(page, tagName);
      await clearTagFilters(page);

      // All Notes should be selected
      await expect(page.getByRole('button', { name: /all notes/i })).toHaveAttribute('aria-pressed', 'true');
    });

    test('filters clear search when activated', async ({ authenticatedPage: page }) => {
      // Create a tag to guarantee a filter button exists
      const tagName = uniqueTagName('FilterClr');
      await createTag(page, tagName);

      // Search for something
      await page.getByPlaceholder(/search/i).first().fill('test');

      // Click the tag filter — this should clear the search
      await filterByTag(page, tagName);

      // Search should be cleared
      await expect(page.getByPlaceholder(/search/i).first()).toHaveValue('');
    });
  });

  test.describe('Tag Assignment', () => {
    test('assigns tag to note in editor', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('AssignTag');
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
      const tagName = uniqueTagName('RemoveTag');
      const noteTitle = `Note Remove Tag ${Date.now()}`;

      await createTag(page, tagName);

      // Create note with tag
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/untitled/i).fill(noteTitle);

      // Add tag — open selector, click tag in dropdown
      await page.getByRole('button', { name: /add tag|tags/i }).click();
      await page.getByRole('button', { name: new RegExp(tagName, 'i') }).click();

      // Close dropdown so we can verify the tag badge independently
      await page.keyboard.press('Escape');

      // Verify tag was added
      await expect(page.getByText(tagName)).toBeVisible();

      // Remove tag — reopen selector (trigger now shows tag name; dropdown is
      // conditionally rendered, so only the trigger matches at this point)
      await page.getByRole('button', { name: new RegExp(tagName, 'i') }).click();
      // Dropdown is now open — two buttons match the tag name (trigger + item).
      // The dropdown item is last in DOM order.
      await page.getByRole('button', { name: new RegExp(tagName, 'i') }).last().click();

      // Close selector
      await page.keyboard.press('Escape');

      // Tag badge should no longer appear on the note
      await expect(page.locator('[data-testid="note-editor"]').getByText(tagName)).not.toBeVisible({ timeout: 3000 });
    });
  });
});
