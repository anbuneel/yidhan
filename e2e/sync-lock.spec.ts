import { expect, test, type Page } from '@playwright/test';

interface SyncLockHarness {
  entered: boolean;
  completed: boolean;
  release: () => void;
  error: string | null;
}

type HarnessWindow = Window & typeof globalThis & {
  __syncLockHarness?: SyncLockHarness;
};

async function startHoldingSyncLock(page: Page, userId: string): Promise<void> {
  await page.evaluate(async (lockUserId) => {
    let release = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness: SyncLockHarness = {
      entered: false,
      completed: false,
      release,
      error: null,
    };
    (window as HarnessWindow).__syncLockHarness = harness;

    try {
      // The Vite test server transforms this source module for the browser.
      // @ts-expect-error Browser-only absolute module URL served by Vite.
      const { withCrossTabSyncLock } = await import('/src/services/syncLock.ts');
      void withCrossTabSyncLock(lockUserId, async () => {
        harness.entered = true;
        await hold;
      }).then(
        () => { harness.completed = true; },
        (error: unknown) => {
          harness.error = error instanceof Error ? error.message : String(error);
        }
      );
    } catch (error) {
      harness.error = error instanceof Error ? error.message : String(error);
    }
  }, userId);
}

async function readHarness(page: Page): Promise<Omit<SyncLockHarness, 'release'>> {
  return page.evaluate(() => {
    const harness = (window as HarnessWindow).__syncLockHarness;
    return {
      entered: harness?.entered ?? false,
      completed: harness?.completed ?? false,
      error: harness?.error ?? null,
    };
  });
}

test.describe('cross-tab sync queue ownership', () => {
  test('allows only one tab into the queue critical section', async ({ browser }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([first.goto('/'), second.goto('/')]);

    await startHoldingSyncLock(first, 'two-tab-user');
    await expect.poll(async () => (await readHarness(first)).entered).toBe(true);

    await startHoldingSyncLock(second, 'two-tab-user');
    await second.waitForTimeout(300);
    expect(await readHarness(second)).toMatchObject({ entered: false, error: null });

    await first.evaluate(() => (window as HarnessWindow).__syncLockHarness?.release());
    await expect.poll(async () => (await readHarness(second)).entered).toBe(true);
    expect(await readHarness(first)).toMatchObject({ completed: true, error: null });

    await second.evaluate(() => (window as HarnessWindow).__syncLockHarness?.release());
    await context.close();
  });

  test('releases queue ownership when the holding tab dies', async ({ browser }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    await Promise.all([first.goto('/'), second.goto('/')]);

    await startHoldingSyncLock(first, 'killed-tab-user');
    await expect.poll(async () => (await readHarness(first)).entered).toBe(true);
    await startHoldingSyncLock(second, 'killed-tab-user');
    await second.waitForTimeout(300);
    expect((await readHarness(second)).entered).toBe(false);

    const killedAt = Date.now();
    await first.close();
    await expect.poll(
      async () => (await readHarness(second)).entered,
      { timeout: 30_000 }
    ).toBe(true);
    expect(Date.now() - killedAt).toBeLessThan(30_000);
    expect((await readHarness(second)).error).toBeNull();

    await second.evaluate(() => (window as HarnessWindow).__syncLockHarness?.release());
    await context.close();
  });
});
