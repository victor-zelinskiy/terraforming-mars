/*
 * TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ» — the finale as a PODIUM, end to end, on the SATURATED fixtures (every base score
 * category, the winner not the viewer — `finale-rich-5p` / `-2p`).
 *
 *  A · the results of FIVE players at 4K / FHD / Deck: the winner is the hero (≥ a third of the opening's height, the
 *      tallest seat, a face), five seats with five corporation faces, the content reaching the opening's foot (≥ 85 %),
 *      no empty band over a third of the height, no scroll, no text under the couch floor outside a card face;
 *  B · the DUEL: two side-by-side seats, the hero ≥ a third, both faces;
 *  C′ · THE COUNT ARRIVES AS LIGHT (T08): an init-script probe (setInterval — never rAF, from the mount) sees ONE
 *      light per category and never a body crossing the stage, the seats' medallions igniting IN TURN left to right
 *      (a cascade, never «all at once»), and a seat's total standing until ITS ignition; the server's totals;
 *  H · X HURRIES, never skips: the categories after X are a fraction of a natural one, the pace returns before the
 *      ranking, the ranking FLIP and the crowning FLIP play at the full pace, the bar drops X; the server's totals;
 *  D · the overview's «Счёт» and «Игроки» fill the opening with the same objects (faces, medallions);
 *  G · reduced motion: no light ever falls, the result is the same; I · reduced motion + X lands atomically.
 * The hidden score opens HERE: the totals on the podium are the server's own breakdown totals. TIMING class
 * (`timingSpecs.ts` — the stagger, the hurry's share and the crowning's pace are motion): `--exclusive --workers=1`.
 */
import {test, expect, Page} from './consoleTest';
import {fixtureTable, getModel, journeyToEndgame, pumpFrames, shoot, storyboard, waitWithFrames} from './consoleEndgameHarness';

const SHOT_DIR = 'screenshots/console-finale-podium';

type Shares = {
  rootH: number,
  contentBottom: number,
  heroHeight: number,
  maxVoid: number,
  scrolls: boolean,
  below: Array<string>,
  seats: number,
  faces: number,
};

/** The opening's shares: the content's foot, the hero's height, the largest empty band, the type under the floor. */
async function shares(page: Page, rootSel: string, tv: boolean): Promise<Shares> {
  return await page.evaluate(({sel, tv}) => {
    const root = document.querySelector<HTMLElement>(sel)!;
    const rr = root.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const floorPx = tv ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor')) * rem : 0;
    const spans: Array<[number, number]> = [];
    const below: Array<string> = [];
    let bottom = rr.top;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) {
        continue;
      }
      const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      const object = own || el.tagName === 'IMG' || el.classList.contains('pcard') || cs.backgroundImage.includes('url(');
      if (object) {
        spans.push([Math.max(r.top, rr.top), Math.min(r.bottom, rr.bottom)]);
        bottom = Math.max(bottom, Math.min(r.bottom, rr.bottom));
      }
      if (tv && own && el.closest('svg') === null && el.closest('.pcard') === null && el.closest('.gp-glyph') === null) {
        const z = (el as unknown as {currentCSSZoom?: number}).currentCSSZoom ?? 1;
        const px = parseFloat(cs.fontSize) * z;
        if (px + 0.5 < floorPx) {
          below.push(`${el.className.toString().split(' ')[0]} «${(el.textContent ?? '').trim().slice(0, 20)}» ${Math.round(px)}px`);
        }
      }
    }
    spans.sort((a, b) => a[0] - b[0]);
    let maxVoid = 0;
    let reach = rr.top;
    for (const [top, end] of spans) {
      maxVoid = Math.max(maxVoid, top - reach);
      reach = Math.max(reach, end);
    }
    const hero = document.querySelector<HTMLElement>('.con-eg__row--hero, .con-ovpl__hero');
    return {
      rootH: rr.height,
      contentBottom: (bottom - rr.top) / rr.height,
      heroHeight: hero === null ? 0 : hero.getBoundingClientRect().height / rr.height,
      maxVoid: maxVoid / rr.height,
      scrolls: root.scrollHeight > root.clientHeight + 1,
      below,
      seats: document.querySelectorAll('.con-eg__row').length,
      faces: document.querySelectorAll('.con-eg__face .pcard').length,
    };
  }, {sel: rootSel, tv});
}

/**
 * The scene is AT REST: two consecutive equal reads of every measured object under `sel` (a seat, a face, a board
 * line, the players' hero) — a state, never a duration (a FLIP / a crowning / a fit still moving reads differently).
 */
async function layoutAtRest(page: Page, sel: string, what: string): Promise<void> {
  let last = '';
  await waitWithFrames(page, async () => {
    const now = await page.evaluate((s) => Array.from(document.querySelectorAll<HTMLElement>(
      `${s} .pcard, ${s} [data-eg-row], ${s} .con-ovs__line, ${s} .con-ovpl__hero, ${s} .con-ovpl__group`))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)},${getComputedStyle(el).opacity}`;
      }).join('|'), sel);
    const same = now !== '' && now === last;
    last = now;
    return same;
  }, 20_000, what);
}

async function settled(page: Page): Promise<void> {
  await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 150_000, 'the settled results');
  await layoutAtRest(page, '.con-endgame', 'the podium at rest');
}

/** Turn the overview's tabs with E until `name` is the active one — each press waits for the tab to change. */
async function overviewTab(page: Page, name: RegExp): Promise<void> {
  const active = async () => (await page.locator('.con-egov__tab--active').first().textContent()) ?? '';
  for (let i = 0; i < 7 && !name.test(await active()); i++) {
    const before = await active();
    await page.keyboard.press('KeyE');
    await waitWithFrames(page, async () => (await active()) !== before, 8_000, `the overview's tab after «${before.trim()}»`);
  }
  expect(await active()).toMatch(name);
}

async function serverTotals(request: Parameters<typeof getModel>[0], id: string): Promise<Array<number>> {
  const model = await getModel(request, id);
  return model.players.map((p) => p.victoryPointsBreakdown?.total ?? -1).sort((a, b) => b - a);
}

async function shownTotals(page: Page): Promise<Array<number>> {
  return (await page.locator('.con-eg__total-num').allTextContents()).map((t) => Number(t.trim())).sort((a, b) => b - a);
}

for (const profile of [
  {name: 'tv4k', viewport: {width: 3840, height: 2160}, tv: true},
  {name: 'fhd', viewport: {width: 1920, height: 1080}, tv: false},
  {name: 'deck', viewport: {width: 1280, height: 800}, tv: false},
] as const) {
  test.describe(`console finale podium — five players · ${profile.name}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1});

    test('A · the hero, five faces on the horizon, the opening filled, the type at the floor', async ({page, request}) => {
      test.setTimeout(600_000);
      const ids = await fixtureTable(request, 'finale-rich-5p');
      await journeyToEndgame(page, request, ids);
      await page.keyboard.press('KeyX'); // the count is C's subject — land on the canonical results
      await settled(page);
      await shoot(page, SHOT_DIR, `${profile.name}-5p-results`);
      const s = await shares(page, '.con-endgame', profile.tv);
      expect(s.seats, 'five seats').toBe(5);
      expect(s.faces, 'five corporation faces').toBe(5);
      expect(s.scrolls, 'five players stay one screen, no scroll').toBe(false);
      expect(s.heroHeight, `the hero is a third of the opening (${s.heroHeight.toFixed(2)})`).toBeGreaterThanOrEqual(1 / 3);
      expect(s.contentBottom, `the content reaches the opening's foot (${s.contentBottom.toFixed(2)})`).toBeGreaterThanOrEqual(0.85);
      expect(s.maxVoid, `no empty band over a third (${s.maxVoid.toFixed(2)})`).toBeLessThanOrEqual(1 / 3);
      expect(s.below, 'no text under the couch floor outside a card face').toEqual([]);
      // The hero is the TALLEST seat; the winner's ribbon stands on it.
      const heights = await page.locator('.con-eg__row').evaluateAll((els) => els.map((el) => ({
        hero: el.classList.contains('con-eg__row--hero'), h: el.getBoundingClientRect().height,
      })));
      const heroH = Math.max(...heights.filter((x) => x.hero).map((x) => x.h));
      expect(heights.filter((x) => !x.hero).every((x) => x.h < heroH)).toBe(true);
      await expect(page.locator('.con-eg__row--hero .con-eg__ribbon')).toHaveCount(1);
      // The hidden score opens HERE — the server's own totals.
      expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    });
  });
}

for (const profile of [
  {name: 'tv4k', viewport: {width: 3840, height: 2160}, tv: true},
  {name: 'fhd', viewport: {width: 1920, height: 1080}, tv: false},
  {name: 'deck', viewport: {width: 1280, height: 800}, tv: false},
] as const) {
  test.describe(`console finale podium — the duel · ${profile.name}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1});

    test('B · two heroes side by side; D · the overview\'s Score and Players fill the opening with faces', async ({page, request}) => {
      test.setTimeout(600_000);
      const ids = await fixtureTable(request, 'finale-rich-2p');
      await journeyToEndgame(page, request, ids);
      await page.keyboard.press('KeyX');
      await settled(page);
      await shoot(page, SHOT_DIR, `${profile.name}-2p-results`);
      await expect(page.locator('.con-eg__rows--side')).toHaveCount(1);
      const s = await shares(page, '.con-endgame', profile.tv);
      expect(s.seats).toBe(2);
      expect(s.faces).toBe(2);
      expect(s.heroHeight, `the duel's hero is a third of the opening (${s.heroHeight.toFixed(2)})`).toBeGreaterThanOrEqual(1 / 3);
      expect(s.contentBottom).toBeGreaterThanOrEqual(0.85);
      expect(s.below).toEqual([]);
      // Every seat HOLDS its reading column (the name over the seat and the medallions over the actions on a narrow box
      // were the Deck's defect) — and nothing of a seat reaches into the actions below.
      const spill = await page.evaluate(() => {
        const out: Array<string> = [];
        const actions = document.querySelector('.con-eg__actions')?.getBoundingClientRect();
        for (const row of Array.from(document.querySelectorAll<HTMLElement>('.con-eg__row'))) {
          const seat = row.getBoundingClientRect();
          const read = row.querySelector('.con-eg__read')?.getBoundingClientRect();
          if (read !== undefined && (read.top < seat.top - 1 || read.bottom > seat.bottom + 1)) {
            out.push(`${row.dataset.egRow}: read ${Math.round(read.top)}–${Math.round(read.bottom)} vs seat ${Math.round(seat.top)}–${Math.round(seat.bottom)}`);
          }
          const overlapsX = actions !== undefined && seat.right > actions.left && seat.left < actions.right;
          if (actions !== undefined && overlapsX && seat.bottom > actions.top + 1) {
            out.push(`${row.dataset.egRow}: seat foot ${Math.round(seat.bottom)} under the actions' top ${Math.round(actions.top)}`);
          }
        }
        return out;
      });
      expect(spill, 'every seat holds its reading column, clear of the actions').toEqual([]);

      // D · «Обзор партии» → «Счёт»: the board with a face per place, filling the opening.
      await page.keyboard.press('Enter');
      await waitWithFrames(page, async () => (await page.locator('.con-egov').count()) > 0, 15_000, 'the overview');
      await overviewTab(page, /Счёт/i);
      await waitWithFrames(page, async () => (await page.locator('.con-ovs__board').count()) > 0, 8_000, 'the score board');
      await layoutAtRest(page, '.con-egov', 'the score board at rest');
      await shoot(page, SHOT_DIR, `${profile.name}-2p-ov-score`);
      expect(await page.locator('.con-ovs__seat .pcard').count(), 'a face per place').toBe(2);
      const score = await shares(page, '.con-egov', profile.tv);
      expect(score.contentBottom, `the board reaches the opening's foot (${score.contentBottom.toFixed(2)})`).toBeGreaterThanOrEqual(0.85);
      expect(score.below).toEqual([]);
      // «Игроки»: the participant's face as the hero, the milestones / awards as medallions.
      await overviewTab(page, /Игроки/i);
      await waitWithFrames(page, async () => (await page.locator('.con-ovpl__hero').count()) > 0, 8_000, 'the players sheet');
      await layoutAtRest(page, '.con-egov', 'the players sheet at rest');
      await shoot(page, SHOT_DIR, `${profile.name}-2p-ov-players`);
      expect(await page.locator('.con-ovpl__hero .pcard').count(), 'the participant\'s face').toBe(1);
      const players = await shares(page, '.con-egov', profile.tv);
      expect(players.contentBottom).toBeGreaterThanOrEqual(0.85);
      expect(players.below).toEqual([]);
    });
  });
}

/** One sample of the count, taken by an INIT-SCRIPT sampler (setInterval — never rAF; it watches from the mount). */
type CountSample = {
  t: number,
  phase: string,
  beat: string,
  cat: number,
  /** The active rail chip's category key ('' when none). */
  active: string,
  hurried: string,
  /** color → the shown total. */
  totals: Record<string, string>,
  /** color → the active category's medallion is lit on that seat. */
  lit: Record<string, boolean>,
  /** color → the seat's left edge (the cascade's order is the order on screen). */
  left: Record<string, number>,
  /** Children of the light layer, and how many of them paint (the count's moving bodies). */
  lightChildren: number,
  lightVisible: number,
  /** The hero seat's inline transform (the crowning FLIP's own tween), '' at rest. */
  heroTransform: string,
  /** Seats carrying an inline transform (the ranking FLIP). */
  movingSeats: number,
  /** The command bar offers X «Ускорить подсчёт». */
  hurryVerb: boolean,
};

/** Install the sampler BEFORE the journey (the console navigates): every 16 ms from the workspace's mount. */
async function armCountProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const samples: Array<unknown> = [];
    let t0 = -1;
    // THE FRAMES the page did not get (a motion claim is only as good as its frames): every LONG ANIMATION FRAME while
    // the workspace stands — its end, its length, its heaviest script — read beside the verdict (a cascade inside a
    // stall is the frame's verdict), never asserted. LoAF, not a rAF clock: the box's stalls were main-thread frames
    // blocked on the GPU's commit (`WaitForCommitCompletion`), exactly what LoAF measures.
    const stalls: Array<{t: number, gap: number}> = [];
    const loaf: Array<{t: number, dur: number, render: number, style: number, script: string}> = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & {renderStart?: number, styleAndLayoutStart?: number, scripts?: Array<{duration: number, sourceFunctionName?: string, invoker?: string}>}>) {
          if (t0 < 0) {
            continue;
          }
          const top = [...(e.scripts ?? [])].sort((a, b) => b.duration - a.duration)[0];
          if (e.duration > 100) {
            stalls.push({t: Math.round(e.startTime + e.duration - t0), gap: Math.round(e.duration)});
          }
          loaf.push({
            t: Math.round(e.startTime - t0), dur: Math.round(e.duration),
            render: Math.round((e.renderStart ?? e.startTime) - e.startTime),
            style: Math.round(e.startTime + e.duration - (e.styleAndLayoutStart ?? e.startTime + e.duration)),
            script: top === undefined ? '' : `${Math.round(top.duration)} ${top.invoker ?? ''} ${top.sourceFunctionName ?? ''}`,
          });
        }
      }).observe({type: 'long-animation-frame', buffered: false});
    } catch { /* no LoAF */ }
    let left: Record<string, number> | undefined;
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
      const active = document.querySelector<HTMLElement>('.con-eg__lchip--active')?.dataset.egRail ?? '';
      const totals: Record<string, string> = {};
      const lit: Record<string, boolean> = {};
      let movingSeats = 0;
      const measureLeft = left === undefined;
      if (measureLeft) {
        left = {};
      }
      for (const row of Array.from(document.querySelectorAll<HTMLElement>('[data-eg-row]'))) {
        const color = row.dataset.egRow ?? '';
        totals[color] = row.querySelector('[data-eg-total]')?.textContent ?? '';
        lit[color] = active !== '' && row.querySelector(`[data-eg-medal="${active}"]`)?.classList.contains('con-eg__medal--on') === true;
        if (measureLeft) {
          left![color] = Math.round(row.getBoundingClientRect().left);
        }
        if (row.style.transform !== '' && row.style.transform !== 'none') {
          movingSeats++;
        }
      }
      const layer = document.querySelector<HTMLElement>('.con-eg__light');
      let lightVisible = 0;
      for (const el of Array.from(layer?.querySelectorAll<HTMLElement>('.con-eg__beam-wash') ?? [])) {
        if (Number(getComputedStyle(el).opacity) > 0.05) {
          lightVisible++;
        }
      }
      const hero = document.querySelector<HTMLElement>('.con-eg__row--hero');
      samples.push({
        t: Math.round(performance.now() - t0), phase, beat: root.dataset.egBeat ?? '', cat: Number(root.dataset.egCat ?? -1),
        active, hurried: root.dataset.egHurried ?? '', totals, lit, left: left ?? {},
        lightChildren: layer?.querySelectorAll('*').length ?? 0, lightVisible,
        heroTransform: hero !== null && hero.style.transform !== 'none' ? hero.style.transform : '',
        movingSeats,
        hurryVerb: /Ускорить подсчёт/i.test(document.querySelector('.con-cmdbar')?.textContent ?? ''),
      });
    }, 16);
    (window as unknown as {__count: unknown}).__count = {samples, stalls, loaf, stop: () => window.clearInterval(timer)};
  });
}

/** The frames the page did NOT get (a rAF gap over 100 ms ends at `t`) — the last probe read's. */
let lastStalls: Array<{t: number, gap: number}> = [];

async function readCountProbe(page: Page): Promise<Array<CountSample>> {
  const read = await page.evaluate(() => {
    const p = (window as unknown as {__count: {samples: Array<CountSample>, stalls: Array<{t: number, gap: number}>, loaf: Array<{t: number, dur: number, render: number, style: number, script: string}>, stop: () => void}}).__count;
    p.stop();
    return {samples: p.samples, stalls: p.stalls, loaf: p.loaf};
  });
  lastStalls = read.stalls;
  // The frames beside the verdict: the long frames and what filled them.
  const frames = {
    over100: read.loaf.filter((e) => e.dur > 100).length,
    over200: read.loaf.filter((e) => e.dur > 200).length,
    over500: read.loaf.filter((e) => e.dur > 500).length,
    loaf: [...read.loaf].sort((a, b) => b.dur - a.dur).slice(0, 8),
  };
  test.info().annotations.push({type: 'frames', description: JSON.stringify(frames)});
  console.log('[frames]', JSON.stringify(frames));
  return read.samples;
}

/** The time the count's FIRST sample of each (category, seat) shows the seat lit — the ignition, as painted. */
function ignitionTimes(samples: ReadonlyArray<CountSample>): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of samples) {
    if (s.phase !== 'scoring' || s.active === '') {
      continue;
    }
    const seats = out.get(s.active) ?? new Map<string, number>();
    out.set(s.active, seats);
    for (const [color, on] of Object.entries(s.lit)) {
      if (on && !seats.has(color)) {
        seats.set(color, s.t);
      }
    }
  }
  return out;
}

/** The time each category first took the rail's spotlight. */
function focusTimes(samples: ReadonlyArray<CountSample>): Array<{key: string, t: number}> {
  const out: Array<{key: string, t: number}> = [];
  for (const s of samples) {
    if (s.phase === 'scoring' && s.active !== '' && out[out.length - 1]?.key !== s.active) {
      out.push({key: s.active, t: s.t});
    }
  }
  return out;
}

test.describe('console finale podium — the count arrives as light (4K)', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

  test('C′ · one light per category, the seats ignite in turn, a total moves only on its own ignition — no body crosses the stage', async ({page, request}) => {
    test.setTimeout(600_000);
    await armCountProbe(page);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    const unpump = await pumpFrames(page);
    await journeyToEndgame(page, request, ids);
    const stop = await storyboard(page, SHOT_DIR, 'tv4k-5p-count');
    await settled(page);
    await stop();
    await unpump();
    const samples = await readCountProbe(page);
    const counting = samples.filter((s) => s.phase === 'scoring');
    expect(counting.length, 'the probe saw the count').toBeGreaterThan(60);
    // NO BODY CROSSES THE STAGE: the light layer is ONE beam and nothing else, and at most that one light paints.
    expect(Math.max(...samples.map((s) => s.lightChildren)), 'the light layer holds the beam and its wash only').toBeLessThanOrEqual(2);
    expect(Math.max(...samples.map((s) => s.lightVisible)), 'at most ONE light at a time').toBeLessThanOrEqual(1);
    expect(counting.some((s) => s.lightVisible === 1), 'the category\'s light was seen').toBe(true);
    // THE SEATS IGNITE IN TURN, in the order the player reads them (left to right), one stagger apart.
    const ignitions = ignitionTimes(samples);
    const order = Object.entries(counting[0].left).sort((a, b) => a[1] - b[1]).map(([color]) => color);
    expect(order.length).toBe(5);
    // A cascade is judged where the page HAD its frames: a rAF gap over 200 ms inside the cascade's window means the
    // compositor stood still for most of the cascade and its ignitions land in one painted frame — that is the frame's
    // verdict, never the cascade's (PL-868; the stalls are printed with the frames). The box's ~120 ms vsync misses
    // (GPU-side, the main thread idle — the trace) are short of it, and the cascade must read through them.
    let cascades = 0;
    let staggered = 0;
    const stalled: Array<string> = [];
    const spans: Array<string> = [];
    for (const [key, seats] of ignitions) {
      if (seats.size < order.length) {
        continue; // a category whose first sample came late (the entrance) — read the full cascades only
      }
      const times = order.map((color) => seats.get(color)!);
      for (let i = 1; i < times.length; i++) {
        expect(times[i] - times[i - 1], `${key}: seat ${i} ignites after seat ${i - 1} (${times.join(' / ')})`).toBeGreaterThanOrEqual(0);
      }
      const from = times[0] - 350;
      const to = times[times.length - 1] + 30;
      const stall = lastStalls.find((st) => st.gap > 200 && st.t >= from && st.t - st.gap <= to);
      spans.push(`${key} ${times[times.length - 1] - times[0]}`);
      if (stall !== undefined) {
        stalled.push(`${key} (a ${stall.gap} ms frame at ${stall.t})`);
        continue;
      }
      cascades++;
      // Five seats one stagger apart (40 ms in a sub-step, 60 ms a whole category): never «all at once» — at least two
      // painted frames even where a short stall (< 200 ms) folds part of it; and where the frames allow, a true cascade.
      const distinct = new Set(times).size;
      expect(distinct, `${key}: the cascade reads as a cascade, never «all at once» (${times.join(' / ')})`).toBeGreaterThanOrEqual(2);
      if (times[times.length - 1] - times[0] >= 4 * 30) {
        staggered++;
      }
    }
    test.info().annotations.push({type: 'cascades', description: `judged ${cascades}; spans ${spans.join(', ')}; stalled ${stalled.join(', ') || 'none'}`});
    console.log('[cascades]', `judged ${cascades}; spans ${spans.join(', ')}; stalled ${stalled.join(', ') || 'none'}`);
    expect(cascades, `full cascades were read on clean frames (stalled: ${stalled.join(', ') || 'none'})`).toBeGreaterThanOrEqual(3);
    expect(staggered, `most cascades ignite seat by seat (the first to the last ≥ 120 ms): spans ${spans.join(', ')}`).toBeGreaterThanOrEqual(Math.ceil(cascades / 2));
    // A TOTAL MOVES ONLY ON ITS OWN IGNITION: within each category, a seat's total stands until that seat is lit.
    for (const [key, seats] of ignitions) {
      const during = counting.filter((s) => s.active === key);
      for (const color of order) {
        const litAt = seats.get(color);
        if (litAt === undefined || during.length === 0) {
          continue;
        }
        const before = new Set(during.filter((s) => s.t < litAt).map((s) => s.totals[color]));
        expect(before.size, `${key}: ${color}'s total moved before its ignition: ${[...before].join(' → ')}`).toBeLessThanOrEqual(1);
      }
    }
    // The settled podium carries no light over it, and the server's totals.
    expect(samples[samples.length - 1].lightVisible).toBe(0);
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    await expect(page.locator('.con-eg__row--hero')).toHaveCount(1);
  });

  test('H · X HURRIES the count and never skips the crowning: the ranking FLIP, the places and the crown play at the full pace', async ({page, request}) => {
    test.setTimeout(600_000);
    await armCountProbe(page);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    const unpump = await pumpFrames(page);
    await journeyToEndgame(page, request, ids);
    // The first single-beat category (milestones, idx 1) plays at its own pace — the reference; X lands on the next.
    await waitWithFrames(page, async () => Number(await page.locator('.con-endgame').getAttribute('data-eg-cat')) >= 2, 60_000, 'the third category');
    await expect(page.locator('.con-cmdbar'), 'the bar offers the hurry while the count runs').toContainText(/Ускорить подсчёт/i);
    const stop = await storyboard(page, SHOT_DIR, 'tv4k-5p-hurry');
    const xAt = await page.evaluate(() => {
      const p = (window as unknown as {__count: {samples: Array<{t: number}>}}).__count;
      return p.samples[p.samples.length - 1]?.t ?? 0;
    });
    await page.keyboard.press('KeyX');
    await waitWithFrames(page, async () => (await page.locator('.con-endgame[data-eg-hurried="on"]').count()) > 0, 5_000, 'the hurry');
    await page.keyboard.press('KeyX'); // a second X is a no-op
    await settled(page);
    await stop();
    await unpump();
    const samples = await readCountProbe(page);
    const after = samples.filter((s) => s.t > xAt);
    // The phases after X: the count goes on (hurried), then the ranking, then the crowning — never a jump to the end.
    const phases: Array<string> = [];
    for (const s of after) {
      if (phases[phases.length - 1] !== s.phase) {
        phases.push(s.phase);
      }
    }
    expect(phases, `the phases after X: ${phases.join(' → ')}`).toEqual(expect.arrayContaining(['ranking', 'winner', 'actions']));
    expect(phases.indexOf('ranking')).toBeLessThan(phases.indexOf('winner'));
    expect(phases.indexOf('winner')).toBeLessThan(phases.indexOf('actions'));
    // The hurried categories: each a fraction of a natural one (≤ ¼ of the first category's focus-to-focus span).
    const focus = focusTimes(samples);
    const natural = focus.length > 2 ? focus[2].t - focus[1].t : 0;
    expect(natural, 'a natural category was measured before X').toBeGreaterThan(800);
    const hurried = focus.filter((f) => f.t > xAt + 50);
    expect(hurried.length, 'hurried categories were seen').toBeGreaterThan(1);
    // The hurried REMAINDER — X to the count's end — against the same categories at their natural pace: ≤ ¼. The box's
    // long frames (LoAF — the GPU commit; once a category whatever the pace) are the frames', never the hurry's, and
    // come off the remainder (they are printed with the frames).
    const settledAt = after.find((s) => s.phase === 'settling')?.t ?? -1;
    expect(settledAt, 'the hurried count reached its end').toBeGreaterThan(xAt);
    const stallMs = lastStalls.filter((st) => st.t >= xAt && st.t - st.gap <= settledAt).reduce((sum, st) => sum + st.gap, 0);
    const remainder = settledAt - xAt - stallMs;
    expect(remainder, `the hurried remainder (${settledAt - xAt} ms − ${stallMs} ms of long frames) vs ${hurried.length + 1} natural categories of ${natural} ms`)
      .toBeLessThanOrEqual(natural * (hurried.length + 1) / 4);
    // THE PACE RETURNS before the ranking: the ranking FLIP and the crowning FLIP play at ×1.
    const rankAt = after.find((s) => s.phase === 'ranking')?.t ?? -1;
    const returned = after.find((s) => s.hurried === 'returned')?.t ?? -1;
    expect(returned, 'the pace returned').toBeGreaterThan(0);
    expect(returned).toBeLessThanOrEqual(rankAt);
    const flip = after.filter((s) => s.phase === 'ranking' && s.movingSeats > 0);
    expect(flip.length > 0 ? flip[flip.length - 1].t - flip[0].t : 0, 'the ranking FLIP ran at the full pace').toBeGreaterThanOrEqual(400);
    const crown = after.filter((s) => s.heroTransform !== '');
    expect(crown.length > 0 ? crown[crown.length - 1].t - crown[0].t : 0, 'the crowning FLIP ran at the full pace (intermediate transforms seen)').toBeGreaterThanOrEqual(380);
    // Once hurried, the bar no longer offers X (and never during the ranking / crowning).
    expect(after.filter((s) => s.t > xAt + 200 && s.phase !== 'actions').some((s) => s.hurryVerb), 'no X after the hurry').toBe(false);
    // The server's totals.
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    await expect(page.locator('.con-eg__row--hero')).toHaveCount(1);
  });
});

test.describe('console finale podium — MarsBot in the race (FHD)', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('E · the bot is a SEAT with its own corporation face; three seats stack; the server\'s totals', async ({page, request}) => {
    test.setTimeout(600_000);
    const ids = await fixtureTable(request, 'finale-rich-bot');
    await journeyToEndgame(page, request, ids);
    await page.keyboard.press('KeyX');
    await settled(page);
    await shoot(page, SHOT_DIR, 'fhd-bot-results');
    const s = await shares(page, '.con-endgame', false);
    expect(s.seats, 'two humans and the bot').toBe(3);
    expect(s.faces, 'a face per seat — the bot\'s own included').toBe(3);
    await expect(page.locator('[data-eg-face="bot"] .pcard'), 'the MarsBot corporation\'s own face').toHaveCount(1);
    await expect(page.locator('[data-eg-face="card"] .pcard'), 'the humans\' corporation cards').toHaveCount(2);
    await expect(page.locator('.con-eg__rows--side'), 'three seats stack').toHaveCount(0);
    expect(s.scrolls).toBe(false);
    expect(s.heroHeight, `the hero is a third of the opening (${s.heroHeight.toFixed(2)})`).toBeGreaterThanOrEqual(1 / 3);
    expect(s.below).toEqual([]);
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
  });
});

test.describe('console finale podium — reduced motion (FHD)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('G · no light ever falls; the count still lands on the server\'s totals and the podium forms', async ({page, request}) => {
    test.setTimeout(600_000);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    // The live matchMedia is what the console's reduced motion reads (the context option never reached the page
    // here — the effects-explorer / info-workspace precedent sets it on the page).
    await page.emulateMedia({reducedMotion: 'reduce'});
    await journeyToEndgame(page, request, ids);
    // The precondition, read where the product reads it: the OS preference and the console's own bridge.
    expect(await page.evaluate(() => ({
      media: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      bridge: document.documentElement.classList.contains('con-reduced-motion'),
    })), 'the page runs under reduced motion').toEqual({media: true, bridge: true});
    await page.evaluate(() => {
      const seen = {light: 0, samples: 0};
      const timer = window.setInterval(() => {
        seen.samples++;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-eg__beam-wash'))) {
          if (Number(getComputedStyle(el).opacity) > 0.05) {
            seen.light++;
          }
        }
      }, 30);
      (globalThis as unknown as {__rm: {seen: {light: number, samples: number}, stop: () => void}}).__rm = {seen, stop: () => window.clearInterval(timer)};
    });
    await settled(page);
    const seen = await page.evaluate(() => {
      const p = (globalThis as unknown as {__rm: {seen: {light: number, samples: number}, stop: () => void}}).__rm;
      p.stop();
      return p.seen;
    });
    expect(seen.samples, 'the probe sampled').toBeGreaterThan(5);
    expect(seen.light, 'reduced motion draws no light').toBe(0);
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    await expect(page.locator('.con-eg__row--hero')).toHaveCount(1);
  });

  test('I · reduced motion + X lands ATOMICALLY (there is no motion to hurry): no ranking beat, the canonical state', async ({page, request}) => {
    test.setTimeout(600_000);
    await armCountProbe(page);
    const ids = await fixtureTable(request, 'finale-rich-5p');
    await page.emulateMedia({reducedMotion: 'reduce'});
    await journeyToEndgame(page, request, ids);
    await waitWithFrames(page, async () => (await page.locator('.con-endgame--entering, .con-endgame--scoring').count()) > 0, 20_000, 'the count');
    await page.keyboard.press('KeyX');
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 8_000, 'the atomic settle');
    // The sampler's own tick reads the settled root (state, not a sleep).
    await waitWithFrames(page, async () => await page.evaluate(() => {
      const p = (window as unknown as {__count: {samples: Array<{phase: string}>}}).__count;
      return p.samples[p.samples.length - 1]?.phase === 'actions';
    }), 3_000, 'the sampler on the settled root');
    const samples = await readCountProbe(page);
    const phases: Array<string> = [];
    for (const s of samples) {
      if (phases[phases.length - 1] !== s.phase) {
        phases.push(s.phase);
      }
    }
    expect(phases, `the phases: ${phases.join(' → ')}`).not.toContain('ranking');
    expect(phases[phases.length - 1]).toBe('actions');
    expect(await shownTotals(page)).toEqual(await serverTotals(request, ids[0]));
    await expect(page.locator('.con-eg__row--hero')).toHaveCount(1);
  });
});
