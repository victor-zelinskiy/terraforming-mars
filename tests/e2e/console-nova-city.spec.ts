import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, pressUntil, settle} from './consoleStart';
import {openColoniesSection} from './cardTradeDoor';

/**
 * TR22 «НОВА-СИТИ» — A CITY LAID ON A COLONY TILE, the staged colony door's
 * third mode (docs/TURMOIL_REDUX_NOVA_CITY.md).
 *
 * A card that places a city ON A COLONY TILE by being PLAYED. The contract
 * under test, end to end against a real server, on two profiles, with THREE
 * clients: blue plays the card; red watches the colony grid; red (a second
 * tab) stands on the Mars board.
 *
 *   1. The composer: the door's verb, the named next step, the VP projection
 *      «+4» with its formula, Pets in «Сработает». «Выбрать колонию» sends
 *      NOTHING (the server's change counter stands, the card is in hand).
 *   2. ONE flow: on every sample the crumb keeps its root and the card's name;
 *      the grid stands inside the hand with the city's GHOST on every tile; no
 *      tile's box moved by the door; no name is cut. B walks back to the
 *      composer with the same payment; in again.
 *   3. A on Luna → the stage `city`: the seat in its projection, «1 → 2», the
 *      card's VP 4 — still nothing sent. X reads the dossier and A comes back;
 *      B folds to the grid with Luna in focus.
 *   4. A «Разыграть карту» is the play's ONE POST, its tail ADDRESSED.
 *   5. THE LANDING: one proxy, born invisible, descending monotonically onto
 *      its seat; the real tile is not painted before the contact; the seat
 *      answers once; the cube lands after the tile; the count flips and the
 *      commit's counters tick only after the contact; never a frame with two
 *      tiles or with none after the contact; nothing was degraded.
 *   6. HOME and the receipt: the city stands on Luna's tile; no other tile's
 *      box moved; the seat overlaps neither the name's ink nor the fleet.
 *   7. The server agrees: blue's city on the hosted cell with the card, the
 *      link on Luna, 18 M€ paid, the card scores 4, Pets got its animal.
 *   8. Red on the colony grid sees ONE landing at the tile's scale; red on the
 *      Mars board sees nothing fly and holds nothing.
 *   9. The flow ENDS ON THE BOARD: no workspace, nothing stranded, no
 *      overflow, no page error.
 *
 * Fixture `nova-city` (tests/e2e/fixtures/generate.ts): blue's action phase,
 * the card in hand, 30 M€, Unity's access by two delegates; «Ganymede Colony»
 * stands (one space city) and Pets is on the table; Luna — blue's colony and
 * RED's FLEET; Ceres — three colonies; Titan inactive; Europa and Io plain.
 */

const CARD = 'Nova City';
const CARD_RU = 'Нова-Сити';
const ROOT_RU = 'Карты в руке';
const HOSTED_CELL = '79';
const TILES = ['Luna', 'Ceres', 'Titan', 'Europa', 'Io'] as const;
const OUT = path.resolve('screenshots', 'nova-city');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {
    color: string, megacredits: number,
    tableau: Array<{name: string, resources?: number}>,
    victoryPointsBreakdown?: {detailsCards?: Array<{cardName: string, victoryPoint: number}>},
  };
  game: {
    gameAge: number,
    colonies: Array<{name: string, visitor?: string, colonies: Array<string>, tiles?: Array<{spaceId: string, tileType: number, color: string, card?: string}>}>,
    spaces: Array<{id: string, tileType?: number, color?: string}>,
  };
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

const lunaOf = (wire: Wire) => wire.game.colonies.find((c) => c.name === 'Luna');
const petsOf = (wire: Wire) => wire.thisPlayer.tableau.find((c) => c.name === 'Pets')?.resources ?? 0;
const cardScoreOf = (wire: Wire) => wire.thisPlayer.victoryPointsBreakdown?.detailsCards?.find((d) => d.cardName === CARD)?.victoryPoint;

type Box = {x: number, y: number, w: number, h: number};
type Probe = {
  samples: number;
  ticks: number;
  // ── the flow (own client) ──
  steps: Array<string>;
  /** The tail as it stood on the LAST sample with one settled step on the crumb (a crossfade holds two). */
  tail: string;
  crumbMisses: Array<string>;
  coloniesOutsideHand: boolean;
  coloniesMax: number;
  wsMax: number;
  stranded: boolean;
  degraded: Array<string>;
  // ── the landing ──
  /** Tile proxies on screen at once (the layer's own, and any tile-placement hero of the Mars board). */
  proxyMax: number;
  boardProxyMax: number;
  /** The first sample the proxy was in the DOM: whether anything of it was visible. */
  born?: {at: number, visible: boolean};
  /** The proxy's centre on every sample its ink was visible: [ms, x, y, on a tick]. */
  track: Array<[number, number, number, boolean]>;
  /** The seat the proxy lands on (its box at the first sample of the scene) and the scene's scale. */
  seat?: Box;
  scale: Array<string>;
  beats: Array<string>;
  /** Luna's seat pose, on every change (the stage's seat while a stage stands, else the grid's): [ms, pose]. */
  poses: Array<[number, string]>;
  /** The first sample Luna's seat painted its REAL tile; the first with its real cube. */
  tileAt?: number;
  cubeAt?: number;
  /** Rising edges of the seat's one-shot answer. */
  landed: Array<number>;
  /** The cube's proxy: first and last sample seen. */
  cubeProxy: {first?: number, last?: number};
  /** The stage's count, on every change of its text: [ms, text]; and the moment it was marked counted. */
  count: Array<[number, string]>;
  countedAt?: number;
  /** The HUD's M€, on every change: [ms, text]. */
  money: Array<[number, string]>;
  /** TICK samples only: two tiles apart (the proxy off its seat while the seat paints the tile), or none past the contact. */
  twoTiles: Array<string>;
  noTile: Array<string>;
  /** EVERY sample past the contact: the proxy stood OFF its seat (a piece that has touched does not hang in the air). */
  offSeat: Array<string>;
  /** The grid as a receipt: first sample. */
  receiptAt?: number;
  /** After the grid first stood as a receipt: a projected seat or the pick's own rail came BACK (must stay empty). */
  afterReceipt: Array<string>;
  /** The tiles' status lines standing on a visible grid — [fewest, most] over every sample: a watcher's must not blink. */
  status: [number, number];
};

/**
 * MutationObserver + setInterval — never rAF (headless drives rAF off the
 * compositor: it stops when the screen is quiet). `own` — the player's flow
 * (crumb, hand); a watcher's probe skips those.
 */
async function armProbe(page: Page, own: boolean): Promise<void> {
  await page.evaluate(({card, root, own}) => {
    const w = window as unknown as {__tr22: Probe};
    const p: Probe = {
      samples: 0, ticks: 0, steps: [], tail: '', crumbMisses: [], coloniesOutsideHand: false, coloniesMax: 0, wsMax: 0, stranded: false,
      degraded: [], proxyMax: 0, boardProxyMax: 0, track: [], scale: [], beats: [], poses: [], landed: [], cubeProxy: {},
      count: [], money: [], twoTiles: [], noTile: [], afterReceipt: [], status: [Infinity, 0], offSeat: [],
    };
    w.__tr22 = p;
    const t0 = Date.now();
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const shown = (el: HTMLElement) => {
      let opacity = 1;
      for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        opacity *= Number(cs.opacity);
      }
      return opacity;
    };
    /** Luna's seat as the player sees it: the stage's while a stage stands, else the dossier's, else the grid's. */
    const lunaSeat = () => {
      for (const host of ['.con-colfocus', '.con-colinspect', '.con-colonies__grid']) {
        const el = document.querySelector<HTMLElement>(`${host} [data-colony-city-seat="Luna"]`);
        if (el !== null && el.getBoundingClientRect().width > 3 && shown(el) > 0) {
          return el;
        }
      }
      return null;
    };
    let wasLanded = false;
    let contactAt: number | undefined;
    const sample = (tick: boolean) => {
      const now = Date.now() - t0;
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      if (own) {
        const head = document.querySelector('.con-hand')?.querySelector('.con-wshead') ?? null;
        if (head !== null) {
          const rootText = text(head.querySelector('.con-wshead__root'));
          const subjects = Array.from(head.querySelectorAll('.con-wshead__subject')).map(text);
          if ((rootText.toLowerCase() !== root.toLowerCase() || !subjects.some((s) => s.toLowerCase() === card.toLowerCase())) && p.crumbMisses.length < 8) {
            p.crumbMisses.push(`${now}ms root=«${rootText}» subject=«${subjects.join('|')}»`);
          }
          const standing = Array.from(head.querySelectorAll('.con-wshead__step')).map(text).filter((step) => step !== '');
          for (const step of standing) {
            if (!p.steps.includes(step)) {
              p.steps.push(step);
            }
          }
          if (standing.length === 1) {
            p.tail = standing[0];
          }
        }
        const colonies = document.querySelectorAll('.con-colonies');
        p.coloniesMax = Math.max(p.coloniesMax, colonies.length);
        colonies.forEach((el) => {
          if (el.closest('.con-hand') === null || el.classList.contains('con-ws')) {
            p.coloniesOutsideHand = true;
          }
        });
        p.wsMax = Math.max(p.wsMax, document.querySelectorAll('.con-ws').length);
      }
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      const section = document.querySelector('.con-colonies');
      const degraded = section?.getAttribute('data-colony-city-degraded');
      if (degraded !== null && degraded !== undefined && !p.degraded.includes(degraded)) {
        p.degraded.push(degraded);
      }
      if (section?.querySelector('[data-colony-city-receipt]') !== null && section !== null && p.receiptAt === undefined) {
        p.receiptAt = now;
      }
      if (p.receiptAt !== undefined && section !== null && section !== undefined && p.afterReceipt.length < 6) {
        const ghosts = section.querySelectorAll('[data-colony-city-pose="projected"]').length;
        const rail = section.querySelector('[data-colonies-rail-city]') !== null;
        if (ghosts > 0 || rail) {
          p.afterReceipt.push(`${now}ms ghosts=${ghosts} pickRail=${rail}`);
        }
      }
      const gridEl = document.querySelector<HTMLElement>('.con-colonies__grid');
      if (gridEl !== null && gridEl.getBoundingClientRect().width > 10 && shown(gridEl) > 0.9) {
        const lines = Array.from(gridEl.querySelectorAll('.con-coltile__status')).filter((el) => text(el) !== '').length;
        p.status = [Math.min(p.status[0], lines), Math.max(p.status[1], lines)];
      }
      // ── the stage of the scene ──
      const fx = document.querySelector<HTMLElement>('.con-colcityfx');
      const beat = fx?.getAttribute('data-colony-city-beat') ?? '';
      if (beat !== '' && p.beats[p.beats.length - 1] !== beat) {
        p.beats.push(beat);
      }
      const scale = fx?.getAttribute('data-colony-city-scale') ?? '';
      if (scale !== '' && !p.scale.includes(scale)) {
        p.scale.push(scale);
      }
      const proxies = document.querySelectorAll<HTMLElement>('[data-colony-city-proxy]');
      p.proxyMax = Math.max(p.proxyMax, proxies.length);
      p.boardProxyMax = Math.max(p.boardProxyMax, document.querySelectorAll('.con-tileplace .con-tileplace__tile').length);
      const seat = lunaSeat();
      const pose = seat?.getAttribute('data-colony-city-pose') ?? '';
      if (pose !== '' && p.poses[p.poses.length - 1]?.[1] !== pose) {
        p.poses.push([now, pose]);
      }
      const tilePainted = seat !== null && pose === 'seated' && seat.querySelector('[data-colony-city-tile]') !== null;
      if (tilePainted && p.tileAt === undefined) {
        p.tileAt = now;
      }
      if (seat !== null && seat.querySelector('[data-colony-city-cube] .player-cube') !== null && p.cubeAt === undefined) {
        p.cubeAt = now;
      }
      const landed = seat !== null && seat.classList.contains('con-colcity--landed');
      if (landed && !wasLanded) {
        p.landed.push(now);
        contactAt = contactAt ?? now;
      }
      wasLanded = landed;
      let proxyInk: {x: number, y: number} | undefined;
      const proxy = proxies[0];
      if (proxy !== undefined) {
        const art = proxy.querySelector<HTMLElement>('.con-tileplace__art');
        const edge = proxy.querySelector<HTMLElement>('.con-tileplace__edge');
        const ink = Math.max(art === null ? 0 : shown(art), edge === null ? 0 : shown(edge));
        if (p.born === undefined) {
          p.born = {at: now, visible: ink > 0.02};
          if (seat !== null) {
            const r = seat.getBoundingClientRect();
            p.seat = {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
          }
        }
        if (ink > 0.02) {
          const r = proxy.getBoundingClientRect();
          proxyInk = {x: r.left + r.width / 2, y: r.top + r.height / 2};
          p.track.push([now, Math.round(proxyInk.x * 10) / 10, Math.round(proxyInk.y * 10) / 10, tick]);
        }
      }
      if (document.querySelector('[data-colony-city-cube-proxy]') !== null) {
        p.cubeProxy.first = p.cubeProxy.first ?? now;
        p.cubeProxy.last = now;
      }
      // Past the contact the piece is ON its seat — on every sample, the observer's included (a state, not a frame).
      if (contactAt !== undefined && proxyInk !== undefined && p.seat !== undefined && p.offSeat.length < 6 &&
          Math.hypot(proxyInk.x - p.seat.x, proxyInk.y - p.seat.y) > Math.max(6, p.seat.h * 0.1)) {
        p.offSeat.push(`${now}ms (+${now - contactAt}) proxy ${Math.round(proxyInk.x)},${Math.round(proxyInk.y)} · seat ${Math.round(p.seat.x)},${Math.round(p.seat.y)}`);
      }
      // FRAME claims — only on the sampler's own ticks.
      if (tick && p.seat !== undefined) {
        if (proxyInk !== undefined && tilePainted && Math.hypot(proxyInk.x - p.seat.x, proxyInk.y - p.seat.y) > Math.max(3, p.seat.h * 0.08) && p.twoTiles.length < 6) {
          p.twoTiles.push(`${now}ms proxy at ${Math.round(proxyInk.x)},${Math.round(proxyInk.y)} while the seat paints its tile`);
        }
        if (contactAt !== undefined && proxyInk === undefined && !tilePainted && seat !== null && p.noTile.length < 6) {
          p.noTile.push(`${now}ms no proxy and no tile on the seat (pose ${pose})`);
        }
      }
      // ── the readings ──
      const fact = document.querySelector('.con-colfocus [data-city-fact="cities"]');
      if (fact !== null) {
        const value = text(fact.querySelector('.con-colfocus__cityfact-value'));
        if (value !== '' && p.count[p.count.length - 1]?.[1] !== value) {
          p.count.push([now, value]);
        }
        if (fact.hasAttribute('data-city-counted') && p.countedAt === undefined) {
          p.countedAt = now;
        }
      }
      const digits = document.querySelector('.con-res__row .resource_icon--megacredits')?.closest('.con-res__row')?.querySelector('.con-res__digits');
      const money = (digits?.childNodes[0]?.textContent ?? '').trim();
      if (money !== '' && p.money[p.money.length - 1]?.[1] !== money) {
        p.money.push([now, money]);
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 16);
  }, {card: CARD_RU, root: ROOT_RU, own});
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr22: Probe}).__tr22);

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
const stage = '.con-hand .con-colfocus[data-colony-intent="city"]';
const tile = (scope: string, name: string) => `${scope} [data-test="con-colony-${name}"]`;
const seat = (scope: string, name: string) => `${scope} [data-colony-city-seat="${name}"]`;
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__slot--focused [data-test^="con-colony-"]')?.getAttribute('data-test')?.replace('con-colony-', '') ?? '');

/**
 * Every tile's LAYOUT box and whether its name is cut — SETTLED: equal reads 100 ms apart (timers, never rAF).
 * The box is the slot's layout position and the tile's layout size (`offset*`), never a painted rect: the focused
 * tile is LIFTED by a transform, and a rect read mid-lift said «the box moved» about a tile that never left its slot
 * (measured: 3 of 4 on a loaded 4K run, with the layout identical in every one).
 */
const tilesOf = (page: Page, scope: string) => page.evaluate(async ({scope, names}) => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  const read = () => names.map((name) => {
    const el = document.querySelector<HTMLElement>(`${scope} [data-test="con-colony-${name}"]`);
    const slot = el?.closest<HTMLElement>('.con-colonies__slot') ?? el;
    const label = el?.querySelector<HTMLElement>('.con-coltile__name');
    return {
      name,
      box: el === null || el === undefined || slot === null || slot === undefined ? '' :
        [slot.offsetLeft, slot.offsetTop, el.offsetWidth, el.offsetHeight].join(','),
      cut: label === null || label === undefined ? null : label.scrollWidth > label.clientWidth + 1,
      pose: el?.querySelector('[data-colony-city-seat]')?.getAttribute('data-colony-city-pose') ?? '',
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

/**
 * How much of the seat's box lies over the name's INK and over the fleet (its ship and its ring — the planet's berth)
 * on Luna's grid tile: areas in px², each 0 when the seat keeps clear.
 */
const lunaClearance = (page: Page, scope: string) => page.evaluate((scope) => {
  const root = document.querySelector<HTMLElement>(`${scope} [data-test="con-colony-Luna"]`);
  const seatEl = root?.querySelector<HTMLElement>('[data-colony-city-seat]');
  const name = root?.querySelector<HTMLElement>('.con-coltile__name');
  const berth = root?.querySelector<HTMLElement>('.con-coltile__planet-berth');
  if (root === null || root === undefined || seatEl === null || seatEl === undefined || name === null || name === undefined) {
    return undefined;
  }
  const s = seatEl.getBoundingClientRect();
  const overlap = (r: DOMRect | undefined) => r === undefined ? 0 :
    Math.max(0, Math.min(s.right, r.right) - Math.max(s.left, r.left)) * Math.max(0, Math.min(s.bottom, r.bottom) - Math.max(s.top, r.top));
  // The name's INK — the text's own range, not its (flex-grown) box.
  const range = document.createRange();
  range.selectNodeContents(name);
  return {
    name: Math.round(overlap(range.getBoundingClientRect())),
    fleet: Math.round(overlap(berth?.getBoundingClientRect())),
    seat: [s.left, s.top, s.width, s.height].map(Math.round),
  };
}, scope);

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

/** A on the focused tile → its `city` stage (the press verified by the stage itself). */
async function descend(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3 && await page.locator(stage).count() === 0; attempt++) {
    await press(page, 'Enter', 400);
    await page.locator(stage).waitFor({timeout: 4_000}).catch(() => undefined);
  }
  await page.locator(stage).waitFor({timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

for (const preset of PRESETS) {
  test.describe(`TR22 Nova City · a city on a colony tile · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать колонию» → the ghosts → B → back → Luna's stage → A → the city LANDS → home → the board; red watches the grid and the board (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(540_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<{url: string, body: string}> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });

      const {playerId, seats} = await bootFixtureSeats(page, request, 'nova-city', {query: preset.query});
      const red = seats[1];
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect(before.game.spaces.find((s) => s.id === HOSTED_CELL)?.tileType, 'the fixture: the hosted cell is empty').toBeUndefined();
      expect(lunaOf(before)?.tiles ?? [], 'the fixture: nothing lies on Luna').toEqual([]);
      expect(lunaOf(before)?.visitor, 'the fixture: red\'s fleet stands on Luna').toBeDefined();
      expect(before.thisPlayer.megacredits).toBe(30);
      const petsBefore = petsOf(before);

      // ── THE WATCHERS: red on the colony grid, and red (a second tab) on the Mars board ──
      const redErrors: Array<string> = [];
      // Red is still inside its START workspace (its corporation's first action waits for blue's turn) — «Свернуть»
      // puts red ON the board, where the wheel is its own.
      const openRed = async (): Promise<Page> => {
        const tab = await context.newPage();
        tab.on('pageerror', (e) => redErrors.push(e.message));
        await openConsole(tab, red, preset.query);
        await settle(tab, {timeoutMs: 30_000});
        const onBoard = () => tab.evaluate(() => {
          const start = document.querySelector<HTMLElement>('.con-start__frame');
          const board = document.querySelector<HTMLElement>('.con-board');
          return (start === null || start.offsetParent === null) && board !== null && board.offsetParent !== null;
        });
        expect(await pressUntil(tab, 'Escape', onBoard, {tries: 4, settleMs: 1200}), 'red minimizes its start workspace and stands on the board').toBe(true);
        await settle(tab, {timeoutMs: 20_000});
        return tab;
      };
      const redGrid = await openRed();
      await openColoniesSection(redGrid);
      await settle(redGrid, {timeoutMs: 20_000});
      const redBoard = await openRed();
      expect(await redBoard.locator('.con-colonies').count(), 'red\'s second tab stands on the board').toBe(0);
      await page.bringToFront();

      // ── 1. the composer: the door's verb, the named step, the VP projection, the trigger ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать колонию');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Город на плитке колонии — выбор в «Колониях»');
      const vpRow = page.locator(`${composer} .con-composer__rescat--vpformula`);
      await expect(vpRow, 'the VP projection: «+4 сейчас»').toContainText('+4');
      await expect(vpRow.locator('[data-vp-formula]'), 'its formula: two space cities, two VP each').toContainText(/2\s*×\s*2/);
      await expect(vpRow.locator('[data-vp-glyph]'), 'the counted object is drawn — a space city').toHaveCount(1);
      // «⚡ СРАБОТАЕТ»: the city answers Pets AFTER the tile is laid — a DEFERRED fact, and the forecast's law keeps
      // those out of the compact row (it holds only what the press itself pays): the R3 layer names it, under «Later».
      const fxLayer = page.locator(`${composer} .con-composer__fxlayer`);
      expect(await pressUntil(page, 'KeyV', async () => await fxLayer.count() > 0, {tries: 3, settleMs: 1100}),
        'R3 opens the «Эффекты» layer — the play has something to trigger').toBeTruthy();
      await expect(fxLayer.locator('[data-forecast-group="later"]'), 'the trigger of the placement stands in «Later»').toHaveCount(1);
      await expect(fxLayer, 'Pets is named: the city on a colony tile is a city placed').toContainText('Домашние любимцы');
      await shoot(page, preset.id, '01b-effects-layer');
      expect(await pressUntil(page, 'KeyV', async () => await fxLayer.count() === 0, {tries: 3, settleMs: 1100}), 'R3 closes the layer').toBeTruthy();
      await settle(page);
      const paymentBefore = await textOf(page, `${composer} .con-paystatus`);
      expect(paymentBefore, 'the payment line states the price').toContain('18');
      await shoot(page, preset.id, '01-composer');

      // The grid as it stands with NO door: the boxes a door may not move.
      const restBoxes = await tilesOf(redGrid, '.con-colonies');
      await page.bringToFront();

      await armProbe(page, true);

      // ── 1b. «Выбрать колонию»: nothing is sent ──
      await chooseColony(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 2. the grid: the city's ghost on EVERY tile, no box moved, no name cut ──
      const doorTiles = await tilesOf(page, grid);
      expect(doorTiles.map((t) => t.pose), 'the seat stands in its projection on every tile — the inactive one too').toEqual(TILES.map(() => 'projected'));
      expect(doorTiles.filter((t) => t.cut !== false).map((t) => t.name), 'no colony name is cut by the seat').toEqual([]);
      for (const name of TILES) {
        await expect(page.locator(`${seat(grid, name)} .con-colcity__ghost-cube`), `${name}: the ghost cube wears the player's colour`)
          .toHaveClass(new RegExp(`player_translucent_bg_color_${viewer}`));
        await expect(page.locator(`${tile(grid, name)} .con-coltile__status--blocked`), `${name}: a candidate carries no refusal`).toHaveCount(0);
      }
      const doorSizes = doorTiles.map((t) => t.box.split(',').slice(2).join('×'));
      expect(new Set(doorSizes).size, `every tile keeps ONE box under the door (${doorSizes.join(' | ')})`).toBe(1);
      expect(restBoxes.map((t) => t.pose), 'with no door the seats are empty (red\'s grid)').toEqual(TILES.map(() => 'empty'));
      expect(await focusedTile(page), 'the cursor stands on the first candidate (A only descends)').toBe('Luna');
      await expect(page.locator(`${grid} [data-colonies-rail-city-count]`), 'the rail: «Космические города 1 → 2»').toContainText(/1\s*→\s*2/);
      await expect(page.locator(`${grid} [data-colonies-rail-city-vp]`), 'the rail: «ПО +4»').toContainText('+4');
      const walkBefore = await tilesOf(page, grid);
      await walkTo(page, 'Titan');
      await expect(page.locator(`${grid} [data-colonies-rail-city]`), 'an inactive tile is a lawful place — the rail reads the same act').toHaveCount(1);
      await walkTo(page, 'Luna');
      expect((await tilesOf(page, grid)).map((t) => t.box), 'walking the grid moved no box').toEqual(walkBefore.map((t) => t.box));
      expect(posts, 'walking the grid sends nothing').toEqual([]);
      await shoot(page, preset.id, '02-grid-ghosts');

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
      expect(posts).toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'the round trip left no trace').toBe(before.game.gameAge);

      // ── 3. in again; A on Luna descends to its `city` stage ──
      await chooseColony(page);
      await walkTo(page, 'Luna');
      await descend(page);
      await expect(page.locator(seat(stage, 'Luna')), 'the stage: the seat in its projection').toHaveAttribute('data-colony-city-pose', 'projected');
      await expect(page.locator(`${stage} [data-city-fact="city"]`), 'the city and whose it is').toContainText(CARD_RU);
      await expect(page.locator(`${stage} [data-city-fact="cities"]`), 'the count: «1 → 2»').toContainText(/1\s*→\s*2/);
      await expect(page.locator(`${stage} [data-city-vp]`), 'the card\'s VP').toHaveText('4');
      await expect(page.locator(`${stage} [data-city-note]`), 'one calm line: nothing about the trade changes').toContainText('Причал колонии не занимает');
      await expect(page.locator(`${stage} [data-colony-track-offset]`), 'no track projection: the city does not touch the track').toHaveCount(0);
      await expect(page.locator(`${stage} .con-colfocus__xcell--effective`), '…and no ghost cell: a trade\'s standing offset is not projected into this act').toHaveCount(0);
      expect(posts, 'the descent sends nothing').toEqual([]);
      await shoot(page, preset.id, '03-stage-city');

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
      await expect(page.locator(seat(grid, 'Luna')), 'the ghost stands on the tile again').toHaveAttribute('data-colony-city-pose', 'projected');
      expect(posts, 'the whole ladder sent nothing').toEqual([]);
      await descend(page);

      // ── 4. A «Разыграть карту» — ONE POST, addressed to the card ──
      await armProbe(redGrid, false);
      await armProbe(redBoard, false);
      const stopOwnStory = await storyboard(page, preset.id, 'own');
      const stopRedStory = await storyboard(redGrid, preset.id, 'watcher');
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail is the colony tile, ADDRESSED to the card')
        .toMatchObject({type: 'colony', colonyName: 'Luna', stagedFor: CARD});

      // ── 7. the server ──
      await expect.poll(async () => lunaOf(await wireOf(request, playerId))?.tiles?.length ?? 0,
        {timeout: 30_000, message: 'the city never reached Luna on the server'}).toBe(1);
      const after = await wireOf(request, playerId);
      expect(lunaOf(after)?.tiles?.[0], 'the link: the hosted cell, blue\'s city, the card').toMatchObject({spaceId: HOSTED_CELL, color: viewer, card: CARD});
      expect(after.game.spaces.find((s) => s.id === HOSTED_CELL), 'the cell carries blue\'s tile').toMatchObject({color: viewer});
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.thisPlayer.megacredits, 'the card cost 18 M€').toBe(before.thisPlayer.megacredits - 18);
      expect(petsOf(after), 'Pets answered the city with an animal').toBe(petsBefore + 1);
      expect(cardScoreOf(after), 'the card scores 2 VP for each of two space cities').toBe(4);
      expect(lunaOf(after)?.colonies, 'the city took no colony berth').toEqual(lunaOf(before)?.colonies);
      expect(lunaOf(after)?.visitor, 'red\'s fleet stands where it stood').toBe(lunaOf(before)?.visitor);

      // ── 5. THE LANDING (own) ──
      await expect.poll(async () => (await readProbe(page)).cubeAt, {timeout: 30_000, message: 'the cube never stood on the city'}).toBeDefined();
      await shoot(page, preset.id, '05-landed');

      // ── 9. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        colonies: document.querySelectorAll('.con-colonies').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, colonies: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await stopOwnStory();
      await expect(page.locator(composer), 'the composer never comes back past the commit').toHaveCount(0);
      expect(posts.length, 'and nothing else was sent').toBe(1);
      await shoot(page, preset.id, '09-board');

      const own = await readProbe(page);
      const dump = JSON.stringify({
        steps: own.steps, tail: own.tail, beats: own.beats, poses: own.poses, born: own.born, landed: own.landed, tileAt: own.tileAt, cubeAt: own.cubeAt,
        cubeProxy: own.cubeProxy, count: own.count, countedAt: own.countedAt, money: own.money, receiptAt: own.receiptAt,
        track: own.track.length, ticks: own.ticks,
      });
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/nova-city-${preset.id}.json`, JSON.stringify(own, null, 1));
      expect(own.ticks, `the probe's sampler ran (${own.samples} samples)`).toBeGreaterThan(40);

      // ── 2. one flow ──
      expect(own.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(own.steps[0], `the tail starts at the composer (${dump})`).toBe('Розыгрыш');
      expect(own.steps, `the tail moves through the colony selection (${dump})`).toContain('Выбор колонии');
      expect(own.steps, `…names the tile's stage (${dump})`).toContain('Луна · Город');
      expect(own.tail, `…and ENDS on it — the receipt keeps the tile and the act (${dump})`).toBe('Луна · Город');
      expect(own.steps, `the descent never reads «ЛУНА · ВЫБОР КОЛОНИИ» on its way (${dump})`).not.toContain('Луна · Выбор колонии');
      expect(own.steps, `the tail never loses its tile to a bare «ГОРОД» (${dump})`).not.toContain('Город');
      expect(own.coloniesOutsideHand, 'the colonies stood inside the hand, never as a band of their own').toBe(false);
      expect(own.coloniesMax, 'ONE colonies instance').toBe(1);
      expect(own.wsMax, 'never a second workspace band').toBeLessThanOrEqual(1);

      // ── 5. the scene, in ORDER ──
      const assertLanding = (probe: Probe, who: string, scale: 'stage' | 'tile') => {
        const d = JSON.stringify({beats: probe.beats, poses: probe.poses, born: probe.born, landed: probe.landed, tileAt: probe.tileAt, cubeAt: probe.cubeAt, cubeProxy: probe.cubeProxy, track: probe.track.length, seat: probe.seat});
        expect(probe.degraded, `${who}: the landing never confessed a degrade (${d})`).toEqual([]);
        expect(probe.scale, `${who}: the scene played at the ${scale}'s scale (${d})`).toEqual([scale]);
        expect(probe.proxyMax, `${who}: ONE tile proxy (${d})`).toBe(1);
        expect(probe.boardProxyMax, `${who}: no tile flew on the Mars board`).toBe(0);
        expect(probe.born?.visible, `${who}: the proxy is born INVISIBLE (${d})`).toBe(false);
        expect(probe.seat, `${who}: the seat stood on screen when the proxy was born`).toBeDefined();
        expect(probe.track.length, `${who}: the proxy was seen (${d})`).toBeGreaterThan(2);
        // ① the source is the seat's own air: the piece appears ABOVE its seat, on its axis.
        const [, x0, y0] = probe.track[0];
        expect(Math.abs(x0 - probe.seat!.x), `${who}: the piece appears on its seat's axis`).toBeLessThan(probe.seat!.w * 0.2);
        expect(probe.seat!.y - y0, `${who}: …a lift above it (first ${y0}, seat ${probe.seat!.y})`).toBeGreaterThan(probe.seat!.h * 0.3);
        // ② the destination: the last visible pose is ON the seat.
        const [, x1, y1] = probe.track[probe.track.length - 1];
        expect(Math.hypot(x1 - probe.seat!.x, y1 - probe.seat!.y), `${who}: the piece ends on its seat (${d})`).toBeLessThan(Math.max(3, probe.seat!.h * 0.08));
        // ③ movement happened, one way: the centre only ever goes DOWN (the settle's own 1–2 px aside).
        let reach = -Infinity;
        let back = 0;
        const seen = new Set<number>();
        for (const [,, y] of probe.track) {
          back = Math.max(back, reach - y);
          reach = Math.max(reach, y);
          seen.add(Math.round(y));
        }
        expect(back, `${who}: the piece rose by ${back.toFixed(1)}px on its way down`).toBeLessThan(Math.max(3, probe.seat!.h * 0.06));
        // The player's own page is the front tab: the fall is seen ON THE WAY (the source, a pose between, the seat).
        // A watcher's page is a BACKGROUND tab of a loaded 4K run — its compositor may paint the ~260 ms fall in two
        // frames (measured: 1 of 8, «430 → 558»); there the claim is the two ends, already pinned above — the source
        // above the seat, the destination on it, never a way back. A frame COUNT is not a fact about the product.
        expect(seen.size, `${who}: the piece was seen in motion (${[...seen].join(' → ')})`).toBeGreaterThan(scale === 'stage' ? 2 : 1);
        // The real tile is not painted before the contact; the seat answers ONCE; the cube comes after the tile.
        expect(probe.landed.length, `${who}: the seat answered exactly once (${d})`).toBe(1);
        expect(probe.tileAt, `${who}: the real tile was painted (${d})`).toBeDefined();
        expect(probe.tileAt!, `${who}: the real tile is not painted before the contact (${d})`).toBeGreaterThanOrEqual(probe.landed[0]);
        expect(probe.poses.map(([, pose]) => pose).filter((pose) => pose === 'waiting' || pose === 'seated').slice(0, 2),
          `${who}: the seat WAITS, then is SEATED (${d})`).toEqual(['waiting', 'seated']);
        expect(probe.cubeAt, `${who}: the cube stood (${d})`).toBeDefined();
        expect(probe.cubeAt!, `${who}: the cube lands AFTER the tile (${d})`).toBeGreaterThan(probe.tileAt!);
        expect(probe.cubeProxy.first, `${who}: the cube flew (${d})`).toBeDefined();
        expect(probe.cubeProxy.first!, `${who}: …after the tile's contact (${d})`).toBeGreaterThanOrEqual(probe.landed[0]);
        expect(probe.offSeat, `${who}: past the contact the piece never hangs off its seat`).toEqual([]);
        expect(probe.twoTiles, `${who}: a frame with TWO tiles`).toEqual([]);
        expect(probe.noTile, `${who}: a frame with NO tile after the contact`).toEqual([]);
        expect(probe.stranded, `${who}: nothing stranded`).toBe(false);
      };
      assertLanding(own, 'own', 'stage');
      expect(own.beats, `the player's own landing plays every beat in order (${dump})`).toEqual(['handover', 'materialize', 'weight', 'land', 'cube', 'read']);
      // THE COUNT flips on the cube's touchdown, and every counter of the commit ticks after the contact.
      expect(own.countedAt, `the rail's count was marked (${dump})`).toBeDefined();
      expect(own.countedAt!, `…only after the contact (${dump})`).toBeGreaterThanOrEqual(own.landed[0]);
      expect(own.count[0][1], `before that the rail read «1 → 2» (${dump})`).toMatch(/1\s*→\s*2/);
      // (`ConsoleFlipValue` holds both faces for its turn — «1» going, «2» coming; the projection's arrow is gone.)
      expect(own.count[own.count.length - 1][1], `…and «2», with no projection, after (${dump})`).toMatch(/^1?2$/);
      expect(own.money[0][1], `the HUD read 30 M€ (${dump})`).toBe('30');
      expect(own.money[own.money.length - 1][1], `…and 12 after the play (${dump})`).toBe('12');
      expect(own.money[1][0], `the price ticks only after the contact — the commit applies in its frame (${dump})`).toBeGreaterThanOrEqual(own.landed[0]);
      // HOME: the grid stood as a receipt after the scene.
      expect(own.receiptAt, `the grid stood as a receipt (${dump})`).toBeDefined();
      expect(own.receiptAt!, `…after the cube (${dump})`).toBeGreaterThan(own.cubeAt!);
      // The staged door's prompt OUTLIVES its answer (the section rides the hand's dissolve with the pick latched):
      // neither a ghost nor the pick's rail may come back for those last frames.
      expect(own.afterReceipt, 'past the receipt no ghost and no «встанет на плитку» rail ever returns').toEqual([]);
      test.info().annotations.push({
        type: 'tr22-scene',
        description: `${preset.id} own: proxy born → contact ${own.landed[0] - own.born!.at}ms · tile +${own.tileAt! - own.landed[0]}ms · cube stands +${own.cubeAt! - own.landed[0]}ms · counted +${own.countedAt! - own.landed[0]}ms · receipt +${own.receiptAt! - own.landed[0]}ms · ${own.track.length} proxy samples`,
      });

      // ── 8. RED ON THE GRID: one landing at the tile's scale ──
      await expect.poll(async () => (await readProbe(redGrid)).cubeAt, {timeout: 40_000, message: 'red never saw the city land on Luna\'s tile'}).toBeDefined();
      await settle(redGrid, {timeoutMs: 30_000});
      await stopRedStory();
      const watcher = await readProbe(redGrid);
      assertLanding(watcher, 'watcher', 'tile');
      expect(watcher.beats, 'a watcher\'s landing skips the weight and the read').toEqual(['handover', 'materialize', 'land', 'cube']);
      // ONLY WHAT IS TOUCHED ANSWERS: no tile's status line left the watcher's grid for the scene.
      expect(watcher.status[1], 'red\'s grid carries status lines (its own fleet on Luna, the inactive Titan)').toBeGreaterThan(0);
      expect(watcher.status[0], `a status line blinked during the landing (${watcher.status.join('…')})`).toBe(watcher.status[1]);
      test.info().annotations.push({
        type: 'tr22-scene',
        description: `${preset.id} watcher: proxy born → contact ${watcher.landed[0] - watcher.born!.at}ms · cube stands +${watcher.cubeAt! - watcher.landed[0]}ms · ${watcher.track.length} proxy samples`,
      });
      await shoot(redGrid, preset.id, '08-watcher-grid');

      // ── 6. the city at rest on Luna's tile (red's grid — the table every seat reads) ──
      const restAfter = await tilesOf(redGrid, '.con-colonies');
      expect(restAfter.find((t) => t.name === 'Luna')?.pose, 'the city stands on Luna\'s tile').toBe('seated');
      expect(restAfter.filter((t) => t.name !== 'Luna').map((t) => t.pose), 'no other tile carries one').toEqual(['empty', 'empty', 'empty', 'empty']);
      expect(restAfter.map((t) => t.box), 'no tile\'s box moved by the city').toEqual(restBoxes.map((t) => t.box));
      expect(restAfter.filter((t) => t.cut !== false).map((t) => t.name), 'no colony name is cut').toEqual([]);
      const clear = await lunaClearance(redGrid, '.con-colonies');
      expect(clear, 'Luna\'s seat could be measured').toBeDefined();
      expect(clear!.name, `the seat does not touch the name's ink (${JSON.stringify(clear)})`).toBe(0);
      expect(clear!.fleet, `the seat does not touch the fleet's ship or its ring (${JSON.stringify(clear)})`).toBe(0);
      await expect(redGrid.locator(`${seat('.con-colonies__grid', 'Luna')} .player-cube`), 'the owner is named by the cube').toHaveCount(1);
      await expect(redGrid.locator(seat('.con-colonies__grid', 'Luna')), 'blue\'s city').toHaveAttribute('data-colony-city-owner', viewer);

      // ── 8b. RED ON THE BOARD: nothing flies, nothing is held ──
      await settle(redBoard, {timeoutMs: 30_000});
      const board = await readProbe(redBoard);
      expect(board.ticks, 'the board probe sampled').toBeGreaterThan(40);
      expect(board.proxyMax, 'on the Mars board no city proxy is ever mounted').toBe(0);
      expect(board.boardProxyMax, '…and no tile flies onto the board').toBe(0);
      expect(board.beats, '…no scene played').toEqual([]);
      expect(await redBoard.locator(`.board-space[data_space_id="${HOSTED_CELL}"]`).count(), 'the hosted cell is not drawn on the Mars board').toBe(0);
      const ready = await redBoard.evaluate(() => {
        const probe = (window as unknown as {__conReady?: () => {holds?: Array<string>}}).__conReady;
        return typeof probe === 'function' ? probe().holds ?? [] : undefined;
      });
      expect(ready, 'the board client holds nothing after the rival\'s landing').toEqual([]);
      await shoot(redBoard, preset.id, '08b-watcher-board');

      expect(own.stranded || (await readProbe(page)).stranded, 'nothing stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
      expect(redErrors, 'no page errors for the watcher').toEqual([]);
    });
  });
}
