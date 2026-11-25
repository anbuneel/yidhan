import { test, expect } from '@playwright/test';

/**
 * Launch review Track C (B2): Modal dialogs hold keyboard focus, mark the page behind
 * inert, and return focus to the control that opened them on close.
 *
 * Runs against the Practice Space (`/demo`), which needs no account credentials so
 * it runs in CI on every PR.
 */
test.describe('Dialog focus containment (B2)', () => {
  test('Sign-in modal traps Tab and Shift+Tab, keeps background inert, and returns focus on Escape', async ({
    page,
  }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();

    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await signInButton.focus();
    await signInButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Background controls behind the modal must be inert.
    const newNoteInert = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newNote = buttons.find((b) => b.textContent?.trim() === 'New note');
      return Boolean(newNote?.closest('[inert]'));
    });
    expect(newNoteInert).toBe(true);

    // Tab forward many times: activeElement must never leave the dialog.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    // Shift+Tab backward many times: activeElement must never leave the dialog.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Shift+Tab');
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    // Escape closes the modal and returns focus to the Sign in button that opened it.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(signInButton).toBeFocused();
  });

  test('Nested Discard confirmation inside Auth holds focus and returns focus into Auth on Escape', async ({
    page,
  }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();

    await page.getByRole('button', { name: 'Sign in' }).click();
    const authDialog = page.locator('dialog.auth-modal-content');
    await expect(authDialog).toBeVisible();

    await authDialog.getByRole('textbox', { name: /email/i }).fill('reader@example.com');
    const closeAuthButton = authDialog.getByRole('button', { name: 'Close' });
    await closeAuthButton.click();

    // Discard confirmation is now the active modal; Auth behind it is inert.
    const confirmDialog = page.getByRole('dialog', { name: 'Discard changes?' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
    await expect(authDialog).toHaveAttribute('inert', '');

    // Tab wraps between Keep editing and Discard without escaping.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inside = await confirmDialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    // Escape closes only the confirmation and returns focus inside Auth.
    await page.keyboard.press('Escape');
    await expect(confirmDialog).toBeHidden();
    await expect(authDialog).toBeVisible();
    await expect(authDialog).not.toHaveAttribute('inert');
    await expect(closeAuthButton).toBeFocused();
  });

  test('TagModal focuses input, holds Tab inside, and returns focus to + Tag on Escape', async ({
    page,
  }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();

    const addTagButton = page.getByRole('button', { name: /add tag|\+ tag/i });
    await addTagButton.focus();
    await addTagButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name')).toBeFocused();

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(addTagButton).toBeFocused();
  });
});
