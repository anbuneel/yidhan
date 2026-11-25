import { test, expect, type Page } from '@playwright/test';

/**
 * The Practice Space — items 45, 46 and 152.
 *
 * These run without an account, so unlike the authenticated specs they run in CI
 * today. Item 46's second half — the note actually landing in the account — needs the
 * authenticated fixture from item 37; the migration itself is covered in
 * `src/services/demoStorage.test.ts`.
 */

const OLD_WELCOME_CONTENT = `<p>A calm space for your thoughts. Pin important notes, organize with tags, and write in focus mode.</p>
<p>Your notes are end-to-end encrypted — only you can read them.</p>`;

/** Seed a Practice Space carrying the welcome note as it shipped before the fix. */
async function seedStaleStarter(page: Page) {
  await page.addInitScript((content: string) => {
    const now = Date.now();
    window.localStorage.setItem(
      'yidhan-demo-state',
      JSON.stringify({
        version: 1,
        notes: [
          {
            localId: 'starter-welcome',
            title: 'Welcome to Yidhan',
            content,
            pinned: true,
            tagIds: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        tags: [],
        metadata: {
          createdAt: now,
          lastVisit: now,
          totalNotesCreated: 1,
          promptDismissedAt: null,
          ribbonDismissedAt: null,
        },
      })
    );
  }, OLD_WELCOME_CONTENT);
}

/** "Try writing" opens the Practice Space draft at every width. A phone viewport is
 *  still used here because the soft keyboard is what the one-tap path exists for.
 *  Only the viewport is overridden — a device preset would force a new worker. */
test.describe('Try writing on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('one tap reaches an editable draft with the caret in it', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /^try writing$/i }).first().click();

    // The Practice Space, already in a note — not its library.
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByPlaceholder(/untitled/i)).toBeFocused();
    await expect(page).toHaveURL(/\/demo/);
    const notice = page.getByTestId('demo-editor-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText('Demo · saved in this browser · not encrypted');
    const noticeBox = await notice.boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(noticeBox!.x).toBeGreaterThanOrEqual(0);
    expect(noticeBox!.x + noticeBox!.width).toBeLessThanOrEqual(390);
  });

  test('the arrival intent is consumed, so a refresh does not open a second draft',
    async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /^try writing$/i }).first().click();
      await expect(page.getByTestId('note-editor')).toBeVisible();

      // The address drops back to /demo once the note exists.
      await expect(page).toHaveURL(/\/demo$/);

      await page.reload();
      await expect(page.getByTestId('library-view')).toBeVisible();

      const drafts = await page.evaluate(() => {
        const raw = window.localStorage.getItem('yidhan-demo-state');
        const state = JSON.parse(raw ?? '{"notes":[]}') as {
          notes: { localId: string; title: string; content: string }[];
        };
        return state.notes.filter(
          (n) => !n.localId.startsWith('starter-') && !n.title && !n.content
        ).length;
      });
      expect(drafts).toBe(1);
    });

  test('typing in the arrival draft keeps the words', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^try writing$/i }).first().click();
    await expect(page.getByTestId('note-editor')).toBeVisible();

    await page.getByPlaceholder(/untitled/i).fill('On the train');
    await page.getByTestId('rich-text-editor').click();
    await page.keyboard.type('Half a thought.');

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem('yidhan-demo-state');
          const state = JSON.parse(raw ?? '{"notes":[]}') as { notes: { title: string }[] };
          return state.notes.some((n) => n.title === 'On the train');
        })
      )
      .toBe(true);
  });
});

test.describe('Keeping practice work', () => {
  test('the keep CTA appears only once there is something to keep', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();

    const keep = page.getByRole('button', { name: /keep these notes/i });
    await expect(keep).toBeHidden();

    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByTestId('demo-editor-notice')).toHaveText(
      'Demo · saved in this browser · not encrypted',
    );
    await page.getByPlaceholder(/untitled/i).fill('Something of mine');
    await page.getByRole('button', { name: /yidhan/i }).click();

    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect(keep).toBeVisible();
  });

  test('the keep CTA goes straight to sign-up, in one step', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await page.getByPlaceholder(/untitled/i).fill('Something of mine');
    await page.getByRole('button', { name: /yidhan/i }).click();

    await page.getByRole('button', { name: /keep these notes/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Sign-up, not sign-in: the practice work is carried by creating an account.
    await expect(dialog.getByRole('button', { name: /create account|sign up/i })).toBeVisible();
  });
});

test.describe('Starter copy', () => {
  test('an untouched starter no longer claims practice drafts are encrypted', async ({
    page,
  }) => {
    await seedStaleStarter(page);
    await page.goto('/demo');

    await expect(page.getByTestId('library-view')).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem('yidhan-demo-state');
          const state = JSON.parse(raw ?? '{"notes":[]}') as {
            notes: { localId: string; content: string }[];
          };
          return state.notes.find((n) => n.localId === 'starter-welcome')?.content ?? '';
        })
      )
      .not.toContain('end-to-end encrypted');
  });

  test('a corrected starter is not mistaken for the reader’s own work', async ({ page }) => {
    await seedStaleStarter(page);
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();

    // Nothing to keep: the only note is a starter the reader never touched.
    await expect(page.getByRole('button', { name: /keep these notes/i })).toBeHidden();
  });
});

/** Item 111: a lone pinned card sits at the left of the Pinned band as a compact card,
 *  not centred in it. The welcome note is the Practice Space's only pinned note. */
test.describe('Pinned row', () => {
  async function welcomeAndBand(page: Page) {
    await page.goto('/demo');
    const band = page.locator('#chapter-pinned');
    const card = band.locator('.note-card').first();
    await expect(card).toBeVisible();
    // Wait out the entrance animation so the box is final.
    await page.waitForTimeout(600);
    const bandBox = await band.boundingBox();
    const cardBox = await card.boundingBox();
    if (!bandBox || !cardBox) throw new Error('pinned band or welcome card has no box');
    return { band, card, bandBox, cardBox };
  }

  test.describe('at 1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('the welcome card is left-aligned and compact, not centred in a wide band', async ({
      page,
    }) => {
      const { card, bandBox, cardBox } = await welcomeAndBand(page);

      await expect(page.locator('#chapter-pinned .note-card')).toHaveCount(1);
      await expect(card).toHaveClass(/note-card-compact/);
      // Much narrower than the band it sits in.
      expect(cardBox.width).toBeLessThan(bandBox.width / 3);
      // Starts at the band's content edge (px-12 plus the masonry gutter), and its
      // centre is nowhere near the band's centre.
      expect(cardBox.x - bandBox.x).toBeLessThan(80);
      const cardCentre = cardBox.x + cardBox.width / 2;
      const bandCentre = bandBox.x + bandBox.width / 2;
      expect(Math.abs(cardCentre - bandCentre)).toBeGreaterThan(bandBox.width / 4);
    });
  });

  test.describe('at 390 px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the row stacks to the column and adds no horizontal scroll', async ({ page }) => {
      const { bandBox, cardBox } = await welcomeAndBand(page);

      expect(cardBox.x).toBeGreaterThanOrEqual(0);
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
      // Fills the column, as every other phone card does.
      expect(cardBox.width).toBeGreaterThan(bandBox.width - 80);
      const scrolls = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(scrolls).toBe(false);
    });
  });
});

/** Launch review B10: at 375px with three tags, "+ Tag" stays on the tag row rather
 *  than wrapping onto its own line. */
test.describe('Tag row at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('"+ Tag" shares the same row as the three default tags', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();

    const allNotes = page.getByRole('button', { name: 'All notes' });
    const journal = page.getByRole('button', { name: 'Filter by Journal' });
    const ideas = page.getByRole('button', { name: 'Filter by Ideas' });
    const reading = page.getByRole('button', { name: 'Filter by Reading' });
    const addTag = page.getByRole('button', { name: 'Add tag' });

    for (const btn of [allNotes, journal, ideas, reading, addTag]) {
      await expect(btn).toBeVisible();
    }

    const boxes = await Promise.all(
      [allNotes, journal, ideas, reading, addTag].map((btn) => btn.boundingBox())
    );
    for (const box of boxes) {
      expect(box).not.toBeNull();
    }

    const [allBox, journalBox, ideasBox, readingBox, addBox] = boxes as NonNullable<(typeof boxes)[number]>[];
    // Every item sits on the same horizontal band — no lone wrapped "+ Tag" line.
    for (const box of [journalBox, ideasBox, readingBox, addBox]) {
      expect(Math.abs(box.y - allBox.y)).toBeLessThan(4);
    }
    expect(addBox.x).toBeGreaterThan(readingBox.x);
    // All items, including "+ Tag", fit inside the 375px viewport without scrolling.
    expect(allBox.x).toBeGreaterThanOrEqual(0);
    expect(addBox.x + addBox.width).toBeLessThanOrEqual(375);

    // No page-level horizontal overflow.
    const pageScrolls = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(pageScrolls).toBe(false);
  });

  test('with eight tags, wraps so every tag and "+ Tag" stays inside the 375px viewport without horizontal scrolling', async ({ page }) => {
    const extraTags = ['Drafts', 'Essays', 'Travel', 'Work', 'Music'];
    const allTagNames = ['Journal', 'Ideas', 'Reading', ...extraTags];

    await page.addInitScript((names: string[]) => {
      const now = Date.now();
      const state = {
        version: 1,
        notes: [
          {
            localId: 'starter-welcome',
            title: 'Welcome to Yidhan',
            content: '<p>Practice note</p>',
            pinned: true,
            tagIds: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        tags: names.map((name, index) => ({
          localId: `tag-${index}`,
          name,
          color: 'stone',
          createdAt: now,
        })),
        metadata: {
          createdAt: now,
          lastVisit: now,
          totalNotesCreated: 1,
          promptDismissedAt: null,
          ribbonDismissedAt: null,
        },
      };
      window.localStorage.setItem('yidhan-demo-state', JSON.stringify(state));
    }, allTagNames);

    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();

    const buttons = [
      page.getByRole('button', { name: 'All notes' }),
      ...allTagNames.map((name) => page.getByRole('button', { name: `Filter by ${name}` })),
      page.getByRole('button', { name: 'Add tag' }),
    ];

    for (const btn of buttons) {
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }

    // Eight tags must wrap across rows instead of overflowing horizontally off-screen.
    const firstBox = (await buttons[0].boundingBox())!;
    const addBox = (await buttons[buttons.length - 1].boundingBox())!;
    expect(addBox.y).toBeGreaterThan(firstBox.y);

    const pageScrolls = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(pageScrolls).toBe(false);
  });
});
