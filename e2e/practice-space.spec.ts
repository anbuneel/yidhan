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

/** The landing hero routes to the Practice Space below 768px; above it, it reveals
 *  the in-place editor instead. Only the viewport decides, so only the viewport is
 *  overridden here — a device preset would force a new worker. */
test.describe('Start writing on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('one tap reaches an editable draft with the caret in it', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /start writing/i }).first().click();

    // The Practice Space, already in a note — not its library.
    await expect(page.getByTestId('note-editor')).toBeVisible();
    await expect(page.getByPlaceholder(/untitled/i)).toBeFocused();
    await expect(page).toHaveURL(/\/demo/);
  });

  test('the arrival intent is consumed, so a refresh does not open a second draft',
    async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /start writing/i }).first().click();
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
    await page.getByRole('button', { name: /start writing/i }).first().click();
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
