/*
 * CONSOLE LONG-GAME PERFORMANCE PROBE — a MEASUREMENT harness, not a
 * regression gate. Env-gated (`LONGGAME_PERF=1`), skipped in every ordinary
 * run. Idiom mirrors console-played-perf-probe.spec.ts (CDP metrics +
 * long-task observer + 16 ms tick jitter; rAF is compositor-starved headless,
 * so jank is judged by main-thread availability).
 *
 * The SCENARIO is the progressive-degradation case: a seeded generation-11
 * two-player game (tests/perf/seed-longgame.ts) — 37 tiles incl. Ares hazard
 * tiles, 57/48-card tableaus, 8 cards in hand, ~670-entry log — opened in the
 * real console shell. Per display profile it measures:
 *
 *   1. IDLE (4 s) on the settled board home — long tasks + tick jitter +
 *      node/listener/heap snapshot (the per-second ambient cost: leak
 *      detector, watchdog, pollers).
 *   2. RT WHEEL ×8 — keydown → `.con-quick` in-DOM latency (first open
 *      separately: it carries the action-preview pre-warm), long tasks.
 *   3. HAND WORKSPACE ROUND TRIPS ×6 — open «Карты в руке», close; before
 *      each trip and after settle: `.board-cont` + hazard-tile rects, running
 *      animations on board tiles, `--intensifying` presence. The INVARIANT: a
 *      stationary tile neither moves nor re-animates when a workspace closes.
 *   4. Node/listener/heap growth across the trips (GC'd snapshots).
 *   5. Final idle window (post-interaction ambient cost).
 *
 * Run:
 *   npx tsx tests/perf/seed-longgame.ts
 *   LOCAL_FS_DB=1 PORT=8123 node build/src/server/server.js
 *   LONGGAME_PERF=1 LONGGAME_PERF_LABEL=baseline BASE_URL=http://localhost:8123 \
 *     npx playwright test tests/e2e/console-longgame-perf-probe.spec.ts --workers=1
 */
import {expect, test, Page, CDPSession} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const RUN = process.env.LONGGAME_PERF === '1';
const LABEL = process.env.LONGGAME_PERF_LABEL ?? 'run';
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'longgame-perf', LABEL);

type SeededGame = {gameId: string, playerId: string, rivalId: string, log: number, tiles: number};
const MANIFEST_PATH = path.join(__dirname, '..', 'perf', 'longgame-perf-game.json');
const GAME: SeededGame | undefined = RUN ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : undefined;

const ALL_PROFILES = [
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld', cpuThrottle: 4},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', cpuThrottle: 1},
] as const;
/** LONGGAME_PERF_PROFILE=deck-handheld narrows the matrix (Deck is priority). */
const PROFILES = ALL_PROFILES.filter((p) =>
  process.env.LONGGAME_PERF_PROFILE === undefined || p.id === process.env.LONGGAME_PERF_PROFILE);

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

/** keydown → selector-in-DOM latency probe (MutationObserver, not rAF). */
async function armOpenProbe(page: Page, keyCode: string, rootSel: string): Promise<void> {
  await page.evaluate(({keyCode, rootSel}) => {
    const w = window as any;
    w.__openStop?.();
    const t = {pressAt: 0, rootAt: 0};
    w.__openT = t;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === keyCode && t.pressAt === 0) {
        t.pressAt = performance.now();
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

async function readOpenProbe(page: Page): Promise<{pressAt: number, rootAt: number}> {
  return await page.evaluate(() => {
    const w = window as any;
    w.__openStop?.();
    return w.__openT;
  }) as {pressAt: number, rootAt: number};
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

function pct(sorted: Array<number>, p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[i] * 10) / 10;
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

const SCENARIO_TIMEOUT = Number(process.env.LONGGAME_PERF_TIMEOUT ?? 600_000);

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
        seeded: {log: GAME.log, tiles: GAME.tiles},
        startedAt: new Date().toISOString(),
      };

      await page.goto(`/player?id=${GAME.playerId}&console=1${profile.query}`);
      await page.locator('.con-root').waitFor({state: 'visible', timeout: 60_000});
      await pumpFrames(page, 4, 250);
      await page.waitForTimeout(1500);
      await pumpFrames(page, 2, 120);
      await shoot(page, `${profile.id}-0-board`);

      // ── 1. IDLE on the settled board home ────────────────────────────────
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      const idleStart = await cdpMetrics(cdp);
      await armPerfWindow(page);
      await page.waitForTimeout(4000);
      report.idleBefore = await readPerfWindow(page);
      report.idleBeforeSnapshot = snapshotOf(idleStart);

      // ── 2. RT WHEEL cycles ───────────────────────────────────────────────
      const wheelOpenMs: Array<number> = [];
      let firstWheelMs = -1;
      const wheelWindows: Array<PerfWindow> = [];
      for (let i = 0; i < 8; i++) {
        await armOpenProbe(page, 'Period', '.con-quick');
        await armPerfWindow(page);
        await page.keyboard.press('Period');
        await page.locator('.con-quick').waitFor({state: 'visible', timeout: 20_000});
        await pumpFrames(page, 3, 110);
        const probe = await readOpenProbe(page);
        wheelWindows.push(await readPerfWindow(page));
        const ms = probe.rootAt > 0 && probe.pressAt > 0 ? Math.round((probe.rootAt - probe.pressAt) * 10) / 10 : -1;
        if (i === 0) {
          firstWheelMs = ms;
          await shoot(page, `${profile.id}-1-wheel`);
        } else if (ms >= 0) {
          wheelOpenMs.push(ms);
        }
        await closeToBoard(page);
        await page.waitForTimeout(250);
      }
      const sortedWheel = [...wheelOpenMs].sort((a, b) => a - b);
      report.wheel = {
        firstOpenMs: firstWheelMs,
        openP50: pct(sortedWheel, 50), openP95: pct(sortedWheel, 95), openMax: pct(sortedWheel, 100),
        samples: sortedWheel.length,
        longTasksTotal: wheelWindows.reduce((s, w) => s + w.longTasks, 0),
        longTaskMax: Math.max(...wheelWindows.map((w) => w.longTaskMax)),
      };

      // ── 3. HAND WORKSPACE ROUND TRIPS + board stability ──────────────────
      const trips: Array<Record<string, unknown>> = [];
      const cycleSnapshots: Array<Record<string, number>> = [];
      let openedEver = false;
      for (let i = 1; i <= 6; i++) {
        const before = await boardCensus(page);
        const opened = await openHand(page);
        openedEver = openedEver || opened;
        await pumpFrames(page, 3, 120);
        if (i === 1) {
          await shoot(page, `${profile.id}-2-hand`);
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
        if (i === 1 || i === 3 || i === 6) {
          await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
          await page.waitForTimeout(150);
          cycleSnapshots.push({trip: i, ...snapshotOf(await cdpMetrics(cdp))});
        }
      }
      report.handTrips = trips;
      report.cycleSnapshots = cycleSnapshots;

      // ── 4. Final idle window ─────────────────────────────────────────────
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
      // the wheel opened, the hand opened at least once)
      expect(finalCensus.cont).not.toBeNull();
      expect(finalCensus.hazards.length).toBeGreaterThan(0);
      expect(openedEver).toBeTruthy();
      expect(firstWheelMs).toBeGreaterThanOrEqual(0);
    });
  }
});
