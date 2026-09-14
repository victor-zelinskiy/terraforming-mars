import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, fetchPlayerModel, openQuickWheel, press, settle, soloGameConfig} from './consoleStart';

/**
 * CREATING A TURMOIL REDUX GAME WITH MARSBOT — the first item of iteration 0:
 * the create-game door accepts `turmoilRedux` (with Colonies), the server
 * stands a Parliament up (three resolutions of distinct parties, the Greens
 * ruling, the starter quest), MarsBot sits at the table as a BYSTANDER (no
 * delegates, no lobby seat — `BotParliamentMode = 'none'`), and the console's
 * wheel carries the «Парламент» slot from the first action phase on.
 */

const OUT = path.resolve('screenshots', 'parliament-create');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'ReduxTester', color: 'blue', beginner: false, handicap: 0, first: true}],
  automa: {difficulty: 'normal'},
  expansions: {colonies: true, turmoilRedux: true},
});

const parliament = (page: Page) => page.locator('.con-parl');

async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

test.describe('parliament · creation with MarsBot', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('a Redux + Colonies game with the bot boots into a standing Parliament', async ({page, request}) => {
    test.setTimeout(300_000);
    const playerId = await bootIntoGame(page, request, {config: GAME_CONFIG, query: '&consoleProfile=auto'});

    // SERVER TRUTH: the parliament exists, three distinct parties in the area,
    // the Greens rule, and the bot is not a participant.
    const model = await fetchPlayerModel(request, playerId) as unknown as {
      thisPlayer: {color: string},
      game: {parliament?: {slots: Array<{party: string}>, rulingParty: string, players: Array<{color: string, participates: boolean, lobby: boolean}>, quest?: {source: string}}},
    };
    const p = model.game.parliament;
    expect(p, 'the game carries a Parliament').toBeTruthy();
    expect(p!.slots.length).toBe(3);
    expect(new Set(p!.slots.map((s) => s.party)).size, 'three DISTINCT parties').toBe(3);
    expect(p!.rulingParty).toBe('Greens');
    expect(p!.quest?.source, 'the starter quest of generation 1').toBe('starter');
    const me = p!.players.find((s) => s.color === model.thisPlayer.color);
    const bot = p!.players.find((s) => s.color !== model.thisPlayer.color);
    expect(me?.participates, 'the human participates').toBe(true);
    expect(me?.lobby, 'with the free lobby delegate').toBe(true);
    expect(bot?.participates, 'MarsBot is a bystander').toBe(false);
    expect(bot?.lobby, 'and holds no lobby delegate').toBe(false);

    // THE CONSOLE: the wheel's slot opens the workspace on a real table.
    await openParliament(page);
    await expect(page.locator('.con-parl__slot')).toHaveCount(3);
    fs.mkdirSync(OUT, {recursive: true});
    await page.screenshot({path: path.join(OUT, '01-parliament-with-bot.png')});
    await press(page, 'Escape', 800);
  });
});
