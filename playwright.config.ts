import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Load `.env.local` into this process.
//
// The credentials are read by the fixture from `process.env`, in the Playwright
// runner. Vite reads `.env.local` too, but only for the dev server it starts as a
// child — that never populates the parent, so following the documented setup and
// running `npx playwright test` would leave E2E_TEST_* unset and silently skip
// every authenticated test. Real environment variables win, so CI secrets are
// never overridden by a stray local file.
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
 * Playwright E2E test configuration for Yidhan
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Look for test files in the e2e directory
  testDir: './e2e',

  // The suite writes to a shared account and, before this, never cleaned up: eleven
  // tests create a tag and one deletes one. Setup stamps the run's start time;
  // teardown deletes only what was created at or after it, so nothing that existed
  // beforehand can be touched. Both are no-ops without real credentials.
  globalSetup: './e2e/globalSetup.ts',
  globalTeardown: './e2e/globalTeardown.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI (more stable)
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5174',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'on-first-retry',
  },

  // Configure Chromium projects for launch validation.
  // Safari/WebKit coverage is intentionally skipped on Windows for now.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...chromiumLaunchOptions },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], ...chromiumLaunchOptions },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    // Reusing an arbitrary process on this fixed port can silently test a
    // different checkout/worktree. Opt in only when the caller owns it.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
    timeout: 120 * 1000,
  },

  // Global timeout for each test.
  //
  // 60s rather than 30s because the authenticated fixture now unlocks the vault
  // before a test body starts, and Argon2id at 64 MB and 3 iterations is seconds
  // of wasm work on a shared CI runner — on top of the sign-in round trip. This
  // is a ceiling, not a cost: the unauthenticated specs finish in about a second
  // each and are unaffected.
  timeout: 60 * 1000,

  // Expect timeout
  expect: {
    timeout: 5 * 1000,
  },
});
