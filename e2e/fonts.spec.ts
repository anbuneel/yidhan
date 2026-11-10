import { test, expect, type Page } from '@playwright/test';

/**
 * Fonts in a real browser: the Literata fallback, the real italic, and the phone
 * title. Runs in the Practice Space, so it needs no account. `src/fonts.test.ts`
 * checks the declarations; this checks what the browser actually fetches and uses.
 */

/** Families Chrome actually drew a node with, from the DevTools protocol. */
async function usedFonts(page: Page, selector: string): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  await cdp.detach();
  return fonts.map((font) => font.familyName);
}

function fontRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (/\.woff2(\?|$)/.test(request.url())) urls.push(new URL(request.url()).pathname);
  });
  return urls;
}

async function openDraft(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /^try writing$/i }).first().click();
  await expect(page.getByTestId('note-editor')).toBeVisible();
}

async function writeBody(page: Page, text: string) {
  await page.getByTestId('rich-text-editor').click();
  await page.keyboard.type(text);
  await page.evaluate(() => document.fonts.ready);
}

test.describe('The Cyrillic and Greek fallback', () => {
  test('a latin-only note fetches no Literata file', async ({ page }) => {
    const fonts = fontRequests(page);
    await openDraft(page);
    await page.getByPlaceholder(/untitled/i).fill('Plain words');
    await writeBody(page, 'Only latin letters here, nothing else.');

    // Give a late unicode-range fetch the chance to show up before asserting none did.
    await page.waitForLoadState('networkidle');
    expect(fonts.some((url) => /newsreader-roman-latin/.test(url))).toBe(true);
    expect(fonts.filter((url) => /literata/.test(url))).toEqual([]);
  });

  test('a note with a Cyrillic word fetches Literata and draws the word in it', async ({ page }) => {
    const fonts = fontRequests(page);
    await openDraft(page);
    await writeBody(page, 'Привет');

    await expect.poll(() => fonts.filter((url) => /literata-roman-cyrillic/.test(url)).length).toBeGreaterThan(0);
    // Not a system font: the browser drew the Cyrillic with the Literata face.
    await expect
      .poll(() => usedFonts(page, '.ProseMirror p'))
      .toEqual(expect.arrayContaining([expect.stringMatching(/^Literata\b/)]));
    // And only the subset it needed.
    expect(fonts.filter((url) => /literata-(italic|roman-greek)/.test(url))).toEqual([]);
  });
});

test.describe('Real faces, not faked ones', () => {
  test('italic text loads the Newsreader italic file and draws with it', async ({ page }) => {
    const fonts = fontRequests(page);
    await openDraft(page);
    await page.getByTestId('rich-text-editor').click();
    await page.keyboard.press('Control+i');
    await page.keyboard.type('slanted');
    await page.evaluate(() => document.fonts.ready);

    await expect.poll(() => fonts.filter((url) => /newsreader-italic-latin/.test(url)).length).toBeGreaterThan(0);
    const italicLoaded = await page.evaluate(() =>
      [...document.fonts].some((f) => f.family.includes('Newsreader') && f.style === 'italic' && f.status === 'loaded')
    );
    expect(italicLoaded).toBe(true);
    // The trimmed file names itself after its optical size, e.g. "Newsreader 16pt".
    expect(await usedFonts(page, '.ProseMirror em')).toEqual([expect.stringMatching(/^Newsreader\b/)]);
  });
});

test.describe('The phone title', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const px = (page: Page, selector: string) =>
    page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  test('is larger than the note text', async ({ page }) => {
    await openDraft(page);
    await writeBody(page, 'Body text.');
    const title = await px(page, 'textarea[aria-label="Note title"]');
    const body = await px(page, '.ProseMirror p');
    expect(title).toBeGreaterThan(body);
  });

  test('leaves every input at 16px or more, so iOS does not zoom', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();
    // Measure every search box, shown or not: the rule applies by width, not by visibility.
    const searches = page.getByPlaceholder(/search your thoughts/i);
    expect(await searches.count()).toBeGreaterThan(0);
    for (const size of await searches.evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)))) {
      expect(size).toBeGreaterThanOrEqual(16);
    }

    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    const dialog = page.getByRole('dialog');
    for (const field of [dialog.getByLabel(/^email$/i), dialog.getByLabel(/^password$/i)]) {
      await expect(field).toBeVisible();
      expect(await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
  });
});
