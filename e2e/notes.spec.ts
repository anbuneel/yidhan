import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  createNote,
  goToLibrary,
  deleteNoteFromLibrary,
  searchNotes,
  clearSearch,
  editAndWaitForSave,
  noteCard,
} from './fixtures';

/** The library's "Pinned" chapter, labelled "Pinned - N note(s)". */
function pinnedSection(page: Page) {
  return page.getByTestId('library-view').getByRole('region', { name: /^Pinned - \d+ notes?$/ });
}

test.describe('Notes', () => {
  // Use authenticated page fixture
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Note Creation', () => {
    test('creates a new note', async ({ authenticatedPage: page }) => {
      const noteTitle = `Test Note ${Date.now()}`;

      await createNote(page, noteTitle, 'This is test content');
      await goToLibrary(page);

      // Note should appear in library
      await expect(noteCard(page, noteTitle)).toBeVisible();
    });

    test('creates note with keyboard shortcut', async ({ authenticatedPage: page }) => {
      // Press Cmd/Ctrl+N
      await page.keyboard.press('Control+n');

      // Editor should open
      await expect(page.getByTestId('note-editor')).toBeVisible();
      await expect(page.getByTestId('demo-editor-notice')).toHaveCount(0);
      await expect(page.getByText(/not encrypted/i)).toHaveCount(0);

      // Title should be focused
      await expect(page.getByPlaceholder(/untitled/i)).toBeFocused();
    });

    test('auto-saves note content', async ({ authenticatedPage: page }) => {
      const noteTitle = `Auto-save Test ${Date.now()}`;

      await createNote(page, noteTitle);

      // Type content and wait for the save it starts
      await editAndWaitForSave(page, async () => {
        await page.getByTestId('rich-text-editor').click();
        await page.keyboard.type('Auto-saved content');
      });

      // Small delay to ensure save is persisted before reload
      await page.waitForTimeout(500);

      // Reload. A refresh keeps the writer in the editor, on the same note.
      await page.reload();
      await expect(page.getByTestId('note-editor')).toBeVisible({ timeout: 10000 });
      await expect(page.getByPlaceholder(/untitled/i)).toHaveValue(noteTitle);
      await expect(
        page.getByTestId('rich-text-editor').getByText('Auto-saved content', { exact: true }),
      ).toBeVisible({ timeout: 5000 });

      // And the saved note opens again from the library
      await goToLibrary(page);
      await noteCard(page, noteTitle)
        .getByRole('button', { name: `Open note: ${noteTitle}`, exact: true })
        .click();
      await expect(page.getByTestId('note-editor')).toBeVisible();
      await expect(
        page.getByTestId('rich-text-editor').getByText('Auto-saved content', { exact: true }),
      ).toBeVisible({ timeout: 5000 });
    });

    test('shows empty state when no notes', async ({ authenticatedPage: page }) => {
      // This test depends on the account having no notes — skip explicitly if notes exist
      const emptyState = page.getByText(/your notes await|no notes/i);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      test.skip(!hasEmptyState, 'Account has existing notes — cannot test empty state');

      await expect(page.getByRole('button', { name: /create.*first.*note/i })).toBeVisible();
    });
  });

  test.describe('Note Editing', () => {
    test('edits note title', async ({ authenticatedPage: page }) => {
      const originalTitle = `Edit Title Test ${Date.now()}`;
      const newTitle = `Updated Title ${Date.now()}`;

      await createNote(page, originalTitle);

      // Replace the title and wait for the save it starts
      await editAndWaitForSave(page, async () => {
        await page.getByPlaceholder(/untitled/i).fill(newTitle);
      });

      // Small delay to ensure save is persisted
      await page.waitForTimeout(500);

      // Go back and verify
      await goToLibrary(page);
      await expect(noteCard(page, newTitle)).toBeVisible({ timeout: 5000 });
    });

    test('edits note content with rich text', async ({ authenticatedPage: page }) => {
      const noteTitle = `Rich Text Test ${Date.now()}`;

      await createNote(page, noteTitle);

      const editor = page.getByTestId('rich-text-editor');

      // Type and format text, then wait for the save it starts
      await editAndWaitForSave(page, async () => {
        await editor.click();
        await page.keyboard.type('Bold text');
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Control+b');
      });

      // Verify bold formatting is applied
      await expect(editor.locator('strong')).toBeVisible();
    });

    test('uses slash commands', async ({ authenticatedPage: page }) => {
      const noteTitle = `Slash Command Test ${Date.now()}`;

      await createNote(page, noteTitle);

      const editor = page.getByTestId('rich-text-editor');
      await editor.click();

      // Type slash command
      await page.keyboard.type('/h1');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Heading Text');

      // Verify heading is created
      await expect(editor.locator('h1')).toBeVisible();
    });

    test('navigates back with Escape key', async ({ authenticatedPage: page }) => {
      const noteTitle = `Escape Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await page.keyboard.press('Escape');

      // Should be back in library
      await expect(page.getByTestId('library-view')).toBeVisible();
    });
  });

  test.describe('Note Deletion', () => {
    test('soft deletes note with undo option', async ({ authenticatedPage: page }) => {
      const noteTitle = `Delete Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await goToLibrary(page);

      await deleteNoteFromLibrary(page, noteTitle);

      // Undo button should appear in toast (use exact match to avoid note titles)
      await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();

      // Note should be removed from library
      await expect(noteCard(page, noteTitle)).not.toBeVisible();
    });

    test('restores note with undo', async ({ authenticatedPage: page }) => {
      const noteTitle = `Restore Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await goToLibrary(page);

      await deleteNoteFromLibrary(page, noteTitle);

      // Click undo button (use exact match)
      await page.getByRole('button', { name: 'Undo', exact: true }).click();

      // Note should be back
      await expect(noteCard(page, noteTitle)).toBeVisible();
    });

    test('deletes note from editor', async ({ authenticatedPage: page }) => {
      const noteTitle = `Editor Delete Test ${Date.now()}`;

      await createNote(page, noteTitle);

      // Click delete button in editor header
      await page.getByRole('button', { name: 'Delete note', exact: true }).click();

      // Confirm deletion in dialog
      const dialog = page.getByRole('alertdialog', { name: 'Let this note fade?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Let it fade', exact: true }).click();

      // Should be back in library, without the note
      await expect(page.getByTestId('library-view')).toBeVisible();
      await expect(noteCard(page, noteTitle)).toHaveCount(0);
    });
  });

  test.describe('Note Search', () => {
    test('searches notes by title', async ({ authenticatedPage: page }) => {
      const uniqueWord = `Unique${Date.now()}`;
      const noteTitle = `Search Test ${uniqueWord}`;

      await createNote(page, noteTitle, 'Search content');
      await goToLibrary(page);

      await searchNotes(page, uniqueWord);

      // Only matching note should be visible
      await expect(noteCard(page, noteTitle)).toBeVisible();
    });

    test('searches notes by content', async ({ authenticatedPage: page }) => {
      const uniqueContent = `ContentSearch${Date.now()}`;
      const noteTitle = `Content Search Test ${Date.now()}`;

      await createNote(page, noteTitle, uniqueContent);
      await goToLibrary(page);

      await searchNotes(page, uniqueContent);

      // Matching note should be visible
      await expect(noteCard(page, noteTitle)).toBeVisible();
    });

    test('shows empty state for no results', async ({ authenticatedPage: page }) => {
      await searchNotes(page, 'xyznonexistent12345');

      // Search-empty copy, distinct from the library-empty state
      await expect(page.getByText('No thoughts found', { exact: true })).toBeVisible();
    });

    test('clears search', async ({ authenticatedPage: page }) => {
      await searchNotes(page, 'test');
      await clearSearch(page);

      // Search input should be empty (use first() for desktop/mobile)
      await expect(page.getByPlaceholder(/search/i).first()).toHaveValue('');
    });

    // Note: Ctrl+Shift+K keyboard shortcut may not work reliably in headless browser
    // Testing click-to-focus instead
    test('focuses search when clicked', async ({ authenticatedPage: page }) => {
      // Ensure we're on the library page
      await expect(page.getByTestId('library-view')).toBeVisible();

      // Click search input to focus
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.click();

      // Search input should be focused
      await expect(searchInput).toBeFocused();
    });
  });

  test.describe('Note Pinning', () => {
    test('pins note to top', async ({ authenticatedPage: page }) => {
      const noteTitle = `Pin Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await goToLibrary(page);

      // Hover and click pin
      const card = noteCard(page, noteTitle);
      await card.hover();
      await card.getByRole('button', { name: 'Pin note', exact: true }).click();

      // Note should be in the pinned section
      await expect(
        pinnedSection(page).getByRole('group', { name: `Note: ${noteTitle}`, exact: true }),
      ).toBeVisible();
      await expect(card.getByRole('button', { name: 'Unpin note', exact: true })).toBeVisible();
    });

    test('unpins note', async ({ authenticatedPage: page }) => {
      const noteTitle = `Unpin Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await goToLibrary(page);

      // Pin first
      const card = noteCard(page, noteTitle);
      await card.hover();
      await card.getByRole('button', { name: 'Pin note', exact: true }).click();

      // Verify it is in the pinned section
      const pinnedCard = pinnedSection(page).getByRole('group', {
        name: `Note: ${noteTitle}`,
        exact: true,
      });
      await expect(pinnedCard).toBeVisible();

      // Then unpin
      await card.hover();
      await card.getByRole('button', { name: 'Unpin note', exact: true }).click();

      // The card leaves the pinned section and offers Pin again
      await expect(pinnedCard).toHaveCount(0, { timeout: 3000 });
      await expect(card.getByRole('button', { name: 'Unpin note', exact: true })).toHaveCount(0);
      await expect(card.getByRole('button', { name: 'Pin note', exact: true })).toBeVisible();
    });
  });

  test.describe('Faded Notes', () => {
    test('accesses faded notes view', async ({ authenticatedPage: page }) => {
      // Open avatar menu
      await page.getByTestId('avatar-button').click();

      // Click Faded Notes
      await page.getByRole('menuitem', { name: /faded/i }).click();

      // Should be on faded notes page
      await expect(page.getByRole('heading', { name: /faded/i })).toBeVisible();
    });
  });
});
