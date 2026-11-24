import {test, expect, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, sendPlayerInput, settle} from './consoleStart';
import {armWitness} from './witness';

/**
 * X59 MARS NOMADS, MOVED BY ANOTHER SEAT — the REMOTE leg of the camp's scene (`console/nomads/consoleNomadMove.ts`:
 * the queue of remote hops, its hold, the token carried from the cell it stood on to the cell it stands on now).
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 4 — «the state space is walked, not sampled»): `scene:nomad-move-remote`
 * and its hold stood on the ledger of the UNWALKED (`tests/client/bottle/kernelUnwalked.json`). The move needs a table
 * of two HUMAN seats with the card on the OTHER one — which no test of the suite, no walk of the monkey and no whole
 * game of the autopilot (solo, or against MarsBot) ever is.
 *
 * The table is fixture `nomads-remote-move`: blue (the viewer) has passed the move to red; red holds Mars Nomads with
 * its action open, the camp on a plain land cell with room around it. The spec moves the camp AS RED, over the API —
 * to the viewer's page exactly what another player's console does — and blue watches.
 *
 * «Done» is the SERVER's word (the camp's cell in the viewer's own model); the hop is RECORDED from before the move
 * (`armWitness`): the camp is ONE object — it leaves the cell it stood on, is carried, and lands on the new one; never
 * on two cells at once, never gone with nothing in the air.
 */
type Wf = {
  type: string, promptId?: number, spaces?: Array<string>,
  options?: Array<{type: string, cards?: Array<{name: string}>}>,
};
type Wire = {
  waitingFor?: Wf,
  game: {spaces: Array<{id: string, nomads?: boolean}>},
};
type Hop = {
  /** The flight layer of the camp's move stands. */
  flight: boolean,
  /** The cells that show the camp's token (one — or none while it is carried). */
  camp: Array<string>,
};

const CARD = 'Mars Nomads';

async function wire(request: APIRequestContext, seat: string): Promise<Wire> {
  return await fetchPlayerModel(request, seat) as unknown as Wire;
}

test.describe('Mars Nomads — the camp moved by another seat', () => {
  test('red moves the camp on its own turn: on blue\'s board the token leaves its cell, is carried and lands — one object, nothing left behind', async ({page, request}) => {
    // (A whole remote move with its scene: two answers over the API, the page told by the server, the hop — never a timing.)
    test.setTimeout(120_000);
    const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'nomads-remote-move');
    const red = seats.find((seat) => seat !== blue) ?? '';
    expect(red, 'the other seat of the table').not.toBe('');
    const campByServer = async (): Promise<string> => (await wire(request, blue)).game.spaces.find((space) => space.nomads === true)?.id ?? '';
    const campOnPage = (): Promise<Array<string>> => page.evaluate(
      () => [...document.querySelectorAll('.board-nomad')].map((el) => el.closest('[data_space_id]')?.getAttribute('data_space_id') ?? '?'));
    const from = await campByServer();
    expect(from, 'the camp stands on a cell').not.toBe('');
    await expect.poll(campOnPage, {timeout: 30_000, message: 'blue\'s board shows the camp where the server says it stands'}).toEqual([from]);

    // THE HOP IS RECORDED FROM BEFORE THE MOVE.
    const hop = await armWitness<Hop>(page, 'nomads-remote', () => ({
      flight: document.querySelector('.con-nomadmove') !== null,
      camp: [...document.querySelectorAll('.board-nomad')].map((el) => el.closest('[data_space_id]')?.getAttribute('data_space_id') ?? '?'),
    }), {settled: true});

    // RED MOVES THE CAMP (the API — another player's console, to this page): the card's action, then the cell.
    const menu = (await wire(request, red)).waitingFor;
    const action = (menu?.options ?? []).findIndex((option) => option.type === 'card' && (option.cards ?? []).some((card) => card.name === CARD));
    expect(action, 'red\'s menu offers the card\'s action').toBeGreaterThanOrEqual(0);
    await sendPlayerInput(request, red, {type: 'or', index: action, response: {type: 'card', cards: [CARD]}, promptId: menu?.promptId} as never);
    const ask = (await wire(request, red)).waitingFor;
    expect(ask?.type, 'the server asks red where the camp goes').toBe('space');
    const to = (ask?.spaces ?? [])[0] ?? '';
    expect(to, 'a cell to move to').not.toBe('');
    await sendPlayerInput(request, red, {type: 'space', spaceId: to, promptId: ask?.promptId} as never);
    await expect.poll(campByServer, {timeout: 30_000, message: 'the server moved the camp'}).toBe(to);

    // THE SCENE ON BLUE's BOARD: carried, then standing on the new cell with nothing in flight.
    await hop.waitFor((v) => v.flight, {timeoutMs: 45_000, message: 'the camp\'s remote move never took the stage on the viewer\'s board'});
    await hop.waitFor((v) => !v.flight && v.camp.length === 1 && v.camp[0] === to, {timeoutMs: 45_000, message: 'the camp never came to rest on its new cell'});
    await settle(page, {timeoutMs: 60_000});
    expect(await campOnPage(), 'the camp stands on the cell the server names — and nowhere else').toEqual([to]);
    await expect(page.locator('.con-nomadmove'), 'the flight layer left with the hop').toHaveCount(0);

    // ONE OBJECT, ALL THE WAY: on its old cell → carried (on no cell, the flight up) → on the new one.
    const stage = (v: Hop): string => (v.camp.length === 0 ? (v.flight ? 'carried' : 'gone') : v.camp.length > 1 ? 'two' : v.camp[0] === from ? 'from' : v.camp[0] === to ? 'to' : 'elsewhere');
    expect(await hop.happenedInOrder(stage, ['from', 'carried', 'to']), 'the token left its cell, was carried and landed — in that order').toBe(true);
    expect(await hop.ever((v) => v.camp.length > 1), 'never on two cells at once').toBe(false);
    expect(await hop.ever((v) => v.camp.length === 0 && !v.flight), 'never gone with nothing in the air').toBe(false);
    expect(await hop.ever((v) => stage(v) === 'elsewhere'), 'never on a cell that is neither the old nor the new').toBe(false);
    await hop.stop();
  });
});
