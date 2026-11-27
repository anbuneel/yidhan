import { test, expect } from './fixtures';
import { goToLibrary, createTag, filterByTag, clearTagFilters, noteCard } from './fixtures';

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

    test('creates a tag from a name alone, with no colour picker', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('NameOnly');

      // Click add tag button
      await page.getByRole('button', { name: /add tag/i }).click();

      // Fill name
      await page.getByPlaceholder(/tag name/i).fill(tagName);
      await expect(page.getByRole('button', { name: /terracotta/i })).toHaveCount(0);

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

      // Should show error, in the dialog (the tag's own filter button also says "Duplicate")
      await expect(page.getByRole('dialog').getByText('A tag with this name already exists')).toBeVisible();
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

    // Tags lost their colour in the UI in #279; an edit keeps the stored colour.
    // Check that the edit dialog offers no colour picker and still saves.
    test('edits a tag with no colour picker', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('ColorChg');

      await createTag(page, tagName);

      // Edit tag
      const tagPill = page.getByRole('button', { name: new RegExp(tagName, 'i') });
      await tagPill.hover();
      await page.getByRole('button', { name: 'Edit tag' }).first().click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('button', { name: /forest|terracotta/i })).toHaveCount(0);
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

      // Delete. TagModal has no confirm step. Scoped to the dialog: a note card's
      // "Open note: ... delete ..." button would match /delete/ too.
      await page.getByRole('dialog').getByRole('button', { name: 'Delete tag', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

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
      await page.getByRole('button', { name: new RegExp(tagName, 'i') }).click();

      await goToLibrary(page);

      // Filter by tag
      await filterByTag(page, tagName);

      // Only tagged note should be visible
      await expect(noteCard(page, noteTitle)).toBeVisible();
    });

    test('clears tag filter', async ({ authenticatedPage: page }) => {
      const tagName = uniqueTagName('ClrFilter');

      await createTag(page, tagName);
      await filterByTag(page, tagName);
      await clearTagFilters(page);

      // All Notes should be selected
      await expect(page.getByRole('button', { name: /all notes/i })).toHaveAttribute('aria-pressed', 'true');
    });

    // A tag filter keeps the search query on purpose (useTagActions: the notes are
    // re-filtered by both). The old test expected the search to clear.
    test('a tag filter keeps the search query', async ({ authenticatedPage: page }) => {
      // Create a tag to guarantee a filter button exists
      const tagName = uniqueTagName('FilterClr');
      await createTag(page, tagName);

      // Search for something
      await page.getByPlaceholder(/search/i).first().fill('test');

      await filterByTag(page, tagName);

      await expect(page.getByRole('button', { name: `Filter by ${tagName}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByPlaceholder(/search/i).first()).toHaveValue('test');
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
      await page.getByRole('button', { name: new RegExp(tagName, 'i') }).click();

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
