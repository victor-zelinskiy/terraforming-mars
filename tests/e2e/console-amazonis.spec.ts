import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootSeededGame, commitFocusedSpace, createGameWithCards, fetchPlayerModel, openBotBoardDetail, press, settle,
  soloGameConfig, walkToSpace,
} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * AMAZONIS PLANITIA, THE FAN MAP, on the console — the second fan map in the premium scope and the second with a
 * HOME-MADE MarsBot board (docs/AUTOMA_DATA_AUDIT.md §2g / §18).
 *
 *  1. THE BOARD. No legacy caption; the four volcanoes and the RESTRICTED centre are premium hover markers, and the
 *     centre's hover popover names its rule. Then a greenery (the standard project) aimed at a MICROBE cell: the
 *     dossier says the printed bonus will be SKIPPED (no card of the player's can hold a microbe) — truth before
 *     the press; the centre is never a legal cell; landed on the microbe cell, the server shows the tile and the
 *     bill with nothing stranded.
 *  2. THE BOT. MarsBot on this map: the home-made mat in the view (Jovian riding Power, Science alone, the three
 *     «colony for 5 M€» cells) and in «Планшет бота» (the colony glyph with its price), the map's own rows, and
 *     the bot playing the round the player hands over.
 * Evidence → screenshots/amazonis/.
 */

const OUT = path.resolve('screenshots', 'amazonis');
const RESTRICTED = '33';
const MARKERS = ['09', RESTRICTED, '35', '43', '49'];
const MICROBE_CELLS = ['20', '48', '06'];
const GREENERY_COST = 23;

const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

function humanConfig() {
  return soloGameConfig({board: 'amazonis p.', customCorporationsList: ['Teractor']});
}

function botConfig() {
  return soloGameConfig({board: 'amazonis p.', automa: {difficulty: 'normal'}});
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
    awards: Array<{name: string}>,
    automa?: {tracks: Array<BotTrack>},
  },
  thisPlayer: {megacredits: number},
  waitingFor?: {type?: string},
};

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

async function focusedCellAvailable(page: Page, id: string): Promise<boolean> {
  return await page.evaluate((cell) => document.querySelector(`[data_space_id="${cell}"]`)?.classList.contains('board-space--available') ?? false, id);
}

for (const profile of PROFILES) {
  test.describe(`Amazonis Planitia (fan map) · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('the board: markers on the volcanoes and the restricted centre; a microbe cell tells the truth about its bonus', async ({page, request}) => {
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
      expect(board.markers, 'exactly the four volcanoes and the restricted centre carry a marker').toEqual(MARKERS.map((id) => `board-space-${id}`));

      // The centre reads CLOSED by form before anything asks it: the hatch and the dashed contour on its own layer.
      const closed = await page.evaluate((id) => {
        const cell = document.querySelector(`[data_space_id="${id}"]`);
        return {
          marked: cell?.classList.contains('board-space--restricted') ?? false,
          paint: cell === null ? '' : getComputedStyle(cell, '::before').backgroundImage,
        };
      }, RESTRICTED);
      expect(closed.marked, 'the centre carries the restricted class').toBe(true);
      expect(closed.paint, 'its contour layer paints the hatch and the dashed core').toMatch(/pattern.*stroke-dasharray/);

      // The board's idle selection seeds on the centre, but nobody is inspecting: its marker stays calm (the owner's
      // frame of 2026-11-02 — the «i» on 33 read as focused on a board the player had never entered).
      expect(await page.locator('.special-cell-marker--active').count(), 'no marker lights up for an invisible cursor').toBe(0);

      // The centre, hovered: the popover names its rule (the engine's own `restricted` fact).
      await page.locator(`[data_space_id="${RESTRICTED}"]`).hover();
      await expect.poll(async () => (await page.locator('.board-cell-popover').innerText().catch(() => '')).replace(/\s+/g, ' '),
        {timeout: 15_000, message: 'the centre\'s popover names the restricted-area rule'}).toMatch(/Запретная зона/);
      await settle(page);
      await shoot(page, '01-centre-hover');
      const centreBox = await page.locator(`[data_space_id="${RESTRICTED}"]`).boundingBox();
      if (centreBox !== null) {
        fs.mkdirSync(OUT, {recursive: true});
        const pad = centreBox.width * 1.6;
        await page.screenshot({path: path.join(OUT, '02-centre-closeup.png'),
          clip: {x: centreBox.x - pad, y: centreBox.y - pad, width: centreBox.width + 2 * pad, height: centreBox.height + 2 * pad}});
      }

      // ── A GREENERY aimed at a microbe cell ──────────────────────────────────
      const before = await view(request, playerId);
      expect(before.game.gameOptions.boardName).toBe('amazonis p.');
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

      // The restricted centre is never a legal cell — the placement cursor (which walks legal cells only) cannot even
      // reach it; its rule was read off the hover above.
      expect(await focusedCellAvailable(page, RESTRICTED), 'the centre is not a legal cell').toBe(false);

      // A microbe cell: the player holds no microbe card — the dossier says the bonus will be skipped.
      let target: string | undefined;
      for (const id of MICROBE_CELLS) {
        await walkToSpace(page, id);
        if (await focusedCellAvailable(page, id)) {
          target = id;
          break;
        }
      }
      expect(target, 'a legal microbe cell').toBeDefined();
      const panel = (await page.locator('.con-context').innerText().catch(() => '')).replace(/\s+/g, ' ');
      console.log('── the microbe dossier ──', panel);
      expect(panel, 'the dossier names the loss before the press').toMatch(/бонус будет пропущен/i);
      await shoot(page, '11-microbe-aimed');
      expect(await commitFocusedSpace(page), 'the greenery landed on the microbe cell').toBeTruthy();

      await expect.poll(async () => (await view(request, playerId)).game.oxygenLevel,
        {timeout: 40_000, message: 'the greenery raised the oxygen'}).toBe(before.game.oxygenLevel + 1);
      await settle(page);
      await shoot(page, '12-after');
      const after = await view(request, playerId);
      expect(after.thisPlayer.megacredits, 'the greenery was paid, and nothing else').toBe(before.thisPlayer.megacredits - GREENERY_COST);
      expect(after.waitingFor?.type ?? 'none', 'no «which card» question for a microbe nobody can hold').not.toBe('card');
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });

    test('MarsBot: the home-made mat with its colony cells is in play, the detail draws it, and the bot plays the round', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: botConfig()});
      await bootSeededGame(page, request, playerId, {buy: 0, query: profile.query});
      await settle(page);
      await shoot(page, '20-bot-board');

      const start = await view(request, playerId);
      expect(start.game.gameOptions.boardName).toBe('amazonis p.');
      expect(start.game.automa, 'MarsBot is seated').toBeTruthy();
      const tracks = start.game.automa!.tracks;
      expect(tracks.length, 'the 7 map tracks (no Venus)').toBe(7);
      expect(tracks[1].layout[7], 'space 7 is a «colony for 5 M€» cell').toBe('colony5');
      expect(tracks[1].layout[10]).toBe('colony5');
      expect(tracks[4].layout[8]).toBe('colony5');
      expect(tracks[4].tags, 'Jovian rides Power').toEqual(['power', 'jovian']);
      expect(tracks[3].tags, 'Science stands alone').toEqual(['science']);
      expect(tracks[5].tags, 'City rides Earth').toEqual(['city', 'earth']);
      expect(start.game.milestones.map((m) => m.name)).toEqual(['Colonizer', 'Forester', 'Minimalist', 'Terran', 'Tropicalist']);
      expect(start.game.awards.map((a) => a.name)).toEqual(['Curator', 'A. Engineer', 'Promoter', 'Tourist', 'A. Zoologist']);

      // ── «Планшет бота» draws the colony cell with its price ──────────────
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
      const spaceRow = mat.locator('.mb-track').nth(1);
      await expect(spaceRow.locator('.mb-cell').nth(7).locator('.mb-glyph__multi'), 'the colony cell wears its price').toHaveText(/5/);
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
      }, {timeout: 120_000, message: 'MarsBot never advanced a track on Amazonis'}).toBe(true);
      await settle(page);
      await shoot(page, '22-after-bot-round');
    });
  });
}
