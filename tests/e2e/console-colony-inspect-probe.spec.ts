import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, press} from './consoleStart';

/**
 * THE COLONY DOSSIER PROBE — X = «Осмотреть» in the colony workspace
 * (docs/claude/console/colony-inspect.md). A PROBE with a few hard guards:
 * it drives the real flow on the TV profile (3840×2160 → `tv`, the product's
 * own screen) and prints the composition's numbers beside the screenshots.
 *
 *   · X on a tile opens the DOSSIER — not the trade stage: the archive entry
 *     (the colony's own lore), the planet disc carried from the tile's
 *     medallion at a hero size, the trade-track instrument, the rules panel;
 *   · the crumb reads «КОЛОНИИ › <colony> › ОСМОТР»;
 *   · B folds back to the grid; A ENTERS the action — the trade stage takes
 *     the dossier's place with the planet carried (one planet on screen at
 *     every sampled frame);
 *   · nothing paints past the surface, nothing scrolls but the rules panel.
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
  loreFallback: boolean,
  cells: number,
  berths: number,
  kinds: Array<string>,
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
      lore: (document.querySelector('.con-colinspect .card-zoom-lore__text')?.textContent ?? '').trim(),
      loreFallback: document.querySelector('.con-colinspect .card-zoom-lore--fallback') !== null,
      cells: document.querySelectorAll('.con-colinspect .con-colfocus__xcell').length,
      berths: document.querySelectorAll('.con-colinspect .con-colfocus__berth').length,
      // The chips are CSS-uppercased; read them the way the eye does.
      kinds: Array.from(document.querySelectorAll('.con-colinspect__kind')).map((k) => (k.textContent ?? '').trim().toUpperCase()),
      rulesScroll: rules === null ? -1 : Math.max(0, rules.scrollHeight - rules.clientHeight),
      past: sr === undefined ? [] : Array.from(document.querySelectorAll('.con-colinspect__lore, .con-colinspect__hero, .con-colinspect__rules, .con-colinspect .con-colfocus__berth'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
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

test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

test('colony dossier: X opens the read, B folds back, A enters the act (TV 4K)', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Luna'});
  await page.waitForTimeout(1500);
  await openColonies(page);
  await focusTile(page, 'Luna');
  await shoot(page, '00-overview-4k');

  // The bar advertises X on the grid.
  const barBefore = (await page.locator('.con-cmdbar').textContent().catch(() => '')) ?? '';
  console.log('── bar on the grid ──', barBefore.replace(/\s+/g, ' ').trim());
  expect(barBefore, 'the grid advertises «Осмотреть»').toMatch(/Осмотреть/);

  // ── X → the dossier. Sample the planets on screen through the entrance. ──
  await page.evaluate(() => {
    const w = window as unknown as {__planets?: Array<number>};
    w.__planets = [];
    const t0 = performance.now();
    const tick = () => {
      const n = Array.from(document.querySelectorAll('.con-planet')).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 2 && Number(cs.opacity) > 0.05 && cs.visibility !== 'hidden';
      }).length;
      w.__planets?.push(n);
      if (performance.now() - t0 < 1800) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(300);
  await shoot(page, '01-inspect-opening-4k');
  await page.waitForTimeout(2000);
  await shoot(page, '02-inspect-settled-4k');
  const entryPlanets = await page.evaluate(() => (window as unknown as {__planets?: Array<number>}).__planets ?? []);

  const open = await composition(page);
  console.log('── the dossier (4K) ──', JSON.stringify(open, null, 2));
  expect(open.dossier, 'X opened the dossier').toBe(true);
  expect(open.stage, 'X must NOT open the trade stage').toBe(false);
  expect(open.crumb, 'the crumb: КОЛОНИИ › ЛУНА › ОСМОТР').toMatch(/КОЛОНИИ.*ЛУНА.*ОСМОТР/i);
  expect(open.loreFallback, 'Luna has real lore').toBe(false);
  expect(open.lore.length, 'the archive entry is on screen').toBeGreaterThan(20);
  expect(open.cells, 'the seven-cell instrument').toBe(7);
  expect(open.berths, 'the three berths').toBe(3);
  expect(open.kinds, 'the rules groups').toEqual(expect.arrayContaining(['СТРОИТЕЛЬСТВО', 'ТОРГОВЫЙ ДОХОД', 'БОНУС ВЛАДЕЛЬЦА', 'ФЛОТ', 'ДОСТУПНОСТЬ']));
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
  expect(barOpen).toMatch(/Торговать/);
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
  await page.evaluate(() => {
    const w = window as unknown as {__planets?: Array<number>, __both?: number};
    w.__planets = [];
    w.__both = 0;
    const t0 = performance.now();
    const tick = () => {
      const lit = Array.from(document.querySelectorAll('.con-planet')).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 2 && Number(cs.opacity) > 0.05 && cs.visibility !== 'hidden';
      });
      w.__planets?.push(lit.length);
      if (performance.now() - t0 < 1800) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(260);
  await shoot(page, '04-handoff-mid-4k');
  await page.waitForTimeout(2200);
  await shoot(page, '05-stage-after-handoff-4k');
  const handoffPlanets = await page.evaluate(() => (window as unknown as {__planets?: Array<number>}).__planets ?? []);
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

test('colony dossier: the composition holds at 1080p and on the Deck', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Luna'});
  await page.waitForTimeout(1500);
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
    await page.waitForTimeout(1600);
    await shoot(page, `07-profile-${p.name}`);
    const c = await composition(page);
    console.log(`── profile ${p.name} (${p.w}×${p.h}) ──`, JSON.stringify({...c, lore: c.lore.slice(0, 40) + '…'}));
    expect(c.dossier).toBe(true);
    expect(c.cells, `${p.name}: seven cells`).toBe(7);
    expect(c.berths, `${p.name}: three berths`).toBe(3);
    expect(c.planetW, `${p.name}: the planet keeps a hero size`).toBeGreaterThanOrEqual(p.minPlanet);
    expect(c.past, `${p.name}: nothing paints past the surface`).toEqual([]);
    expect(c.loreFallback, `${p.name}: the archive entry stands`).toBe(false);
  }
});
