import { expect, test } from '@playwright/test';

const commandIds = [
  'bold', 'italic', 'underline', 'strike', 'inlineCode', 'link', 'highlight',
  'paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList',
  'taskList', 'blockquote', 'codeBlock', 'horizontalRule', 'alignLeft',
  'alignCenter', 'alignRight', 'alignJustify', 'date', 'time', 'now', 'undo',
  'redo', 'findReplace', 'smartTypography', 'focusMode',
] as const;

async function openBlankPracticeNote(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/demo');
  await expect(page.getByRole('button', { name: 'New note', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await expect(page.getByTestId('note-editor')).toBeVisible();
}

test.describe('editor fluency', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('every editor command is mouse-reachable from 320px through 1920px', async ({ page }) => {
    await openBlankPracticeNote(page);

    for (const width of [320, 768, 1100, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const surface = width < 768
        ? page.locator('.editor-toolbar-bottom')
        : page.locator('.editor-toolbar-inline');
      await expect(surface).toBeVisible();
      await surface.getByRole('button', { name: 'More editor commands' }).click();
      const menu = surface.getByRole('menu', { name: 'All editor commands' });
      await expect(menu).toBeVisible();

      for (const commandId of commandIds) {
        const command = menu.locator(`[data-command-id="${commandId}"]`);
        await command.scrollIntoViewIfNeeded();
        await expect(command).toBeVisible();
      }

      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
    }
  });

  test('find and replace stays available in focus mode and replace-all undoes once', async ({ page }) => {
    await openBlankPracticeNote(page);
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('alpha beta alpha');
    await page.keyboard.press('Control+Shift+f');
    await expect(page.getByText('Focus mode on')).toBeAttached();

    await page.keyboard.press('Control+f');
    const panel = page.getByRole('region', { name: 'Find and replace' });
    await expect(panel).toBeVisible();
    await panel.getByPlaceholder('Find').fill('alpha');
    await expect(editor.locator('.editor-find-match')).toHaveCount(2);
    await panel.getByPlaceholder('Replace with').fill('omega');
    await panel.getByRole('button', { name: 'Replace all' }).click();
    await expect(editor).toContainText('omega beta omega');

    await panel.getByRole('button', { name: 'Close find and replace' }).click();
    await editor.click();
    await page.keyboard.press('Control+z');
    await expect(editor).toContainText('alpha beta alpha');
    await expect(editor).not.toContainText('omega');
  });

  test('slash menu flips inside a 390px viewport, follows scroll, and can reopen after Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await openBlankPracticeNote(page);
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    for (let line = 0; line < 24; line += 1) {
      await page.keyboard.type(`Line ${line}`);
      await page.keyboard.press('Enter');
    }
    await page.getByTestId('note-editor').evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.keyboard.type('/');

    const popup = page.locator('[data-editor-popover="slash"]');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute('data-placement', 'above');
    const before = await popup.boundingBox();
    expect(before).not.toBeNull();
    expect(before!.x).toBeGreaterThanOrEqual(0);
    expect(before!.y).toBeGreaterThanOrEqual(0);
    expect(before!.x + before!.width).toBeLessThanOrEqual(390);
    expect(before!.y + before!.height).toBeLessThanOrEqual(600);

    await page.getByTestId('note-editor').evaluate((element) => { element.scrollTop -= 32; });
    await expect.poll(async () => (await popup.boundingBox())?.y).not.toBe(before!.y);
    const after = await popup.boundingBox();
    expect(after!.y).toBeGreaterThanOrEqual(0);
    expect(after!.y + after!.height).toBeLessThanOrEqual(600);

    await page.keyboard.press('Escape');
    await expect(popup).not.toBeAttached();
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await page.keyboard.type('/');
    await expect(page.locator('[data-editor-popover="slash"]')).toBeVisible();
  });
});
