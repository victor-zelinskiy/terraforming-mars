/*
 * CONSOLE LONG-GAME PERFORMANCE PROBE v2 — a MEASUREMENT harness, not a
 * regression gate. Env-gated (`LONGGAME_PERF=1`), skipped in every ordinary
 * run. Idiom mirrors console-played-perf-probe.spec.ts (CDP metrics +
 * long-task observer + 16 ms tick jitter; rAF is compositor-starved headless,
 * so jank is judged by main-thread availability).
 *
 * Iteration-3 methodology upgrades over v1:
 *   - WARM-UP cycles before the measured batch; cold / warm / late-repeat are
 *     reported separately (cold carries the preview pre-warm by design);
 *   - enough samples for p50 / p95 / max + MAD (median absolute deviation) —
 *     never a single best run;
 *   - per-open PHASE attribution: press → end-of-sync-JS (microtask) and
 *     press → surface-in-DOM (MutationObserver ≈ end of the Vue flush), plus
 *     long tasks per cycle. Style/layout/paint attribution lives in the
 *     dedicated trace script (scripts/perf/trace-wheel.mjs), not here;
 *   - an EARLY vs LATE wheel batch around the workspace trips (progressive
 *     degradation check);
 *   - the INGEST scenario (separate test, seed variant B): REAL rival actions
 *     over HTTP (sell a patent → undo → …) drive genuine poll-driven model
 *     updates on the viewer's client; App.update's `ingest:*` perf marks
 *     (enabled via ?perf=1) attribute fetch / parse / commit / flush.
 *
 * The SCENARIO is the progressive-degradation case: a seeded generation-11
 * two-player game (tests/perf/seed-longgame.ts) — 37 tiles incl. Ares hazard
 * tiles, 57/48-card tableaus, 8 cards in hand, ~670-entry log — opened in the
 * real console shell.
 *
 * Run:
 *   npx tsx tests/perf/seed-longgame.ts
 *   LOCAL_FS_DB=1 PORT=8123 node build/src/server/server.js
 *   LONGGAME_PERF=1 LONGGAME_PERF_LABEL=baseline BASE_URL=http://localhost:8123 \
 *     npx playwright test tests/e2e/console-longgame-perf-probe.spec.ts --workers=1
 */
import {expect, test, Page, CDPSession, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const RUN = process.env.LONGGAME_PERF === '1';
const LABEL = process.env.LONGGAME_PERF_LABEL ?? 'run';
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'longgame-perf', LABEL);

type SeededGame = {
  gameId: string, playerId: string, rivalId: string, log: number, tiles: number,
  b?: {gameId: string, playerId: string, rivalId: string},
};
const MANIFEST_PATH = path.join(__dirname, '..', 'perf', 'longgame-perf-game.json');
const GAME: SeededGame | undefined = RUN ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : undefined;

const ALL_PROFILES = [
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld', cpuThrottle: 4},
  // THE reported real-world case: Steam Deck DOCKED to a TV, physical output
  // 1080p, the player runs the TV 4K profile for its couch layout. The TV
  // logical space is 1920×1080, so --con-ui-scale honestly lands on 1.0 here
  // (measured by the paint census below) — the axis that matters is the TV
  // RECOMPOSITION (bigger chrome) on a Deck-class main thread.
  {id: 'deck-docked-tv', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=tv', cpuThrottle: 4},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', cpuThrottle: 1},
] as const;
/** LONGGAME_PERF_PROFILE=deck-docked-tv narrows the matrix (docked Deck is
 *  the priority case). */
const PROFILES = ALL_PROFILES.filter((p) =>
  process.env.LONGGAME_PERF_PROFILE === undefined || p.id === process.env.LONGGAME_PERF_PROFILE);

/** Settings under test: persisted keys seeded BEFORE app boot.
 *  LONGGAME_SET_FX=1 → «Упрощённые графические эффекты», LONGGAME_SET_RM=1 →
 *  the in-game reduce-motion override. */
const SET_FX = process.env.LONGGAME_SET_FX === '1';
const SET_RM = process.env.LONGGAME_SET_RM === '1';

// Wheel batch sizes. The measured batch must be big enough for a meaningful
// p95; warm-ups absorb the first-open pre-warm AND the JIT ramp.
const WHEEL_WARMUP = 2;
const WHEEL_MEASURED = 10;
const WHEEL_LATE = 6;
const HAND_TRIPS = 6;
const INGEST_PAIRS = 3; // (sell → undo) pairs = 6 poll-driven updates

// ── in-page samplers (recv/played-perf idiom) ──────────────────────────────

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

function snapshotOf(m: CdpMetrics): CdpMetrics {
  const out: CdpMetrics = {};
  for (const k of ['Nodes', 'JSEventListeners', 'JSHeapUsedSize']) {
    out[k] = m[k] ?? 0;
  }
  return out;
}

/** Headless Chromium starves rAF on a static frame — force BeginFrames. */
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

/**
 * keydown → phase-stamp probe:
 *   pressAt  — the keydown (capture listener, runs before every app handler);
 *   syncAt   — a microtask enqueued FROM the capture listener: it runs after
 *              every synchronous keydown handler of that dispatch and BEFORE
 *              Vue's flush job (enqueued later during the same dispatch) —
 *              ≈ end of synchronous JS;
 *   rootAt   — the surface selector present in the DOM (MutationObserver
 *              microtask ≈ end of the Vue patch/flush).
 * Style/layout/paint are NOT measurable this way headless — the trace script
 * owns that attribution.
 */
async function armOpenProbe(page: Page, keyCode: string, rootSel: string): Promise<void> {
  await page.evaluate(({keyCode, rootSel}) => {
    const w = window as any;
    w.__openStop?.();
    const t = {pressAt: 0, syncAt: 0, rootAt: 0};
    w.__openT = t;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === keyCode && t.pressAt === 0) {
        t.pressAt = performance.now();
        queueMicrotask(() => {
          if (t.syncAt === 0) {
            t.syncAt = performance.now();
          }
        });
      }
    };
    window.addEventListener('keydown', onKey, true);
    const mo = new MutationObserver(() => {
      if (t.rootAt === 0 && document.querySelector(rootSel) !== null) {
        t.rootAt = performance.now();
      }
    });
    mo.observe(document.body, {childList: true, subtree: true});
    w.__openStop = () => {
      window.removeEventListener('keydown', onKey, true);
      mo.disconnect();
    };
  }, {keyCode, rootSel});
}

async function readOpenProbe(page: Page): Promise<{pressAt: number, syncAt: number, rootAt: number}> {
  return await page.evaluate(() => {
    const w = window as any;
    w.__openStop?.();
    return w.__openT;
  }) as {pressAt: number, syncAt: number, rootAt: number};
}

/** The board-stability census: container + per-hazard-tile rects, running
 *  tile animations, lingering one-shot classes. */
type BoardCensus = {
  cont: {x: number, y: number, w: number, h: number} | null,
  hazards: Array<{cls: string, x: number, y: number, w: number, h: number}>,
  tileAnimations: number,
  intensifying: number,
  placing: number,
};

async function boardCensus(page: Page): Promise<BoardCensus> {
  return await page.evaluate(() => {
    const r = (el: Element) => {
      const b = el.getBoundingClientRect();
      return {x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10};
    };
    const cont = document.querySelector('.board-cont');
    const hazards: Array<{cls: string, x: number, y: number, w: number, h: number}> = [];
    document.querySelectorAll(
      '[class*="board-space-tile--dust-storm"], [class*="board-space-tile--erosion"]').forEach((el) => {
      hazards.push({cls: (el as HTMLElement).className, ...r(el)});
    });
    let tileAnimations = 0;
    try {
      for (const a of document.getAnimations()) {
        const target = (a as CSSAnimation).effect && ((a as CSSAnimation).effect as KeyframeEffect).target;
        if (target instanceof Element && target.className.toString().includes('board-space-tile')) {
          tileAnimations++;
        }
      }
    } catch { /* getAnimations unavailable → counted as 0 */ }
    return {
      cont: cont === null ? null : r(cont),
      hazards,
      tileAnimations,
      intensifying: document.querySelectorAll('.board-space-tile--intensifying').length,
      placing: document.querySelectorAll('.board-space-tile--placing').length,
    };
  });
}

/** Pairwise by DOCUMENT ORDER — several hazards share one class+size, so a
 *  keyed match collides (it once compared two different erosion tiles and
 *  reported a 235 px "drift" on a perfectly still board). querySelectorAll
 *  order is stable for an unchanged tree; a changed count reports -1. */
function maxHazardDrift(a: BoardCensus, b: BoardCensus): number {
  if (a.hazards.length !== b.hazards.length) {
    return -1;
  }
  let drift = 0;
  for (let i = 0; i < a.hazards.length; i++) {
    const p = a.hazards[i];
    const n = b.hazards[i];
    drift = Math.max(drift, Math.abs(p.x - n.x), Math.abs(p.y - n.y));
  }
  return drift;
}

/** One-shot paint/display census: what the profile ACTUALLY rasterizes —
 *  real uiScale/DPR, running animations by name, will-change population,
 *  viewport-scale shadow/gradient surfaces, images decoded far above their
 *  displayed size, and a decoded-image memory estimate. Heavy (computed style
 *  per element) — probe-only. */
async function paintCensus(page: Page): Promise<Record<string, unknown>> {
  return await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const varea = vw * vh;
    const anims: Record<string, number> = {};
    try {
      for (const a of document.getAnimations()) {
        const name = (a as CSSAnimation).animationName ?? a.constructor.name;
        anims[name] = (anims[name] ?? 0) + 1;
      }
    } catch { /* census still stands */ }
    let willChange = 0;
    let bigShadow = 0;
    let bigGradient = 0;
    let hugeEl = 0;
    const shadowSamples: Array<{cls: string, w: number, h: number}> = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.willChange !== 'auto') {
        willChange++;
      }
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > varea * 0.5) {
        hugeEl++;
      }
      if (area > varea * 0.15) {
        if (cs.boxShadow !== 'none') {
          bigShadow++;
          if (shadowSamples.length < 8) {
            shadowSamples.push({cls: String((el as HTMLElement).className).slice(0, 70), w: Math.round(r.width), h: Math.round(r.height)});
          }
        }
        if (cs.backgroundImage.includes('gradient')) {
          bigGradient++;
        }
      }
    }
    const oversizedImgs: Array<{src: string, natural: number, shown: number}> = [];
    const uniqueDecoded = new Map<string, number>();
    document.querySelectorAll('img').forEach((im) => {
      const shown = im.clientWidth * (window.devicePixelRatio || 1);
      if (im.naturalWidth > 0 && im.clientWidth > 0 && im.naturalWidth > shown * 2.5 && oversizedImgs.length < 10) {
        oversizedImgs.push({src: (im.currentSrc || im.src).split('/').pop() ?? '', natural: im.naturalWidth, shown: Math.round(shown)});
      }
      const src = im.currentSrc || im.src;
      if (im.naturalWidth > 0 && !uniqueDecoded.has(src)) {
        uniqueDecoded.set(src, im.naturalWidth * im.naturalHeight * 4);
      }
    });
    let decodedBytes = 0;
    for (const b of uniqueDecoded.values()) {
      decodedBytes += b;
    }
    const rootCss = getComputedStyle(document.documentElement);
    return {
      viewport: `${vw}x${vh}`,
      dpr: window.devicePixelRatio,
      uiScale: rootCss.getPropertyValue('--con-ui-scale').trim(),
      motionScale: rootCss.getPropertyValue('--motion-scale').trim(),
      profileClass: document.documentElement.className.match(/con-profile-\w+/)?.[0] ?? '',
      htmlClasses: document.documentElement.className,
      anims, willChange, bigShadow, bigGradient, hugeEl, shadowSamples, oversizedImgs,
      imgCount: document.querySelectorAll('img').length,
      uniqueImgCount: uniqueDecoded.size,
      decodedImageMB: Math.round(decodedBytes / 1024 / 1024 * 10) / 10,
      docNodes: document.querySelectorAll('*').length,
    };
  });
}

function pct(sorted: Array<number>, p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[i] * 10) / 10;
}

/** Batch statistics: p50/p95/max + mean + MAD (robust spread). */
function stats(values: Array<number>): Record<string, number> {
  const clean = values.filter((v) => v >= 0);
  const sorted = [...clean].sort((a, b) => a - b);
  const p50 = pct(sorted, 50);
  const mad = pct([...clean.map((v) => Math.abs(v - p50))].sort((a, b) => a - b), 50);
  const mean = clean.length === 0 ? 0 : Math.round(clean.reduce((s, v) => s + v, 0) / clean.length * 10) / 10;
  return {n: clean.length, p50, p95: pct(sorted, 95), max: pct(sorted, 100), mean, mad};
}

/** Open the hand workspace — the DOCK is the mouse door to «Карты в руке»
 *  (onHandDockOpen → the same RT path). Act → verify → retry: the press can be
 *  legitimately swallowed by a settling episode. */
async function openHand(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.locator('.con-handdock').click({timeout: 3000}).catch(() => {});
    await pumpFrames(page, 3, 150);
    if (await page.locator('.con-hand').count() > 0) {
      return true;
    }
  }
  return false;
}

async function closeToBoard(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await page.locator('.con-hand, .con-colonies, .con-quick').count() === 0) {
      return;
    }
    await page.keyboard.press('Escape');
    await pumpFrames(page, 2, 120);
  }
}

/** One wheel open/close cycle with phase stamps + a long-task window.
 *  `shootName` captures the OPEN wheel (visual evidence) before the close. */
type WheelCycle = {toSync: number, toDom: number, longTasks: number, longTaskMax: number};

async function wheelCycle(page: Page, shootName?: string): Promise<WheelCycle> {
  await armOpenProbe(page, 'Period', '.con-quick');
  await armPerfWindow(page);
  await page.keyboard.press('Period');
  await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
  await pumpFrames(page, 3, 110);
  const t = await readOpenProbe(page);
  const w = await readPerfWindow(page);
  const ms = (a: number, b: number) => (a > 0 && b > 0) ? Math.round((b - a) * 10) / 10 : -1;
  if (shootName !== undefined) {
    await shoot(page, shootName);
  }
  await closeToBoard(page);
  await page.waitForTimeout(250);
  return {
    toSync: ms(t.pressAt, t.syncAt),
    toDom: ms(t.pressAt, t.rootAt),
    longTasks: w.longTasks,
    longTaskMax: Math.round(w.longTaskMax * 10) / 10,
  };
}

function summarizeWheel(cycles: Array<WheelCycle>): Record<string, unknown> {
  return {
    toDom: stats(cycles.map((c) => c.toDom)),
    toSync: stats(cycles.map((c) => c.toSync)),
    longTasksTotal: cycles.reduce((s, c) => s + c.longTasks, 0),
    longTaskMax: Math.max(0, ...cycles.map((c) => c.longTaskMax)),
    samples: cycles,
  };
}

const SCENARIO_TIMEOUT = Number(process.env.LONGGAME_PERF_TIMEOUT ?? 900_000);

test.describe('console long-game performance probe', () => {
  test.skip(!RUN, 'LONGGAME_PERF=1 required');
  test.setTimeout(SCENARIO_TIMEOUT);

  for (const profile of PROFILES) {
    test(`${profile.id} longgame`, async ({page}) => {
      test.setTimeout(SCENARIO_TIMEOUT);
      if (GAME === undefined) {
        return;
      }
      await page.setViewportSize(profile.viewport);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      if (profile.cpuThrottle > 1) {
        await cdp.send('Emulation.setCPUThrottlingRate', {rate: profile.cpuThrottle});
      }

      const report: Record<string, unknown> = {
        label: LABEL, profile: profile.id,
        viewport: profile.viewport, cpuThrottle: profile.cpuThrottle,
        settings: {fxLite: SET_FX, reduceMotion: SET_RM},
        seeded: {log: GAME.log, tiles: GAME.tiles},
        startedAt: new Date().toISOString(),
      };

      // Seed the persisted settings BEFORE the app boots (the real settings
      // architecture reads them at bootstrap; toggling live is covered by the
      // unit/component specs — the probe measures the steady state).
      await page.addInitScript(({fx, rm}) => {
        try {
          if (fx) {
            window.localStorage.setItem('tm_console_fx_lite', '1');
          }
          if (rm) {
            window.localStorage.setItem('tm_reduce_motion', '1');
          }
        } catch { /* private mode — the probe still runs at defaults */ }
      }, {fx: SET_FX, rm: SET_RM});

      // ── 1. INITIAL LOAD of the large save ────────────────────────────────
      const navStart = Date.now();
      await page.goto(`/player?id=${GAME.playerId}&console=1${profile.query}`);
      await page.locator('.con-root').waitFor({state: 'visible', timeout: 60_000});
      const rootVisibleMs = Date.now() - navStart;
      await pumpFrames(page, 4, 250);
      await page.waitForTimeout(1500);
      await pumpFrames(page, 2, 120);
      report.initialLoad = {
        rootVisibleMs,
        navigation: await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          return nav === undefined ? null : {
            domInteractive: Math.round(nav.domInteractive),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
            responseEnd: Math.round(nav.responseEnd),
          };
        }),
      };
      await shoot(page, `${profile.id}-0-board`);

      // ── 0. What does this profile ACTUALLY rasterize? ────────────────────
      report.paintCensus = await paintCensus(page);

      // ── 2. IDLE on the settled board home ────────────────────────────────
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      const idleStart = await cdpMetrics(cdp);
      await armPerfWindow(page);
      await page.waitForTimeout(4000);
      report.idleBefore = await readPerfWindow(page);
      report.idleBeforeSnapshot = snapshotOf(idleStart);

      // ── 3. RT WHEEL: cold → warm-up ×2 → measured ×10 ────────────────────
      const cold = await wheelCycle(page, `${profile.id}-1-wheel`);
      report.wheelCold = cold;
      for (let i = 0; i < WHEEL_WARMUP; i++) {
        await wheelCycle(page);
      }
      const warm: Array<WheelCycle> = [];
      for (let i = 0; i < WHEEL_MEASURED; i++) {
        warm.push(await wheelCycle(page));
      }
      report.wheelWarm = summarizeWheel(warm);

      // ── 4. HAND WORKSPACE ROUND TRIPS + board stability ──────────────────
      const trips: Array<Record<string, unknown>> = [];
      const cycleSnapshots: Array<Record<string, number>> = [];
      let openedEver = false;
      for (let i = 1; i <= HAND_TRIPS; i++) {
        const before = await boardCensus(page);
        const opened = await openHand(page);
        openedEver = openedEver || opened;
        await pumpFrames(page, 3, 120);
        if (i === 1) {
          await shoot(page, `${profile.id}-2-hand`);
          // Image reality INSIDE the one art-bearing surface (the album):
          // how many decodes does an open hand actually hold?
          report.handImageCensus = await page.evaluate(() => {
            const unique = new Map<string, number>();
            let oversized = 0;
            document.querySelectorAll('.con-hand img, .con-handdock img').forEach((im) => {
              const img = im as HTMLImageElement;
              const src = img.currentSrc || img.src;
              if (img.naturalWidth > 0 && !unique.has(src)) {
                unique.set(src, img.naturalWidth * img.naturalHeight * 4);
              }
              const shown = img.clientWidth * (window.devicePixelRatio || 1);
              if (img.naturalWidth > 0 && img.clientWidth > 0 && img.naturalWidth > shown * 2.5) {
                oversized++;
              }
            });
            let bytes = 0;
            for (const b of unique.values()) {
              bytes += b;
            }
            return {
              imgs: document.querySelectorAll('.con-hand img').length,
              unique: unique.size,
              decodedMB: Math.round(bytes / 1024 / 1024 * 10) / 10,
              oversized,
            };
          });
        }
        await closeToBoard(page);
        // Let the return settle, then read the board's state.
        await pumpFrames(page, 3, 140);
        await page.waitForTimeout(400);
        const after = await boardCensus(page);
        trips.push({
          trip: i,
          opened,
          hazardDrift: maxHazardDrift(before, after),
          contBefore: before.cont, contAfter: after.cont,
          tileAnimationsAfterClose: after.tileAnimations,
          intensifyingAfterClose: after.intensifying,
          placingAfterClose: after.placing,
          hazardCount: after.hazards.length,
        });
        if (i === 1 || i === 3 || i === HAND_TRIPS) {
          await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
          await page.waitForTimeout(150);
          cycleSnapshots.push({trip: i, ...snapshotOf(await cdpMetrics(cdp))});
        }
      }
      report.handTrips = trips;
      report.cycleSnapshots = cycleSnapshots;

      // ── 5. LATE wheel batch (после трипов): progressive degradation? ─────
      const late: Array<WheelCycle> = [];
      for (let i = 0; i < WHEEL_LATE; i++) {
        late.push(await wheelCycle(page));
      }
      report.wheelLate = summarizeWheel(late);

      // ── 6. Final idle window ─────────────────────────────────────────────
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      await page.waitForTimeout(300);
      await armPerfWindow(page);
      await page.waitForTimeout(4000);
      report.idleAfter = await readPerfWindow(page);
      report.idleAfterSnapshot = snapshotOf(await cdpMetrics(cdp));
      await shoot(page, `${profile.id}-3-final`);

      // The report is written BEFORE the sanity asserts — a failed sanity must
      // still leave the collected evidence on disk.
      const finalCensus = await boardCensus(page);
      report.finalCensus = finalCensus;
      fs.mkdirSync(OUT, {recursive: true});
      fs.writeFileSync(
        path.join(OUT, `report-${profile.id}.json`),
        JSON.stringify(report, null, 2));

      // sanity: the probe drove the real flow (board present, hazards seeded,
      // the wheel opened enough times, the hand opened at least once)
      expect(finalCensus.cont).not.toBeNull();
      expect(finalCensus.hazards.length).toBeGreaterThan(0);
      expect(openedEver).toBeTruthy();
      expect(cold.toDom).toBeGreaterThanOrEqual(0);
      expect((report.wheelWarm as {toDom: {n: number}}).toDom.n).toBeGreaterThanOrEqual(WHEEL_MEASURED - 2);
    });
  }

  // ── INGEST: «opponent acted, my screen updates» (seed variant B) ─────────
  // The rival sells a patent / undoes it over raw HTTP (the REAL input
  // endpoint); the viewer's client — a real console shell — receives each
  // update through its own poll/WS path. App.update's ingest:* marks attribute
  // fetch / json / commit / flush; a perf window catches the long tasks.
  test(`ingest cycles (deck-docked-tv, variant B)`, async ({page, request}) => {
    test.setTimeout(SCENARIO_TIMEOUT);
    if (GAME?.b === undefined) {
      return;
    }
    const b = GAME.b;
    await page.setViewportSize({width: 1920, height: 1080});
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});

    await page.goto(`/player?id=${b.playerId}&console=1&consoleProfile=tv&perf=1`);
    await page.locator('.con-root').waitFor({state: 'visible', timeout: 60_000});
    await pumpFrames(page, 4, 250);
    await page.waitForTimeout(1500);

    const report: Record<string, unknown> = {
      label: LABEL, scenario: 'ingest', viewport: '1920x1080', cpuThrottle: 4,
      startedAt: new Date().toISOString(),
    };

    const cycles: Array<Record<string, unknown>> = [];
    const rivalAct = async (kind: 'sell' | 'undo') => {
      const model = await (await request.get(`/api/player?id=${b.rivalId}&noredirect`)).json();
      const title = (o: any) => typeof o.title === 'string' ? o.title : o.title?.message;
      const options: Array<any> = model.waitingFor?.options ?? [];
      const idx = kind === 'sell' ?
        options.findIndex((o) => title(o) === 'Sell patents') :
        options.findIndex((o) => String(title(o) ?? '').startsWith('Undo'));
      if (idx < 0) {
        return false;
      }
      const response = kind === 'sell' ?
        {type: 'card', cards: [options[idx].cards[0].name]} :
        {type: 'option'};
      const res = await request.post(`/player/input?id=${b.rivalId}`, {
        data: {runId: model.runId, type: 'or', index: idx, response},
      });
      return res.ok();
    };

    const runCycle = async (kind: 'sell' | 'undo') => {
      await page.evaluate(() => {
        performance.clearMarks();
        performance.clearMeasures();
      });
      await armPerfWindow(page);
      const postedAt = Date.now();
      const ok = await rivalAct(kind);
      // Wait for the viewer's client to fully apply the update (flush mark).
      let applied = false;
      for (let i = 0; i < 100 && !applied; i++) {
        await page.waitForTimeout(120);
        applied = await page.evaluate(() =>
          performance.getEntriesByName('ingest:flush:done', 'mark').length > 0);
      }
      const wallMs = Date.now() - postedAt;
      const w = await readPerfWindow(page);
      const marks = await page.evaluate(() => {
        const at = (name: string) => {
          const e = performance.getEntriesByName(name, 'mark');
          return e.length > 0 ? e[e.length - 1].startTime : -1;
        };
        return {
          fetchStart: at('ingest:fetch:start'),
          fetchResp: at('ingest:fetch:resp'),
          jsonDone: at('ingest:json:done'),
          commitStart: at('playerView:commit'),
          commitDone: at('ingest:commit:done'),
          flushDone: at('ingest:flush:done'),
        };
      });
      const d = (a: number, bb: number) => (a >= 0 && bb >= 0) ? Math.round((bb - a) * 10) / 10 : -1;
      cycles.push({
        kind, ok, applied, wallMs,
        fetchMs: d(marks.fetchStart, marks.fetchResp),
        jsonMs: d(marks.fetchResp, marks.jsonDone),
        prepMs: d(marks.jsonDone, marks.commitStart),
        commitMs: d(marks.commitStart, marks.commitDone),
        flushMs: d(marks.commitDone, marks.flushDone),
        totalMs: d(marks.fetchStart, marks.flushDone),
        longTasks: w.longTasks, longTaskMax: Math.round(w.longTaskMax * 10) / 10,
      });
      await pumpFrames(page, 2, 120);
      await page.waitForTimeout(300);
    };

    for (let pair = 0; pair < INGEST_PAIRS; pair++) {
      await runCycle('sell');
      await runCycle('undo');
    }
    report.cycles = cycles;
    const applied = cycles.filter((c) => c.applied === true);
    report.summary = {
      appliedCount: applied.length,
      total: stats(applied.map((c) => c.totalMs as number)),
      commit: stats(applied.map((c) => c.commitMs as number)),
      flush: stats(applied.map((c) => c.flushMs as number)),
      json: stats(applied.map((c) => c.jsonMs as number)),
      fetch: stats(applied.map((c) => c.fetchMs as number)),
    };
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, `report-ingest.json`), JSON.stringify(report, null, 2));

    // sanity: the pipeline ran — real updates arrived and were applied
    expect(applied.length).toBeGreaterThanOrEqual(INGEST_PAIRS);
  });
});
