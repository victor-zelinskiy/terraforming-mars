import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, pressUntil, settle} from './consoleStart';
import {openColoniesSection} from './cardTradeDoor';

/**
 * TR25 «ЭКСКЛЮЗИВНАЯ КОЛОНИЯ» — A COLONY BEYOND THE 3-COLONY LIMIT, the staged
 * colony door's build mode (docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md).
 *
 * A card that builds a colony by being PLAYED — on a tile at its printed limit
 * and/or one the player already stands on. The contract under test, end to end
 * against a real server, on two profiles, with TWO clients (blue plays the
 * card; red watches the colony grid):
 *
 *   1. The composer: the door's verb and its named next step. «Выбрать
 *      колонию» sends NOTHING (the server's change counter stands still).
 *   2. The grid, inside the hand: the cube's GHOST on every candidate; the
 *      FOURTH berth only on Luna (the tile at its limit); no other tile's box
 *      differs from a load with no door; the inactive tile is refused by its
 *      reason; B walks back to the composer with the same payment; in again.
 *   3. Luna's stage: the act is `build`, the fourth berth is projected under
 *      the fourth cell with its limit STANDING, the ghost stop one cell right,
 *      the owner bonus not under the berth — still nothing sent. The B-ladder.
 *   4. A is the play's ONE POST, its tail the colony ADDRESSED to the card.
 *   5. THE SCENE, in order: the limit is LIFTED before the cube's proxy exists;
 *      ONE proxy; at rest its centre is inside the fourth seat; the latch after
 *      the landing; the stop moves after the latch; M€ production ticks after
 *      the landing; nothing was degraded.
 *   6. HOME and the receipt: four cubes on Luna's tile, «5/7»; no other tile's
 *      box moved.
 *   7. The server: four cubes, the marker on 4, −10 M€, +2 M€ production.
 *   8. Red sees the fourth cube with no reload; red's own build door refuses
 *      Luna as full.
 *   9. A second colony of one's own UNDER the limit (Titan): no fourth berth
 *      anywhere, the calm status, the bonus's card target chosen ON the stage
 *      and sent in the SAME POST — never asked after the cube.
 *  10. The flow ENDS ON THE BOARD: no workspace, nothing stranded, no overflow,
 *      no page error.
 *  11. Past the press the bar is a STATUS: while the grid stands as the receipt
 *      it offers no verb («Выполнено»).
 *  12. A tile whose build pays DELEGATES (the Redux Venus, arranged in Io's
 *      place): the Parliament's vote step takes the section's zone only once
 *      the build's stage has gone HOME (never the two at once), the bar is the
 *      vote's own, A sends the delegates, then the receipt, then the board.
 *
 * Fixture `exclusive-colony` (tests/e2e/fixtures/generate.ts): blue's action
 * phase, the card in hand, 30 M€, Unity's access by two delegates; Luna — red
 * ×2 and blue ×1 with the marker on cell 3; Titan — one cube of blue's and two
 * floater holders in blue's tableau; Ceres — red's fleet; Enceladus inactive.
 */

const CARD = 'Exclusive Colony';
const CARD_RU = 'Эксклюзивная колония';
const ROOT_RU = 'Карты в руке';
const TILES = ['Luna', 'Ceres', 'Titan', 'Enceladus', 'Io'] as const;
/** The Redux Venus — the tile whose BUILD bonus is «add 2 delegates to a resolution» (the third test's table). */
const VENUS = 'Venus Redux';
const OUT = path.resolve('screenshots', 'exclusive-colony');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, megacreditProduction: number, tableau: Array<{name: string, resources?: number}>};
  game: {gameAge: number, colonies: Array<{name: string, colonies: Array<string>, trackPosition: number}>};
  waitingFor?: {type?: string};
};

/** The server's own view. One retry on a dropped socket (a loaded per-worker server resets a connection now and then). */
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

const colonyOf = (wire: Wire, name: string) => wire.game.colonies.find((c) => c.name === name);

type Probe = {
  samples: number;
  ticks: number;
  /** The crumb's tail on every change, and every sample the root or the card's name was missing while the flow stood. */
  steps: Array<string>;
  crumbMisses: Array<string>;
  wsMax: number;
  stranded: boolean;
  degraded: boolean;
  /** The build transaction's phases, in the order they were first seen. */
  phases: Array<string>;
  /** First sample (ms) of each beat. */
  admittedAt?: number;
  proxyAt?: number;
  landedAt?: number;
  latchAt?: number;
  stopAt?: number;
  prodAt?: number;
  receiptAt?: number;
  proxyMax: number;
  /** The proxy's centre on its last visible sample, and the box of the seat it was aimed at (read at the proxy's first sample). */
  proxyRest?: [number, number];
  seat?: [number, number, number, number];
  /** TICK samples: no cube at all in the fourth berth after the landing (neither the proxy nor the real one). */
  noCube: Array<number>;
  stopCol: Array<[number, string]>;
  /** Samples where the colony stage AND a hosted Parliament step both stood (the step may only stand once the stage is home). */
  overlap: Array<number>;
  /** Every distinct text the command bar showed while the grid stood as the receipt. */
  receiptBars: Array<string>;
};

/**
 * MutationObserver + setInterval — never rAF (headless drives rAF off the
 * compositor: it stops when the screen is quiet). `colony` — the tile being
 * built on; `slot` — the berth the cube takes.
 */
async function armProbe(page: Page, colony: string, slot: number): Promise<void> {
  await page.evaluate(({card, root, colony, slot}) => {
    const w = window as unknown as {__tr25: Probe};
    const p: Probe = {samples: 0, ticks: 0, steps: [], crumbMisses: [], wsMax: 0, stranded: false, degraded: false, phases: [], proxyMax: 0, noCube: [], stopCol: [], overlap: [], receiptBars: []};
    w.__tr25 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const prodText = () => text(document.querySelector('.con-res__row .con-res__prod'));
    const prod0 = prodText();
    const sample = (tick: boolean) => {
      const at = Date.now() - t0;
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      // ── the flow ──
      const ws = document.querySelectorAll('.con-ws');
      p.wsMax = Math.max(p.wsMax, ws.length);
      p.stranded = p.stranded || document.querySelector('.con-stranded') !== null;
      p.degraded = p.degraded || document.querySelector('[data-colony-build-degraded]') !== null;
      const head = document.querySelector('.con-hand .con-wshead') ?? document.querySelector('.con-wshead');
      if (head !== null && document.querySelector('.con-hand') !== null) {
        const crumb = text(head).toUpperCase();
        if (!crumb.includes(root.toUpperCase()) || (document.querySelector('.con-hand .con-colonies') !== null && !crumb.includes(card.toUpperCase()))) {
          p.crumbMisses.push(`${at}: ${crumb.slice(0, 120)}`);
        }
        const tail = crumb.split('›').pop()?.trim() ?? '';
        if (tail !== '' && p.steps[p.steps.length - 1] !== tail) {
          p.steps.push(tail);
        }
      }
      // ── the scene ──
      const phase = document.querySelector('[data-colony-build-phase]')?.getAttribute('data-colony-build-phase');
      if (phase !== null && phase !== undefined && !p.phases.includes(phase)) {
        p.phases.push(phase);
      }
      const stage = document.querySelector<HTMLElement>('.con-colfocus');
      const berth = stage?.querySelector<HTMLElement>(`[data-colony-build-slot="${colony}#${slot}"]`)?.closest<HTMLElement>('.con-colfocus__berth') ?? null;
      const seatEl = stage?.querySelector<HTMLElement>(`[data-colony-build-slot="${colony}#${slot}"]`) ?? null;
      if (p.admittedAt === undefined && berth !== null && (berth.getAttribute('data-colony-berth-overlimit') === 'passed' || berth.classList.contains('con-colfocus__berth--taken'))) {
        p.admittedAt = at;
      }
      const proxies = Array.from(document.querySelectorAll<HTMLElement>('.con-colonybuild__cube')).filter((el) => el.getBoundingClientRect().width > 2);
      p.proxyMax = Math.max(p.proxyMax, proxies.length);
      if (proxies.length > 0) {
        // THE SEAT THE CUBE IS AIMED AT — read ONCE, in the first sample the cube exists: the press has been made,
        // so the stage is pinned and at rest (read at the probe's very first sample, a stage still unfolding on a
        // loaded 4K runner gave a seat 538 px away from where it — and the cube — came to rest). Deliberately NOT
        // re-read later: at the commit the berth gains its owner's name and re-centres, the seat with it (~10 px
        // up at 1080 — the shared build signature's own handoff, measured identical on the base build).
        if (p.proxyAt === undefined) {
          const seatBox = seatEl?.getBoundingClientRect();
          if (seatBox !== undefined && seatBox.width > 3) {
            p.seat = [seatBox.left, seatBox.top, seatBox.width, seatBox.height];
          }
        }
        p.proxyAt ??= at;
        const r = proxies[0].getBoundingClientRect();
        p.proxyRest = [r.left + r.width / 2, r.top + r.height / 2];
      }
      if (p.landedAt === undefined && (phase === 'landed' || phase === 'done')) {
        p.landedAt = at;
      }
      if (p.latchAt === undefined && stage?.querySelector('.con-colfocus__berth--latching, .con-colfocus__xcell--latching') !== null && stage !== null && stage !== undefined) {
        p.latchAt = at;
      }
      const zone = stage?.querySelector<HTMLElement>('.con-colfocus__trackzone');
      const stop = zone === null || zone === undefined ? '' : zone.style.getPropertyValue('--stop-col').trim();
      if (stop !== '' && (p.stopCol.length === 0 || p.stopCol[p.stopCol.length - 1][1] !== stop)) {
        p.stopCol.push([at, stop]);
        if (p.stopCol.length > 1) {
          p.stopAt ??= at;
        }
      }
      if (p.prodAt === undefined && prodText() !== prod0) {
        p.prodAt = at;
      }
      const receipt = document.querySelector('[data-colony-build-receipt]') !== null;
      if (p.receiptAt === undefined && receipt) {
        p.receiptAt = at;
      }
      if (receipt && tick) {
        const bar = text(document.querySelector('.con-cmdbar'));
        if (bar !== '' && !p.receiptBars.includes(bar)) {
          p.receiptBars.push(bar);
        }
      }
      const parliamentStep = document.querySelector<HTMLElement>('[data-embed-slot="colonies-parliament"] .con-parl');
      if (tick && parliamentStep !== null && parliamentStep.getBoundingClientRect().width > 2 &&
          stage !== null && stage !== undefined && stage.getBoundingClientRect().width > 2) {
        p.overlap.push(at);
      }
      // A cube stands in the berth on every TICK past the landing: the proxy, or the real one under it.
      if (tick && p.landedAt !== undefined && seatEl !== null && seatEl.getBoundingClientRect().width > 3) {
        const real = seatEl.querySelector('.player-cube') !== null;
        if (!real && proxies.length === 0) {
          p.noCube.push(at);
        }
      }
    };
    new MutationObserver(() => sample(false)).observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
    setInterval(() => sample(true), 30);
  }, {card: CARD_RU, root: ROOT_RU, colony, slot});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr25: Probe}).__tr25);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** The acceptance storyboard (opt-in, `TM_E2E_STORYBOARD=1`): every frame the compositor produced. Returns the stop. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true}); // a storyboard is ONE run's frames
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

const composer = '.con-composer--play';
const grid = '.con-hand .con-colonies[data-colony-mode="pick"]';
const stage = '.con-hand .con-colfocus[data-colony-intent="build"]';
const tile = (scope: string, name: string) => `${scope} [data-test="con-colony-${name}"]`;
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__slot--focused [data-test^="con-colony-"]')?.getAttribute('data-test')?.replace('con-colony-', '') ?? '');

/**
 * Every tile as the grid draws it — SETTLED (equal reads 100 ms apart; timers, never rAF): its LAYOUT box (the slot's
 * position, the tile's size — never a painted rect: the focused tile is lifted by a transform), its berths, its ghost,
 * its over-limit berths and its status line.
 */
const tilesOf = (page: Page, scope: string) => page.evaluate(async ({scope, names}) => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  const read = () => names.map((name) => {
    const el = document.querySelector<HTMLElement>(`${scope} [data-test="con-colony-${name}"]`);
    const slot = el?.closest<HTMLElement>('.con-colonies__slot') ?? el;
    return {
      name,
      box: el === null || el === undefined || slot === null || slot === undefined ? '' :
        [slot.offsetLeft, slot.offsetTop, el.offsetWidth, el.offsetHeight].join(','),
      berths: el?.querySelectorAll('.con-coltile__build-slot').length ?? 0,
      cubes: el?.querySelectorAll('.con-coltile__build-slot .player-cube').length ?? 0,
      ghosts: el?.querySelectorAll('.con-coltile__ghost-cube').length ?? 0,
      over: el?.querySelectorAll('[data-colony-berth-overlimit]').length ?? 0,
      blocked: (el?.querySelector('.con-coltile__status--blocked, .con-coltile__status--inactive')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      status: (el?.querySelector('.con-coltile__status--ok')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      track: (el?.querySelector('.con-coltile__track-pos')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  });
  let last = read();
  let equal = 0;
  for (let i = 0; i < 60 && equal < 2; i++) {
    await pause();
    const now = read();
    equal = JSON.stringify(now) === JSON.stringify(last) ? equal + 1 : 0;
    last = now;
  }
  return last;
}, {scope, names: [...TILES]});

/** Open the hand from board home and descend into the card's play composer. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600); // the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/** «ВЫБРАТЬ КОЛОНИЮ» — one press, verified by the composer's OWN state; never a blind retry. */
async function chooseColony(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) !== null, grid);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await page.locator(grid).waitFor({timeout: 30_000});
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** Walk the grid cursor to `name` — each press verified by the cursor itself. */
async function walkTo(page: Page, name: string): Promise<void> {
  for (let step = 0; step < 12 && await focusedTile(page) !== name; step++) {
    const before = await focusedTile(page);
    await press(page, step < 6 ? 'ArrowRight' : 'ArrowLeft', 200);
    await expect.poll(() => focusedTile(page), {timeout: 2_500}).not.toBe(before).catch(() => undefined);
  }
  expect(await focusedTile(page), `the cursor reached ${name}`).toBe(name);
}

/** A on the focused tile → its `build` stage (the press verified by the stage itself). */
async function descend(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3 && await page.locator(stage).count() === 0; attempt++) {
    await press(page, 'Enter', 400);
    await page.locator(stage).waitFor({timeout: 4_000}).catch(() => undefined);
  }
  await page.locator(stage).waitFor({timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

type Listeners = {pageErrors: Array<string>, overflow: Array<string>, posts: Array<{url: string, body: string}>};

function listen(page: Page): Listeners {
  const out: Listeners = {pageErrors: [], overflow: [], posts: []};
  page.on('pageerror', (e) => out.pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.text().includes('[console-overflow]')) {
      out.overflow.push(m.text().slice(0, 200));
    }
  });
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      out.posts.push({url: r.url(), body: r.postData() ?? ''});
    }
  });
  return out;
}

const responsesOf = (body: string): Array<Record<string, unknown>> => {
  const sent = JSON.parse(body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
  return Array.isArray(sent) ? sent : sent.responses ?? [];
};

for (const preset of PRESETS) {
  test.describe(`TR25 Exclusive Colony · a colony beyond the limit · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать колонию» → the ghosts → B → back → Luna's stage → A → the limit lifts, the cube LANDS in the fourth berth → home → the board; red watches the grid (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(540_000);
      const own = listen(page);

      const {playerId, seats} = await bootFixtureSeats(page, request, 'exclusive-colony', {query: preset.query});
      const red = seats[1];
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect(colonyOf(before, 'Luna')?.colonies.length, 'the fixture: Luna stands at its printed limit').toBe(3);
      expect(colonyOf(before, 'Luna')?.colonies.filter((c) => c === viewer).length, 'the fixture: one of the three is blue\'s').toBe(1);
      expect(colonyOf(before, 'Luna')?.trackPosition).toBe(3);
      expect(before.thisPlayer.megacredits).toBe(30);

      // ── THE WATCHER: red on the colony grid ──
      const redErrors: Array<string> = [];
      const redGrid = await context.newPage();
      redGrid.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(redGrid, red, preset.query);
      await settle(redGrid, {timeoutMs: 30_000});
      // Red is still inside its START workspace (its corporation's first action waits for blue's turn) — «Свернуть»
      // puts red ON the board, where the wheel is its own.
      const redOnBoard = () => redGrid.evaluate(() => {
        const start = document.querySelector<HTMLElement>('.con-start__frame');
        const board = document.querySelector<HTMLElement>('.con-board');
        return (start === null || start.offsetParent === null) && board !== null && board.offsetParent !== null;
      });
      expect(await pressUntil(redGrid, 'Escape', redOnBoard, {tries: 4, settleMs: 1200}), 'red minimizes its start workspace and stands on the board').toBe(true);
      await settle(redGrid, {timeoutMs: 20_000});
      await openColoniesSection(redGrid);
      await settle(redGrid, {timeoutMs: 20_000});
      // The grid as it stands with NO door: the boxes a door may not move, and three berths on every tile.
      const restTiles = await tilesOf(redGrid, '.con-colonies');
      expect(restTiles.map((t) => t.berths), 'with no door every tile draws its three printed berths').toEqual(TILES.map(() => 3));
      expect(restTiles.map((t) => t.over + t.ghosts), 'with no door: no berth beyond the limit, no ghost').toEqual(TILES.map(() => 0));
      await page.bringToFront();

      // ── 1. the composer: the door's verb and the named step; «Выбрать колонию» sends nothing ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать колонию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Колония — плитка выбирается в «Колониях»');
      const paymentBefore = await textOf(page, `${composer} .con-paystatus`);
      expect(paymentBefore, 'the payment line states the price').toContain('10');
      await shoot(page, preset.id, '01-composer');
      await armProbe(page, 'Luna', 3);
      await chooseColony(page);
      expect(own.posts, 'no POST before the commit').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 2. the grid: a ghost on EVERY candidate, the fourth berth on Luna alone, no other box moved ──
      const doorTiles = await tilesOf(page, grid);
      const byName = (name: string) => doorTiles.find((t) => t.name === name)!;
      for (const name of ['Luna', 'Ceres', 'Titan', 'Io']) {
        expect(byName(name).ghosts, `${name}: the cube's ghost stands in the berth it would take`).toBe(1);
        expect(byName(name).blocked, `${name}: a candidate carries no refusal`).toBe('');
      }
      await expect(page.locator(`${tile(grid, 'Luna')} .con-coltile__ghost-cube`), 'the ghost wears the builder\'s colour')
        .toHaveClass(new RegExp(`player_translucent_bg_color_${viewer}`));
      expect(byName('Luna').berths, 'Luna: the FOURTH berth stands before its cube').toBe(4);
      expect(byName('Luna').over, 'Luna: that berth alone is beyond the limit').toBe(1);
      expect(byName('Luna').status, 'Luna: what the card lifts here — calm, never a refusal').toContain('Сверх лимита — по карте');
      expect(byName('Titan').status, 'Titan: a second colony of one\'s own').toContain('Вторая колония — по карте');
      for (const name of ['Ceres', 'Titan', 'Enceladus', 'Io']) {
        expect(byName(name).berths, `${name}: three berths — no fourth place where the rule gives none`).toBe(3);
        expect(byName(name).over, `${name}: nothing beyond the limit`).toBe(0);
      }
      expect(byName('Enceladus').ghosts, 'the inactive tile is no candidate: no ghost').toBe(0);
      expect(byName('Enceladus').blocked, 'the inactive tile is refused by its OWN reason').toContain('Колония неактивна');
      // Every tile keeps ONE box under the door, and the tiles sit where red's door-less grid has them.
      const doorSizes = doorTiles.map((t) => t.box.split(',').slice(2).join('×'));
      expect(new Set(doorSizes).size, `every tile keeps ONE box under the door (${doorSizes.join(' | ')})`).toBe(1);
      expect(doorSizes[0], 'the tile\'s box is the one a door-less grid draws').toBe(restTiles[0].box.split(',').slice(2).join('×'));
      expect(await focusedTile(page), 'the cursor stands on the first candidate (A only descends)').toBe('Luna');
      await expect(page.locator(`${grid} [data-colonies-rail-overlimit]`), 'the rail names the berth: «Место 4 · сверх лимита»').toContainText('Место 4 · сверх лимита');
      const walkBefore = await tilesOf(page, grid);
      await walkTo(page, 'Titan');
      await walkTo(page, 'Luna');
      expect((await tilesOf(page, grid)).map((t) => t.box), 'walking the grid moved no box').toEqual(walkBefore.map((t) => t.box));
      expect(own.posts, 'walking the grid sends nothing').toEqual([]);
      await shoot(page, preset.id, '02-grid-projections');

      // ── 2b. B walks back to the composer — the same payment, nothing sent ──
      const backTaken = () => page.evaluate((sel) =>
        document.querySelector(sel) !== null || document.querySelector('.con-colonies') === null, composer);
      for (let attempt = 0; attempt < 3 && !await backTaken(); attempt++) {
        await press(page, 'Escape', 300);
        await expect.poll(backTaken, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator(composer), 'B restores the composer').toHaveCount(1, {timeout: 15_000});
      await expect(page.locator('.con-hand .con-colonies'), 'the step left').toHaveCount(0, {timeout: 10_000});
      await settle(page);
      await expect.poll(() => textOf(page, `${composer} .con-paystatus`), {timeout: 10_000, message: 'the payment survived the round trip'}).toBe(paymentBefore);
      expect(own.posts).toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the round trip left no trace').toBe(before.game.gameAge);

      // ── 3. in again; A on Luna descends to its `build` stage ──
      await chooseColony(page);
      await walkTo(page, 'Luna');
      await descend(page);
      const berth4 = page.locator(`${stage} [data-colony-build-slot="Luna#3"]`);
      await expect(berth4, 'the fourth berth is published before its cube').toHaveCount(1);
      await expect(page.locator(`${stage} [data-colony-berth-overlimit]`), 'ONE berth beyond the limit, its limit STANDING').toHaveAttribute('data-colony-berth-overlimit', 'standing');
      await expect(page.locator(`${stage} .con-colfocus__limitmark`), 'ONE limit mark').toHaveCount(1);
      await expect(page.locator(`${stage} .con-colfocus__limitword`), 'ONE word, in the lane').toContainText(/сверх лимита/i);
      await expect(page.locator(`${stage} [data-colony-build-overlimit]`), 'the rail: «Место 4 · сверх лимита»').toContainText('Место 4 · сверх лимита');
      const geometry = await page.evaluate((stageSel) => {
        const root = document.querySelector<HTMLElement>(stageSel)!;
        const cells = Array.from(root.querySelectorAll<HTMLElement>('.con-colfocus__xcell')).map((c) => c.getBoundingClientRect());
        const berths = Array.from(root.querySelectorAll<HTMLElement>('.con-colfocus__berth')).map((b) => b.getBoundingClientRect());
        const bonus = root.querySelector<HTMLElement>('.con-colfocus__ownerbonus')!.getBoundingClientRect();
        const ghost = root.querySelector<HTMLElement>('.con-colfocus__stop--ghost')?.getBoundingClientRect();
        const zone = root.querySelector<HTMLElement>('.con-colfocus__trackzone')!;
        const last = berths[berths.length - 1];
        return {
          berths: berths.length,
          aligned: berths.map((b, i) => Math.round(b.left - cells[i].left)),
          bonusOverlap: Math.round(Math.max(0, Math.min(bonus.right, last.right) - Math.max(bonus.left, last.left))),
          ghostStopCell: ghost === undefined ? -1 : cells.findIndex((c) => Math.abs(c.left - ghost.left) <= 2),
          stopCol: zone.style.getPropertyValue('--stop-col').trim(),
          ghostCol: zone.style.getPropertyValue('--ghost-col').trim(),
          willProtect: Array.from(root.querySelectorAll('.con-colfocus__xcell')).findIndex((c) => c.classList.contains('con-colfocus__xcell--willprotect')),
        };
      }, stage);
      expect(geometry.berths, 'four berths on the stage').toBe(4);
      expect(geometry.aligned.map((d) => Math.abs(d) <= 1), `berth i stands under cell i (${geometry.aligned.join(', ')})`).toEqual([true, true, true, true]);
      expect(geometry.bonusOverlap, 'the owner bonus gave its column: it does not stand under the fourth berth').toBe(0);
      expect([geometry.stopCol, geometry.ghostCol], 'the stop holds three cells; its ghost stands one cell further').toEqual(['3', '4']);
      expect(geometry.ghostStopCell, 'the ghost stop is drawn on the fifth cell').toBe(4);
      expect(geometry.willProtect, 'the fourth cell is the one about to be held').toBe(3);
      expect(own.posts, 'the descent sends nothing').toEqual([]);
      await shoot(page, preset.id, '03-stage-projection');

      // The B-ladder: X reads the dossier, A returns to the act; B folds to the grid with Luna in focus; A descends again.
      expect(await pressUntil(page, 'KeyX', async () => await page.locator('.con-hand .con-colinspect').count() > 0, {tries: 3, settleMs: 900}),
        'X on the stage opens the colony\'s dossier').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      expect(await pressUntil(page, 'Enter', async () => await page.locator(stage).count() > 0, {tries: 3, settleMs: 900}),
        'A on the dossier leads back to the act').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand .con-colfocus').count() === 0, {tries: 3, settleMs: 900}),
        'B on the stage folds back to the grid').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      expect(await focusedTile(page), 'B is one level: the grid, the same tile in focus').toBe('Luna');
      expect(own.posts, 'the whole ladder sent nothing').toEqual([]);
      await descend(page);

      // ── 4. A «Разыграть карту» — ONE POST, addressed to the card ──
      await armProbe(page, 'Luna', 3);
      const stopOwnStory = await storyboard(page, preset.id, 'own');
      const stopRedStory = await storyboard(redGrid, preset.id, 'watcher');
      for (let attempt = 0; attempt < 3 && own.posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => own.posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(own.posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      const responses = responsesOf(own.posts[0].body);
      expect(responses[responses.length - 1], 'the tail is the colony tile, ADDRESSED to the card')
        .toMatchObject({type: 'colony', colonyName: 'Luna', stagedFor: CARD});

      // ── 7. the server ──
      await expect.poll(async () => colonyOf(await wireOf(request, playerId), 'Luna')?.colonies.length ?? 0,
        {timeout: 30_000, message: 'the fourth cube stands on Luna'}).toBe(4);
      const after = await wireOf(request, playerId);
      expect(colonyOf(after, 'Luna')?.colonies[3], 'the fourth cube is blue\'s').toBe(viewer);
      expect(colonyOf(after, 'Luna')?.trackPosition, 'the marker was lifted to the fourth colony\'s floor').toBe(4);
      expect(after.thisPlayer.megacredits, 'the printed price').toBe(20);
      expect(after.thisPlayer.megacreditProduction - before.thisPlayer.megacreditProduction, 'the tile\'s build bonus: +2 M€ production').toBe(2);
      expect((after.cardsInHand ?? []).map((c) => c.name)).not.toContain(CARD);

      // ── 10. the flow ENDS ON THE BOARD ──
      await expect(page.locator('.con-ws'), 'no workspace is left standing').toHaveCount(0, {timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      await stopOwnStory();
      await stopRedStory();
      await shoot(page, preset.id, '09-board');
      expect(own.posts, 'the whole play was ONE POST').toHaveLength(1);

      // ── 5. the scene, in order ──
      const probe = await readProbe(page);
      expect(probe.samples, `the probe ran (${probe.samples} samples, ${probe.ticks} ticks)`).toBeGreaterThan(20);
      expect(probe.degraded, 'the cube\'s flight was never degraded').toBe(false);
      expect(probe.proxyMax, 'ONE cube proxy').toBe(1);
      expect(probe.admittedAt, 'the limit was lifted').toBeDefined();
      expect(probe.proxyAt, 'the cube flew').toBeDefined();
      expect(probe.admittedAt!, `ADMISSION before the cube (${probe.admittedAt} ≤ ${probe.proxyAt})`).toBeLessThanOrEqual(probe.proxyAt!);
      expect(probe.landedAt, 'the cube landed').toBeDefined();
      expect(probe.latchAt, 'the latch played').toBeDefined();
      expect(probe.latchAt!, `the latch after the landing (${probe.landedAt} ≤ ${probe.latchAt})`).toBeGreaterThanOrEqual(probe.landedAt!);
      expect(probe.stopCol.map((s) => s[1]), 'the stop slid from the fourth cell to the fifth').toEqual(['3', '4']);
      expect(probe.stopAt!, `the stop after the latch (${probe.latchAt} ≤ ${probe.stopAt})`).toBeGreaterThanOrEqual(probe.latchAt!);
      expect(probe.prodAt, 'M€ production ticked').toBeDefined();
      expect(probe.prodAt!, `the production ticks after the landing (${probe.landedAt} ≤ ${probe.prodAt})`).toBeGreaterThanOrEqual(probe.landedAt!);
      expect(probe.seat, 'the fourth seat was measured').toBeDefined();
      const [sx, sy, sw, sh] = probe.seat!;
      const [px, py] = probe.proxyRest!;
      expect(Math.abs(px - (sx + sw / 2)), `the cube rests on the seat's centre, x (${px} vs ${sx + sw / 2})`).toBeLessThanOrEqual(2);
      expect(Math.abs(py - (sy + sh / 2)), `the cube rests on the seat's centre, y (${py} vs ${sy + sh / 2})`).toBeLessThanOrEqual(2);
      expect(probe.noCube, 'past the landing a cube stands in the berth on every tick (the proxy, then the real one)').toEqual([]);
      expect(probe.receiptAt, 'the grid stood as a receipt').toBeDefined();
      expect(probe.receiptAt!, 'HOME after the scene').toBeGreaterThan(probe.landedAt!);
      // The receipt takes no verbs, so the bar offers none: a STATUS, never the door's «Выбрать · Осмотреть · Назад».
      expect(probe.receiptBars.length, 'the bar was read while the receipt stood').toBeGreaterThan(0);
      expect(probe.receiptBars.filter((bar) => /Выбрать|Назад|Осмотреть/i.test(bar)), 'the bar of the receipt offers no verb').toEqual([]);
      expect(probe.receiptBars.some((bar) => /Выполнено/i.test(bar)), `the receipt's bar states the result (${probe.receiptBars.join(' | ')})`).toBe(true);
      expect(probe.crumbMisses, 'the crumb never lost its root or the card').toEqual([]);
      expect(probe.wsMax, 'ONE workspace root the whole flow').toBeLessThanOrEqual(1);
      expect(probe.stranded, 'nothing was stranded').toBe(false);

      // ── 8. red: the fourth cube with no reload; red's own build door refuses Luna as full ──
      await redGrid.bringToFront();
      await expect.poll(async () => (await tilesOf(redGrid, '.con-colonies')).find((t) => t.name === 'Luna')?.cubes ?? 0,
        {timeout: 30_000, message: 'red sees four cubes on Luna'}).toBe(4);
      const redAfter = await tilesOf(redGrid, '.con-colonies');
      const redLuna = redAfter.find((t) => t.name === 'Luna')!;
      expect(redLuna.berths, 'red: Luna draws four berths').toBe(4);
      expect(redLuna.track, 'red: «5/7»').toBe('5/7');
      expect(redAfter.filter((t) => t.name !== 'Luna').map((t) => t.box), 'red: no other tile\'s box moved')
        .toEqual(restTiles.filter((t) => t.name !== 'Luna').map((t) => t.box));
      expect(redLuna.box, 'red: Luna\'s own box did not change').toBe(restTiles.find((t) => t.name === 'Luna')!.box);
      await shoot(redGrid, preset.id, '08-watcher-grid');
      expect(redErrors, 'red\'s page raised no error').toEqual([]);

      // ── 6. home: blue's grid states four cubes ──
      await page.bringToFront();
      await openColoniesSection(page);
      await settle(page, {timeoutMs: 20_000});
      const home = (await tilesOf(page, '.con-colonies')).find((t) => t.name === 'Luna')!;
      expect([home.berths, home.cubes, home.over, home.track], 'Luna at rest: four berths, four cubes, one beyond the limit, «5/7»').toEqual([4, 4, 1, '5/7']);
      await shoot(page, preset.id, '06-home-grid');

      expect(own.pageErrors, 'no page error').toEqual([]);
      expect(own.overflow, 'no [console-overflow]').toEqual([]);
    });

    test(`a second colony of one's own UNDER the limit (Titan): no fourth berth, the bonus's card chosen on the stage, ONE POST (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const own = listen(page);
      const {playerId} = await bootFixtureSeats(page, request, 'exclusive-colony', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const holders = before.thisPlayer.tableau.filter((c) => c.name === 'Dirigibles' || c.name === 'Jupiter Floating Station');
      expect(holders.length, 'the fixture: two floater holders — the bonus is a real pick').toBe(2);

      await openComposer(page);
      await chooseColony(page);
      await walkTo(page, 'Titan');
      await descend(page);
      await expect(page.locator(`${stage} .con-colfocus__berth`), 'Titan\'s stage: three berths').toHaveCount(3);
      await expect(page.locator(`${stage} [data-colony-berth-overlimit]`), 'no berth beyond the limit').toHaveCount(0);
      await expect(page.locator(`${stage} .con-colfocus__limitmark, ${stage} .con-colfocus__limitword`), 'no limit mark, no word').toHaveCount(0);
      await expect(page.locator(`${stage} .con-colfocus__berth--dest`), 'the destination is the second berth').toHaveCount(1);
      // The bonus's target is asked ON the stage, before the commit — the stage marks its own unanswered step.
      const missing = page.locator(`${stage} .con-colfocus__steprow--missing`);
      await expect(missing, 'the build bonus asks for a card — on the stage').toHaveCount(1);
      await shoot(page, preset.id, '10-titan-stage');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus__targetstage').count() > 0, {tries: 3, settleMs: 900}),
        'A opens the target step inside the stage').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus__targetstage').count() === 0, {tries: 3, settleMs: 900}),
        'A picks the card and returns to the review').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      await expect(missing, 'the step is answered').toHaveCount(0);
      expect(own.posts, 'nothing is sent before the commit').toEqual([]);
      await armProbe(page, 'Titan', 1);
      for (let attempt = 0; attempt < 3 && own.posts.length === 0; attempt++) {
        await press(page, 'KeyX', 300);
        await expect.poll(() => own.posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(own.posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      const responses = responsesOf(own.posts[0].body);
      const colonyAt = responses.findIndex((r) => r.type === 'colony');
      expect(responses[colonyAt], 'the colony tile, ADDRESSED to the card').toMatchObject({type: 'colony', colonyName: 'Titan', stagedFor: CARD});
      expect(responses[colonyAt + 1], 'the bonus\'s card target rides BEHIND it, in the same POST').toMatchObject({type: 'card'});
      expect(responses).toHaveLength(colonyAt + 2);
      const chosen = ((responses[colonyAt + 1] as {cards?: Array<string>}).cards ?? [])[0];

      await expect.poll(async () => colonyOf(await wireOf(request, playerId), 'Titan')?.colonies.length ?? 0,
        {timeout: 30_000, message: 'the second cube stands on Titan'}).toBe(2);
      const after = await wireOf(request, playerId);
      expect(colonyOf(after, 'Titan')?.colonies, 'both are blue\'s — the tile stays under its limit').toEqual([viewer, viewer]);
      expect(after.thisPlayer.tableau.find((c) => c.name === chosen)?.resources, 'the 3 floaters stand on the card picked BEFORE the commit').toBe(3);
      expect(after.waitingFor?.type, 'the target is never asked after the cube landed').not.toBe('card');

      await expect(page.locator('.con-ws'), 'no workspace is left standing').toHaveCount(0, {timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      const probe = await readProbe(page);
      expect(probe.degraded, 'the cube\'s flight was never degraded').toBe(false);
      expect(probe.proxyMax, 'ONE cube proxy').toBe(1);
      expect(probe.crumbMisses, 'the crumb never lost its root or the card').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(own.posts, 'the whole play was ONE POST').toHaveLength(1);
      expect(own.pageErrors, 'no page error').toEqual([]);
      expect(own.overflow, 'no [console-overflow]').toEqual([]);
    });

    test(`a tile whose build pays DELEGATES (the Redux Venus): the stage goes HOME before the Parliament's step, then the receipt, then the board (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const own = listen(page);
      const {playerId} = await bootFixtureSeats(page, request, 'exclusive-colony', {
        query: preset.query,
        // ONE declared difference from the fixture: Io is the Redux Venus at its printed limit (red ×3) — the tile
        // whose build bonus places 2 delegates on a resolution (the Parliament's vote step, a hosted frame).
        arrange: (serialized) => {
          const game = serialized as unknown as {
            colonies: Array<{name: string, colonies: Array<string>, trackPosition: number}>,
            gameOptions: {venusNextExtension?: boolean, expansions?: Record<string, boolean>},
          };
          const red = game.colonies.find((c) => c.name === 'Luna')!.colonies[0];
          const tile = game.colonies.find((c) => c.name === 'Io')!;
          tile.name = VENUS;
          tile.colonies = [red, red, red];
          tile.trackPosition = 3;
          game.gameOptions.venusNextExtension = true;
          if (game.gameOptions.expansions !== undefined) {
            game.gameOptions.expansions.venus = true;
          }
        },
      });
      const before = await wireOf(request, playerId);
      expect(colonyOf(before, VENUS)?.colonies.length, 'the arranged table: the Redux Venus stands at its printed limit').toBe(3);

      await openComposer(page);
      await chooseColony(page);
      await walkTo(page, VENUS);
      await descend(page);
      await expect(page.locator(`${stage} [data-colony-berth-overlimit]`), 'the fourth berth, its limit standing').toHaveAttribute('data-colony-berth-overlimit', 'standing');
      expect(own.posts, 'nothing is sent before the commit').toEqual([]);
      await armProbe(page, VENUS, 3);
      for (let attempt = 0; attempt < 3 && own.posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => own.posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(own.posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      await expect.poll(async () => colonyOf(await wireOf(request, playerId), VENUS)?.colonies.length ?? 0,
        {timeout: 30_000, message: 'the fourth cube stands on the Redux Venus'}).toBe(4);
      expect((await wireOf(request, playerId)).waitingFor?.type, 'the tile\'s bonus asks where the delegates go').toBe('party');

      // ── THE GRANT'S STEP: the Parliament's vote mode in the section's own zone — and the stage is HOME under it ──
      const step = page.locator('.con-hand [data-embed-slot="colonies-parliament"] .con-parl');
      await step.waitFor({timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      await expect(page.locator('.con-hand .con-colfocus'), 'the build\'s stage went home before the step stood').toHaveCount(0);
      const crumb = (await textOf(page, '.con-hand .con-wshead')).toUpperCase();
      expect(crumb, 'the crumb keeps the root and the card').toContain(ROOT_RU.toUpperCase());
      expect(crumb).toContain(CARD_RU.toUpperCase());
      expect(crumb, 'the tail names the tile and the step').toContain('ВЕНЕРА');
      expect(crumb).toContain('ГОЛОСОВАНИЕ');
      await expect(page.locator('.con-cmdbar'), 'the bar is the vote\'s own — never the stage\'s verbs').toContainText('Отправить делегатов');
      await expect(page.locator('.con-cmdbar')).not.toContainText('Разыграть карту');
      await shoot(page, preset.id, '11-venus-grant-step');

      // A «Отправить делегатов» — the grant's one answer (the SERVER is the witness of the press).
      const granted = async () => (await wireOf(request, playerId)).waitingFor?.type !== 'party';
      expect(await pressUntil(page, 'Enter', granted, {tries: 3, settleMs: 2500}), 'A sends the delegates').toBe(true);
      expect(own.posts.map((p) => new URL(p.url).pathname), 'two requests in all: the play, then the grant\'s answer').toEqual(['/player/input-batch', '/player/input']);
      expect(JSON.parse(own.posts[1].body), 'the answer is the party of the chosen resolution').toMatchObject({type: 'party'});

      // ── the receipt, then the board ──
      await expect(page.locator('.con-ws'), 'no workspace is left standing').toHaveCount(0, {timeout: 60_000});
      await settle(page, {timeoutMs: 30_000});
      const probe = await readProbe(page);
      expect(probe.samples, `the probe ran (${probe.samples} samples, ${probe.ticks} ticks)`).toBeGreaterThan(20);
      expect(probe.overlap, 'the Parliament\'s step never stood over the colony stage').toEqual([]);
      expect(probe.receiptAt, 'the grid stood as the receipt after the step').toBeDefined();
      expect(probe.degraded, 'the cube\'s flight was never degraded').toBe(false);
      expect(probe.proxyMax, 'ONE cube proxy').toBe(1);
      expect(probe.crumbMisses, 'the crumb never lost its root or the card').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(own.pageErrors, 'no page error').toEqual([]);
      expect(own.overflow, 'no [console-overflow]').toEqual([]);
    });
  });
}
