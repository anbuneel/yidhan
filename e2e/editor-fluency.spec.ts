import { expect, test, type Page } from '@playwright/test';

// Every command a mouse can reach. Date and now are slash-only; smart typography is in
// Settings; left, right and justify keep only their shortcuts (DECISIONS.md, 2026-11-26).
const commandIds = [
  'bold', 'italic', 'underline', 'strike', 'inlineCode', 'link', 'highlight',
  'paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList',
  'taskList', 'blockquote', 'codeBlock', 'horizontalRule', 'alignCenter', 'undo',
  'redo', 'findReplace', 'focusMode',
] as const;

const rowIds = ['bold', 'italic', 'heading1', 'bulletList', 'link'] as const;

async function openBlankPracticeNote(page: Page): Promise<void> {
  await page.goto('/demo');
  // Demo hydration seeds its starter notes asynchronously. Waiting for the
  // seed prevents an early new-note click from racing that initial state load.
  await expect(page.getByRole('heading', { name: 'Welcome to Yidhan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New note', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await expect(page.getByTestId('note-editor')).toBeVisible();
}

/** Names the editor surface that owns the topmost element at a viewport point. */
function surfaceAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(([px, py]) => {
    const hit = document.elementFromPoint(px, py);
    if (!hit) return 'nothing';
    if (hit.closest('[data-testid="tag-selector-menu"]')) return 'tag menu';
    if (hit.closest('.editor-metrics-detail')) return 'writing details';
    if (hit.closest('.editor-toolbar-inline')) return 'toolbar';
    if (hit.closest('.editor-toolbar-bottom')) return 'bottom toolbar';
    if (hit.closest('.ProseMirror')) return 'note body';
    return hit.tagName.toLowerCase();
  }, [x, y]);
}

test.describe('editor fluency', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('every editor command is mouse-reachable from 320px through 1920px, through the row or ⋯ of one toolbar at a time', async ({ page, isMobile }) => {
    await openBlankPracticeNote(page);

    for (const width of [320, 390, 768, 1024, 1100, 1920]) {
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
      // The row: the same five buttons at every width, then focus mode. The phone bar
      // adds Undo and Redo from 380px.
      const expectedRow: string[] = [
        ...rowIds,
        ...(shown === 'bottom' && width >= 380 ? ['undo', 'redo'] : []),
        'focusMode',
      ];
      const row = await surface.locator('[role="toolbar"] > [data-command-id]').evaluateAll((buttons) =>
        buttons.filter((b) => (b as HTMLElement).offsetParent !== null).map((b) => b.getAttribute('data-command-id')));
      expect(row).toEqual(expectedRow);

      await surface.getByRole('button', { name: 'More editor commands' }).click();
      const menu = page.getByRole('menu', { name: 'Editor commands' });
      await expect(menu).toBeVisible();

      for (const commandId of commandIds) {
        const inRow = expectedRow.includes(commandId);
        const command = inRow
          ? surface.locator(`[role="toolbar"] > [data-command-id="${commandId}"]`)
          : menu.locator(`[data-command-id="${commandId}"]`);
        await command.scrollIntoViewIfNeeded();
        await expect(command, `${commandId} at ${width}px`).toBeVisible();
        // Never in the row and the menu at once.
        if (inRow) await expect(menu.locator(`[data-command-id="${commandId}"]`)).toBeHidden();
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

    await page.getByRole('button', { name: 'Add tag' }).click();
    const menu = page.getByTestId('tag-selector-menu');
    await expect(menu).toBeVisible();
    const menuBox = (await menu.boundingBox())!;
    // Just inside the top edge, where the sticky toolbar is.
    expect(await surfaceAt(page, menuBox.x + 24, menuBox.y + 12)).toBe('tag menu');
    // Just inside the bottom edge, over the first lines of the body.
    expect(await surfaceAt(page, menuBox.x + 24, menuBox.y + menuBox.height - 8)).toBe('tag menu');
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
    expect(await surfaceAt(page, detailsBox.x + detailsBox.width / 2, detailsBox.y + detailsBox.height / 2)).toBe('writing details');

    // Where it should not fire: with both closed, the toolbar is on top again.
    if (isMobile) await detailsTrigger.click(); else await page.mouse.move(8, 8);
    await expect(details).toBeHidden();
    const bold = page.locator('.editor-toolbar-inline [data-command-id="bold"]');
    const boldBox = (await bold.boundingBox())!;
    expect(await surfaceAt(page, boldBox.x + boldBox.width / 2, boldBox.y + boldBox.height / 2)).toBe('toolbar');
  });

  test('the tag picker opens in front of the bottom toolbar on a phone', async ({ page }) => {
    // Measure where the picker's last tag lands on a tall phone, then reopen the
    // note in a viewport just tall enough that the fixed bottom toolbar (z 30)
    // covers that spot. The picker hangs from the title, so it does not move.
    await page.setViewportSize({ width: 390, height: 900 });
    await openBlankPracticeNote(page);
    await page.getByRole('button', { name: 'Add tag' }).click();
    const menu = page.getByTestId('tag-selector-menu');
    await expect(menu).toBeVisible();
    const lastTag = menu.getByRole('button', { name: 'Reading' });
    const lastTagBox = (await lastTag.boundingBox())!;
    const cx = lastTagBox.x + lastTagBox.width / 2;
    const cy = lastTagBox.y + lastTagBox.height / 2;

    await page.setViewportSize({ width: 390, height: Math.round(cy + 20) });
    await openBlankPracticeNote(page);
    await page.getByRole('button', { name: 'Add tag' }).click();
    await expect(menu).toBeVisible();
    const toolbar = page.locator('.editor-toolbar-bottom');
    await expect(toolbar).toBeVisible();
    const toolbarBox = (await toolbar.boundingBox())!;
    // The case only means something if the two overlap.
    expect(toolbarBox.y).toBeLessThan(cy);
    expect(await surfaceAt(page, cx, cy)).toBe('tag menu');
    // A real tap on that tag lands on it, not on the toolbar.
    await lastTag.click();
    await expect(page.getByRole('button', { name: 'Reading', exact: true })).toHaveCount(2);
  });

  test('phone overflow menu stays inside a 390x844 viewport, runs tapped commands, and closes on outside tap or Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openBlankPracticeNote(page);

    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Draft line');

    const toolbar = page.locator('.editor-toolbar-bottom');
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('button', { name: 'More editor commands' }).click();

    const menu = page.getByRole('menu', { name: 'Editor commands' });
    await expect(menu).toBeVisible();

    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);

    // Tapping a command inside the portaled menu runs it instead of closing on pointerdown.
    const quoteItem = menu.locator('[data-command-id="blockquote"]');
    await quoteItem.scrollIntoViewIfNeeded();
    await quoteItem.click();
    await expect(menu).not.toBeVisible();
    await expect(editor.locator('blockquote')).toContainText('Draft line');

    // Outside tap closes the menu.
    await toolbar.getByRole('button', { name: 'More editor commands' }).click();
    await expect(menu).toBeVisible();
    await page.getByPlaceholder(/untitled/i).click();
    await expect(menu).not.toBeVisible();

    // Escape closes the menu without leaving the note.
    await toolbar.getByRole('button', { name: 'More editor commands' }).click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(page.getByTestId('note-editor')).toBeVisible();
  });

  test('narrow phone bottom toolbar at 320px and 360px keeps 36px targets inside the viewport with Undo and Redo in the overflow menu', async ({ page }) => {
    await openBlankPracticeNote(page);

    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 844 });
      const toolbar = page.locator('.editor-toolbar-bottom');
      await expect(toolbar).toBeVisible();

      // Undo and Redo move into the overflow menu below 380px so the remaining 7 buttons fit at full size.
      await expect(toolbar.locator('[data-command-id="undo"]')).toBeHidden();
      await expect(toolbar.locator('[data-command-id="redo"]')).toBeHidden();

      const visibleButtons = toolbar.locator('button:visible');
      await expect(visibleButtons).toHaveCount(7);
      for (const button of await visibleButtons.all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(36);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }

      const moreButton = toolbar.getByRole('button', { name: 'More editor commands' });
      const moreBox = await moreButton.boundingBox();
      expect(moreBox).not.toBeNull();
      expect(moreBox!.x + moreBox!.width).toBeLessThanOrEqual(width);

      await moreButton.click();
      const menu = page.getByRole('menu', { name: 'Editor commands' });
      await expect(menu).toBeVisible();

      for (const id of ['undo', 'redo'] as const) {
        const item = menu.locator(`[data-command-id="${id}"]`);
        await item.scrollIntoViewIfNeeded();
        await expect(item).toBeVisible();
      }

      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
    }

    // From 380px Undo and Redo are back in the bar, so the menu does not list them.
    await page.setViewportSize({ width: 390, height: 844 });
    const toolbar = page.locator('.editor-toolbar-bottom');
    await expect(toolbar.locator('[data-command-id="undo"]')).toBeVisible();
    await toolbar.getByRole('button', { name: 'More editor commands' }).click();
    const menu = page.getByRole('menu', { name: 'Editor commands' });
    await expect(menu).toBeVisible();
    await expect(menu.locator('[data-command-id="undo"]')).toBeHidden();
    // Arrow keys skip the hidden items: ArrowUp from the first item lands on the last visible one.
    await expect(menu.locator('[role="menuitem"]').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.locator('[data-command-id="findReplace"]')).toBeFocused();
  });

  test('capped command menu at 1366x650 scrolls without snapping back and reaches the last item by pointer and arrow keys', async ({ page, isMobile }) => {
    await page.setViewportSize({ width: 1366, height: 650 });
    await openBlankPracticeNote(page);

    const surface = page.locator(isMobile ? '.editor-toolbar-inline' : '.editor-sidebar');
    await expect(surface).toBeVisible();
    await surface.getByRole('button', { name: 'More editor commands' }).click();

    const menu = page.getByRole('menu', { name: 'Editor commands' });
    await expect(menu).toBeVisible();

    // Verify the menu overflows vertically and can scroll to the bottom without snapping back.
    const metrics = await menu.evaluate((el) => {
      const overflow = el.scrollHeight - el.clientHeight;
      el.scrollTop = el.scrollHeight;
      return { overflow, targetScrollTop: el.scrollTop };
    });
    expect(metrics.overflow).toBeGreaterThan(100);
    expect(metrics.targetScrollTop).toBeGreaterThan(0);

    // Wait a couple of frames to confirm no capture-scroll handler snaps scrollTop back.
    await page.waitForTimeout(100);
    const settledScrollTop = await menu.evaluate((el) => el.scrollTop);
    expect(settledScrollTop).toBeGreaterThanOrEqual(metrics.targetScrollTop - 2);

    // Last command (find and replace) is reachable by pointer click.
    const lastItem = menu.locator('[data-command-id="findReplace"]');
    const findPanel = page.getByRole('region', { name: 'Find and replace' });
    await expect(lastItem).toBeVisible();
    await lastItem.click();
    await expect(menu).not.toBeVisible();
    await expect(findPanel).toBeVisible();

    // Close the panel, reopen menu, and verify ArrowUp wraps to the last item cleanly.
    await findPanel.getByRole('button', { name: 'Close find and replace' }).click();
    await expect(findPanel).toBeHidden();
    await surface.getByRole('button', { name: 'More editor commands' }).click();
    await expect(menu).toBeVisible();

    // First item receives focus on open; ArrowUp wraps to the last item.
    await expect(menu.locator('[role="menuitem"]').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(lastItem).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).not.toBeVisible();
    await expect(findPanel).toBeVisible();
  });

  test('focus mode can be entered and exited without opening a menu on bottom, inline, and sidebar toolbars, and adds nothing to the library', async ({ page, isMobile }) => {
    // Library / note cards must not carry any focus-mode control.
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect(page.locator('[data-command-id="focusMode"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /focus mode/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await expect(page.getByTestId('note-editor')).toBeVisible();

    const variants: Array<{ width: number; height: number; selector: string }> = [
      { width: 390, height: 844, selector: '.editor-toolbar-bottom' },
      { width: 820, height: 900, selector: '.editor-toolbar-inline' },
      { width: 1280, height: 900, selector: isMobile ? '.editor-toolbar-inline' : '.editor-sidebar' },
    ];

    for (const { width, height, selector } of variants) {
      await page.setViewportSize({ width, height });
      const surface = page.locator(selector);
      await expect(surface).toBeVisible();
      await expect(page.getByRole('menu', { name: 'Editor commands' })).toHaveCount(0);

      const toggle = surface.locator('[data-command-id="focusMode"]');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');

      await toggle.click();
      await expect(page.getByText('Focus mode on')).toBeAttached();
      await expect(page.getByTestId('note-editor')).toHaveClass(/focus-mode-active/);

      const exitButton = page.getByRole('button', { name: 'Exit focus mode' });
      await expect(exitButton).toBeVisible();
      await exitButton.click();
      await expect(page.getByText('Focus mode off')).toBeAttached();
      await expect(page.getByTestId('note-editor')).not.toHaveClass(/focus-mode-active/);
      await expect(surface).toBeVisible();
    }
  });
});

test.describe('editor toolbar, alignment and text size', () => {
  // Clear once per test, not on every load, so a reload keeps the demo notes.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e-cleared')) return;
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    });
  });

  test('the inline toolbar has no box, with focus mode and ⋯ at the right edge', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await openBlankPracticeNote(page);
    const toolbar = page.locator('.editor-toolbar-inline [role="toolbar"]');
    await expect(toolbar).toBeVisible();
    const style = await toolbar.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopWidth, shadow: s.boxShadow };
    });
    expect(style).toEqual({ bg: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none' });
    // No strip: the sticky wrapper has no border and the sheet's own colour.
    const strip = await page.locator('.editor-toolbar-sticky').evaluate((el) => ({
      border: getComputedStyle(el).borderBottomWidth,
      bg: getComputedStyle(el).backgroundColor,
      sheet: getComputedStyle(el.closest('.editor-writing-area')!).backgroundColor,
    }));
    expect(strip.border).toBe('0px');
    expect(strip.bg).toBe(strip.sheet);

    const bar = (await toolbar.boundingBox())!;
    const more = (await toolbar.getByRole('button', { name: 'More editor commands' }).boundingBox())!;
    const link = (await toolbar.locator('[data-command-id="link"]').boundingBox())!;
    const focus = (await toolbar.locator('[data-command-id="focusMode"]').boundingBox())!;
    expect(bar.x + bar.width - (more.x + more.width)).toBeLessThan(2);
    // A gap between the row and the pair on the right.
    expect(focus.x - (link.x + link.width)).toBeGreaterThan(100);
  });

  test('Ctrl+K in the note still makes a link', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await openBlankPracticeNote(page);
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('yidhan');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+k');
    const address = page.getByLabel('Link address');
    await expect(address).toBeVisible();
    await address.fill('https://example.com');
    await page.keyboard.press('Enter');
    await expect(editor.locator('a[href^="https://example.com"]')).toHaveText('yidhan');
  });

  test('slash commands for items no longer on any toolbar still work', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await openBlankPracticeNote(page);
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('/code');
    await page.locator('[data-editor-popover="slash"]').getByText('Code block', { exact: true }).click();
    await editor.locator('pre').click();
    await page.keyboard.type('x = 1');
    await expect(editor.locator('pre code')).toHaveText('x = 1');
  });

  test('a justified note stays justified after a reload and another autosave', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await openBlankPracticeNote(page);
    await page.getByPlaceholder(/untitled/i).fill('Aligned');
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('A justified paragraph.');
    // The menus no longer list Justify; its shortcut stays.
    await page.keyboard.press('Control+Shift+j');
    await expect(editor.locator('p').first()).toHaveAttribute('style', /text-align: justify/);

    const stored = () => page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('yidhan-demo-state') ?? '{"notes":[]}') as {
        notes: { title: string; content: string }[];
      };
      return state.notes.find((n) => n.title === 'Aligned')?.content ?? '';
    });
    await expect.poll(stored).toContain('text-align: justify');

    await page.reload();
    await page.getByRole('button', { name: 'Open note: Aligned' }).click();
    const reopened = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await expect(reopened.locator('p').first()).toHaveAttribute('style', /text-align: justify/);
    await reopened.locator('p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' More.');
    await expect.poll(stored).toContain('More.');
    expect(await stored()).toContain('text-align: justify');
  });

  test('centre toggled twice leaves no style attribute', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await openBlankPracticeNote(page);
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await editor.click();
    await page.keyboard.type('Centred');
    const toolbar = page.locator('.editor-toolbar-inline');
    const menu = page.getByRole('menu', { name: 'Editor commands' });
    await toolbar.getByRole('button', { name: 'More editor commands' }).click();
    await menu.locator('[data-command-id="alignCenter"]').click();
    await expect(editor.locator('p').first()).toHaveAttribute('style', /text-align: center/);
    await toolbar.getByRole('button', { name: 'More editor commands' }).click();
    await menu.locator('[data-command-id="alignCenter"]').click();
    await expect(editor.locator('p').first()).not.toHaveAttribute('style');
  });

  test('text size survives a refresh, scales the editor and cards, and leaves the landing page alone', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto('/');
    const landingHeading = page.getByRole('heading', { level: 1 }).first();
    await expect(landingHeading).toBeVisible();
    const landingSize = await landingHeading.evaluate((el) => getComputedStyle(el).fontSize);

    await openBlankPracticeNote(page);
    const editor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    const defaultSize = await editor.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    // Settings → Editor writes this key. The demo has no Settings, so set it directly.
    await page.evaluate(() => localStorage.setItem('yidhan:editor:text-size', 'large'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
    const card = page.locator('.note-card-preview').first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(14 * 1.15, 1);

    await page.getByRole('button', { name: 'New note', exact: true }).click();
    const largeEditor = page.getByTestId('rich-text-editor').locator('.ProseMirror');
    await expect(largeEditor).toBeVisible();
    expect(await largeEditor.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(defaultSize * 1.15, 1);

    // The manuscript glow still follows the scroll at this size.
    await largeEditor.click();
    for (let line = 0; line < 40; line += 1) {
      await page.keyboard.type(`Line ${line}`);
      await page.keyboard.press('Enter');
    }
    const glow = page.locator('.editor-manuscript-glow');
    const scroller = page.getByTestId('note-editor');
    await scroller.evaluate((el) => { el.scrollTop = 0; });
    await expect.poll(() => glow.evaluate((el) => (el as HTMLElement).style.top)).toBe('0px');
    await scroller.evaluate((el) => { el.scrollTop = 900; });
    await expect.poll(() => glow.evaluate((el) => Number.parseFloat((el as HTMLElement).style.top))).toBeGreaterThan(0);

    await page.goto('/');
    await expect(landingHeading).toBeVisible();
    expect(await landingHeading.evaluate((el) => getComputedStyle(el).fontSize)).toBe(landingSize);
  });
});
