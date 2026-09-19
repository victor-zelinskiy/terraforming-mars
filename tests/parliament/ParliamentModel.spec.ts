import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {Server} from '../../src/server/models/ServerModel';
import {TEST_CHOICE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {Phase} from '../../src/common/Phase';
import {answerGate, passToParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/**
 * THE SITTING ON THE WIRE (Э1): the phase model carries the summary SO FAR in
 * the one shape a finished phase leaves behind, names the seats a gate still
 * waits for, tells every other seat what kind of answer the asked seat owes,
 * and the gate marker's `awaiting` is computed when the model is built.
 */
describe('ParliamentModel — the sitting', () => {
  it('phase.summary is the sitting SO FAR in the shape of lastPhase; awaiting names the seats a gate waits for; the history rides the model', () => {
    const [game, p1, p2, parliament] = reduxGame();
    seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    passToParliament(game);
    const assembly = getParliamentModel(game, p1)!;
    expect(assembly.phase?.step).eq('assembly');
    expect(assembly.phase?.awaiting).has.members([p1.color, p2.color]);
    const summary = assembly.phase?.summary;
    expect(summary, 'the summary is on the wire from the first step on').is.not.undefined;
    expect(summary?.generation).eq(1);
    expect(summary?.seq).eq(1);
    expect(summary?.correlationId).is.a('number');
    expect(summary?.winner.player).eq(p1.color);
    expect(summary?.enacted.instance).eq(parliament.enacted);
    expect(summary?.agenda).deep.eq({player: p1.color, from: 0, to: 1, bonus: undefined});
    expect(summary?.refreshed, 'not refreshed yet').deep.eq([]);
    answerGate(p1, 'assembly');
    expect(getParliamentModel(game, p1)?.phase?.awaiting).deep.eq([p2.color]);
    answerGate(p2, 'assembly');
    const adjourn = getParliamentModel(game, p2)!;
    expect(adjourn.phase?.step).eq('adjourn');
    expect(adjourn.phase?.awaiting).has.members([p1.color, p2.color]);
    expect(adjourn.phase?.summary?.refreshed.length).is.greaterThan(0);
    expect(adjourn.phase?.summary?.lobbyRefilled, 'p1 spent the free delegate and got it back; p2 never left the lobby').deep.eq([p1.color]);
    settleParliamentGates(game);
    const done = getParliamentModel(game, p1)!;
    expect(done.phase).is.undefined;
    // ONE shape in three modes: the finished summary has exactly the keys the last in-progress one had.
    expect(Object.keys(done.lastPhase!).sort()).deep.eq(Object.keys(adjourn.phase!.summary!).sort());
    expect(done.lastPhase?.seq).eq(1);
    expect(done.lastPhase?.correlationId).eq(summary?.correlationId);
    expect(done.phaseHistory?.map((s) => s.seq)).deep.eq([1]);
    expect(done.phaseHistory?.[0]).deep.eq(done.lastPhase);
  });

  it('pending.input tells every OTHER seat what kind of answer the asked seat owes; the gate marker carries `awaiting` computed at model time', () => {
    const [game, p1, p2, parliament] = reduxGame();
    seatResolution(parliament, 0, TEST_CHOICE_RESOLUTION_ID);
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    passToParliament(game);
    const gate = (seat: TestPlayer) => Server.getPlayerModel(seat).waitingFor?.parliamentPhasePrompt;
    expect(gate(p2)).deep.include({stage: 'assembly', generation: 1, final: false, seq: 1});
    expect(gate(p2)?.awaiting).has.members([p1.color, p2.color]);
    answerGate(p1, 'assembly');
    expect(gate(p2)?.awaiting, 'the list moves as the others answer').deep.eq([p2.color]);
    answerGate(p2, 'assembly');
    // The effects: p1 is asked a choice — p2's model says who and what kind, never the step's wording.
    const other = getParliamentModel(game, p2)!;
    expect(other.phase?.step).eq('effects');
    expect(other.phase?.pending).deep.eq({player: p1.color, key: 'choose-plant-or-heat', input: 'or'});
    expect(other.phase?.awaiting, 'no gate stands during the effects').is.undefined;
    expect(Server.getPlayerModel(p2).waitingFor).is.undefined;
  });
});
