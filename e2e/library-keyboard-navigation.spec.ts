import { test as publicTest, expect } from '@playwright/test';
import { test as authenticatedTest } from './fixtures';
import { createNote, goToLibrary } from './fixtures';

async function createPracticeNote(page: import('@playwright/test').Page, title: string) {
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await page.getByPlaceholder(/untitled/i).fill(title);
  await page.getByRole('button', { name: /yidhan/i }).click();
  await expect(page.getByTestId('library-view')).toBeVisible();
}

publicTest.describe('Library keyboard navigation in Practice Space', () => {
  publicTest('moves, opens, and visibly focuses cards without an account', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();
    await createPracticeNote(page, 'Keyboard practice one');
    await createPracticeNote(page, 'Keyboard practice two');

    const openControls = page.getByRole('button', { name: /Open note:/ });
    await expect.poll(async () => openControls.count()).toBeGreaterThanOrEqual(2);
    const firstCard = openControls.nth(0).locator('..');
    const secondCard = openControls.nth(1).locator('..');

    await page.keyboard.press('ArrowDown');
    await expect(firstCard).toBeFocused();
    await expect(firstCard).toHaveClass(/focus:ring-2/);

    await page.keyboard.press('j');
    await expect(secondCard).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('note-editor')).toBeVisible();
  });
});

authenticatedTest.describe('Library keyboard card actions', () => {
  authenticatedTest.use({ storageState: { cookies: [], origins: [] } });

  authenticatedTest('pins then fades the selected card with undo', async ({ authenticatedPage: page }) => {
    const title = `Keyboard action ${Date.now()}`;
    await createNote(page, title);
    await goToLibrary(page);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('p');
    await expect(page.getByRole('button', { name: 'Unpin note' })).toBeVisible();

    await page.keyboard.press('Delete');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  });
});
