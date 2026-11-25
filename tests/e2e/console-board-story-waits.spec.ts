import {test, expect, APIRequestContext, Page} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, cinematicBeat, fetchPlayerModel, openQuickWheel, pressUntil, sendPlayerInput} from './consoleStart';
import {armWitness} from './witness';

/**
 * THE BOARD's STORY WAITS FOR THE BOARD — a scale another seat moved while the player reads their hand is told when
 * they come back to the board, however long that takes: it glides. It is never ended by a clock.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 6 — the second hundred of whole games, 2026-11-25; finding #112). The park
 * that holds a scale for the board gave its story thirty seconds of the WALL: fifteen records in a hundred games were
 * «story degraded after 30s — the release edge never came» — a scale that snapped under a screen the player was
 * reading, or a second after they came back. Thirteen of them were filed «planned»: a net doing, on schedule, the
 * work the flow did not know how to do. The law now: the story's debt ages only while the board is in the player's
 * view (`OwedStory.waitsOn`, `boardBeatPark.boardOutOfView`); behind a screen of their own it waits for its stage.
 * The truth is on every instrument meanwhile (the top strip reads the applied view) — only the board's own marker,
 * which nobody sees, keeps the old value for the telling.
 *
 * The table is fixture `nomads-remote-move` (two human seats, red on the move with 30 M€): red buys the Asteroid
 * standard project over the API — to this page, another player's console — while blue stands in the hand.
 * «Done» is the SERVER's word (the temperature); the wait past the park's old bound is the spec's SUBJECT (the one
 * sanctioned pause, named); the telling is RECORDED from before B (`armWitness`).
 */
type Wire = {
  waitingFor?: {type?: string, promptId?: number, title?: unknown, options?: Array<{title?: unknown, cards?: Array<{name: string, calculatedCost?: number}>}>},
  game: {temperature: number},
};
type Story = {draining: boolean, held: string, owed: Array<{id: string, ageMs: number, why: string, waitsOn?: string}>};

const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;
const titleText = (title: unknown): string => (typeof title === 'string' ? title : String((title as {message?: string} | undefined)?.message ?? ''));
const story = (page: Page): Promise<Story> =>
  page.evaluate(() => (window as unknown as {__conReady: () => {scaleStory: Story}}).__conReady().scaleStory);
/** The park's old whole-life bound (`BOARD_BEAT_PARK_SAFETY_MS`) and a margin past it. */
const OLD_BOUND_MS = 30_000;

test.describe('the board\'s story waits for the board', () => {
  test('a scale moved while the player reads their hand: past the old thirty seconds nothing has snapped, the strip tells the truth — and the board, back, is told', async ({page, request}) => {
    test.setTimeout(240_000);
    const said: Array<string> = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[presentation-ledger]') || text.includes('vue-error')) {
        said.push(text.slice(0, 300));
      }
    });
    const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'nomads-remote-move');
    const red = seats.find((seat) => seat !== blue) ?? '';
    const before = (await wire(request, blue)).game.temperature;

    // BLUE GOES TO THE HAND: the quick wheel, its centre.
    await openQuickWheel(page);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand').count() > 0, {tries: 3, settleMs: 1200}), 'the wheel\'s centre opens the hand').toBe(true);

    // RED RAISES THE TEMPERATURE (the API — another player's console): the Asteroid standard project, at the server's price.
    const menu = (await wire(request, red)).waitingFor;
    const sp = (menu?.options ?? []).findIndex((option) => titleText(option.title) === 'Standard projects');
    expect(sp, 'red\'s menu offers the standard projects').toBeGreaterThanOrEqual(0);
    const asteroid = (menu?.options?.[sp].cards ?? []).find((card) => card.name === 'Asteroid:SP');
    expect(asteroid, 'the Asteroid is offered').toBeDefined();
    await sendPlayerInput(request, red, {
      type: 'or', index: sp, promptId: menu?.promptId,
      response: {type: 'projectCard', card: 'Asteroid:SP', payment: {...NO_PAYMENT, megacredits: asteroid?.calculatedCost ?? 14}},
    } as never);
    await expect.poll(async () => (await wire(request, blue)).game.temperature, {timeout: 30_000, message: 'the server raised the temperature'}).toBeGreaterThan(before);
    const after = (await wire(request, blue)).game.temperature;

    // THE TRUTH IS ON THE INSTRUMENT AT ONCE; the story is owed to the board — and WAITS, by its own word, on the hand.
    await expect(page.locator('.con-status__param--temperature'), 'the top strip reads the applied view').toContainText(String(after), {timeout: 30_000});
    await expect.poll(async () => (await story(page)).held, {timeout: 30_000, message: 'the park holds the scale for the board'}).toContain('temperature');
    await expect.poll(async () => (await story(page)).owed.find((owed) => owed.id === 'board-beat-park')?.waitsOn ?? '',
      {timeout: 15_000, message: 'the ledger says on whom the story waits'}).toMatch(/workspace/);

    // THE OLD BOUND PASSES. (The spec's subject: thirty seconds of the wall used to end the story here.)
    await cinematicBeat(page, OLD_BOUND_MS + 4_000, 'the park\'s old thirty seconds — the bound that snapped the scale under the hand');
    expect(said.filter((line) => line.includes('degraded')), 'no story was ended by a clock').toEqual([]);
    const waited = await story(page);
    expect(waited.held, 'the scale is still held for its telling').toContain('temperature');
    expect(waited.owed.find((owed) => owed.id === 'board-beat-park')?.ageMs ?? Number.NaN, 'the debt did not age behind the player\'s own screen').toBeLessThan(5_000);
    await expect(page.locator('.con-hand'), 'the hand still stands — nothing took the screen').toHaveCount(1);

    // B — THE BOARD: the story is told (recorded from before the press), the scale reads the truth.
    const told = await armWitness<{draining: boolean, held: string}>(page, 'board-story-told', () => {
      const facts = (window as unknown as {__conReady: () => {scaleStory: {draining: boolean, held: string}}}).__conReady().scaleStory;
      return {draining: facts.draining, held: facts.held};
    });
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-hand').count() === 0, {tries: 4, settleMs: 1200}), 'B leaves the hand').toBe(true);
    await told.waitFor((v) => v.draining, {timeoutMs: 45_000, message: 'the board came back and the story never began'});
    await told.waitFor((v) => !v.draining && v.held === '', {timeoutMs: 45_000, message: 'the story never ended on the board'});
    await told.stop();
    await expect(page.locator('.arc-scale--temperature .arc-scale__digit--current'), 'the board\'s own scale reads the truth').toContainText(String(after), {timeout: 30_000});
    expect(said.filter((line) => line.includes('degraded')), 'told, never degraded').toEqual([]);
    expect(said.filter((line) => line.includes('vue-error'))).toEqual([]);
  });
});
