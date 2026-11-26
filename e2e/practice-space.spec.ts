import { test, expect, type Locator, type Page } from '@playwright/test';

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

    const keep = page.getByTestId('demo-keep-cta');
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

    await page.getByTestId('demo-keep-cta').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Sign-up, not sign-in: the practice work is carried by creating an account.
    await expect(dialog.getByRole('button', { name: /^create an account$/i })).toBeVisible();
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
    await expect(page.getByTestId('demo-keep-cta')).toBeHidden();
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

/** Design critique K1: touch screens have no hover, so an unpinned card's pin and
 *  delete buttons used to sit at opacity 0 — an invisible pin target in the corner.
 *  Below 700px the library uses compact cards, which have no pin or delete button, so
 *  the trap was on touch screens 700px and wider: tablets and touch laptops. */
async function firstUnpinnedCard(page: Page) {
  await page.goto('/demo');
  await expect(page.getByTestId('library-view')).toBeVisible();
  const card = page
    .locator('.note-card:not(.note-card-compact)')
    .filter({ has: page.getByRole('button', { name: 'Pin note' }) })
    .first();
  await expect(card).toBeVisible();
  await page.waitForTimeout(600);
  return card;
}

async function opacityOf(locator: Locator) {
  return locator.evaluate((el) => Number(getComputedStyle(el).opacity));
}

test.describe('Card corner on a touch phone at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('no card carries an invisible pin or delete target', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByTestId('library-view')).toBeVisible();
    await page.waitForTimeout(600);
    const targets = page.locator('.note-card').getByRole('button', { name: /^(Pin note|Delete note)$/ });
    for (const target of await targets.all()) {
      expect(await opacityOf(target)).toBeGreaterThan(0);
    }
  });

  test('tapping the top-right corner of an unpinned card opens the note', async ({ page }) => {
    await page.goto('/demo');
    const card = page.locator('#chapter-thisWeek .note-card').first();
    await expect(card).toBeVisible();
    await page.waitForTimeout(600);
    const box = await card.boundingBox();
    if (!box) throw new Error('card has no box');
    await page.touchscreen.tap(box.x + box.width - 20, box.y + 20);
    await expect(page.getByTestId('note-editor')).toBeVisible();
  });
});

test.describe('Card corner on a touch tablet at 820 px', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

  test('the unpinned pin and delete icons are visible', async ({ page }) => {
    const card = await firstUnpinnedCard(page);
    expect(await opacityOf(card.getByRole('button', { name: 'Pin note' }))).toBeCloseTo(0.4);
    expect(await opacityOf(card.getByRole('button', { name: 'Delete note' }))).toBeCloseTo(0.4);
  });

  test('tapping the card corner outside the pin opens the note, not a pin', async ({ page }) => {
    const card = await firstUnpinnedCard(page);
    const box = await card.boundingBox();
    if (!box) throw new Error('card has no box');
    // The pin button spans 8-48px in from the top-right corner, and the corner itself
    // is rounded. 4px in from the right edge, 30px down, is the card beside the pin.
    await page.touchscreen.tap(box.x + box.width - 4, box.y + 30);
    await expect(page.getByTestId('note-editor')).toBeVisible();
  });

  test('tapping the visible pin pins the note', async ({ page }) => {
    const card = await firstUnpinnedCard(page);
    const title = (await card.getByRole('button', { name: /^Open note:/ }).getAttribute('aria-label'))!;
    await card.getByRole('button', { name: 'Pin note' }).tap();
    await expect(
      page.locator('#chapter-pinned').getByRole('button', { name: title })
    ).toBeVisible();
    await expect(page.getByTestId('note-editor')).toHaveCount(0);
  });
});

test.describe('Card icons on desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the unpinned pin and delete icons stay hidden until hover', async ({ page }) => {
    const card = await firstUnpinnedCard(page);
    await page.mouse.move(0, 0);
    const pin = card.getByRole('button', { name: 'Pin note' });
    const del = card.getByRole('button', { name: 'Delete note' });
    expect(await opacityOf(pin)).toBe(0);
    expect(await opacityOf(del)).toBe(0);
    await card.hover();
    await expect.poll(() => opacityOf(pin)).toBeCloseTo(0.4);
  });
});

/** Design critique G6: every sign-up control says "Create an account". On a phone that
 *  does not fit in the header beside Sign in, so the header link hides and the ribbon
 *  carries it. */
test.describe('Sign-up link at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the ribbon carries "Create an account" and Sign in stays on screen', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await page.getByPlaceholder(/untitled/i).fill('Something of mine');
    await page.getByRole('button', { name: /yidhan/i }).click();
    await expect(page.getByTestId('library-view')).toBeVisible();

    await expect(page.getByTestId('demo-keep-cta')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Create an account', exact: true })).toBeVisible();
    const signIn = await page.getByRole('button', { name: 'Sign in', exact: true }).boundingBox();
    if (!signIn) throw new Error('Sign in has no box');
    expect(signIn.x + signIn.width).toBeLessThanOrEqual(375);
  });

  test('with the ribbon dismissed, the link sits under the tag row', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await page.getByPlaceholder(/untitled/i).fill('Something of mine');
    await page.getByRole('button', { name: /yidhan/i }).click();
    await expect(page.getByTestId('library-view')).toBeVisible();
    await expect(page.getByTestId('demo-keep-cta-phone')).toBeHidden();

    await page.getByRole('button', { name: 'Dismiss' }).click();
    const phoneCta = page.getByTestId('demo-keep-cta-phone');
    await expect(phoneCta).toBeVisible();
    await expect(phoneCta).toHaveText('Create an account to keep your notes');
  });
});

test.describe('Sign-up link at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the header link says "Create an account"', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await page.getByPlaceholder(/untitled/i).fill('Something of mine');
    await page.getByRole('button', { name: /yidhan/i }).click();
    await expect(page.getByTestId('demo-keep-cta')).toHaveText('Create an account');
    await expect(page.getByRole('button', { name: 'Create an account to keep your notes' }).first()).toBeVisible();
  });
});
