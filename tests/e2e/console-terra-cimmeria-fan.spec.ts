import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootSeededGame, commitFocusedSpace, createGameWithCards, fetchPlayerModel, openBotBoardDetail, press, settle,
  soloGameConfig, walkToSpace,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * THE OLD (fan) TERRA CIMMERIA on the console — the third fan map with a HOME-MADE MarsBot board
 * (docs/AUTOMA_DATA_AUDIT.md §2h / §19).
 *
 *  1. THE BOARD. No legacy caption; the four volcanoes are premium hover markers. Then a greenery (the standard
 *     project) aimed at the map's richest ENERGY cell: the dossier names the energy before the press, and the server
 *     shows the tile and the energy after it, with nothing stranded.
 *  2. THE BOT. MarsBot on this map: the home-made mat in the view (Jovian riding Power, City riding Earth, Science
 *     alone, the family's energy icons on building 4 and 13) and in «Планшет бота», the map's own rows, and the bot
 *     playing the round the player hands over.
 * Evidence → screenshots/terra-cimmeria-fan/.
 */

const OUT = path.resolve('screenshots', 'terra-cimmeria-fan');
const MARKERS = ['05', '21', '27', '38'];
const ENERGY_CELL = '16'; // y=2, energy × 3
const GREENERY_COST = 23;

const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

function humanConfig() {
  return soloGameConfig({board: 't. cimmeria', customCorporationsList: ['Teractor']});
}

function botConfig() {
  return soloGameConfig({board: 't. cimmeria', automa: {difficulty: 'normal'}});
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
    milestones: Array<{name: string}>,
    spaces: Array<{id: string, tileType?: number}>,
    awards: Array<{name: string}>,
    automa?: {tracks: Array<BotTrack>},
  },
  thisPlayer: {megacredits: number, energy: number},
  waitingFor?: {type?: string},
};

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

async function focusedCellAvailable(page: Page, id: string): Promise<boolean> {
  return await page.evaluate((cell) => document.querySelector(`[data_space_id="${cell}"]`)?.classList.contains('board-space--available') ?? false, id);
}

for (const profile of PROFILES) {
  test.describe(`Terra Cimmeria (the old fan map) · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('the board: markers on the four volcanoes; an energy cell names its energy before the press and pays it', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: humanConfig()});
      await bootSeededGame(page, request, playerId, {buy: 0, corporation: 'Teractor', query: profile.query});
      await settle(page);
      await armLeakWitness(page);
      await shoot(page, '00-board');

      const board = await page.evaluate(() => ({
        captions: document.querySelector('#board_legend')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        markers: Array.from(document.querySelectorAll('.special-cell-marker')).map((m) =>
          Array.from(m.classList).find((c) => /^board-space-c?\d+$/.test(c)) ?? '?').filter((c) => !/^board-space-c0[12]$/.test(c)).sort(),
      }));
      console.log('── the board ──', JSON.stringify(board));
      expect(board.captions, 'no legacy SVG caption is left on this map').not.toMatch(/Tholus|Mons/);
      // A marker stands on an EMPTY special cell only — the solo setup's neutral tiles may already cover a volcano.
      const occupied = new Set((await view(request, playerId)).game.spaces.filter((s) => s.tileType !== undefined).map((s) => s.id));
      const expected = MARKERS.filter((id) => !occupied.has(id));
      expect(expected.length, 'the setup leaves at least one volcano open').toBeGreaterThan(0);
      expect(board.markers, 'every EMPTY volcano carries a marker, and nothing else does').toEqual(expected.map((id) => `board-space-${id}`));
      expect(await page.locator('.special-cell-marker--active').count(), 'no marker lights up for an invisible cursor').toBe(0);

      // ── A GREENERY on the richest energy cell ──────────────────────────────
      const before = await view(request, playerId);
      expect(before.game.gameOptions.boardName).toBe('t. cimmeria');
      expect(before.thisPlayer.megacredits).toBeGreaterThanOrEqual(GREENERY_COST);

      await press(page, 'Comma', 1200);
      await press(page, 'Enter', 1400);
      expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
      const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
      const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
      for (let i = 0; i < 18 && !/^\s*озеленение\s*$/i.test(await focusedName()); i++) {
        await press(page, walk[i % walk.length], 300);
      }
      expect(/^\s*озеленение\s*$/i.test(await focusedName()), 'could not focus «Озеленение»').toBeTruthy();
      await press(page, 'Enter', 1800);
      if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
        await press(page, 'KeyX', 2200);
      }
      await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '',
        {timeout: 30_000, message: 'the greenery asks for its cell'}).toBe('space');

      await walkToSpace(page, ENERGY_CELL);
      expect(await focusedCellAvailable(page, ENERGY_CELL), 'the energy cell is a legal greenery cell').toBe(true);
      const panel = (await page.locator('.con-context').innerText().catch(() => '')).replace(/\s+/g, ' ');
      console.log('── the energy dossier ──', panel);
      // The printed bonus row is the dossier's one grammar for every cell bonus: «Бонус клетки +3» with the RESOURCE as
      // its icon (never a word) — read the icon of that very row.
      const bonusRow = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.con-context .con-dossier-row'));
        const row = rows.find((r) => /Бонус клетки/.test(r.textContent ?? ''));
        return {text: row?.textContent?.replace(/\s+/g, ' ').trim() ?? '', icon: row?.querySelector('.con-dossier-row__ico')?.className ?? ''};
      });
      console.log('── the bonus row ──', JSON.stringify(bonusRow));
      expect(bonusRow.text, 'the dossier states the cell bonus before the press').toMatch(/\+3/);
      expect(bonusRow.icon, 'and draws it as ENERGY').toMatch(/energy/i);
      await shoot(page, '10-energy-aimed');
      expect(await commitFocusedSpace(page), 'the greenery landed on the energy cell').toBeTruthy();

      await expect.poll(async () => (await view(request, playerId)).game.oxygenLevel,
        {timeout: 40_000, message: 'the greenery raised the oxygen'}).toBe(before.game.oxygenLevel + 1);
      await settle(page);
      await shoot(page, '11-after');
      const after = await view(request, playerId);
      expect(after.thisPlayer.energy, 'the cell paid its three energy').toBe(before.thisPlayer.energy + 3);
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });

    test('MarsBot: the home-made mat is in play, the detail draws it, and the bot plays the round', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: botConfig()});
      await bootSeededGame(page, request, playerId, {buy: 0, query: profile.query});
      await settle(page);
      await shoot(page, '20-bot-board');

      const start = await view(request, playerId);
      expect(start.game.gameOptions.boardName).toBe('t. cimmeria');
      expect(start.game.automa, 'MarsBot is seated').toBeTruthy();
      const tracks = start.game.automa!.tracks;
      expect(tracks.length, 'the 7 map tracks (no Venus)').toBe(7);
      expect(tracks[0].layout[4], 'building 4 is the family\'s ENERGY icon').toBe('tag_4');
      expect(tracks[0].layout[13], 'and building 13').toBe('tag_4');
      expect(tracks[4].tags, 'Jovian rides Power').toEqual(['power', 'jovian']);
      expect(tracks[3].tags, 'Science stands alone').toEqual(['science']);
      expect(tracks[5].tags, 'City rides Earth').toEqual(['city', 'earth']);
      expect(start.game.milestones.map((m) => m.name)).toEqual(['T. Collector', 'Firestarter', 'Terra Pioneer', 'T. Spacefarer', 'Gambler']);
      expect(start.game.awards.map((a) => a.name)).toEqual(['Biologist', 'Incorporator', 'T. Politician', 'Urbanist', 'Warmonger']);

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
      await expect(mat.locator('.mb-track').nth(0).locator('.mb-cell').nth(4).locator('.mb-glyph--tag .tag-power'), 'the energy icon on building 4').toHaveCount(1);
      await expect(mat.locator('.mb-track').nth(4).locator('.mb-track__id .tag-jovian'), 'the Jovian tag on the power row').toHaveCount(1);
      await shoot(page, '21-bot-mat');
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
      }, {timeout: 120_000, message: 'MarsBot never advanced a track on the old Terra Cimmeria'}).toBe(true);
      await settle(page);
      await shoot(page, '22-after-bot-round');
    });
  });
}
