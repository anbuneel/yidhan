import { test, expect, createNote, createTag } from './fixtures';

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

      // Link should appear (format: /?s=token)
      await expect(page.getByText(/\?s=/i)).toBeVisible();
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

      // Create and share note as authenticated user
      await createNote(authenticatedPage, noteTitle, noteContent);
      await authenticatedPage.getByRole('button', { name: /share/i }).click();
      await authenticatedPage.getByRole('button', { name: /create.*link|share/i }).click();

      // Wait for share link to appear and get the token
      await expect(authenticatedPage.getByText(/\?s=/i)).toBeVisible();

      // Get the share URL from the input field
      const shareInput = authenticatedPage.locator('input[readonly]').first();
      const shareUrl = await shareInput.inputValue();

      // Extract the path (e.g., /?s=abc123)
      const url = new URL(shareUrl);
      const sharePath = `${url.pathname}${url.search}`;

      // Close the modal
      await authenticatedPage.keyboard.press('Escape');

      // Open share link in a fresh browser context (simulates incognito/anonymous)
      const browser = page.context().browser();
      const anonymousContext = await browser!.newContext();
      const anonymousPage = await anonymousContext.newPage();

      try {
        await anonymousPage.goto(sharePath);

        // Should see shared note title and content
        await expect(anonymousPage.getByText(noteTitle)).toBeVisible({ timeout: 10000 });
        await expect(anonymousPage.getByText(noteContent)).toBeVisible();

        // Should see "Shared quietly via Yidhan" attribution
        await expect(anonymousPage.getByText(/shared quietly via yidhan/i)).toBeVisible();

        // Should NOT see edit controls (delete button, editor)
        await expect(anonymousPage.getByRole('button', { name: /delete/i })).not.toBeVisible();
        await expect(anonymousPage.getByTestId('note-editor')).not.toBeVisible();

        // Should see theme toggle (public pages have this)
        await expect(anonymousPage.getByRole('button', { name: /toggle theme/i })).toBeVisible();
      } finally {
        await anonymousContext.close();
      }
    });

    test('shared note preserves rich text formatting', async ({ page, authenticatedPage }) => {
      const noteTitle = `Rich Format Share ${Date.now()}`;

      // Create note
      await createNote(authenticatedPage, noteTitle);

      // Add rich text content via Tiptap markdown shortcuts
      const editor = authenticatedPage.getByTestId('rich-text-editor');
      await editor.click();

      // Type a heading (Tiptap input rule: "# " at line start → H1)
      await authenticatedPage.keyboard.type('# A Test Heading');
      await authenticatedPage.keyboard.press('Enter');

      // Type a bullet list item (Tiptap input rule: "- " at line start → bullet)
      await authenticatedPage.keyboard.type('- First bullet point');
      await authenticatedPage.keyboard.press('Enter');
      // Exit list with double Enter
      await authenticatedPage.keyboard.press('Enter');

      // Type a blockquote (Tiptap input rule: "> " at line start → blockquote)
      await authenticatedPage.keyboard.type('> A notable quote');
      await authenticatedPage.keyboard.press('Enter');

      // Wait for auto-save
      await expect(authenticatedPage.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

      // Share the note
      await authenticatedPage.getByRole('button', { name: /share/i }).click();
      await authenticatedPage.getByRole('button', { name: /create.*link|share/i }).click();

      // Get share URL
      await expect(authenticatedPage.getByText(/\?s=/i)).toBeVisible();
      const shareInput = authenticatedPage.locator('input[readonly]').first();
      const shareUrl = await shareInput.inputValue();
      const url = new URL(shareUrl);
      const sharePath = `${url.pathname}${url.search}`;

      // Open in anonymous context
      const browser = page.context().browser();
      if (!browser) throw new Error('Browser instance not available');
      const anonymousContext = await browser.newContext();
      const anonymousPage = await anonymousContext.newPage();

      try {
        await anonymousPage.goto(sharePath);
        await expect(anonymousPage.getByText(noteTitle)).toBeVisible({ timeout: 10000 });

        // Verify the content is wrapped in .ProseMirror for CSS styling
        const proseMirrorWrapper = anonymousPage.locator('.rich-text-editor .ProseMirror');
        await expect(proseMirrorWrapper).toBeVisible();

        // Verify rich text elements are preserved in the DOM
        await expect(proseMirrorWrapper.locator('h1')).toBeVisible();
        await expect(proseMirrorWrapper.locator('ul li')).toBeVisible();
        await expect(proseMirrorWrapper.locator('blockquote')).toBeVisible();
      } finally {
        await anonymousContext.close();
      }
    });

    test('shows faded message for invalid share token', async ({ page }) => {
      // Navigate to a fake/invalid share link
      await page.goto('/?s=invalidtoken12345678901234567890');

      // Should show "This letter has faded" message
      await expect(page.getByText(/this letter has faded/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/expired or been removed/i)).toBeVisible();

      // Should have a button to go to Yidhan
      await expect(page.getByRole('button', { name: /go to yidhan/i })).toBeVisible();
    });

    test('shared note displays tags correctly', async ({ page, authenticatedPage }) => {
      const noteTitle = `Tagged Share ${Date.now()}`;
      const noteContent = 'Note with tags for sharing';
      const tagName = `ShareTag${Date.now()}`;

      // Create a tag to guarantee one exists
      await createTag(authenticatedPage, tagName);

      // Create note
      await createNote(authenticatedPage, noteTitle, noteContent);

      // Assign the tag to the note
      await authenticatedPage.getByRole('button', { name: /add tag|tags/i }).click();
      await authenticatedPage.getByRole('button', { name: new RegExp(tagName, 'i') }).click();
      await authenticatedPage.keyboard.press('Escape');

      // Wait for save
      await expect(authenticatedPage.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

      // Share the note
      await authenticatedPage.getByRole('button', { name: /share/i }).click();
      await authenticatedPage.getByRole('button', { name: /create.*link|share/i }).click();

      // Get share URL
      await expect(authenticatedPage.getByText(/\?s=/i)).toBeVisible();
      const shareInput = authenticatedPage.locator('input[readonly]').first();
      const shareUrl = await shareInput.inputValue();
      const url = new URL(shareUrl);
      const sharePath = `${url.pathname}${url.search}`;

      // View as anonymous user
      const browser = page.context().browser();
      const anonymousContext = await browser!.newContext();
      const anonymousPage = await anonymousContext.newPage();

      try {
        await anonymousPage.goto(sharePath);

        // Should see the note title and content
        await expect(anonymousPage.getByText(noteTitle)).toBeVisible({ timeout: 10000 });
        await expect(anonymousPage.getByText(noteContent)).toBeVisible();

        // Should see the tag displayed on the shared note
        await expect(anonymousPage.getByText(tagName)).toBeVisible();
      } finally {
        await anonymousContext.close();
      }
    });
  });
});
