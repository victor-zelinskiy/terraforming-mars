import {defineConfig, devices} from '@playwright/test';

/**
 * Playwright configuration for local E2E / visual regression testing of the
 * Terraforming Mars UI (vize1215 fork).
 *
 * This is intentionally minimal infrastructure: a single Chromium project that
 * points at the locally running app. Specs live in `tests/e2e/` and are kept
 * fully separate from the Mocha server/client suites.
 *
 * The app is served by the project's own HTTP server on port 8080
 * (see `npm start` -> build/src/server/server.js). Override the target with the
 * BASE_URL env var, e.g. `BASE_URL=http://localhost:3000 npm run test:e2e`.
 *
 * NOTE: the server serves the *built* client from `build/`. Run `npm run build`
 * once before the first E2E run (and after client/style changes) so the assets
 * Playwright loads are up to date.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',

  // Each spec is independent; run them in parallel.
  fullyParallel: true,

  // Fail the CI build if a `test.only` was committed by accident.
  forbidOnly: isCI,

  // Retries give the "trace on retry" / "video on failure" artifacts a chance
  // to be produced. Locally we keep 0 so a flaky run surfaces immediately.
  retries: isCI ? 2 : 0,

  // A single worker on CI keeps the shared game server stable; parallel locally.
  workers: isCI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', {outputFolder: 'playwright-report', open: 'never'}],
  ],

  // Where screenshots / traces / videos for a failed run are written.
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    viewport: {width: 1440, height: 1000},

    // Diagnostics — only kept when something actually goes wrong, to keep the
    // artifact footprint small.
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],

  // Boot the app for the test run. If a server is already listening on BASE_URL
  // (e.g. you started `npm start` yourself), Playwright reuses it instead of
  // spawning a second one.
  webServer: {
    command: 'npm start',
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
