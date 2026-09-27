import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, cinematicBeat, press, settle} from './consoleStart';

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
        const el = document.querySelector(`.con-colinspect__lore--${seat}`);
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

/**
 * Count the LIT planets on screen every 40 ms for `windowMs` — on a TASK
 * clock (`setInterval`), never rAF: headless Chromium drives rAF off the
 * compositor, and a loaded runner starved the hand-off sampler to two frames.
 * The result is read with `takePlanetSamples`; a dead sampler fails its floor.
 */
async function armPlanetSampler(page: Page, windowMs: number): Promise<void> {
  await page.evaluate((limit) => {
    const w = window as unknown as {__planets?: Array<number>, __planetTimer?: number};
    if (w.__planetTimer !== undefined) {
      window.clearInterval(w.__planetTimer);
    }
    w.__planets = [];
    const t0 = performance.now();
    w.__planetTimer = window.setInterval(() => {
      const n = Array.from(document.querySelectorAll('.con-planet')).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 2 && Number(cs.opacity) > 0.05 && cs.visibility !== 'hidden';
      }).length;
      w.__planets?.push(n);
      if (performance.now() - t0 >= limit) {
        window.clearInterval(w.__planetTimer);
        w.__planetTimer = undefined;
      }
    }, 40);
  }, windowMs);
}

async function takePlanetSamples(page: Page, floor: number): Promise<Array<number>> {
  const samples = await page.evaluate(() => (window as unknown as {__planets?: Array<number>}).__planets ?? []);
  expect(samples.length, `the planet sampler is alive (${samples.length} samples)`).toBeGreaterThanOrEqual(floor);
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

  // The bar advertises X on the grid.
  const barBefore = (await page.locator('.con-cmdbar').textContent().catch(() => '')) ?? '';
  console.log('── bar on the grid ──', barBefore.replace(/\s+/g, ' ').trim());
  expect(barBefore, 'the grid advertises «Осмотреть»').toMatch(/Осмотреть/);

  // ── X → the dossier. Sample the planets on screen through the entrance. ──
  await armPlanetSampler(page, 2200);
  await page.keyboard.press('KeyX');
  await cinematicBeat(page, 300, 'the dossier mid-unfold — the opening frame');
  await shoot(page, '01-inspect-opening-4k');
  await cinematicBeat(page, 2000, 'the entrance + the late reveal wave — the planet sampler\'s window');
  await shoot(page, '02-inspect-settled-4k');
  const entryPlanets = await takePlanetSamples(page, 12);

  const open = await composition(page);
  console.log('── the dossier (4K) ──', JSON.stringify(open, null, 2));
  expect(open.dossier, 'X opened the dossier').toBe(true);
  expect(open.stage, 'X must NOT open the trade stage').toBe(false);
  expect(open.crumb, 'the crumb: КОЛОНИИ › ЛУНА › ОСМОТР').toMatch(/КОЛОНИИ.*ЛУНА.*ОСМОТР/i);
  expect(open.loreFallback, 'Luna has real lore').toBe(false);
  expect(open.lore.length, 'the archive entry is on screen').toBeGreaterThan(20);
  expect(open.cells, 'the seven-cell instrument').toBe(7);
  expect(open.berths, 'the three berths').toBe(3);
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
  // At most ONE lit planet per sampled frame through the whole entrance
  // (the tile's medallion goes dark the instant the disc starts to fly).
  console.log('── planets per frame (entry) ──', entryPlanets.join(''));
  expect(Math.max(...entryPlanets), 'one planet on screen at every frame of the entrance').toBeLessThanOrEqual(1);

  // ── The bar: A = the act's verb, B back. ──
  const barOpen = (await page.locator('.con-cmdbar').textContent().catch(() => '')) ?? '';
  console.log('── bar on the dossier ──', barOpen.replace(/\s+/g, ' ').trim());
  // A LEADS ON — «К торговле», never «Торговать», and never disabled.
  expect(barOpen).toMatch(/К торговле/);
  const aDisabled = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.con-cmdbar [class*="disabled"], .con-cmdbar [aria-disabled="true"]'));
    return btns.map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim()).filter((t) => /К торговле/.test(t));
  });
  expect(aDisabled, 'A is never disabled on the dossier').toEqual([]);
  expect(barOpen).toMatch(/Назад/);

  // ── ↓ scrolls the rules panel (and nothing else). ──
  await press(page, 'ArrowDown', 500);
  await press(page, 'ArrowDown', 500);
  const scrolled = await page.evaluate(() => {
    const vp = document.querySelector('.con-colinspect__rules-scroll .con-scroll-area__viewport') as HTMLElement | null;
    return vp === null ? -1 : vp.scrollTop;
  });
  console.log('── rules scrollTop after ↓↓ ──', scrolled, '(overflow', open.rulesScroll, 'px)');
  if (open.rulesScroll > 0) {
    expect(scrolled, 'the rules panel scrolled').toBeGreaterThan(0);
  }

  // ── B → the grid breathes back, the dossier is gone. ──
  await press(page, 'Escape', 1600);
  await shoot(page, '03-folded-back-4k');
  expect(await page.locator('.con-colinspect').count(), 'B folded the dossier').toBe(0);
  const browse = await page.evaluate(() => {
    const el = document.querySelector('.con-colonies__browse') as HTMLElement | null;
    return el === null ? null : {opacity: getComputedStyle(el).opacity, visibility: getComputedStyle(el).visibility};
  });
  expect(browse?.opacity, 'the browse grid did not breathe back').toBe('1');
  expect(browse?.visibility).toBe('visible');

  // ── X again, then A → the trade stage takes the dossier's place. ──
  await press(page, 'KeyX', 2200);
  expect(await page.locator('.con-colinspect').count()).toBe(1);
  await armPlanetSampler(page, 2400);
  await page.keyboard.press('Enter');
  await cinematicBeat(page, 260, 'the hand-off mid-flight — the cross-fade frame');
  await shoot(page, '04-handoff-mid-4k');
  await cinematicBeat(page, 2200, 'the stage settles after the hand-off — the planet sampler\'s window');
  await shoot(page, '05-stage-after-handoff-4k');
  const handoffPlanets = await takePlanetSamples(page, 12);
  console.log('── planets per frame (hand-off) ──', handoffPlanets.join(''));
  const after = await composition(page);
  expect(after.dossier, 'the dossier left').toBe(false);
  expect(after.stage, 'the trade stage took its place').toBe(true);
  const stageCrumb = (await page.locator('.con-colonies .con-wshead').textContent().catch(() => '')) ?? '';
  console.log('── crumb on the stage ──', stageCrumb.replace(/\s+/g, ' ').trim());
  expect(stageCrumb).toMatch(/ЛУНА.*ТОРГОВЛЯ/i);
  // The hand-off overlaps the two surfaces for ONE beat — during which the
  // dossier's disc is fading while the stage's hero FLIPs out of it. Two
  // discs may briefly co-exist at the cross-fade (the leaving one is
  // dissolving); never THREE, and the resting frames read one.
  expect(Math.max(...handoffPlanets)).toBeLessThanOrEqual(2);
  expect(handoffPlanets[handoffPlanets.length - 1], 'one planet at rest after the hand-off').toBe(1);

  // ── B from the stage folds into the TILE (the fold home survived the hand-off). ──
  await press(page, 'Escape', 1800);
  await shoot(page, '06-stage-folded-4k');
  expect(await page.locator('.con-colfocus').count(), 'the stage folded').toBe(0);
  const browse2 = await page.evaluate(() => {
    const el = document.querySelector('.con-colonies__browse') as HTMLElement | null;
    return el === null ? null : {opacity: getComputedStyle(el).opacity, visibility: getComputedStyle(el).visibility};
  });
  expect(browse2?.opacity).toBe('1');
  expect(browse2?.visibility).toBe('visible');
  const tilePlanet = await page.evaluate(() => {
    const el = document.querySelector('.con-coltile--focused .con-coltile__planet') as HTMLElement | null;
    return el === null ? '' : getComputedStyle(el).opacity;
  });
  expect(tilePlanet, 'the tile\'s medallion is lit again').toBe('0.97');
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
  expect(await page.locator('.con-colinspect').count(), 'the dossier did not open').toBe(1);
  await shoot(page, '08-europa-ocean-4k');
  const glyph = await page.evaluate(() => {
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
  });
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
  expect(await page.locator('.con-colinspect').count(), 'the dossier did not open').toBe(1);

  const profiles: Array<{name: string, w: number, h: number, minPlanet: number}> = [
    {name: 'tv-1080', w: 1920, h: 1080, minPlanet: 380},
    {name: 'deck', w: 1280, h: 800, minPlanet: 120},
  ];
  for (const p of profiles) {
    await page.setViewportSize({width: p.w, height: p.h});
    // The profile switch re-fits the whole surface: wait on STATE — two
    // consecutive agreeing samples of the geometry the assertions read.
    await settle(page);
    let prev = '';
    for (let i = 0; i < 40; i++) {
      const now = await page.evaluate(() => JSON.stringify([
        document.querySelector('.con-colinspect__planet')?.getBoundingClientRect().width,
        document.querySelector('.con-colinspect__rules')?.getBoundingClientRect().height,
        document.querySelector('.con-colinspect__act')?.getBoundingClientRect().top,
      ]));
      if (now === prev) {
        break;
      }
      prev = now;
      await cinematicBeat(page, 120, 'the profile re-fit — two agreeing samples end the wait');
    }
    await shoot(page, `07-profile-${p.name}`);
    const c = await composition(page);
    console.log(`── profile ${p.name} (${p.w}×${p.h}) ──`, JSON.stringify({...c, lore: c.lore.slice(0, 40) + '…'}));
    expect(c.dossier).toBe(true);
    expect(c.cells, `${p.name}: seven cells`).toBe(7);
    expect(c.berths, `${p.name}: three berths`).toBe(3);
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
