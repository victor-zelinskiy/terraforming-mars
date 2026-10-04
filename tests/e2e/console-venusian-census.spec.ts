import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, fetchPlayerModel, focusCard, openConsole, press, pressUntil, sendPlayerInput, settle} from './consoleStart';

/**
 * TR24 «ВЕНЕРИАНСКАЯ ПЕРЕПИСЬ» — THE SCALE STEP PAYS
 * (docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md).
 *
 * The step is the CAUSE, the data its CONSEQUENCE. End to end against a real
 * server, two clients, two profiles:
 *
 *   1. RED raises Venus by «Air Scrapping» (over the API) while blue stands on
 *      the board: blue's Venus marker ARRIVES 8 → 10 % BEFORE the first token;
 *      two data tokens, the first born INSIDE the marker's box; each lands in
 *      the satellite's data cell, which reads 1 → 2 → 3 strictly on the
 *      touchdowns (1 until the first). On RED's page the same two tokens fly to
 *      blue's chip in the status strip.
 *   2. BLUE plays Spin-Inducing Asteroid from the hand: before A the composer
 *      says «Сработает» +4 and its R3 layer names the census; A → the
 *      workspace covers the board → it leaves → the marker 10 → 14 % → four
 *      tokens → 3 → 7.
 *   3. The server agrees: 7 data, the two census records with their raisers;
 *      nothing stranded, no overflow, no degrade, no page error.
 *
 * Fixture `venusian-census` (tests/e2e/fixtures/generate.ts).
 */

const CARD = 'Venusian Census';
const CARD_RU = 'Венерианская перепись';
const ASTEROID = 'Spin-Inducing Asteroid';
const OUT = path.resolve('screenshots', 'venusian-census');

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Record_ = {seq: number, card: string, owner: string, by?: string, before: number, after: number, steps: number, gain: {kind: string, amount: number}};
type Wire = {
  cardsInHand?: Array<{name: string}>;
  waitingFor?: {type: string, title?: unknown, options?: Array<{title?: unknown, cards?: Array<{name: string, calculatedCost?: number}>}>};
  thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>};
  game: {gameAge: number, venusScaleLevel: number, scaleStepRewards?: Array<Record_>};
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

const dataOn = (wire: Wire) => wire.thisPlayer.tableau.find((c) => c.name === CARD)?.resources ?? 0;
const titleText = (title: unknown): string => typeof title === 'string' ? title : String((title as {message?: string} | undefined)?.message ?? '');

/** Red's action over the API: «Standard projects» → Air Scrapping at the server's own price, then «End Turn». */
async function redAirScrappingThenEndTurn(request: APIRequestContext, redId: string): Promise<void> {
  const menu = (await wireOf(request, redId)).waitingFor;
  expect(menu?.type, 'red stands on its action menu').toBe('or');
  const sp = (menu?.options ?? []).findIndex((o) => titleText(o.title) === 'Standard projects');
  expect(sp, `«Standard projects» is offered — got ${JSON.stringify((menu?.options ?? []).map((o) => titleText(o.title)))} / ${titleText(menu?.title)}`).toBeGreaterThanOrEqual(0);
  const offered = (menu?.options?.[sp].cards ?? []).find((c) => c.name === 'Air Scrapping');
  expect(offered, 'Air Scrapping is offered').toBeDefined();
  const after = await sendPlayerInput(request, redId, {
    type: 'or', index: sp,
    response: {type: 'projectCard', card: 'Air Scrapping', payment: {...NO_PAYMENT, megacredits: offered?.calculatedCost ?? 15}},
  } as never) as unknown as Wire;
  const next = after.waitingFor;
  const end = (next?.options ?? []).findIndex((o) => titleText(o.title) === 'End Turn');
  expect(end, 'red\'s menu offers «End Turn» after its first action').toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, redId, {type: 'or', index: end, response: {type: 'option'}} as never);
}

type Pt = {x: number, y: number};
type Box = {x: number, y: number, w: number, h: number};
type ScaleProbe = {
  samples: number;
  ticks: number;
  /** The marker's resting value (`''` while it glides), in order, with when it changed. */
  marker: Array<[number, string]>;
  /** Each token's first painted sample: its centre, the marker's box at that sample, when. */
  tokens: Array<{t: number, at: Pt, marker?: Box}>;
  /** The scene's flight chips (card resource / M€ only, while the scene pays): first / last centre, and when each first entered the target box. */
  chips: Array<{first: Pt, last: Pt, t0: number, t1: number, kind: string, arrivedAt?: number}>;
  /** The satellite's data cell: its value in order, with when it changed. */
  aux: Array<[number, string]>;
  auxBox?: Box;
  /** Where a REMOTE token lands: the owner's chip in the status strip. */
  ownerChip?: Box;
  phases: Array<string>;
  wsSeen: boolean;
  wsGoneAt?: number;
  degraded: boolean;
  stranded: boolean;
};

/** THE PROBE — MutationObserver + setInterval, never rAF; claims about frames are made on interval ticks. */
async function armProbe(page: Page, owner: string): Promise<void> {
  await page.evaluate((ownerColor) => {
    const w = window as unknown as {__tr24: ScaleProbe, __tr24stop?: () => void};
    // A re-arm stops the previous sampler: two samplers on one page write two clocks into one record.
    w.__tr24stop?.();
    const chipsByEl = new Map<Element, ScaleProbe['chips'][number]>();
    const boxOf = (el: Element | null): Box | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
    };
    const p: ScaleProbe = {
      samples: 0, ticks: 0, marker: [], tokens: [], chips: [], aux: [], phases: [],
      wsSeen: false, degraded: false, stranded: false,
    };
    w.__tr24 = p;
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
    const inBox = (pt: Pt, b: Box | undefined, pad: number): boolean => b !== undefined &&
      pt.x >= b.x - pad && pt.x <= b.x + b.w + pad && pt.y >= b.y - pad && pt.y <= b.y + b.h + pad;
    const seen = new Set<Element>();
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const now = Date.now() - t0;
      const marker = document.querySelector('.scale-marker[data-scale-marker="venus"]');
      const at = marker?.getAttribute('data-scale-marker-at') ?? '';
      if (marker !== null && p.marker[p.marker.length - 1]?.[1] !== at) {
        p.marker.push([now, at]);
      }
      const aux = document.querySelector('.con-res-aux__cell[data-aux-resource="data"]');
      const auxValue = (aux?.querySelector('.con-res-aux__value')?.textContent ?? '').trim();
      if (aux !== null && auxValue !== '' && p.aux[p.aux.length - 1]?.[1] !== auxValue) {
        p.aux.push([now, auxValue]);
      }
      const auxBox = boxOf(aux);
      if (auxBox !== undefined) {
        p.auxBox = auxBox;
      }
      const dot = document.querySelector(`.con-status__player .player_bg_color_${ownerColor}`);
      const dotBox = boxOf(dot);
      if (dotBox !== undefined) {
        p.ownerChip = dotBox;
      }
      if (document.querySelector('.con-ws') !== null) {
        p.wsSeen = true;
      } else if (p.wsSeen) {
        p.wsGoneAt ??= now;
      }
      const root = document.querySelector('.con-scalepay');
      const phase = root?.getAttribute('data-scale-reward') ?? 'gone';
      if (p.phases[p.phases.length - 1] !== phase) {
        p.phases.push(phase);
      }
      if (root?.getAttribute('data-scale-reward-degraded') !== null && root !== null) {
        p.degraded = true;
      }
      for (const el of Array.from(document.querySelectorAll('.con-scalepay__token'))) {
        if (!seen.has(el) && shown(el.querySelector('.con-tileplace__coin-body') ?? el)) {
          seen.add(el);
          p.tokens.push({t: now, at: centre(el), marker: boxOf(marker)});
        }
      }
      if (phase === 'paying') {
        document.querySelectorAll('.con-transfer__chip--cardres, .con-transfer__chip--mc').forEach((el) => {
          if (!shown(el)) {
            return;
          }
          const c = centre(el);
          const rec = chipsByEl.get(el);
          const kind = el.classList.contains('con-transfer__chip--cardres') ? 'data' : 'mc';
          if (rec === undefined) {
            chipsByEl.set(el, {first: c, last: c, t0: now, t1: now, kind});
          } else {
            rec.last = c;
            rec.t1 = now;
            if (rec.arrivedAt === undefined && (inBox(c, p.auxBox, 6) || inBox(c, p.ownerChip, 40))) {
              rec.arrivedAt = now;
            }
          }
        });
      }
      p.chips = Array.from(chipsByEl.values());
      if (document.querySelector('.con-stranded') !== null) {
        p.stranded = true;
      }
    };
    const mo = new MutationObserver(() => sample(false));
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    const timer = window.setInterval(() => sample(true), 16);
    w.__tr24stop = () => {
      mo.disconnect();
      window.clearInterval(timer);
    };
  }, owner);
}

const readProbe = (page: Page): Promise<ScaleProbe> => page.evaluate(() => (window as unknown as {__tr24: ScaleProbe}).__tr24);

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

/** The scene's laws on ONE page, for one record: the marker before the tokens, every token born in the marker. */
function expectCauseBeforeConsequence(probe: ScaleProbe, label: string, arrivedAt: string, tokens: number): void {
  const arrival = probe.marker.find(([, at]) => at === arrivedAt);
  expect(arrival, `${label}: the marker rests on ${arrivedAt} % — got ${JSON.stringify(probe.marker)}`).toBeDefined();
  expect(probe.tokens.length, `${label}: ${tokens} tokens condensed on the marker — got ${JSON.stringify(probe.tokens)}`).toBe(tokens);
  expect(probe.tokens[0].t, `${label}: the marker ARRIVED before the first token (${arrival?.[0]} ms vs ${probe.tokens[0].t} ms)`)
    .toBeGreaterThanOrEqual(arrival?.[0] ?? Infinity);
  for (const token of probe.tokens) {
    const m = token.marker;
    expect(m, `${label}: the marker is on screen when a token is born`).toBeDefined();
    if (m !== undefined) {
      expect(token.at.x >= m.x && token.at.x <= m.x + m.w && token.at.y >= m.y && token.at.y <= m.y + m.h,
        `${label}: a token is born INSIDE the marker's box — ${JSON.stringify(token.at)} vs ${JSON.stringify(m)}`).toBe(true);
    }
  }
  const chips = probe.chips.filter((c) => c.kind === 'data');
  expect(chips.length, `${label}: one flight per token — got ${JSON.stringify(probe.chips)}`).toBe(tokens);
  for (const chip of chips) {
    const travel = Math.hypot(chip.last.x - chip.first.x, chip.last.y - chip.first.y);
    expect(travel, `${label}: each token MOVED from the marker to its destination`).toBeGreaterThan(40);
    expect(chip.arrivedAt, `${label}: each token reached its destination — ${JSON.stringify(chip)}`).toBeDefined();
  }
  expect(probe.ticks, `${label}: the probe's interval sampler ran`).toBeGreaterThan(3);
}

/** The satellite's counter: `from` until the first touchdown, then one step per touchdown, never ahead of one. */
function expectTicksOnTouchdowns(probe: ScaleProbe, label: string, from: number, to: number): void {
  const values = probe.aux.map(([, v]) => Number(v));
  const start = values.indexOf(from);
  expect(start, `${label}: the cell reads ${from} before the tokens — got ${JSON.stringify(probe.aux)}`).toBeGreaterThanOrEqual(0);
  const run = probe.aux.slice(start).map(([t, v]) => [t, Number(v)] as const);
  expect(run.map(([, v]) => v), `${label}: ${from} → … → ${to}, one unit per touchdown`).toEqual(Array.from({length: to - from + 1}, (_, i) => from + i));
  const arrivals = probe.chips.filter((c) => c.kind === 'data').map((c) => c.arrivedAt ?? Infinity).sort((a, b) => a - b);
  run.slice(1).forEach(([t], i) => {
    // A tick is NEVER ahead of its touchdown (a frame of slack for the sampler's own clock).
    expect(t, `${label}: tick ${i + 1} at ${t} ms is not ahead of its token's touchdown (${arrivals[i]} ms)`).toBeGreaterThanOrEqual(arrivals[i] - 20);
  });
}

for (const preset of PRESETS) {
  test.describe(`TR24 Venusian Census · the scale step pays · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`red's Air Scrapping → tokens from the marker; blue's asteroid → the park → tokens (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });

      const {playerId, seats} = await bootFixtureSeats(page, request, 'venusian-census', {query: preset.query});
      const redId = seats[1];
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect(before.game.venusScaleLevel, 'the fixture: Venus at 8 %').toBe(8);
      expect(dataOn(before), 'the fixture: the census holds 1 data').toBe(1);

      // THE SECOND CLIENT — red, on the board.
      const redPage = await context.newPage();
      const redErrors: Array<string> = [];
      redPage.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(redPage, redId, preset.query);
      await settle(redPage, {timeoutMs: 30_000});
      const onBoard = (p: Page) => () => p.evaluate(() => {
        const board = document.querySelector<HTMLElement>('.con-board');
        return document.querySelector('.con-ws') === null && board !== null && board.offsetParent !== null;
      });
      expect(await pressUntil(redPage, 'Escape', onBoard(redPage), {tries: 4, settleMs: 1200}), 'red stands on the board').toBe(true);
      await page.bringToFront();
      expect(await pressUntil(page, 'Escape', onBoard(page), {tries: 4, settleMs: 1200}), 'blue stands on the board').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      await settle(redPage, {timeoutMs: 20_000});

      // ── 1. RED raises Venus (8 → 10 %) while blue stands on the board ──
      await armProbe(page, blue);
      await armProbe(redPage, blue);
      const stopStory = await storyboard(page, preset.id, 'red-air-scrapping');
      const stopRedStory = await storyboard(redPage, preset.id, 'red-air-scrapping-red-view');
      await redAirScrappingThenEndTurn(request, redId);
      await expect.poll(async () => (await readProbe(page)).aux.map(([, v]) => v).includes('3'),
        {timeout: 45_000, message: 'blue\'s data cell reaches 3'}).toBe(true);
      await expect.poll(async () => (await readProbe(redPage)).chips.filter((c) => c.arrivedAt !== undefined).length,
        {timeout: 30_000, message: 'red\'s screen: both tokens reached blue\'s chip'}).toBe(2);
      await settle(page, {timeoutMs: 20_000});
      await stopStory();
      await stopRedStory();
      const own1 = await readProbe(page);
      expectCauseBeforeConsequence(own1, 'blue (own)', '10', 2);
      expectTicksOnTouchdowns(own1, 'blue (own)', 1, 3);
      for (const chip of own1.chips) {
        expect(chip.last.x >= (own1.auxBox?.x ?? 0) - 8 && chip.last.x <= (own1.auxBox?.x ?? 0) + (own1.auxBox?.w ?? 0) + 8,
          'blue: the token lands IN the satellite\'s data cell').toBe(true);
      }
      const remote1 = await readProbe(redPage);
      expectCauseBeforeConsequence(remote1, 'red (remote)', '10', 2);
      expect(remote1.aux, 'red\'s own satellite holds no data — nothing ticks on red\'s screen').toEqual([]);
      await shoot(page, preset.id, '01-after-red-raise');
      await shoot(redPage, preset.id, '01-red-view');

      // ── 2. BLUE plays Spin-Inducing Asteroid (10 → 14 %) from the hand ──
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type, {timeout: 20_000, message: 'blue\'s turn is back'}).toBe('or');
      await settle(page, {timeoutMs: 20_000});
      const hand = page.locator('.con-hand');
      for (let i = 0; i < 4 && await hand.count() === 0; i++) {
        await press(page, 'Period', 600);
        await press(page, 'Enter', 1600);
      }
      await page.locator(`.con-hand [data-zoom-slot="${ASTEROID}"]`).waitFor({timeout: 20_000});
      expect(await focusCard(page, ASTEROID, 24), `never focused «${ASTEROID}»`).toBeTruthy();
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      const composer = page.locator('.con-composer--play');
      for (let i = 0; i < 4 && await composer.count() === 0; i++) {
        await press(page, 'Enter', 1200);
      }
      await composer.waitFor({timeout: 15_000});
      await settle(page);
      // BEFORE A: «Сработает» +4 — the census's data (the compact row is bare deltas; the layer names the card).
      const row = page.locator('.con-composer--play [data-forecast-row]');
      await expect(row, 'the composer\'s «Сработает» row').toHaveCount(1, {timeout: 15_000});
      await expect(row).toContainText('Сработает');
      await expect(row).toContainText('+4');
      await shoot(page, preset.id, '02-composer-forecast');
      const layer = page.locator('[data-forecast-surface]');
      expect(await pressUntil(page, 'KeyV', async () => await layer.count() > 0, {tries: 3, settleMs: 900}), 'R3 opens the effects layer').toBe(true);
      await expect(layer, 'the layer names the card that will answer the step').toContainText(CARD_RU, {timeout: 10_000});
      await shoot(page, preset.id, '03-forecast-layer');
      expect(await pressUntil(page, 'KeyV', async () => await layer.count() === 0, {tries: 3, settleMs: 900}), 'R3 closes the layer').toBe(true);
      await settle(page);

      await armProbe(page, blue);
      const stopStory2 = await storyboard(page, preset.id, 'blue-asteroid');
      const played = () => page.evaluate(() => document.querySelector('.con-composer--play') === null);
      for (let attempt = 0; attempt < 4 && !await played(); attempt++) {
        await press(page, 'Enter', 400);
        await expect.poll(played, {timeout: 3_000}).toBe(true).catch(() => undefined);
      }
      await expect.poll(async () => (await readProbe(page)).aux.map(([, v]) => v).includes('7'),
        {timeout: 60_000, message: 'blue\'s data cell reaches 7'}).toBe(true);
      await settle(page, {timeoutMs: 20_000});
      await stopStory2();
      const own2 = await readProbe(page);
      expect(own2.wsSeen, 'the play was made inside the hand workspace').toBe(true);
      // While the workspace covered the board, the marker did not move (the park held it).
      const firstMove = own2.marker.find(([, at]) => at !== '10');
      expect(firstMove !== undefined && own2.wsGoneAt !== undefined && firstMove[0] >= own2.wsGoneAt,
        `the marker leaves 10 % only once the workspace is gone — ${JSON.stringify(own2.marker)} / ws gone ${own2.wsGoneAt}`).toBe(true);
      expectCauseBeforeConsequence(own2, 'blue (asteroid)', '14', 4);
      expectTicksOnTouchdowns(own2, 'blue (asteroid)', 3, 7);
      await shoot(page, preset.id, '04-after-asteroid');

      // ── 3. THE SERVER, and nothing left behind ──
      const after = await wireOf(request, playerId);
      expect(after.game.venusScaleLevel).toBe(14);
      expect(dataOn(after), '1 + 2 + 4').toBe(7);
      const census = (after.game.scaleStepRewards ?? []).filter((r) => r.card === CARD);
      expect(census.map((r) => [r.before, r.after, r.by, r.gain.amount]), 'the two census records, with their raisers').toEqual([
        [8, 10, census[0]?.by, 2],
        [10, 14, blue, 4],
      ]);
      expect(census[0].by, 'the first raise was red\'s').not.toBe(blue);
      for (const probe of [own1, remote1, own2]) {
        expect(probe.degraded, 'nothing degraded').toBe(false);
        expect(probe.stranded, 'nothing stranded').toBe(false);
      }
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page error (blue)').toEqual([]);
      expect(redErrors, 'no page error (red)').toEqual([]);
      await redPage.close();
    });
  });
}
