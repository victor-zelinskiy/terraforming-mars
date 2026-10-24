import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect} from './consoleTest';
import {fetchPlayerModel, sendPlayerInput} from './consoleStart';

/**
 * THE SOFT GATES OVER THE LIVE API (docs/claude/console/parliament-soft-gates.md — П1 · П3): a real two-seat
 * game booted through the dev door ONE PASS before its sitting (red has passed, blue holds its menu). Blue's
 * pass runs the whole chain up to the law's own ask (Climate Research: each seat TAKES the cards it drew — the
 * one place the seats depend on each other); once the asks are answered the sitting is over, the next generation
 * already runs, and each seat holds ONE confirmation. A confirmation admits ITS seat alone (blue's research buy);
 * the other seat is neither waited for nor written over; a doubled answer is refused. No browser: the server's own
 * model is the witness.
 */
type Model = {
  waitingFor?: {type: string; promptId?: number; title?: unknown; cards?: Array<{name: string}>; buyMode?: boolean;
    parliamentPhasePrompt?: {stage: string; generation: number; final: boolean; seq: number}};
  game: {phase: string; generation: number;
    parliament?: {phase?: {step: string; generation: number; pending?: {player: string}}; sitting?: {generation: number; seq: number; final: boolean; pending: Array<string>}}};
  thisPlayer: {color: string};
};

async function loadFixtureSeats(request: Parameters<typeof fetchPlayerModel>[0], fixture: string): Promise<Array<string>> {
  const file = path.resolve(__dirname, 'fixtures', `${fixture}.json`);
  const serialized = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  const res = await request.post('/api/dev/load-game', {data: serialized});
  expect(res.ok(), `the dev load-game door accepted ${fixture} (status ${res.status()})`).toBeTruthy();
  const model = await res.json() as {players: Array<{id: string}>};
  return model.players.map((p) => p.id);
}

const modelOf = async (request: Parameters<typeof fetchPlayerModel>[0], id: string): Promise<Model> => await fetchPlayerModel(request, id) as unknown as Model;

test.describe('the parliament sitting · the soft gates over the API', () => {
  test('one pass runs the chain to the law\'s ask; then ONE confirmation per seat, each admitting its own seat alone', async ({request}) => {
    test.setTimeout(120_000);
    const [blue, red] = await loadFixtureSeats(request, 'parliament-climate-assembly');
    const start = await modelOf(request, blue);
    expect(start.game.phase, 'one pass before the sitting').toBe('action');
    expect(start.game.parliament?.phase, 'no sitting yet').toBeUndefined();
    // BLUE PASSES: production, then the sitting — up to the law's own ask (blue takes first, in seat order).
    const menu = start.waitingFor as unknown as {options?: Array<unknown>};
    const passAt = (menu.options ?? []).findIndex((o) => JSON.stringify(o).includes('Pass for this generation'));
    expect(passAt, 'blue holds its menu with the pass').toBeGreaterThanOrEqual(0);
    await sendPlayerInput(request, blue, {type: 'or', index: passAt, response: {type: 'option'}, promptId: start.waitingFor?.promptId} as never);
    let blueNow = await modelOf(request, blue);
    expect(blueNow.game.phase, 'the law asks: the political phase holds').toBe('parliament');
    expect(blueNow.game.parliament?.phase?.step).toBe('effects');
    expect(blueNow.waitingFor?.type, 'no gate after the verdict — the take stands at once').toBe('card');
    expect(blueNow.waitingFor?.parliamentPhasePrompt).toBeUndefined();
    // The take, then red's (the wait on the other seat is the one honest wait — П3).
    for (const seat of [blue, red]) {
      for (let round = 0; round < 4; round++) {
        const m = await modelOf(request, seat);
        if (m.waitingFor?.type !== 'card' || m.waitingFor.parliamentPhasePrompt !== undefined) {
          break;
        }
        await sendPlayerInput(request, seat, {type: 'card', cards: (m.waitingFor.cards ?? []).map((c) => c.name), promptId: m.waitingFor.promptId} as never);
      }
    }
    // THE SITTING IS OVER — and generation 2 already runs around both confirmations.
    blueNow = await modelOf(request, blue);
    let redNow = await modelOf(request, red);
    expect(blueNow.game.generation, 'the next generation does not wait for the confirmations').toBe(2);
    for (const m of [blueNow, redNow]) {
      expect(m.waitingFor?.parliamentPhasePrompt, `${m.thisPlayer.color} holds its confirmation`).toMatchObject({stage: 'close', generation: 1, final: false});
      expect(m.game.parliament?.phase?.step, `${m.thisPlayer.color} still reads its own sitting`).toBe('done');
      expect(m.game.parliament?.sitting?.pending.sort()).toEqual([blueNow.thisPlayer.color, redNow.thisPlayer.color].sort());
    }
    // BLUE CLOSES: blue — and only blue — is admitted (its research buy); red is untouched.
    const closePrompt = blueNow.waitingFor?.promptId;
    await sendPlayerInput(request, blue, {type: 'option', promptId: closePrompt} as never);
    blueNow = await modelOf(request, blue);
    redNow = await modelOf(request, red);
    expect(blueNow.waitingFor?.type, 'blue is admitted to generation 2: its research buy').toBe('card');
    expect(blueNow.waitingFor?.parliamentPhasePrompt).toBeUndefined();
    expect(blueNow.game.parliament?.phase, 'blue\'s sitting is closed — no phase on its wire').toBeUndefined();
    expect(redNow.waitingFor?.parliamentPhasePrompt?.stage, 'red still reads its sitting — nobody waits for it, nobody writes over it').toBe('close');
    expect(redNow.game.parliament?.sitting?.pending).toEqual([redNow.thisPlayer.color]);
    // A DOUBLED close (the stale prompt id) is refused and changes nothing.
    const doubled = await request.post(`/player/input?id=${blue}`, {data: {type: 'option', promptId: closePrompt}});
    expect(doubled.ok(), 'a second «Закрыть заседание» is refused').toBe(false);
    expect((await modelOf(request, blue)).waitingFor?.type, 'the buy still stands').toBe('card');
    // RED CLOSES: the record goes, red is admitted too.
    await sendPlayerInput(request, red, {type: 'option', promptId: redNow.waitingFor?.promptId} as never);
    redNow = await modelOf(request, red);
    expect(redNow.waitingFor?.type).toBe('card');
    expect(redNow.game.parliament?.sitting, 'nothing owed').toBeUndefined();
  });
});
