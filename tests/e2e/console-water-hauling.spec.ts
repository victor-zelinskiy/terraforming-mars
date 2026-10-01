import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, placeTile, press, reloadConsole, sendPlayerInput, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * TR06 «ПЕРЕВОЗКА ВОДЫ» — A TRADE WHOSE DESTINATION IS A CARD
 * (docs/TURMOIL_REDUX_WATER_HAULING.md). The first fleet dock: one flow from
 * the colonies overview to the ocean, on two profiles (a geometry claim made
 * at one resolution is a claim about one resolution).
 *
 *   1. The overview: the «ПРИЧАЛЫ» column stands beside an INTACT planet grid
 *      (the tiles do not move when the cursor walks into the column); ▶ enters
 *      the dock, A opens ITS stage — one `.con-ws`, the crumb names the card,
 *      the hero is the card's own face.
 *   2. The stage: the payment paths, the server's result chips (the oceans'
 *      `current → resulting`, the fleets `2 → 1`), the reward's note — and no
 *      request reaches the server before A.
 *   3. A → EXACTLY ONE POST; its destination answers `{fleetDock}`, never a
 *      colony.
 *   4. The flight: the ship leaves the fleet dock's pad and lands on the card's
 *      ▲; the fleet mark on the card and the energy tick on the rail only AFTER
 *      the touchdown; the crumb keeps its root and the card's name on every
 *      sample.
 *   5. The workspace is GONE before the first sample with a live placement.
 *   6. The ocean (placed by the driver) — the server agrees: +1 ocean, +1 TR,
 *      one trade this generation, the card docked, no colony visited by blue.
 *   7. The end is the board: no workspace, nothing stranded, no
 *      `[console-overflow]`, no page error.
 *
 * And the same table one move later: the dock's tile reads «флот на карте»,
 * its stage refuses with the reason; a colony trade with the second fleet is
 * offered as ever.
 *
 * Fixture `water-hauling` (tests/e2e/fixtures/generate.ts). Heavy 4K: run with `--workers=1` — two 4K workers
 * starve the headless compositor, the flight's own rAF safety then cuts the ship mid-air (an environment
 * artefact, not the product; see the memory note on headless rAF).
 */

const DOCK = 'Water Hauling';
const DOCK_RU = 'ПЕРЕВОЗКА ВОДЫ';
const OUT = path.resolve('screenshots', 'water-hauling');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  waitingFor?: {type: string, options?: Array<{type: string, options?: Array<unknown>}>, spaces?: Array<string>},
  thisPlayer: {
    color: string, energy: number, terraformRating: number, tradesThisGeneration: number,
    tableau: Array<{name: string, fleetDocked?: string}>,
  },
  game: {oceans: number, colonies: Array<{name: string, visitor?: string}>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/** The wheel's «Торговля» — the colonies workspace, verified by its own root. */
async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  await expect(colonies, 'the colonies workspace opened').toHaveCount(1, {timeout: 10_000});
  await settle(page, {timeoutMs: 15_000});
}

/**
 * The planet tiles' boxes, SETTLED — both sides of the «nothing moved» comparison go through this. The grid's
 * entry cascade grows the tiles for a while after the workspace stands, and on a starved headless compositor a
 * tween does not finish, it FREEZES: «two equal reads» then reports the middle of the entry. So every read is
 * preceded by a FORCED frame (a tiny screenshot is a BeginFrame), and three equal reads end the wait.
 */
async function tileRects(page: Page): Promise<Array<string>> {
  const read = () => page.evaluate(() => Array.from(document.querySelectorAll('.con-colonies__slot')).map((el) => {
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  }).join(' '));
  let last = await read();
  let equal = 0;
  for (let i = 0; i < 60 && equal < 2; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
    const now = await read();
    equal = now === last ? equal + 1 : 0;
    last = now;
  }
  return last.split(' ');
}

/** Walk ▶ into the docks column — one press at a time, each verified by the cursor itself. */
async function focusDock(page: Page): Promise<void> {
  const focused = page.locator('.con-colonies__dockslot--focused');
  for (let i = 0; i < 6 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 350);
  }
  await expect(focused, 'the cursor stands on the dock').toHaveCount(1);
}

type Box = {x: number, y: number, w: number};
type Sample = {
  t: number, tick: boolean, ws: number, crumb: string, stage: boolean, ship: Box | undefined, padHidden: boolean,
  mark: boolean, energy: string, placing: boolean, stranded: boolean, scene: string, holds: string,
};
type Probe = {samples: Array<Sample>, ticks: number};

/** MutationObserver + setInterval — never rAF (headless drives rAF off the compositor: it stops when the screen is quiet). */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__tr06: Probe};
    const p: Probe = {samples: [], ticks: 0};
    w.__tr06 = p;
    const t0 = performance.now();
    const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = (tick: boolean) => {
      if (tick) {
        p.ticks++;
      }
      const ship = document.querySelector<HTMLElement>('.con-fleet-ship');
      const r = ship?.getBoundingClientRect();
      const visible = ship !== null && ship !== undefined && r !== undefined && r.width > 2 && getComputedStyle(ship).visibility !== 'hidden' && Number(getComputedStyle(ship).opacity) > 0.05;
      const s: Sample = {
        t: Math.round(performance.now() - t0),
        tick,
        ws: document.querySelectorAll('.con-ws').length,
        crumb: text(document.querySelector('.con-colonies .con-wshead')).toUpperCase(),
        stage: document.querySelector('.con-fleetdock') !== null,
        ship: visible && r !== undefined ? {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width)} : undefined,
        padHidden: document.querySelector('.con-colonies__fleetdock.con-fleet-launching') !== null,
        mark: document.querySelector('.con-fleetdock .pcard-fleet .colony-fleet-icon') !== null,
        energy: text(document.querySelector('.con-res .con-res__row--energy .con-res__digits')),
        placing: document.querySelector('.con-board--placing') !== null,
        stranded: document.querySelector('.con-stranded') !== null,
        scene: document.querySelector('[data-fleet-dock-scene]')?.getAttribute('data-fleet-dock-scene') ?? '',
        holds: JSON.stringify((window as unknown as {__conReady?: () => {holds?: unknown}}).__conReady?.()?.holds ?? null),
      };
      const last = p.samples[p.samples.length - 1];
      if (last === undefined || JSON.stringify({...last, t: 0, tick: false}) !== JSON.stringify({...s, t: 0, tick: false})) {
        p.samples.push(s);
      }
      if (p.samples.length > 8000) {
        p.samples.splice(0, 1000);
      }
    };
    sample(true);
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-fleet-dock-scene']});
    window.setInterval(() => sample(true), 30);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr06: Probe}).__tr06);

/**
 * An anchor's centre box, SETTLED the same way as the tiles (forced frames, three equal reads): the stage's
 * entrance carries the hero card in from the tile, and a starved 4K compositor freezes that carry mid-way — a
 * one-shot read then measured a ▲ the card had not reached yet (the ship, aiming at the resting rect, landed
 * on the right one).
 */
async function settledCentre(page: Page, selector: string): Promise<Box | undefined> {
  const read = () => page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r === undefined ? '' : [r.left + r.width / 2, r.top + r.height / 2, r.width].map(Math.round).join(',');
  }, selector);
  let last = await read();
  let equal = 0;
  for (let i = 0; i < 60 && equal < 2; i++) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
    const now = await read();
    equal = now === last ? equal + 1 : 0;
    last = now;
  }
  if (last === '') {
    return undefined;
  }
  const [x, y, w] = last.split(',').map(Number);
  return {x, y, w};
}

/** The ▲ berth on the stage's hero face (the flight's landing anchor). */
const heroBerth = (page: Page) => settledCentre(page, `.con-fleetdock [data-fleet-berth="card:${DOCK}"]`);
const launchPad = (page: Page) => settledCentre(page, '[data-fleet-launch]');

for (const preset of PRESETS) {
  test.describe(`TR06 Water Hauling · a trade with a CARD · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('the overview → the dock\'s stage → one POST → the fleet lands on the card → the workspace leaves → the ocean', async ({page, request}) => {
      test.setTimeout(420_000);
      const errors: Array<string> = [];
      const overflow: Array<string> = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      page.on('console', (msg) => {
        if (msg.text().includes('[console-overflow]')) {
          overflow.push(msg.text());
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'water-hauling', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(before.thisPlayer.energy, 'the fixture holds 6 energy (two fees)').toBe(6);

      // ── 1. The overview ───────────────────────────────────────────────────
      await openColonies(page);
      await expect(page.locator(`.con-colonies__docks [data-fleet-dock="${DOCK}"]`), 'the docks column stands with the card').toHaveCount(1);
      expect(await page.locator('[data-fleet-dock-status="free"]').count(), 'the dock is free').toBe(1);
      const grid0 = await tileRects(page);
      expect(grid0.length, 'the planet grid stands').toBeGreaterThanOrEqual(3);
      await focusDock(page);
      const grid1 = await tileRects(page);
      expect(grid1, 'walking into the column moves no planet tile').toEqual(grid0);
      await expect(page.locator('[data-colonies-dock-rail]'), 'the rail speaks for the focused dock').toHaveCount(1);
      await shoot(page, preset.id, '01-overview-dock');

      // ── 2. The stage ──────────────────────────────────────────────────────
      const posts: Array<{url: string, body: string}> = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          posts.push({url: req.url(), body: req.postData() ?? ''});
        }
      });
      await press(page, 'Enter', 900);
      await expect(page.locator('.con-fleetdock'), 'A opened the dock\'s stage').toHaveCount(1, {timeout: 10_000});
      await settle(page, {timeoutMs: 15_000});
      expect(await page.locator('.con-ws').count(), 'one workspace — the stage is inside it').toBe(1);
      const crumb = ((await page.locator('.con-colonies .con-wshead').textContent()) ?? '').toUpperCase();
      expect(crumb, 'the crumb names the card').toContain(DOCK_RU);
      expect(crumb, 'the crumb keeps its root').toContain('КОЛОНИИ');
      await expect(page.locator('.con-fleetdock [data-fleet-dock-hero] .pcard'), 'the hero is the card\'s own face').toHaveCount(1);
      await expect(page.locator('.con-fleetdock .con-colfocus__payrow').first(), 'the payment paths stand').toBeVisible();
      const result = ((await page.locator('[data-fleet-dock-result]').textContent()) ?? '').replace(/\s+/g, ' ');
      expect(result, `the result reads the oceans and the fleets — got «${result}»`).toMatch(/2\s*→\s*1/);
      expect(result).toMatch(new RegExp(`${before.game.oceans}\\s*→\\s*${before.game.oceans + 1}`));
      await expect(page.locator('[data-fleet-dock-note]'), 'the reward\'s next step is named').toHaveCount(1);
      expect(posts, 'nothing reached the server before A').toEqual([]);
      const pad = await launchPad(page);
      const berth = await heroBerth(page);
      expect(pad, 'the fleet dock\'s pad is measurable').toBeDefined();
      expect(berth, 'the card\'s ▲ berth is measurable').toBeDefined();
      await shoot(page, preset.id, '02-dock-stage');

      // ── 3–5. A → one POST, the flight, the scene, the workspace leaves ────
      await armProbe(page);
      await press(page, 'Enter', 200);
      await expect.poll(() => page.locator('.con-board--placing').count(), {timeout: 45_000, message: 'the ocean\'s placement is up'}).toBe(1);
      await shoot(page, preset.id, '03-placement');
      const probe = await readProbe(page);
      const samples = probe.samples;
      // The flight's trail, printed BEFORE any claim about it — a red run names its own frames.
      console.log(`[${preset.id}] pad=${JSON.stringify(pad)} berth=${JSON.stringify(berth)}\n` +
        samples.slice(0, 60).map((s) => `${s.t} ship=${JSON.stringify(s.ship)} scene=${s.scene} stage=${+s.stage} mark=${+s.mark} ws=${s.ws} holds=${s.holds}`).join('\n'));
      expect(probe.ticks, 'the probe was alive').toBeGreaterThan(10);
      expect(posts.length, 'A sent EXACTLY ONE request').toBe(1);
      expect(posts[0].body, 'the destination is the card').toContain(`"fleetDock":"${DOCK}"`);
      expect(posts[0].body, 'no colony is named').not.toContain('colonyName');

      const shipSamples = samples.filter((s) => s.ship !== undefined);
      expect(shipSamples.length, 'the ship flew').toBeGreaterThan(2);
      const first = shipSamples[0].ship!;
      const last = shipSamples[shipSamples.length - 1].ship!;
      expect(Math.hypot(first.x - pad!.x, first.y - pad!.y), 'the ship left from the pad').toBeLessThan(pad!.w * 3 + 40);
      expect(Math.hypot(last.x - berth!.x, last.y - berth!.y), 'the ship landed on the card\'s ▲').toBeLessThan(berth!.w * 2 + 12);
      expect(Math.hypot(first.x - last.x, first.y - last.y), 'it travelled').toBeGreaterThan(40);
      const firstMark = samples.findIndex((s) => s.mark);
      const lastShip = samples.map((s) => s.ship !== undefined).lastIndexOf(true);
      const firstLanding = samples.findIndex((s) => s.ship !== undefined && Math.hypot(s.ship.x - berth!.x, s.ship.y - berth!.y) < berth!.w * 2 + 12);
      expect(firstMark, 'the fleet mark appeared on the card').toBeGreaterThanOrEqual(0);
      expect(firstMark, 'the mark appears only after the ship touched down').toBeGreaterThanOrEqual(firstLanding);
      const energy0 = samples[0].energy;
      const firstTick = samples.findIndex((s) => s.energy !== energy0);
      expect(firstTick, 'the fee ticked on the rail').toBeGreaterThanOrEqual(0);
      expect(firstTick, 'the fee ticks only after the touchdown').toBeGreaterThanOrEqual(firstLanding);
      const padHiddenAt = samples.findIndex((s) => s.padHidden);
      expect(padHiddenAt, 'the pad emptied at liftoff').toBeGreaterThanOrEqual(0);
      expect(padHiddenAt, 'the pad emptied no later than the flight').toBeLessThanOrEqual(shipSamples.length > 0 ? samples.indexOf(shipSamples[0]) : 0);
      const crumbMisses = samples.filter((s) => s.stage && !(s.crumb.includes('КОЛОНИИ') && s.crumb.includes(DOCK_RU)));
      expect(crumbMisses.length, 'the crumb held its root and the card on every stage sample').toBe(0);
      const firstPlacing = samples.findIndex((s) => s.placing);
      expect(firstPlacing, 'the placement came up while sampled').toBeGreaterThanOrEqual(0);
      expect(samples[firstPlacing].ws, 'the workspace was gone before the placement').toBe(0);
      const scenes = [...new Set(samples.map((s) => s.scene).filter((s) => s !== ''))];
      expect(scenes, 'the card answered, read and left').toEqual(expect.arrayContaining(['answer', 'read', 'leave']));
      expect(lastShip, 'the ship was gone before the placement').toBeLessThan(firstPlacing);

      // ── 6. The ocean ──────────────────────────────────────────────────────
      expect(await placeTile(page), 'the driver placed the ocean').toBe(true);
      await waitForBoardHome(page);
      const after = await wireOf(request, playerId);
      expect(after.game.oceans, 'one more ocean').toBe(before.game.oceans + 1);
      expect(after.thisPlayer.terraformRating, '+1 TR').toBe(before.thisPlayer.terraformRating + 1);
      expect(after.thisPlayer.tradesThisGeneration, 'it was a trade').toBe(1);
      expect(after.thisPlayer.energy, 'the energy path\'s fee').toBe(3);
      expect(after.thisPlayer.tableau.find((c) => c.name === DOCK)?.fleetDocked, 'the fleet stands on the card').toBe(after.thisPlayer.color);
      expect(after.game.colonies.filter((c) => c.visitor === after.thisPlayer.color), 'no colony was visited').toEqual([]);

      // ── 7. The board ──────────────────────────────────────────────────────
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '04-board');
      expect(await page.locator('.con-ws').count(), 'no workspace').toBe(0);
      expect(samples.some((s) => s.stranded), 'nothing stranded on the way').toBe(false);
      expect(await strandedReports(page), 'no prompt was stranded').toEqual([]);
      expect(overflow, `no [console-overflow] — ${overflow.join(' | ')}`).toEqual([]);
      expect(errors, `no page error — ${errors.join(' | ')}`).toEqual([]);
    });

    test('one move later: the dock reads «флот на карте» and refuses with the reason; a colony takes the second fleet', async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'water-hauling', {query: preset.query});
      // The first move over the API: the trade to the card, then its ocean.
      let model = await wireOf(request, playerId);
      const menu = model.waitingFor;
      const tradeIndex = (menu?.options ?? []).findIndex((o) => o.type === 'and' && (o.options ?? []).some((sub) => (sub as {type: string}).type === 'colony'));
      expect(tradeIndex, 'the trade action is on the menu').toBeGreaterThanOrEqual(0);
      model = await sendPlayerInput(request, playerId, {
        type: 'or', index: tradeIndex,
        response: {type: 'and', responses: [{type: 'or', index: 0, response: {type: 'option'}}, {type: 'colony', fleetDock: DOCK}]},
      }) as unknown as Wire;
      expect(model.waitingFor?.type, 'the ocean is asked').toBe('space');
      await sendPlayerInput(request, playerId, {type: 'space', spaceId: (model.waitingFor?.spaces ?? [])[0]});
      await reloadConsole(page);
      await waitForBoardHome(page);

      await openColonies(page);
      await expect(page.locator('[data-fleet-dock-status="docked"]'), 'the tile reads «флот на карте»').toHaveCount(1);
      await expect(page.locator('.con-colonies__docks .pcard-fleet .colony-fleet-icon'), 'the fleet stands on the card\'s ▲').toHaveCount(1);
      await focusDock(page);
      await press(page, 'Enter', 900);
      await expect(page.locator('[data-fleet-dock-verdict]'), 'the stage refuses with ONE reason').toHaveCount(1, {timeout: 10_000});
      const reason = ((await page.locator('[data-fleet-dock-verdict]').textContent()) ?? '').trim();
      expect(reason, 'the reason is the busy berth').toMatch(/поколени/i);
      await shoot(page, preset.id, '05-dock-busy');
      const posts: Array<string> = [];
      page.on('request', (req) => {
        if (req.method() === 'POST' && /\/player\/input/.test(req.url())) {
          posts.push(req.url());
        }
      });
      await press(page, 'Enter', 600);
      expect(posts, 'A on a refused dock sends nothing').toEqual([]);
      await press(page, 'Escape', 900);
      await expect(page.locator('.con-fleetdock'), 'B folds back to the overview').toHaveCount(0, {timeout: 10_000});
      // ◀ back to the grid: a colony is offered to the second fleet.
      await press(page, 'ArrowLeft', 400);
      const tradeable = await wireOf(request, playerId);
      expect(tradeable.thisPlayer.tradesThisGeneration).toBe(1);
      await press(page, 'Enter', 900);
      await expect(page.locator('.con-colfocus'), 'a colony\'s trade stage opens').toHaveCount(1, {timeout: 10_000});
      await expect(page.locator('.con-colfocus .con-colfocus__payrow').first(), 'its payment paths stand').toBeVisible();
      await shoot(page, preset.id, '06-colony-second-fleet');
    });
  });
}
