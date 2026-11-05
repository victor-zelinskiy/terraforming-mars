import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootSeededGame, cinematicBeat, commitFocusedSpace, createGameWithCards, fetchPlayerModel, openBotBoardDetail, press, settle,
  soloGameConfig, takeRevealCard, walkToSpace,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * ARABIA TERRA on the console — the fourth fan map with a HOME-MADE MarsBot board (docs/AUTOMA_DATA_AUDIT.md §2i / §21)
 * and the map of the COVES.
 *
 *  1. THE BOARD. No legacy caption (the four names the board printed are hover markers now); the volcanic cells
 *     still empty wear them, and the popover names the place. Then
 *     the two faces of a cove, live: an OCEAN (the standard project) on one cove — the dossier says «Бухта» and its
 *     rule, the server counts the ocean; a GREENERY on the energy-production cove — the dossier draws the bonus as
 *     energy production before the press, and the server pays it. Nothing stranded on the way.
 *     While the placement grid stands, a candidate cove KEEPS ITS FACE (the ocean half and the divider) — a legacy
 *     rule erased it on every legal cell (the owner, 2026-11-05).
 *  2. THE BOT. MarsBot on this map: the home-made mat in the view (Power alone, Jovian riding Science, the free colony
 *     cell on space 5) and in «Планшет бота», the map's own rows, and the bot playing the round the player hands over.
 *  3. THE CELLS THAT PAY, on the REAL board (fixture `arabia-receive` — the owner's audit of 2026-11-05): printed DATA
 *     with two holders on the table (a live pick, then the board's scene on the chosen card), printed SCIENCE with one
 *     holder (no question — the board's scene), and the energy-production cove (a token born on the cell, landing on
 *     the rail's energy row — the production digit used to tick with no cause on screen). Both ends of every flight
 *     are witnessed.
 * Evidence → screenshots/arabia-terra/.
 */

const OUT = path.resolve('screenshots', 'arabia-terra');
const VOLCANIC = ['20', '55', '58', '63'];
const OCEAN_COVES = ['44', '48', '46'];
const ENERGY_COVE = '32';
const DATA_CELL = '16';
const SCIENCE_CELL = '34';
const OCEAN_COST = 18;
const GREENERY_COST = 23;

const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

function humanConfig() {
  return soloGameConfig({board: 'arabia terra', customCorporationsList: ['Teractor']});
}

function botConfig() {
  return soloGameConfig({board: 'arabia terra', automa: {difficulty: 'normal'}});
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type BotTrack = {layout: Array<string | null>, position: number, tags: Array<string>};
type View = {
  game: {
    gameOptions: {boardName: string},
    oxygenLevel: number,
    oceans: number,
    milestones: Array<{name: string}>,
    awards: Array<{name: string}>,
    spaces: Array<{id: string, tileType?: number}>,
    automa?: {tracks: Array<BotTrack>},
  },
  thisPlayer: {megacredits: number, energyProduction: number, tableau: Array<{name: string, resources?: number}>},
  waitingFor?: {type?: string},
};

const resourcesOn = (model: View, card: string): number => model.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

async function focusedCellAvailable(page: Page, id: string): Promise<boolean> {
  return await page.evaluate((cell) => document.querySelector(`[data_space_id="${cell}"]`)?.classList.contains('board-space--available') ?? false, id);
}

const dossier = async (page: Page): Promise<string> =>
  (await page.locator('.con-context').innerText().catch(() => '')).replace(/\s+/g, ' ');

/** LT wheel → Standard Projects → the project named `name` → its cell prompt. */
async function startStandardProject(page: Page, request: APIRequestContext, playerId: string, name: RegExp, label: string): Promise<void> {
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !name.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(name.test(await focusedName()), `could not focus «${label}»`).toBeTruthy();
  await press(page, 'Enter', 1800);
  if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
    await press(page, 'KeyX', 2200);
  }
  await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '',
    {timeout: 30_000, message: `«${label}» asks for its cell`}).toBe('space');
}

for (const profile of PROFILES) {
  test.describe(`Arabia Terra (fan map) · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('the board: the volcanic markers; a cove takes an ocean AND a land tile, and the energy cove pays its production', async ({page, request}) => {
      test.setTimeout(480_000);
      const playerId = await createGameWithCards(request, [], {config: humanConfig()});
      await bootSeededGame(page, request, playerId, {buy: 0, corporation: 'Teractor', query: profile.query});
      await settle(page);
      await armLeakWitness(page);
      await shoot(page, '00-board');

      const before = await view(request, playerId);
      expect(before.game.gameOptions.boardName).toBe('arabia terra');
      expect(before.thisPlayer.megacredits).toBeGreaterThanOrEqual(OCEAN_COST + GREENERY_COST);

      const board = await page.evaluate(() => ({
        captions: document.querySelector('#board_legend')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        markers: Array.from(document.querySelectorAll('.special-cell-marker')).map((m) =>
          Array.from(m.classList).find((c) => /^board-space-\d+$/.test(c)) ?? '?').filter((c) => !/^board-space-0[12]$/.test(c)).sort(),
        coves: document.querySelectorAll('.board-space-type-cove, .board-space-type-volcanic-cove').length,
      }));
      console.log('── the board ──', JSON.stringify(board));
      expect(board.captions, 'no legacy SVG caption on this map').toBe('');
      // A marker stands on an EMPTY special cell only — the solo setup's neutral tiles may already cover a volcano.
      const occupied = new Set(before.game.spaces.filter((s) => s.tileType !== undefined).map((s) => s.id));
      const expected = VOLCANIC.filter((id) => !occupied.has(id));
      expect(board.markers, 'every EMPTY volcanic cell carries a marker, and nothing else does').toEqual(expected.map((id) => `board-space-${id}`));
      expect(await page.locator('.special-cell-marker--active').count(), 'no marker lights up for an invisible cursor').toBe(0);
      expect(board.coves, 'the empty coves are drawn as coves').toBeGreaterThan(0);

      // A named volcano, hovered: the popover carries the name the board printed.
      const NAMES: Record<string, RegExp> = {'20': /Тихонравов/, '55': /Ладон/, '58': /Фложерг/, '63': /Харибда/};
      const named = expected[0];
      await page.locator(`[data_space_id="${named}"]`).hover();
      await expect.poll(async () => (await page.locator('.board-cell-popover').innerText().catch(() => '')).replace(/\s+/g, ' '),
        {timeout: 15_000, message: `the popover names the place on ${named}`}).toMatch(NAMES[named]);
      await settle(page);
      await shoot(page, '01-volcano-hover');

      // ── AN OCEAN ON A COVE ─────────────────────────────────────────────────
      await startStandardProject(page, request, playerId, /^\s*океан\s*$/i, 'Океан');
      let oceanCove: string | undefined;
      for (const id of OCEAN_COVES) {
        if (occupied.has(id)) {
          continue;
        }
        await walkToSpace(page, id);
        if (await focusedCellAvailable(page, id)) {
          oceanCove = id;
          break;
        }
      }
      expect(oceanCove, 'a cove is a legal ocean cell').toBeDefined();
      // A CANDIDATE COVE KEEPS ITS FACE: the type layer of every legal cove still paints its half and its divider.
      const coveFaces = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('.board-space--available > .board-space-type-cove, .board-space--available > .board-space-type-volcanic-cove'))
          .map((el) => getComputedStyle(el).backgroundImage));
      console.log('── candidate coves ──', coveFaces.length, coveFaces[0]?.slice(0, 60));
      expect(coveFaces.length, 'the ocean placement lights coves').toBeGreaterThan(0);
      expect(coveFaces.filter((bg) => !/svg/.test(bg)), 'every candidate cove still paints its ocean half').toEqual([]);
      const oceanPanel = await dossier(page);
      console.log('── the cove dossier (ocean) ──', oceanPanel);
      expect(oceanPanel, 'the dossier names the cove').toMatch(/Бухта/);
      expect(oceanPanel, 'and says its rule').toMatch(/и тайл океана, и тайл суши/);
      await shoot(page, '10-ocean-cove-aimed');
      expect(await commitFocusedSpace(page), 'the ocean landed on the cove').toBeTruthy();
      await expect.poll(async () => (await view(request, playerId)).game.oceans,
        {timeout: 40_000, message: 'the cove\'s ocean is counted'}).toBe(before.game.oceans + 1);
      await settle(page);
      await shoot(page, '11-ocean-cove-landed');

      // ── A GREENERY ON THE ENERGY-PRODUCTION COVE ───────────────────────────
      const mid = await view(request, playerId);
      await startStandardProject(page, request, playerId, /^\s*озеленение\s*$/i, 'Озеленение');
      await walkToSpace(page, ENERGY_COVE);
      expect(await focusedCellAvailable(page, ENERGY_COVE), 'the energy cove is a legal greenery cell').toBe(true);
      const landPanel = await dossier(page);
      console.log('── the cove dossier (greenery) ──', landPanel);
      expect(landPanel).toMatch(/Бухта/);
      // The printed bonus row is the dossier's one grammar: «Бонус клетки +1» with the resource as its ICON, framed as
      // production — read that very row.
      const bonusRow = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.con-context .con-dossier-row'));
        const row = rows.find((r) => /Бонус клетки/.test(r.textContent ?? ''));
        return {
          text: row?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          icon: row?.querySelector('.con-dossier-row__ico')?.className ?? '',
          production: row?.querySelector('.con-dossier-row__prod') !== null && row !== undefined,
        };
      });
      console.log('── the bonus row ──', JSON.stringify(bonusRow));
      expect(bonusRow.text, 'the dossier states the cell bonus before the press').toMatch(/\+1/);
      expect(bonusRow.icon, 'drawn as ENERGY').toMatch(/energy/i);
      expect(bonusRow.production, 'in the production frame').toBe(true);
      await shoot(page, '20-energy-cove-aimed');
      expect(await commitFocusedSpace(page), 'the greenery landed on the energy cove').toBeTruthy();
      await expect.poll(async () => (await view(request, playerId)).game.oxygenLevel,
        {timeout: 40_000, message: 'the greenery raised the oxygen'}).toBe(mid.game.oxygenLevel + 1);
      await settle(page);
      await shoot(page, '21-energy-cove-landed');
      const after = await view(request, playerId);
      expect(after.thisPlayer.energyProduction, 'the cove paid its energy production').toBe(mid.thisPlayer.energyProduction + 1);
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });

    /** The standard project's greenery, aimed at `cell` — legal, the dossier read, nothing committed yet. */
    async function aimGreenery(page: Page, request: APIRequestContext, playerId: string, cell: string): Promise<string> {
      await startStandardProject(page, request, playerId, /^\s*озеленение\s*$/i, 'Озеленение');
      await walkToSpace(page, cell);
      expect(await focusedCellAvailable(page, cell), `cell ${cell} is a legal greenery cell`).toBe(true);
      return dossier(page);
    }

    /** What stands in the air right now: every token of the transfer layer, by its face and its place, and the open holds. */
    const inTheAir = (page: Page) => page.evaluate(() => {
      const ready = (window as unknown as {__conReady?: () => {holds?: ReadonlyArray<string>, transfer?: {trail: ReadonlyArray<unknown>}}}).__conReady?.();
      return {
        chips: Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip')).map((chip) => {
          const r = chip.getBoundingClientRect();
          return `#${chip.getAttribute('data-transfer-id')} «${(chip.textContent ?? '').replace(/\s+/g, '')}» @${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)} ` +
            `layer=${chip.getAttribute('data-transfer-layer')} op=${getComputedStyle(chip).opacity}`;
        }),
        holds: ready?.holds ?? [],
        trail: (ready?.transfer?.trail ?? []).slice(-14).map((t) => JSON.stringify(t)),
      };
    });

    /**
     * THE RECEIVED CARD STANDS, AND NOTHING HANGS OVER IT. Both cells also print a card: the drawn card's scene takes
     * the opening and waits for the player's A — for as long as they like. Read twice, a beat apart: a token that
     * stands in the same place over the standing scene is a flight that never ended.
     */
    async function revealStandsClean(page: Page, label: string): Promise<void> {
      await expect(page.locator('.con-reveal'), `${label}: the drawn card's scene stands`).toBeVisible({timeout: 40_000});
      await expect.poll(async () => await page.locator('.con-reveal').getAttribute('data-take'),
        {timeout: 30_000, message: `${label}: the scene is ready for the take`}).toBe('ready');
      const first = await inTheAir(page);
      await cinematicBeat(page, 2500, 'two reads of the air a beat apart — a token standing in one place across it never ended its flight');
      const second = await inTheAir(page);
      console.log(`── ${label}: in the air over the standing reveal ──`, JSON.stringify({first: first.chips, second: second.chips, holds: second.holds}));
      console.log(`── ${label}: transfer trail ──\n` + second.trail.join('\n'));
      const standing = second.chips.filter((chip) => first.chips.includes(chip));
      expect(standing, `${label}: a token hangs in the air over the standing «Получена карта»`).toEqual([]);
      expect(second.holds.filter((h) => /resource-transfer/.test(h)), `${label}: no transfer hold stands under the reveal`).toEqual([]);
    }

    test('printed DATA, two holders: the plate asks, the chosen card takes the unit by the field', async ({page, request}) => {
      test.setTimeout(400_000);
      const playerId = await bootFixture(page, request, 'arabia-receive', {query: profile.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await view(request, playerId);
      expect(before.game.gameOptions.boardName).toBe('arabia terra');

      const panel = await aimGreenery(page, request, playerId, DATA_CELL);
      console.log('── the data cell dossier ──', panel);
      expect(panel, 'a holder stands on the table — the bonus is not announced as lost').not.toMatch(/будет пропущен/);
      await shoot(page, '40-data-aimed');
      await armTransferWitness(page);
      expect(await commitFocusedSpace(page), 'the greenery landed on the data cell').toBeTruthy();

      // THE CELL ALSO PRINTS A CARD: the drawn card's scene comes first, named by the cell's own face, and is taken.
      await revealStandsClean(page, 'data');
      await expect(page.locator('.con-task-host'), 'the question waits for the take — one surface at a time').toHaveCount(0);
      await shoot(page, '40a-data-card-received');
      expect(await takeRevealCard(page), 'the drawn card is taken').toBe(true);

      // TWO holders → a real question, both shown.
      await page.locator('.con-task-host .con-cards__slot').first().waitFor({timeout: 40_000});
      await expect(page.locator('.con-task-host [data-zoom-slot="Supercomputer"]'), 'the empty holder is a candidate').toHaveCount(1);
      await expect(page.locator('.con-task-host [data-zoom-slot="Habitat Science"]'), 'the other holder too').toHaveCount(1);
      // (No `settle` here: while the plate stands the oxygen step's rating WAITS for a marker the player can see —
      // its notification-only hold is the product's intended state, not noise to wait out.)
      await expect.poll(async () => (await inTheAir(page)).holds.filter((h) => /scale-step-rating/.test(h)).length,
        {timeout: 15_000, message: 'the step\'s rating waits while the plate covers its marker'}).toBe(1);
      expect((await inTheAir(page)).chips, 'nothing flies from under the plate').toEqual([]);
      await cinematicBeat(page, 700, 'the plate\'s entry paints before the storyboard frame');
      await shoot(page, '41-data-pick');
      const focused = () => page.evaluate(() => document.querySelector('.con-task-host .con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
      for (let i = 0; i < 4 && await focused() !== 'Supercomputer'; i++) {
        await press(page, 'ArrowRight', 400);
      }
      expect(await focused(), 'the cursor stands on Supercomputer').toBe('Supercomputer');
      await press(page, 'Enter', 300);
      // The cell prints TWO data icons — one question, both units on the chosen card.
      await expect.poll(async () => resourcesOn(await view(request, playerId), 'Supercomputer'),
        {timeout: 40_000, message: 'both data landed on Supercomputer'}).toBe(resourcesOn(before, 'Supercomputer') + 2);
      await expect(page.locator('.con-task-host'), 'the plate leaves').toHaveCount(0, {timeout: 30_000});
      await settle(page, {timeoutMs: 30_000});
      await shoot(page, '42-data-landed');

      const after = await view(request, playerId);
      expect(resourcesOn(after, 'Habitat Science'), 'the other holder is untouched').toBe(resourcesOn(before, 'Habitat Science'));
      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      console.log('── data flights ──\n' + trail);
      expect(endsOverGlass(witness), `no flight end over glass:\n${trail}`).toEqual([]);
      expect(witness.landings.some((e) => e.under === 'recv:Supercomputer'), `the unit landed on the chosen card by the field:\n${trail}`).toBe(true);
      // THE OXYGEN STEP'S RATING never leaves the plate: its marker stood under the «on which card» plate while the
      // question was open, and the token was born on the plate's own card (it read as «Суперкомпьютер pays the rating»).
      expect(witness.births.filter((e) => /^slot:/.test(e.under)).map((e) => `${e.under} @${Math.round(e.x)},${Math.round(e.y)}`),
        `no token is born on a card of the plate:\n${trail}`).toEqual([]);
      expect(witness.landings.some((e) => e.under === 'rail:tr'), `the step's rating still lands on the rating cell:\n${trail}`).toBe(true);
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });

    test('printed SCIENCE, one holder: no question — the board\'s scene pays the card', async ({page, request}) => {
      test.setTimeout(400_000);
      const playerId = await bootFixture(page, request, 'arabia-receive', {query: profile.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await view(request, playerId);

      const panel = await aimGreenery(page, request, playerId, SCIENCE_CELL);
      console.log('── the science cell dossier ──', panel);
      expect(panel, 'a holder stands on the table — the bonus is not announced as lost').not.toMatch(/будет пропущен/);
      await shoot(page, '50-science-aimed');
      await armTransferWitness(page);
      expect(await commitFocusedSpace(page), 'the greenery landed on the science cell').toBeTruthy();
      await expect.poll(async () => resourcesOn(await view(request, playerId), 'Physics Complex'),
        {timeout: 40_000, message: 'the science landed on Physics Complex'}).toBe(resourcesOn(before, 'Physics Complex') + 1);
      // THE CELL ALSO PRINTS A CARD (and a steel): the drawn card's scene stands until the player takes it.
      await revealStandsClean(page, 'science');
      await shoot(page, '50a-science-card-received');
      expect(await takeRevealCard(page), 'the drawn card is taken').toBe(true);
      await settle(page, {timeoutMs: 30_000});
      expect(await page.locator('.con-task-host').count(), 'one holder is no question').toBe(0);
      await shoot(page, '51-science-landed');

      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      console.log('── science flights ──\n' + trail);
      expect(endsOverGlass(witness), `no flight end over glass:\n${trail}`).toEqual([]);
      expect(witness.landings.some((e) => e.under === 'recv:Physics Complex'), `the unit landed on the holder by the field:\n${trail}`).toBe(true);
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });

    test('the energy-production cove: the token leaves the cell and lands on the rail\'s energy row', async ({page, request}) => {
      test.setTimeout(400_000);
      const playerId = await bootFixture(page, request, 'arabia-receive', {query: profile.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await view(request, playerId);

      await aimGreenery(page, request, playerId, ENERGY_COVE);
      await armTransferWitness(page);
      expect(await commitFocusedSpace(page), 'the greenery landed on the energy cove').toBeTruthy();
      await expect.poll(async () => (await view(request, playerId)).thisPlayer.energyProduction,
        {timeout: 40_000, message: 'the cove paid its energy production'}).toBe(before.thisPlayer.energyProduction + 1);
      await settle(page, {timeoutMs: 30_000});
      await shoot(page, '60-energy-production-landed');

      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      console.log('── energy-production flights ──\n' + trail);
      expect(endsOverGlass(witness), `no flight end over glass:\n${trail}`).toEqual([]);
      expect(witness.landings.some((e) => e.under === 'rail:energy'),
        `the printed production flew from the cell into the rail's energy row (it used to tick with no cause on screen):\n${trail}`).toBe(true);
      // The rail shows what the server holds once the token has landed.
      await expect.poll(async () => await page.evaluate(() =>
        document.querySelector('.con-res__row--energy .con-res__prod')?.textContent?.replace(/\s+/g, '') ?? ''),
      {timeout: 15_000, message: 'the rail\'s energy production digit'}).toMatch(new RegExp(`${before.thisPlayer.energyProduction + 1}`));
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });

    test('MarsBot: the home-made mat is in play, the detail draws it, and the bot plays the round', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: botConfig()});
      await bootSeededGame(page, request, playerId, {buy: 0, query: profile.query});
      await settle(page);
      await shoot(page, '30-bot-board');

      const start = await view(request, playerId);
      expect(start.game.gameOptions.boardName).toBe('arabia terra');
      expect(start.game.automa, 'MarsBot is seated').toBeTruthy();
      const tracks = start.game.automa!.tracks;
      expect(tracks.length, 'the 7 map tracks (no Venus)').toBe(7);
      expect(tracks[1].layout[5], 'space 5 is the free colony cell').toBe('colony');
      expect(tracks[4].tags, 'Power stands alone').toEqual(['power']);
      expect(tracks[3].tags, 'Jovian rides Science').toEqual(['jovian', 'science']);
      expect(tracks[5].tags, 'City rides Earth').toEqual(['city', 'earth']);
      expect(start.game.milestones.map((m) => m.name)).toEqual(['Economizer', 'Pioneer', 'Land Specialist', 'Martian', 'Terran']);
      expect(start.game.awards.map((a) => a.name)).toEqual(['Cosmic Settler', 'Botanist', 'Promoter', 'Zoologist', 'A. Manufacturer']);

      // ── «Планшет бота» draws that mat ─────────────────────────────────────
      await press(page, 'KeyY', 1200);
      await expect(page.locator('.con-info'), 'info mode opens').toBeVisible();
      const corpLine = page.locator('.con-info__corp--bot');
      for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
        await press(page, 'KeyE', 900);
      }
      await expect(corpLine, 'the bot seat is on stage').toHaveCount(1);
      await openBotBoardDetail(page);
      const mat = page.locator('.mb-tracks');
      await expect(mat).toBeVisible();
      await expect(mat.locator('.mb-track')).toHaveCount(7);
      await expect(mat.locator('.mb-track').nth(3).locator('.mb-track__id .tag-jovian'), 'the Jovian tag on the science row').toHaveCount(1);
      await expect(mat.locator('.mb-track').nth(4).locator('.mb-track__id .tag-count'), 'the power row carries one tag').toHaveCount(1);
      await shoot(page, '31-bot-mat');
      for (let i = 0; i < 4 && await page.locator('.con-info').count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await settle(page);

      // ── The bot PLAYS: hand the round over (LT wheel → «Пас») ──────────────
      const before = tracks.map((t) => t.position);
      await press(page, 'Comma', 1200);
      await press(page, 'ArrowDown', 900);
      await press(page, 'Enter', 1500);
      await expect.poll(async () => {
        const now = (await view(request, playerId)).game.automa!.tracks.map((t) => t.position);
        return now.some((p, i) => p > before[i]);
      }, {timeout: 120_000, message: 'MarsBot never advanced a track on Arabia Terra'}).toBe(true);
      await settle(page);
      await shoot(page, '32-after-bot-round');
    });
  });
}
