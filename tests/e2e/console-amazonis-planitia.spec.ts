import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, bootSeededGame, commitFocusedSpace, createGameWithCards, fetchPlayerModel, placeTile, press, pressUntil,
  sendPlayerInput, settle, soloGameConfig, takeRevealCard, walkToSpace,
} from './consoleStart';

/**
 * AMAZONIS PLANITIA on the console — phase 1 of the board's premium adaptation (`docs/claude/amazonis-planitia-phase-1.md`).
 *
 *  1. THE FIELD. The eleven-row grid (91 hexes) at the Tharsis hex, measured against a Tharsis game on the same TV
 *     profile: the hex keeps ≥ 90 % of its on-screen size (the owner: «гексы предельно крупные»); no digit, chip or
 *     off-Mars cell sits on a hex; the board fits the stage (no scroll); the printed set stands on the strategy rail.
 *  2. THE BONUSES (fixture `amazonis-planitia-bonuses` — every track one step below a bonus the map prints): a greenery
 *     on a «standard resource of your choice» cell — oxygen 6 → 7 % draws the map's card; the CELL asks (the task host's
 *     source plate names it), steel chosen, Mining Guild answers with a steel production; an asteroid crosses −12 °C
 *     (plant production); Air Scrapping crosses 16 % Venus (a colony to build).
 *  3. THE FINISH (fixture `amazonis-planitia-finish`): Venus 30 → 31 → 32 → 33 on the alternative board (a standard
 *     resource per step, the wild on 33), the 11th ocean, +12 → +14 °C, 17 → 18 % — every dial at its longer maximum.
 * Evidence → screenshots/amazonis-planitia/.
 */

const OUT = path.resolve('screenshots', 'amazonis-planitia');
const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

function config(board: string) {
  return soloGameConfig({
    board,
    altVenusBoard: true,
    expansions: {venus: true, colonies: true, promo: true},
    customCorporationsList: ['Teractor'],
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type Wire = {
  game: {oxygenLevel: number, temperature: number, venusScaleLevel: number, oceans: number, spaces: Array<{id: string, bonus?: Array<number>, tileType?: number}>},
  thisPlayer: {megacredits: number, steel: number, titanium: number, plants: number, energy: number, heat: number,
    steelProduction: number, plantProduction: number, cardsInHandNbr: number},
  waitingFor?: {type?: string, venusBonusPrompt?: unknown, choiceContext?: {source?: {kind?: string, space?: string}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const stockSum = (w: Wire) => w.thisPlayer.megacredits + w.thisPlayer.steel + w.thisPlayer.titanium + w.thisPlayer.plants + w.thisPlayer.energy + w.thisPlayer.heat;
/** `SpaceBonus.STANDARD_RESOURCE` on the wire. */
const STANDARD_RESOURCE = 19;

/** Red (the second seat) passes the generation over the API once its action menu stands — blue keeps the turns. */
async function passSeat(request: APIRequestContext, pid: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    const wf = (await fetchPlayerModel(request, pid) as unknown as {waitingFor?: {options?: Array<unknown>}}).waitingFor;
    const idx = (wf?.options ?? []).findIndex((o) => JSON.stringify(o).includes('Pass for this generation'));
    if (idx >= 0) {
      await sendPlayerInput(request, pid, {type: 'or', index: idx, response: {type: 'option'}});
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('red never got its action menu');
}

/** LT → the standard projects, the snake to the project named `name`, A runs it until `done` holds. */
async function runStandardProject(page: Page, name: RegExp, done: () => Promise<boolean>): Promise<void> {
  await settle(page);
  // LT opens the wheel (a landing's story may still absorb it — retried on the wheel's own witness), A the projects.
  const stdp = page.locator('.con-stdp');
  for (let i = 0; i < 4 && await stdp.count() === 0; i++) {
    await press(page, 'Comma', 1100);
    await press(page, 'Enter', 1400);
  }
  await expect(stdp, 'the standard projects open').toHaveCount(1, {timeout: 15_000});
  const focused = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  for (let i = 0; i < 6 && !name.test(await focused()); i++) {
    await press(page, 'ArrowUp', 200);
  }
  const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown',
    'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowRight'];
  for (let i = 0; i < snake.length && !name.test(await focused()); i++) {
    await press(page, snake[i], 240);
  }
  expect(await focused(), `the ${name} project is focused`).toMatch(name);
  expect(await pressUntil(page, 'Enter', done, {tries: 3, settleMs: 1500}), `A runs ${name}`).toBe(true);
}

type FieldReading = {hex: number, hexes: number, overlaps: Array<string>, scroll: boolean, offMars: number};

/** The painted field: one hex's width, the hexes, and every scale piece / off-Mars cell that touches a Mars hex. */
async function readField(page: Page): Promise<FieldReading> {
  return await page.evaluate(() => {
    const hexes = Array.from(document.querySelectorAll<HTMLElement>('#main_board > .board-space[data_space_id]'));
    const rects = hexes.map((h) => ({id: h.getAttribute('data_space_id') ?? '?', r: h.getBoundingClientRect()}));
    // A hex is a hexagon inside its box: shrink the box to its inscribed core (the clip-path's middle band) for the test.
    const core = (r: DOMRect) => ({left: r.left + r.width * 0.04, right: r.right - r.width * 0.04, top: r.top + r.height * 0.25, bottom: r.bottom - r.height * 0.25});
    const touches = (a: {left: number, right: number, top: number, bottom: number}, b: DOMRect) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const pieces = Array.from(document.querySelectorAll<HTMLElement>('.arc-scale__digit, [data-arc-marker], .arc-scale__identity, .board-outer-spaces > .board-space'));
    const overlaps: Array<string> = [];
    for (const piece of pieces) {
      const pr = piece.getBoundingClientRect();
      if (pr.width === 0) {
        continue;
      }
      for (const {id, r} of rects) {
        if (touches(core(r), pr)) {
          overlaps.push(`${piece.className.split(' ').slice(0, 2).join('.')}${piece.getAttribute('data-arc-marker') ?? piece.getAttribute('data_space_id') ?? piece.textContent ?? ''} × ${id}`);
        }
      }
    }
    const root = document.scrollingElement ?? document.documentElement;
    return {
      hex: rects.length > 0 ? rects[0].r.width : 0,
      hexes: rects.length,
      overlaps,
      scroll: root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1,
      offMars: document.querySelectorAll('.board-outer-spaces > .board-space').length,
    };
  });
}

async function boot(page: Page, request: APIRequestContext, board: string, query: string): Promise<string> {
  const playerId = await createGameWithCards(request, [], {config: config(board)});
  await bootSeededGame(page, request, playerId, {buy: 0, corporation: 'Teractor', query});
  await settle(page);
  return playerId;
}

for (const profile of PROFILES) {
  test.describe(`Amazonis Planitia · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('the field: 91 hexes at ≥ 90 % of the Tharsis hex, nothing on a hex, no scroll', async ({page, request}) => {
      test.setTimeout(300_000);
      await boot(page, request, 'tharsis', profile.query);
      const tharsis = await readField(page);
      await shoot(page, '00-tharsis-reference');

      const errors: Array<string> = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('response', (r) => {
        if (r.status() === 404) {
          errors.push(`404: ${r.url()}`);
        }
      });
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') {
          errors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
        }
      });
      const playerId = await boot(page, request, 'amazonis planitia', profile.query);
      const model = await fetchPlayerModel(request, playerId) as unknown as {game: {gameOptions: {boardName: string}}};
      expect(model.game.gameOptions.boardName).toBe('amazonis planitia');
      const field = await readField(page);
      await shoot(page, '01-field');
      console.log('── the field ──', JSON.stringify({tharsisHex: tharsis.hex, hex: field.hex, ratio: field.hex / tharsis.hex, hexes: field.hexes, offMars: field.offMars, overlaps: field.overlaps}));
      expect(field.hexes, 'the eleven-row grid').toBe(91);
      expect(field.hex / tharsis.hex, `hex ${field.hex.toFixed(1)} px vs Tharsis ${tharsis.hex.toFixed(1)} px`).toBeGreaterThanOrEqual(0.9);
      expect(field.overlaps, 'nothing of the scales or the off-Mars flank sits on a hex').toEqual([]);
      expect(field.scroll, 'the page never scrolls').toBe(false);
      // The printed set on the strategy rail: five + Venus's Hoverlord, five + Venuphile.
      const rail = await page.evaluate(() => ({
        milestones: document.querySelectorAll('.con-strat__zone--milestones .con-strat__item').length,
        awards: document.querySelectorAll('.con-strat__zone--awards .con-strat__item').length,
      }));
      console.log('── the rail ──', JSON.stringify(rail), '\n── console ──\n' + errors.slice(0, 20).join('\n'));
      expect(rail).toEqual({milestones: 6, awards: 6});
    });

    test('the bonuses: the 7 % card, the cell asks for its standard resource, Mining Guild answers; −12 °C; 16 % Venus', async ({page, request}) => {
      test.setTimeout(480_000);
      const {seats} = await bootFixtureSeats(page, request, 'amazonis-planitia-bonuses', {query: profile.query});
      const [id, redId] = seats;
      await settle(page);
      const before = await wireOf(request, id);
      const cell = before.game.spaces.find((s) => (s.bonus ?? []).includes(STANDARD_RESOURCE) && s.tileType === undefined);
      expect(cell, 'a free standard-resource cell').toBeDefined();

      // ── A GREENERY ON THE CELL (oxygen 6 → 7 %: the map's card) ──
      await runStandardProject(page, /озеленение/i, async () => (await wireOf(request, id)).waitingFor?.type === 'space');
      await walkToSpace(page, cell!.id);
      await shoot(page, '10-standard-resource-aimed');
      expect(await commitFocusedSpace(page), 'the greenery lands on the cell').toBe(true);
      await expect.poll(async () => (await wireOf(request, id)).game.oxygenLevel, {timeout: 30_000}).toBe(7);
      // The CELL asks (the server) — and the 7 % card's reveal stands first on screen: it is taken, then the palette.
      await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 30_000, message: 'the cell asks for a resource'}).toBe('resource');
      const ask = await wireOf(request, id);
      expect(ask.waitingFor?.choiceContext?.source, 'the question names the cell').toMatchObject({kind: 'space', space: cell!.id});
      const palette = page.locator('.con-task__palette');
      await expect.poll(async () => {
        if (await page.locator('.con-reveal').count() > 0) {
          await shoot(page, '10b-oxygen-7-card');
          await takeRevealCard(page, 20_000);
        }
        return await palette.count();
      }, {timeout: 60_000, message: 'the 7 % card taken, the cell\'s palette stands'}).toBeGreaterThan(0);
      await expect(palette, 'the palette').toBeVisible({timeout: 20_000});
      await expect(page.locator('.con-task .con-src'), 'the source plate — the cell').toBeVisible();
      await shoot(page, '11-standard-resource-question');
      const focusedIcon = () => page.evaluate(() => document.querySelector('.con-task__palette .con-vchoice__opt--focused [data-vchoice-hero-icon]')?.getAttribute('data-vchoice-hero-icon') ?? '');
      for (let i = 0; i < 8 && !/steel/.test(await focusedIcon()); i++) {
        await press(page, 'ArrowRight', 260);
      }
      expect(await focusedIcon(), 'steel is focused').toMatch(/steel/);
      const answered = async () => (await wireOf(request, id)).waitingFor?.type !== 'resource';
      expect(await pressUntil(page, 'Enter', answered, {tries: 2, settleMs: 900}) || await pressUntil(page, 'KeyX', answered, {tries: 3, settleMs: 900}),
        'the answer is sent').toBe(true);
      await settle(page);
      const after = await wireOf(request, id);
      expect(after.thisPlayer.steel, 'the cell paid one steel').toBe(before.thisPlayer.steel + 1);
      expect(after.thisPlayer.steelProduction, 'Mining Guild answered the chosen steel').toBe(before.thisPlayer.steelProduction + 1);
      expect(after.thisPlayer.cardsInHandNbr, 'the 7 % card').toBe(before.thisPlayer.cardsInHandNbr + 1);
      await shoot(page, '12-standard-resource-landed');

      // ── AN ASTEROID (−14 → −12 °C: plant production) ──
      await runStandardProject(page, /астероид/i, async () => (await wireOf(request, id)).game.temperature === -12);
      await settle(page);
      expect((await wireOf(request, id)).thisPlayer.plantProduction, '−12 °C pays a plant production').toBe(before.thisPlayer.plantProduction + 1);
      await shoot(page, '13-minus-12');

      // ── AIR SCRAPPING (14 → 16 % Venus: a colony to build) — blue's two actions are spent: red passes, blue goes on. ──
      await passSeat(request, redId);
      await settle(page);
      await runStandardProject(page, /очистк|scrapping/i, async () => (await wireOf(request, id)).game.venusScaleLevel === 16);
      await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 30_000, message: '16 % Venus asks for a colony'}).toBe('colony');
      await shoot(page, '14-venus-16-colony');
    });

    test('the finish: Venus 30 → 33 on the alternative board, the 11th ocean, +14 °C, 18 %', async ({page, request}) => {
      test.setTimeout(600_000);
      const id = await bootFixture(page, request, 'amazonis-planitia-finish', {query: profile.query});
      await settle(page);
      for (const level of [31, 32, 33]) {
        const was = await wireOf(request, id);
        await runStandardProject(page, /очистк|scrapping/i, async () => (await wireOf(request, id)).game.venusScaleLevel === level);
        // The bonus is a STEP of the standard projects' workspace (P89 · EE): «Шкала Венеры 30 % → 31 %».
        await expect(page.locator('.con-stdp .con-venus[data-venus-bonus-embedded]'), `Venus ${level} % asks its bonus inside the workspace`)
          .toBeVisible({timeout: 45_000});
        await expect(page.locator('[data-venus-step]'), 'the step that earned it is read').toContainText(`${level}`);
        await shoot(page, `20-venus-${level}-bonus`);
        if (level === 33) {
          // The finish asks the OR first — «put the wild on a card» (refused: no holder, named) or «one more standard
          // resource» (focused); A takes the latter, then the two units ride a dial: steel, RT lays them all.
          await expect(page.locator('.con-stdp .con-venus'), 'the finish asks where the wild goes').toContainText(/дополнительный ресурс/i);
          await shoot(page, '20b-venus-33-wild');
          const orStands = async () => /куда пойд/i.test(await page.locator('.con-stdp .con-venus').innerText().catch(() => ''));
          await press(page, 'ArrowDown', 300);
          expect(await pressUntil(page, 'Enter', async () => !await orStands(), {tries: 4, settleMs: 900}), 'A takes «one more standard resource»').toBe(true);
          await press(page, 'ArrowDown', 300);
          await press(page, 'Period', 500);
        } else {
          await press(page, 'ArrowDown', 300); // steel
          await press(page, 'Enter', 500);
        }
        await expect.poll(async () => {
          await press(page, 'KeyX', 600);
          return (await wireOf(request, id)).waitingFor?.venusBonusPrompt;
        }, {timeout: 30_000, message: `X collects the ${level} % bonus`}).toBeUndefined();
        await settle(page);
        const now = await wireOf(request, id);
        // The project's price (15 M€) is spent; the bonus returns one standard resource per step — two on the finish.
        expect(stockSum(now) - (stockSum(was) - 15), `the ${level} % step paid its bonus`).toBe(level === 33 ? 2 : 1);
      }
      await runStandardProject(page, /водоносн|океан/i, async () => (await wireOf(request, id)).waitingFor?.type === 'space');
      expect(await placeTile(page), 'the 11th ocean lands').toBe(true);
      await expect.poll(async () => (await wireOf(request, id)).game.oceans, {timeout: 30_000}).toBe(11);
      await runStandardProject(page, /астероид/i, async () => (await wireOf(request, id)).game.temperature === 14);
      await runStandardProject(page, /озеленение/i, async () => (await wireOf(request, id)).waitingFor?.type === 'space');
      expect(await placeTile(page), 'the last greenery lands').toBe(true);
      await expect.poll(async () => (await wireOf(request, id)).game.oxygenLevel, {timeout: 30_000}).toBe(18);
      await settle(page);
      const strip = (await page.locator('.con-status').innerText()).replace(/\s+/g, ' ');
      expect(strip, 'the strip reads the longer maximums').toMatch(/11\/11/);
      await shoot(page, '21-terraformed');
    });
  });
}
