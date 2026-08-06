import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, fillPicks, press} from './consoleStart';

/**
 * COLONY FOCUS STAGE PROBE — the visual + motion evidence for the detail
 * stage. It is a PROBE, not a guard: it drives the real flows and prints
 * hard numbers a human then looks at beside the screenshots.
 *
 *   · the ENTRY animation, sampled per frame — does the geometry settle
 *     BEFORE any text is legible (the "текст появляется слишком рано" bug)?
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

async function boot(page: Page, playerId: string, keep = 'Luna'): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500);
  await bootToBoard(page, {
    keepColony: keep,
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'project') {
        await fillPicks(p, 2);
      }
    },
  });
  await page.waitForTimeout(1500);
}

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
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
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

/** Arm an in-page rAF sampler; `collect` drains it. */
async function armSampler(page: Page, ms: number): Promise<void> {
  await page.evaluate((budget) => {
    const w = window as unknown as {__s?: Array<Record<string, unknown>>};
    w.__s = [];
    const t0 = performance.now();
    const op = (el: Element | null) => el === null ? -1 : Number(getComputedStyle(el).opacity);
    const tick = () => {
      const stage = document.querySelector('.con-colfocus');
      const surface = document.querySelector('.con-colfocus__surface');
      const late = Array.from(document.querySelectorAll('.con-colfocus [data-unfold-late]'));
      const items = Array.from(document.querySelectorAll('.con-colfocus [data-unfold-item]'));
      const clip = surface === null ? '' : getComputedStyle(surface).clipPath;
      const planet = document.querySelector('.con-colfocus__planet');
      w.__s?.push({
        t: Math.round(performance.now() - t0),
        stage: stage !== null,
        // A clip that is not `none` means the surface is still OPENING.
        opening: clip !== '' && clip !== 'none',
        planetW: planet === null ? 0 : Math.round(planet.getBoundingClientRect().width),
        late: late.length === 0 ? -1 : Math.max(...late.map(op)),
        items: items.length === 0 ? -1 : Math.max(...items.map(op)),
      });
      if (performance.now() - t0 < budget) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, ms);
}

type Sample = {t: number, stage: boolean, opening: boolean, planetW: number, late: number, items: number};

async function collect(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => ((window as unknown as {__s?: Array<Sample>}).__s ?? []) as Array<Sample>);
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

test.describe.configure({mode: 'serial'});

test('colony focus: entry choreography + trade resolution', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, await createGame(request));
  await openColonies(page);
  await focusTile(page, 'Luna');
  await shoot(page, '00-overview');

  // ── ENTRY (trade intent), sampled per frame ─────────────────────────────
  await armSampler(page, 2200);
  await page.keyboard.press('Enter');
  // A FRAME STRIP of the opening, for eyes: a screenshot costs ~200 ms, so
  // these three land roughly on the unfold, the structure reveal and the
  // fine-print beat.
  await shoot(page, '01a-enter-f0');
  await shoot(page, '01b-enter-f1');
  await shoot(page, '01c-enter-f2');
  await page.waitForTimeout(2000);
  reportEntry('trade', await collect(page));
  await shoot(page, '01-trade-settled');

  const stage = page.locator('.con-colfocus');
  expect(await stage.count(), 'the focus stage did not open').toBeGreaterThan(0);

  const geom = await page.evaluate(() => {
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
      resetRail: box('.con-colfocus__resetrail'),
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
  console.log('── focus stage geometry ──');
  console.log(JSON.stringify(geom, null, 2));

  // ── TRADE resolution: a surface timeline + the marker size ──────────
  await page.evaluate(() => {
    const w = window as unknown as {__probe?: Array<string>, __marker?: Array<string>};
    w.__probe = [];
    w.__marker = [];
    const t0 = performance.now();
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
    let prev = '';
    const tick = () => {
      const on = Object.entries(WATCH)
        .filter(([, sel]) => document.querySelector(sel) !== null)
        .map(([k]) => k).join(',');
      if (on !== prev) {
        w.__probe?.push(`${Math.round(performance.now() - t0)}ms  ${on || '-'}`);
        prev = on;
      }
      const m = document.querySelector('.con-coltrade-marker') as HTMLElement | null;
      if (m !== null && getComputedStyle(m).visibility !== 'hidden') {
        const r = m.getBoundingClientRect();
        const seat = document.querySelector('.con-colfocus__xcell-seat');
        const sr = seat?.getBoundingClientRect();
        w.__marker?.push(`${Math.round(performance.now() - t0)}ms marker=${r.width.toFixed(1)}px seat=${sr === undefined ? 'n/a' : sr.width.toFixed(1) + 'px'}`);
      }
      if (performance.now() - t0 < 14_000) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('KeyX');
  for (const at of [500, 1000, 1700, 2600, 4200, 6500]) {
    await page.waitForTimeout(at === 500 ? at : 400);
    await shoot(page, `02-trade-t${at}`);
  }
  await page.waitForTimeout(5000);
  await shoot(page, '02-trade-end');
  const timeline = await page.evaluate(() => (window as unknown as {__probe?: Array<string>}).__probe ?? []);
  const markerLog = await page.evaluate(() => (window as unknown as {__marker?: Array<string>}).__marker ?? []);
  console.log('── trade timeline ──');
  timeline.forEach((l) => console.log('   ' + l));
  console.log('── marker size samples (first/last) ──');
  [markerLog[0], markerLog[Math.floor(markerLog.length / 2)], markerLog[markerLog.length - 1]]
    .filter((l) => l !== undefined).forEach((l) => console.log('   ' + l));
});

test('colony focus: inspect composition + build cube docking', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, await createGame(request));
  await openColonies(page);
  await focusTile(page, 'Luna');

  // ── INSPECT (X) — the dossier must not read as a stripped trade screen ──
  await armSampler(page, 2200);
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(2400);
  reportEntry('inspect', await collect(page));
  await shoot(page, '03-inspect');
  const inspect = await page.evaluate(() => ({
    mode: document.querySelector('.con-colfocus')?.className ?? '',
    rules: document.querySelectorAll('.con-colfocus__rule').length,
    emptyBottom: (() => {
      const s = document.querySelector('.con-colfocus__surface')?.getBoundingClientRect();
      const last = Array.from(document.querySelectorAll('.con-colfocus__main > section'))
        .map((el) => el.getBoundingClientRect().bottom).sort((a, b) => b - a)[0];
      return s === undefined || last === undefined ? -1 : Math.round(s.bottom - last);
    })(),
  }));
  console.log('── inspect ──', JSON.stringify(inspect));
  await press(page, 'Escape', 1400);

  // ── BUILD: the Build Colony standard project → the colony pick → the
  //    focus stage's build brief → A confirms and the cube flies. ──────────
  await press(page, 'Escape', 900); // leave the colonies section
  await press(page, 'Comma', 1200); // LT — basic actions wheel
  await press(page, 'Enter', 1400); // centre slot = Standard Projects
  const sheet = page.locator('.con-stdp');
  expect(await sheet.count(), 'standard projects did not open').toBeGreaterThan(0);
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
  await armSampler(page, 2200);
  await page.keyboard.press('Enter'); // descend into the focus stage
  await page.waitForTimeout(2400);
  reportEntry('build', await collect(page));
  await shoot(page, '05-build-stage');
  const intent = await page.locator('.con-colfocus').getAttribute('data-colony-intent').catch(() => null);
  console.log('── build stage intent:', intent);

  // Sample the flying cube against the seat it must land in.
  await page.evaluate(() => {
    const w = window as unknown as {__cube?: Array<string>};
    w.__cube = [];
    const t0 = performance.now();
    const tick = () => {
      const proxy = document.querySelector('.con-colonybuild__cube .player-cube') as HTMLElement | null;
      const seat = document.querySelector('.con-colfocus__berth--dest .con-colfocus__berth-seat') as HTMLElement | null;
      const seated = document.querySelector('.con-colfocus__berth-seat .player-cube') as HTMLElement | null;
      if (proxy !== null) {
        const p = proxy.getBoundingClientRect();
        const s = seat?.getBoundingClientRect();
        const r = seated?.getBoundingClientRect();
        w.__cube?.push(`${Math.round(performance.now() - t0)}ms proxy=${p.width.toFixed(1)}×${p.height.toFixed(1)} ` +
          `seat=${s === undefined ? 'n/a' : s.width.toFixed(1)} seated=${r === undefined ? 'n/a' : r.width.toFixed(1)}`);
      }
      if (performance.now() - t0 < 9000) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('Enter'); // A = build confirm
  for (const at of [400, 900, 1400, 2200]) {
    await page.waitForTimeout(at === 400 ? at : 500);
    await shoot(page, `06-build-t${at}`);
  }
  await page.waitForTimeout(4500);
  await shoot(page, '06-build-end');
  const cubeLog = await page.evaluate(() => (window as unknown as {__cube?: Array<string>}).__cube ?? []);
  console.log('── build cube samples ──');
  if (cubeLog.length === 0) {
    console.log('   (no cube proxy ever mounted)');
  }
  [cubeLog[0], cubeLog[Math.floor(cubeLog.length / 3)], cubeLog[Math.floor(cubeLog.length * 2 / 3)], cubeLog[cubeLog.length - 1]]
    .filter((l) => l !== undefined).forEach((l) => console.log('   ' + l));
  const seatedAfter = await page.evaluate(() => {
    const el = document.querySelector('.con-coltile__build-seat .player-cube') as HTMLElement | null;
    return el === null ? null : Math.round(el.getBoundingClientRect().width);
  });
  console.log('── seated cube on the overview tile after the build:', seatedAfter);
});

test('colony focus: the stage holds its composition on every display profile', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, await createGame(request));
  await openColonies(page);
  await focusTile(page, 'Luna');
  await press(page, 'Enter', 2200); // descend (trade intent)
  expect(await page.locator('.con-colfocus').count(), 'the focus stage did not open').toBeGreaterThan(0);

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
    await page.waitForTimeout(1400);
    await shoot(page, `07-profile-${p.name}`);
    const shape = await page.evaluate(() => {
      const surface = document.querySelector('.con-colfocus__surface');
      const sr = surface?.getBoundingClientRect();
      const rowsOf = (sel: string) => new Set(Array.from(document.querySelectorAll(sel))
        .map((el) => Math.round(el.getBoundingClientRect().top))).size;
      const box = (sel: string) => {
        const el = document.querySelector(sel);
        return el === null ? 0 : Math.round(el.getBoundingClientRect().width);
      };
      return {
        profile: document.documentElement.getAttribute('data-con-profile') ??
          document.querySelector('.con-root')?.className ?? '',
        trackRows: rowsOf('.con-colfocus__xcell'),
        berthRows: rowsOf('.con-colfocus__berth'),
        cellW: box('.con-colfocus__xcell'),
        glyphW: box('.con-colfocus__xcell-glyph'),
        seatW: box('.con-colfocus__berth-seat'),
        markerSeatW: box('.con-colfocus__xcell-seat'),
        headClipped: Array.from(document.querySelectorAll('.con-colfocus__zonehead'))
          .filter((el) => el.scrollWidth > el.clientWidth + 1).length,
        past: sr === undefined ? -1 : Array.from(document.querySelectorAll('.con-colfocus__payrow, .con-colfocus__berth, .con-colfocus__rsec'))
          .filter((el) => el.getBoundingClientRect().bottom > sr.bottom + 1).length,
      };
    });
    console.log(`── profile ${p.name} (${p.w}×${p.h}) ──`, JSON.stringify(shape));
    expect(shape.trackRows, `${p.name}: the track must stay ONE row`).toBe(1);
    expect(shape.berthRows, `${p.name}: the berths must stay ONE row`).toBe(1);
    expect(shape.headClipped, `${p.name}: a zone head clipped its rule chips`).toBe(0);
    expect(shape.past, `${p.name}: content painted past the surface`).toBe(0);
  }

  // ── B folds back: the browse grid must return, nothing stranded. ────────
  await page.setViewportSize({width: 1280, height: 720});
  await page.waitForTimeout(900);
  await press(page, 'Escape', 1600);
  await shoot(page, '08-folded-back');
  expect(await page.locator('.con-colfocus').count(), 'the stage did not fold back').toBe(0);
  const browse = await page.evaluate(() => {
    const el = document.querySelector('.con-colonies__browse') as HTMLElement | null;
    if (el === null) {
      return null;
    }
    const cs = getComputedStyle(el);
    return {opacity: cs.opacity, visibility: cs.visibility, transform: cs.transform};
  });
  console.log('── browse layer after the fold ──', JSON.stringify(browse));
  expect(browse?.opacity, 'the browse grid did not breathe back').toBe('1');
  expect(browse?.visibility).toBe('visible');
});
