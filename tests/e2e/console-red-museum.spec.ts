import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, confirmLockedPlacement, fetchPlayerModel, focusCard, openConsole, press, pressUntil, settle, walkToSpace} from './consoleStart';
import {TileType} from '../../src/common/TileType';
import {armWitness, Witness} from './witness';
import {readSettled} from './settledRead';

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
 *      rises out of the satellite's data cell; TWO tokens are born on the risen
 *      museum's printed icon (the card-reaction framework — the tile that just
 *      landed is the cause) and fly into the museum's capsule,
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
  /** The recorded observations — the probe's own liveness floor (a dead recorder records nothing). */
  samples: number;
  /** The placed cell's hex (measured at arm — the tiles' sender). */
  hex: Box;
  aux?: Box;
  tileAt?: number;
  /** Each token's first painted centre and time — and the placed hex measured in that SAME sample (the camera moves). */
  tokens: Array<{at: Pt, t: number, hex?: Box, card?: Box, kind: string}>;
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
  /** The rail's TR cell — the VP cell carries the TR too, so a VP claim is read net of the rating's own ticks. */
  tr: Array<[number, string]>;
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

/** ONE frame of the «tile pays» scene as the page paints it — the observation the scene probe records. */
type MuseumFrame = {
  /** The placed cell's hex and the satellite's data cell (null: no box). */
  hex: Box | null;
  aux: Box | null;
  /** The placed cell paints a tile. */
  tile: boolean;
  /** The scene's root: its phase (null: no root), its mode, whether it degraded. */
  phase: string | null;
  mode: string | null;
  degraded: boolean;
  /** Every token element, and the ones painted (identity kept across frames). */
  tokenCount: number;
  tokens: Array<{id: number, at: Pt, kind: string}>;
  /** The risen holder's plate: its box, and its centre when painted. */
  cardBox: Box | null;
  card: Pt | null;
  count: string;
  aux_: string;
  auxAnimal: string;
  vp: string;
  tr: string;
  mc: string;
  /** The painted transfer chips (identity kept across frames). */
  chips: Array<{id: number, at: Pt}>;
  stranded: boolean;
};

/** The page reader of the scene probe (self-contained — serialized into the page; element identity is a WeakMap there). */
function readMuseumFrame({cellId, dataKey}: {cellId: string, dataKey: string}): MuseumFrame {
  const w = window as unknown as {__tr30ids?: WeakMap<Element, number>, __tr30seq?: number};
  const ids = w.__tr30ids ?? (w.__tr30ids = new WeakMap());
  const idOf = (el: Element): number => {
    let id = ids.get(el);
    if (id === undefined) {
      id = (w.__tr30seq ?? 0) + 1;
      w.__tr30seq = id;
      ids.set(el, id);
    }
    return id;
  };
  const boxOf = (el: Element | null): Box | null => {
    if (el === null) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? {x: r.left, y: r.top, w: r.width, h: r.height} : null;
  };
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
  const digits = (sel: string): string => (document.querySelector(sel)?.textContent ?? '').replace(/\D/g, '');
  const tile = document.querySelector(`.board-space[data_space_id="${cellId}"] > [class*="board-space-tile--"]`);
  const root = document.querySelector('.con-citypay');
  const tokens = Array.from(document.querySelectorAll('.con-tileplace__oceancoin--data, .con-tileplace__oceancoin--animal'));
  const card = document.querySelector('.con-citypay__card');
  const mcDigits = document.querySelector('.con-res__row .resource_icon--megacredits')?.closest('.con-res__row')?.querySelector('.con-res__digits');
  return {
    hex: boxOf(document.querySelector(`.board-space[data_space_id="${cellId}"]`)),
    aux: boxOf(document.querySelector(`.con-res-aux__cell[data-aux-resource="${dataKey}"]`)),
    tile: tile !== null && shown(tile),
    phase: root === null ? null : root.getAttribute('data-city-payout') ?? '',
    mode: root?.getAttribute('data-city-payout-mode') ?? null,
    degraded: root !== null && root.getAttribute('data-city-payout-degraded') !== null,
    tokenCount: tokens.length,
    tokens: tokens.filter((el) => shown(el.querySelector('.con-tileplace__coin-body') ?? el)).map((el) => ({
      id: idOf(el), at: centre(el), kind: el.classList.contains('con-tileplace__oceancoin--animal') ? 'animal' : 'data',
    })),
    cardBox: boxOf(card),
    card: card !== null && shown(card) ? centre(card) : null,
    count: card?.getAttribute('data-city-payout-count') ?? '',
    aux_: digits(`.con-res-aux__cell[data-aux-resource="${dataKey}"]`),
    auxAnimal: digits('.con-res-aux__cell[data-aux-resource="animal"]'),
    vp: digits('.con-res .con-score__cell--vp .con-score__value'),
    tr: digits('.con-res .con-score__cell--tr .con-score__value'),
    mc: (mcDigits?.childNodes[0]?.textContent ?? '').trim(),
    chips: Array.from(document.querySelectorAll('.con-transfer__chip')).filter(shown).map((el) => ({id: idOf(el), at: centre(el)})),
    stranded: document.querySelector('.con-stranded') !== null,
  };
}

/**
 * THE SCENE PROBE — a RECORDING of the product's own writes (`armWitness`: the observer + the frame tick, replace-proof),
 * armed above the confirm; the claims are folded on the Node side. Its claims are about ORDER and about what a frame
 * shows at once (the VP cell net of the TR cell's own ticks), so the record is `settled`: every sample is the state a
 * task LEAVES — what a frame can paint.
 * `dataKey` is the satellite cell the paid data lands on: the museum's plain `data` chip, or — for a holder whose
 * role CLAIMS something about every unit (TR15 Martian Census: a delegate per data) — its own split chip
 * `data:delegate` (PL-030; the plain `data` address beside it is Martian Fiber's, standing at 0 for good).
 */
async function armProbe(page: Page, cell: string, dataKey = 'data'): Promise<Witness<MuseumFrame>> {
  return armWitness(page, `tr30-scene-${cell}-${dataKey}`, readMuseumFrame, {args: {cellId: cell, dataKey}, settled: true, max: 50_000});
}

/** The fold of the recording — the scene's facts, on the page's clock (`t` relative to the arm). */
async function readProbe(witness: Witness<MuseumFrame>): Promise<MuseumProbe> {
  const samples = await witness.samples();
  const t0 = samples[0]?.t ?? 0;
  const first = samples[0]?.v;
  const p: MuseumProbe = {
    samples: samples.length, hex: first?.hex ?? {x: 0, y: 0, w: 0, h: 0}, aux: first?.aux ?? undefined,
    tokens: [], tokenMax: 0, cardSeen: 0, counts: [], aux_: [], auxAnimal: [], vp: [], tr: [], mc: [], chipMinY: Infinity, chips: [],
    modes: [], phases: [], degraded: false, stranded: false,
  };
  const push = (list: Array<[number, string]>, now: number, value: string) => {
    if (value !== '' && list[list.length - 1]?.[1] !== value) {
      list.push([now, value]);
    }
  };
  const seenTokens = new Set<number>();
  const chips = new Map<number, {first: Pt, last: Pt}>();
  for (const {t, v} of samples) {
    const now = t - t0;
    if (v.tile) {
      p.tileAt ??= now;
    }
    if (v.phase !== null) {
      if (p.phases[p.phases.length - 1] !== v.phase) {
        p.phases.push(v.phase);
        if (v.phase === 'idle') {
          p.idleAt ??= now;
        }
      }
      if (v.mode !== null && !p.modes.includes(v.mode)) {
        p.modes.push(v.mode);
      }
      p.degraded ||= v.degraded;
    } else if (p.phases.length > 0 && p.phases[p.phases.length - 1] !== 'gone') {
      p.phases.push('gone');
      p.idleAt ??= now;
    }
    p.tokenMax = Math.max(p.tokenMax, v.tokenCount);
    for (const token of v.tokens) {
      if (!seenTokens.has(token.id)) {
        seenTokens.add(token.id);
        // The risen holder's plate and the placed hex, measured in the SAME sample — its printed icon is the birth place (CN).
        p.tokens.push({at: token.at, t: now, hex: v.hex ?? undefined, card: v.cardBox ?? undefined, kind: token.kind});
      }
    }
    if (v.card !== null) {
      p.cardSeen++;
      p.cardFirst ??= {t: now, at: v.card};
    }
    push(p.counts, now, v.count);
    push(p.aux_, now, v.aux_);
    push(p.auxAnimal, now, v.auxAnimal);
    push(p.vp, now, v.vp);
    push(p.tr, now, v.tr);
    push(p.mc, now, v.mc);
    for (const chip of v.chips) {
      p.chipMinY = Math.min(p.chipMinY, chip.at.y);
      const rec = chips.get(chip.id);
      if (rec === undefined) {
        chips.set(chip.id, {first: chip.at, last: chip.at});
      } else {
        rec.last = chip.at;
      }
    }
    p.stranded ||= v.stranded;
  }
  p.chips = [...chips.values()];
  return p;
}

/** The bottom-centre of a seat's chip in the status strip (undefined: no chip). */
async function seatChipFoot(page: Page, color: string): Promise<Pt | undefined> {
  return page.evaluate((color) => {
    const r = document.querySelector(`.con-status__player .player_bg_color_${color}`)?.getBoundingClientRect();
    return r === undefined ? undefined : {x: r.left + r.width / 2, y: r.bottom};
  }, color);
}

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
  await confirmLockedPlacement(page); // confirm — past the lock's dwell (the driver waits it out)
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
/** A token's honest source in the OWN scene: the risen holder's plate (its printed icon), else the tile that landed. */
const bornOnHolderOrTile = (token: {at: Pt, hex?: Box, card?: Box}, armHex: Box): boolean =>
  (token.card !== undefined && inside(token.at, token.card, 2)) || inside(token.at, token.hex ?? armHex, 2);
const firstAt = (list: Array<[number, string]>, value: string) => list.find(([, v]) => v === value)?.[0];

/**
 * The VP cell NET of the rating cell's own ticks, on the samples' clock. The VP cell carries the TR, and both cells read
 * the ONE rating hold (`docs/claude/console/score-cell.md` § the seeder — «the TR is the rating cell's own»), so a TR
 * tick moves both in the same sample and nets out; a VP tick a frame apart from its TR tick would surface here as a value
 * the net never had.
 */
function vpNetOfRating(probe: MuseumProbe): Array<[number, number]> {
  const valueAt = (list: Array<[number, string]>, t: number): number => Number([...list].reverse().find(([at]) => at <= t)?.[1]);
  const tr0 = Number(probe.tr[0]?.[1]);
  const times = [...new Set([...probe.vp, ...probe.tr].map(([t]) => t))].sort((a, b) => a - b);
  const net: Array<[number, number]> = [];
  for (const t of times) {
    const value = valueAt(probe.vp, t) - (valueAt(probe.tr, t) - tr0);
    if (!Number.isNaN(value) && net[net.length - 1]?.[1] !== value) {
      net.push([t, value]);
    }
  }
  return net;
}

/** The own scene's order, read off the probe — every claim the contract makes. */
/**
 * `cardVp`: the PRINTED points of the card a staged play laid down with this tile (Nuclear Zone's −2) — TR55, the
 * score cell: they leave as their own token from the sealed tile after the card's gains, BEFORE the museum's scene, and
 * the cell ticks on that token (a loss on its departure); the museum's point then ticks on its second data touchdown.
 */
function expectOwnScene(probe: MuseumProbe, from: number, label: string, cardVp = 0, tableAnswer = 0): void {
  const to = from + 2;
  expect(probe.samples, `${label}: the probe sampled`).toBeGreaterThan(0);
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
  // TWO tokens, each born on the RISEN HOLDER's printed icon (card reaction, iteration 2 — 3c6d335c55: the holder card is
  // the reactor, its plate rising by the field) or, for a face that prints no such icon, on the tile that just landed —
  // never on a neighbour, never from a synthetic point.
  expect(probe.tokens.length, `${label}: two tokens: ${JSON.stringify(probe.tokens)}`).toBe(2);
  for (const token of probe.tokens) {
    expect(bornOnHolderOrTile(token, probe.hex), `${label}: a token is born on the risen holder's icon or inside the placed hex (${JSON.stringify(token.at)} · card ${JSON.stringify(token.card)} · hex ${JSON.stringify(token.hex)})`).toBe(true);
    expect(token.t, `${label}: born after the tile sat`).toBeGreaterThan(probe.tileAt!);
  }
  expect(probe.chipMinY, `${label}: no token above the screen`).toBeGreaterThanOrEqual(0);
  // The capsule: «from» on every sample before the first touchdown, then one by one.
  expect(probe.counts.map(([, v]) => v), `${label}: the capsule counts on the touchdowns: ${JSON.stringify(probe.counts)}`)
    .toEqual([String(from), String(from + 1), String(to)]);
  const second = firstAt(probe.counts, String(to))!;
  // The rail's VP cell (+1 for 2 data — derived): never before the second touchdown. It is read NET of the TR cell's own
  // ticks (`vpNetOfRating`): a staged tile's TR (Nuclear Zone's two temperature steps) lands with the board's own scale
  // beat, before anything else, and the VP cell carries it in the same frame — the rating is the rating cell's own
  // cause. What is left must move by the card's printed points on their own token (TR55 — after the tile sat, before the
  // museum rose) and then by the museum's point, and by nothing else.
  const why = `vp ${JSON.stringify(probe.vp)} · tr ${JSON.stringify(probe.tr)} · counts ${JSON.stringify(probe.counts)} · tile ${probe.tileAt}`;
  const net = vpNetOfRating(probe);
  const vp0 = net[0][1];
  expect(net.map(([, v]) => v), `${label}: the VP cell, net of the TR's own ticks, moves only by the card's ${cardVp} and then the museum's +1 — ${why}`)
    .toEqual(cardVp === 0 ? [vp0, vp0 + 1] : [vp0, vp0 + cardVp, vp0 + cardVp + 1]);
  if (cardVp !== 0) {
    const sealed = net[1][0];
    expect(sealed, `${label}: the card's printed points left the tile only after it sat — ${why}`).toBeGreaterThan(probe.tileAt!);
    expect(sealed, `${label}: …and before the museum rose (${probe.cardFirst!.t} ms) — ${why}`).toBeLessThan(probe.cardFirst!.t);
  }
  expect(net[net.length - 1][0], `${label}: the museum's point ticks with the second touchdown, never before — ${why}`)
    .toBeGreaterThanOrEqual(second);
  // The satellite's data cell: on the card's return, never before the last touchdown.
  const auxUp = probe.aux_.find(([, v]) => Number(v) >= to);
  expect(auxUp, `${label}: the satellite cell reached ${to}: ${JSON.stringify(probe.aux_)}`).toBeDefined();
  expect(auxUp![0], `${label}: the satellite ticks after the last touchdown`).toBeGreaterThanOrEqual(second);
  // Martian Fiber's +2 M€: a beat after the card went home — i.e. AFTER the satellite's tick, inside the scene (its
  // «answering» phase). Judged by STATE: what the row gains from the satellite tick to the scene's end is +2 in all, only
  // rising (a reactor's answer may land as one token per unit).
  // THE TABLE'S ANSWER COMES AFTER THE BOARD'S STORY (card-reaction law: the standalone chain plays after the board's own
  // story): a staged tile's TR (Nuclear Zone's two temperature steps) is answered by the ruling Greens' 2 M€ per rating,
  // and that answer rises only once the museum's scene is GONE — never before the satellite tick, never inside the scene.
  // (CI 2026-11-04: the order used to be the machine's — «17 → 10 → 11 → 12 → 13 → 14 → 16» on a fast frame, the Greens
  // cutting into the scene, «17 → 10 → 12 → 13 → … → 16» on a slow one; the chain now waits for an OWED board scene too.)
  const mcTicks = probe.mc.map(([t, v]) => [t, Number(v.replace(/\D/g, ''))] as [number, number]);
  const sceneEnd = probe.idleAt!;
  const beforeSatellite = mcTicks.filter(([t]) => t < auxUp![0]);
  expect(beforeSatellite.every(([, v], i) => i === 0 || v <= beforeSatellite[i - 1][1]),
    `${label}: nothing rises on the M€ row before the satellite tick (only the price falls) — the table answers after the scene: ${JSON.stringify(probe.mc)}`).toBe(true);
  const beforeFiber = beforeSatellite[beforeSatellite.length - 1];
  expect(beforeFiber, `${label}: the M€ row was read before the satellite tick: ${JSON.stringify(probe.mc)}`).toBeDefined();
  const fiber = mcTicks.filter(([t]) => t >= auxUp![0] && t <= sceneEnd).map(([, v]) => v);
  expect(fiber.length, `${label}: Martian Fiber's M€ landed after the satellite tick, inside the scene (idle ${sceneEnd}): ${JSON.stringify(probe.mc)}`).toBeGreaterThan(0);
  expect(fiber.every((v, i) => v > (i === 0 ? beforeFiber[1] : fiber[i - 1])), `${label}: the M€ row only rises with Fiber's answer: ${JSON.stringify(probe.mc)}`).toBe(true);
  expect(fiber[fiber.length - 1] - beforeFiber[1], `${label}: +2 M€ (Martian Fiber): ${JSON.stringify(probe.mc)}`).toBe(2);
  const after = mcTicks.filter(([t]) => t > sceneEnd).map(([, v]) => v);
  const answered = (after.length === 0 ? fiber[fiber.length - 1] : after[after.length - 1]) - fiber[fiber.length - 1];
  expect(after.every((v, i) => v > (i === 0 ? fiber[fiber.length - 1] : after[i - 1])), `${label}: after the scene the row only rises (the table's answer): ${JSON.stringify(probe.mc)}`).toBe(true);
  expect(answered, `${label}: the table's answer after the scene (idle ${sceneEnd}): ${JSON.stringify(probe.mc)}`).toBe(tableAnswer);
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
      // T15 · CD: the museum's payout is the TABLE's answer to the tile, so it stands in «Сработает» itself, and
      // Fiber's reply stands under it there — ONE head for the cause and its reply, never a second one for the reply.
      await expect(page.locator(`${panel} .con-context__sec--reactions`), 'no second head for the same answer').toHaveCount(1);
      await expect(page.locator(`${panel} .con-context__sec--reactions`), 'the museum row stands in «Сработает»')
        .toContainText('Рядом нет озеленения и океана');
      await expect(page.locator(`${panel} .con-context__sec--reactions [data-dossier-reaction]`), 'the reply under its cause, in the same section')
        .toContainText(/Марсианское оптоволокно\s*\+2/);
      const panelFit = await page.evaluate(() => {
        const scroller = document.querySelector('.con-inspector') as HTMLElement | null;
        return scroller === null ? -1 : scroller.scrollHeight - scroller.clientHeight;
      });
      expect(panelFit, 'the dossier of the clean cell does not scroll').toBeLessThanOrEqual(2);
      await shoot(page, preset.id, '02-dossier-clean');
      expect(posts.length, 'pointing sends nothing').toBe(postsBefore);

      // ── 2. THE COMMIT — ONE POST, then the tile pays ──
      const ownScene = await armProbe(page, CLEAN);
      const redScene = await armProbe(redPage, CLEAN);
      const stopOwn = await storyboard(page, preset.id, 'own');
      const stopRed = await storyboard(redPage, preset.id, 'opponent');
      await confirmCell(page);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), CLEAN)?.tileType,
        {timeout: 30_000, message: 'the city never reached the clean cell on the server'}).toBe(TileType.CITY);
      expect(posts.length - postsBefore, `exactly ONE POST: ${posts.slice(postsBefore).join(', ')}`).toBe(1);
      await expect.poll(async () => (await readProbe(ownScene)).idleAt, {timeout: 40_000, message: 'the museum\'s scene never ended'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stopOwn();
      const own = await readProbe(ownScene);
      await ownScene.stop(); // the scene's window is over — the special tile arms its own record below
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
      await expect.poll(async () => (await readProbe(redScene)).idleAt, {timeout: 40_000, message: 'red never saw the tile pay'}).toBeDefined();
      await stopRed();
      const remote = await readProbe(redScene);
      expect(remote.modes, 'red plays the REMOTE scene').toEqual(['remote']);
      expect(remote.degraded, 'red\'s scene never degraded').toBe(false);
      expect(remote.cardSeen, 'blue\'s card never rises on red\'s screen').toBe(0);
      expect(remote.tokens.length, `red sees the two tokens (${JSON.stringify(remote.tokens)})`).toBe(2);
      for (const token of remote.tokens) {
        expect(inside(token.at, token.hex ?? remote.hex, 2), `red: a token is born inside the placed hex (${JSON.stringify(token.at)} in ${JSON.stringify(token.hex)})`).toBe(true);
        expect(token.t, 'red: after the tile sat').toBeGreaterThan(remote.tileAt ?? 0);
      }
      // Read at rest (two equal reads a frame apart): the chip's box, not wherever a strip's re-layout had got to.
      const blueChip = await readSettled(redPage, () => seatChipFoot(redPage, viewer), {settle: false, message: 'blue\'s chip on red\'s strip'});
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
      const specialScene = await armProbe(page, SPECIAL);
      const stopNz = await storyboard(page, preset.id, 'special');
      await confirmCell(page);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), SPECIAL)?.tileType,
        {timeout: 30_000, message: 'Nuclear Zone never reached its cell on the server'}).toBe(TileType.NUCLEAR_ZONE);
      await expect.poll(async () => (await readProbe(specialScene)).idleAt, {timeout: 40_000, message: 'the special tile\'s scene never ended'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      // The table's answer plays AFTER the scene — wait for the M€ row to reach the server's number before reading.
      const serverMc = (await wireOf(request, playerId)).thisPlayer.megacredits;
      await expect.poll(async () => Number(((await readProbe(specialScene)).mc.at(-1)?.[1] ?? '').replace(/\D/g, '')),
        {timeout: 30_000, message: 'the M€ row never reached the server\'s number after the special tile'}).toBe(serverMc);
      await stopNz();
      const special = await readProbe(specialScene);
      await shoot(page, preset.id, '06-after-special');
      // The ruling Greens answer the tile's rating: 2 M€ per step of TR the rating cell gained.
      const trGain = Number(special.tr.at(-1)?.[1] ?? 0) - Number(special.tr[0]?.[1] ?? 0);
      expectOwnScene(special, 2, 'Nuclear Zone', -2, 2 * trGain);
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
      const oceanScene = await armProbe(page, BESIDE_OCEAN);
      await confirmCell(page);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), BESIDE_OCEAN)?.tileType,
        {timeout: 30_000, message: 'the city never reached the cell beside the ocean'}).toBe(TileType.CITY);
      await settle(page, {timeoutMs: 30_000});
      // Settled past every board beat: a scene that was going to play would have started by now.
      await expect.poll(async () => (await readProbe(oceanScene)).tileAt, {timeout: 10_000}).toBeDefined();
      const probe = await readProbe(oceanScene);
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
      // The census's data is a DELEGATE-role chip on blue's satellite (PL-030) — its own address, beside Fiber's plain one.
      const blueScene = await armProbe(page, CLEAN, 'data:delegate');
      const redScene = await armProbe(redPage, CLEAN);
      const stopBlue = await storyboard(page, preset.id, 'rival-blue');
      await confirmCell(redPage);
      await expect.poll(async () => cellOf(await wireOf(request, playerId), CLEAN)?.tileType,
        {timeout: 30_000, message: 'red\'s city never reached the clean cell'}).toBe(TileType.CITY);
      await expect.poll(async () => (await readProbe(blueScene)).idleAt, {timeout: 40_000, message: 'blue never saw the city pay'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stopBlue();
      const blue = await readProbe(blueScene);
      await shoot(page, preset.id, '08-rival-blue-after');
      // BLUE: the city lands FIRST, then each card's unit leaves it — never a count ahead of the landing (PL-034).
      expect(blue.tileAt, 'red\'s city painted on blue\'s board').toBeDefined();
      // TR53 iteration (К-R5, PL-413): a rival's city that pays the VIEWER's cards is the viewer's OWN scene — each
      // card rises by red's city and its unit flies out of the tile onto it (never a token into the satellite).
      expect(blue.modes, 'blue plays its OWN scene for its own cards').toEqual(['own']);
      expect(blue.cardSeen, 'blue\'s cards rise by the field').toBeGreaterThan(0);
      expect(blue.degraded, 'nothing degraded').toBe(false);
      expect(blue.tokens.map((t) => t.kind).sort(), `one data and one animal token: ${JSON.stringify(blue.tokens)}`).toEqual(['animal', 'data']);
      for (const token of blue.tokens) {
        expect(bornOnHolderOrTile(token, blue.hex), `a token is born on blue's risen holder or inside red's city (${JSON.stringify(token.at)} · card ${JSON.stringify(token.card)} · hex ${JSON.stringify(token.hex)})`).toBe(true);
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
      const red = await readProbe(redScene);
      expect(red.tokens.length, `red sees both of blue's tokens (${JSON.stringify(red.tokens)})`).toBe(2);
      // Read at rest (two equal reads a frame apart): the chip's box, not wherever a strip's re-layout had got to.
      const blueChip = await readSettled(redPage, () => seatChipFoot(redPage, viewer), {settle: false, message: 'blue\'s chip on red\'s strip'});
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
