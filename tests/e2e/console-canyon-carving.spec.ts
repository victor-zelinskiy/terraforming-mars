import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, focusedSpaceId, openConsole, press, pressUntil, settle, walkToSpace} from './consoleStart';
import {TileType} from '../../src/common/TileType';

/**
 * TR39 «ПРОРЕЗАНИЕ КАНЬОНА» — AN OCEAN MOVES to a neighbouring cell
 * (docs/TURMOIL_REDUX_RE_SETTLEMENT.md §2.6 — the contract of a move on a tile
 * NOBODY owns, generalized from TR14's city).
 *
 * The contract under test, end to end against a real server, on two profiles
 * (a geometry claim made at one resolution is a claim about one resolution):
 *
 *   1. «Разыграть на поле» sends NOTHING: the server's change counter stands
 *      and the card is still in the hand.
 *   2. THE SOURCE LEVEL: the cursor stands on the first ocean that may move;
 *      BOTH plain oceans are offered (an ocean is nobody's); the dossier reads
 *      the SOURCE («Этот океан») and NAMES the rival's loss — red's Capital
 *      beside it loses an adjacent ocean, 1 → 0.
 *   3. A LIFTS the ocean (nothing sent): the «leaving from here» pose on it,
 *      the projection and the vector on the neighbouring cell; the dossier of
 *      the land cell reads the destination — the printed plant, +1 TR for the
 *      move, the OTHER ocean's 2 M€ (the lifted one beside it pays nothing),
 *      the Greens' answer, the Capital's loss — and NEVER the ocean counter
 *      («raises the ocean parameter» / «leaves the board» / «nobody loses
 *      TR»); the field lights exactly the cells the server named; the panel
 *      neither scrolls nor moves under the cursor.
 *   4. B walks back ONE level per press: lock → cell → source → composer (the
 *      same payment). Forward again — still nothing sent.
 *   5. The second A on the locked cell is the play's ONE POST, and its tail
 *      names BOTH cells, addressed to the card.
 *   6. THE SCENE: ONE proxy in the OCEAN's art with NO owner cube; its centre
 *      travels from the ocean's cell to the destination without turning back;
 *      never a sample with two oceans or with none; the vacated cell settles
 *      BEFORE the landing; the ocean SCALE and the HUD's «N/9» never move in
 *      any sample (the count is the same before and after); the cell's plant
 *      and the TR tick AFTER the touchdown; the Greens' M€ after the TR.
 *   7. THE OPPONENT (red, on the board) sees the same ONE move — never «a
 *      removal here, a landing there» — and is told of the play.
 *   8. The server agrees (the ocean stands on the destination, nobody's; the
 *      source is bare; the count is the same; +1 TR; 6 M€ paid, the plant,
 *      the other ocean's 2 M€ and the Greens' 2 M€ gained; the move recorded
 *      once; red's Capital scores 0) and the flow ENDS ON THE BOARD.
 *
 * `TM_E2E_STORYBOARD=1` additionally writes the scene's frames (a CDP
 * screencast of both clients) under `screenshots/canyon-carving/<profile>/story-*`
 * — the acceptance storyboard, not an assertion.
 *
 * Fixture `canyon-carving` (tests/e2e/fixtures/generate.ts — the cells below are
 * its own constants, asserted there against the engine): the ocean on 33 may
 * move to the reserve 34 or the plant land 42 (beside the other ocean, 43);
 * red's Capital stands on 24, beside 33 only.
 *
 * ⚠ THE GEOMETRY IS ALSO A GUARD (PL-130): the first legal cell of the source
 * level (33) IS the cell the board seeds its cursor on at boot (the stage's
 * centre), so the reticle's position is asked for a cell the cursor never
 * left — a computed that cached a hidden-stage measurement (the placement
 * becomes active while the hand's landing ritual still covers the board) left
 * the source level with no reticle at all. TR14's city (16) escaped it by
 * moving the cursor. Keep 33 the source.
 */

const CARD = 'Canyon Carving';
const CARD_RU = 'Прорезание каньона';
/** The ocean that moves (an ocean reserve with two plants printed). */
const X = '33';
/** The destination: plant land beside the OTHER ocean. */
const B = '42';
/** The other plain ocean — the second source, and the one neighbour of B that pays. */
const OCEAN2 = '43';
/** Red's Capital — beside X only. */
const CAPITAL = '24';

/** Screenshots (and the opt-in storyboard) — outside Playwright's own output dir, which every run wipes. */
const OUT = path.resolve('screenshots', 'canyon-carving');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {
    color: string, megacredits: number, plants: number, steel: number, terraformRating: number,
    tableau: Array<{name: string}>, victoryPointsBreakdown: {victoryPoints: number, total: number},
  };
  waitingFor?: {type?: string};
  game: {
    gameAge: number;
    oceans: number;
    spaces: Array<{id: string, tileType?: number, color?: string, stackHeight?: number}>;
    tileMoves?: Array<{seq: number, from: string, to: string, tileType: number, color: string}>;
  };
};

/** The server's own view. One retry on a dropped socket: a loaded per-worker server resets a connection now and then. */
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

const cellOf = (wire: Wire, id: string) => wire.game.spaces.find((s) => s.id === id);

type Box = {x: number, y: number, w: number, h: number};
type MoveProbe = {
  samples: number;
  /** Interval (task) samples only — the probe's own liveness floor, and the only samples a claim about FRAMES is made on. */
  ticks: number;
  a: Box;
  b: Box;
  /** The move proxy's centre on every sample it was visible. */
  track: Array<{t: number, x: number, y: number}>;
  proxyMax: number;
  /** The proxy's art classes on the first sample it was seen (the piece that travels). */
  proxyArt: Array<string>;
  /** Samples where an owner cube rode the proxy — an ocean has none. */
  cubeOnProxy: Array<string>;
  /** Any OTHER tile proxy that became visible: an arrival «from the table», a plain lift. */
  foreign: Array<string>;
  twoOceans: Array<string>;
  noOcean: Array<string>;
  firstProxyAt?: number;
  lastProxyAt?: number;
  vacatedAt?: number;
  landedAt?: number;
  sourceBareAt?: number;
  phases: Array<string>;
  /** The rail's counters on every change: [t, value]. */
  plants: Array<[number, string]>;
  tr: Array<[number, string]>;
  mc: Array<[number, string]>;
  /** The OCEAN SCALE and the HUD counter on every tick — they must never move. */
  scaleDigits: Array<string>;
  markerBoxes: Array<string>;
  hud: Array<string>;
  /**
   * The notifications the viewer was SHOWN that name the card (the opponent's «КАРТА СЫГРАНА»), recorded while the
   * probe runs: a toast that expired before a late poll was still a toast that was shown (4K: it stood 6.0–9.1 s and
   * was gone when the poll came, after the hero's whole scene + settle).
   */
  notifs: Array<string>;
  /** The response APPLIED — the real tile exists on B (the proxy may still be in the air over it). */
  appliedAt?: number;
  degraded: boolean;
  stranded: boolean;
  eaten: boolean;
};

/**
 * THE SCENE PROBE — MutationObserver + setInterval, never rAF (headless drives
 * rAF off the compositor: it stops when the screen is quiet). A claim about
 * FRAMES («two oceans», «no ocean», «the scale moved») is made on the interval
 * samples only: an observer sample runs as a microtask and legitimately sees
 * a state the browser never paints.
 */
async function armProbe(page: Page, kind: 'own' | 'remote'): Promise<void> {
  await page.evaluate(({kind, from, to, cardRu}) => {
    const w = window as unknown as {__tr39: MoveProbe};
    const rectOf = (id: string): Box => {
      const r = document.querySelector(`.board-space[data_space_id="${id}"]`)!.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
    };
    const p: MoveProbe = {
      samples: 0, ticks: 0, a: rectOf(from), b: rectOf(to), track: [], proxyMax: 0, proxyArt: [], cubeOnProxy: [], foreign: [],
      twoOceans: [], noOcean: [], phases: [], plants: [], tr: [], mc: [], scaleDigits: [], markerBoxes: [], hud: [], notifs: [],
      degraded: false, stranded: false, eaten: false,
    };
    w.__tr39 = p;
    const t0 = Date.now();
    const shown = (el: Element): boolean => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 2 && r.height > 2;
    };
    const oceanOn = (id: string): boolean =>
      document.querySelector(`.board-space[data_space_id="${id}"] > .board-space-tile--ocean:not(.board-space-tile--placement-cleared)`) !== null;
    const counter = (selector: string): string => (document.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const note = (list: Array<[number, string]>, value: string, now: number) => {
      if (value !== '' && list[list.length - 1]?.[1] !== value) {
        list.push([now, value]);
      }
    };
    const sample = (tick: boolean) => {
      p.samples++;
      const now = Date.now() - t0;
      const proxies = Array.from(document.querySelectorAll<HTMLElement>(`.con-tileplace__tile[data-tile-move="${kind}"]`)).filter(shown);
      p.proxyMax = Math.max(p.proxyMax, proxies.length);
      document.querySelectorAll<HTMLElement>('.con-tileplace__tile').forEach((el) => {
        if (el.getAttribute('data-tile-move') !== kind && shown(el)) {
          const name = el.className.replace(/\s+/g, '.');
          if (!p.foreign.includes(name)) {
            p.foreign.push(name);
          }
        }
      });
      const proxy = proxies[0];
      let centre: {x: number, y: number} | undefined;
      if (proxy !== undefined) {
        const r = proxy.getBoundingClientRect();
        centre = {x: r.left + r.width / 2, y: r.top + r.height / 2};
        p.track.push({t: now, ...centre});
        p.firstProxyAt ??= now;
        p.lastProxyAt = now;
        if (p.proxyArt.length === 0) {
          const art = proxy.querySelector('.con-tileplace__art');
          p.proxyArt = (art?.className ?? '').split(/\s+/).filter((c) => c.startsWith('board-space-tile--'));
        }
        const cube = proxy.querySelector('.player-cube, .board-owner-cube, [class*="cube"]');
        if (cube !== null && shown(cube) && p.cubeOnProxy.length < 6) {
          p.cubeOnProxy.push(`${now}ms ${cube.className}`);
        }
      }
      const oceanA = oceanOn(from);
      const oceanB = oceanOn(to);
      if (!oceanA) {
        p.sourceBareAt ??= now;
      }
      if (oceanB) {
        p.appliedAt ??= now;
        // The REMOTE stage holds the committed tile hidden until its proxy's touchdown (`remoteRevealHold` — the cell
        // reads «cleared» till then): the real ocean appearing on B IS that touchdown. The hero's own landing is its
        // scene's phase (below) — its real tile can stand in the DOM under the proxy while the proxy is still flying.
        if (kind === 'remote') {
          p.landedAt ??= now;
        }
      }
      if (document.querySelector(`.board-space[data_space_id="${from}"] > .board-space-tile--vacated`) !== null) {
        p.vacatedAt ??= now;
      }
      if (tick) {
        p.ticks++;
        const far = (c: {x: number, y: number}, box: Box) => Math.hypot(c.x - box.x, c.y - box.y) > box.w * 0.5;
        const two = (oceanA && oceanB) || (centre !== undefined && ((oceanA && far(centre, p.a)) || (oceanB && far(centre, p.b))));
        if (two && p.twoOceans.length < 6) {
          p.twoOceans.push(`${now}ms a=${oceanA} b=${oceanB} proxy=${centre === undefined ? '-' : `${Math.round(centre.x)},${Math.round(centre.y)}`}`);
        }
        if (!oceanA && !oceanB && centre === undefined && p.noOcean.length < 6) {
          p.noOcean.push(`${now}ms`);
        }
        // THE OCEAN PARAMETER stands still: its scale digit, its marker's box and the HUD's «N/9» on every tick.
        const digit = counter('.arc-scale--oceans .arc-scale__digit--current');
        if (digit !== '' && p.scaleDigits[p.scaleDigits.length - 1] !== digit) {
          p.scaleDigits.push(digit);
        }
        // The marker's place is read RELATIVE to the board's own box: the camera (Planet Focus) moves the whole board
        // after the landing, and a marker that rides with it has not moved on its scale.
        const marker = document.querySelector('.scale-marker--oceans');
        // …relative to its OWN track (the arc scale), which the camera moves together with the marker.
        const stage = document.querySelector('.arc-scale--oceans') ?? document.querySelector('.board-cont');
        if (marker !== null && stage !== null) {
          const r = marker.getBoundingClientRect();
          const h = stage.getBoundingClientRect();
          const box = h.width < 40 ? '' : `${((r.left - h.left) / h.width).toFixed(2)},${((r.top - h.top) / h.height).toFixed(2)}`;
          if (box !== '' && p.markerBoxes[p.markerBoxes.length - 1] !== box) {
            p.markerBoxes.push(box);
          }
        }
        const hud = Array.from(document.querySelectorAll('.con-status__param')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).find((t) => /\/9\b/.test(t)) ?? '';
        if (hud !== '' && p.hud[p.hud.length - 1] !== hud) {
          p.hud.push(hud);
        }
      }
      const root = document.querySelector('.con-tileplace');
      if (root !== null) {
        const phase = root.getAttribute('data-tile-phase');
        if (phase !== null && p.phases[p.phases.length - 1] !== phase) {
          p.phases.push(phase);
        }
        // LANDED is the scene's own word for the CONTACT (the real tile paints under the settled proxy): a claim about
        // the paint, never about the DOM — a tile that exists on B under a flying proxy has not landed.
        if (kind === 'own' && (phase === 'landed' || phase === 'rewarding')) {
          p.landedAt ??= now;
        }
        if (root.getAttribute('data-tile-move-degraded') !== null) {
          p.degraded = true;
        }
      }
      if (document.querySelector('.con-bmove--eaten') !== null) {
        p.eaten = true;
      }
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
      document.querySelectorAll<HTMLElement>('.con-notif').forEach((el) => {
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (shown(el) && text.includes(cardRu) && !p.notifs.includes(text) && p.notifs.length < 8) {
          p.notifs.push(text);
        }
      });
      // A rail counter's text is its VALUE followed by its live delta chips («18−4+2») — the value is the leading number.
      note(p.plants, counter('.con-res__row--plants .con-res__digits').match(/^-?\d+/)?.[0] ?? '', now);
      note(p.mc, counter('.con-res__row--megacredits .con-res__digits').match(/^-?\d+/)?.[0] ?? '', now);
      note(p.tr, counter('.con-score__value--tr'), now);
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 16);
  }, {kind, from: X, to: B, cardRu: CARD_RU});
}

const readProbe = (page: Page): Promise<MoveProbe> => page.evaluate(() => (window as unknown as {__tr39: MoveProbe}).__tr39);

const composer = '.con-composer--play';
const panel = '.con-context';
const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

/** The cells the board currently offers (the server's list at this level). */
const legalCells = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.board-space--available[data_space_id]')).map((el) => el.getAttribute('data_space_id') ?? '').sort());

/** The cells the relation layer lit for the focused cell. */
const relationCells = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.board-space.con-rel[data_space_id]')).map((el) => el.getAttribute('data_space_id') ?? '').sort());

/** The panel's outer box and whether its body overflows. */
const panelBox = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('.con-context');
  const scroller = document.querySelector('.con-inspector') as HTMLElement | null;
  const r = el?.getBoundingClientRect();
  return {
    box: r === undefined ? '' : [r.left, r.top, r.width, r.height].map(Math.round).join(','),
    overflow: scroller === null ? -1 : scroller.scrollHeight - scroller.clientHeight,
    scrollHint: document.querySelectorAll('.con-inspector__more').length,
  };
});

/** The move's level, read off the board's own classes: `source` (which ocean) / `cell` (where to) / `` (no move pick). */
const moveLevel = (page: Page) => page.evaluate(() => {
  const board = document.querySelector('.con-board');
  if (board === null) {
    return '';
  }
  return board.classList.contains('con-board--move-pick') ? 'source' : board.classList.contains('con-board--move-lifted') ? 'cell' : '';
});

/** The bar's verbs as drawn. */
const barText = (page: Page) => textOf(page, '.con-cmdbar');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** The acceptance storyboard (opt-in): every frame the compositor produced, as the player saw it. Returns the stop. */
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

/** Open the hand from board home and descend into the card's play composer. */
async function openComposer(page: Page): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  // On 4K the album is still in transit when the first focus press lands — wait it out before walking.
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/**
 * «РАЗЫГРАТЬ НА ПОЛЕ» — one press, verified by the composer's OWN state, then
 * the board's source level. Never a blind retry: a second A after the board is
 * up would LIFT the ocean.
 */
async function playOnTheBoard(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) === null, composer);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await expect.poll(() => moveLevel(page), {timeout: 30_000, message: 'the staged move never took the board at its source level'}).toBe('source');
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** A LIFTS the focused ocean — one press, verified by the level. */
async function liftOcean(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3 && await moveLevel(page) !== 'cell'; attempt++) {
    await press(page, 'Enter', 250);
    await expect.poll(() => moveLevel(page), {timeout: 2_500}).toBe('cell').catch(() => undefined);
  }
  expect(await moveLevel(page), 'A on the ocean lifts it').toBe('cell');
}

for (const preset of PRESETS) {
  test.describe(`TR39 Canyon Carving · an ocean moves · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → the ocean → the cell → B-ladder → A → ONE proxy carries the ocean, the scale stands → the board (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
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

      const {playerId, seats} = await bootFixtureSeats(page, request, 'canyon-carving', {query: preset.query});
      const red = seats[1];
      const before = await wireOf(request, playerId);
      const redBefore = await wireOf(request, red);
      expect(before.thisPlayer.color, 'the viewer is a seated colour').toBeTruthy();
      expect([cellOf(before, X)?.tileType, cellOf(before, OCEAN2)?.tileType, cellOf(before, B)?.tileType, cellOf(before, CAPITAL)?.tileType],
        'the fixture: two plain oceans on 33 and 43, the destination bare, red\'s Capital on 24').toEqual([TileType.OCEAN, TileType.OCEAN, undefined, TileType.CAPITAL]);
      expect(cellOf(before, X)?.color, 'an ocean is nobody\'s').toBeUndefined();
      expect(before.game.oceans, 'two oceans on the board').toBe(2);
      expect(redBefore.thisPlayer.victoryPointsBreakdown.victoryPoints, 'red\'s Capital scores its one adjacent ocean').toBe(1);

      // THE SECOND CLIENT — red's console stays open on the board: the move must be seen there as ONE relocation.
      const redPage = await context.newPage();
      const redErrors: Array<string> = [];
      redPage.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(redPage, red, preset.query);
      await settle(redPage, {timeoutMs: 30_000});
      // Red is still inside its START workspace (its corporation's first action waits for blue's turn) — a board
      // nobody can see plays no scene (a landing waits for a watchable board). «Свернуть» puts red ON the board.
      const redOnBoard = () => redPage.evaluate(() => {
        const start = document.querySelector<HTMLElement>('.con-start__frame');
        const board = document.querySelector<HTMLElement>('.con-board');
        return (start === null || start.offsetParent === null) && board !== null && board.offsetParent !== null;
      });
      expect(await pressUntil(redPage, 'Escape', redOnBoard, {tries: 4, settleMs: 1200}), 'red minimizes its start workspace and stands on the board').toBe(true);
      await settle(redPage, {timeoutMs: 20_000});
      await shoot(redPage, preset.id, '00-opponent-board');
      await page.bringToFront();

      // ── the composer: the door's verb and the named next step — in the OCEAN's words ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the staged cell\'s own verb').toContainText('Разыграть на поле');
      await expect(page.locator(composer), 'the next step is named — the ocean\'s move, never a placement').toContainText(/перенесите тайл океана/i);
      await expect(page.locator(composer), 'never the city\'s word').not.toContainText(/переселите/i);
      const paymentBefore = await textOf(page, `${composer} .con-paystatus`);
      expect(paymentBefore, 'the payment line states the price').toContain('6');
      await shoot(page, preset.id, '01-composer');

      // ── 1. «Разыграть на поле»: nothing is sent ──
      await playOnTheBoard(page);
      expect(posts, 'no POST before the cell\'s confirm').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 2. THE SOURCE LEVEL: both oceans offered, the cursor on the first; the dossier reads THIS OCEAN and the rival's loss ──
      await expect(page.locator(panel), 'the kicker names a relocation').toContainText(/перемещение тайла/i, {timeout: 15_000});
      await expect.poll(() => legalCells(page), {timeout: 10_000, message: 'the source level offers exactly the oceans that may move — anybody\'s'}).toEqual([X, OCEAN2]);
      await expect.poll(() => focusedSpaceId(page), {timeout: 10_000, message: 'the cursor stands on the first movable ocean'}).toBe(X);
      await expect(page.locator('.con-bcur--pickup'), 'the reticle wears its pickup pose').toHaveCount(1);
      await expect(page.locator('.con-bcur__ghost'), 'no ghost of a tile over a tile').toHaveCount(0);
      await expect(page.locator(panel), 'the dossier reads the SOURCE in the ocean\'s words').toContainText('Этот океан', {timeout: 10_000});
      await expect(page.locator(panel)).not.toContainText('Этот город');
      await expect(page.locator(panel)).toContainText(/Клеток для переноса:\s*\d/);
      await expect(page.locator(panel), 'the rival\'s loss is NAMED').toContainText('Столица теряет соседний океан');
      // Another player's loss is told under «other players receive» as a signed VP at game end — never the mover's own vector.
      await expect(page.locator(panel), 'the rival\'s Capital loses one VP at game end').toContainText(/−1\s*ПО/);
      const bar = await barText(page);
      expect(bar, 'the bar speaks the ocean\'s verb').toMatch(/Взять океан/);
      expect(bar, 'never the city\'s').not.toMatch(/город/i);
      await shoot(page, preset.id, '02-source-level');

      // ── 3. A LIFTS the ocean: the pose, the vector, the destination's dossier ──
      await liftOcean(page);
      expect(posts, 'lifting an ocean sends nothing').toEqual([]);
      await expect(page.locator(`.board-space--move-source[data_space_id="${X}"]`), 'the ocean wears «leaving from here»').toHaveCount(1);
      await expect(page.locator('.con-bmove-origin'), 'the origin\'s dashed contour stands').toHaveCount(1);
      const destinations = await legalCells(page);
      expect(destinations, 'the cell level offers the ocean\'s own neighbours of both families — the reserve and the land').toEqual(expect.arrayContaining([B, '34']));
      expect(destinations, 'the Capital\'s cell is occupied — not a destination').not.toContain(CAPITAL);
      expect(destinations, 'the lifted ocean\'s own cell is not a destination').not.toContain(X);
      expect(destinations, 'the other ocean\'s cell is occupied').not.toContain(OCEAN2);
      expect(await focusedSpaceId(page), 'the cursor moved onto a destination — a focus, never a choice').not.toBe(X);
      expect(await barText(page), 'B on the cell level is «Другой океан»').toMatch(/Другой океан/);

      // The panel does not move while the player points: walk the destinations, one box. Cell 25 sits a row ABOVE the
      // ring's other cells, and the strict-grid d-pad walk (P27b — up/down never drift to a neighbouring column) does not
      // reach it from them; it is a legal cell, lit and asserted above, just not walked.
      const boxes: Array<string> = [];
      for (const id of destinations.filter((cell) => cell !== '25')) {
        await walkToSpace(page, id);
        await expect(page.locator('.con-bmove'), `the vector points at ${id}`).toHaveCount(1);
        const fit = await panelBox(page);
        boxes.push(fit.box);
        expect(fit.overflow, `the dossier of ${id} overflows by ${fit.overflow}px`).toBeLessThanOrEqual(2);
        expect(fit.scrollHint, `the dossier of ${id} shows a scroll affordance`).toBe(0);
      }
      expect(new Set(boxes).size, `the panel's outer box moved during the walk: ${boxes.join(' | ')}`).toBe(1);

      await walkToSpace(page, B);
      await expect(page.locator(panel), 'what stays behind has its own section').toContainText('Прежняя клетка', {timeout: 10_000});
      const dossier = await textOf(page, panel);
      expect(dossier, 'the move\'s own TR').toMatch(/Перемещение тайла/);
      expect(dossier, 'the Greens answer the TR step').toMatch(/Зелёные/);
      expect(dossier, 'the OTHER ocean pays').toMatch(/Соседство с океаном/);
      expect(dossier, 'the rival\'s Capital loses — named on the destination too').toMatch(/Столица теряет соседний океан/);
      expect(dossier, 'NEVER the ocean parameter — the count does not change').not.toMatch(/Повышает уровень океанов|уходит с поля|никто не теряет/);
      // The field lights exactly the cells the dossier is talking about, by the SERVER's own reading: the other ocean
      // that pays (43) and the Capital that loses (24). The cell being left never carries a mark.
      const lit = await relationCells(page);
      expect(lit, 'the relation layer names the dossier\'s cells').toEqual(expect.arrayContaining([OCEAN2, CAPITAL]));
      expect(lit, 'the cell being left is no participant').not.toContain(X);
      await shoot(page, preset.id, '04-cell-level');

      // ── 4. THE B-LADDER: lock → cell → source → composer; forward again — still nothing sent ──
      await press(page, 'Enter', 500); // lock
      await expect(page.locator('.con-bcur--locked'), 'A locks the cell').toHaveCount(1);
      await expect(page.locator('.con-bmove--locked'), 'the vector firms up at the lock').toHaveCount(1);
      expect(await barText(page), 'the locked verb is the ocean\'s').toMatch(/Подтвердить перенос/);
      await shoot(page, preset.id, '05-locked');
      await press(page, 'Escape', 500);
      await expect(page.locator('.con-bcur--locked'), 'B unlocks — one level').toHaveCount(0);
      expect(await moveLevel(page), 'B from the lock stays at the cell level').toBe('cell');
      await press(page, 'Escape', 500);
      expect(await moveLevel(page), 'B puts the ocean down — back to «which ocean»').toBe('source');
      await expect(page.locator('.board-space--move-source'), 'the pose lets go with the ocean').toHaveCount(0);
      await expect.poll(() => focusedSpaceId(page), {timeout: 5_000, message: 'the cursor returns to the ocean just held'}).toBe(X);
      await press(page, 'Escape', 1400);
      await page.locator(composer).waitFor({timeout: 15_000});
      await expect(page.locator(composer), 'the composer carries the SAME card').toContainText(CARD_RU);
      expect(await textOf(page, `${composer} .con-paystatus`), 'the same payment').toBe(paymentBefore);
      expect(posts, 'the whole ladder sent nothing').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge).toBe(before.game.gameAge);

      await settle(page);
      await playOnTheBoard(page);
      await expect.poll(() => focusedSpaceId(page), {timeout: 10_000}).toBe(X);
      await liftOcean(page);
      await walkToSpace(page, B);
      expect(posts, 'forward again — still nothing sent').toEqual([]);

      // ── 5. THE COMMIT: lock, then the play's ONE POST ──
      await armProbe(page, 'own');
      await armProbe(redPage, 'remote');
      const stopOwnStory = await storyboard(page, preset.id, 'own');
      const stopRedStory = await storyboard(redPage, preset.id, 'opponent');
      await press(page, 'Enter', 420); // lock
      await expect(page.locator('.con-bcur--locked')).toHaveCount(1);
      await page.keyboard.press('Enter'); // confirm — past the lock's dwell
      await expect.poll(async () => cellOf(await wireOf(request, playerId), B)?.tileType,
        {timeout: 30_000, message: 'the ocean never reached the destination on the server'}).toBe(TileType.OCEAN);
      expect(posts.length, `exactly ONE POST: ${posts.map((p) => p.url).join(', ')}`).toBe(1);
      expect(posts[0].url, 'it is the batch').toMatch(/\/player\/input-batch/);
      expect(posts[0].body, 'the tail names BOTH cells, addressed to the card')
        .toContain(JSON.stringify({type: 'space', spaceId: B, movedFrom: X, stagedFor: CARD}));

      // ── 6. THE SCENE (own) ──
      await expect.poll(async () => (await readProbe(page)).landedAt, {timeout: 20_000, message: 'the ocean never landed on screen'}).toBeDefined();
      await shoot(page, preset.id, '06-landed');
      await settle(page, {timeoutMs: 30_000});
      await stopOwnStory();
      const own = await readProbe(page);
      await shoot(page, preset.id, '06c-board');
      const dist = (p: {x: number, y: number}, box: Box) => Math.hypot(p.x - box.x, p.y - box.y);
      const assertOneMove = (probe: MoveProbe, who: string) => {
        expect(probe.ticks, `${who}: the probe never sampled`).toBeGreaterThan(20);
        expect(probe.degraded, `${who}: the move degraded (data-tile-move-degraded)`).toBe(false);
        expect(probe.track.length, `${who}: the proxy was never seen (phases: ${probe.phases.join('→')})`).toBeGreaterThan(2);
        expect(probe.proxyMax, `${who}: ONE proxy`).toBe(1);
        expect(probe.foreign, `${who}: no other tile proxy — no arrival from the table, no foreign lift`).toEqual([]);
        // THE PIECE THAT TRAVELS is the ocean, and nobody's: the ocean's art, no owner cube.
        expect(probe.proxyArt, `${who}: the proxy wears the ocean's art`).toContain('board-space-tile--ocean');
        expect(probe.cubeOnProxy, `${who}: an ocean has no owner — no cube rides the proxy`).toEqual([]);
        // ① the source was visible: the proxy is born ON the ocean's cell.
        expect(dist(probe.track[0], probe.a), `${who}: the proxy is born over the ocean (first sample ${JSON.stringify(probe.track[0])}, cell ${JSON.stringify(probe.a)})`)
          .toBeLessThan(probe.a.w * 0.3);
        // ② the destination was visible: the proxy ends ON the destination cell.
        const last = probe.track[probe.track.length - 1];
        expect(dist(last, probe.b), `${who}: the proxy ends on the destination (tail ${JSON.stringify(probe.track.slice(-5))}, cell ${JSON.stringify(probe.b)}, landed ${probe.landedAt}, gone ${probe.lastProxyAt}, ticks ${probe.ticks}/${probe.samples})`).toBeLessThan(probe.b.w * 0.2);
        // ③ movement happened, one way: the centre never turns back along the edge it crosses.
        const sign = Math.sign(probe.b.x - probe.a.x);
        let reach = -Infinity;
        let back = 0;
        const seen = new Set<string>();
        for (const point of probe.track) {
          const along = point.x * sign;
          back = Math.max(back, reach - along);
          reach = Math.max(reach, along);
          seen.add(`${Math.round(point.x)},${Math.round(point.y)}`);
        }
        expect(back, `${who}: the proxy's centre turned back by ${back.toFixed(1)}px`).toBeLessThan(1.5);
        expect(seen.size, `${who}: the proxy was seen in motion (${[...seen].join(' → ')})`).toBeGreaterThan(2);
        expect(probe.twoOceans, `${who}: a sample with TWO oceans`).toEqual([]);
        expect(probe.noOcean, `${who}: a sample with NO ocean`).toEqual([]);
        expect(probe.vacatedAt, `${who}: the vacated cell never settled`).toBeDefined();
        expect(probe.landedAt, `${who}: the ocean never landed`).toBeDefined();
        expect(probe.vacatedAt!, `${who}: the vacated cell settles BEFORE the landing`).toBeLessThan(probe.landedAt!);
        // THE PARAMETER STANDS STILL: the scale's digit, its marker and the HUD's «N/9» read one value in every tick.
        // The hero's own board hides its arc scales under Planet Focus for the scene's length, so there the scale is
        // read wherever it was visible; the opponent's board keeps its scales up and reads them on every tick.
        expect(probe.scaleDigits.length, `${who}: the ocean scale's digit never changes (${probe.scaleDigits.join(' → ')})`).toBeLessThanOrEqual(1);
        expect(probe.markerBoxes.length, `${who}: the ocean marker never moves (${probe.markerBoxes.join(' → ')})`).toBeLessThanOrEqual(1);
        if (who === 'remote') {
          expect(probe.scaleDigits, `${who}: the scale's digit was read`).toEqual(['2']);
        }
        expect(probe.hud, `${who}: the HUD's ocean counter never changes`).toEqual(['2/9']);
      };
      assertOneMove(own, 'own');
      expect(own.phases, 'the hero plays the move, lands, then pays').toEqual(expect.arrayContaining(['moving', 'landed', 'rewarding']));
      expect(own.phases, 'never the arrival\'s own phases').not.toEqual(expect.arrayContaining(['approaching']));
      expect(own.phases).not.toEqual(expect.arrayContaining(['departing']));
      expect(own.eaten, 'the vector was eaten behind the tile').toBe(true);
      // The trace is reported BEFORE it is judged — a red run must still name what it measured.
      const trace = `tr ${JSON.stringify(own.tr)}; mc ${JSON.stringify(own.mc)}; plants ${JSON.stringify(own.plants)}; landed ${own.landedAt}, applied ${own.appliedAt}, first proxy ${own.firstProxyAt}, phases ${own.phases.join('→')}`;
      test.info().annotations.push({
        type: 'tr39-scene',
        description: `${preset.id} own: handoff→landing ${own.landedAt! - own.firstProxyAt!}ms, vacated at +${own.vacatedAt! - own.firstProxyAt!}ms, proxy gone at +${own.lastProxyAt! - own.firstProxyAt!}ms, applied at +${(own.appliedAt ?? 0) - own.firstProxyAt!}ms, ${own.track.length} samples; ${trace}`,
      });
      // The cell's bonus and the move's TR tick AFTER the touchdown; the Greens' answer after the TR.
      expect(own.plants.length, `the plants counter never moved: ${trace}`).toBeGreaterThanOrEqual(2);
      expect(Number(own.plants[own.plants.length - 1][1]) - Number(own.plants[0][1]), 'the printed plant is counted once').toBe(1);
      expect(own.plants[1][0], `the plant ticks after the landing: ${trace}`).toBeGreaterThanOrEqual(own.landedAt!);
      expect(own.tr.length, `the TR never moved: ${trace}`).toBeGreaterThanOrEqual(2);
      expect(Number(own.tr[own.tr.length - 1][1]) - Number(own.tr[0][1]), 'the move pays exactly one TR').toBe(1);
      expect(own.tr[1][0], `the TR ticks after the landing: ${trace}`).toBeGreaterThanOrEqual(own.landedAt!);
      const mcStart = Number(own.mc[0][1]);
      const mcEnd = Number(own.mc[own.mc.length - 1][1]);
      // The probe is armed BEFORE the commit, so the rail's M€ walks the whole transaction: the card's 6 paid at the
      // play's POST, then the other ocean's 2 and the Greens' 2 after the landing.
      expect(mcEnd - mcStart, `the rail's M€ since the press: −6 paid, +2 the other ocean, +2 the Greens (${trace})`).toBe(-6 + 2 + 2);
      // THE RAIL SPEAKS IN THE ENGINE'S ORDER (PL-133). The commit is HELD through the flight, so every counter moves
      // after the touchdown — and in turn: the price ALONE at the commit (the table's answer is never netted into it:
      // «−4» once stood for −6 + 2), the cell's plant, the water, the rating (it is `addTile`'s successor, and the
      // parameter never moved, so no scale tells it), and the Greens one beat after the rating — an answer never ticks
      // before its cause (PL-002).
      expect(own.mc.length, `three statements on the M€ row — the price, the water, the Greens (${trace})`).toBe(4);
      expect(Number(own.mc[1][1]) - Number(own.mc[0][1]), `the price leaves alone (${trace})`).toBe(-6);
      expect(own.mc[1][0], `the price ticks at the commit, after the touchdown (${trace})`).toBeGreaterThanOrEqual(own.landedAt!);
      expect(own.plants[1][0], `the cell pays after the price (${trace})`).toBeGreaterThanOrEqual(own.mc[1][0]);
      expect(own.mc[2][0], `the water pays after the cell (${trace})`).toBeGreaterThanOrEqual(own.plants[1][0]);
      expect(own.tr[1][0], `the rating ticks after the water paid (${trace})`).toBeGreaterThanOrEqual(own.mc[2][0]);
      expect(own.mc[3][0], `the Greens answer after the rating ticked (${trace})`).toBeGreaterThanOrEqual(own.tr[1][0]);

      // ── 7. THE OPPONENT sees ONE move, the scale stands for them too, and they are told of the play ──
      await expect.poll(async () => (await readProbe(redPage)).landedAt, {timeout: 30_000, message: 'red never saw the ocean land'}).toBeDefined();
      await settle(redPage, {timeoutMs: 30_000});
      await stopRedStory();
      const remote = await readProbe(redPage);
      assertOneMove(remote, 'remote');
      test.info().annotations.push({
        type: 'tr39-scene',
        description: `${preset.id} remote: handoff→landing ${remote.landedAt! - remote.firstProxyAt!}ms, vacated at +${remote.vacatedAt! - remote.firstProxyAt!}ms, ${remote.track.length} samples`,
      });
      // Told of the play: a «КАРТА СЫГРАНА» naming the card was SHOWN on red's screen at some point since the press —
      // the probe recorded it live; a toast that has already expired by now is still a toast that was shown.
      await expect.poll(async () => (await readProbe(redPage)).notifs.length,
        {timeout: 30_000, message: 'red is told of the play (a notification naming the card was shown while the probe ran)'}).toBeGreaterThan(0);
      await shoot(redPage, preset.id, '07-opponent-after');

      // ── 8. THE SERVER agrees; the flow ends on the board ──
      const after = await wireOf(request, playerId);
      const redAfter = await wireOf(request, red);
      expect(cellOf(after, B), 'the ocean stands on the destination — nobody\'s').toMatchObject({tileType: TileType.OCEAN});
      expect(cellOf(after, B)?.color).toBeUndefined();
      expect(cellOf(after, X)?.tileType, 'the source is bare').toBeUndefined();
      expect(after.game.oceans, 'the count is the same — the parameter never moved').toBe(before.game.oceans);
      expect(after.thisPlayer.terraformRating, '+1 TR for the move').toBe(before.thisPlayer.terraformRating + 1);
      expect(after.thisPlayer.megacredits, '6 M€ paid; the other ocean\'s 2 M€ and the Greens\' 2 M€ gained').toBe(before.thisPlayer.megacredits - 6 + 2 + 2);
      expect(after.thisPlayer.plants, 'the cell\'s printed plant gained').toBe(before.thisPlayer.plants + 1);
      expect((after.cardsInHand ?? []).length, 'the card left the hand').toBe((before.cardsInHand ?? []).length - 1);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect((after.game.tileMoves ?? []).filter((m) => m.from === X && m.to === B && m.tileType === TileType.OCEAN), 'the move is recorded once, as an ocean').toHaveLength(1);
      expect(redAfter.thisPlayer.victoryPointsBreakdown.victoryPoints, 'red\'s Capital lost its adjacent ocean').toBe(0);

      await expect(page.locator('.con-ws'), 'the flow ends on the board').toHaveCount(0, {timeout: 20_000});
      await expect(page.locator(composer)).toHaveCount(0);
      expect(own.stranded || (await readProbe(page)).stranded, 'nothing stranded').toBe(false);
      expect(remote.stranded, 'nothing stranded for the opponent').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
      expect(redErrors, 'no page error for the opponent').toEqual([]);
    });
  });
}
