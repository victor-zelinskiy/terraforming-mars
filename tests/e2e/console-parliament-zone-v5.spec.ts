import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, bootFixtureSeats, openMandatoryAnnounce, press, pressUntil, settle} from './consoleStart';
import {
  answerAsksAs, answerGateAs, expectRailHonest, mandatoryPlate, openParliament, parliament, parliamentWire,
  PARLIAMENT_PRESETS, sittingStage, waitSittingAtRest,
} from './parliamentDrive';

/**
 * «ЗАСЕДАНИЕ v5» — КОНТРАКТ ЗОН: ЛЕНТА ЧТЕНИЯ и ТЕЛО.
 *
 * The middle zone stopped being «sometimes a scene, sometimes a whole-tier panel». It is a BAND of fixed
 * height that exists always and only ever crossfades its content, plus a BODY that is the row of parties
 * by default and changes exactly twice in a sitting — for an embedded step the player works in, and for
 * the results panel.
 *
 * EVERY PROBE HERE ASSERTS VISIBILITY, not that an event fired: a rect, a non-zero EFFECTIVE opacity
 * (walked up the ancestor chain — a parked tier fades its children by fading itself) and nothing covering
 * the object's own centre, tested both by `elementFromPoint` and by geometric overlap with every mounted
 * panel (a `pointer-events: none` panel is invisible to hit testing and would cover an object unnoticed).
 *
 * The sampler is `setInterval` + `MutationObserver`, never rAF (headless Chromium drives rAF off the
 * compositor and stops exactly when the screen goes quiet). A sample carries the CLOCK that took it: an
 * `mo` sample runs as a microtask and can observe a state between a Vue patch and the `nextTick` that
 * applies an inverse transform — a state the browser never paints. Claims about FRAMES are made on the
 * `tick` samples only.
 */
type Rect = {x: number, y: number, w: number, h: number};
type Vis = {box: boolean, ink: number, free: boolean, overlap: number};
type TileSample = {party: string, where: 'row' | 'ruler', rect: Rect, vis: Vis, y: number};
type V5Sample = {
  src: 'mo' | 'tick',
  t: number, stage: string, motion: string, beat: string, wave: string, swapping: boolean,
  bandRect: Rect | undefined, bandVis: Vis, bandKey: string, bandKicker: string, bandLines: number,
  bodyRect: Rect | undefined, agendaY: number, fieldY: number,
  rowShown: boolean, rowVis: Vis, rowRect: Rect | undefined,
  panel: boolean, panelRect: Rect | undefined, panelInk: number,
  tiles: Array<TileSample>,
  sections: Array<string>, payouts: Array<string>,
};
type V5Probe = {samples: Array<V5Sample>};

const OUT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'parliament-v5');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function armV5Probe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__v5: V5Probe};
    w.__v5 = {samples: []};
    const rect = (el: Element | null | undefined): Rect | undefined => {
      if (el === null || el === undefined) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const area = (a: Rect, b: Rect): number => {
      const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return a.w * a.h === 0 ? 0 : (x * y) / (a.w * a.h);
    };
    const vis = (el: Element | null | undefined): Vis => {
      const r = rect(el);
      if (el === null || el === undefined || r === undefined) {
        return {box: false, ink: 0, free: false, overlap: 1};
      }
      let ink = 1;
      for (let a: Element | null = el; a !== null && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          ink = 0;
          break;
        }
        ink *= Number(cs.opacity === '' ? 1 : cs.opacity);
      }
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const hit = document.elementFromPoint(cx, cy);
      const free = hit !== null && (el.contains(hit) || hit.contains(el));
      // …and GEOMETRICALLY, because a `pointer-events: none` panel never answers `elementFromPoint`.
      let overlap = 0;
      for (const panel of Array.from(document.querySelectorAll('.con-parl__stage'))) {
        const pr = rect(panel);
        const pv = panel === el ? 1 : Number(getComputedStyle(panel).opacity || '1');
        if (pr !== undefined && pv > 0.05 && getComputedStyle(panel).visibility !== 'hidden' && !panel.contains(el)) {
          overlap = Math.max(overlap, area(r, pr));
        }
      }
      return {box: true, ink, free, overlap};
    };
    const tiles = (): Array<TileSample> => Array.from(document.querySelectorAll('.con-parl__party[data-party]')).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        party: el.getAttribute('data-party') ?? '',
        where: el.closest('[data-parl-ruler-slot]') === null ? 'row' as const : 'ruler' as const,
        rect: {x: r.left, y: r.top, w: r.width, h: r.height},
        vis: vis(el),
        y: r.top,
      };
    });
    const sample = (src: 'mo' | 'tick') => {
      const root = document.querySelector('.con-parl');
      if (root === null) {
        return;
      }
      const band = document.querySelector('.con-band');
      const row = document.querySelector('.con-parl__parties-tier');
      const panel = document.querySelector<HTMLElement>('.con-parl__stage');
      const panelShown = panel !== null && getComputedStyle(panel).display !== 'none';
      w.__v5.samples.push({
        src,
        t: performance.now(),
        stage: root.getAttribute('data-sitting-stage') ?? '',
        motion: root.getAttribute('data-sitting-motion') ?? '',
        beat: root.getAttribute('data-sitting-beat') ?? '',
        wave: '',
        swapping: root.classList.contains('con-parl--swapping'),
        bandRect: rect(band),
        bandVis: vis(band),
        bandKey: band?.getAttribute('data-parl-band') ?? '',
        bandKicker: band?.getAttribute('data-parl-band-kicker') ?? '',
        bandLines: document.querySelectorAll('.con-band__line').length,
        bodyRect: rect(document.querySelector('.con-parl__bodyzone')),
        agendaY: document.querySelector('.con-parl__agenda')?.getBoundingClientRect().top ?? -1,
        fieldY: document.querySelector('.con-parl__field')?.getBoundingClientRect().top ?? -1,
        rowShown: row?.getAttribute('data-parl-row-shown') !== null,
        rowVis: vis(row),
        rowRect: rect(row),
        panel: panelShown,
        panelRect: panelShown ? rect(panel) : undefined,
        panelInk: panelShown ? Number(getComputedStyle(panel).opacity || '1') : 0,
        tiles: tiles(),
        sections: Array.from(document.querySelectorAll('[data-sit-section]')).map((el) => el.getAttribute('data-sit-section') ?? ''),
        payouts: Array.from(document.querySelectorAll('[data-sit-payout]')).map((el) => el.getAttribute('data-sit-payout-seat') ?? ''),
      });
    };
    new MutationObserver(() => sample('mo')).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample('tick'), 40);
    sample('tick');
  });
}

async function readV5(page: Page): Promise<V5Probe> {
  return await page.evaluate(() => (window as unknown as {__v5: V5Probe}).__v5);
}

async function openSitting(page: Page, request: Parameters<typeof bootFixtureSeats>[1], fixture: 'parliament-architecture-assembly' | 'parliament-climate-assembly', query: string) {
  const boot = await bootFixtureSeats(page, request, fixture, {query, landing: 'prompt'});
  await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
  expect(await openMandatoryAnnounce(page)).toBe(true);
  await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
  await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
  await waitSittingAtRest(page, 20_000);
  return boot;
}

/** The last answer opens gate 1 and the walk plays itself; come back when everything is at rest. */
async function runWalk(page: Page, request: Parameters<typeof bootFixtureSeats>[1], seat: string): Promise<void> {
  await answerGateAs(request, seat, 'assembly');
  await press(page, 'Enter', 400);
  await expect.poll(() => sittingStage(page), {timeout: 40_000}).not.toBe('verdict');
  await waitSittingAtRest(page, 60_000);
  await settle(page, {timeoutMs: 20_000});
}

const ticks = (s: ReadonlyArray<V5Sample>) => s.filter((x) => x.src === 'tick');
const same = (a: Rect | undefined, b: Rect | undefined) =>
  a !== undefined && b !== undefined && Math.abs(a.y - b.y) < 0.6 && Math.abs(a.h - b.h) < 0.6;

test.describe('«Заседание v5» — ЛЕНТА и ТЕЛО (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('П1 · ЛЕНТА НЕПОДВИЖНА: одна высота и одно положение во всех тактах и в обзоре, дельта ноль', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await openSitting(page, request, 'parliament-architecture-assembly', '&consoleProfile=auto');
    await armV5Probe(page);
    await runWalk(page, request, seats[1]);

    const all = ticks((await readV5(page)).samples);
    expect(all.length, 'the sampler ran (a dead probe passes everything)').toBeGreaterThan(40);
    const withBand = all.filter((s) => s.bandRect !== undefined);
    expect(withBand.length, 'the band was mounted for every sample').toBe(all.length);

    const first = withBand[0].bandRect!;
    const moved = withBand.filter((s) => !same(s.bandRect, first));
    expect(moved.map((s) => `${s.stage}/${s.beat} y=${Math.round(s.bandRect!.y)} h=${Math.round(s.bandRect!.h)}`).slice(0, 6),
      `the band's box never changes (first y=${Math.round(first.y)} h=${Math.round(first.h)})`).toEqual([]);

    // …and it is never hidden or covered: a band that disappears for a beat is the whole defect. Coverage
    // is judged by HIT TESTING here, not by geometry — the band legitimately passes OVER the work surface
    // while it slides to the top of the field for a step, and it is on top for every pixel of that travel.
    // …EXCEPT while the government changes hands: the two plaques travel between the top tier and the row,
    // which is ACROSS the band, and an object in flight is the foreground by design (`--swapping` lifts it
    // out of every clip on its path). That is a tile passing over a rail, not a band that went away.
    const dark = withBand.filter((s) => !s.swapping && (s.bandVis.ink < 0.9 || !s.bandVis.free));
    expect(dark.map((s) => `${s.stage}/${s.beat} ink=${s.bandVis.ink.toFixed(2)} free=${s.bandVis.free}`).slice(0, 6),
      'the band is painted and on top in every frame').toEqual([]);

    // THE CONTENT CHANGES BY A CROSSFADE, and nothing below it moves for that.
    const keys = [...new Set(withBand.map((s) => s.bandKey))];
    expect(keys.length, `the line advanced through the walk (${keys.join(' · ')})`).toBeGreaterThan(2);
    const crossfaded = withBand.some((s) => s.bandLines > 1);
    expect(crossfaded, 'two lines shared the cell at least once — a crossfade, not a swap').toBe(true);
    const bodyTop = withBand[0].bodyRect?.y ?? 0;
    const shifted = withBand.filter((s) => Math.abs((s.bodyRect?.y ?? bodyTop) - bodyTop) > 0.6 || Math.abs(s.agendaY - withBand[0].agendaY) > 0.6);
    expect(shifted.length, 'neither the body nor the Agenda moved when the line changed').toBe(0);

    // …AND IN THE OVERVIEW IT STANDS IN THE SAME PLACE. Close the sitting, walk back in.
    await answerGateAs(request, seats[1], 'adjourn');
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 5, settleMs: 1500}), 'A answers the adjourn gate').toBe(true);
    await settle(page, {timeoutMs: 30_000});
    await openParliament(page);
    const overview = await page.evaluate(() => {
      const b = document.querySelector('.con-band');
      const r = b?.getBoundingClientRect();
      return r === undefined ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height, key: b?.getAttribute('data-parl-band') ?? ''};
    });
    expect(overview, 'the band exists outside a sitting too').toBeDefined();
    expect(same(overview, first), `the overview's band stands where the sitting's did (${JSON.stringify(overview)} vs ${JSON.stringify(first)})`).toBe(true);
    expect(overview!.key.startsWith('overview'), `the overview reads the standing verdict (${overview!.key})`).toBe(true);
    await shoot(page, 'p1-overview-band');
  });

  test('П3 · РЯД ВИДЕН ТАМ, ГДЕ РАБОТАЕТ: все шесть плиток открыты на Повестке, поддержке, принятии и обновлении', async ({page, request}) => {
    test.setTimeout(300_000);
    const {seats} = await openSitting(page, request, 'parliament-architecture-assembly', '&consoleProfile=auto');
    await armV5Probe(page);
    await runWalk(page, request, seats[1]);

    const all = ticks((await readV5(page)).samples);
    // The beats that MOVE something on the table: the Agenda, the support, the enactment, and the renewal.
    const working = all.filter((s) => s.motion !== '' && (s.beat !== '' || s.stage === 'enact' || (s.stage === 'results' && s.panel === false)));
    expect(working.length, 'the physical beats were sampled').toBeGreaterThan(15);
    const bad = working.filter((s) => s.tiles.length < 6 || s.tiles.some((t) => !t.vis.box || t.vis.ink < 0.9 || t.vis.overlap > 0.02));
    expect(bad.map((s) => `${s.stage}/${s.beat} tiles=${s.tiles.length} ` +
      s.tiles.filter((t) => t.vis.ink < 0.9 || t.vis.overlap > 0.02).map((t) => `${t.party}:ink=${t.vis.ink.toFixed(2)}/over=${t.vis.overlap.toFixed(2)}`).join(',')).slice(0, 8),
    'every tile (five in the row + the ruler\'s) is painted and uncovered in every working frame').toEqual([]);
  });

  test('П2+П4 · ТЕЛО МЕНЯЕТСЯ ДВАЖДЫ И ФИЗИЧНО: ряд вниз, новое тело из-под ленты, ни одного пустого кадра', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, seats} = await openSitting(page, request, 'parliament-climate-assembly', '&consoleProfile=auto');
    await armV5Probe(page);
    // Gate 1: the viewer answers, then the other seat — the walk plays and the enacted resolution's TAKE opens.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, seats[1], 'assembly');
    await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take stands').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 30_000);
    await shoot(page, 'p2-step-body');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-extdraw').count() === 0, {tries: 8, settleMs: 2200}), 'the cards are taken').toBe(true);
    await settle(page, {timeoutMs: 30_000});
    // The resolution pays every seat IN TURN: the phase legitimately parks on the reward waiting for the
    // other one's own ask (the band says so — «ОЖИДАНИЕ · player2»). Answer it, and the walk goes on.
    await answerAsksAs(request, seats[1], 6);
    await waitSittingAtRest(page, 60_000);
    await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
    await waitSittingAtRest(page, 60_000);
    await settle(page, {timeoutMs: 20_000});

    const all = ticks((await readV5(page)).samples);
    expect(all.length, 'the sampler ran').toBeGreaterThan(60);

    // ① THE BODY CHANGED EXACTLY THREE TIMES: row → step → row → results.
    const flips: Array<string> = [];
    for (let i = 1; i < all.length; i++) {
      if (all[i].rowShown !== all[i - 1].rowShown) {
        flips.push(`${all[i - 1].rowShown ? 'row' : 'other'}→${all[i].rowShown ? 'row' : 'other'}@${all[i].stage}`);
      }
    }
    expect(flips, `a sitting with a take swaps the body there and back, then once more for the results (${flips.join(' · ')})`).toHaveLength(3);

    // ② NEVER AN EMPTY BODY: some surface is painted inside the zone in every frame.
    const empty = all.filter((s) => (s.rowVis.ink < 0.05 || !s.rowVis.box) && (!s.panel || s.panelInk < 0.05));
    expect(empty.map((s) => `${s.stage} row=${s.rowVis.ink.toFixed(2)} panel=${s.panel}/${s.panelInk.toFixed(2)}`).slice(0, 6),
      'no frame shows an empty body').toEqual([]);

    // ③ THE TRANSITION IS PHYSICAL: while both are on screen the row is BELOW its resting place (the
    //    drawer being pushed shut) and the arriving surface is not yet at full ink — never a cut.
    const restingY = all.find((s) => s.rowShown && s.tiles.some((t) => t.where === 'row'))?.tiles.find((t) => t.where === 'row')?.y ?? 0;
    const both = all.filter((s) => s.panel && s.panelInk > 0.05 && s.rowVis.ink > 0.05);
    expect(both.length, 'the two surfaces overlapped in time — a swap would show none').toBeGreaterThan(2);
    const moving = both.filter((s) => {
      const tile = s.tiles.find((t) => t.where === 'row');
      return tile !== undefined && tile.y > restingY + 2;
    });
    expect(moving.length, `the row was travelling downward while the new body arrived (resting y=${Math.round(restingY)})`).toBeGreaterThan(0);

    // ④ THE BAND KEPT ITS HEIGHT THROUGHOUT and took exactly ONE pose besides standing still: while the
    //    step held the field the whole zone was the work surface and the band rode to its TOP — a slide, and
    //    it comes back. So the claim is about where it SETTLES, never about the frames of the travel.
    const heights = [...new Set(all.map((s) => Math.round(s.bandRect?.h ?? -1)))];
    expect(heights, `the band's height never changes (${heights.join(',')})`).toHaveLength(1);
    const resting = Math.round(all[0].bandRect!.y);
    const fieldTop = Math.round(all[0].fieldY);
    // A PLACE IS HELD FOR A WALL-CLOCK DURATION, never «the same value N samples running»: a starved
    // `setInterval` coalesces its missed ticks and reads one mid-travel pixel three times in a row. The
    // slide is 400 ms, so anything a band HOLDS for 500 ms is a pose and nothing else can be.
    const settled: Array<number> = [];
    let runStart = 0;
    for (let i = 1; i <= all.length; i++) {
      const y = i < all.length ? Math.round(all[i].bandRect?.y ?? -1) : Number.NaN;
      if (y !== Math.round(all[runStart].bandRect?.y ?? -2)) {
        if (all[i - 1].t - all[runStart].t >= 500) {
          settled.push(Math.round(all[runStart].bandRect?.y ?? -1));
        }
        runStart = i;
      }
    }
    // …and a 3 px tolerance, because the slide's easing has a very flat tail.
    const places = [...new Set(settled)].sort((a, b) => a - b);
    const strays = places.filter((y) => Math.abs(y - fieldTop) > 3 && Math.abs(y - resting) > 3);
    expect(strays, `the band settles in exactly two places: the field's top ${fieldTop} for the step, its own ${resting} otherwise (saw ${places.join(',')})`)
      .toEqual([]);
    expect(places.some((y) => Math.abs(y - fieldTop) <= 3), 'it did ride to the top of the field for the step').toBe(true);
    expect(places.some((y) => Math.abs(y - resting) <= 3), 'and it came back').toBe(true);
    const dark = all.filter((s) => !s.swapping && (s.bandVis.ink < 0.9 || !s.bandVis.free));
    expect(dark.map((s) => `${s.stage} ink=${s.bandVis.ink.toFixed(2)} free=${s.bandVis.free}`).slice(0, 4),
      'the band is never hidden and is on top of everything, the step included').toEqual([]);
  });

  test('П6 · ИТОГИ: две секции, выплаты по всем игрокам; без выбора — ровно один переход тела', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId, seats} = await openSitting(page, request, 'parliament-architecture-assembly', '&consoleProfile=auto');
    await armV5Probe(page);
    await runWalk(page, request, seats[1]);
    await expect.poll(() => sittingStage(page), {timeout: 40_000}).toBe('results');
    await waitSittingAtRest(page, 60_000);
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, 'p6-results');

    // A SITTING WITH NOTHING TO ANSWER SWAPS THE BODY EXACTLY ONCE — for the results. Every beat before
    // that (verdict · Agenda · support · enactment · reward) is read on the objects and in the band.
    const all = ticks((await readV5(page)).samples);
    const flips: Array<string> = [];
    for (let i = 1; i < all.length; i++) {
      if (all[i].rowShown !== all[i - 1].rowShown) {
        flips.push(`${all[i - 1].rowShown ? 'row' : 'other'}→${all[i].rowShown ? 'row' : 'other'}@${all[i].stage}`);
      }
    }
    expect(flips, `one transition, and it is the one onto the results (${flips.join(' · ')})`).toHaveLength(1);
    expect(flips[0]).toMatch(/@results$/);

    // «Итоги: честность»: the LAW section is gone — it restated the government's zone, which stands on the
    // same screen and says all three facts more fully. The payouts and the table, and nothing else.
    const sections = await page.locator('[data-sit-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-sit-section')));
    expect(sections, 'the payouts and the table — and nothing else').toEqual(['payouts', 'table']);

    const wire = await parliamentWire(request, playerId);
    const seatCount = (wire.game.parliament as unknown as {players?: Array<{participates: boolean}>})?.players?.filter((p) => p.participates).length ?? seats.length;
    const rows = await page.locator('[data-sit-payout]').evaluateAll((els) => els.map((el) => el.getAttribute('data-sit-payout-seat')));
    expect(rows.length, `a row per participating seat (${rows.join(',')})`).toBe(seatCount);
    expect(new Set(rows).size, 'one row per seat, never two').toBe(rows.length);

    // The table says what has already left the eye — and only that.
    await expect(page.locator('[data-sit-law]'), 'no law member survives').toHaveCount(0);
    await expect(page.locator('[data-sit-row="results-fresh"]')).toHaveCount(1);
    await expect(page.locator('[data-sit-row="results-support"]')).toHaveCount(1);
    await expect(page.locator('[data-sit-row="results-lobby"]')).toHaveCount(1);
  });
});

/**
 * П5 · ГЕОМЕТРИЯ, on every profile: the band is one height in rem everywhere and never wraps or is cut by
 * an ancestor; the ruler's tile and the row's tiles are one box; the shortened Agenda track keeps the three
 * node kinds the same size as each other.
 */
for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`«Заседание v5» — геометрия зон (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('П5 · лента одной высоты в rem, ряд и правитель одной коробки, узлы дорожки одного размера', async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'parliament-actions', {query: preset.query});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, `p5-${preset.id}-overview`);

      const geo = await page.evaluate(() => {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const band = document.querySelector('.con-band');
        const line = document.querySelector('.con-band__line');
        const rowTiles = Array.from(document.querySelectorAll('.con-parl__parties .con-parl__party[data-party]'));
        const ruler = document.querySelector('[data-parl-ruler-slot] .con-parl__party[data-party]');
        const nodes = Array.from(document.querySelectorAll('.con-parl__step-node'))
          .filter((el) => el.closest('.con-parl__step--start') === null);
        const h = (el: Element | null) => (el === null ? -1 : Math.round(el.getBoundingClientRect().height));
        return {
          rem,
          bandH: h(band),
          lineH: h(line),
          lineScrollW: line === null ? 0 : (line as HTMLElement).scrollWidth,
          lineClientW: line === null ? 0 : (line as HTMLElement).clientWidth,
          rowH: rowTiles.map((el) => Math.round(el.getBoundingClientRect().height)),
          rulerH: h(ruler),
          nodeSizes: [...new Set(nodes.map((el) => {
            const r = el.getBoundingClientRect();
            return `${Math.round(r.width)}x${Math.round(r.height)}`;
          }))],
        };
      });

      // ONE HEIGHT IN REM, everywhere (the token is profile-independent by contract).
      expect(geo.bandH / geo.rem, `the band is 1.95rem (${geo.bandH}px at ${geo.rem}px/rem)`).toBeCloseTo(1.95, 1);
      // …and the line never wraps inside it.
      expect(geo.lineH, `the line is ONE line inside the band (${geo.lineH}px of ${geo.bandH}px)`).toBeLessThanOrEqual(geo.bandH);
      await expectRailHonest(page, `${preset.id} band`, '.con-band__line');

      // THE RULER'S TILE IS THE ROW'S TILE — the condition of the physical swap.
      expect(geo.rowH.length, 'the five opposition tiles').toBe(5);
      expect([...new Set(geo.rowH)], `the row's tiles are one box (${geo.rowH.join(',')})`).toHaveLength(1);
      expect(Math.abs(geo.rulerH - geo.rowH[0]), `the ruler's tile is the row's height (${geo.rulerH} vs ${geo.rowH[0]})`).toBeLessThanOrEqual(1);

      // THE SHORTENED TRACK keeps its three node kinds one size between them.
      expect(geo.nodeSizes, `the Agenda's nodes are one size (${geo.nodeSizes.join(' · ')})`).toHaveLength(1);
    });
  });
}
