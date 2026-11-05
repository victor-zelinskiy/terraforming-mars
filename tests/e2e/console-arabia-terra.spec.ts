import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootSeededGame, commitFocusedSpace, createGameWithCards, fetchPlayerModel, openBotBoardDetail, press, settle,
  soloGameConfig, walkToSpace,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * ARABIA TERRA on the console — the fourth fan map with a HOME-MADE MarsBot board (docs/AUTOMA_DATA_AUDIT.md §2i / §21)
 * and the map of the COVES.
 *
 *  1. THE BOARD. No legacy caption (the four names the board printed are hover markers now); the volcanic cells
 *     still empty wear them, and the popover names the place. Then
 *     the two faces of a cove, live: an OCEAN (the standard project) on one cove — the dossier says «Бухта» and its
 *     rule, the server counts the ocean; a GREENERY on the energy-production cove — the dossier draws the bonus as
 *     energy production before the press, and the server pays it. Nothing stranded on the way.
 *  2. THE BOT. MarsBot on this map: the home-made mat in the view (Power alone, Jovian riding Science, the free colony
 *     cell on space 5) and in «Планшет бота», the map's own rows, and the bot playing the round the player hands over.
 * Evidence → screenshots/arabia-terra/.
 */

const OUT = path.resolve('screenshots', 'arabia-terra');
const VOLCANIC = ['20', '55', '58', '63'];
const OCEAN_COVES = ['44', '48', '46'];
const ENERGY_COVE = '32';
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
  thisPlayer: {megacredits: number, energyProduction: number},
  waitingFor?: {type?: string},
};

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
