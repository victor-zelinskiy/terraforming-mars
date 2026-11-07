import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, fetchPlayerModel, press, settle} from './consoleStart';
import {armLeakWitness, strandedReports} from './parliamentDrive';

/**
 * «RANDOM TILE PLACEMENT» + MarsBot on the console — supported since 2026-11-07 (the owner's question; the old creator
 * conflict was a leftover). Fixture `marsbot-shuffled-board`: a solo table vs MarsBot on a Tharsis whose cell bonuses
 * were shuffled (the generator proved they moved). The round blue hands over is played for real: the bot resolves its
 * whole round on the shuffled board, the next generation begins, nothing is stranded, and the bot's tracks moved.
 * Evidence → screenshots/marsbot-shuffled-board/.
 */

const OUT = path.resolve('screenshots', 'marsbot-shuffled-board');
const PROFILE = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type View = {
  game: {
    generation: number,
    gameOptions: {boardName: string, shuffleMapOption?: boolean},
    automa?: {tracks: Array<{position: number}>},
  },
  waitingFor?: {type?: string},
};

const view = async (request: APIRequestContext, playerId: string): Promise<View> =>
  await fetchPlayerModel(request, playerId) as unknown as View;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

test.describe(`MarsBot on a shuffled board · ${PROFILE.id}`, () => {
  test.use({viewport: PROFILE.viewport, deviceScaleFactor: 1, screen: PROFILE.viewport});

  test('the bot plays its round on a board whose bonuses were shuffled', async ({page, request}) => {
    test.setTimeout(480_000);
    const playerId = await bootFixture(page, request, 'marsbot-shuffled-board', {query: PROFILE.query});
    await settle(page);
    await armLeakWitness(page);
    const start = await view(request, playerId);
    expect(start.game.gameOptions.boardName).toBe('tharsis');
    expect(start.game.gameOptions.shuffleMapOption, 'the map is shuffled').toBe(true);
    expect(start.game.automa, 'MarsBot is seated').toBeTruthy();
    const positionsBefore = start.game.automa!.tracks.reduce((n, t) => n + t.position, 0);
    await shoot(page, '10-shuffled-board');

    // ── THE PASS (LT wheel → «Пас»): the bot plays the round on the shuffled board, the next generation begins ──
    await press(page, 'Comma', 1200);
    await press(page, 'ArrowDown', 900);
    await press(page, 'Enter', 1500);
    await expect.poll(async () => (await view(request, playerId)).game.generation,
      {timeout: 240_000, message: 'MarsBot plays its round on the shuffled board and the generation ends'}).toBe(start.game.generation + 1);
    await expect.poll(async () => (await view(request, playerId)).waitingFor?.type ?? '', {timeout: 120_000, message: 'the next prompt stands'})
      .not.toBe('');
    await settle(page, {timeoutMs: 120_000, notifications: true});
    const after = await view(request, playerId);
    const positionsAfter = after.game.automa!.tracks.reduce((n, t) => n + t.position, 0);
    console.log('── the bot\'s tracks ──', JSON.stringify({before: positionsBefore, after: positionsAfter}));
    expect(positionsAfter, 'the bot\'s tracks moved during its round').toBeGreaterThan(positionsBefore);
    await shoot(page, '20-after-the-round');
    expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
  });
});
