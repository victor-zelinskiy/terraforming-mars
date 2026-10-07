import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, pressUntil, settle, walkToSpace} from './consoleStart';
import {TileType} from '../../src/common/TileType';

/**
 * TR30 «КРАСНЫЙ МУЗЕЙ» — A TILE PAYS A CARD, AND THE CELL DECIDES WHETHER
 * (`cards/tilePayout.ts`, the scene «ТАЙЛ ПЛАТИТ КАРТЕ» on TR21's chassis).
 *
 * The contract under test, end to end against a real server, on two profiles:
 *
 *   1. THE DOSSIER answers for EVERY cell honestly: beside the ocean on 43 the
 *      museum's row is a NAMED no («Рядом 1 океан — данных не будет»), no data
 *      chip; on the clean cell «Рядом нет озеленения и океана · +2 [data]» with
 *      Martian Fiber's +2 read UNDER it (the reply names the grant it answers).
 *      Nothing is sent while the player points.
 *   2. The confirm is ONE POST. THE SCENE: the tile lands first; the museum
 *      rises out of the satellite's data cell; TWO tokens are born ON the tile
 *      that just landed (inside its hex) and fly into the museum's capsule,
 *      which reads 0 on every sample before the first touchdown, then 1, then 2;
 *      the rail's VP cell (+1 for 2 data — a derived cell) not before the second
 *      touchdown; the satellite's data cell on the card's return; Martian
 *      Fiber's +2 M€ after it. No token above the screen, nothing degraded,
 *      stranded or overflowing. The server agrees.
 *   3. THE OPPONENT (red, on the board, never reloaded) sees the tile pay —
 *      the tokens fly to BLUE's chip; blue's museum never rises on red's screen.
 *   4. A SPECIAL tile (Nuclear Zone from the hand): the composer's R3 layer
 *      names the museum (no number — the cell decides), the landing pays
 *      again: 2 → 4 on the touchdowns, VP +1 → +2 on the second.
 *   5. THE CELL BESIDE THE OCEAN: the city lands, no scene, nothing paid —
 *      what the dossier promised.
 *
 * Fixture `red-museum` (tests/e2e/fixtures/generate.ts — the cells are its own
 * constants, asserted there by a dry run).
 */

const CARD = 'Red Museum';
const FIBER = 'Martian Fiber';
const CENSUS = 'Martian Census';
const PETS = 'Pets';
const NUCLEAR_ZONE = 'Nuclear Zone';
const CLEAN = '17';
const BESIDE_OCEAN = '50';
const SPECIAL = '47';

const OUT = path.resolve('screenshots', 'red-museum');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string, resources?: number}>, victoryPointsBreakdown?: {total: number}};
  players: Array<{color: string, tableau: Array<{name: string, resources?: number}>}>;
  game: {
    gameAge: number;
    spaces: Array<{id: string, tileType?: number, color?: string}>;
    cardAdjacencyPayouts?: Array<{seq: number, cause: string, spaceId: string, card: string, target: string, amount: number, before: number,
      neighbours: Array<{spaceId: string, units: number}>, reactions?: {megacredits?: number}}>;
  };
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

const cellOf = (wire: Wire, id: string) => wire.game.spaces.find((s) => s.id === id);
const dataOn = (wire: Wire, name: string) => wire.thisPlayer.tableau.find((c) => c.name === name)?.resources ?? 0;

type Pt = {x: number, y: number};
type Box = {x: number, y: number, w: number, h: number};
type MuseumProbe = {
  samples: number;
  ticks: number;
  /** The placed cell's hex (measured at arm — the tiles' sender). */
  hex: Box;
  aux?: Box;
  tileAt?: number;
  /** Each token's first painted centre and time — and the placed hex measured in that SAME sample (the camera moves). */
  tokens: Array<{at: Pt, t: number, hex?: Box, kind: string}>;
  tokenMax: number;
  cardFirst?: {t: number, at: Pt};
  cardSeen: number;
  /** The capsule's presented count, in order, with the time it changed. */
  counts: Array<[number, string]>;
  /** The satellite's data cell, the rail's VP cell and M€ row — every value with its time. */
  aux_: Array<[number, string]>;
  /** The satellite's ANIMAL cell (Pets — the class's neighbour). */
  auxAnimal: Array<[number, string]>;
  vp: Array<[number, string]>;
  mc: Array<[number, string]>;
  /** The highest any transfer chip was painted (a token over the top edge is a defect). */
  chipMinY: number;
  chips: Array<{first: Pt, last: Pt}>;
  modes: Array<string>;
  phases: Array<string>;
  idleAt?: number;
  degraded: boolean;
  stranded: boolean;
};

/** THE SCENE PROBE — MutationObserver + setInterval, never rAF; claims about frames are made on interval ticks. */
async function armProbe(page: Page, cell: string): Promise<void> {
  await page.evaluate((cellId) => {
    const w = window as unknown as {__tr30: MuseumProbe, __tr30chips: Map<Element, {first: Pt, last: Pt}>};
    const boxOf = (el: Element | null): Box | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
    };
    const p: MuseumProbe = {
      samples: 0, ticks: 0, hex: boxOf(document.querySelector(`.board-space[data_space_id="${cellId}"]`))!,
      aux: boxOf(document.querySelector('.con-res-aux__cell[data-aux-resource="data"]')),
      tokens: [], tokenMax: 0, cardSeen: 0, counts: [], aux_: [], auxAnimal: [], vp: [], mc: [], chipMinY: Infinity, chips: [],
      modes: [], phases: [], degraded: false, stranded: false,
    };
    w.__tr30 = p;
    w.__tr30chips = new Map();
    const t0 = Date.now();
    const shown = (el: Element): boolean => {
      let node: Element | null = el;
      let opacity = 1;
      while (node !== null) {
        const cs = getComputedStyle(node);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        opacity *= Number(cs.opacity);
        node = node.parentElement;
      }
      const r = el.getBoundingClientRect();
      return opacity > 0.05 && r.width > 2 && r.height > 2;
    };
    const centre = (el: Element): Pt => {
      const r = el.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    };
    const push = (list: Array<[number, string]>, now: number, value: string) => {
      if (value !== '' && list[list.length - 1]?.[1] !== value) {
        list.push([now, value]);
      }
    };
    const seenTokens = new Set<Element>();
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const now = Date.now() - t0;
      const tile = document.querySelector(`.board-space[data_space_id="${cellId}"] > [class*="board-space-tile--"]`);
      if (tile !== null && shown(tile)) {
        p.tileAt ??= now;
      }
      const root = document.querySelector('.con-citypay');
      if (root !== null) {
        const phase = root.getAttribute('data-city-payout') ?? '';
        if (p.phases[p.phases.length - 1] !== phase) {
          p.phases.push(phase);
          if (phase === 'idle') {
            p.idleAt ??= now;
          }
        }
        const mode = root.getAttribute('data-city-payout-mode');
        if (mode !== null && !p.modes.includes(mode)) {
          p.modes.push(mode);
        }
        if (root.getAttribute('data-city-payout-degraded') !== null) {
          p.degraded = true;
        }
      } else if (p.phases.length > 0 && p.phases[p.phases.length - 1] !== 'gone') {
        p.phases.push('gone');
        p.idleAt ??= now;
      }
      const tokens = Array.from(document.querySelectorAll('.con-tileplace__oceancoin--data, .con-tileplace__oceancoin--animal'));
      p.tokenMax = Math.max(p.tokenMax, tokens.length);
      for (const el of tokens) {
        if (!seenTokens.has(el) && shown(el.querySelector('.con-tileplace__coin-body') ?? el)) {
          seenTokens.add(el);
          p.tokens.push({at: centre(el), t: now, hex: boxOf(document.querySelector(`.board-space[data_space_id="${cellId}"]`)),
            kind: el.classList.contains('con-tileplace__oceancoin--animal') ? 'animal' : 'data'});
        }
      }
      const card = document.querySelector('.con-citypay__card');
      if (card !== null && shown(card)) {
        p.cardSeen++;
        p.cardFirst ??= {t: now, at: centre(card)};
      }
      push(p.counts, now, card?.getAttribute('data-city-payout-count') ?? '');
      push(p.aux_, now, (document.querySelector('.con-res-aux__cell[data-aux-resource="data"]')?.textContent ?? '').replace(/\D/g, ''));
      push(p.auxAnimal, now, (document.querySelector('.con-res-aux__cell[data-aux-resource="animal"]')?.textContent ?? '').replace(/\D/g, ''));
      push(p.vp, now, (document.querySelector('.con-res .con-score__cell--vp .con-score__value')?.textContent ?? '').replace(/\D/g, ''));
      const mcDigits = document.querySelector('.con-res__row .resource_icon--megacredits')?.closest('.con-res__row')?.querySelector('.con-res__digits');
      push(p.mc, now, (mcDigits?.childNodes[0]?.textContent ?? '').trim());
      document.querySelectorAll('.con-transfer__chip').forEach((el) => {
        if (!shown(el)) {
          return;
        }
        const c = centre(el);
        p.chipMinY = Math.min(p.chipMinY, c.y);
        const rec = w.__tr30chips.get(el);
        if (rec === undefined) {
          w.__tr30chips.set(el, {first: c, last: c});
        } else {
          rec.last = c;
        }
      });
      p.chips = Array.from(w.__tr30chips.values());
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    window.setInterval(() => sample(true), 16);
  }, cell);
}

const readProbe = (page: Page): Promise<MuseumProbe> => page.evaluate(() => (window as unknown as {__tr30: MuseumProbe}).__tr30);

const panel = '.con-context';

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** The acceptance storyboard (opt-in): a CDP screencast of every frame the compositor produced. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
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

/** «Стандартные проекты» → the City row → A: the board takes the pick (pay-on-commit — nothing is paid yet). */
async function openCityProject(page: Page): Promise<void> {
  await pressUntil(page, 'Comma', async () => await page.locator('.con-quick, .con-stdp').count() > 0, {tries: 3, settleMs: 1100});
  if (await page.locator('.con-stdp').count() === 0) {
    await press(page, 'Enter', 1400);
  }
  await expect(page.locator('.con-stdp'), 'the standard projects opened').toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
  const focusedRow = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 6 && !/^Город/i.test((await focusedRow()).trim()); i++) {
    await press(page, 'ArrowUp', 200);
  }
  for (let i = 0; i < snake.length && !/^Город/i.test((await focusedRow()).trim()); i++) {
    await press(page, snake[i], 240);
  }
  expect((await focusedRow()).trim(), 'the City row is focused').toMatch(/^Город/i);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 3, settleMs: 2000}),
    'A on «Город» hands the pick to the board').toBe(true);
  await settle(page, {timeoutMs: 20_000});
}

/** The lock and the confirm of the cell the cursor stands on (two presses — the second past the dwell). */
async function confirmCell(page: Page): Promise<void> {
  await press(page, 'Enter', 420);
  await expect(page.locator('.con-bcur--locked'), 'A locks the cell').toHaveCount(1);
  await page.keyboard.press('Enter');
}

/** Open the hand from board home and descend into the card's play composer. */
async function openComposer(page: Page, card: string): Promise<void> {
  const hand = page.locator('.con-hand');
  for (let i = 0; i < 4 && await hand.count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `never focused «${card}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  for (let i = 0; i < 4 && await page.locator('.con-composer--play').count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await page.locator('.con-composer--play').waitFor({timeout: 15_000});
  await settle(page);
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: Pt, b: Box, slack: number) => p.x >= b.x - slack && p.x <= b.x + b.w + slack && p.y >= b.y - slack && p.y <= b.y + b.h + slack;
const firstAt = (list: Array<[number, string]>, value: string) => list.find(([, v]) => v === value)?.[0];

/** The own scene's order, read off the probe — every claim the contract makes. */
function expectOwnScene(probe: MuseumProbe, from: number, label: string): void {
  const to = from + 2;
  expect(probe.ticks, `${label}: the probe sampled`).toBeGreaterThan(10);
  expect(probe.degraded, `${label}: the scene never degraded`).toBe(false);
  expect(probe.stranded, `${label}: nothing stranded`).toBe(false);
  expect(probe.modes, `${label}: the own scene`).toEqual(['own']);
  expect(probe.phases, `${label}: the beats in order: ${probe.phases.join('→')}`).toEqual(expect.arrayContaining(['rising', 'paying', 'reading', 'returning']));
  // The tile goes first; the card comes OUT of the satellite's data cell.
  expect(probe.tileAt, `${label}: the tile painted`).toBeDefined();
  expect(probe.cardFirst, `${label}: the museum rose`).toBeDefined();
  expect(probe.tileAt!, `${label}: the tile sat before the museum rose`).toBeLessThan(probe.cardFirst!.t);
  expect(probe.aux, `${label}: the satellite's data cell was on screen`).toBeDefined();
  const auxCentre = {x: probe.aux!.x + probe.aux!.w / 2, y: probe.aux!.y + probe.aux!.h / 2};
  const hexCentre = {x: probe.hex.x + probe.hex.w / 2, y: probe.hex.y + probe.hex.h / 2};
  expect(dist(probe.cardFirst!.at, auxCentre), `${label}: the card is born at the satellite cell (${JSON.stringify(probe.cardFirst)}, cell ${JSON.stringify(probe.aux)})`)
    .toBeLessThan(dist(probe.cardFirst!.at, hexCentre));
  // TWO tokens, both born ON the tile that just landed — never on a neighbour, never from a synthetic point.
  expect(probe.tokens.length, `${label}: two tokens: ${JSON.stringify(probe.tokens)}`).toBe(2);
  for (const token of probe.tokens) {
    expect(inside(token.at, token.hex ?? probe.hex, 2), `${label}: a token is born inside the placed hex (${JSON.stringify(token.at)} in ${JSON.stringify(token.hex)})`).toBe(true);
    expect(token.t, `${label}: born after the tile sat`).toBeGreaterThan(probe.tileAt!);
  }
  expect(probe.chipMinY, `${label}: no token above the screen`).toBeGreaterThanOrEqual(0);
  // The capsule: «from» on every sample before the first touchdown, then one by one.
  expect(probe.counts.map(([, v]) => v), `${label}: the capsule counts on the touchdowns: ${JSON.stringify(probe.counts)}`)
    .toEqual([String(from), String(from + 1), String(to)]);
  const second = firstAt(probe.counts, String(to))!;
  // The rail's VP cell (+1 for 2 data — derived): never before the second touchdown.
  const vp0 = probe.vp[0]?.[1];
  const vpUp = probe.vp.find(([, v]) => v !== vp0);
  expect(vpUp, `${label}: the VP cell ticked: ${JSON.stringify(probe.vp)}`).toBeDefined();
  expect(Number(vpUp![1]), `${label}: by the museum's point`).toBe(Number(vp0) + 1);
  expect(vpUp![0], `${label}: the VP cell ticks with the second touchdown, never before (${JSON.stringify(probe.vp)} · counts ${JSON.stringify(probe.counts)})`)
    .toBeGreaterThanOrEqual(second);
  // The satellite's data cell: on the card's return, never before the last touchdown.
  const auxUp = probe.aux_.find(([, v]) => Number(v) >= to);
  expect(auxUp, `${label}: the satellite cell reached ${to}: ${JSON.stringify(probe.aux_)}`).toBeDefined();
  expect(auxUp![0], `${label}: the satellite ticks after the last touchdown`).toBeGreaterThanOrEqual(second);
  // Martian Fiber's +2 M€: a beat after the card went home.
  const mcTicks = probe.mc.map(([t, v]) => [t, Number(v.replace(/\D/g, ''))] as [number, number]);
  const rose = mcTicks.findIndex(([, v], i) => i > 0 && v > mcTicks[i - 1][1]);
  expect(rose, `${label}: Martian Fiber's M€ landed: ${JSON.stringify(probe.mc)}`).toBeGreaterThan(0);
  expect(mcTicks[rose][1] - mcTicks[rose - 1][1], `${label}: +2 M€`).toBe(2);
  expect(mcTicks[rose][0], `${label}: Martian Fiber after the satellite tick`).toBeGreaterThanOrEqual(auxUp![0]);
}

for (const preset of PRESETS) {
  test.describe(`TR30 Red Museum · the tile pays · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the dossier on both cells → ONE POST → the tile pays the museum → Nuclear Zone pays again (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.url());
        }
      });

      const {playerId, seats} = await bootFixtureSeats(page, request, 'red-museum', {query: preset.query});
      const red = seats[1];
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect(dataOn(before, CARD), 'the fixture: the museum holds 0 data').toBe(0);

      // THE SECOND CLIENT — red, on the board.
      const redPage = await context.newPage();
      const redErrors: Array<string> = [];
      redPage.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(redPage, red, preset.query);
      await settle(redPage, {timeoutMs: 30_000});
      const redOnBoard = () => redPage.evaluate(() => {
        const start = document.querySelector<HTMLElement>('.con-start__frame');
        const board = document.querySelector<HTMLElement>('.con-board');
        return (start === null || start.offsetParent === null) && board !== null && board.offsetParent !== null;
      });
      expect(await pressUntil(redPage, 'Escape', redOnBoard, {tries: 4, settleMs: 1200}), 'red stands on the board').toBe(true);
      await settle(redPage, {timeoutMs: 20_000});
      await page.bringToFront();

      // ── 1. THE DOSSIER — a named NO beside the ocean, the payout and its answer on the clean cell ──
      await openCityProject(page);
      const postsBefore = posts.length;
      await walkToSpace(page, BESIDE_OCEAN);
      await expect(page.locator(panel), 'beside the ocean: a NAMED no, the kind and the count').toContainText(/Рядом 1 океан — данных не будет/, {timeout: 15_000});
      await expect(page.locator(panel), 'the museum names itself on the NO').toContainText('Красный музей');
      await expect(page.locator(`${panel} [data-dossier-reaction]`), 'no answer of the table for a payout that does not happen').toHaveCount(0);
      await shoot(page, preset.id, '01-dossier-beside-ocean');
      await walkToSpace(page, CLEAN);
      await expect(page.locator(panel), 'the clean cell: the museum pays').toContainText('Рядом нет озеленения и океана', {timeout: 15_000});
      await expect(page.locator(`${panel} [data-dossier-reaction]`), 'Martian Fiber +2 under the museum\'s row (the reply names its cause)')
        .toContainText(/Марсианское оптоволокно\s*\+2/);
      await expect(page.locator(`${panel} .con-context__sec--reactions`), 'no second head for the same answer').toHaveCount(0);
      const panelFit = await page.evaluate(() => {
        const scroller = document.querySelector('.con-inspector') as HTMLElement | null;
        return scroller === null ? -1 : scroller.scrollHeight - scroller.clientHeight;
      });
      expect(panelFit, 'the dossier of the clean cell does not scroll').toBeLessThanOrEqual(2);
      await shoot(page, preset.id, '02-dossier-clean');
      expect(posts.length, 'pointing sends nothing').toBe(postsBefore);

      // ── 2. THE COMMIT — ONE POST, then the tile pays ──
      await armProbe(page, CLEAN);
      await armProbe(redPage, CLEAN);
      const stopOwn = await storyboard(page, preset.id, 'own');
      const stopRed = await storyboard(redPage, preset.id, 'opponent');
      await confirmCell(page);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), CLEAN)?.tileType,
        {timeout: 30_000, message: 'the city never reached the clean cell on the server'}).toBe(TileType.CITY);
      expect(posts.length - postsBefore, `exactly ONE POST: ${posts.slice(postsBefore).join(', ')}`).toBe(1);
      await expect.poll(async () => (await readProbe(page)).idleAt, {timeout: 40_000, message: 'the museum\'s scene never ended'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stopOwn();
      const own = await readProbe(page);
      await shoot(page, preset.id, '03-after-city');
      expectOwnScene(own, 0, 'the city');
      test.info().annotations.push({type: 'tr30-scene', description: `${preset.id}: tile ${own.tileAt}ms · card ${own.cardFirst?.t}ms · tokens ${JSON.stringify(own.tokens.map((t) => t.t))} · counts ${JSON.stringify(own.counts)} · vp ${JSON.stringify(own.vp)} · aux ${JSON.stringify(own.aux_)} · M€ ${JSON.stringify(own.mc)} · idle ${own.idleAt}ms`});

      // The server agrees.
      const after = await wireOf(request, playerId);
      expect(cellOf(after, CLEAN), 'blue\'s city stands on the clean cell').toMatchObject({tileType: TileType.CITY, color: viewer});
      expect(dataOn(after, CARD), '0 → 2 data on the museum').toBe(2);
      expect(dataOn(after, FIBER), 'nothing spread onto the other holder').toBe(0);
      expect(after.thisPlayer.megacredits, '25 M€ paid, Martian Fiber +2').toBe(before.thisPlayer.megacredits - 25 + 2);
      const record = (after.game.cardAdjacencyPayouts ?? []).find((r) => r.spaceId === CLEAN);
      expect(record, 'the record').toMatchObject({cause: 'tile-placed', card: CARD, target: CARD, amount: 2, before: 0, reactions: {megacredits: 2}});
      expect(record!.neighbours, 'the TILE sends both units').toEqual([{spaceId: CLEAN, units: 2}]);
      await expect(page.locator('.con-ws'), 'the flow ends on the board').toHaveCount(0, {timeout: 20_000});

      // ── 3. THE OPPONENT — the tokens go to blue's chip; blue's museum never rises on red's screen ──
      await expect.poll(async () => (await readProbe(redPage)).idleAt, {timeout: 40_000, message: 'red never saw the tile pay'}).toBeDefined();
      await stopRed();
      const remote = await readProbe(redPage);
      expect(remote.modes, 'red plays the REMOTE scene').toEqual(['remote']);
      expect(remote.degraded, 'red\'s scene never degraded').toBe(false);
      expect(remote.cardSeen, 'blue\'s card never rises on red\'s screen').toBe(0);
      expect(remote.tokens.length, `red sees the two tokens (${JSON.stringify(remote.tokens)})`).toBe(2);
      for (const token of remote.tokens) {
        expect(inside(token.at, token.hex ?? remote.hex, 2), `red: a token is born inside the placed hex (${JSON.stringify(token.at)} in ${JSON.stringify(token.hex)})`).toBe(true);
        expect(token.t, 'red: after the tile sat').toBeGreaterThan(remote.tileAt ?? 0);
      }
      const blueChip = await redPage.evaluate((color) => {
        const r = document.querySelector(`.con-status__player .player_bg_color_${color}`)?.getBoundingClientRect();
        return r === undefined ? undefined : {x: r.left + r.width / 2, y: r.bottom};
      }, viewer);
      expect(blueChip, 'blue\'s chip stands in red\'s status strip').toBeDefined();
      const towardBlue = remote.chips.filter((c) => dist(c.last, blueChip!) < dist(c.first, blueChip!) - 40);
      expect(towardBlue.length, `the tokens fly to blue's chip (${JSON.stringify(remote.chips)})`).toBeGreaterThanOrEqual(2);
      const redWire = await wireOf(request, red);
      expect(redWire.players.find((p) => p.color === viewer)?.tableau.find((c) => c.name === CARD)?.resources, 'red reads blue\'s museum at 2').toBe(2);
      await shoot(redPage, preset.id, '04-opponent-after');

      // ── 4. A SPECIAL TILE — Nuclear Zone from the hand: R3 names the museum, the landing pays again ──
      await page.bringToFront();
      await openComposer(page, NUCLEAR_ZONE);
      expect(await pressUntil(page, 'KeyV', async () => await page.locator('.con-composer--play [data-forecast-layer], .con-composer--play .con-efx--forecast').count() > 0,
        {tries: 3, settleMs: 1200}), 'R3 opens the effects layer').toBe(true);
      await expect(page.locator('.con-composer--play'), 'the layer names the museum (the cell decides — no number)').toContainText('Красный музей');
      await shoot(page, preset.id, '05-nz-r3');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-composer--play [data-forecast-layer], .con-composer--play .con-efx--forecast').count() === 0,
        {tries: 3, settleMs: 1100}), 'B folds the layer').toBe(true);
      const taken = () => page.evaluate(() => document.querySelector('.con-composer--submitting, .con-composer--landing') !== null ||
        document.querySelector('.con-composer--play') === null);
      for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
        await press(page, 'Enter', 300);
        await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
      }
      await expect(page.locator('.con-board--placing'), 'the staged special tile takes the board').toHaveCount(1, {timeout: 30_000});
      await settle(page, {timeoutMs: 20_000});
      await walkToSpace(page, SPECIAL);
      await expect(page.locator(panel), 'the special tile\'s clean cell pays').toContainText('Рядом нет озеленения и океана', {timeout: 15_000});
      await armProbe(page, SPECIAL);
      const stopNz = await storyboard(page, preset.id, 'special');
      await confirmCell(page);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), SPECIAL)?.tileType,
        {timeout: 30_000, message: 'Nuclear Zone never reached its cell on the server'}).toBe(TileType.NUCLEAR_ZONE);
      await expect.poll(async () => (await readProbe(page)).idleAt, {timeout: 40_000, message: 'the special tile\'s scene never ended'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stopNz();
      const special = await readProbe(page);
      await shoot(page, preset.id, '06-after-special');
      expectOwnScene(special, 2, 'Nuclear Zone');
      expect(dataOn(await wireOf(request, playerId), CARD), '2 → 4 data').toBe(4);

      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
      expect(redErrors, 'no page error for the opponent').toEqual([]);
    });

    test(`the cell beside the ocean: the named NO, no scene, nothing paid (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      const {playerId} = await bootFixtureSeats(page, request, 'red-museum', {query: preset.query});
      await openCityProject(page);
      await walkToSpace(page, BESIDE_OCEAN);
      await expect(page.locator(panel)).toContainText(/Рядом 1 океан — данных не будет/, {timeout: 15_000});
      await armProbe(page, BESIDE_OCEAN);
      await confirmCell(page);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), BESIDE_OCEAN)?.tileType,
        {timeout: 30_000, message: 'the city never reached the cell beside the ocean'}).toBe(TileType.CITY);
      await settle(page, {timeoutMs: 30_000});
      // Settled past every board beat: a scene that was going to play would have started by now.
      await expect.poll(async () => (await readProbe(page)).tileAt, {timeout: 10_000}).toBeDefined();
      const probe = await readProbe(page);
      expect(probe.phases, 'no «tile pays» scene at all').toEqual([]);
      expect(probe.tokens, 'no token').toEqual([]);
      expect(probe.aux_.every(([, v]) => v === '0' || v === ''), `the satellite stays at 0: ${JSON.stringify(probe.aux_)}`).toBe(true);
      const after = await wireOf(request, playerId);
      expect(dataOn(after, CARD), 'the museum stays at 0 — what the dossier promised').toBe(0);
      expect((after.game.cardAdjacencyPayouts ?? []).filter((r) => r.spaceId === BESIDE_OCEAN), 'no record').toEqual([]);
      await shoot(page, preset.id, '07-after-beside-ocean');
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`the class's neighbours: red's city pays blue's Martian Census and Pets AFTER it lands — PL-034 (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(360_000);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      const {playerId, seats} = await bootFixtureSeats(page, request, 'census-pets-rival', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect(dataOn(before, CENSUS), 'the fixture: the census holds 2 data').toBe(2);
      expect(dataOn(before, PETS), 'the fixture: Pets holds 1 animal').toBe(1);
      await settle(page, {timeoutMs: 30_000});
      // RED plays the City standard project on its own client; BLUE watches the board.
      const redPage = await context.newPage();
      await openConsole(redPage, seats[1], preset.query);
      await settle(redPage, {timeoutMs: 30_000});
      await openCityProject(redPage);
      await walkToSpace(redPage, CLEAN);
      await armProbe(page, CLEAN);
      await armProbe(redPage, CLEAN);
      const stopBlue = await storyboard(page, preset.id, 'rival-blue');
      await confirmCell(redPage);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), CLEAN)?.tileType,
        {timeout: 30_000, message: 'red\'s city never reached the clean cell'}).toBe(TileType.CITY);
      await expect.poll(async () => (await readProbe(page)).idleAt, {timeout: 40_000, message: 'blue never saw the city pay'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stopBlue();
      const blue = await readProbe(page);
      await shoot(page, preset.id, '08-rival-blue-after');
      // BLUE: the city lands FIRST, then each card's unit leaves it — never a count ahead of the landing (PL-034).
      expect(blue.tileAt, 'red\'s city painted on blue\'s board').toBeDefined();
      expect(blue.modes, 'blue plays the remote stage').toEqual(['remote']);
      expect(blue.degraded, 'nothing degraded').toBe(false);
      expect(blue.tokens.map((t) => t.kind).sort(), `one data and one animal token: ${JSON.stringify(blue.tokens)}`).toEqual(['animal', 'data']);
      for (const token of blue.tokens) {
        expect(inside(token.at, token.hex ?? blue.hex, 2), `a token is born inside red's city (${JSON.stringify(token.at)} in ${JSON.stringify(token.hex)})`).toBe(true);
        expect(token.t, 'born after the city landed').toBeGreaterThan(blue.tileAt!);
      }
      const dataUp = blue.aux_.find(([, v]) => Number(v) >= 3);
      const animalUp = blue.auxAnimal.find(([, v]) => Number(v) >= 2);
      expect(dataUp, `blue's data cell reached 3: ${JSON.stringify(blue.aux_)}`).toBeDefined();
      expect(animalUp, `blue's animal cell reached 2: ${JSON.stringify(blue.auxAnimal)}`).toBeDefined();
      expect(dataUp![0], `the data cell never ticks ahead of the landing (tile ${blue.tileAt}ms, data ${JSON.stringify(blue.aux_)})`).toBeGreaterThan(blue.tileAt!);
      expect(animalUp![0], `the animal cell never ticks ahead of the landing (tile ${blue.tileAt}ms, animal ${JSON.stringify(blue.auxAnimal)})`).toBeGreaterThan(blue.tileAt!);
      const firstData = blue.tokens.find((t) => t.kind === 'data')!;
      const firstAnimal = blue.tokens.find((t) => t.kind === 'animal')!;
      expect(dataUp![0], 'the data cell ticks after its token was born').toBeGreaterThan(firstData.t);
      expect(animalUp![0], 'the animal cell ticks after its token was born').toBeGreaterThan(firstAnimal.t);
      expect(firstData.t, 'the engine\'s order: the census\'s record, then Pets\'').toBeLessThan(firstAnimal.t);
      test.info().annotations.push({type: 'tr30-rival', description: `${preset.id}: tile ${blue.tileAt}ms · tokens ${JSON.stringify(blue.tokens.map((t) => [t.kind, t.t]))} · data ${JSON.stringify(blue.aux_)} · animal ${JSON.stringify(blue.auxAnimal)}`});
      // RED: its own placement's hero plays BLUE's records — the tokens go to blue's chip.
      const red = await readProbe(redPage);
      expect(red.tokens.length, `red sees both of blue's tokens (${JSON.stringify(red.tokens)})`).toBe(2);
      const blueChip = await redPage.evaluate((color) => {
        const r = document.querySelector(`.con-status__player .player_bg_color_${color}`)?.getBoundingClientRect();
        return r === undefined ? undefined : {x: r.left + r.width / 2, y: r.bottom};
      }, viewer);
      expect(blueChip, 'blue\'s chip stands in red\'s status strip').toBeDefined();
      const towardBlue = red.chips.filter((c) => dist(c.last, blueChip!) < dist(c.first, blueChip!) - 40);
      expect(towardBlue.length, `on red's screen the tokens fly to blue's chip (${JSON.stringify(red.chips)})`).toBeGreaterThanOrEqual(2);
      // The server agrees.
      const after = await wireOf(request, playerId);
      expect(dataOn(after, CENSUS), 'census 2 → 3').toBe(3);
      expect(dataOn(after, PETS), 'Pets 1 → 2').toBe(2);
      expect(pageErrors, 'no page error').toEqual([]);
    });
  });
}
