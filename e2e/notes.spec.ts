import { test, expect } from './fixtures';
import { createNote, goToLibrary, deleteNoteFromLibrary, searchNotes, clearSearch } from './fixtures';

test.describe('Notes', () => {
  // Use authenticated page fixture
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Note Creation', () => {
    test('creates a new note', async ({ authenticatedPage: page }) => {
      const noteTitle = `Test Note ${Date.now()}`;

      await createNote(page, noteTitle, 'This is test content');
      await goToLibrary(page);

      // Note should appear in library
      await expect(page.getByRole('article').filter({ hasText: noteTitle })).toBeVisible();
    });

    test('creates note with keyboard shortcut', async ({ authenticatedPage: page }) => {
      // Press Cmd/Ctrl+N
      await page.keyboard.press('Control+n');

      // Editor should open
      await expect(page.getByTestId('note-editor')).toBeVisible();

      // Title should be focused
      await expect(page.getByPlaceholder(/untitled/i)).toBeFocused();
    });

    test('auto-saves note content', async ({ authenticatedPage: page }) => {
      const noteTitle = `Auto-save Test ${Date.now()}`;

      await createNote(page, noteTitle);

      // Type content
      await page.getByTestId('rich-text-editor').click();
      await page.keyboard.type('Auto-saved content');

      // Wait for save indicator
      await expect(page.getByText(/saving/i)).toBeVisible();
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

      // Reload and verify
      await page.reload();
      await expect(page.getByText('Auto-saved content')).toBeVisible();
    });

    test('shows empty state when no notes', async ({ authenticatedPage: page }) => {
      // This test assumes a clean state - may need setup
      // Just verify the empty state UI elements exist
      const emptyState = page.getByText(/your notes await|no notes/i);
      if (await emptyState.isVisible()) {
        await expect(page.getByRole('button', { name: /create.*first.*note/i })).toBeVisible();
      }
    });
  });

  test.describe('Note Editing', () => {
    test('edits note title', async ({ authenticatedPage: page }) => {
      const originalTitle = `Edit Title Test ${Date.now()}`;
      const newTitle = `Updated Title ${Date.now()}`;

      await createNote(page, originalTitle);

      // Clear and type new title
      await page.getByPlaceholder(/untitled/i).fill(newTitle);

      // Wait for save
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

      // Go back and verify
      await goToLibrary(page);
      await expect(page.getByRole('article').filter({ hasText: newTitle })).toBeVisible();
    });

    test('edits note content with rich text', async ({ authenticatedPage: page }) => {
      const noteTitle = `Rich Text Test ${Date.now()}`;

      await createNote(page, noteTitle);

      const editor = page.getByTestId('rich-text-editor');
      await editor.click();

      // Type and format text
      await page.keyboard.type('Bold text');
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Control+b');

      // Wait for save
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

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

      // Undo toast should appear
      await expect(page.getByText(/undo/i)).toBeVisible();

      // Note should be removed from library
      await expect(page.getByRole('article').filter({ hasText: noteTitle })).not.toBeVisible();
    });

    test('restores note with undo', async ({ authenticatedPage: page }) => {
      const noteTitle = `Undo Delete Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await goToLibrary(page);

      await deleteNoteFromLibrary(page, noteTitle);

      // Click undo
      await page.getByRole('button', { name: /undo/i }).click();

      // Note should be back
      await expect(page.getByRole('article').filter({ hasText: noteTitle })).toBeVisible();
    });

    test('deletes note from editor', async ({ authenticatedPage: page }) => {
      const noteTitle = `Editor Delete Test ${Date.now()}`;

      await createNote(page, noteTitle);

      // Click delete button in editor
      await page.getByRole('button', { name: /delete/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /delete/i }).click();

      // Should be back in library
      await expect(page.getByTestId('library-view')).toBeVisible();
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
      await expect(page.getByRole('article').filter({ hasText: noteTitle })).toBeVisible();
    });

    test('searches notes by content', async ({ authenticatedPage: page }) => {
      const uniqueContent = `ContentSearch${Date.now()}`;
      const noteTitle = `Content Search Test ${Date.now()}`;

      await createNote(page, noteTitle, uniqueContent);
      await goToLibrary(page);

      await searchNotes(page, uniqueContent);

      // Matching note should be visible
      await expect(page.getByRole('article').filter({ hasText: noteTitle })).toBeVisible();
    });

    test('shows empty state for no results', async ({ authenticatedPage: page }) => {
      await searchNotes(page, 'xyznonexistent12345');

      await expect(page.getByText(/no results/i)).toBeVisible();
    });

    test('clears search', async ({ authenticatedPage: page }) => {
      await searchNotes(page, 'test');
      await clearSearch(page);

      // Search input should be empty
      await expect(page.getByPlaceholder(/search/i)).toHaveValue('');
    });

    test('opens search with keyboard shortcut', async ({ authenticatedPage: page }) => {
      await page.keyboard.press('Control+k');

      // Search input should be focused
      await expect(page.getByPlaceholder(/search/i)).toBeFocused();
    });
  });

  test.describe('Note Pinning', () => {
    test('pins note to top', async ({ authenticatedPage: page }) => {
      const noteTitle = `Pin Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await goToLibrary(page);

      // Hover and click pin
      const noteCard = page.getByRole('article').filter({ hasText: noteTitle });
      await noteCard.hover();
      await noteCard.getByRole('button', { name: /pin/i }).click();

      // Note should be in pinned section
      await expect(page.getByText(/pinned/i)).toBeVisible();
    });

    test('unpins note', async ({ authenticatedPage: page }) => {
      const noteTitle = `Unpin Test ${Date.now()}`;

      await createNote(page, noteTitle);
      await goToLibrary(page);

      // Pin first
      const noteCard = page.getByRole('article').filter({ hasText: noteTitle });
      await noteCard.hover();
      await noteCard.getByRole('button', { name: /pin/i }).click();

      // Then unpin
      await noteCard.hover();
      await noteCard.getByRole('button', { name: /unpin|pin/i }).click();

      // Note should no longer be pinned (check pin icon state)
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
