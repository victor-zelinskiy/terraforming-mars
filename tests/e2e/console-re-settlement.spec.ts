import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, focusedSpaceId, openConsole, press, pressUntil, settle, walkToSpace} from './consoleStart';
import {TileType} from '../../src/common/TileType';

/**
 * TR14 «ПЕРЕСЕЛЕНИЕ» — A CITY MOVES to a neighbouring cell
 * (docs/TURMOIL_REDUX_RE_SETTLEMENT.md).
 *
 * The contract under test, end to end against a real server, on two profiles
 * (a geometry claim made at one resolution is a claim about one resolution):
 *
 *   1. «Разыграть на поле» sends NOTHING: the server's change counter stands
 *      and the card is still in the hand.
 *   2. THE CITY LEVEL: the cursor stands on the one city that may move; the
 *      walled-in city is reachable only by «все клетки» and states its ONE
 *      reason; the dossier reads the SOURCE.
 *   3. A LIFTS the city (nothing sent): the «leaving from here» pose on it, the
 *      projection and the vector on the neighbouring cell; the dossier reads
 *      the destination — what the cell gives, what stays at the former cell,
 *      the city's VP as ONE vector «1 → 2»; the field lights exactly the cells
 *      the server named; the panel neither scrolls nor moves under the cursor.
 *   4. B walks back ONE level per press: lock → cell → city → composer (the
 *      same payment). Forward again — still nothing sent.
 *   5. The second A on the locked cell is the play's ONE POST, and its tail
 *      names BOTH cells, addressed to the card.
 *   6. THE SCENE: one proxy; its centre travels from the city's cell to the
 *      destination without turning back; never a sample with two cities or
 *      with none; the vacated cell settles BEFORE the landing; the cell's
 *      bonus ticks AFTER it; no arrival «from the table», no foreign lift.
 *   7. THE OPPONENT (red, on the board) sees the same ONE move — never «a
 *      removal here, a landing there».
 *   8. The server agrees (the city stands on the destination, the source is
 *      bare, 7 M€ paid, the cell's plant and the ocean's 2 M€ gained, the move
 *      recorded once) and the flow ENDS ON THE BOARD.
 *
 * A move IS a city placement (the card's own ruling): Mars First's party
 * effect — which the player necessarily holds, it is the card's requirement —
 * answers it with a steel and a CARD. The card is taken before the flow is
 * judged to have ended on the board.
 *
 * `TM_E2E_STORYBOARD=1` additionally writes the scene's frames (a CDP
 * screencast of both clients) under `screenshots/re-settlement/<profile>/story-*` —
 * the acceptance storyboard, not an assertion.
 *
 * Fixture `re-settlement` (tests/e2e/fixtures/generate.ts — the cells below are
 * its own constants, asserted there against the engine): blue's city on 16
 * (one greenery) may move — to 24 (a printed plant, an ocean and two
 * greeneries beside it) among others; blue's city on 62 is walled in.
 */

const CARD = 'Re-settlement';
const CARD_RU = 'Переселение';
const X = '16';
const B = '24';
const Y = '62';
/** The greenery only the DESTINATION touches (17 stands beside both cells and changes nothing for the city). */
const GAINED_GROVE = '25';
const OCEAN = '33';

/** Screenshots (and the opt-in storyboard) — outside Playwright's own output dir, which every run wipes. */
const OUT = path.resolve('screenshots', 're-settlement');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, plants: number, steel: number, tableau: Array<{name: string}>};
  waitingFor?: {type?: string};
  game: {
    gameAge: number;
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
  /** Any OTHER tile proxy that became visible: an arrival «from the table», a plain lift. */
  foreign: Array<string>;
  twoCities: Array<string>;
  noCity: Array<string>;
  firstProxyAt?: number;
  lastProxyAt?: number;
  vacatedAt?: number;
  landedAt?: number;
  /** The source cell stopped painting the city. */
  sourceBareAt?: number;
  phases: Array<string>;
  plants: Array<[number, string]>;
  degraded: boolean;
  stranded: boolean;
  eaten: boolean;
};

/**
 * THE SCENE PROBE — MutationObserver + setInterval, never rAF (headless drives
 * rAF off the compositor: it stops when the screen is quiet). A claim about
 * FRAMES («two cities», «no city») is made on the interval samples only: an
 * observer sample runs as a microtask and legitimately sees a state the
 * browser never paints.
 */
async function armProbe(page: Page, kind: 'own' | 'remote'): Promise<void> {
  await page.evaluate(({kind, from, to}) => {
    const w = window as unknown as {__tr14: MoveProbe};
    const rectOf = (id: string): Box => {
      const r = document.querySelector(`.board-space[data_space_id="${id}"]`)!.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
    };
    const p: MoveProbe = {
      samples: 0, ticks: 0, a: rectOf(from), b: rectOf(to), track: [], proxyMax: 0, foreign: [], twoCities: [], noCity: [],
      phases: [], plants: [], degraded: false, stranded: false, eaten: false,
    };
    w.__tr14 = p;
    const t0 = Date.now();
    const shown = (el: Element): boolean => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 2 && r.height > 2;
    };
    const cityOn = (id: string): boolean =>
      document.querySelector(`.board-space[data_space_id="${id}"] > [class*="board-space-tile--city"]:not(.board-space-tile--placement-cleared)`) !== null;
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
      }
      const cityA = cityOn(from);
      const cityB = cityOn(to);
      if (!cityA) {
        p.sourceBareAt ??= now;
      }
      if (cityB) {
        p.landedAt ??= now;
      }
      if (document.querySelector(`.board-space[data_space_id="${from}"] > .board-space-tile--vacated`) !== null) {
        p.vacatedAt ??= now;
      }
      if (tick) {
        p.ticks++;
        const far = (c: {x: number, y: number}, box: Box) => Math.hypot(c.x - box.x, c.y - box.y) > box.w * 0.5;
        const two = (cityA && cityB) || (centre !== undefined && ((cityA && far(centre, p.a)) || (cityB && far(centre, p.b))));
        if (two && p.twoCities.length < 6) {
          p.twoCities.push(`${now}ms a=${cityA} b=${cityB} proxy=${centre === undefined ? '-' : `${Math.round(centre.x)},${Math.round(centre.y)}`}`);
        }
        if (!cityA && !cityB && centre === undefined && p.noCity.length < 6) {
          p.noCity.push(`${now}ms`);
        }
      }
      const root = document.querySelector('.con-tileplace');
      if (root !== null) {
        const phase = root.getAttribute('data-tile-phase');
        if (phase !== null && p.phases[p.phases.length - 1] !== phase) {
          p.phases.push(phase);
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
      const digits = document.querySelector('.con-res__row .resource_icon--plants')?.closest('.con-res__row')?.querySelector('.con-res__digits');
      const value = (digits?.childNodes[0]?.textContent ?? '').trim();
      if (value !== '' && p.plants[p.plants.length - 1]?.[1] !== value) {
        p.plants.push([now, value]);
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 16);
  }, {kind, from: X, to: B});
}

const readProbe = (page: Page): Promise<MoveProbe> => page.evaluate(() => (window as unknown as {__tr14: MoveProbe}).__tr14);

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

/** The move's level, read off the board's own classes: `city` (which city) / `cell` (where to) / `` (no move pick). */
const moveLevel = (page: Page) => page.evaluate(() => {
  const board = document.querySelector('.con-board');
  if (board === null) {
    return '';
  }
  return board.classList.contains('con-board--move-pick') ? 'city' : board.classList.contains('con-board--move-lifted') ? 'cell' : '';
});

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
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/**
 * «РАЗЫГРАТЬ НА ПОЛЕ» — one press, verified by the composer's OWN state, then
 * the board's city level. Never a blind retry: a second A after the board is
 * up would LIFT the city.
 */
async function playOnTheBoard(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) === null, composer);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await expect.poll(() => moveLevel(page), {timeout: 30_000, message: 'the staged move never took the board at its city level'}).toBe('city');
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** A LIFTS the focused city — one press, verified by the level. */
async function liftCity(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3 && await moveLevel(page) !== 'cell'; attempt++) {
    await press(page, 'Enter', 250);
    await expect.poll(() => moveLevel(page), {timeout: 2_500}).toBe('cell').catch(() => undefined);
  }
  expect(await moveLevel(page), 'A on the city lifts it').toBe('cell');
}

for (const preset of PRESETS) {
  test.describe(`TR14 Re-settlement · a city moves · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → the city → the cell → B-ladder → A → ONE proxy carries the city → the board (${preset.id})`, async ({page, request, context}) => {
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

      const {playerId, seats} = await bootFixtureSeats(page, request, 're-settlement', {query: preset.query});
      const red = seats[1];
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect([cellOf(before, X)?.tileType, cellOf(before, Y)?.tileType, cellOf(before, B)?.tileType],
        'the fixture: blue\'s cities on 16 and 62, the destination bare').toEqual([TileType.CITY, TileType.CITY, undefined]);
      expect(cellOf(before, X)?.color).toBe(viewer);

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

      // ── the composer: the door's verb and the named next step ──
      await openComposer(page);
      await expect(page.locator(composer), 'the CTA is the staged cell\'s own verb').toContainText('Разыграть на поле');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText(/переселите свой город/i);
      const paymentBefore = await textOf(page, `${composer} .con-paystatus`);
      expect(paymentBefore, 'the payment line states the price').toContain('7');
      await shoot(page, preset.id, '01-composer');

      // ── 1. «Разыграть на поле»: nothing is sent ──
      await playOnTheBoard(page);
      expect(posts, 'no POST before the cell\'s confirm').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 2. THE CITY LEVEL: the cursor on the one city that may move; the walled-in city only by «все клетки» ──
      await expect(page.locator(panel), 'the kicker names a relocation').toContainText(/перемещение тайла/i, {timeout: 15_000});
      await expect.poll(() => legalCells(page), {timeout: 10_000, message: 'the city level offers exactly the city that may move'}).toEqual([X]);
      await expect.poll(() => focusedSpaceId(page), {timeout: 10_000, message: 'the cursor stands on the movable city'}).toBe(X);
      await expect(page.locator('.con-bcur--pickup'), 'the reticle wears its pickup pose').toHaveCount(1);
      await expect(page.locator('.con-bcur__ghost'), 'no ghost of a tile over a tile').toHaveCount(0);
      await expect(page.locator(panel), 'the dossier reads the SOURCE').toContainText('Этот город', {timeout: 10_000});
      await expect(page.locator(panel)).toContainText(/Клеток для переселения:\s*\d/);
      await expect(page.locator(panel)).toContainText(/Сейчас приносит:\s*1\s*ПО/);
      await shoot(page, preset.id, '02-city-level');

      await press(page, 'KeyV', 500); // R3 — «все клетки»
      await walkToSpace(page, Y);
      await expect(page.locator(panel), 'the walled-in city states its ONE reason').toContainText('городу некуда переехать', {timeout: 10_000});
      expect(await page.locator(`.board-space--available[data_space_id="${Y}"]`).count(), 'a city that cannot move is offered disabled, never as a legal cell').toBe(0);
      await shoot(page, preset.id, '03-city-disabled');
      await press(page, 'Enter', 500); // A on it does nothing — and lifts nothing
      expect(await moveLevel(page), 'a disabled city cannot be lifted').toBe('city');
      await press(page, 'KeyV', 500); // back to «только доступные»
      await walkToSpace(page, X);

      // ── 3. A LIFTS the city: the pose, the vector, the destination's dossier ──
      await liftCity(page);
      expect(posts, 'lifting a city sends nothing').toEqual([]);
      await expect(page.locator(`.board-space--move-source[data_space_id="${X}"]`), 'the city wears «leaving from here»').toHaveCount(1);
      await expect(page.locator('.con-bmove-origin'), 'the origin\'s dashed contour stands').toHaveCount(1);
      const destinations = await legalCells(page);
      expect(destinations, 'the cell level offers the city\'s own neighbours').toContain(B);
      expect(destinations.length, 'more than one cell to choose from').toBeGreaterThanOrEqual(2);
      expect(destinations, 'the lifted city\'s own cell is not a destination').not.toContain(X);
      expect(await focusedSpaceId(page), 'the cursor moved onto a destination — a focus, never a choice').not.toBe(X);

      // The panel does not move while the player points: walk every destination, one box.
      const boxes: Array<string> = [];
      for (const id of destinations) {
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
      await expect(page.locator(panel), 'the city\'s VP is ONE vector').toContainText(/ПО города/);
      await expect.poll(() => textOf(page, `${panel} .con-dossier-row__vp--vector`), {timeout: 10_000, message: 'the VP vector reads 1 → 2'})
        .toMatch(/1\s*→\s*2/);
      // The field lights exactly the cells the dossier is talking about, by the SERVER's own reading: the greenery the
      // city GAINS (25 — «у новой клетки +1») and the ocean that pays (33). The greenery on 17 stands beside BOTH
      // cells — nothing changes for it, so it is no participant; the cell being left never carries a mark.
      await expect.poll(() => relationCells(page), {timeout: 10_000, message: 'the relation layer names the dossier\'s cells'})
        .toEqual([GAINED_GROVE, OCEAN].sort());
      await expect(page.locator(panel), 'one gained greenery in the dossier — one lit on the field').toContainText(/у новой клетки\s*\+1/);
      await expect(page.locator(panel), 'one paying ocean in the dossier — one lit on the field').toContainText('Соседство с океаном');
      await shoot(page, preset.id, '04-cell-level');

      // ── 4. THE B-LADDER: lock → cell → city → composer; forward again — still nothing sent ──
      await press(page, 'Enter', 500); // lock
      await expect(page.locator('.con-bcur--locked'), 'A locks the cell').toHaveCount(1);
      await expect(page.locator('.con-bmove--locked'), 'the vector firms up at the lock').toHaveCount(1);
      await shoot(page, preset.id, '05-locked');
      await press(page, 'Escape', 500);
      await expect(page.locator('.con-bcur--locked'), 'B unlocks — one level').toHaveCount(0);
      expect(await moveLevel(page), 'B from the lock stays at the cell level').toBe('cell');
      await press(page, 'Escape', 500);
      expect(await moveLevel(page), 'B puts the city down — back to «which city»').toBe('city');
      await expect(page.locator('.board-space--move-source'), 'the pose lets go with the city').toHaveCount(0);
      await expect.poll(() => focusedSpaceId(page), {timeout: 5_000, message: 'the cursor returns to the city just held'}).toBe(X);
      await press(page, 'Escape', 1400);
      await page.locator(composer).waitFor({timeout: 15_000});
      await expect(page.locator(composer), 'the composer carries the SAME card').toContainText(CARD_RU);
      expect(await textOf(page, `${composer} .con-paystatus`), 'the same payment').toBe(paymentBefore);
      expect(posts, 'the whole ladder sent nothing').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge).toBe(before.game.gameAge);

      await settle(page);
      await playOnTheBoard(page);
      await expect.poll(() => focusedSpaceId(page), {timeout: 10_000}).toBe(X);
      await liftCity(page);
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
        {timeout: 30_000, message: 'the city never reached the destination on the server'}).toBe(TileType.CITY);
      expect(posts.length, `exactly ONE POST: ${posts.map((p) => p.url).join(', ')}`).toBe(1);
      expect(posts[0].url, 'it is the batch').toMatch(/\/player\/input-batch/);
      expect(posts[0].body, 'the tail names BOTH cells, addressed to the card')
        .toContain(JSON.stringify({type: 'space', spaceId: B, movedFrom: X, stagedFor: CARD}));

      // ── 6. THE SCENE (own) ──
      await expect.poll(async () => (await readProbe(page)).landedAt, {timeout: 20_000, message: 'the city never landed on screen'}).toBeDefined();
      await shoot(page, preset.id, '06-landed');
      // Mars First answers the city with a CARD (the party's own effect): it is taken before the flow can end.
      const drawn = page.locator('.con-zoom, .con-reveal');
      await expect.poll(() => drawn.count(), {timeout: 30_000, message: 'Mars First\'s card never arrived'}).toBeGreaterThan(0);
      await settle(page, {timeoutMs: 30_000});
      await stopOwnStory();
      await shoot(page, preset.id, '06b-party-card');
      expect(await pressUntil(page, 'Enter', async () => await drawn.count() === 0, {tries: 4, settleMs: 1500}), 'A takes the drawn card').toBe(true);
      await settle(page, {timeoutMs: 30_000});
      const own = await readProbe(page);
      await shoot(page, preset.id, '06c-board');
      const dist = (p: {x: number, y: number}, box: Box) => Math.hypot(p.x - box.x, p.y - box.y);
      const assertOneMove = (probe: MoveProbe, who: string) => {
        expect(probe.ticks, `${who}: the probe never sampled`).toBeGreaterThan(20);
        expect(probe.degraded, `${who}: the move degraded (data-tile-move-degraded)`).toBe(false);
        expect(probe.track.length, `${who}: the proxy was never seen (phases: ${probe.phases.join('→')})`).toBeGreaterThan(2);
        expect(probe.proxyMax, `${who}: ONE proxy`).toBe(1);
        expect(probe.foreign, `${who}: no other tile proxy — no arrival from the table, no foreign lift`).toEqual([]);
        // ① the source was visible: the proxy is born ON the city's cell.
        expect(dist(probe.track[0], probe.a), `${who}: the proxy is born over the city (first sample ${JSON.stringify(probe.track[0])}, cell ${JSON.stringify(probe.a)})`)
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
        // A loaded 4K runner paints this 770 ms scene in a handful of frames — the floor is «it was seen on the way»,
        // never a frame count: the source, at least one pose between, the destination.
        expect(seen.size, `${who}: the proxy was seen in motion (${[...seen].join(' → ')})`).toBeGreaterThan(2);
        expect(probe.twoCities, `${who}: a sample with TWO cities`).toEqual([]);
        expect(probe.noCity, `${who}: a sample with NO city`).toEqual([]);
        expect(probe.vacatedAt, `${who}: the vacated cell never settled`).toBeDefined();
        expect(probe.landedAt, `${who}: the city never landed`).toBeDefined();
        expect(probe.vacatedAt!, `${who}: the vacated cell settles BEFORE the landing`).toBeLessThan(probe.landedAt!);
      };
      assertOneMove(own, 'own');
      expect(own.phases, 'the hero plays the move, lands, then pays').toEqual(expect.arrayContaining(['moving', 'landed', 'rewarding']));
      expect(own.phases, 'never the arrival\'s own phases').not.toEqual(expect.arrayContaining(['approaching']));
      expect(own.phases).not.toEqual(expect.arrayContaining(['departing']));
      expect(own.eaten, 'the vector was eaten behind the tile').toBe(true);
      // The cell's bonus ticks AFTER the touchdown.
      expect(own.plants.length, `the plants counter never moved: ${JSON.stringify(own.plants)}`).toBeGreaterThanOrEqual(2);
      expect(Number(own.plants[own.plants.length - 1][1]) - Number(own.plants[0][1]), 'the printed plant is counted once').toBe(1);
      expect(own.plants[1][0], 'the counter ticks after the landing').toBeGreaterThanOrEqual(own.landedAt!);
      test.info().annotations.push({
        type: 'tr14-scene',
        description: `${preset.id} own: handoff→landing ${own.landedAt! - own.firstProxyAt!}ms, vacated at +${own.vacatedAt! - own.firstProxyAt!}ms, proxy gone at +${own.lastProxyAt! - own.firstProxyAt!}ms, ${own.track.length} samples`,
      });

      // ── 7. THE OPPONENT sees ONE move ──
      await expect.poll(async () => (await readProbe(redPage)).landedAt, {timeout: 30_000, message: 'red never saw the city land'}).toBeDefined();
      await settle(redPage, {timeoutMs: 30_000});
      await stopRedStory();
      const remote = await readProbe(redPage);
      assertOneMove(remote, 'remote');
      test.info().annotations.push({
        type: 'tr14-scene',
        description: `${preset.id} remote: handoff→landing ${remote.landedAt! - remote.firstProxyAt!}ms, vacated at +${remote.vacatedAt! - remote.firstProxyAt!}ms, ${remote.track.length} samples`,
      });
      await shoot(redPage, preset.id, '07-opponent-after');

      // ── 8. THE SERVER agrees; the flow ends on the board ──
      const after = await wireOf(request, playerId);
      expect(cellOf(after, B), 'the city stands on the destination').toMatchObject({tileType: TileType.CITY, color: viewer});
      expect(cellOf(after, X)?.tileType, 'the source is bare').toBeUndefined();
      expect(cellOf(after, X)?.color).toBeUndefined();
      expect(after.thisPlayer.megacredits, '7 M€ paid, the ocean\'s 2 M€ gained').toBe(before.thisPlayer.megacredits - 7 + 2);
      expect(after.thisPlayer.plants, 'the cell\'s printed plant gained').toBe(before.thisPlayer.plants + 1);
      expect(after.thisPlayer.steel, 'Mars First pays its steel for a tile on Mars — a move IS a placement').toBe(before.thisPlayer.steel + 1);
      expect((after.cardsInHand ?? []).length, 'the card left the hand, Mars First\'s card joined it').toBe((before.cardsInHand ?? []).length);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect((after.game.tileMoves ?? []).filter((m) => m.from === X && m.to === B), 'the move is recorded once').toHaveLength(1);
      expect(after.game.spaces.filter((s) => s.color === viewer && s.tileType === TileType.CITY).length, 'the number of cities did not change').toBe(2);

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
