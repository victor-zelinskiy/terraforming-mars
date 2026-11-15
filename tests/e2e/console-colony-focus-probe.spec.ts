import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, cinematicBeat, press, pressUntilGone, pressUntilVisible, settle} from './consoleStart';
import type {ObservedSample} from './observeCore';
import {readSettled} from './settledRead';
import {armWitness, Witness} from './witness';

/**
 * COLONY FOCUS STAGE PROBE — the visual + motion evidence for the detail
 * stage. It is a PROBE, not a guard: it drives the real flows and prints
 * hard numbers a human then looks at beside the screenshots.
 *
 *   · the ENTRY animation, RECORDED per frame (`armWitness`, armed before the
 *     press) — does the geometry settle BEFORE any text is legible (the
 *     "текст появляется слишком рано" bug)?
 *   · the resting composition in trade / inspect / build;
 *   · the TRADE resolution ON the stage — is the marker proxy the size of
 *     the seat it lands on, and does it fly over a VISIBLE track?
 *   · the BUILD cube — the flying proxy's box vs the seated token's box
 *     (the 2.67× size jump this iteration removed).
 *
 * Evidence lands in screenshots/colony-focus/.
 */

const OUT = path.resolve('screenshots', 'colony-focus');

function newGameConfig(seed = 0.42) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: true,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'FocusProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

async function boot(page: Page, request: APIRequestContext, playerId: string, keep = 'Luna'): Promise<void> {
  // A real hand (`buy`): the board home's dock only reads LIVE with cards in it.
  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: keep});
  await settle(page);
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  await expect.poll(() => colonies.count(), {message: 'colonies section did not open'}).toBeGreaterThan(0);
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  await expect.poll(() => focused.count(), {message: `could not focus ${target}`}).toBeGreaterThan(0);
}

/** One observation of the stage's ENTRY (the time is the record's own). */
type EntrySeen = {stage: boolean, opening: boolean, planetW: number, late: number, items: number};
type Sample = EntrySeen & {t: number};
/** The entry's witness key — one entry at a time (re-arming starts a fresh record). */
const ENTRY = 'colony-focus-entry';

/**
 * RECORD the stage's entry from before the press (`armWitness`, FLAKE ZERO): every frame of the unfold (a clip, an
 * opacity, a width move no DOM — the frame tick reads them) and every write, kept on change with the page's time.
 */
async function armEntry(page: Page): Promise<Witness<EntrySeen>> {
  return armWitness<EntrySeen>(page, ENTRY, () => {
    const op = (el: Element | null) => el === null ? -1 : Number(getComputedStyle(el).opacity);
    const stage = document.querySelector('.con-colfocus');
    const surface = document.querySelector('.con-colfocus__surface');
    const late = Array.from(document.querySelectorAll('.con-colfocus [data-unfold-late]'));
    const items = Array.from(document.querySelectorAll('.con-colfocus [data-unfold-item]'));
    const clip = surface === null ? '' : getComputedStyle(surface).clipPath;
    const planet = document.querySelector('.con-colfocus__planet');
    return {
      stage: stage !== null,
      // A clip that is not `none` means the surface is still OPENING.
      opening: clip !== '' && clip !== 'none',
      planetW: planet === null ? 0 : Math.round(planet.getBoundingClientRect().width),
      late: late.length === 0 ? -1 : Math.max(...late.map(op)),
      items: items.length === 0 ? -1 : Math.max(...items.map(op)),
    };
  });
}

/** The entry's record, timed from the arm (the page's clock). */
async function collect(entry: Witness<EntrySeen>): Promise<Array<Sample>> {
  const samples = await entry.stop();
  const t0 = samples[0]?.t ?? 0;
  return samples.map((s) => ({t: s.t - t0, ...s.v}));
}

/** The resting composition of the focus stage — read at REST (`readSettled`): sizes, clipped heads, overflow. */
async function stageGeometry(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {w: Math.round(r.width), h: Math.round(r.height)};
    };
    return {
      viewport: {w: window.innerWidth, h: window.innerHeight},
      surface: box('.con-colfocus__surface'),
      planet: box('.con-colfocus__planet'),
      track: box('.con-colfocus__xtrack'),
      cell: box('.con-colfocus__xcell'),
      glyph: box('.con-colfocus__xcell-glyph'),
      markerSeat: box('.con-colfocus__xcell--marker .con-colfocus__xcell-seat'),
      stop: box('.con-colfocus__stop'),
      berth: box('.con-colfocus__berth'),
      berthSeat: box('.con-colfocus__berth-seat'),
      ownerBonus: box('.con-colfocus__ownerbonus'),
      config: box('.con-colfocus__config'),
      payRows: document.querySelectorAll('.con-colfocus__payrow').length,
      result: box('.con-colfocus__result'),
      // A zone head whose content is wider than its box = a clipped rule chip.
      headClipped: Array.from(document.querySelectorAll('.con-colfocus__zonehead'))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.scrollWidth}>${el.clientWidth}`),
      // Anything painted OUTSIDE the surface = a clipped/overflowing zone.
      overflow: (() => {
        const s = document.querySelector('.con-colfocus__surface');
        if (s === null) {
          return null;
        }
        const sr = s.getBoundingClientRect();
        return Array.from(document.querySelectorAll('.con-colfocus__payrow, .con-colfocus__berth, .con-colfocus__rsec'))
          .filter((el) => el.getBoundingClientRect().bottom > sr.bottom + 1)
          .map((el) => el.className);
      })(),
    };
  });
}

/** One observation of the TRADE resolution: which surfaces stand, and the marker against the seat it lands on. */
type TradeSeen = {on: string, marker: {w: number, seat: number | null} | null};

/** One observation of the BUILD cube: the flying proxy's box against the destination seat and the seated token. */
type CubeSeen = {proxy: {w: number, h: number} | null, seat: number | null, seated: number | null};

/** A record's samples, timed from its arm. */
function fromArm<T>(samples: ReadonlyArray<ObservedSample<T>>): Array<{t: number, v: T}> {
  const t0 = samples[0]?.t ?? 0;
  return samples.map((s) => ({t: Math.round(s.t - t0), v: s.v}));
}

/** The guard rail of a colony after a build — read at REST (`readSettled`): the comparison of two boxes is only as
 *  settled as its least settled side. */
async function guardRail(page: Page) {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.con-colfocus__xcell'));
    const stop = document.querySelector('.con-colfocus__stop') as HTMLElement | null;
    const track = document.querySelector('.con-colfocus__xtrack') as HTMLElement | null;
    const berths = Array.from(document.querySelectorAll('.con-colfocus__berth'));
    const left = (el: Element) => Math.round(el.getBoundingClientRect().left);
    return {
      protectedCells: cells.filter((c) => c.classList.contains('con-colfocus__xcell--protected')).length,
      takenBerths: berths.filter((b) => b.classList.contains('con-colfocus__berth--taken')).length,
      // The stop must stand on the first UNPROTECTED column, i.e. exactly on
      // cell[protectedCount]'s left edge.
      stopLeft: stop === null ? -1 : Math.round(stop.getBoundingClientRect().left),
      cellLefts: cells.map(left),
      // Berth i must be column-aligned with cell i.
      aligned: berths.every((b, i) => Math.abs(left(b) - left(cells[i])) <= 1),
      stopCol: track === null ? '' : getComputedStyle(track).getPropertyValue('--stop-col').trim(),
    };
  });
}

/** The inspect stage's composition — read at REST: the empty band under the last section. */
async function inspectComposition(page: Page) {
  return page.evaluate(() => ({
    mode: document.querySelector('.con-colfocus')?.className ?? '',
    emptyBottom: (() => {
      const s = document.querySelector('.con-colfocus__surface')?.getBoundingClientRect();
      const last = Array.from(document.querySelectorAll('.con-colfocus__main > section'))
        .map((el) => el.getBoundingClientRect().bottom).sort((a, b) => b - a)[0];
      return s === undefined || last === undefined ? -1 : Math.round(s.bottom - last);
    })(),
  }));
}

/** The stage's SHAPE on a display profile — read at REST after the resize. */
async function stageShape(page: Page) {
  return page.evaluate(() => {
    const surface = document.querySelector('.con-colfocus__surface');
    const sr = surface?.getBoundingClientRect();
    const rowsOf = (sel: string) => new Set(Array.from(document.querySelectorAll(sel))
      .map((el) => Math.round(el.getBoundingClientRect().top))).size;
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      return el === null ? 0 : Math.round(el.getBoundingClientRect().width);
    };
    return {
      profile: Array.from(document.documentElement.classList).find((c) => c.startsWith('con-profile-')) ??
        document.querySelector('.con-root')?.className ?? '',
      trackRows: rowsOf('.con-colfocus__xcell'),
      berthRows: rowsOf('.con-colfocus__berth'),
      cellW: box('.con-colfocus__xcell'),
      glyphW: box('.con-colfocus__xcell-glyph'),
      seatW: box('.con-colfocus__berth-seat'),
      markerSeatW: box('.con-colfocus__xcell-seat'),
      headClipped: Array.from(document.querySelectorAll('.con-colfocus__zonehead'))
        .filter((el) => el.scrollWidth > el.clientWidth + 1).length,
      // A SCROLLBAR OVER THREE PAYMENT OPTIONS IS A BUDGET BUG, not a
      // scrolling need: the panel height must hold the rows at this
      // profile's hit-target size.
      payScroll: (() => {
        const el = document.querySelector('.con-colfocus__configscroll');
        if (el === null) {
          return -1;
        }
        const inner = el.querySelector('*') ?? el;
        return Math.max(0, Math.round((inner.scrollHeight ?? 0) - el.clientHeight));
      })(),
      past: sr === undefined ? -1 : Array.from(document.querySelectorAll('.con-colfocus__payrow, .con-colfocus__berth, .con-colfocus__rsec'))
        .filter((el) => el.getBoundingClientRect().bottom > sr.bottom + 1).length,
    };
  });
}

/** The browse layer's computed state — read at REST after the fold (its breathe-back is a transition). */
async function browseStyle(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.con-colonies__browse') as HTMLElement | null;
    if (el === null) {
      return null;
    }
    const cs = getComputedStyle(el);
    return {opacity: cs.opacity, visibility: cs.visibility, transform: cs.transform};
  });
}

function reportEntry(tag: string, samples: Array<Sample>): void {
  const at = (pred: (s: Sample) => boolean) => samples.find(pred)?.t ?? -1;
  const openingEnd = [...samples].reverse().find((s) => s.opening)?.t ?? -1;
  console.log(`── entry timing (${tag}) ──`);
  console.log(`   stage mounted        : ${at((s) => s.stage)}ms`);
  console.log(`   surface still opening: until ${openingEnd}ms`);
  console.log(`   structure visible ≥50%: ${at((s) => s.items >= 0.5)}ms`);
  console.log(`   TEXT visible ≥50%     : ${at((s) => s.late >= 0.5)}ms`);
  console.log(`   TEXT fully settled    : ${at((s) => s.late >= 0.99)}ms`);
  console.log(`   planet width settle   : ${at((s) => s.planetW >= 200)}ms`);
}

/*
 * NOT `serial`. Each test below creates its OWN game and drives its OWN page,
 * so they share nothing — and `serial` turns the first failure into «did not
 * run» for every later test in the file. That is how a CI report showed «8
 * failed, 3 did not run»: two of those three were simply never attempted, and
 * the run said nothing about whether they still worked.
 */
test('colony focus: entry choreography + trade resolution', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, request, await createGame(request));
  await openColonies(page);
  await focusTile(page, 'Luna');
  await shoot(page, '00-overview');

  // ── ENTRY (trade intent), recorded per frame from before the press ──────
  const entry = await armEntry(page);
  await page.keyboard.press('Enter');
  // A FRAME STRIP of the opening, for eyes: a screenshot costs ~200 ms, so
  // these three land roughly on the unfold, the structure reveal and the
  // fine-print beat.
  await shoot(page, '01a-enter-f0');
  await shoot(page, '01b-enter-f1');
  await shoot(page, '01c-enter-f2');
  await settle(page); // the entry is over — the record holds every frame of it
  reportEntry('trade', await collect(entry));
  await shoot(page, '01-trade-settled');

  const stage = page.locator('.con-colfocus');
  await expect.poll(() => stage.count(), {message: 'the focus stage did not open'}).toBeGreaterThan(0);

  const geom = await readSettled(page, () => stageGeometry(page), {message: 'the focus stage at rest'});
  console.log('── focus stage geometry ──');
  console.log(JSON.stringify(geom, null, 2));

  // ── TRADE resolution: a surface timeline + the marker size, RECORDED from before the press ──────────
  const trade = await armWitness<TradeSeen>(page, 'colony-focus-trade', () => {
    const WATCH: Record<string, string> = {
      stage: '.con-colfocus',
      gliding: '.con-colfocus--gliding',
      browse: '.con-colonies__browse:not(.con-colonies__browse--parked)',
      marker: '.con-coltrade-marker',
      cover: '.con-coltrade-proxy',
      fleet: '.con-fleet-ship',
      reveal: '.con-reveal',
      settled: '.con-colfocus__xcell--settled',
    };
    const on = Object.entries(WATCH)
      .filter(([, sel]) => document.querySelector(sel) !== null)
      .map(([k]) => k).join(',');
    const m = document.querySelector('.con-coltrade-marker') as HTMLElement | null;
    if (m === null || getComputedStyle(m).visibility === 'hidden') {
      return {on, marker: null};
    }
    const seat = document.querySelector('.con-colfocus__xcell-seat');
    const sr = seat?.getBoundingClientRect();
    return {
      on,
      marker: {w: Math.round(m.getBoundingClientRect().width * 10) / 10, seat: sr === undefined ? null : Math.round(sr.width * 10) / 10},
    };
  });
  await page.keyboard.press('KeyX');
  for (const at of [500, 1000, 1700, 2600, 4200, 6500]) {
    await cinematicBeat(page, at === 500 ? at : 400, 'the trade storyboard — one frame per beat of the resolution');
    await shoot(page, `02-trade-t${at}`);
  }
  await settle(page, {timeoutMs: 20_000}); // the trade resolution is over
  await shoot(page, '02-trade-end');
  const tradeRec = fromArm(await trade.stop());
  const timeline = tradeRec.filter((s, i) => i === 0 || s.v.on !== tradeRec[i - 1].v.on).map((s) => `${s.t}ms  ${s.v.on || '-'}`);
  const markerLog = tradeRec.flatMap(({t, v: {marker}}) => marker === null ? [] :
    [`${t}ms marker=${marker.w.toFixed(1)}px seat=${marker.seat === null ? 'n/a' : `${marker.seat.toFixed(1)}px`}`]);
  console.log('── trade timeline ──');
  timeline.forEach((l) => console.log('   ' + l));
  console.log('── marker size samples (first/last) ──');
  [markerLog[0], markerLog[Math.floor(markerLog.length / 2)], markerLog[markerLog.length - 1]]
    .filter((l) => l !== undefined).forEach((l) => console.log('   ' + l));
});

test('colony focus: inspect composition + build cube docking', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, request, await createGame(request));
  await openColonies(page);
  await focusTile(page, 'Luna');

  // ── THE STAGE in its inspect MODE — A on a colony the server does not
  //    offer a trade for descends into the action stage, which then carries
  //    the honest verdict. (X is a DIFFERENT door since 2026-09-27: the
  //    read-only DOSSIER — `console-colony-inspect-probe.spec.ts` drives it.)
  const inspectEntry = await armEntry(page);
  await page.keyboard.press('Enter');
  await settle(page); // the entry is over — the record holds every frame of it
  reportEntry('inspect', await collect(inspectEntry));
  await shoot(page, '03-inspect');
  const inspect = await readSettled(page, () => inspectComposition(page), {message: 'the inspect stage at rest'});
  console.log('── inspect ──', JSON.stringify(inspect));
  // B folds the stage, B again leaves the colonies section — each verified by the surface it closes.
  await pressUntilGone(page, 'Escape', '.con-colfocus', {settleMs: 1400});

  // ── BUILD: the Build Colony standard project → the colony pick → the
  //    focus stage's build brief → A confirms and the cube flies. ──────────
  await pressUntilGone(page, 'Escape', '.con-colonies', {settleMs: 900}); // leave the colonies section
  await pressUntilVisible(page, 'Comma', '.con-quick', {settleMs: 1200}); // LT — basic actions wheel
  await press(page, 'Enter', 1400); // centre slot = Standard Projects
  const sheet = page.locator('.con-stdp');
  await expect.poll(() => sheet.count(), {message: 'standard projects did not open'}).toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  // The sheet is a 2-COLUMN grid — walk both axes, never one.
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  console.log('── std project focused:', await focusedName());
  expect(/колони/i.test(await focusedName()), 'could not focus the colony standard project').toBeTruthy();
  await press(page, 'Enter', 1800);

  // The colony workspace opens in PICK mode ('Build'); descend and confirm.
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await shoot(page, '04-build-pick');
  await focusTile(page, 'Luna');
  const buildEntry = await armEntry(page);
  await page.keyboard.press('Enter'); // descend into the focus stage
  await settle(page); // the entry is over — the record holds every frame of it
  reportEntry('build', await collect(buildEntry));
  await shoot(page, '05-build-stage');
  const intent = await page.locator('.con-colfocus').getAttribute('data-colony-intent').catch(() => null);
  console.log('── build stage intent:', intent);

  // RECORD the flying cube against the seat it must land in — from before the confirm.
  const cube = await armWitness<CubeSeen>(page, 'colony-focus-cube', () => {
    const proxy = document.querySelector('.con-colonybuild__cube .player-cube') as HTMLElement | null;
    if (proxy === null) {
      return {proxy: null, seat: null, seated: null};
    }
    const seat = document.querySelector('.con-colfocus__berth--dest .con-colfocus__berth-seat') as HTMLElement | null;
    const seated = document.querySelector('.con-colfocus__berth-seat .player-cube') as HTMLElement | null;
    const p = proxy.getBoundingClientRect();
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return {
      proxy: {w: r1(p.width), h: r1(p.height)},
      seat: seat === null ? null : r1(seat.getBoundingClientRect().width),
      seated: seated === null ? null : r1(seated.getBoundingClientRect().width),
    };
  });
  await page.keyboard.press('Enter'); // A = build confirm
  for (const at of [400, 900, 1400, 2200]) {
    await cinematicBeat(page, at === 400 ? at : 500, 'the build storyboard — one frame per beat of the cube flight');
    await shoot(page, `06-build-t${at}`);
  }
  await settle(page, {timeoutMs: 20_000}); // the build is over
  await shoot(page, '06-build-end');
  const cubeLog = fromArm(await cube.stop()).flatMap((s) => s.v.proxy === null ? [] :
    [`${s.t}ms proxy=${s.v.proxy.w.toFixed(1)}×${s.v.proxy.h.toFixed(1)} ` +
      `seat=${s.v.seat === null ? 'n/a' : s.v.seat.toFixed(1)} seated=${s.v.seated === null ? 'n/a' : s.v.seated.toFixed(1)}`]);
  console.log('── build cube samples ──');
  if (cubeLog.length === 0) {
    console.log('   (no cube proxy ever mounted)');
  }
  [cubeLog[0], cubeLog[Math.floor(cubeLog.length / 3)], cubeLog[Math.floor(cubeLog.length * 2 / 3)], cubeLog[cubeLog.length - 1]]
    .filter((l) => l !== undefined).forEach((l) => console.log('   ' + l));
  // A FINISHED flow LEAVES (the North-Star conclusion): the std-projects
  // workspace — and the colonies step inside it — must be gone, the board
  // home live. The overview tile is therefore NOT on screen here; the seated
  // cube is read after the deliberate re-entry below.
  await expect.poll(() => page.locator('.con-stdp').count(), {message: 'the std-projects workspace concluded'}).toBe(0);
  await expect.poll(() => page.locator('.con-colonies').count(), {message: 'the colonies step left with its host'}).toBe(0);

  // ── THE PROTECTION, after the fact: re-enter the colony we just built on
  //    and read the guard rail. This is the physical statement the iteration
  //    is judged on — position 1 is HELD and the stop has moved to 2.
  //    A descends into the action stage (X would open the dossier). ──
  await openColonies(page);
  await focusTile(page, 'Luna');
  await press(page, 'Enter', 2400);
  await page.locator('.con-colfocus').waitFor({timeout: 15_000});
  // The guard rail is read AT REST — two of its boxes are compared below.
  const guard = await readSettled(page, () => guardRail(page), {message: 'the guard rail of the built colony'});
  await shoot(page, '09-protected');
  console.log('── the guard rail after one build ──', JSON.stringify(guard));
  expect(guard.takenBerths, 'the built berth is occupied').toBe(1);
  expect(guard.protectedCells, 'one colony holds exactly one position').toBe(1);
  expect(guard.aligned, 'every berth is column-aligned with its track cell').toBeTruthy();
  expect(Math.abs(guard.stopLeft - guard.cellLefts[1]), 'the stop stands on the first unprotected cell')
    .toBeLessThanOrEqual(2);
});

test('colony focus: the stage holds its composition on every display profile', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, request, await createGame(request));
  await openColonies(page);
  await focusTile(page, 'Luna');
  await press(page, 'Enter', 2200); // descend (trade intent)
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the focus stage did not open'}).toBeGreaterThan(0);

  // 4K TV → 1080 TV → Steam Deck. The layout is rem-authored, so what must
  // hold is the SHAPE: seven cells on one row, three berths on one row, no
  // zone head clipped and nothing painted past the surface.
  const profiles: Array<{name: string, w: number, h: number}> = [
    {name: 'tv-4k', w: 3840, h: 2160},
    {name: 'tv-1080', w: 1920, h: 1080},
    {name: 'deck', w: 1280, h: 800},
  ];
  for (const p of profiles) {
    await page.setViewportSize({width: p.w, height: p.h});
    // The shape is read AT REST once the stage has re-laid itself out for this profile.
    const shape = await readSettled(page, () => stageShape(page), {message: `the stage shape on ${p.name}`});
    await shoot(page, `07-profile-${p.name}`);
    console.log(`── profile ${p.name} (${p.w}×${p.h}) ──`, JSON.stringify(shape));
    expect(shape.trackRows, `${p.name}: the track must stay ONE row`).toBe(1);
    expect(shape.berthRows, `${p.name}: the berths must stay ONE row`).toBe(1);
    expect(shape.headClipped, `${p.name}: a zone head clipped its rule chips`).toBe(0);
    expect(shape.past, `${p.name}: content painted past the surface`).toBe(0);
    expect(shape.payScroll, `${p.name}: the payment list overflows its budget by ${shape.payScroll}px`)
      .toBeLessThanOrEqual(0);
  }

  // ── B folds back: the browse grid must return, nothing stranded. ────────
  await page.setViewportSize({width: 1280, height: 720});
  await settle(page);
  await press(page, 'Escape', 1600);
  await shoot(page, '08-folded-back');
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the stage did not fold back'}).toBe(0);
  // The browse layer's breathe-back is a transition: its state is read AT REST, never mid-way.
  const browse = await readSettled(page, () => browseStyle(page), {message: 'the browse layer after the fold'});
  console.log('── browse layer after the fold ──', JSON.stringify(browse));
  expect(browse?.opacity, 'the browse grid did not breathe back').toBe('1');
  expect(browse?.visibility).toBe('visible');
});
