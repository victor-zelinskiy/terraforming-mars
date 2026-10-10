import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {Server} from '../../src/server/models/ServerModel';
import {TEST_CHOICE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {Phase} from '../../src/common/Phase';
import {answerGate, answerStandingGates, passToParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {PoliticalScience} from '../../src/server/cards/turmoilRedux/PoliticalScience';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {GAS_EXPORT_ID} from '../../src/server/parliament/resolutions/reds/GasExport';
import {Aphrodite} from '../../src/server/cards/venusNext/Aphrodite';
import {setVenusScaleLevel} from '../TestingUtils';

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
    // v2: the gate stands BEFORE the table changes — the summary names the card that WILL be enacted; the
    // government is still the old one, the Agenda has not moved, nothing is refreshed.
    expect(summary?.enacted.instance).eq(summary?.winner.instance);
    expect(parliament.enacted, 'the government is untouched at the gate').is.undefined;
    expect(summary?.agenda, 'no Agenda step at the gate').is.undefined;
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

  it('a `card-effect` of the renewal journal reaches the wire with the seat as a COLOR, the card, the resource and the count (TR02)', () => {
    const [game, p1, p2, parliament] = reduxGame();
    const card = new PoliticalScience();
    p1.playedCards.push(card);
    seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing
    parliament.placeVote(p2, parliament.slots[0], 'lobby');
    // p1's free delegate on the SECOND slot — a loser (the tie-free slot 0 wins for p2).
    parliament.placeVote(p1, parliament.slots[1], 'lobby');
    const loser = parliament.slots[1].instance;
    passToParliament(game);
    answerStandingGates(game, 'assembly');
    const model = getParliamentModel(game, p2)!;
    expect(model.phase?.step).eq('adjourn');
    const journal = model.phase?.summary?.renewal ?? [];
    const effect = journal.find((e) => e.kind === 'card-effect');
    expect(effect).deep.eq({kind: 'card-effect', player: p1.color, card: CardName.POLITICAL_SCIENCE, resource: CardResource.DATA, count: 1, instance: loser});
    // …right after the leave of the very card p1's delegate stood on.
    const at = journal.indexOf(effect!);
    expect(journal[at - 1]).deep.include({kind: 'leave', instance: loser});
    expect(card.resourceCount).eq(1);
  });
});

/**
 * PL-052 (TR41): the vote's reading of Gas Export said nothing of what the TABLE answers to its Venus steps —
 * nobody is credited, no party pays, no bonus step is claimed, yet Aphrodite's 2 M€ per Venus step (any player's
 * raise) stands. The slot carries the forecast engine's own answer for the viewer.
 */
describe('ParliamentModel — the world move\'s answer on the slot (PL-052)', () => {
  function venusTable(): [IGame, TestPlayer, TestPlayer, Parliament] {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
    game.phase = Phase.ACTION;
    return [game, p1, p2, game.parliament!];
  }

  it('Gas Export with a rival\'s Aphrodite: the viewer\'s slot names Aphrodite\'s 4 M€ (two steps) — no party, no bonus step, no own-raise reactor', () => {
    const [game, p1, p2, parliament] = venusTable();
    seatResolution(parliament, 0, GAS_EXPORT_ID);
    p2.playedCards.push(new Aphrodite());
    setVenusScaleLevel(game, 6);
    const slot = getParliamentModel(game, p1)!.slots[0];
    expect(slot.resolution).eq(GAS_EXPORT_ID);
    const facts = slot.worldForecast?.facts ?? [];
    const aphrodite = facts.find((f) => f.source.name === CardName.APHRODITE);
    expect(aphrodite, JSON.stringify(facts.map((f) => `${f.source.kind}:${f.source.name}:${f.id}`))).is.not.undefined;
    expect(aphrodite!.source).deep.include({kind: 'corporation', owner: p2.color});
    expect(aphrodite!.recipient).deep.include({kind: 'player', color: p2.color});
    expect(aphrodite!.effects[0]).deep.include({direction: 'gain', icon: 'megacredits', amount: 4});
    expect(facts.some((f) => f.source.kind === 'party'), 'the Greens pay for no rating here').is.false;
    expect(facts.some((f) => f.id.endsWith('venus-card-bonus')), 'the 8 % card is claimed by nobody').is.false;
    // The same slot as Aphrodite's OWNER sees it: the gain is «yours».
    const own = getParliamentModel(game, p2)!.slots[0].worldForecast?.facts.find((f) => f.source.name === CardName.APHRODITE);
    expect(own?.recipient.kind).eq('you');
  });

  it('a quiet table answers nothing — the slot carries no forecast; a law that moves no scale carries none either; a spectator gets none', () => {
    const [game, p1, , parliament] = venusTable();
    seatResolution(parliament, 0, GAS_EXPORT_ID);
    seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
    const model = getParliamentModel(game, p1)!;
    expect(model.slots[0].worldForecast, 'nothing reacts').is.undefined;
    expect(model.slots[1].worldForecast, 'no world move').is.undefined;
    expect(getParliamentModel(game)!.slots[0].worldForecast, 'a spectator').is.undefined;
  });
});
