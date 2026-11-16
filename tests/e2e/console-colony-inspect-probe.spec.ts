import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, cinematicBeat, press, settle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, Witness} from './witness';

/**
 * THE COLONY DOSSIER PROBE — X = «Осмотреть» in the colony workspace
 * (docs/claude/console/colony-inspect.md). A PROBE with a few hard guards:
 * it drives the real flow on the TV profile (3840×2160 → `tv`, the product's
 * own screen) and prints the composition's numbers beside the screenshots.
 *
 *   · X on a tile opens the DOSSIER — not the trade stage: the archive entry
 *     (the colony's own lore) with the ACT BLOCK right under it (the act's
 *     name, the verdict as information, the totals — never the payment
 *     paths), the planet disc carried from the tile's medallion at a hero
 *     size, the trade-track instrument, the rules panel with the three
 *     printed rules only;
 *   · the crumb reads «КОЛОНИИ › <colony> › ОСМОТР»;
 *   · B folds back to the grid; A («К торговле», never gated) goes ON — the
 *     trade stage takes the dossier's place with the planet carried (one
 *     planet on screen at every sampled frame);
 *   · nothing paints past the surface, and on the TV (4K and 1080) the rules
 *     panel does NOT scroll — the composition fits by design; the Deck may.
 *
 * Evidence lands in screenshots/colony-inspect/.
 */

const OUT = path.resolve('screenshots', 'colony-inspect');

function newGameConfig(seed = 0.42) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: true,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'InspectProbe', color: 'red', beginner: false, handicap: 0, first: true}],
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
    // Solo deals FOUR (players + 2, +1 for ≤2 players) — exactly this list, so
    // every name here is in the game before the setup's «remove a colony».
    customColoniesList: ['Pluto', 'Luna', 'Europa', 'Callisto'],
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

type Composition = {
  dossier: boolean,
  stage: boolean,
  crumb: string,
  planetW: number,
  lore: string,
  loreTop: number,
  loreSeat: 'side' | 'inline' | 'none',
  loreFallback: boolean,
  cells: number,
  berths: number,
  kinds: Array<string>,
  act: {kind: string, verdict: string, gains: Array<string>, top: number, bottom: number},
  rulesBox: {top: number, bottom: number},
  loreBottom: number,
  rulesScroll: number,
  past: Array<string>,
  planetsOnScreen: number,
  room: {surfaceH: number, heroH: number, rulesH: number},
};

async function composition(page: Page): Promise<Composition> {
  return page.evaluate(() => {
    const surface = document.querySelector('.con-colinspect__surface');
    const sr = surface?.getBoundingClientRect();
    const planet = document.querySelector('.con-colinspect__planet');
    const rules = document.querySelector('.con-colinspect__rules-scroll .con-scroll-area__viewport') as HTMLElement | null;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && Number(getComputedStyle(el).opacity) > 0.05 && getComputedStyle(el).visibility !== 'hidden';
    };
    return {
      dossier: document.querySelector('.con-colinspect') !== null,
      stage: document.querySelector('.con-colfocus') !== null,
      crumb: (document.querySelector('.con-colonies .con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      planetW: planet === null ? 0 : Math.round(planet.getBoundingClientRect().width),
      lore: (Array.from(document.querySelectorAll('.con-colinspect .card-zoom-lore__text')).find(visible)?.textContent ?? '').trim(),
      loreSeat: (['side', 'inline'] as const).find((seat) => {
        const el = document.querySelector(seat === 'side' ? '.con-colinspect__lore--side' : '.con-colinspect__lore--inline');
        return el !== null && visible(el);
      }) ?? 'none',
      loreFallback: document.querySelector('.con-colinspect .card-zoom-lore--fallback') !== null,
      cells: document.querySelectorAll('.con-colinspect .con-colfocus__xcell').length,
      berths: document.querySelectorAll('.con-colinspect .con-colfocus__berth').length,
      // The chips are CSS-uppercased; read them the way the eye does.
      kinds: Array.from(document.querySelectorAll('.con-colinspect__rules .con-colinspect__kind')).map((k) => (k.textContent ?? '').trim().toUpperCase()),
      // THE ACT BLOCK — the lower-left corner is no longer empty: its name,
      // the verdict, what the player receives and how many payment paths.
      act: {
        kind: (document.querySelector('.con-colinspect__act-kind')?.textContent ?? '').trim().toUpperCase(),
        verdict: (document.querySelector('.con-colinspect__act .con-colinspect__verdict')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        gains: Array.from(document.querySelectorAll('.con-colinspect__gain')).map((g) => (g.textContent ?? '').replace(/\s+/g, ' ').trim()),
        top: Math.round(document.querySelector('.con-colinspect__act')?.getBoundingClientRect().top ?? 0),
        bottom: Math.round(document.querySelector('.con-colinspect__act')?.getBoundingClientRect().bottom ?? 0),
      },
      rulesBox: {
        top: Math.round(document.querySelector('.con-colinspect__rules')?.getBoundingClientRect().top ?? 0),
        bottom: Math.round(document.querySelector('.con-colinspect__rules')?.getBoundingClientRect().bottom ?? 0),
      },
      loreTop: Math.round(Array.from(document.querySelectorAll('.con-colinspect__lore .card-zoom-lore')).find(visible)?.getBoundingClientRect().top ?? 0),
      loreBottom: Math.round(Array.from(document.querySelectorAll('.con-colinspect__lore .card-zoom-lore')).find(visible)?.getBoundingClientRect().bottom ?? 0),
      rulesScroll: rules === null ? -1 : Math.max(0, rules.scrollHeight - rules.clientHeight),
      past: sr === undefined ? [] : Array.from(document.querySelectorAll('.con-colinspect__lore--side, .con-colinspect__act, .con-colinspect__gain, .con-colinspect__hero, .con-colinspect__rules, .con-colinspect .con-colfocus__berth'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) {
            return false; // a closed seat (display: none) is nowhere, not past
          }
          return r.bottom > sr.bottom + 1 || r.right > sr.right + 1 || r.left < sr.left - 1 || r.top < sr.top - 1;
        })
        .map((el) => el.className),
      // ONE planet at a time: the tile's medallion (parked/dark), the dossier's
      // disc and the stage's hero must never be visible together.
      planetsOnScreen: Array.from(document.querySelectorAll('.con-planet')).filter(visible).length,
      room: {
        surfaceH: sr === undefined ? 0 : Math.round(sr.height),
        heroH: Math.round(document.querySelector('.con-colinspect__hero')?.getBoundingClientRect().height ?? 0),
        rulesH: Math.round(document.querySelector('.con-colinspect__rules')?.getBoundingClientRect().height ?? 0),
      },
    };
  });
}

/** The composition AT REST — two equal reads a frame apart, after `settle` (a hero disc mid-flight is not a size). */
async function settledComposition(page: Page, what: string): Promise<Composition> {
  return readSettled(page, () => composition(page), {message: `the dossier's composition — ${what}`});
}

/** The command bar's text as the eye reads it ('' while none). */
async function barText(page: Page): Promise<string> {
  return ((await page.locator('.con-cmdbar').textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

type PlanetState = {n: number, dossier: boolean};

/** The LIT planets on screen, and whether the dossier stands — the page half of the planet witness (self-contained:
 *  it is serialized). */
function planetState(): PlanetState {
  const n = Array.from(document.querySelectorAll('.con-planet')).filter((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 2 && Number(cs.opacity) > 0.05 && cs.visibility !== 'hidden';
  }).length;
  return {n, dossier: document.querySelector('.con-colinspect') !== null};
}

/**
 * Record the LIT planets on screen from before the press (`armWitness` — off the product's own writes and every
 * frame, never a timer that a loaded runner starves). «One planet at a time» is a COEXISTENCE claim, so the record
 * is `settled`: what a task LEAVES, never the instant between two writes of one task that no frame paints.
 */
async function armPlanetWitness(page: Page, key: string): Promise<Witness<PlanetState>> {
  return armWitness(page, key, planetState, {settled: true});
}

/**
 * The recorded planet counts (every distinct state, in order); a DEAD recorder fails the floor. A record keeps the
 * state it was ARMED in — the screen BEFORE the press (the grid, every tile's medallion lit) — so a window that is
 * «the dossier's entrance» starts at the first state in which the dossier stands (`fromDossier`), never at the arm.
 */
async function takePlanetRecord(w: Witness<PlanetState>, fromDossier = false): Promise<Array<number>> {
  const all = (await w.stop()).map((s) => s.v);
  const start = fromDossier ? all.findIndex((v) => v.dossier) : 0;
  const samples = start < 0 ? [] : all.slice(start).map((v) => v.n);
  expect(samples.length, `the planet recorder is alive (${samples.length} recorded states${fromDossier ? ' with the dossier' : ''})`)
    .toBeGreaterThan(0);
  return samples;
}

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

test('colony dossier: X opens the read, B folds back, A enters the act (TV 4K)', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Luna'});
  await settle(page);
  await openColonies(page);
  await focusTile(page, 'Luna');
  await shoot(page, '00-overview-4k');

  // The bar advertises X on the grid (a live string — polled: the bar republishes a frame after the focus lands).
  await expect.poll(() => barText(page), {message: 'the grid advertises «Осмотреть»'}).toMatch(/Осмотреть/);
  console.log('── bar on the grid ──', await barText(page));

  // ── X → the dossier. Record the planets on screen through the entrance. ──
  const entryWitness = await armPlanetWitness(page, 'inspect-planets-entry');
  await page.keyboard.press('KeyX');
  await cinematicBeat(page, 300, 'the dossier mid-unfold — the opening frame');
  await shoot(page, '01-inspect-opening-4k');
  // The entrance's window ends on its END STATE — the composition at rest (the late reveal wave included).
  const open = await settledComposition(page, 'the dossier (4K)');
  await shoot(page, '02-inspect-settled-4k');
  const entryPlanets = await takePlanetRecord(entryWitness, true);

  console.log('── the dossier (4K) ──', JSON.stringify(open, null, 2));
  expect(open.dossier, 'X opened the dossier').toBe(true);
  expect(open.stage, 'X must NOT open the trade stage').toBe(false);
  expect(open.crumb, 'the crumb: КОЛОНИИ › ЛУНА › ОСМОТР').toMatch(/КОЛОНИИ.*ЛУНА.*ОСМОТР/i);
  expect(open.loreFallback, 'Luna has real lore').toBe(false);
  expect(open.lore.length, 'the archive entry is on screen').toBeGreaterThan(20);
  expect(open.cells, 'the seven-cell instrument').toBe(7);
  // An ORDINARY tile prints three berths; a fourth exists only for a cube standing (or projected) beyond the
  // limit — TR25, `console-exclusive-colony.spec.ts`.
  expect(open.berths, 'an ordinary tile: its three printed berths').toBe(3);
  // The rules panel: the THREE printed rules and nothing else — the fleet is
  // on the status line, the availability is in the act block.
  expect(open.kinds, 'the rules groups').toEqual(['СТРОИТЕЛЬСТВО', 'ТОРГОВЫЙ ДОХОД', 'БОНУС ВЛАДЕЛЬЦА']);
  // The act block stands in the lower-left: its name, a verdict, the totals,
  // every payment path (the seeded solo game has one affordable M€ path and
  // the energy / titanium paths refused with a reason).
  expect(open.act.kind, 'the act block names the act').toBe('ТОРГОВЛЯ');
  expect(open.act.verdict.length, 'the verdict is stated').toBeGreaterThan(3);
  expect(open.act.gains.length, 'what the player receives').toBeGreaterThanOrEqual(1);
  expect(open.loreSeat, 'the archive entry stands in the side column on the TV').toBe('side');
  expect(open.act.top, 'the act block sits BELOW the archive entry').toBeGreaterThan(open.loreBottom);
  // THE TWO WINGS HANG LEVEL: the lore + act group and the rules panel are
  // both centred on the column, so their vertical centres agree within a
  // few percent of the surface (a top-pinned panel + a foot-pinned block
  // left the middle-left and the lower-right empty).
  const leftMid = (open.loreTop + open.act.bottom) / 2;
  const rightMid = (open.rulesBox.top + open.rulesBox.bottom) / 2;
  console.log('── wings ──', JSON.stringify({leftMid: Math.round(leftMid), rightMid: Math.round(rightMid), surfaceH: open.room.surfaceH}));
  expect(Math.abs(leftMid - rightMid), 'the wings are centred on the same axis').toBeLessThan(open.room.surfaceH * 0.12);
  // NO SCROLL ON THE TV: the rules panel fits the room by design.
  expect(open.rulesScroll, 'the rules panel must not scroll at 4K').toBe(0);
  // The planet at a hero size: at least 600 device px on the 4K panel (the
  // art's ceiling is ~1100; the composition targets ~800).
  expect(open.planetW, 'the planet disc at hero size').toBeGreaterThanOrEqual(760);
  expect(open.past, 'nothing paints past the surface').toEqual([]);
  // At most ONE lit planet in any recorded state of the whole entrance
  // (the tile's medallion goes dark the instant the disc starts to fly).
  console.log('── planets per recorded state (entry) ──', entryPlanets.join(''));
  expect(Math.max(...entryPlanets), 'one planet on screen at every frame of the entrance').toBeLessThanOrEqual(1);

  // ── The bar: A = the act's verb, B back. ──
  console.log('── bar on the dossier ──', await barText(page));
  // A LEADS ON — «К торговле», never «Торговать», and never disabled.
  await expect.poll(() => barText(page)).toMatch(/К торговле/);
  const aDisabled = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.con-cmdbar [class*="disabled"], .con-cmdbar [aria-disabled="true"]'));
    return btns.map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim()).filter((t) => /К торговле/.test(t));
  });
  expect(aDisabled, 'A is never disabled on the dossier').toEqual([]);
  await expect.poll(() => barText(page)).toMatch(/Назад/);

  // ── ↓ scrolls the rules panel (and nothing else). ──
  const rulesScrollTop = () => page.evaluate(() => {
    const vp = document.querySelector('.con-colinspect__rules-scroll .con-scroll-area__viewport') as HTMLElement | null;
    return vp === null ? -1 : vp.scrollTop;
  });
  await press(page, 'ArrowDown', 500);
  await press(page, 'ArrowDown', 500);
  if (open.rulesScroll > 0) {
    // A smooth scroll is a state that arrives — polled, never read where the machine had got to.
    await expect.poll(rulesScrollTop, {message: 'the rules panel scrolled'}).toBeGreaterThan(0);
  }
  console.log('── rules scrollTop after ↓↓ ──', await rulesScrollTop(), '(overflow', open.rulesScroll, 'px)');

  // ── B → the grid breathes back, the dossier is gone. ──
  const browseState = () => page.evaluate(() => {
    const el = document.querySelector('.con-colonies__browse') as HTMLElement | null;
    return el === null ? null : {opacity: getComputedStyle(el).opacity, visibility: getComputedStyle(el).visibility};
  });
  await press(page, 'Escape', 1600);
  await shoot(page, '03-folded-back-4k');
  await expect.poll(() => page.locator('.con-colinspect').count(), {message: 'B folded the dossier'}).toBe(0);
  await expect.poll(async () => (await browseState())?.opacity, {message: 'the browse grid did not breathe back'}).toBe('1');
  await expect.poll(async () => (await browseState())?.visibility).toBe('visible');

  // ── X again, then A → the trade stage takes the dossier's place. ──
  await press(page, 'KeyX', 2200);
  await expect.poll(() => page.locator('.con-colinspect').count()).toBe(1);
  const handoffWitness = await armPlanetWitness(page, 'inspect-planets-handoff');
  await page.keyboard.press('Enter');
  await cinematicBeat(page, 260, 'the hand-off mid-flight — the cross-fade frame');
  await shoot(page, '04-handoff-mid-4k');
  // The hand-off's window ends on its END STATE — the trade stage at rest.
  const after = await settledComposition(page, 'the trade stage after the hand-off');
  await shoot(page, '05-stage-after-handoff-4k');
  const handoffPlanets = await takePlanetRecord(handoffWitness);
  console.log('── planets per recorded state (hand-off) ──', handoffPlanets.join(''));
  expect(after.dossier, 'the dossier left').toBe(false);
  expect(after.stage, 'the trade stage took its place').toBe(true);
  const stageCrumb = () => page.locator('.con-colonies .con-wshead').textContent().then((t) => (t ?? '').replace(/\s+/g, ' ').trim()).catch(() => '');
  await expect.poll(stageCrumb).toMatch(/ЛУНА.*ТОРГОВЛЯ/i);
  console.log('── crumb on the stage ──', await stageCrumb());
  // The hand-off overlaps the two surfaces for ONE beat — during which the
  // dossier's disc is fading while the stage's hero FLIPs out of it. Two
  // discs may briefly co-exist at the cross-fade (the leaving one is
  // dissolving); never THREE, and the resting frames read one.
  expect(Math.max(...handoffPlanets)).toBeLessThanOrEqual(2);
  expect(handoffPlanets[handoffPlanets.length - 1], 'one planet at rest after the hand-off').toBe(1);

  // ── B from the stage folds into the TILE (the fold home survived the hand-off). ──
  await press(page, 'Escape', 1800);
  await shoot(page, '06-stage-folded-4k');
  await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the stage folded'}).toBe(0);
  await expect.poll(async () => (await browseState())?.opacity).toBe('1');
  await expect.poll(async () => (await browseState())?.visibility).toBe('visible');
  const tilePlanet = () => page.evaluate(() => {
    const el = document.querySelector('.con-coltile--focused .con-coltile__planet') as HTMLElement | null;
    return el === null ? '' : getComputedStyle(el).opacity;
  });
  await expect.poll(tilePlanet, {message: 'the tile\'s medallion is lit again'}).toBe('0.97');
});

test('colony dossier: a TILE glyph in a rule renders whole (Europa\'s ocean, TV 4K)', async ({page, request}) => {
  test.setTimeout(420_000);
  // Europa's construction grant is «place an ocean» — a `.tile` glyph, whose
  // base rule (40×46, a fixed background-size, margins) lost its left half
  // inside the 32 px glyph box on the owner's 4K screen.
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Europa'});
  await settle(page);
  await openColonies(page);
  await focusTile(page, 'Europa');
  await press(page, 'KeyX', 2400);
  await expect.poll(() => page.locator('.con-colinspect').count(), {message: 'the dossier did not open'}).toBe(1);
  // The glyph's box and the tile's, AT REST (two equal reads a frame apart) — the dossier's entrance re-fits them.
  const glyph = await readSettled(page, () => page.evaluate(() => {
    const box = document.querySelector('.con-colinspect__group--build .con-colinspect__glyph');
    const tile = box?.querySelector('.benefit-glyph__tile');
    if (box === null || box === undefined || tile === null || tile === undefined) {
      return null;
    }
    const b = box.getBoundingClientRect();
    const t = tile.getBoundingClientRect();
    return {
      box: {l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom)},
      tile: {l: Math.round(t.left), t: Math.round(t.top), r: Math.round(t.right), b: Math.round(t.bottom), w: Math.round(t.width), h: Math.round(t.height)},
      art: getComputedStyle(tile).backgroundImage.includes('ocean'),
    };
  }), {message: 'Europa\'s ocean glyph'});
  await shoot(page, '08-europa-ocean-4k');
  console.log('── the ocean glyph ──', JSON.stringify(glyph));
  expect(glyph, 'Europa\'s build rule carries the ocean tile glyph').not.toBeNull();
  if (glyph !== null) {
    expect(glyph.art, 'the ocean art is painted').toBe(true);
    expect(glyph.tile.w, 'the tile has a real width').toBeGreaterThanOrEqual(20);
    // WHOLE: the tile's box lies inside the glyph's clip box on every side.
    expect(glyph.tile.l, 'not clipped on the left').toBeGreaterThanOrEqual(glyph.box.l - 1);
    expect(glyph.tile.r, 'not clipped on the right').toBeLessThanOrEqual(glyph.box.r + 1);
    expect(glyph.tile.t, 'not clipped at the top').toBeGreaterThanOrEqual(glyph.box.t - 1);
    expect(glyph.tile.b, 'not clipped at the bottom').toBeLessThanOrEqual(glyph.box.b + 1);
  }
});

test('colony dossier: the composition holds at 1080p and on the Deck', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Luna'});
  await settle(page);
  await openColonies(page);
  await focusTile(page, 'Luna');
  await press(page, 'KeyX', 2400);
  await expect.poll(() => page.locator('.con-colinspect').count(), {message: 'the dossier did not open'}).toBe(1);

  const profiles: Array<{name: string, w: number, h: number, minPlanet: number}> = [
    {name: 'tv-1080', w: 1920, h: 1080, minPlanet: 380},
    {name: 'deck', w: 1280, h: 800, minPlanet: 120},
  ];
  for (const p of profiles) {
    await page.setViewportSize({width: p.w, height: p.h});
    // The profile switch re-fits the whole surface: wait on STATE — the
    // composition the assertions read, two agreeing reads a frame apart.
    const c = await settledComposition(page, `profile ${p.name}`);
    await shoot(page, `07-profile-${p.name}`);
    console.log(`── profile ${p.name} (${p.w}×${p.h}) ──`, JSON.stringify({...c, lore: c.lore.slice(0, 40) + '…'}));
    expect(c.dossier).toBe(true);
    expect(c.cells, `${p.name}: seven cells`).toBe(7);
    expect(c.berths, `${p.name}: an ordinary tile — three printed berths`).toBe(3);
    expect(c.planetW, `${p.name}: the planet keeps a hero size`).toBeGreaterThanOrEqual(p.minPlanet);
    expect(c.past, `${p.name}: nothing paints past the surface`).toEqual([]);
    expect(c.loreFallback, `${p.name}: the archive entry stands`).toBe(false);
    expect(c.act.kind, `${p.name}: the act block stands`).toBe('ТОРГОВЛЯ');
    expect(c.act.gains.length, `${p.name}: what the player receives`).toBeGreaterThanOrEqual(1);
    if (p.name === 'tv-1080') {
      // The TV's second profile fits too; the Deck's rules may scroll (it
      // has the scroll area for exactly that).
      expect(c.rulesScroll, 'the rules panel must not scroll at 1080p').toBe(0);
      expect(c.loreSeat, '1080p: the archive entry in the side column').toBe('side');
    } else {
      // The narrow host: the archive entry moves INTO the rules scroll — the
      // side column is the act block alone, never a one-line clip of lore.
      expect(c.loreSeat, 'Deck: the archive entry inside the rules scroll').toBe('inline');
      expect(c.lore.length, 'Deck: the whole entry is in the DOM').toBeGreaterThan(20);
    }
  }
});
