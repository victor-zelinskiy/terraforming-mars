import * as fs from 'fs';
import * as path from 'path';
import {monitorEventLoopDelay} from 'perf_hooks';
import {test, expect} from './consoleTest';
import {bootFixture, settle} from './consoleStart';
import {probeNative, readLongFrames} from './hungPageWatch';

/** The tree the worker server runs from (as `consoleTest.ts` resolves it). */
const SERVE_ROOT = path.resolve(__dirname, '..', '..', process.env.TM_E2E_ROOT ?? '.');

/**
 * POSITIVE CONTROL of the harness's `hungPageWatch` (`hungPageWatch.ts`): a page whose main thread spins in a named
 * function for longer than the watch's threshold must be PAUSED from outside and its stack filed as a `hung-page`
 * annotation naming that function — the diagnosis CI's 300 s `console-parliament-climate` timeout never had. A watch
 * that silently stopped working would leave the next hang as opaque as that one.
 */
test('a hung main thread is paused from outside and its stack is filed', async ({page}, testInfo) => {
  test.setTimeout(60_000);
  await page.setContent('<html><body>control</body></html>');
  await page.evaluate(() => {
    const w = window as unknown as {hungPageControlSpin: (until: number) => number};
    w.hungPageControlSpin = function hungPageControlSpin(until: number): number {
      let turns = 0;
      while (Date.now() < until) {
        turns++; // the hang under test
      }
      return turns;
    };
    window.setTimeout(() => w.hungPageControlSpin(Date.now() + 16_000), 50);
  });
  await expect.poll(() => testInfo.annotations.filter((a) => a.type === 'hung-page').length,
    {timeout: 40_000, intervals: [500], message: 'the watch filed the hung page'}).toBeGreaterThan(0);
  const filed = testInfo.annotations.find((a) => a.type === 'hung-page')?.description ?? '';
  expect(filed, `the filed stack names the spinning function:\n${filed}`).toMatch(/hungPageControlSpin/);
  // the thread comes back: the page answers again once the spin is over
  await expect.poll(() => page.evaluate(() => 1), {timeout: 30_000}).toBe(1);
});

/**
 * THE REAL APP, THE REAL MAPS, THE REAL BOUND (CI 2026-11-09, run 42591455049 — `console-parliament-climate` ran to the
 * 300 s test timeout with the bounded settle in place and the watch filing nothing). The console page's main thread
 * is made to spin INSIDE A PRODUCT CALL (the console's key handler reading `event.code`) while a `settle` reads it:
 * ① the settle must throw «HUNG» within its own bound (5 s + the grace), never by eating the test budget;
 * ② the watch must file a `hung-page` stack that names the spin AND a frame mapped through the build's own source map
 *    (a `.ts` / `.vue` source — the product frame under it);
 * ③ the WORKER's event loop must never stall while it does that (the bound and the watch are Node timers: a worker
 *    blocked by its own diagnosis is exactly how a bound «does not fire»).
 */
test('a hung APP page: settle throws within its bound, the watch files a mapped stack, the worker never stalls', async ({page, request}, testInfo) => {
  test.setTimeout(120_000);
  await bootFixture(page, request, 'solo-actions');
  const lag = monitorEventLoopDelay({resolution: 20});
  lag.enable();
  try {
    await page.evaluate(() => {
      const desc = Object.getOwnPropertyDescriptor(KeyboardEvent.prototype, 'code');
      if (desc?.get === undefined) {
        throw new Error('KeyboardEvent.code has no getter');
      }
      const read = desc.get;
      let armed = true;
      const hungAppSpin = (until: number): number => {
        let turns = 0;
        while (Date.now() < until) {
          turns++; // the hang under test — inside the product's key handler
        }
        return turns;
      };
      Object.defineProperty(KeyboardEvent.prototype, 'code', {
        configurable: true,
        get(this: KeyboardEvent) {
          if (armed && (this as unknown as {hungControl?: boolean}).hungControl === true) {
            armed = false;
            hungAppSpin(Date.now() + 40_000);
          }
          return read.call(this);
        },
      });
      window.setTimeout(() => {
        const e = new KeyboardEvent('keydown', {code: 'F24', key: 'F24', bubbles: true});
        (e as unknown as {hungControl: boolean}).hungControl = true;
        window.dispatchEvent(e);
      }, 0);
    });
    const t0 = Date.now();
    const error = await settle(page, {timeoutMs: 5_000}).then(() => undefined, (e: unknown) => e as Error);
    const tookMs = Date.now() - t0;
    expect(error?.message ?? '(settle returned)', 'the settle names the hung page').toMatch(/HUNG/);
    expect(tookMs, 'the settle threw within its own bound (5 s + the grace), never the test budget').toBeLessThan(20_000);
    await expect.poll(() => testInfo.annotations.filter((a) => a.type === 'hung-page').length,
      {timeout: 40_000, intervals: [500], message: 'the watch filed the hung app page'}).toBeGreaterThan(0);
    const filed = (): string => testInfo.annotations.find((a) => a.type === 'hung-page')?.description ?? '';
    expect(filed(), `the filed stack names the spin:\n${filed()}`).toMatch(/hungAppSpin/);
    // The product frame under it is NAMED by its script (a call frame's own `url` is empty in current Chromium)…
    expect(filed(), `the product frame is named by its script:\n${filed()}`).toMatch(/\b(main|vendors)\.js:\d+:\d+\)|\.(ts|vue)(\?[^:]*)?:\d+:\d+\)/);
    // …and MAPPED through the build's source map wherever the map was built beside it (CI builds it; the box's mirror
    // ships no `.map` — `scripts/e2e-remote.mjs` `buildSkip`).
    if (fs.existsSync(path.join(SERVE_ROOT, 'build', 'main.js.map'))) {
      await expect.poll(filed, {timeout: 20_000, intervals: [500], message: 'the stack is mapped to the product source'})
        .toMatch(/\.(ts|vue)(\?[^:]*)?:\d+:\d+\)/);
    }
    const maxLagMs = lag.max / 1e6;
    console.log(`[hung-control] settle threw after ${tookMs} ms; the worker's longest event-loop stall ${Math.round(maxLagMs)} ms`);
    expect(maxLagMs, 'the worker event loop never stalled while the watch diagnosed the page').toBeLessThan(2_000);
  } finally {
    lag.disable();
  }
  // the thread comes back once the spin is over
  await expect.poll(() => page.evaluate(() => 1), {timeout: 60_000}).toBe(1);
});

/**
 * THE NATIVE PROBE READS THE PROCESSES' OWN CLOCKS (CI 2026-11-09, run 42626840874 — `hand-album-probe` tail 3 hung for
 * 15 minutes with every pause «never landed»: the main thread was outside JS, and «busy» vs «waiting» was unreadable).
 * Against a renderer it KNOWS is burning CPU (a JS spin), the probe must read that renderer BUSY, and on Linux name its
 * main thread running (state R) with ticks spent in the window — the same reading that tells a native layout / raster
 * loop (busy) from a wait on the GPU process or an IPC (idle, a wait channel) when the pause cannot land.
 */
test('the native probe reads a busy renderer as BUSY, its main thread running', async ({page, context}) => {
  test.setTimeout(60_000);
  // a MAIN-THREAD animation keeps a rendering update pending, so the spin holds a FRAME (a long-animation-frame
  // entry is recorded only for a frame that was due) — the same shape as a page held in the middle of a motion
  await page.setContent('<html><head><style>@keyframes m { to { left: 200px } } #m { position: absolute; left: 0; animation: m 1s linear infinite alternate }</style></head><body><div id="m">control</div></body></html>');
  await page.evaluate(() => {
    window.setTimeout(() => {
      const until = Date.now() + 12_000;
      let turns = 0;
      while (Date.now() < until) {
        turns++; // a renderer burning CPU
      }
      return turns;
    }, 50);
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const reading = await probeNative(context, page);
  console.log(`[hung-control] native probe:\n    ${reading}`);
  expect(reading, `a renderer read BUSY:\n${reading}`).toMatch(/renderer pid \d+: cpu \+[\d.]+ s in \d+ s \(\d+%\) — BUSY/);
  if (process.platform === 'linux') {
    expect(reading, `its main thread running:\n${reading}`).toMatch(/MAIN .*state R · [1-9]\d* ticks/);
  }
  expect(reading, 'the compositor is asked too').toMatch(/compositor: /);
  await expect.poll(() => page.evaluate(() => 1), {timeout: 30_000}).toBe(1);
  // …and once it answers again, its own Long Animation Frame record names the frame that held it, split by phase
  const frames = await readLongFrames(page);
  console.log(`[hung-control] long frames:\n    ${frames}`);
  expect(frames, `the held frame is read back with its phases:\n${frames}`).toMatch(/frame \d+ ms @\d+: script \d+ · rAF\/observers \d+ · style\+layout\+paint \d+/);
});
