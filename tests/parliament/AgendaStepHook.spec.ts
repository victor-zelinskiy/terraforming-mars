import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ChairmanSeat} from '../../src/server/parliament/quests/ChairmanSeat';
import {AgendaStepContext, ICard} from '../../src/server/cards/ICard';
import {ArwindInc} from '../../src/server/cards/turmoilRedux/ArwindInc';
import {MinorityRepresentation} from '../../src/server/cards/turmoilRedux/MinorityRepresentation';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {PlayerInput} from '../../src/server/PlayerInput';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Payment} from '../../src/common/inputs/Payment';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {AGENDA_REACTION_PENDING_KEY} from '../../src/common/models/ParliamentModel';
import {REDS_BUDGET_ID} from '../../src/server/parliament/resolutions/reds/RedsBudget';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {EventSource} from '../../src/common/events/EventSource';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {answerQuestGate, passToParliament, questionOf, quietResolutionOf, seatResolution, settleParliamentGates} from './parliamentArrange';

/**
 * `ICard.onAgendaStep` — THE TABLE ANSWERS A STEP OF THE CAREER (first holder: TR78 Arwind Inc., «whenever you advance
 * your Agenda marker 1 step, add 1 fighter to ANY card»). ONE door for the four engines of the track — every one walks
 * through `ChairmanSeat.walkAgenda`, which calls the hook after each step's own bonus, inside the card's effect scope;
 * never for MarsBot. A question asked from a walk the PARLIAMENT runs is recorded (`card-reaction`) and re-asked after
 * a reload; the sitting waits on it between its `agenda` step and the support.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, arwind: ArwindInc};

function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  const arwind = new ArwindInc();
  p1.playedCards.push(arwind);
  return {game, p1, p2, parliament, arwind};
}

type Call = {to: number, index: number, of: number, reason: string, scoped: boolean};

/** A card on `player`'s table recording every call of the hook (and whether its effect scope stood). */
function recorder(game: IGame, player: IPlayer, calls: Array<Call>): ICard {
  const card = fakeCard({});
  (card as unknown as {onAgendaStep: unknown}).onAgendaStep = (_who: IPlayer, step: AgendaStepContext) => {
    calls.push({to: step.to, index: step.index, of: step.of, reason: step.cause.reason, scoped: game.events.captureContext() !== undefined});
  };
  player.playedCards.push(card);
  return card;
}

/** The fighter question `player` holds (by its STRUCTURAL marker), or undefined. */
function fighterQuestion(player: IPlayer): SelectCard<ICard> | undefined {
  const wf = questionOf(player);
  return wf?.agendaStepPrompt !== undefined ? cast(wf, SelectCard<ICard>) : undefined;
}

function answer(game: IGame, player: TestPlayer, card: CardName): void {
  player.process({type: 'card', cards: [card]});
  runAllActions(game);
}

/** p1 wins the sitting: 3 of its delegates on a quiet Mars First resolution. */
function p1WinsTheSitting(t: Table): void {
  seatResolution(t.parliament, 0, quietResolutionOf(PartyName.MARS));
  const slot = t.parliament.slotOf(PartyName.MARS)!;
  for (let i = 0; i < 3; i++) {
    t.parliament.placeVote(t.p1, slot, t.parliament.lobby.has(t.p1.id) ? 'lobby' : 'reserve');
  }
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

function asOwnAction(player: TestPlayer, f: () => void): void {
  const source: EventSource = {kind: 'card', card: CardName.TREES, owner: player.color};
  player.game.events.beginAction(player, source, {category: 'card-play'});
  try {
    f();
  } finally {
    player.game.events.endScope();
  }
}

describe('ICard.onAgendaStep — the table answers a step of the Career', () => {
  describe('the one door', () => {
    it('a walk of N steps calls the hook N times, in order, each AFTER its own bonus, inside the card\'s effect scope', () => {
      const t = table();
      const calls: Array<Call> = [];
      recorder(t.game, t.p1, calls);
      t.parliament.agenda.set(t.p1.id, 1);
      const tr = t.p1.terraformRating;
      ChairmanSeat.walkAgenda(t.p1, t.parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(calls).deep.eq([
        {to: 2, index: 1, of: 2, reason: 'card', scoped: true},
        {to: 3, index: 2, of: 2, reason: 'card', scoped: true},
      ]);
      expect(t.p1.terraformRating, 'step 2 paid its TR before its hook').eq(tr + 1);
      // Arwind's answers land under ITS effect scope — the marker the journal and the stats read.
      runAllActions(t.game);
      answer(t.game, t.p1, CardName.ARWIND_INC);
      answer(t.game, t.p1, CardName.ARWIND_INC);
      const fired = t.game.events.events.filter((e) => e.type === 'effect-triggered' && e.trigger === 'agenda-step' &&
        e.source !== undefined && 'card' in e.source && e.source.card === CardName.ARWIND_INC);
      expect(fired.length, 'each answer is the corporation effect').to.be.greaterThan(0);
    });

    it('the END of the track cuts the walk: a step not taken calls nothing, `of` counts only the steps taken', () => {
      const t = table();
      const calls: Array<Call> = [];
      recorder(t.game, t.p1, calls);
      t.parliament.agenda.set(t.p1.id, 11);
      ChairmanSeat.walkAgenda(t.p1, t.parliament, 3, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(calls.map((c) => [c.to, c.index, c.of])).deep.eq([[12, 1, 1]]);
      const atEnd: Array<Call> = [];
      const u = table();
      recorder(u.game, u.p1, atEnd);
      u.parliament.agenda.set(u.p1.id, 12);
      ChairmanSeat.walkAgenda(u.p1, u.parliament, 1, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(atEnd).deep.eq([]);
    });

    it('MarsBot answers nothing — the walk calls no hook for the bot', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      const calls: Array<Call> = [];
      recorder(game, bot, calls);
      ChairmanSeat.walkAgenda(bot, game.parliament!, 2, {reason: 'quest'});
      expect(calls).deep.eq([]);
    });
  });

  describe('a CARD\'s walk (TR04) — one request, no record', () => {
    it('two steps → two questions in order, each marked with its step, the corporation as the asker; nothing recorded', () => {
      const t = table();
      t.parliament.agenda.set(t.p1.id, 0);
      const card = new MinorityRepresentation();
      t.p1.cardsInHand.push(card);
      t.p1.playCard(card, Payment.EMPTY);
      runAllActions(t.game);
      const first = fighterQuestion(t.p1)!;
      expect(first, 'the first step asks').is.not.undefined;
      expect(first.agendaStepPrompt).deep.eq({source: CardName.ARWIND_INC, reason: 'card', step: 1, index: 1, of: 2, card: CardName.MINORITY_REPRESENTATION});
      expect(first.choiceContext?.source).deep.eq({kind: 'corporation', card: CardName.ARWIND_INC});
      expect(first.cards.map((c) => c.name), 'Arwind itself is a candidate — asked even alone').deep.eq([CardName.ARWIND_INC]);
      expect(t.parliament.pendingActions, 'a card\'s walk writes no record').deep.eq([]);
      answer(t.game, t.p1, CardName.ARWIND_INC);
      const second = fighterQuestion(t.p1)!;
      expect(second.agendaStepPrompt).deep.include({step: 2, index: 2, of: 2});
      answer(t.game, t.p1, CardName.ARWIND_INC);
      expect(fighterQuestion(t.p1)).is.undefined;
      expect(t.arwind.resourceCount).eq(2);
    });
  });

  describe('the SITTING\'s winner step (`phase`)', () => {
    it('the sitting WAITS on the question between the agenda step and the support; the answer continues the same sitting', () => {
      const t = table();
      p1WinsTheSitting(t);
      t.parliament.agenda.set(t.p1.id, 4);
      passToParliament(t.game);
      runAllActions(t.game);
      const q = fighterQuestion(t.p1)!;
      expect(q, 'the winner is asked where the fighter goes').is.not.undefined;
      expect(q.agendaStepPrompt).deep.include({reason: 'phase', step: 5, index: 1, of: 1});
      expect(t.parliament.agendaOf(t.p1), 'the step is taken').eq(5);
      expect(t.parliament.phase?.step, 'the support has not run yet').eq('support');
      expect(t.parliament.pendingActions).deep.eq([{kind: 'card-reaction', player: t.p1.id, card: CardName.ARWIND_INC, resource: 'Fighter',
        count: 1, reason: 'phase', step: 5, index: 1, of: 1}]);
      // Every other seat reads WHO is answering WHAT — and is not offered an early close (the support is still ahead).
      const model = getParliamentModel(t.game, t.p2);
      expect(model?.phase?.pending).deep.eq({player: t.p1.color, key: AGENDA_REACTION_PENDING_KEY, input: 'card'});
      expect(t.p2.getWaitingFor()?.parliamentPhasePrompt, 'no early close while the winner answers').is.undefined;
      answer(t.game, t.p1, CardName.ARWIND_INC);
      expect(t.arwind.resourceCount).eq(1);
      expect(t.parliament.pendingActions).deep.eq([]);
      expect(t.parliament.phase, 'the same sitting ran to its end').is.undefined;
      settleParliamentGates(t.game);
      expect(t.game.generation).eq(2);
    });

    it('a RELOAD on the question re-asks it — one fighter, never two, never none', () => {
      const t = table();
      p1WinsTheSitting(t);
      passToParliament(t.game);
      runAllActions(t.game);
      expect(fighterQuestion(t.p1)).is.not.undefined;
      const game = reload(t.game);
      runAllActions(game);
      const p1 = game.getPlayerById(t.p1.id) as TestPlayer;
      const q = fighterQuestion(p1)!;
      expect(q, 'the question stands again').is.not.undefined;
      expect(q.agendaStepPrompt).deep.include({reason: 'phase'});
      answer(game, p1, CardName.ARWIND_INC);
      expect(p1.tableau.get(CardName.ARWIND_INC)!.resourceCount).eq(1);
      expect(game.parliament!.pendingActions).deep.eq([]);
      expect(game.parliament!.phase).is.undefined;
    });
  });

  describe('the CHAIRMAN\'S QUEST (`quest`)', () => {
    it('the quest\'s step asks after the gate\'s answer; a reload re-asks it', () => {
      const t = table();
      t.p1.popWaitingFor();
      t.parliament.agenda.set(t.p1.id, 2);
      asOwnAction(t.p1, () => t.p1.production.add(Resource.HEAT, 3));
      answerQuestGate(t.game, t.p1);
      const q = fighterQuestion(t.p1)!;
      expect(q.agendaStepPrompt).deep.include({reason: 'quest', step: 3, index: 1, of: 1});
      expect(t.parliament.chairman, 'the office first').eq(t.p1.id);
      expect(t.parliament.pendingActions.map((a) => a.kind)).deep.eq(['card-reaction']);
      const game = reload(t.game);
      runAllActions(game);
      const p1 = game.getPlayerById(t.p1.id) as TestPlayer;
      expect(fighterQuestion(p1)?.agendaStepPrompt).deep.include({reason: 'quest'});
      answer(game, p1, CardName.ARWIND_INC);
      expect(p1.tableau.get(CardName.ARWIND_INC)!.resourceCount).eq(1);
      expect(game.parliament!.pendingActions).deep.eq([]);
    });
  });

  describe('a LAW\'s seat step (`resolution`, RX39 Reds Budget)', () => {
    it('the seat with Arwind is asked inside its own step; the other seat walks and is asked nothing', () => {
      const t = table();
      seatResolution(t.parliament, 0, resolutionInstanceId(REDS_BUDGET_ID, 0));
      t.parliament.placeVote(t.p2, t.parliament.slots[0], 'lobby');
      for (const p of [t.p1, t.p2]) {
        p.megaCredits = 15;
      }
      t.parliament.agenda.set(t.p1.id, 4);
      passToParliament(t.game);
      runAllActions(t.game);
      const q = fighterQuestion(t.p1)!;
      expect(q, 'p1 is asked by the law\'s step').is.not.undefined;
      expect(q.agendaStepPrompt).deep.include({reason: 'resolution', resolution: REDS_BUDGET_ID, step: 5});
      expect(fighterQuestion(t.p2)).is.undefined;
      answer(t.game, t.p1, CardName.ARWIND_INC);
      expect(t.arwind.resourceCount).eq(1);
      expect(t.parliament.pendingActions).deep.eq([]);
      settleParliamentGates(t.game);
      expect(t.game.generation).eq(2);
    });
  });

  it('the question is never asked of a title — the marker is structural and survives nesting (`SelectCard.toModel`)', () => {
    const t = table();
    t.parliament.agenda.set(t.p1.id, 0);
    ChairmanSeat.walkAgenda(t.p1, t.parliament, 1, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
    runAllActions(t.game);
    const wf = t.p1.getWaitingFor() as PlayerInput;
    expect(wf.toModel(t.p1).agendaStepPrompt).deep.include({source: CardName.ARWIND_INC, reason: 'card'});
  });
});
