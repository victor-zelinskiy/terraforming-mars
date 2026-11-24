import {test, expect, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce, openQuickWheel, placeTile, placementState, press, pressUntil, settle} from './consoleStart';
import {hotVerb} from './parliamentDrive';
import {armWitness} from './witness';

/**
 * A SITTING ASIDE FOR THE BOARD, AND «ПАРЛАМЕНТ» ON THE WHEEL. The winner's tile of a law is placed on the board: the
 * sitting steps aside whole (`yieldStackToBoard`) and comes back by itself, at the same depth, when the board's
 * business ends. Meanwhile the wheels are the player's — and the RT wheel has a door to the Parliament.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO — the one-owner law's EXTRA, the autopilot in a real browser, CI run 45494668264,
 * game 64, finding #138: «frames [parliament] · scene yielded-to-board» — a Parliament live on the stack while the
 * stack aside still held one serving the same question). The wheel's door — «you cannot be inside the same workspace
 * twice» — asked the flow's plate and the park, and not the third home: a frame aside for the board. It stood a SECOND
 * sitting up over the placement, at its own door «A К полю», beside the one that was coming back.
 *
 * The table is fixture `parliament-aquifer-enact` (the winner's ocean behind the reward stage's door). «Done» is the
 * SERVER's word; the door's press is RECORDED from before it (`armWitness`): no Parliament stands up at any moment.
 */
type Wire = {waitingFor?: {type?: string, promptId?: number}, game: {oceans: number}};
const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;

test.describe('a sitting aside for the board — the wheel\'s door to the Parliament', () => {
  test('«Парламент» on the wheel over the winner\'s tile stands nothing up: the placement stays, the reason is said, and the sitting comes back by itself — once', async ({page, request}) => {
    test.setTimeout(360_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-aquifer-enact', {query: '&consoleProfile=auto', landing: 'prompt'});
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the sitting').toBe(true);
    await expect(page.locator('.con-sit'), 'the sitting surface').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 20_000});
    // The payout's recipient (the first holder), then the reward stage stops on the tile's door.
    for (let tries = 0; tries < 3 && (await wire(request, playerId)).waitingFor?.type === 'card'; tries++) {
      await press(page, 'Enter', 1500);
    }
    await expect.poll(async () => (await wire(request, playerId)).waitingFor?.type, {timeout: 30_000, message: 'the server asks the winner\'s tile'}).toBe('space');
    await expect.poll(() => hotVerb(page), {timeout: 60_000, message: 'the reward stage stops on the tile\'s door'}).toMatch(/К полю|Onto the board/i);
    expect(await pressUntil(page, 'Enter', async () => await placementState(page) !== 'none', {tries: 3, settleMs: 1500}), 'A «К полю» opens the placement').toBe(true);
    await expect(page.locator('.con-parl'), 'the sitting stands aside for the board').toHaveCount(0, {timeout: 15_000});
    const asked = (await wire(request, playerId)).waitingFor?.promptId;
    const oceans = (await wire(request, playerId)).game.oceans;

    // THE DOOR IS RECORDED FROM BEFORE ITS PRESS: no Parliament at any moment of it.
    const seen = await armWitness<{parl: number, placing: boolean}>(page, 'aside-door', () => ({
      parl: document.querySelectorAll('.con-parl').length,
      placing: document.querySelector('.con-board--placing, .con-board--locked') !== null,
    }), {settled: true});
    await openQuickWheel(page);
    // ↓ is «Парламент» — the direction IS the activation. The press is answered by the one reason, on the notice.
    await press(page, 'ArrowDown', 900);
    await expect(page.locator('.con-notice'), 'the press is answered: the one reason the game will not move from here').toHaveCount(1, {timeout: 15_000});
    await settle(page, {timeoutMs: 20_000});
    expect(await seen.ever((v) => v.parl > 0), 'a second sitting stood up over the placement').toBe(false);
    expect(await placementState(page), 'the placement still stands').not.toBe('none');
    expect((await wire(request, playerId)).waitingFor?.promptId, 'the same question, untouched').toBe(asked);

    // THE TILE IS PLACED (the wheel closed by B if it still stands): the sitting comes back BY ITSELF — one Parliament.
    for (let tries = 0; tries < 3 && await page.locator('.con-quick').count() > 0; tries++) {
      await press(page, 'Escape', 700);
    }
    expect(await placeTile(page), 'the ocean is placed through the standard two-press flow').toBe(true);
    await expect.poll(async () => (await wire(request, playerId)).game.oceans, {timeout: 30_000, message: 'the server placed the ocean'}).toBe(oceans + 1);
    await seen.waitFor((v) => v.parl === 1 && !v.placing, {timeoutMs: 90_000, message: 'the sitting never came back from the board'});
    await settle(page, {timeoutMs: 60_000});
    await expect(page.locator('.con-parl'), 'one Parliament, back at its depth').toHaveCount(1);
    expect(await seen.ever((v) => v.parl > 1), 'never two Parliament surfaces').toBe(false);
    expect(await seen.ever((v) => v.parl > 0 && v.placing), 'never a Parliament over a board that is still placing').toBe(false);
    await seen.stop();
  });
});
