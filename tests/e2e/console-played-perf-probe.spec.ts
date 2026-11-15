/*
 * CONSOLE «РАЗЫГРАНО» (full tableau) PERFORMANCE PROBE — a MEASUREMENT
 * harness, not a regression gate. Env-gated (`PLAYED_PERF=1`), skipped in
 * every ordinary run. The measurement idiom mirrors
 * `console-recv-perf-probe.spec.ts` (CDP metrics + long-task observer +
 * the 16 ms tick jitter of a TIMING witness — rAF is compositor-starved
 * headless, so jank is judged by main-thread availability; see
 * [[e2e-raf-probe-dies-headless]]).
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
import {expect, test, Page, CDPSession} from './consoleTest';
import {cinematicBeat, focusInfoZone, pressUntilGone, pressUntilVisible, settle} from './consoleStart';
import type {ObservedSample} from './observeCore';
import {armWitness, witnessOf} from './witness';
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

// ── in-page instrumentation (recv-perf idiom) ──────────────────────────────

type LongTasks = {longTasks: number, longTaskMax: number, longTaskTotal: number};
type PerfWindow = LongTasks & {tickCount: number, tickJank50: number, tickJank120: number, tickMax: number};

/** The perf window's TIMING witness — one window at a time (re-arming starts a fresh record). */
const PERF_WINDOW = 'played-perf-window';
/** The recorder's TIMER tick (the old jitter meter's period): a free main thread runs it every 16 ms, a stalled one
 *  runs nothing — so a gap in the stamped series IS a stall. */
const TICK_MS = 16;
/** One stamped call of the recorder — the page's `performance.now()`. */
type PerfTick = {t: number};

/**
 * Arm a perf window: the page's own LONG-TASK API (a `PerformanceObserver` — the browser's record of a busy main thread,
 * not a sampler) + the tick jitter as a TIMING witness (`armWitness` + `tickMs`, FLAKE ZERO recipe 9): the reader stamps
 * every call, the series is read as recorded and a gap over 50 / 120 ms is a stall (`tickJitter`).
 */
async function armPerfWindow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__perfObs?.disconnect();
    w.__perfTick = undefined;
    const rec = {longTasks: 0, longTaskMax: 0, longTaskTotal: 0};
    w.__perfWin = rec;
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          rec.longTasks++;
          rec.longTaskTotal += e.duration;
          rec.longTaskMax = Math.max(rec.longTaskMax, e.duration);
        }
      });
      obs.observe({entryTypes: ['longtask']});
      w.__perfObs = obs;
    } catch { /* the tick series still stands */ }
  });
  await armWitness<PerfTick>(page, PERF_WINDOW, () => {
    // EVERY CALL IS STAMPED (so the recording keeps it — the series is the page's pace), at most one per 4 ms: the
    // observer and the timer tick may both call within one frame.
    const w = window as unknown as {__perfTick?: PerfTick};
    const now = performance.now();
    if (w.__perfTick !== undefined && now - w.__perfTick.t < 4) {
      return w.__perfTick;
    }
    w.__perfTick = {t: Math.round(now * 10) / 10};
    return w.__perfTick;
  }, {rafTick: false, tickMs: TICK_MS, max: 50_000});
}

/** The tick jitter of a recorded series — one document's stamps (a reload restarts `performance.now()`), never filled in. */
function tickJitter(samples: ReadonlyArray<ObservedSample<PerfTick>>): Omit<PerfWindow, keyof LongTasks> {
  const doc = samples.at(-1)?.doc;
  const stamps = samples.filter((s) => s.doc === doc).map((s) => s.v.t);
  const out = {tickCount: Math.max(0, stamps.length - 1), tickJank50: 0, tickJank120: 0, tickMax: 0};
  for (let i = 1; i < stamps.length; i++) {
    const dt = stamps[i] - stamps[i - 1];
    out.tickMax = Math.max(out.tickMax, dt);
    if (dt > 50) {
      out.tickJank50++;
    }
    if (dt > 120) {
      out.tickJank120++;
    }
  }
  return out;
}

async function readPerfWindow(page: Page): Promise<PerfWindow> {
  const ticks = await witnessOf<PerfTick>(page, PERF_WINDOW).stop();
  const long = await page.evaluate(() => {
    const w = window as any;
    w.__perfObs?.disconnect();
    return w.__perfWin;
  }) as LongTasks;
  return {...long, ...tickJitter(ticks)};
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
/**
 * THE OLD HEADLESS SHELL renders only when asked (its rAF starves on a quiet compositor), so the probe pumped frames
 * with an 8 × 8 screenshot. ON THE GPU (`TM_E2E_GPU=1` — the new headless, the road the TV build takes) the compositor
 * runs by itself, and a screenshot there is a synchronous capture that stalled the renderer's main thread for 1–3 s at
 * 4K — INSIDE the very windows the probe measures (PL-623: «long tasks» of 1.6–3.5 s that a Chromium trace of the same
 * open never shows). There the pump is the pause alone.
 */
const PUMP_BY_CAPTURE = process.env.TM_E2E_GPU !== '1';
/** ONE forced BeginFrame (the old headless shell only) — no pause of its own. */
async function pumpFrame(page: Page): Promise<void> {
  if (PUMP_BY_CAPTURE) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
  }
}
/** A MEASURED WINDOW's frames: `times` beats of `gapMs`, each with its forced frame — the window's length IS the
 *  measurement (what lands in its long tasks / CDP deltas), never a wait for a state. */
async function pumpFrames(page: Page, times: number, gapMs: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await pumpFrame(page);
    await cinematicBeat(page, gapMs, 'a frame beat of a measured window — its length is the measurement');
  }
}

/** The board home at rest: the boot veil gone, then the console quiet (holds, transport, finite motion). */
async function boardAtRest(page: Page): Promise<void> {
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await pumpFrame(page);
  await settle(page);
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

type OpenProbe = {pressAt: number, rootAt: number, lastGrowthAt: number, faceCount: number, proxyMax: number};
type OpenArgs = {keyCode: string, rootSel: string, arm: number, censusMs: number};
/** The open probe's witness key — one open at a time; `openArm` tells a re-arm's fresh state from the last one's. */
const OPEN_PROBE = 'played-open-probe';
/** The face census's period (the old sampler's): the census runs at most this often, and the timer tick keeps it going. */
const CENSUS_MS = 40;
let openArm = 0;

/**
 * Arm the open-latency probe — a TIMING witness (`armWitness`, FLAKE ZERO): the keydown timestamp (a capture listener
 * the reader installs with its fresh state), the root's arrival (stamped in the recorder's mutation callback — the task
 * that inserted it) and a face-count settle tracker. Every value is stamped by the reader itself, so the recording
 * keeps only CHANGES and the numbers are the page's `performance.now()`.
 *
 * THE WITNESS MAY NOT BE THE LOAD (PL-623): the census runs at most once per `CENSUS_MS` (the timer tick keeps it
 * going on a still page), over LIVE collections (a still DOM answers their length from cache). Counting every `.pcard`
 * on every mutation batch ran inside the very task it measured — and at 4K it inflated the open's long task from
 * ≈ 0.25 s to 0.8–2 s and the category's to 1.6–3.1 s (a Chromium trace of the same open,
 * `screenshots/tr65/perf.stand.spec.ts`).
 */
async function armOpenProbe(page: Page, keyCode: string, rootSel: string): Promise<void> {
  openArm++;
  await armWitness<OpenProbe, OpenArgs>(page, OPEN_PROBE, ({keyCode, rootSel, arm, censusMs}) => {
    type State = OpenProbe & {
      arm: number, censusAt: number, onKey: (e: KeyboardEvent) => void,
      root: Element | null, faces: HTMLCollection | null, proxies: HTMLCollection,
    };
    const w = window as unknown as {__playedOpenProbe?: State};
    let s = w.__playedOpenProbe;
    if (s === undefined || s.arm !== arm) {
      if (s !== undefined) {
        window.removeEventListener('keydown', s.onKey, true);
      }
      const fresh: State = {
        arm, pressAt: 0, rootAt: 0, lastGrowthAt: 0, faceCount: 0, proxyMax: 0, censusAt: -Infinity,
        onKey: () => undefined, root: null, faces: null,
        proxies: document.getElementsByClassName('con-played-cat__proxy'),
      };
      fresh.onKey = (e: KeyboardEvent) => {
        if (e.code === keyCode && fresh.pressAt === 0) {
          fresh.pressAt = performance.now();
        }
      };
      window.addEventListener('keydown', fresh.onKey, true);
      w.__playedOpenProbe = fresh;
      s = fresh;
    }
    const now = performance.now();
    const root = document.querySelector(rootSel);
    if (s.rootAt === 0 && root !== null) {
      s.rootAt = now;
    }
    if (now - s.censusAt >= censusMs) {
      s.censusAt = now;
      if (root !== s.root) {
        s.root = root;
        s.faces = root === null ? null : root.getElementsByClassName('pcard');
      }
      if (s.faces !== null) {
        const n = s.faces.length;
        if (n !== s.faceCount) {
          s.faceCount = n;
          s.lastGrowthAt = now;
        }
      }
      s.proxyMax = Math.max(s.proxyMax, s.proxies.length);
    }
    return {pressAt: s.pressAt, rootAt: s.rootAt, lastGrowthAt: s.lastGrowthAt, faceCount: s.faceCount, proxyMax: s.proxyMax};
  }, {args: {keyCode, rootSel, arm: openArm, censusMs: CENSUS_MS}, rafTick: false, tickMs: CENSUS_MS});
}

async function readOpenProbe(page: Page): Promise<OpenProbe> {
  const last = (await witnessOf<OpenProbe>(page, OPEN_PROBE).stop()).at(-1)?.v;
  await page.evaluate(() => {
    const s = (window as unknown as {__playedOpenProbe?: {onKey: (e: KeyboardEvent) => void}}).__playedOpenProbe;
    if (s !== undefined) {
      window.removeEventListener('keydown', s.onKey, true);
    }
  });
  return last ?? {pressAt: 0, rootAt: 0, lastGrowthAt: 0, faceCount: 0, proxyMax: 0};
}

/**
 * Click-based open of a category — the table is one page, every zone ONE stack. A stack is FOCUSED by one click and
 * opened by the next (the pad's two-step feel): the second click goes once the first one's focus stands (a focused stack
 * opens on the first).
 */
async function openCategory(page: Page, key: string): Promise<void> {
  const zone = page.locator(`[data-played-cat="${key}"]`).first();
  const focused = /con-played__family--focused/;
  if (!focused.test(await zone.getAttribute('class') ?? '')) {
    await zone.click();
    await expect(zone, `the «${key}» stack takes the focus click`).toHaveClass(focused, {timeout: 15_000});
  }
  await zone.click();
}

/** Per-press nav latency inside the category grid: keydown → the focused
 *  slot class moving (attribute mutation, recorded in the task that wrote it).
 *  DOM-update latency — paint is compositor-gated headless, but the JS+render
 *  cost is what scales. The presses go at a fixed CADENCE (one step per
 *  180 ms — a player stepping through the grid): the cadence is part of what
 *  is measured, so it is a beat, never a wait for the previous step. A press
 *  that moves nothing (a wall) simply records no latency — the report's
 *  `samples` says how many did. */
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
    await cinematicBeat(page, 180, 'the nav cadence — one grid step per 180 ms is the rate the latency is measured at');
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
        // Let the board settle (fit engines, fonts, first data render): the veil gone, the console quiet.
        await boardAtRest(page);

        // ── 6a. closed-state idle BEFORE first open ──────────────────────
        await armPerfWindow(page);
        await cinematicBeat(page, 3000, 'the closed-state idle window IS the measurement');
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
        await cinematicBeat(page, 600, 'the tail of the open window —the measured window runs this long past the arrival');
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
        // The table is ONE page of stacks (2026-10-19): every zone is on screen, the biggest is simply the fullest stack.
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
        // The flight needs frames to advance; pump until the grid stands framed.
        await expect.poll(async () => {
          await pumpFrame(page);
          return page.locator('.con-played-cat--framed').count();
        }, {message: `the «${biggest}» category frames its grid`, timeout: 60_000, intervals: [90]}).toBeGreaterThan(0);
        await pumpFrames(page, 4, 120);
        await cinematicBeat(page, 400, 'the tail of the category window —the measured window runs this long past the framing');
        const catProbe = await readOpenProbe(page);
        // GC before the read: the Nodes/Heap delta should mean RETAINED, not
        // «churned and not yet collected».
        await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
        await cinematicBeat(page, 120, 'the heap is read a beat after the forced GC — the own protocol of the measurement');
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
        // The window closes with the category: pump until it has left.
        await expect.poll(async () => {
          await pumpFrame(page);
          return page.locator('.con-played-cat').count();
        }, {message: 'Escape closes the category', timeout: 30_000, intervals: [90]}).toBe(0);
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
          // THE CYCLE'S RHYTHM IS THE MEASUREMENT: the table is closed this long after it arrived (an Escape mid-entrance
          // on a big table included) and the next open follows a short rest — beats, never a wait for the table at rest.
          await cinematicBeat(page, seeded.n >= 100 ? 350 : 200, 'the dwell of a cycle on the open table');
          await page.keyboard.press('Escape');
          await page.locator('.con-played').waitFor({state: 'detached', timeout: 30_000});
          await cinematicBeat(page, 120, 'the rest between two cycles');
          if (i === 1 || i === 5 || i === 10 || i === 20) {
            await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
            await cinematicBeat(page, 150, 'the heap is read a beat after the forced GC — the own protocol of the measurement');
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
        await cinematicBeat(page, 300, 'the idle window opens a beat after the forced GC — the own protocol of the measurement');
        await armPerfWindow(page);
        await cinematicBeat(page, 3000, 'the closed-state idle window IS the measurement');
        report.idleAfter = await readPerfWindow(page);
        const closedAfter = await cdpMetrics(cdp);
        report.closedAfter = snapshotOf(closedAfter);
        report.closedDelta = metricsDelta(closedBefore, closedAfter);

        // ── 7. THE INFOPANEL DOOR ────────────────────────────────────────
        // The Information Workspace is a DOSSIER since TR60: «Разыграно» is a zone of its ring, opened with A from its
        // tile (X no longer reaches it — the probe's old door). Walk the ring with the shared driver, then press.
        expect(await pressUntilVisible(page, 'KeyY', '.con-info'), 'Y opens the Information workspace').toBe(true);
        await settle(page);
        expect(await focusInfoZone(page, 'played'), 'the ring reaches «Разыграно»').toBe(true);
        await armOpenProbe(page, 'Enter', '.con-info .con-played');
        await armPerfWindow(page);
        const mInfo0 = await cdpMetrics(cdp);
        await page.keyboard.press('Enter');
        await page.locator('.con-info .con-played').waitFor({state: 'visible', timeout: 30_000});
        await pumpFrames(page, 4, 120);
        await cinematicBeat(page, 500, 'the tail of the info open window —the measured window runs this long past the arrival');
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
        await pressUntilGone(page, 'Escape', '.con-info .con-played');
        await pressUntilGone(page, 'Escape', '.con-info');

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
