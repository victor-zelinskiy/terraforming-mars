import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, pressUntil, settle, walkToSpace} from './consoleStart';
import {TileType} from '../../src/common/TileType';

/**
 * TR21 «ДЕНДРАРИЙ» — A CARD REWARD THE CELL DECIDES
 * (docs/TURMOIL_REDUX_ARBORETUM.md).
 *
 * The contract under test, end to end against a real server, on two profiles:
 *
 *   1. THE COMPOSER asks the TARGET first — the candidate reads its live count
 *      and the RATE («· +1 за каждый соседний город»), never a guessed number;
 *      the next step is named; «Разыграть на поле» sends NOTHING.
 *   2. THE BOARD reads the choice as a choice of BENEFIT: on the rich cell the
 *      dossier says «+4 · за 4 соседних города», names the chosen card moving
 *      «2 → 6», and under it «⚡ Martian Fiber +4» (the table's answer read WITH its cause); the field lights exactly
 *      the paying cities, in the «pays now» tone, as many as the dossier names;
 *      on the quiet cell — «Соседних городов нет», no city lit. B walks back to
 *      the composer with the target intact.
 *   3. The confirm is the play's ONE POST: […, {card}, {space, stagedFor}].
 *   4. THE SCENE: the tile lands and the oxygen ticks BEFORE the first city
 *      wakes; the chosen card rises out of the satellite's data cell; FOUR
 *      tokens, each born at its own city (the stack sends two); every token
 *      flies into the card's capsule, which counts 3 → 4 → 5 → 6 on the
 *      touchdowns, never ahead; the card goes home; then Martian Fiber's M€.
 *   5. The server agrees; the flow ends on the board; nothing degraded,
 *      stranded or overflowing.
 *   6. THE OPPONENT (red, on the board) sees the cities wake and the tokens fly
 *      to BLUE's chip — blue's card never rises on red's screen.
 *
 * Fixture `arboretum` (tests/e2e/fixtures/generate.ts — the cells are its own
 * constants, asserted there by a dry run of the play).
 */

const CARD = 'Arboretum';
const CARD_RU = 'Дендрарий';
const TARGET = 'Vector Computations';
const FIBER = 'Martian Fiber';
const G = '17';
const Z = '48';
const PAYING = ['11', '16', '24'];
const STACK = '24';

const OUT = path.resolve('screenshots', 'arboretum');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, steel: number, terraformRating: number, tableau: Array<{name: string, resources?: number}>};
  game: {
    gameAge: number;
    oxygenLevel: number;
    spaces: Array<{id: string, tileType?: number, color?: string, stackHeight?: number}>;
    cardAdjacencyPayouts?: Array<{seq: number, spaceId: string, target: string, amount: number, before: number, neighbours: Array<{spaceId: string, units: number}>, reactions?: {megacredits?: number}}>;
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
type PayoutProbe = {
  samples: number;
  ticks: number;
  cities: Record<string, Box>;
  aux?: Box;
  home: Box;
  oxygen: Array<[number, string]>;
  tileAt?: number;
  firstWakeAt?: number;
  /** Each token's birth point (its first painted sample), by city. */
  tokens: Array<{city: string, at: Pt, t: number}>;
  tokenMax: number;
  /** The receiving card: its first and last painted centre, and when it was seen. */
  cardFirst?: {t: number, at: Pt};
  cardLast?: {t: number, at: Pt};
  cardSeen: number;
  /** The capsule's presented count, in order, with the time it changed. */
  counts: Array<[number, string]>;
  /** Transfer chips: first and last centre of each chip element. */
  chips: Array<{first: Pt, last: Pt, t0: number, t1: number}>;
  /** Where the payout was played (`own` / `remote`). */
  modes: Array<string>;
  phases: Array<string>;
  idleAt?: number;
  mc: Array<[number, string]>;
  degraded: boolean;
  stranded: boolean;
};

/** THE SCENE PROBE — MutationObserver + setInterval, never rAF; claims about frames are made on interval ticks. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(({g, paying}) => {
    const w = window as unknown as {__tr21: PayoutProbe, __tr21chips: Map<Element, {first: Pt, last: Pt, t0: number, t1: number}>};
    const boxOf = (el: Element | null): Box | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 ? {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height} : undefined;
    };
    const cities: Record<string, Box> = {};
    for (const id of paying) {
      cities[id] = boxOf(document.querySelector(`.board-space[data_space_id="${id}"]`))!;
    }
    const p: PayoutProbe = {
      samples: 0, ticks: 0, cities, home: boxOf(document.querySelector(`.board-space[data_space_id="${g}"]`))!,
      aux: boxOf(document.querySelector('.con-res-aux__cell[data-aux-resource="data"]')),
      oxygen: [], tokens: [], tokenMax: 0, cardSeen: 0, counts: [], chips: [], modes: [], phases: [], mc: [],
      degraded: false, stranded: false,
    };
    w.__tr21 = p;
    w.__tr21chips = new Map();
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
    const seenTokens = new Set<Element>();
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const now = Date.now() - t0;
      const ox = (document.querySelector('.wgt-icon--oxygen')?.closest('.con-status__param')?.textContent ?? '').replace(/\s+/g, '');
      if (ox !== '' && p.oxygen[p.oxygen.length - 1]?.[1] !== ox) {
        p.oxygen.push([now, ox]);
      }
      const tile = document.querySelector(`.board-space[data_space_id="${g}"] > [class*="board-space-tile--greenery"]`);
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
      document.querySelectorAll('.con-tileplace__oceanpulse--city').forEach((el) => {
        if (shown(el.querySelector('.con-tileplace__oceanpulse-wash') ?? el)) {
          p.firstWakeAt ??= now;
        }
      });
      const tokens = Array.from(document.querySelectorAll('.con-tileplace__oceancoin--data'));
      p.tokenMax = Math.max(p.tokenMax, tokens.length);
      for (const el of tokens) {
        if (!seenTokens.has(el) && shown(el.querySelector('.con-tileplace__coin-body') ?? el)) {
          seenTokens.add(el);
          const cityIndex = Number(el.getAttribute('data-city-token'));
          p.tokens.push({city: String(cityIndex), at: centre(el), t: now});
        }
      }
      const card = document.querySelector('.con-citypay__card');
      if (card !== null && shown(card)) {
        p.cardSeen++;
        const at = centre(card);
        p.cardFirst ??= {t: now, at};
        p.cardLast = {t: now, at};
      }
      const count = card?.getAttribute('data-city-payout-count') ?? null;
      if (count !== null && p.counts[p.counts.length - 1]?.[1] !== count) {
        p.counts.push([now, count]);
      }
      document.querySelectorAll('.con-transfer__chip').forEach((el) => {
        if (!shown(el)) {
          return;
        }
        const c = centre(el);
        const rec = w.__tr21chips.get(el);
        if (rec === undefined) {
          w.__tr21chips.set(el, {first: c, last: c, t0: now, t1: now});
        } else {
          rec.last = c;
          rec.t1 = now;
        }
      });
      p.chips = Array.from(w.__tr21chips.values());
      const mcDigits = document.querySelector('.con-res__row .resource_icon--megacredits')?.closest('.con-res__row')?.querySelector('.con-res__digits');
      const mc = (mcDigits?.childNodes[0]?.textContent ?? '').trim();
      if (mc !== '' && p.mc[p.mc.length - 1]?.[1] !== mc) {
        p.mc.push([now, mc]);
      }
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 16);
  }, {g: G, paying: PAYING});
}

const readProbe = (page: Page): Promise<PayoutProbe> => page.evaluate(() => (window as unknown as {__tr21: PayoutProbe}).__tr21);

const composer = '.con-composer--play';
const panel = '.con-context';
const textOf = (page: Page, selector: string) => page.evaluate((sel) =>
  (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(), selector);

/** The cells the relation layer lit for the focused cell, and the tone each wears. */
const relations = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.board-space.con-rel[data_space_id]'))
    .map((el) => `${el.getAttribute('data_space_id')}:${Array.from(el.classList).find((c) => /^con-rel--(penalty|ocean|score|reward|event)$/.test(c))?.slice(9) ?? '?'}`)
    .sort());

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

/** Open the hand from board home and descend into the card's play composer. */
async function openComposer(page: Page): Promise<void> {
  const hand = page.locator('.con-hand');
  for (let i = 0; i < 4 && await hand.count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  for (let i = 0; i < 4 && await page.locator(composer).count() === 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/** Open the composer's target step — the cursor starts on the unanswered row; never press A on the CTA. */
async function openTargetStep(page: Page): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < 4 && await step.count() === 0; i++) {
    if (await page.locator('.con-composer__cta--focused').count() > 0) {
      await press(page, 'ArrowUp', 900);
    }
    await press(page, 'Enter', 1300);
  }
  await expect(step, 'the target step opens inside the composer').toHaveCount(1, {timeout: 8000});
  await settle(page);
}

/** Walk the step's cursor onto a named candidate (the rail names the focused card). */
async function focusTarget(page: Page, name: string): Promise<void> {
  const focused = () => page.evaluate(() => document.querySelector('.con-ptsel__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
  for (const dir of ['ArrowRight', 'ArrowLeft']) {
    for (let i = 0; i < 6 && await focused() !== name; i++) {
      await press(page, dir, 500);
    }
  }
  expect(await focused(), `the step's cursor reaches «${name}»`).toBe(name);
}

/** «РАЗЫГРАТЬ НА ПОЛЕ» — one press verified by the composer's own state; then the board's cell pick. */
async function playOnTheBoard(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) === null, composer);
  for (let attempt = 0; attempt < 3 && !await taken(); attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(taken, {timeout: 2_500}).toBe(true).catch(() => undefined);
  }
  await expect(page.locator('.con-board--placing'), 'the staged greenery takes the board').toHaveCount(1, {timeout: 30_000});
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

for (const preset of PRESETS) {
  test.describe(`TR21 Arboretum · the cities pay · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`target → the rich cell / the quiet cell → B → A → the cities pay the card → the board (${preset.id})`, async ({page, request, context}) => {
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

      const {playerId, seats} = await bootFixtureSeats(page, request, 'arboretum', {query: preset.query});
      const red = seats[1];
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      expect(cellOf(before, STACK)?.stackHeight, 'the fixture: a stack of two beside G').toBe(2);
      expect(dataOn(before, TARGET), 'the fixture: the target holds 2 data').toBe(2);

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

      // ── 1. THE COMPOSER — the target first, the rate instead of a number ──
      await openComposer(page);
      await expect(page.locator(composer)).toContainText(CARD_RU);
      await openTargetStep(page);
      await focusTarget(page, TARGET);
      await expect(page.locator('.con-ptsel__rail'), 'the candidate reads its count and the rate, never a guessed «→»')
        .toContainText('+1 за каждый соседний город', {timeout: 10_000});
      expect(await textOf(page, '.con-ptsel__rail'), 'no «→ N» on a number that does not exist yet').not.toMatch(/\d\s*→\s*\d/);
      await shoot(page, preset.id, '01-target-step');
      for (let i = 0; i < 4 && await page.locator('.con-ptsel').count() > 0; i++) {
        await press(page, 'Enter', 1300);
      }
      await expect(page.locator('.con-ptsel'), 'A answers the target').toHaveCount(0, {timeout: 6000});
      await expect(page.locator(composer), 'the CTA is the staged cell\'s verb').toContainText('Разыграть на поле');
      await expect(page.locator(composer), 'the next step is named').toContainText(/озеленени/i);
      await expect(page.locator(composer), 'the chosen card stands in the summary').toContainText('Векторные вычисления');
      await shoot(page, preset.id, '02-composer');

      await playOnTheBoard(page);
      expect(posts, 'no POST before the cell\'s confirm').toEqual([]);
      expect((await wireOf(request, playerId)).game.gameAge, 'nothing reached the server').toBe(before.game.gameAge);

      // ── 2. THE BOARD — the rich cell and the quiet cell ──
      await walkToSpace(page, G);
      await expect(page.locator(panel), 'the dossier states the amount and its reason').toContainText(/За 4 соседних города/, {timeout: 15_000});
      await expect(page.locator(`${panel} [data-dossier-target]`), 'it names WHERE the data lands, and the count moving')
        .toContainText(/Векторные вычисления\s*\S*\s*2\s*→\s*6/, {timeout: 10_000});
      // The table's answer reads WITH its cause — one «⚡» line under the landing, never a section of its own.
      await expect(page.locator(`${panel} [data-dossier-reaction]`), 'Martian Fiber pays +4 M€, under the landing')
        .toContainText(/Марсианское оптоволокно\s*\+4/);
      await expect(page.locator(`${panel} .con-context__sec--reactions`), 'no second head for the same answer').toHaveCount(0);
      await expect.poll(() => relations(page), {timeout: 10_000, message: 'exactly the paying cities are lit, in the «pays now» tone'})
        .toEqual(PAYING.map((id) => `${id}:reward`).sort());
      const panelFit = await page.evaluate(() => {
        const scroller = document.querySelector('.con-inspector') as HTMLElement | null;
        return {overflow: scroller === null ? -1 : scroller.scrollHeight - scroller.clientHeight, hint: document.querySelectorAll('.con-inspector__more').length};
      });
      expect(panelFit.overflow, 'the dossier of the rich cell does not scroll').toBeLessThanOrEqual(2);
      expect(panelFit.hint).toBe(0);
      await shoot(page, preset.id, '03-rich-cell');

      await walkToSpace(page, Z);
      await expect(page.locator(panel), 'the quiet cell: the rule, no gain').toContainText('Соседних городов нет', {timeout: 15_000});
      await expect(page.locator(`${panel} [data-dossier-target]`)).toHaveCount(0);
      await expect.poll(async () => (await relations(page)).filter((r) => r.endsWith(':reward')), {timeout: 10_000, message: 'no city lit on the quiet cell'}).toEqual([]);
      await shoot(page, preset.id, '04-quiet-cell');

      // B → the composer, the target intact; forward again.
      expect(await pressUntil(page, 'Escape', async () => await page.locator(composer).count() > 0, {tries: 3, settleMs: 1400}), 'B returns to the composer').toBe(true);
      await settle(page);
      await expect(page.locator(composer), 'the chosen card survives the trip').toContainText('Векторные вычисления');
      expect(posts, 'the whole ladder sent nothing').toEqual([]);
      await playOnTheBoard(page);
      await walkToSpace(page, G);
      await expect(page.locator(panel)).toContainText(/За 4 соседних города/, {timeout: 15_000});

      // ── 3. THE COMMIT — the play's ONE POST ──
      await armProbe(page);
      await armProbe(redPage);
      const stopOwn = await storyboard(page, preset.id, 'own');
      const stopRed = await storyboard(redPage, preset.id, 'opponent');
      await press(page, 'Enter', 420);
      await expect(page.locator('.con-bcur--locked')).toHaveCount(1);
      await page.keyboard.press('Enter');
      await expect.poll(async () => cellOf(await wireOf(request, playerId), G)?.tileType,
        {timeout: 30_000, message: 'the greenery never reached G on the server'}).toBe(TileType.GREENERY);
      expect(posts.length, `exactly ONE POST: ${posts.map((p) => p.url).join(', ')}`).toBe(1);
      expect(posts[0].url).toMatch(/\/player\/input-batch/);
      expect(posts[0].body, 'the target rides the batch').toContain(JSON.stringify({type: 'card', cards: [TARGET]}));
      expect(posts[0].body, 'the cell is the tail, addressed to the card').toContain(JSON.stringify({type: 'space', spaceId: G, stagedFor: CARD}));

      // ── 4. THE SCENE (own) ──
      await expect.poll(async () => (await readProbe(page)).idleAt, {timeout: 40_000, message: 'the cities\' scene never ended'}).toBeDefined();
      await settle(page, {timeoutMs: 30_000});
      await stopOwn();
      const own = await readProbe(page);
      await shoot(page, preset.id, '05-after');
      expect(own.ticks, 'the probe sampled').toBeGreaterThan(10);
      expect(own.degraded, 'the scene never degraded').toBe(false);
      expect(own.modes, 'the own scene').toEqual(['own']);
      expect(own.phases, `the scene's beats in order: ${own.phases.join('→')}`).toEqual(expect.arrayContaining(['rising', 'paying', 'reading', 'returning']));
      // The tile and the oxygen go FIRST — the field's own beats.
      expect(own.tileAt, 'the greenery painted').toBeDefined();
      expect(own.firstWakeAt, 'a city woke').toBeDefined();
      expect(own.tileAt!, 'the tile sat before the first city answered').toBeLessThan(own.firstWakeAt!);
      expect(own.oxygen.length, `the oxygen ticked: ${JSON.stringify(own.oxygen)}`).toBeGreaterThanOrEqual(2);
      expect(own.oxygen[1][0], 'the oxygen ticked before the first city answered').toBeLessThan(own.firstWakeAt!);
      // The card rose out of the satellite's data cell, and went home to it.
      expect(own.aux, 'the satellite\'s data cell was on screen').toBeDefined();
      expect(own.cardFirst, 'the receiving card was seen').toBeDefined();
      const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
      const stand = own.cardLast!;
      expect(dist(own.cardFirst!.at, own.aux!), `the card is born at the satellite cell (first ${JSON.stringify(own.cardFirst)}, cell ${JSON.stringify(own.aux)})`)
        .toBeLessThan(dist(own.cardFirst!.at, own.home));
      // Four tokens, each born AT its own city (the stack's city sends two).
      expect(own.tokenMax, 'four tokens were staged').toBe(4);
      expect(own.tokens.length, `every token was seen: ${JSON.stringify(own.tokens)}`).toBe(4);
      // (the token's city is the record's own neighbour order — read below from the server, never guessed)
      // Each flight: the source seen, the destination seen, movement between them — and the capsule counts on the touchdowns.
      const dataChips = own.chips.filter((c) => dist(c.first, own.home) < own.home.w * 3);
      expect(dataChips.length, `the tokens flew (chips ${JSON.stringify(own.chips)})`).toBeGreaterThanOrEqual(4);
      for (const chip of dataChips.slice(0, 4)) {
        expect(dist(chip.first, chip.last), 'a chip moved').toBeGreaterThan(20);
      }
      expect(own.counts.map((c) => c[1]), `the capsule counts on the touchdowns, never ahead: ${JSON.stringify(own.counts)}`).toEqual(['2', '3', '4', '5', '6']);
      expect(stand, 'the card was seen standing').toBeDefined();
      // Martian Fiber's M€ after the card went home.
      const mcTicks = own.mc.map(([t, v]) => [t, Number(v.replace(/\D/g, ''))] as [number, number]);
      const rose = mcTicks.findIndex(([, v], i) => i > 0 && v > mcTicks[i - 1][1]);
      expect(rose, `the rail's M€ rose after the payout: ${JSON.stringify(own.mc)}`).toBeGreaterThan(0);
      const returning = own.counts.length > 0 ? own.counts[own.counts.length - 1][0] : 0;
      expect(mcTicks[rose][0], 'Martian Fiber\'s M€ lands after the last token').toBeGreaterThan(returning);
      test.info().annotations.push({type: 'tr21-scene', description: `${preset.id}: tile ${own.tileAt}ms · first wake ${own.firstWakeAt}ms · counts ${JSON.stringify(own.counts)} · idle ${own.idleAt}ms · M€ ${JSON.stringify(own.mc)}`});

      // ── 5. THE SERVER agrees; the flow ends on the board ──
      const after = await wireOf(request, playerId);
      expect(cellOf(after, G), 'the greenery stands on G').toMatchObject({tileType: TileType.GREENERY, color: viewer});
      expect(after.game.oxygenLevel, 'oxygen +1').toBe(before.game.oxygenLevel + 1);
      expect(dataOn(after, TARGET), '2 → 6 data on the chosen card').toBe(6);
      expect(dataOn(after, FIBER), 'nothing spread onto the other holder').toBe(0);
      const record = (after.game.cardAdjacencyPayouts ?? []).find((r) => r.spaceId === G);
      expect(record, 'the payout record').toMatchObject({target: TARGET, amount: 4, before: 2, reactions: {megacredits: 4}});
      expect(record!.neighbours.map((n) => `${n.spaceId}×${n.units}`).sort(), 'the paying cities: the stack counted per tier').toEqual(['11×1', '16×1', '24×2']);
      for (const token of own.tokens) {
        const id = record!.neighbours[Number(token.city)].spaceId;
        const city = own.cities[id];
        expect(dist(token.at, city), `a token of ${id} is born at ITS city (at ${JSON.stringify(token.at)}, city ${JSON.stringify(city)})`).toBeLessThan(city.w * 0.75);
      }
      expect(own.tokens.filter((t) => record!.neighbours[Number(t.city)].spaceId === STACK).length, 'the stack sends two tokens').toBe(2);
      // The ruling Greens pay 2 M€ per TR step (the dossier's «Зелёные +4»: the oxygen step + the Redux greenery tile).
      const trGained = after.thisPlayer.terraformRating - before.thisPlayer.terraformRating;
      expect(trGained, 'two TR: the oxygen step and the Redux greenery tile').toBe(2);
      expect(after.thisPlayer.megacredits, '12 M€ paid, Martian Fiber +4, the Greens +2 per TR').toBe(before.thisPlayer.megacredits - 12 + 4 + 2 * trGained);
      expect((after.cardsInHand ?? []).map((c) => c.name)).not.toContain(CARD);
      await expect(page.locator('.con-ws'), 'the flow ends on the board').toHaveCount(0, {timeout: 20_000});
      expect(own.stranded, 'nothing stranded').toBe(false);

      // ── 6. THE OPPONENT — the cities wake, the tokens go to blue's chip ──
      await expect.poll(async () => (await readProbe(redPage)).idleAt, {timeout: 40_000, message: 'red never saw the cities pay'}).toBeDefined();
      await stopRed();
      const remote = await readProbe(redPage);
      expect(remote.modes, 'red plays the REMOTE scene').toEqual(['remote']);
      expect(remote.degraded, 'red\'s scene never degraded').toBe(false);
      expect(remote.cardSeen, 'blue\'s card never rises on red\'s screen').toBe(0);
      expect(remote.tokens.length, `red sees the four tokens (seen by city ${JSON.stringify(remote.tokens.map((t) => t.city))}, mounted at most ${remote.tokenMax}, samples ${remote.samples}/${remote.ticks} ticks)`).toBe(4);
      const blueChip = await redPage.evaluate((color) => {
        const r = document.querySelector(`.con-status__player .player_bg_color_${color}`)?.getBoundingClientRect();
        return r === undefined ? undefined : {x: r.left + r.width / 2, y: r.bottom};
      }, viewer);
      expect(blueChip, 'blue\'s chip stands in red\'s status strip').toBeDefined();
      const towardBlue = remote.chips.filter((c) => dist(c.last, blueChip!) < dist(c.first, blueChip!) - 40);
      expect(towardBlue.length, `the tokens fly to blue's chip (${JSON.stringify(remote.chips)})`).toBeGreaterThanOrEqual(4);
      await shoot(redPage, preset.id, '06-opponent-after');

      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
      expect(redErrors, 'no page error for the opponent').toEqual([]);
    });
  });
}

