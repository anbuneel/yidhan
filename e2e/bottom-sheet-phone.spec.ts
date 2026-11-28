import { test, expect, openSettings } from './fixtures';

/**
 * PR #312: on a phone the Settings sheet slid up on its first open after a page load,
 * then slid back to translateY(innerHeight) within about a second and stayed mounted
 * there, so nothing in it could be tapped. Sample its position for two seconds.
 */
test.describe('Bottom sheet on a phone', () => {
  test('stays on screen after its first open', async ({ authenticatedPage: page, isMobile }) => {
    test.skip(!isMobile, 'The bottom sheet only renders on phone viewports');

    await openSettings(page);
    const dialog = page.getByRole('dialog');
    const viewportHeight = page.viewportSize()?.height ?? 0;

    for (let sample = 0; sample < 8; sample++) {
      await page.waitForTimeout(250);
      const box = await dialog.boundingBox();
      // Past the open animation, the sheet's top must stay well inside the viewport.
      if (sample >= 2) {
        expect(box, `sample ${sample}`).not.toBeNull();
        expect(box!.y, `sheet top at sample ${sample}`).toBeLessThan(viewportHeight / 2);
      }
    }

    // And it can be used: a tap inside lands on the sheet.
    await page.getByRole('tab', { name: /profile/i }).click();
    await expect(page.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true');
  });
});
