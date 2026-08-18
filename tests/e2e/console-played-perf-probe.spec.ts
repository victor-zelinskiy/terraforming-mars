/*
 * CONSOLE «РАЗЫГРАНО» (full tableau) PERFORMANCE PROBE — a MEASUREMENT
 * harness, not a regression gate. Env-gated (`PLAYED_PERF=1`), skipped in
 * every ordinary run. The measurement idiom mirrors
 * `console-recv-perf-probe.spec.ts` (CDP metrics + long-task observer +
 * 16 ms interval jitter — rAF is compositor-starved headless, so jank is
 * judged by main-thread availability; see [[e2e-raf-probe-dies-headless]]).
 *
 * WHAT IT MEASURES, per tableau size (20/50/100/200) and per display profile
 * (deck-handheld 1280×800 with 4× CPU throttle ≈ a Steam-Deck-class main
 * thread; tv-4k 3840×2160 unthrottled):
 *
 *   1. OPEN BY X — keydown → overlay-in-DOM latency, content-settled
 *      latency, long tasks, CDP deltas (Nodes/Layout/Style/Script/Heap),
 *      DOM census (faces, art imgs, overlay nodes).
 *   2. CATEGORY OPEN (the biggest family) — flight proxy peak, long tasks,
 *      time to the framed grid, grid census; then CLOSE the same way.
 *   3. GRID NAV LATENCY — keydown → focus-mutation per press (p50/p95/max).
 *   4. CLOSE — Escape → overlay-out-of-DOM latency, teardown long task.
 *   5. 20 OPEN/CLOSE CYCLES — Nodes / JSEventListeners / JSHeapUsedSize
 *      after forced GC at cycles 1/5/10/20 (cumulative-degradation axis).
 *   6. CLOSED-STATE idle windows (3 s) BEFORE first open and AFTER the last
 *      close — long tasks + tick jitter + node/listener/heap deltas (the
 *      «closed tableau must cost nothing» gate).
 *   7. THE INFOPANEL DOOR — Y → Info Mode → X → the embedded played detail:
 *      same open-latency + census read.
 *
 * Games come pre-seeded on disk (tests/perf/seed-played-tableau.ts) and
 * served by a LOCAL_FS_DB server — the probe never plays cards.
 *
 * Results land in `screenshots/played-perf/<PLAYED_PERF_LABEL>/…` as JSON +
 * screenshots; compare labels (e.g. `baseline` vs `rework`) by hand. The
 * probe asserts only structural sanity, never absolute numbers.
 *
 * Run:
 *   npx tsx tests/perf/seed-played-tableau.ts
 *   LOCAL_FS_DB=1 PORT=8123 node build/src/server/server.js
 *   PLAYED_PERF=1 PLAYED_PERF_LABEL=baseline BASE_URL=http://localhost:8123 \
 *     npx playwright test tests/e2e/console-played-perf-probe.spec.ts --workers=1
 */
import {expect, test, Page, CDPSession} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const RUN = process.env.PLAYED_PERF === '1';
const LABEL = process.env.PLAYED_PERF_LABEL ?? 'run';
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'played-perf', LABEL);

type SeededGame = {n: number, gameId: string, playerId: string};
const MANIFEST_PATH = path.join(__dirname, '..', 'perf', 'played-perf-games.json');
const GAMES: Array<SeededGame> = RUN ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : [];

const PROFILES = [
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld', cpuThrottle: 4},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', cpuThrottle: 1},
] as const;

// ── in-page samplers (recv-perf idiom) ─────────────────────────────────────

type PerfWindow = {
  longTasks: number, longTaskMax: number, longTaskTotal: number,
  tickCount: number, tickJank50: number, tickJank120: number, tickMax: number,
};

async function armPerfWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__perfStop?.();
    const rec = {longTasks: 0, longTaskMax: 0, longTaskTotal: 0, tickCount: 0, tickJank50: 0, tickJank120: 0, tickMax: 0};
    w.__perfWin = rec;
    let obs: PerformanceObserver | undefined;
    try {
      obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          rec.longTasks++;
          rec.longTaskTotal += e.duration;
          rec.longTaskMax = Math.max(rec.longTaskMax, e.duration);
        }
      });
      obs.observe({entryTypes: ['longtask']});
    } catch { /* jitter meter still stands */ }
    let last = performance.now();
    const iv = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      rec.tickCount++;
      rec.tickMax = Math.max(rec.tickMax, dt);
      if (dt > 50) {
        rec.tickJank50++;
      }
      if (dt > 120) {
        rec.tickJank120++;
      }
    }, 16);
    w.__perfStop = () => {
      obs?.disconnect();
      clearInterval(iv);
    };
  });
}

async function readPerfWindow(page: Page): Promise<PerfWindow> {
  return await page.evaluate(() => {
    const w = window as any;
    w.__perfStop?.();
    return w.__perfWin;
  }) as PerfWindow;
}

type CdpMetrics = Record<string, number>;

async function cdpMetrics(cdp: CDPSession): Promise<CdpMetrics> {
  const res = await cdp.send('Performance.getMetrics') as {metrics: Array<{name: string, value: number}>};
  const out: CdpMetrics = {};
  for (const m of res.metrics) {
    out[m.name] = m.value;
  }
  return out;
}

const DELTA_KEYS = ['Nodes', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount',
  'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration', 'JSHeapUsedSize'];

function metricsDelta(a: CdpMetrics, b: CdpMetrics): CdpMetrics {
  const out: CdpMetrics = {};
  for (const k of DELTA_KEYS) {
    out[k] = Math.round(((b[k] ?? 0) - (a[k] ?? 0)) * 1000) / 1000;
  }
  return out;
}

function snapshotOf(m: CdpMetrics): CdpMetrics {
  const out: CdpMetrics = {};
  for (const k of ['Nodes', 'JSEventListeners', 'JSHeapUsedSize']) {
    out[k] = m[k] ?? 0;
  }
  return out;
}

/** Headless Chromium starves rAF on a static frame — force BeginFrames so
 *  GSAP/vue-transition driven flows actually advance. */
async function pumpFrames(page: Page, times: number, gapMs: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(gapMs);
  }
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

// ── census reads ───────────────────────────────────────────────────────────

async function overlayCensus(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    const root = document.querySelector('.con-played');
    const q = (sel: string) => root === null ? 0 : root.querySelectorAll(sel).length;
    return {
      overlayNodes: root === null ? 0 : root.querySelectorAll('*').length,
      pcards: q('.pcard'),
      fullFaces: q('.pcard__lower'),
      artImgs: q('.pcard__art img'),
      slots: q('.con-played__slot'),
      catSlots: q('.con-played-cat__slot'),
      catProxies: q('.con-played-cat__proxy'),
      docNodes: document.querySelectorAll('*').length,
    };
  });
}

/** Arm the open-latency probe: keydown timestamp + overlay/content mutation
 *  timestamps, plus a face-count settle tracker. */
async function armOpenProbe(page: Page, keyCode: string, rootSel: string): Promise<void> {
  await page.evaluate(({keyCode, rootSel}) => {
    const w = window as any;
    w.__openStop?.();
    const t = {pressAt: 0, rootAt: 0, lastGrowthAt: 0, faceCount: 0, proxyMax: 0};
    w.__openT = t;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === keyCode && t.pressAt === 0) {
        t.pressAt = performance.now();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const mo = new MutationObserver(() => {
      const root = document.querySelector(rootSel);
      if (root !== null && t.rootAt === 0) {
        t.rootAt = performance.now();
      }
      if (root !== null) {
        const n = root.querySelectorAll('.pcard').length;
        if (n !== t.faceCount) {
          t.faceCount = n;
          t.lastGrowthAt = performance.now();
        }
      }
      const proxies = document.querySelectorAll('.con-played-cat__proxy').length;
      t.proxyMax = Math.max(t.proxyMax, proxies);
    });
    mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
    w.__openStop = () => {
      window.removeEventListener('keydown', onKey, true);
      mo.disconnect();
    };
  }, {keyCode, rootSel});
}

type OpenProbe = {pressAt: number, rootAt: number, lastGrowthAt: number, faceCount: number, proxyMax: number};

async function readOpenProbe(page: Page): Promise<OpenProbe> {
  return await page.evaluate(() => {
    const w = window as any;
    w.__openStop?.();
    return w.__openT;
  }) as OpenProbe;
}

/** Click-based open of a category (focus click + open click). */
async function openCategory(page: Page, key: string): Promise<void> {
  const zone = page.locator(`[data-played-cat="${key}"]`).first();
  await zone.click();
  await page.waitForTimeout(80);
  await zone.click();
}

/** Per-press nav latency inside the category grid: keydown → the focused
 *  slot class moving (attribute mutation). DOM-update latency — paint is
 *  compositor-gated headless, but the JS+render cost is what scales. */
async function navLatencyProbe(page: Page, presses: number): Promise<Array<number>> {
  await page.evaluate(() => {
    const w = window as any;
    w.__navStop?.();
    const rec: {pending: number, lat: Array<number>} = {pending: 0, lat: []};
    w.__navRec = rec;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'ArrowLeft' || e.code === 'ArrowDown') {
        rec.pending = performance.now();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const mo = new MutationObserver((muts) => {
      if (rec.pending === 0) {
        return;
      }
      for (const m of muts) {
        const el = m.target as HTMLElement;
        if (el.classList?.contains('con-played-cat__slot--focused')) {
          rec.lat.push(performance.now() - rec.pending);
          rec.pending = 0;
          return;
        }
      }
    });
    mo.observe(document.body, {attributes: true, subtree: true, attributeFilter: ['class']});
    w.__navStop = () => {
      window.removeEventListener('keydown', onKey, true);
      mo.disconnect();
    };
  });
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'ArrowDown' : 'ArrowRight');
    await page.waitForTimeout(180);
  }
  return await page.evaluate(() => {
    const w = window as any;
    w.__navStop?.();
    return w.__navRec.lat;
  }) as Array<number>;
}

function pct(sorted: Array<number>, p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[i] * 10) / 10;
}

// ── the probe ──────────────────────────────────────────────────────────────

/** Per-scenario budget. A slow BASELINE run can exceed the default (the
 *  n≥100 deck scenarios genuinely take minutes each there) — override with
 *  PLAYED_PERF_TIMEOUT. Deliberately NOT `serial`: with `--workers=1` the
 *  order is already sequential, and one over-budget scenario must not skip
 *  the rest of the matrix. */
const SCENARIO_TIMEOUT = Number(process.env.PLAYED_PERF_TIMEOUT ?? 420_000);

test.describe('console played-tableau performance probe', () => {
  test.skip(!RUN, 'PLAYED_PERF=1 required');
  test.setTimeout(SCENARIO_TIMEOUT);

  for (const profile of PROFILES) {
    for (const seeded of GAMES) {
      test(`${profile.id} n=${seeded.n}`, async ({page}) => {
        test.setTimeout(SCENARIO_TIMEOUT);
        await page.setViewportSize(profile.viewport);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        if (profile.cpuThrottle > 1) {
          await cdp.send('Emulation.setCPUThrottlingRate', {rate: profile.cpuThrottle});
        }

        const report: Record<string, unknown> = {
          label: LABEL, profile: profile.id, n: seeded.n,
          viewport: profile.viewport, cpuThrottle: profile.cpuThrottle,
          startedAt: new Date().toISOString(),
        };

        await page.goto(`/player?id=${seeded.playerId}&console=1${profile.query}`);
        await page.locator('.con-root').waitFor({state: 'visible', timeout: 60_000});
        // Let the board settle (fit engines, fonts, first data render).
        await pumpFrames(page, 4, 250);
        await page.waitForTimeout(1500);
        await pumpFrames(page, 2, 120);

        // ── 6a. closed-state idle BEFORE first open ──────────────────────
        await armPerfWindow(page);
        await page.waitForTimeout(3000);
        report.idleBefore = await readPerfWindow(page);
        await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
        const closedBefore = await cdpMetrics(cdp);
        report.closedBefore = snapshotOf(closedBefore);

        // ── 1. OPEN BY X ─────────────────────────────────────────────────
        await armOpenProbe(page, 'KeyX', '.con-played');
        await armPerfWindow(page);
        const mOpen0 = await cdpMetrics(cdp);
        await page.keyboard.press('KeyX');
        await page.locator('.con-played').waitFor({state: 'visible', timeout: 30_000});
        await pumpFrames(page, 6, 120);
        await page.waitForTimeout(600);
        const openProbe = await readOpenProbe(page);
        const mOpen1 = await cdpMetrics(cdp);
        report.openWindow = await readPerfWindow(page);
        report.open = {
          overlayInDomMs: openProbe.rootAt > 0 ? Math.round((openProbe.rootAt - openProbe.pressAt) * 10) / 10 : -1,
          contentSettledMs: openProbe.lastGrowthAt > 0 ? Math.round((openProbe.lastGrowthAt - openProbe.pressAt) * 10) / 10 : -1,
          faces: openProbe.faceCount,
          metrics: metricsDelta(mOpen0, mOpen1),
        };
        report.openCensus = await overlayCensus(page);
        await shoot(page, `${profile.id}-n${seeded.n}-1-table`);

        // ── 2. CATEGORY OPEN (the biggest family) ────────────────────────
        const biggest = await page.evaluate(() => {
          let best = '';
          let bestN = -1;
          document.querySelectorAll('.con-played [data-played-cat]').forEach((el) => {
            const n = el.querySelectorAll('.con-played__slot').length;
            if (n > bestN) {
              bestN = n;
              best = (el as HTMLElement).dataset.playedCat ?? '';
            }
          });
          return best;
        });
        report.categoryKey = biggest;
        await armOpenProbe(page, 'Enter', '.con-played-cat');
        await armPerfWindow(page);
        const mCat0 = await cdpMetrics(cdp);
        const catT0 = Date.now();
        await openCategory(page, biggest);
        await page.locator('.con-played-cat').waitFor({state: 'visible', timeout: 60_000});
        // The flight needs frames to advance; pump until framed or timeout.
        for (let i = 0; i < 40; i++) {
          await pumpFrames(page, 1, 90);
          const framed = await page.locator('.con-played-cat--framed').count();
          if (framed > 0) {
            break;
          }
        }
        await pumpFrames(page, 4, 120);
        await page.waitForTimeout(400);
        const catProbe = await readOpenProbe(page);
        // GC before the read: the Nodes/Heap delta should mean RETAINED, not
        // «churned and not yet collected».
        await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
        await page.waitForTimeout(120);
        const mCat1 = await cdpMetrics(cdp);
        report.catOpenWindow = await readPerfWindow(page);
        report.catOpen = {
          wallMs: Date.now() - catT0,
          proxyPeak: catProbe.proxyMax,
          metrics: metricsDelta(mCat0, mCat1),
        };
        report.catCensus = await overlayCensus(page);
        await shoot(page, `${profile.id}-n${seeded.n}-2-category`);

        // ── 3. GRID NAV LATENCY ──────────────────────────────────────────
        const lat = (await navLatencyProbe(page, 9)).sort((a, b) => a - b);
        report.navLatency = {samples: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), max: pct(lat, 100)};

        // ── 2b. CATEGORY CLOSE ───────────────────────────────────────────
        await armPerfWindow(page);
        const mCatC0 = await cdpMetrics(cdp);
        await page.keyboard.press('Escape');
        for (let i = 0; i < 40; i++) {
          await pumpFrames(page, 1, 90);
          const up = await page.locator('.con-played-cat').count();
          if (up === 0) {
            break;
          }
        }
        const mCatC1 = await cdpMetrics(cdp);
        report.catCloseWindow = await readPerfWindow(page);
        report.catClose = {metrics: metricsDelta(mCatC0, mCatC1)};

        // ── 4. CLOSE THE OVERLAY ─────────────────────────────────────────
        await armPerfWindow(page);
        const tClose0 = Date.now();
        await page.keyboard.press('Escape');
        await page.locator('.con-played').waitFor({state: 'detached', timeout: 30_000});
        report.close = {wallMs: Date.now() - tClose0};
        await pumpFrames(page, 3, 120);
        report.closeWindow = await readPerfWindow(page);

        // ── 5. 20 OPEN/CLOSE CYCLES ──────────────────────────────────────
        const cycles: Array<Record<string, number>> = [];
        const cycleOpenMs: Array<number> = [];
        for (let i = 1; i <= 20; i++) {
          const t0 = Date.now();
          await page.keyboard.press('KeyX');
          await page.locator('.con-played').waitFor({state: 'visible', timeout: 30_000});
          cycleOpenMs.push(Date.now() - t0);
          await page.waitForTimeout(seeded.n >= 100 ? 350 : 200);
          await page.keyboard.press('Escape');
          await page.locator('.con-played').waitFor({state: 'detached', timeout: 30_000});
          await page.waitForTimeout(120);
          if (i === 1 || i === 5 || i === 10 || i === 20) {
            await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
            await page.waitForTimeout(150);
            const m = await cdpMetrics(cdp);
            cycles.push({cycle: i, ...snapshotOf(m)});
          }
        }
        report.cycles = cycles;
        const sortedOpen = [...cycleOpenMs].sort((a, b) => a - b);
        report.cycleOpen = {
          samples: sortedOpen.length,
          p50: pct(sortedOpen, 50),
          p95: pct(sortedOpen, 95),
          max: pct(sortedOpen, 100),
        };

        // ── 6b. closed-state idle AFTER the last close ───────────────────
        await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
        await page.waitForTimeout(300);
        await armPerfWindow(page);
        await page.waitForTimeout(3000);
        report.idleAfter = await readPerfWindow(page);
        const closedAfter = await cdpMetrics(cdp);
        report.closedAfter = snapshotOf(closedAfter);
        report.closedDelta = metricsDelta(closedBefore, closedAfter);

        // ── 7. THE INFOPANEL DOOR ────────────────────────────────────────
        await armOpenProbe(page, 'KeyX', '.con-info .con-played');
        await page.keyboard.press('KeyY');
        await page.locator('.con-info').waitFor({state: 'visible', timeout: 30_000});
        await pumpFrames(page, 2, 150);
        await page.waitForTimeout(400);
        await armPerfWindow(page);
        const mInfo0 = await cdpMetrics(cdp);
        await page.keyboard.press('KeyX');
        await page.locator('.con-info .con-played').waitFor({state: 'visible', timeout: 30_000});
        await pumpFrames(page, 4, 120);
        await page.waitForTimeout(500);
        const infoProbe = await readOpenProbe(page);
        const mInfo1 = await cdpMetrics(cdp);
        report.infoOpenWindow = await readPerfWindow(page);
        report.infoOpen = {
          overlayInDomMs: infoProbe.rootAt > 0 ? Math.round((infoProbe.rootAt - infoProbe.pressAt) * 10) / 10 : -1,
          contentSettledMs: infoProbe.lastGrowthAt > 0 ? Math.round((infoProbe.lastGrowthAt - infoProbe.pressAt) * 10) / 10 : -1,
          faces: infoProbe.faceCount,
          metrics: metricsDelta(mInfo0, mInfo1),
        };
        await shoot(page, `${profile.id}-n${seeded.n}-3-info`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);

        // sanity: the probe drove the real flow
        expect((report.open as {faces: number}).faces).toBeGreaterThan(0);

        fs.mkdirSync(OUT, {recursive: true});
        fs.writeFileSync(
          path.join(OUT, `report-${profile.id}-n${seeded.n}.json`),
          JSON.stringify(report, null, 2));
      });
    }
  }
});
