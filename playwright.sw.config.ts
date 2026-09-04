import { defineConfig, devices } from '@playwright/test';

/**
 * Service worker update tests.
 *
 * Separate from playwright.config.ts because these need the production build
 * and a static server they can swap under a running browser — the main suite's
 * `webServer` runs `npm run dev`, which does not produce a real service worker
 * at all. That gap is why the stranded-client bug went unnoticed for months.
 *
 * Run with `npm run e2e:sw`.
 */
export default defineConfig({
  testDir: './e2e-sw',

  // The spec manages one build and one server for the whole file.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report-sw' }],
    ['list'],
  ],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Service workers only run on a secure origin; 127.0.0.1 counts as one.
    serviceWorkers: 'allow',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // A production build runs inside beforeAll, so allow for it.
  timeout: 180 * 1000,

  expect: {
    timeout: 15 * 1000,
  },
});
