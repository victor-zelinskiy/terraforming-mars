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

  /*
   * A single worker on CI keeps the shared game server stable.
   *
   * LOCALLY THE CAP IS 4, AND IT IS NOT A PERFORMANCE TWEAK — it is what keeps
   * the results honest. Playwright's default is «half the cores», which on a
   * 20-core box meant ~10 concurrent Chromium instances, several of them
   * rendering a 3840x2160 console profile. The machine then misses the app's
   * FIRST PAINT and specs die inside `openConsole`:
   *
   *   TimeoutError: page.waitForSelector: Timeout 90000ms exceeded
   *     - waiting for locator('.con-start__frame, .con-root')
   *
   * That failure is indistinguishable from a product bug in the report, and it
   * cost a full day of chasing symptoms. Proof it is the harness and not the
   * app: `console-action-focus`, `console-info-workspace`, `console-start-sponsor`,
   * `console-start-summary` and `console-play-landing-probe` all fail in the
   * parallel run and all pass on `--workers=1`.
   *
   * 4 keeps most of the wall-clock win while leaving each 4K profile enough
   * GPU/CPU to paint. Raise it only with evidence, not with a bigger machine.
   */
  workers: isCI ? 1 : 4,

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
    //
    // On CI video is OFF: a separate webm per FAILED ATTEMPT (x3 with retries,
    // some specs at the 4K console profile) was the first reason the merged
    // HTML report ballooned to gigabytes.
    //
    // On CI the trace ALSO drops its screencast film strip. Measured on a
    // green 1.1-minute spec: trace.zip = 140 MB, of which 106 MB was 1539
    // jpeg screencast frames (~23 fps) — 76% of the weight. DOM snapshots
    // STAY: the trace viewer still renders a Before/After image for every
    // action, which is the per-action visual record triage actually needs;
    // only the continuous film strip under the timeline is lost. A local
    // deep-dive is unaffected — `--trace=on` on the CLI records the full-fat
    // trace, film strip included.
    screenshot: 'only-on-failure',
    trace: isCI ? {mode: 'on-first-retry', screenshots: false} : 'on-first-retry',
    video: isCI ? 'off' : 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],

  // NO webServer: every WORKER boots its own server + throwaway DB via the
  // worker fixture in tests/e2e/consoleTest.ts (phase 3 of
  // docs/E2E_ARCHITECTURE_REWORK.md) — port 8100+workerIndex, TM_DB_FOLDER
  // temp dir, torn down with the worker. That is what makes workers>1 safe:
  // runs share NOTHING but the build. Requires a built server
  // (`npm run build`). Debug escape hatch: TM_E2E_SHARED_SERVER=1 points
  // every worker at BASE_URL (default http://localhost:8080) the old way.
});
