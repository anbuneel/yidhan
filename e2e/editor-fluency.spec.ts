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
  // Demo hydration seeds its starter notes asynchronously. Waiting for the
  // seed prevents an early new-note click from racing that initial state load.
  await expect(page.getByRole('heading', { name: 'Welcome to Yidhan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New note', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await expect(page.getByTestId('note-editor')).toBeVisible();
}

test.describe('editor fluency', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('every editor command is mouse-reachable from 320px through 1920px, from one toolbar at a time', async ({ page, isMobile }) => {
    await openBlankPracticeNote(page);

    for (const width of [320, 768, 1024, 1100, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const surfaces = {
        bottom: page.locator('.editor-toolbar-bottom'),
        inline: page.locator('.editor-toolbar-inline'),
        sidebar: page.locator('.editor-sidebar'),
      };
      // Touch devices never render the sidebar; they keep the inline toolbar from 768px up.
      const shown: keyof typeof surfaces = width < 768 ? 'bottom' : width < 1100 || isMobile ? 'inline' : 'sidebar';
      // One toolbar at a time. The other two are hidden by CSS or not rendered at all.
      for (const [name, locator] of Object.entries(surfaces)) {
        if (name === shown) await expect(locator).toBeVisible();
        else await expect(locator).toBeHidden();
      }
      const surface = surfaces[shown];
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
    // Escape dismisses the suggestion without deleting its trigger. Remove
    // that slash before entering a fresh, valid trigger at the same caret.
    await page.keyboard.press('Backspace');
    await page.keyboard.type('/');
    await expect(page.locator('[data-editor-popover="slash"]')).toBeVisible();
  });

  test('the tag picker and writing details open in front of the toolbar and the note body', async ({ page, isMobile }) => {
    // 1024px: the inline toolbar sits directly under the metadata row and the
    // sidebar is hidden. Both popovers used to paint behind that toolbar, and
    // behind the note body, because the row's focus-mode class makes it a
    // stacking context that its children's z-index cannot escape.
    await page.setViewportSize({ width: 1024, height: 900 });
    await openBlankPracticeNote(page);
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    for (let line = 0; line < 8; line += 1) {
      await page.keyboard.type(`Body line ${line}`);
      await page.keyboard.press('Enter');
    }

    const surfaceAt = (x: number, y: number) => page.evaluate(([px, py]) => {
      const hit = document.elementFromPoint(px, py);
      if (!hit) return 'nothing';
      if (hit.closest('[data-testid="tag-selector-menu"]')) return 'tag menu';
      if (hit.closest('.editor-metrics-detail')) return 'writing details';
      if (hit.closest('.editor-toolbar-inline')) return 'toolbar';
      if (hit.closest('.ProseMirror')) return 'note body';
      return hit.tagName.toLowerCase();
    }, [x, y]);

    await page.getByRole('button', { name: 'Add tag' }).click();
    const menu = page.getByTestId('tag-selector-menu');
    await expect(menu).toBeVisible();
    const menuBox = (await menu.boundingBox())!;
    // Just inside the top edge, where the sticky toolbar is.
    expect(await surfaceAt(menuBox.x + 24, menuBox.y + 12)).toBe('tag menu');
    // Just inside the bottom edge, over the first lines of the body.
    expect(await surfaceAt(menuBox.x + 24, menuBox.y + menuBox.height - 8)).toBe('tag menu');
    // A real click on the top item lands on it, not on the toolbar behind it.
    await menu.getByRole('button', { name: 'Journal' }).click();
    // The chip in the metadata row, plus the menu item that is still open.
    await expect(page.getByRole('button', { name: 'Journal', exact: true })).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // Hover reveals the details on a pointer device; on touch a tap toggles them.
    const detailsTrigger = page.getByRole('button', { name: /^Writing details/ });
    if (isMobile) await detailsTrigger.click(); else await detailsTrigger.hover();
    const details = page.locator('.editor-metrics-detail');
    await expect(details).toBeVisible();
    await expect(details).toContainText('words');
    const detailsBox = (await details.boundingBox())!;
    expect(await surfaceAt(detailsBox.x + detailsBox.width / 2, detailsBox.y + detailsBox.height / 2)).toBe('writing details');

    // Where it should not fire: with both closed, the toolbar is on top again.
    if (isMobile) await detailsTrigger.click(); else await page.mouse.move(8, 8);
    await expect(details).toBeHidden();
    const bold = page.locator('.editor-toolbar-inline [data-command-id="bold"]');
    const boldBox = (await bold.boundingBox())!;
    expect(await surfaceAt(boldBox.x + boldBox.width / 2, boldBox.y + boldBox.height / 2)).toBe('toolbar');
  });
});
