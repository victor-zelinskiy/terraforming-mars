import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootSeededGame, commitFocusedSpace, createGameWithCards, fetchPlayerModel, openBotBoardDetail, press, settle,
  soloGameConfig, walkToSpace,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * VASTITAS BOREALIS, THE FAN MAP, on the console — the first fan map in the premium scope AND the first with a
 * HOME-MADE MarsBot board (docs/AUTOMA_DATA_AUDIT.md §2f / §17, docs/claude/marsbot-fan-map-checklist.md).
 *
 *  1. THE BOARD. No legacy SVG caption; the four volcanoes and the North Pole are premium hover markers; the pole
 *     prints the premium «temperature · −4» plate. Then the pole for a HUMAN, live: a city (the standard project)
 *     aimed at the pole — the dossier names the step — landed, and the server shows the step and the bill
 *     (25 M€ for the city, 4 M€ for the pole, the temperature up one step), nothing stranded on the way.
 *  2. THE BOT. The game is created with MarsBot on this map; its mat is the home-made one (the building row's
 *     ENERGY icon on space 4, Jovian riding Science, Power alone, City riding Earth, the earth row's temperature
 *     on space 4), the map's own milestone / award rows are in play, the «Планшет бота» detail draws that mat, and
 *     the bot PLAYS the round the player hands over.
 * Evidence → screenshots/vastitas-borealis-fan/.
 */

const OUT = path.resolve('screenshots', 'vastitas-borealis-fan');
const NORTH_POLE = '33';
const MARKERS = ['07', '12', '21', '22', NORTH_POLE];
const CITY_COST = 25;
const POLE_COST = 4;

const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

/** A human-only game with a rich corporation (Teractor: 60 M€) so a city on the pole is affordable at once. */
function humanConfig() {
  return soloGameConfig({board: 'vastitas borealis', customCorporationsList: ['Teractor']});
}

function botConfig() {
  return soloGameConfig({board: 'vastitas borealis', automa: {difficulty: 'normal'}});
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type BotTrack = {layout: Array<string | null>, position: number, tags: Array<string>};
type View = {
  game: {
    gameOptions: {boardName: string},
    temperature: number,
    milestones: Array<{name: string}>,
    awards: Array<{name: string}>,
    automa?: {tracks: Array<BotTrack>},
  },
  thisPlayer: {megacredits: number},
  waitingFor?: {type?: string},
};

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

for (const profile of PROFILES) {
  test.describe(`Vastitas Borealis (fan map) · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('the board: premium markers on the volcanoes and the pole, the pole plate — and a city on the pole pays the step', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: humanConfig()});
      await bootSeededGame(page, request, playerId, {buy: 0, corporation: 'Teractor', query: profile.query});
      await settle(page);
      await armLeakWitness(page);
      await shoot(page, '00-board');

      const board = await page.evaluate((pole) => {
        const cell = document.querySelector(`[data_space_id="${pole}"]`);
        const el = cell?.querySelector<HTMLElement>('.board-space-bonus--bonustemperature4mc');
        return {
          captions: document.querySelector('#board_legend')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          markers: Array.from(document.querySelectorAll('.special-cell-marker')).map((m) =>
            Array.from(m.classList).find((c) => /^board-space-c?\d+$/.test(c)) ?? '?').sort(),
          pole: el === null || el === undefined ? undefined : getComputedStyle(el).backgroundImage,
        };
      }, NORTH_POLE);
      console.log('── the board ──', JSON.stringify(board, null, 2));

      expect(board.captions, 'no legacy SVG caption is left on this map').not.toMatch(/Mons|Fossae|Pole/);
      // The two off-Mars colony cells (01, 02) carry their global markers on every map; on the SURFACE exactly the
      // four volcanoes and the pole do.
      const surfaceMarkers = board.markers.filter((m) => !/^board-space-c0[12]$/.test(m));
      expect(surfaceMarkers, 'exactly the four volcanoes and the pole carry a marker').toEqual(MARKERS.map((id) => `board-space-${id}`));
      expect(board.pole, 'the North Pole prints its premium plate').toBeDefined();
      expect(board.pole!).toContain('bonus_temperature-4mc');

      await page.locator(`[data_space_id="${NORTH_POLE}"]`).hover();
      await settle(page);
      await shoot(page, '01-north-pole-hover');

      // ── A CITY ON THE POLE, live ────────────────────────────────────────────
      const before = await view(request, playerId);
      expect(before.game.gameOptions.boardName).toBe('vastitas borealis');
      expect(before.thisPlayer.megacredits, 'the seat can afford the city AND the pole').toBeGreaterThanOrEqual(CITY_COST + POLE_COST);

      // LT wheel → Standard Projects → «Город».
      await press(page, 'Comma', 1200);
      await press(page, 'Enter', 1400);
      expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
      const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
      const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
      for (let i = 0; i < 18 && !/^\s*город\s*$/i.test(await focusedName()); i++) {
        await press(page, walk[i % walk.length], 300);
      }
      expect(/^\s*город\s*$/i.test(await focusedName()), 'could not focus «Город»').toBeTruthy();
      await press(page, 'Enter', 1800);
      if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
        await press(page, 'KeyX', 2200);
      }
      await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '',
        {timeout: 30_000, message: 'the city asks for its cell'}).toBe('space');

      await walkToSpace(page, NORTH_POLE);
      await shoot(page, '10-pole-aimed');
      const panel = (await page.locator('.con-context').innerText().catch(() => '')).replace(/\s+/g, ' ');
      console.log('── the pole dossier ──', panel);
      expect(panel, 'the dossier names the temperature step the pole sells').toMatch(/температур/i);
      expect(await commitFocusedSpace(page), 'the city landed on the North Pole').toBeTruthy();

      await expect.poll(async () => (await view(request, playerId)).game.temperature,
        {timeout: 40_000, message: 'the pole raised the temperature one step'}).toBe(before.game.temperature + 2);
      await settle(page);
      await shoot(page, '11-after');
      const after = await view(request, playerId);
      expect(after.thisPlayer.megacredits, 'the city and the pole were both paid').toBe(before.thisPlayer.megacredits - CITY_COST - POLE_COST);
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });

    test('MarsBot: the home-made mat is in play, the detail draws it, and the bot plays the round', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: botConfig()});
      await bootSeededGame(page, request, playerId, {buy: 0, query: profile.query});
      await settle(page);
      await shoot(page, '20-bot-board');

      // ── The MAT reached the game (the server's view is what the console renders) ──
      const start = await view(request, playerId);
      expect(start.game.gameOptions.boardName).toBe('vastitas borealis');
      expect(start.game.automa, 'MarsBot is seated').toBeTruthy();
      const tracks = start.game.automa!.tracks;
      expect(tracks.length, 'the 7 map tracks (no Venus)').toBe(7);
      expect(tracks[0].layout[4], 'building 4 is the ENERGY icon').toBe('tag_4');
      expect(tracks[0].layout[13], 'and building 13').toBe('tag_4');
      expect(tracks[3].tags, 'Jovian rides Science').toEqual(['jovian', 'science']);
      expect(tracks[4].tags, 'Power stands alone').toEqual(['power']);
      expect(tracks[5].tags, 'City rides Earth').toEqual(['city', 'earth']);
      expect(tracks[5].layout[4], 'the earth row carries the temperature on space 4').toBe('temperature');
      expect(tracks[4].layout[9], 'power 9 (the second fleet\'s cell) is a city').toBe('city');
      expect(start.game.milestones.map((m) => m.name)).toEqual(['V. Electrician', 'Smith', 'Tradesman', 'Irrigator', 'Capitalist']);
      expect(start.game.awards.map((a) => a.name)).toEqual(['Forecaster', 'Edgedancer', 'Visionary', 'Naturalist', 'Voyager']);

      // ── «Планшет бота» draws that mat ─────────────────────────────────────
      // Information workspace → the BOT seat (the `botdoor` ring stop exists on the bot seat's own page).
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
      const buildingRow = mat.locator('.mb-track').nth(0);
      await expect(buildingRow.locator('.mb-cell').nth(4).locator('.mb-glyph--tag .tag-power'), 'the energy icon on building 4').toHaveCount(1);
      await expect(mat.locator('.mb-track').nth(3).locator('.mb-track__id .tag-jovian'), 'the Jovian tag on the science row').toHaveCount(1);
      await expect(mat.locator('.mb-track').nth(4).locator('.mb-track__id .tag-count'), 'the power row carries one tag').toHaveCount(1);
      await shoot(page, '21-bot-mat');
      for (let i = 0; i < 4 && await page.locator('.con-info').count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await settle(page);

      // ── The bot PLAYS: hand the round over (LT wheel → «Пас», the down slot) ──
      const before = tracks.map((t) => t.position);
      await press(page, 'Comma', 1200);
      await press(page, 'ArrowDown', 900);
      await press(page, 'Enter', 1500);
      await expect.poll(async () => {
        const now = (await view(request, playerId)).game.automa!.tracks.map((t) => t.position);
        return now.some((p, i) => p > before[i]);
      }, {timeout: 120_000, message: 'MarsBot never advanced a track on the fan map'}).toBe(true);
      await settle(page);
      await shoot(page, '22-after-bot-round');
    });
  });
}
