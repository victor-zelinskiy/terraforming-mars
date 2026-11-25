import {test, expect, APIRequestContext, Page} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, cinematicBeat, fetchPlayerModel, openQuickWheel, pressUntil, sendPlayerInput} from './consoleStart';
import {armWitness} from './witness';

/**
 * THE LANDING WAITS FOR THE BOARD — a tile another seat placed while the player reads their hand lands when they come
 * back to the board, however long that takes: it flies. It is never «revealed without its flight» by a clock.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 6 — «like a clock, not on its nets», the third hundred of whole games,
 * 2026-11-25). The queue of foreign landings parked for a covered board had twenty seconds of the WALL: fifteen lines
 * in thirty-eight games read «remote-placement:watchable-board … the wait ended on its ceiling (planned: the viewer
 * kept the board covered by workspace — the tile is revealed without its flight)». Each of them was a player who came
 * back to a board with a tile on it that had never arrived — and a net doing, on schedule, the work the flow did not
 * know how to do. The law now (the same as the board's scale story): the wait's clock runs only while the board could
 * show the landing (`boardCoverWitness.boardWaitClock`); behind the viewer's own screen the tile waits for its stage,
 * and the node of the wait graph says it waits on the PLAYER.
 *
 * The table is fixture `nomads-remote-move` (two human seats, red on the move with 30 M€): red buys the Greenery
 * standard project over the API — to this page, another player's console — and places it, while blue stands in the
 * hand. «Done» is the SERVER's word (the cell's tile in the model); the wait past the old bound is the spec's SUBJECT
 * (the one sanctioned pause, named); the landing is RECORDED from before B (`armWitness`).
 */
type Wire = {
  waitingFor?: {
    type?: string, promptId?: number, title?: unknown, spaces?: Array<string>,
    options?: Array<{title?: unknown, cards?: Array<{name: string, calculatedCost?: number}>}>,
  },
  game: {spaces: Array<{id: string, tileType?: number}>},
};
type Landing = {queued: number, active: boolean, waiting: boolean, behind: boolean};

const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;
const titleText = (title: unknown): string => (typeof title === 'string' ? title : String((title as {message?: string} | undefined)?.message ?? ''));
const landing = (page: Page): Promise<Landing> =>
  page.evaluate(() => (window as unknown as {__conReady: () => {remoteLanding: Landing}}).__conReady().remoteLanding);
/** The landing's old whole-life bound (`BOARD_WAIT_MAX_MS`) and a margin past it. */
const OLD_BOUND_MS = 20_000;

test.describe('the landing waits for the board', () => {
  test('a tile placed while the player reads their hand: past the old twenty seconds it is still held for its flight — and the board, back, gets its landing', async ({page, request}) => {
    test.setTimeout(240_000);
    const said: Array<string> = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[wait-graph] ceiling') || text.includes('vue-error')) {
        said.push(text.slice(0, 300));
      }
    });
    const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'nomads-remote-move');
    const red = seats.find((seat) => seat !== blue) ?? '';

    // BLUE GOES TO THE HAND: the quick wheel, its centre.
    await openQuickWheel(page);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1200}), 'the centre of the wheel opens the hand').toBe(true);

    // RED PLANTS A GREENERY (the API — another player's console): the standard project at the server's price, then its cell.
    const menu = (await wire(request, red)).waitingFor;
    const sp = (menu?.options ?? []).findIndex((option) => titleText(option.title) === 'Standard projects');
    expect(sp, 'the menu of red offers the standard projects').toBeGreaterThanOrEqual(0);
    const greenery = (menu?.options?.[sp].cards ?? []).find((card) => card.name.startsWith('Greenery'));
    expect(greenery, 'the Greenery is offered').toBeDefined();
    await sendPlayerInput(request, red, {
      type: 'or', index: sp, promptId: menu?.promptId,
      response: {type: 'projectCard', card: greenery?.name ?? '', payment: {...NO_PAYMENT, megacredits: greenery?.calculatedCost ?? 23}},
    } as never);
    await expect.poll(async () => (await wire(request, red)).waitingFor?.type, {timeout: 30_000, message: 'the server asks red for the cell'}).toBe('space');
    const where = (await wire(request, red)).waitingFor;
    const cell = (where?.spaces ?? [])[0] ?? '';
    expect(cell, 'a cell is offered').not.toBe('');
    await sendPlayerInput(request, red, {type: 'space', spaceId: cell, promptId: where?.promptId} as never);
    await expect.poll(async () => (await wire(request, blue)).game.spaces.find((space) => space.id === cell)?.tileType,
      {timeout: 30_000, message: 'the server placed the tile'}).toBeDefined();

    // THE LANDING IS OWED TO THE BOARD — and waits, by its own word, behind blue's own screen.
    await expect.poll(async () => {
      const now = await landing(page);
      return `${now.waiting}|${now.behind}`;
    }, {timeout: 30_000, message: 'the landing parked behind the hand'}).toBe('true|true');
    // (A held cell keeps its element and paints nothing: `board-space-tile--placement-cleared` — the same reading the tile specs use.)
    const tile = page.locator(`[data_space_id="${cell}"] [class*="board-space-tile--greenery"]:not([class*="placement-cleared"])`);
    await expect(tile, 'the cell keeps its tile for the flight').toHaveCount(0);

    // THE OLD BOUND PASSES. (The spec's subject: twenty seconds of the wall used to reveal the tile here, unseen.)
    await cinematicBeat(page, OLD_BOUND_MS + 4_000, 'the old twenty seconds of the landing — the bound that revealed the tile under the hand');
    expect(said.filter((line) => line.includes('ceiling')), 'no wait was ended by a clock').toEqual([]);
    const waited = await landing(page);
    expect(`${waited.waiting}|${waited.behind}|${waited.queued > 0}`, 'the landing still waits for its stage').toBe('true|true|true');
    await expect(tile, 'the tile is still held for its flight').toHaveCount(0);
    await expect(page.locator('.con-hand'), 'the hand still stands — nothing took the screen').toHaveCount(1);

    // B — THE BOARD: the landing is told (recorded from before the press), and the cell reads the truth.
    const told = await armWitness<Landing>(page, 'remote-landing-told', () =>
      (window as unknown as {__conReady: () => {remoteLanding: Landing}}).__conReady().remoteLanding);
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 1200}), 'B leaves the hand').toBe(true);
    await told.waitFor((v) => v.active && !v.waiting, {timeoutMs: 45_000, message: 'the board came back and the landing never took the stage'});
    await told.waitFor((v) => !v.active && !v.waiting && v.queued === 0, {timeoutMs: 45_000, message: 'the landing never ended on the board'});
    await told.stop();
    await expect(tile, 'the tile stands on the board').toHaveCount(1, {timeout: 30_000});
    expect(said.filter((line) => line.includes('ceiling')), 'told, never ended by its ceiling').toEqual([]);
    expect(said.filter((line) => line.includes('vue-error'))).toEqual([]);
  });
});
