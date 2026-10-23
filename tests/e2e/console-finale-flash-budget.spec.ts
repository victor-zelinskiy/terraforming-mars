/*
 * CI «ФИНАЛ — ПРЕМИУМ, НЕ ДИСКОТЕКА» — THE LIGHT BUDGET of the finale's count, measured on the live scene
 * (`finale-rich-5p`, five seats, the saturated categories). The owner, 2026-10-23: «всё мигает как на дискотеке,
 * особенно при ускоренном подсчёте». Three readings of one claim, every number printed beside its verdict and written
 * to a bench file for the A/B (`TM_E2E_SHOTS_TAG=before|after`):
 *
 *  J · THE BUDGET ON BOTH PACES (4K, DOM — an init-script sampler, setInterval, never rAF): the ignitions per second,
 *      the shortest luminous event and its attack, how many lights stand at once, the luminous events per second —
 *      on the natural count and on the HURRIED one (X on the second category); the hurry is ONE pass (the remainder
 *      under two seconds, an odometer that never steps backwards), then the ranking and the crowning at ×1;
 *  K · THE BRIGHTNESS (FHD — the CDP screencast IS the frame pump; 4K hands back empty frames): the podium's mean luma
 *      frame by frame (the pump's empty frames dropped), its fast swings per second on both paces (a swing = a change
 *      of ≥ 1 luma within 400 ms — the band is narrow, ≈ 29–38 of 255 on the dark stage);
 *  S · STILLS (opt-in `TM_E2E_FINALE_STILLS=1`, 4K): the frozen clock (`page.clock`) after «Повторить подсчёт», six
 *      moments of the natural count and six of the hurry — the acceptance frames.
 *
 * The law (`.claude/rules/console-ui.md` § THE FINALE IS A CEREMONY, law 4): on ANY pace ≤ 1 light at a time, no
 * luminous event shorter than `CEREMONY_MS.minEvent` (a floor no pace scales), ≤ 3 brightness swings a second; the
 * hurry is its OWN choreography, never `timeScale` of the natural one. TIMING class: `--exclusive --workers=1`.
 * `TM_E2E_FINALE_BUDGET_REPORT=1` turns the budget's verdicts into annotations (the «before» run of a build that
 * predates the law).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {fixtureTable, getModel, journeyToEndgame, pumpFrames, waitWithFrames} from './consoleEndgameHarness';
import {cinematicBeat} from './consoleStart';

const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const OUT = path.resolve('screenshots', 'lakefront', 'finale', TAG);
const REPORT_ONLY = process.env.TM_E2E_FINALE_BUDGET_REPORT === '1';
/**
 * `TM_E2E_FINALE_FRAMES=1` keeps K's screencast frames as a STORYBOARD (`story-<scene>/t<ms>.jpg` — the owner chose
 * the hurry on these, 2026-10-23: M1 «one pass» over the per-category comb and the all-at-once curtain).
 */
const KEEP_FRAMES = process.env.TM_E2E_FINALE_FRAMES === '1';

/** The law's numbers. */
const MIN_EVENT_MS = 240;
const MAX_LIGHTS = 1;
const MAX_SWINGS_PER_SEC = 3;
const HURRIED_REMAINDER_MS = 2000;

type Sample = {
  t: number,
  phase: string,
  cat: number,
  hurried: string,
  /** Luminous elements → their painted opacity (the wash, a medal's glow, a light the scene declares). */
  lum: Record<string, number>,
  /** Medallions lit (`--on`), as `<color>:<cat>` keys. */
  on: Array<string>,
  /** color → the shown total. */
  totals: Record<string, string>,
};

async function armBudgetProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const samples: Array<unknown> = [];
    const loaf: Array<{t: number, dur: number}> = [];
    let t0 = -1;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (t0 >= 0 && e.duration > 50) {
            loaf.push({t: Math.round(e.startTime - t0), dur: Math.round(e.duration)});
          }
        }
      }).observe({type: 'long-animation-frame', buffered: false});
    } catch { /* no LoAF */ }
    const opacityOf = (el: Element): number => {
      let o = 1;
      for (let n: Element | null = el; n !== null && !n.classList.contains('con-endgame'); n = n.parentElement) {
        o *= Number(getComputedStyle(n).opacity);
      }
      return Math.round(o * 1000) / 1000;
    };
    const timer = window.setInterval(() => {
      const root = document.querySelector<HTMLElement>('.con-endgame');
      if (root === null) {
        return;
      }
      if (t0 < 0) {
        t0 = performance.now();
      }
      const phase = Array.from(root.classList)
        .find((c) => /^con-endgame--(idle|entering|scoring|settling|ranking|tiebreak|winner|champion|actions)$/.test(c))?.slice(13) ?? '';
      // Every luminous element the scene declares (`data-eg-light`): the one wash. (The «before» build's per-medallion
      // ignition RING — 35 of them on a natural count — was read here too while it existed: the bench's numbers.)
      const lum: Record<string, number> = {};
      root.querySelectorAll<HTMLElement>('[data-eg-light]').forEach((el, i) => {
        lum[`light:${el.dataset.egLight ?? i}`] = opacityOf(el);
      });
      const on: Array<string> = [];
      root.querySelectorAll<HTMLElement>('[data-eg-row]').forEach((row) => {
        row.querySelectorAll<HTMLElement>('.con-eg__medal--on').forEach((medal) => on.push(`${row.dataset.egRow}:${medal.dataset.egMedal}`));
      });
      const totals: Record<string, string> = {};
      root.querySelectorAll<HTMLElement>('[data-eg-total]').forEach((el) => {
        totals[el.dataset.egTotal ?? ''] = el.textContent ?? '';
      });
      samples.push({
        t: Math.round(performance.now() - t0), phase, cat: Number(root.dataset.egCat ?? -1),
        hurried: root.dataset.egHurried ?? '', lum, on, totals,
      });
    }, 16);
    (window as unknown as {__budget: unknown}).__budget = {samples, loaf, stop: () => window.clearInterval(timer)};
  });
}

async function readBudgetProbe(page: Page): Promise<{samples: Array<Sample>, loaf: Array<{t: number, dur: number}>}> {
  return await page.evaluate(() => {
    const p = (window as unknown as {__budget: {samples: Array<Sample>, loaf: Array<{t: number, dur: number}>, stop: () => void}}).__budget;
    p.stop();
    return {samples: p.samples, loaf: p.loaf};
  });
}

type LightEvent = {key: string, start: number, peakAt: number, end: number, peak: number, trace: Array<[number, number]>};

/** Every luminous episode: from the sample it rises above 0.05 to the sample it falls back under it. */
function lightEvents(samples: ReadonlyArray<Sample>): Array<LightEvent> {
  const open = new Map<string, LightEvent>();
  const out: Array<LightEvent> = [];
  for (const s of samples) {
    const keys = new Set([...open.keys(), ...Object.keys(s.lum)]);
    for (const key of keys) {
      const v = s.lum[key] ?? 0;
      const ev = open.get(key);
      if (ev === undefined) {
        if (v > 0.05) {
          open.set(key, {key, start: s.t, peakAt: s.t, end: s.t, peak: v, trace: [[s.t, v]]});
        }
        continue;
      }
      ev.trace.push([s.t, v]);
      ev.peak = Math.max(ev.peak, v);
      if (v <= 0.05) {
        ev.end = s.t;
        out.push(ev);
        open.delete(key);
      }
    }
  }
  const last = samples[samples.length - 1]?.t ?? 0;
  for (const ev of open.values()) {
    ev.end = last;
    out.push(ev);
  }
  // The attack is reached at the first sample at 90 % of the episode's own peak.
  for (const ev of out) {
    ev.peakAt = ev.trace.find(([, v]) => v >= ev.peak * 0.9)?.[0] ?? ev.start;
  }
  return out;
}

/** The densest second: the most `times` inside any window of `windowMs`. */
function perSecond(times: ReadonlyArray<number>, windowMs = 1000): number {
  const sorted = [...times].sort((a, b) => a - b);
  let best = 0;
  let lo = 0;
  for (let hi = 0; hi < sorted.length; hi++) {
    while (sorted[hi] - sorted[lo] >= windowMs) {
      lo++;
    }
    best = Math.max(best, hi - lo + 1);
  }
  return best;
}

type Budget = {
  ignitions: number,
  ignitionsPerSec: number,
  lightEvents: number,
  lightEventsPerSec: number,
  minEventMs: number,
  minAttackMs: number,
  maxLights: number,
  worstFrameMs: number,
  longFrames: Array<string>,
};

/** The budget over [from, to): what the eye got in that window. */
function budgetOf(samples: ReadonlyArray<Sample>, loaf: ReadonlyArray<{t: number, dur: number}>, from: number, to: number): Budget {
  const win = samples.filter((s) => s.t >= from && s.t < to);
  const ignitionTimes: Array<number> = [];
  for (let i = 1; i < win.length; i++) {
    const prev = new Set(win[i - 1].on);
    for (const key of win[i].on) {
      if (!prev.has(key)) {
        ignitionTimes.push(win[i].t);
      }
    }
  }
  const events = lightEvents(samples).filter((e) => e.start >= from && e.start < to);
  let maxLights = 0;
  for (const s of win) {
    maxLights = Math.max(maxLights, Object.values(s.lum).filter((v) => v > 0.3).length);
  }
  // An event cut by the window's end, or still standing at the end of the samples, has no honest length.
  const whole = events.filter((e) => e.end > e.start && e.end < (samples[samples.length - 1]?.t ?? 0));
  return {
    ignitions: ignitionTimes.length,
    ignitionsPerSec: perSecond(ignitionTimes),
    lightEvents: events.length,
    lightEventsPerSec: perSecond(events.map((e) => e.start)),
    minEventMs: whole.length === 0 ? -1 : Math.min(...whole.map((e) => e.end - e.start)),
    minAttackMs: events.length === 0 ? -1 : Math.min(...events.map((e) => e.peakAt - e.start)),
    maxLights,
    worstFrameMs: Math.max(0, ...loaf.filter((f) => f.t >= from && f.t < to).map((f) => f.dur)),
    longFrames: loaf.filter((f) => f.t >= from && f.t < to && f.dur > 100).map((f) => `${f.dur}@${f.t}`),
  };
}

function firstAt(samples: ReadonlyArray<Sample>, phase: string): number {
  return samples.find((s) => s.phase === phase)?.t ?? -1;
}

function writeBench(profile: string, name: string, data: unknown): void {
  const dir = path.join(OUT, profile);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2));
}

/** The budget's verdict — a hard expect, or (the «before» of a build that predates the law) an annotation. */
function judge(ok: boolean, what: string): void {
  if (REPORT_ONLY) {
    test.info().annotations.push({type: ok ? 'budget-ok' : 'budget-over', description: what});
    return;
  }
  expect(ok, what).toBe(true);
}

async function settled(page: Page): Promise<void> {
  await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 150_000, 'the settled results');
}

async function serverTotals(request: Parameters<typeof getModel>[0], id: string): Promise<Array<number>> {
  const model = await getModel(request, id);
  return model.players.map((p) => p.victoryPointsBreakdown?.total ?? -1).sort((a, b) => b - a);
}

async function shownTotals(page: Page): Promise<Array<number>> {
  return (await page.locator('.con-eg__total-num').allTextContents()).map((t) => Number(t.trim())).sort((a, b) => b - a);
}

/** X on the SECOND category (the reference of the hurry: one natural category played, the rest hurried). */
async function hurryOnSecondCategory(page: Page): Promise<number> {
  await waitWithFrames(page, async () => Number(await page.locator('.con-endgame').getAttribute('data-eg-cat')) >= 1, 60_000, 'the second category');
  const xAt = await page.evaluate(() => {
    const p = (window as unknown as {__budget?: {samples: Array<{t: number}>}}).__budget;
    return p?.samples[p.samples.length - 1]?.t ?? 0;
  });
  await page.keyboard.press('KeyX');
  return xAt;
}

test.describe('console finale — the light budget (4K, DOM)', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

  test('J1 · the natural count stays inside the budget', async ({page, request}) => {
    test.setTimeout(600_000);
    await armBudgetProbe(page);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    const unpump = await pumpFrames(page);
    await journeyToEndgame(page, request, ids);
    await settled(page);
    await unpump();
    const {samples, loaf} = await readBudgetProbe(page);
    const countFrom = firstAt(samples, 'scoring');
    const countTo = firstAt(samples, 'settling');
    expect(countFrom, 'the count was sampled').toBeGreaterThanOrEqual(0);
    const budget = budgetOf(samples, loaf, countFrom, countTo > countFrom ? countTo : Infinity);
    const bench = {
      scene: 'natural',
      countMs: countTo - countFrom,
      toRankingMs: firstAt(samples, 'ranking'),
      toWinnerMs: firstAt(samples, 'winner'),
      toActionsMs: firstAt(samples, 'actions'),
      budget,
    };
    writeBench('tv4k', 'finale-rich-5p-natural', bench);
    console.log('[budget natural]', JSON.stringify(bench));
    test.info().annotations.push({type: 'bench', description: JSON.stringify(bench)});
    judge(budget.maxLights <= MAX_LIGHTS, `≤ ${MAX_LIGHTS} light at a time (saw ${budget.maxLights})`);
    judge(budget.minEventMs < 0 || budget.minEventMs >= MIN_EVENT_MS, `no luminous event shorter than ${MIN_EVENT_MS} ms (shortest ${budget.minEventMs})`);
    judge(budget.lightEventsPerSec <= MAX_SWINGS_PER_SEC, `≤ ${MAX_SWINGS_PER_SEC} luminous events a second (densest ${budget.lightEventsPerSec})`);
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
  });

  test('J2 · X on the second category — ONE pass, an odometer, ×1 ranking and crowning, inside the budget', async ({page, request}) => {
    test.setTimeout(600_000);
    await armBudgetProbe(page);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    const unpump = await pumpFrames(page);
    await journeyToEndgame(page, request, ids);
    const xAt = await hurryOnSecondCategory(page);
    await settled(page);
    await unpump();
    const {samples, loaf} = await readBudgetProbe(page);
    const after = samples.filter((s) => s.t > xAt);
    const countEnd = after.find((s) => s.phase === 'settling' || s.phase === 'ranking')?.t ?? -1;
    const budget = budgetOf(samples, loaf, xAt, countEnd > xAt ? countEnd : Infinity);
    // THE ODOMETER: after X every seat's shown total only ever rises (a step back is a count told twice).
    const backwards: Array<string> = [];
    for (const color of Object.keys(after[0]?.totals ?? {})) {
      let prev = -Infinity;
      for (const s of after.filter((x) => x.phase === 'scoring')) {
        const v = Number(s.totals[color]);
        if (Number.isFinite(v) && v < prev) {
          backwards.push(`${color} ${prev} → ${v} @${s.t}`);
        }
        prev = Number.isFinite(v) ? v : prev;
      }
    }
    const bench = {
      scene: 'hurried',
      xAt,
      afterX: {
        toSettling: (after.find((s) => s.phase === 'settling')?.t ?? -1) - xAt,
        toRanking: firstAt(after, 'ranking') - xAt,
        toWinner: firstAt(after, 'winner') - xAt,
        toActions: firstAt(after, 'actions') - xAt,
      },
      remainderMs: countEnd - xAt,
      budget,
      backwards,
    };
    writeBench('tv4k', 'finale-rich-5p-x', bench);
    console.log('[budget hurried]', JSON.stringify(bench));
    test.info().annotations.push({type: 'bench', description: JSON.stringify(bench)});
    judge(budget.maxLights <= MAX_LIGHTS, `≤ ${MAX_LIGHTS} light at a time under X (saw ${budget.maxLights})`);
    judge(budget.minEventMs < 0 || budget.minEventMs >= MIN_EVENT_MS, `no luminous event shorter than ${MIN_EVENT_MS} ms under X (shortest ${budget.minEventMs})`);
    judge(budget.lightEventsPerSec <= MAX_SWINGS_PER_SEC, `≤ ${MAX_SWINGS_PER_SEC} luminous events a second under X (densest ${budget.lightEventsPerSec})`);
    judge(bench.remainderMs > 0 && bench.remainderMs <= HURRIED_REMAINDER_MS, `the hurried remainder is one pass ≤ ${HURRIED_REMAINDER_MS} ms (${bench.remainderMs})`);
    judge(backwards.length === 0, `the odometer never steps back: ${backwards.join(', ')}`);
    // The ranking and the crowning are reached — never a jump to the end.
    const phases: Array<string> = [];
    for (const s of after) {
      if (phases[phases.length - 1] !== s.phase) {
        phases.push(s.phase);
      }
    }
    expect(phases, `the phases after X: ${phases.join(' → ')}`).toEqual(expect.arrayContaining(['ranking', 'winner', 'actions']));
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
  });
});

/** One screencast frame: its time (ms from the first) and the podium's mean luma (0–255). */
type LumaFrame = {t: number, luma: number};

/**
 * The podium's mean luma, frame by frame — JPEG frames off the screencast (the frame pump), decoded AFTER the count by
 * the page itself (`createImageBitmap` — no image library in the test tree), in batches.
 */
async function recordLuma(page: Page, keepAs?: string): Promise<{stop: () => Promise<Array<LumaFrame>>}> {
  const client = await page.context().newCDPSession(page);
  const frames: Array<{t: number, data: string, w: number}> = [];
  client.on('Page.screencastFrame', (frame) => {
    frames.push({t: (frame.metadata.timestamp ?? 0) * 1000, data: frame.data, w: frame.metadata.deviceWidth});
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 80, maxWidth: 960, maxHeight: 540, everyNthFrame: 1});
  return {
    stop: async () => {
      await client.send('Page.stopScreencast').catch(() => undefined);
      const box = await page.evaluate(() => {
        const rows = document.querySelector('.con-eg__rows')?.getBoundingClientRect();
        const rail = document.querySelector('.con-eg__rail')?.getBoundingClientRect();
        if (rows === undefined || rail === undefined) {
          return undefined;
        }
        return {left: rows.left, top: rail.top, right: rows.right, bottom: rows.bottom};
      });
      expect(box, 'the podium was measured').toBeDefined();
      const t0 = frames[0]?.t ?? 0;
      if (keepAs !== undefined) {
        fs.rmSync(keepAs, {recursive: true, force: true});
        fs.mkdirSync(keepAs, {recursive: true});
        for (const f of frames) {
          fs.writeFileSync(path.join(keepAs, `t${String(Math.round(f.t - t0)).padStart(5, '0')}.jpg`), Buffer.from(f.data, 'base64'));
        }
      }
      const out: Array<LumaFrame> = [];
      for (let i = 0; i < frames.length; i += 40) {
        const batch = frames.slice(i, i + 40);
        const lumas = await page.evaluate(async ({batch, box}) => {
          const res: Array<number> = [];
          for (const f of batch) {
            const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
            const bmp = await createImageBitmap(new Blob([bytes], {type: 'image/jpeg'}));
            const k = bmp.width / f.w;
            const x0 = Math.max(0, Math.floor(box.left * k));
            const y0 = Math.max(0, Math.floor(box.top * k));
            const w = Math.max(1, Math.min(bmp.width, Math.ceil(box.right * k)) - x0);
            const h = Math.max(1, Math.min(bmp.height, Math.ceil(box.bottom * k)) - y0);
            const canvas = new OffscreenCanvas(w, h);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(bmp, x0, y0, w, h, 0, 0, w, h);
            const px = ctx.getImageData(0, 0, w, h).data;
            let sum = 0;
            for (let j = 0; j < px.length; j += 4) {
              sum += 0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2];
            }
            res.push(sum / (px.length / 4));
          }
          return res;
        }, {batch, box: box!});
        batch.forEach((f, j) => out.push({t: Math.round(f.t - t0), luma: Math.round(lumas[j] * 100) / 100}));
      }
      return out;
    },
  };
}

/** The fast swings of a luma series: a zig-zag with threshold `threshold` whose leg took ≤ `withinMs`. */
function fastSwings(series: ReadonlyArray<LumaFrame>, threshold: number, withinMs = 400): Array<number> {
  const out: Array<number> = [];
  if (series.length === 0) {
    return out;
  }
  let anchor = series[0];
  let dir = 0;
  let extreme = series[0];
  for (const f of series) {
    if (dir >= 0 && f.luma >= extreme.luma) {
      extreme = f;
    }
    if (dir <= 0 && f.luma <= extreme.luma) {
      extreme = f;
    }
    const swing = extreme.luma - anchor.luma;
    if (dir === 0 && Math.abs(f.luma - anchor.luma) >= threshold) {
      dir = f.luma > anchor.luma ? 1 : -1;
      extreme = f;
    } else if (dir !== 0 && Math.abs(f.luma - extreme.luma) >= threshold && Math.sign(f.luma - extreme.luma) === -dir) {
      if (Math.abs(swing) >= threshold && extreme.t - anchor.t <= withinMs) {
        out.push(extreme.t);
      }
      anchor = extreme;
      extreme = f;
      dir = -dir;
    }
  }
  return out;
}

test.describe('console finale — the brightness (FHD screencast)', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  for (const scene of ['natural', 'hurried'] as const) {
    test(`K · ${scene} — the podium's brightness swings ≤ ${MAX_SWINGS_PER_SEC} a second`, async ({page, request}) => {
      test.setTimeout(600_000);
      await armBudgetProbe(page);
        const ids = await fixtureTable(request, 'finale-rich-5p');
      await journeyToEndgame(page, request, ids);
      const rec = await recordLuma(page, KEEP_FRAMES ? path.join(OUT, 'fhd', `story-${scene}`) : undefined);
      if (scene === 'hurried') {
        await hurryOnSecondCategory(page);
      }
      await waitWithFrames(page, async () => (await page.locator('.con-endgame--settling, .con-endgame--ranking, .con-eg__actions').count()) > 0,
        150_000, 'the end of the count');
      const raw = await rec.stop();
      await settled(page);
      await readBudgetProbe(page);
      // The screencast hands back an occasional EMPTY frame (≈ 10 % — a black JPEG): a frame darker than half the
      // median is the pump's, never the scene's, and would read as a swing of its own.
      const median = [...raw.map((f) => f.luma)].sort((a, b) => a - b)[Math.floor(raw.length / 2)] ?? 0;
      const series = raw.filter((f) => f.luma > median * 0.5);
      expect(series.length, 'the screencast delivered frames').toBeGreaterThan(30);
      const table: Record<string, {swings: number, perSec: number}> = {};
      for (const threshold of [0.5, 1, 2]) {
        const swings = fastSwings(series, threshold);
        table[`T${threshold}`] = {swings: swings.length, perSec: perSecond(swings)};
      }
      const bench = {scene, frames: series.length, dropped: raw.length - series.length, spanMs: series[series.length - 1].t, fps: Math.round(series.length / (series[series.length - 1].t / 1000)), swings: table};
      writeBench('fhd', `finale-rich-5p-luma-${scene}`, {...bench, series});
      console.log(`[luma ${scene}]`, JSON.stringify(bench));
      test.info().annotations.push({type: 'luma', description: JSON.stringify(bench)});
      // The podium's mean luma lives in a narrow band (≈ 29–38 of 255 on the dark stage): a swing of ONE luma unit
      // inside 400 ms is a change of light the eye takes as a pulse (the «before» hurry: 8 a second).
      judge(table.T1.perSec <= MAX_SWINGS_PER_SEC, `≤ ${MAX_SWINGS_PER_SEC} brightness swings (≥ 1 luma in 400 ms) a second — densest ${table.T1.perSec}`);
    });
  }
});

/** STILLS (opt-in): the frozen clock after «Повторить подсчёт»; GSAP steps on the fake rAF, CSS settles on real time. */
test.describe('console finale — stills (4K, frozen clock)', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});
  test.skip(process.env.TM_E2E_FINALE_STILLS !== '1', 'stills are opt-in (TM_E2E_FINALE_STILLS=1)');

  async function replayFrozen(page: Page): Promise<void> {
    // The post-game list: walk to «Повторить подсчёт» and press it.
    const labels = await page.locator('.con-eg__action-label').allTextContents();
    const at = labels.findIndex((l) => /Повторить подсчёт/i.test(l));
    expect(at, `the replay action is listed (${labels.join(' · ')})`).toBeGreaterThanOrEqual(0);
    const focused = await page.locator('.con-eg__action').evaluateAll((els) => els.findIndex((el) => el.classList.contains('con-eg__action--focused')));
    for (let i = focused; i < at; i++) {
      await page.keyboard.press('ArrowDown');
    }
    for (let i = focused; i > at; i--) {
      await page.keyboard.press('ArrowUp');
    }
    await page.keyboard.press('Enter');
  }

  async function stepTo(page: Page, ms: number): Promise<void> {
    for (let t = 0; t < ms; t += 16) {
      await page.clock.runFor(16);
    }
    await cinematicBeat(page, 700, 'the CSS transitions run on REAL time under the frozen clock — let them land before the still');
  }

  for (const scene of ['natural', 'hurried'] as const) {
    test(`S · ${scene}`, async ({page, request}) => {
      test.setTimeout(900_000);
      await page.clock.install();
      const ids = await fixtureTable(request, 'finale-rich-5p');
      await journeyToEndgame(page, request, ids);
      await page.keyboard.press('KeyX');
      await settled(page);
      await page.clock.pauseAt(Date.now() + 1000);
      await replayFrozen(page);
      const dir = path.join(OUT, 'tv4k', `stills-${scene}`);
      fs.mkdirSync(dir, {recursive: true});
      const moments = scene === 'natural' ?
        [600, 1400, 2200, 3600, 6000, 9000] :
        [600, 1300, 1500, 1800, 2200, 2700];
      let now = 0;
      for (const [i, at] of moments.entries()) {
        if (scene === 'hurried' && i === 1) {
          await page.keyboard.press('KeyX');
        }
        await stepTo(page, at - now);
        now = at;
        await page.screenshot({path: path.join(dir, `${String(i + 1).padStart(2, '0')}-t${at}.png`)});
      }
    });
  }
});
