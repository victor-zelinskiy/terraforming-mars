import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {Server} from '../../src/server/models/ServerModel';
import {TEST_CHOICE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {Phase} from '../../src/common/Phase';
import {answerGate, atSittingEnd, passToParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {ParliamentModel as ParliamentWireModel} from '../../src/common/models/ParliamentModel';
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
 * THE SITTING ON THE WIRE (Э1, the soft gates): the phase model carries the
 * summary SO FAR in the one shape a finished phase leaves behind and tells
 * every other seat what kind of answer the asked seat owes; once the chain
 * has run, `sitting` names the seats that have not closed it yet — a FACT for
 * the results page, never a list anybody waits on — and the confirmation's
 * marker is the seat's own close, no `awaiting`.
 */
describe('ParliamentModel — the sitting', () => {
  it('phase.summary is the sitting SO FAR in the shape of lastPhase; `sitting` names the seats still to close it; the history rides the model', () => {
    const [game, p1, p2, parliament] = reduxGame();
    seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID); // asks nothing
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    // The LIVE model at the sitting's last step — the whole chain applied, nothing closed yet.
    let live: ParliamentWireModel | undefined;
    atSittingEnd(game, () => (live = getParliamentModel(game, p1)));
    passToParliament(game);
    const summary = live?.phase?.summary;
    expect(live?.phase?.step).eq('done');
    expect(summary, 'the summary is on the wire while the phase runs').is.not.undefined;
    expect(summary?.generation).eq(1);
    expect(summary?.seq).eq(1);
    expect(summary?.correlationId).is.a('number');
    expect(summary?.winner.player).eq(p1.color);
    expect(summary?.enacted.instance).eq(summary?.winner.instance);
    expect(summary?.agenda).deep.include({player: p1.color, from: 0, to: 1});
    expect(summary?.refreshed.length).is.greaterThan(0);
    expect(summary?.lobbyRefilled, 'p1 spent the free delegate and got it back; p2 never left the lobby').deep.eq([p1.color]);
    expect(live?.sitting, 'nobody owes a confirmation while the phase runs').is.undefined;
    // The chain is over — but for a seat that has not closed it the sitting STANDS at its last step, with the
    // finished summary: the same keys the live one had. A seat that closed reads no phase (and no spectator does).
    const closing = getParliamentModel(game, p2)!;
    expect(closing.phase?.step).eq('done');
    expect(closing.phase?.generation).eq(1);
    expect(Object.keys(closing.phase!.summary!).sort()).deep.eq(Object.keys(summary!).sort());
    expect(closing.phase?.summary?.seq).eq(1);
    expect(getParliamentModel(game)?.phase, 'no seat, no sitting of its own').is.undefined;
    expect(closing.sitting).deep.eq({generation: 1, seq: 1, final: false, pending: [p1.color, p2.color]});
    answerGate(p1);
    expect(getParliamentModel(game, p1)?.phase, 'p1 closed: the next generation is p1\'s').is.undefined;
    expect(getParliamentModel(game, p2)?.phase?.step, 'p2 still reads its sitting').eq('done');
    expect(getParliamentModel(game, p2)?.sitting?.pending, 'the list is the record\'s, moving as the seats close').deep.eq([p2.color]);
    settleParliamentGates(game);
    const done = getParliamentModel(game, p1)!;
    expect(done.phase).is.undefined;
    expect(done.sitting).is.undefined;
    // ONE shape in three modes: the finished summary has exactly the keys the last in-progress one had.
    expect(Object.keys(done.lastPhase!).sort()).deep.eq(Object.keys(summary!).sort());
    expect(done.lastPhase?.seq).eq(1);
    expect(done.lastPhase?.correlationId).eq(summary?.correlationId);
    expect(done.phaseHistory?.map((s) => s.seq)).deep.eq([1]);
    expect(done.phaseHistory?.[0]).deep.eq(done.lastPhase);
  });

  it('pending.input tells every OTHER seat what kind of answer the asked seat owes; the confirmation\'s marker is the seat\'s own close', () => {
    const [game, p1, p2, parliament] = reduxGame();
    seatResolution(parliament, 0, TEST_CHOICE_RESOLUTION_ID);
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    passToParliament(game);
    // No gate before the effects: p1 is asked a choice at once — p2's model says who and what kind, never the step's wording.
    const other = getParliamentModel(game, p2)!;
    expect(other.phase?.step).eq('effects');
    expect(other.phase?.pending).deep.eq({player: p1.color, key: 'choose-plant-or-heat', input: 'or'});
    // …and p2 is asked NOTHING — it holds only the EARLY close of its sitting (the soft gates).
    expect(Server.getPlayerModel(p2).waitingFor?.parliamentPhasePrompt).deep.include({stage: 'close', early: true});
    for (const id of [p1.id, p2.id]) {
      const seat = game.getPlayerById(id);
      seat.process({type: 'or', index: 0, response: {type: 'option'}});
      seat.process({type: 'or', index: 1, response: {type: 'option'}});
    }
    const close = (seat: TestPlayer) => Server.getPlayerModel(seat).waitingFor?.parliamentPhasePrompt;
    expect(close(p2)).deep.eq({stage: 'close', generation: 1, final: false, seq: 1});
    expect(close(p1)).deep.eq({stage: 'close', generation: 1, final: false, seq: 1});
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
    const model = getParliamentModel(game, p2)!;
    expect(model.phase?.step, 'the chain is over; p2 still reads its sitting').eq('done');
    const journal = model.lastPhase?.renewal ?? [];
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
