import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Same as playwright.config.ts: load `.env.local` so the unlock case can see the
// E2E_* credentials and the real Supabase URL. Real environment variables win.
for (const [key, value] of Object.entries(loadEnv('test', process.cwd(), ['E2E_', 'VITE_']))) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const chromiumLaunchOptions = chromiumExecutablePath
  ? { launchOptions: { executablePath: chromiumExecutablePath } }
  : {};

/**
 * Timing harness (item D1 in docs/plans/2026-11-27-shell-size-and-snappiness-proposal.md).
 *
 * Its own directory and config so `npm run e2e` and `npm run e2e:sw` keep their
 * cost: this suite builds for production and takes several throttled samples per
 * metric, which is minutes of work neither suite needs. The dev server is no use
 * here: it runs React in development mode, unminified.
 *
 * Run with `npm run e2e:perf`. How to read and compare runs:
 * docs/setup/perf-harness.md.
 */
export default defineConfig({
  testDir: './e2e-perf',

  // Timings need the machine to themselves.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  // A retry would hide a slow sample behind a fast one.
  retries: 0,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report-perf' }],
    ['list'],
  ],

  use: {
    trace: 'off',
    screenshot: 'only-on-failure',
    // The service worker downloads the precache after first load. That competes
    // with what is being timed and is not what any of these metrics are about.
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...chromiumLaunchOptions },
    },
  ],

  // A production build and several 4x-throttled samples per test.
  timeout: 10 * 60 * 1000,

  expect: {
    timeout: 60 * 1000,
  },
});
