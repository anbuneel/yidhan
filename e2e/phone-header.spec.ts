import { test, expect, type Browser } from '@playwright/test';

/**
 * The editor header on a 390px phone. The wordmark and the "Saved here" pill share one
 * row with three buttons, and at 390px they touched. Runs without an account, in the
 * Practice Space.
 *
 * Two contexts: a phone (overlay scrollbars, the real case) and a desktop browser at
 * the same width, whose classic scrollbar takes 8px more from the row.
 */

async function measure(browser: Browser, theme: 'light' | 'dark', isMobile: boolean) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile, hasTouch: isMobile });
  await context.addInitScript((t) => window.localStorage.setItem('yidhan-theme', t), theme);
  const page = await context.newPage();
  await page.goto('/demo/new');
  const editor = page.locator('.ProseMirror').first();
  await editor.click();
  await page.keyboard.type('Leave the morning unplanned.');
  const pill = page.locator('[data-save-status="saved"]');
  await expect(pill).toBeVisible({ timeout: 10_000 });
  const word = page.getByTestId('note-editor').getByRole('img', { name: 'Yidhan' });
  const mark = word.locator('xpath=preceding-sibling::*[1]');
  const [w, p, m] = await Promise.all([word.boundingBox(), pill.boundingBox(), mark.boundingBox()]);
  await context.close();
  return { word: w!, pill: p!, mark: m! };
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: on a 390px phone the save pill clears the wordmark`, async ({ browser }) => {
    const { word, pill, mark } = await measure(browser, theme, true);
    expect(pill.x - (word.x + word.width), 'gap between wordmark and pill, px').toBeGreaterThanOrEqual(8);
    // The fix must not come from shrinking the logo.
    expect(mark.height).toBeGreaterThanOrEqual(30);
    expect(word.height).toBeGreaterThanOrEqual(30);
  });
}

test('at 390px with a desktop scrollbar the pill still does not overlap the wordmark', async ({ browser }) => {
  const { word, pill } = await measure(browser, 'light', false);
  expect(pill.x).toBeGreaterThanOrEqual(word.x + word.width);
});
