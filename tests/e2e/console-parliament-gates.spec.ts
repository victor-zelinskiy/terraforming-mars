import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect} from './consoleTest';
import {fetchPlayerModel, sendPlayerInput} from './consoleStart';

/**
 * THE SITTING'S GATES OVER THE LIVE API (Э1 acceptance, docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §3):
 * a real two-seat game booted through the dev door INSIDE the assembly gate —
 * both seats hold the `parliamentPhasePrompt{assembly}` marker; the first
 * answer moves NOTHING (the phase still stands, the other seat still holds its
 * gate, the awaited list shrinks to one); the second answer moves the phase
 * on to the effects. No browser: the server's own model is the witness.
 */
type GateModel = {
  waitingFor?: {type: string; promptId?: number; parliamentPhasePrompt?: {stage: string; generation: number; final: boolean; seq: number; awaiting: Array<string>}};
  game: {phase: string; generation: number; parliament?: {phase?: {step: string; awaiting?: Array<string>; summary?: {seq?: number; correlationId?: number}}}};
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

test.describe('the parliament sitting · the assembly gate over the API', () => {
  test('both seats hold the assembly gate; one answer moves nothing, the second moves the phase to the effects', async ({request}) => {
    test.setTimeout(120_000);
    const [blue, red] = await loadFixtureSeats(request, 'parliament-climate-assembly');
    const before = await Promise.all([blue, red].map((id) => fetchPlayerModel(request, id) as Promise<GateModel>));
    for (const model of before) {
      expect(model.game.phase, 'the political phase is on').toBe('parliament');
      expect(model.game.parliament?.phase?.step).toBe('assembly');
      const marker = model.waitingFor?.parliamentPhasePrompt;
      expect(marker, `${model.thisPlayer.color} holds the gate`).toBeTruthy();
      expect(marker).toMatchObject({stage: 'assembly', generation: 1, final: false, seq: 1});
      expect(marker?.awaiting.sort()).toEqual(before.map((m) => m.thisPlayer.color).sort());
      expect(model.game.parliament?.phase?.summary?.seq, 'the sitting is numbered on the wire').toBe(1);
      expect(typeof model.game.parliament?.phase?.summary?.correlationId).toBe('number');
    }
    // The FIRST answer — blue's, with the prompt's own identity stamp.
    const after1 = await sendPlayerInput(request, blue, {type: 'option', promptId: before[0].waitingFor?.promptId} as never) as unknown as GateModel;
    expect(after1.game.phase).toBe('parliament');
    expect(after1.game.parliament?.phase?.step, 'one answer moves nothing').toBe('assembly');
    expect(after1.waitingFor, 'the answered seat holds nothing').toBeUndefined();
    const redStill = await fetchPlayerModel(request, red) as unknown as GateModel;
    expect(redStill.waitingFor?.parliamentPhasePrompt?.stage, 'the other seat still holds its gate').toBe('assembly');
    expect(redStill.waitingFor?.parliamentPhasePrompt?.awaiting).toEqual([redStill.thisPlayer.color]);
    expect(after1.game.parliament?.phase?.awaiting, 'the phase model names who is awaited').toEqual([redStill.thisPlayer.color]);
    // The SECOND answer — red's: the barrier opens, the enacted resolution pays.
    const after2 = await sendPlayerInput(request, red, {type: 'option', promptId: redStill.waitingFor?.promptId} as never) as unknown as GateModel;
    expect(after2.game.parliament?.phase?.step, 'the second answer moves the phase on').not.toBe('assembly');
    expect(['effects', 'refresh', 'lobby', 'adjourn']).toContain(after2.game.parliament?.phase?.step);
    // Climate Research asks blue to take the cards it drew — the effects are running.
    const blueNow = await fetchPlayerModel(request, blue) as unknown as GateModel;
    expect(blueNow.waitingFor?.type).toBe('card');
    expect(blueNow.waitingFor?.parliamentPhasePrompt).toBeUndefined();
  });

  test('a doubled answer is refused as stale and moves nothing', async ({request}) => {
    test.setTimeout(120_000);
    const [blue, red] = await loadFixtureSeats(request, 'parliament-architecture-assembly');
    const model = await fetchPlayerModel(request, blue) as unknown as GateModel;
    const stamp = model.waitingFor?.promptId;
    await sendPlayerInput(request, blue, {type: 'option', promptId: stamp} as never);
    const again = await request.post(`/player/input?id=${blue}`, {data: {type: 'option', promptId: stamp}});
    expect(again.ok(), 'the same stamp again is refused').toBeFalsy();
    const redModel = await fetchPlayerModel(request, red) as unknown as GateModel;
    expect(redModel.game.parliament?.phase?.step).toBe('assembly');
    expect(redModel.waitingFor?.parliamentPhasePrompt?.awaiting).toEqual([redModel.thisPlayer.color]);
  });
});
