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

/*
 * THE E2E RUNS ON THE STEAM MACHINE — the owner's decision 2026-10-21, enforced here, not only in a rule.
 * The laptop carries several sessions, builds and watchers at once; a Playwright run there is a verdict
 * about the load, and it loads the box every other session works on. `npm run e2e:remote -- <task> <spec…>`
 * mirrors the build to the Steam Machine and runs there (`TM_E2E_HOST` is set by that wrapper); CI keeps
 * its own runners; `--list` launches no browser. `TM_E2E_LAPTOP_OVERRIDE=1` exists for the OWNER's explicit,
 * per-case permission (a display-bound `--ui` / `--headed` debug session) — never an agent's own decision.
 */
if (!isCI && !process.env.TM_E2E_HOST && process.env.TM_E2E_LAPTOP_OVERRIDE !== '1' && !process.argv.includes('--list')) {
  throw new Error(
    'e2e runs ONLY on the Steam Machine: `npm run e2e:remote -- <task> tests/e2e/<spec>.spec.ts [args…]` ' +
    '(docs/claude/e2e-remote.md). The laptop runs no Playwright browsers — TM_E2E_LAPTOP_OVERRIDE=1 only with ' +
    'the owner\'s explicit permission for this one run.');
}

/*
 * The GPU road per platform (TM_E2E_GPU=1). Windows: ANGLE over D3D11 — the RTX laptop driving the
 * TV. Linux: the Steam Machine (`npm run e2e:remote` — a quiet AMD box on the LAN, RADV/Mesa inside
 * an Ubuntu distrobox): ANGLE over Vulkan — `DefaultANGLEVulkan` is the piece without which ANGLE
 * tries native EGL and falls back to SwiftShader (`electron/perf.ts` says the same of the product).
 * Deliberately NOT the product's full recipe: with the Vulkan COMPOSITOR (`Vulkan,VulkanFromANGLE`)
 * the headless GPU process has no surface and crashed 3× per launch (measured 2026-10-21: WebGL
 * lost, raster still hardware), and `--disable-vulkan-surface` turned the compositing software.
 * Measured on the Steam Machine with this set: 0 crashes, raster + compositing hardware,
 * WebGL «ANGLE (AMD, Vulkan … RADV NAVI33)», 61 fps on a 300-layer scene.
 */
const GPU_ARGS = process.platform === 'linux' ?
  ['--use-angle=vulkan', '--enable-features=DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'] :
  ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-zero-copy'];

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
    // On the Steam Machine every task gets its own report + output dirs (`scripts/e2e-remote.mjs` sets both):
    // two sessions' runs are serialized there, and the next one wiped the previous one's `test-results/`
    // before its owner had pulled it (seen 2026-10-21).
    ['html', {outputFolder: process.env.TM_E2E_REPORT_DIR ?? 'playwright-report', open: 'never'}],
  ],

  // Where screenshots / traces / videos for a failed run are written.
  outputDir: process.env.TM_E2E_OUTPUT_DIR ?? 'test-results',

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
      use: {
        ...devices['Desktop Chrome'],
        /*
         * PL-211 (the owner's decision 2026-10-12): `TM_E2E_GPU=1` runs the NEW headless (`channel: 'chromium'`) on
         * the machine's GPU through ANGLE/D3D11 with GPU raster — the road the TV build takes (the RTX laptop,
         * Electron's GPU raster). The default headless shell renders with SwiftShader: every 4K commit waits on a
         * CPU compositor (150–380 ms, PL-149), and under two workers holds hit their ceilings — red that is not the
         * product's. Opt-in, never on CI (Linux runners have no GPU): a 4K storyboard / timing claim is taken with it.
         */
        ...(process.env.TM_E2E_GPU === '1' && !isCI ? {
          channel: 'chromium',
          launchOptions: {args: GPU_ARGS},
        } : {}),
      },
    },
  ],

  // NO webServer: every WORKER boots its own server + throwaway DB via the
  // worker fixture in tests/e2e/consoleTest.ts (phase 3 of
  // docs/E2E_ARCHITECTURE_REWORK.md) — a free port from the OS, TM_DB_FOLDER
  // temp dir, torn down with the worker. That is what makes workers>1 safe:
  // runs share NOTHING but the build — and with TM_E2E_ROOT pointing at a
  // private snapshot (`npm run e2e:snapshot <name>`) not even that. Requires
  // a built server (`npm run build`). Debug escape hatch: TM_E2E_SHARED_SERVER=1
  // points every worker at BASE_URL (default http://localhost:8080) the old way.
});
