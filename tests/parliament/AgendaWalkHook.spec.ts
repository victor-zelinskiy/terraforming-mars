import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ChairmanSeat} from '../../src/server/parliament/quests/ChairmanSeat';
import {AgendaWalkContext, ICard} from '../../src/server/cards/ICard';
import {ArwindInc} from '../../src/server/cards/turmoilRedux/ArwindInc';
import {MarsArmyShips} from '../../src/server/cards/turmoilRedux/MarsArmyShips';
import {MinorityRepresentation} from '../../src/server/cards/turmoilRedux/MinorityRepresentation';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AndOptions} from '../../src/server/inputs/AndOptions';
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
 * `ICard.onAgendaWalked` — THE TABLE ANSWERS A WALK OF THE CAREER (first holder: TR78 Arwind Inc., «whenever you advance
 * your Agenda marker 1 step, add 1 fighter to ANY card»). ONE door for the four engines of the track — every one walks
 * through `ChairmanSeat.walkAgenda`, which calls the hook ONCE per walk, after the last step's bonus, inside the card's
 * effect scope; never for MarsBot. The owner's two laws of 2026-10-28: the steps of one walk are ONE answer (N units in
 * ONE question — the family's layout, or its pick), and the asker alone is no question (the units land on it at once).
 * A question asked from a walk the PARLIAMENT runs is recorded (`card-reaction`) and re-asked after a reload; the
 * sitting waits on it between its `agenda` step and the support.
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

/** A second fighter holder on p1's table — what turns the walk's answer into a QUESTION. */
function withShips(t: Table): MarsArmyShips {
  const ships = new MarsArmyShips();
  t.p1.playedCards.push(ships);
  return ships;
}

type Call = {from: number, to: number, steps: Array<number>, reason: string, scoped: boolean, tr: number};

/** A card on `player`'s table recording every call of the hook (and whether its effect scope stood). */
function recorder(game: IGame, player: IPlayer, calls: Array<Call>): ICard {
  const card = fakeCard({});
  (card as unknown as {onAgendaWalked: unknown}).onAgendaWalked = (who: IPlayer, walk: AgendaWalkContext) => {
    calls.push({
      from: walk.from, to: walk.to, steps: walk.steps.map((s) => s.to), reason: walk.cause.reason,
      scoped: game.events.captureContext() !== undefined, tr: who.terraformRating,
    });
  };
  player.playedCards.push(card);
  return card;
}

/** The fighter question `player` holds (by its STRUCTURAL marker — the pick or the layout), or undefined. */
function fighterQuestion(player: IPlayer): PlayerInput | undefined {
  const wf = questionOf(player);
  return wf?.agendaWalkPrompt !== undefined ? wf : undefined;
}

function answerPick(game: IGame, player: TestPlayer, card: CardName): void {
  player.process({type: 'card', cards: [card]});
  runAllActions(game);
}

function answerLayout(game: IGame, player: TestPlayer, amounts: ReadonlyArray<number>): void {
  player.process({type: 'and', responses: amounts.map((amount) => ({type: 'amount', amount}))});
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

function arwindFired(game: IGame): number {
  return game.events.events.filter((e) => e.type === 'effect-triggered' && e.trigger === 'agenda-step' &&
    e.source !== undefined && 'card' in e.source && e.source.card === CardName.ARWIND_INC).length;
}

describe('ICard.onAgendaWalked — the table answers a walk of the Career', () => {
  describe('the one door', () => {
    it('a walk of N steps calls the hook ONCE, after the last step\'s bonus, with every step taken, inside the card\'s effect scope', () => {
      const t = table();
      const calls: Array<Call> = [];
      recorder(t.game, t.p1, calls);
      t.parliament.agenda.set(t.p1.id, 1);
      const tr = t.p1.terraformRating;
      ChairmanSeat.walkAgenda(t.p1, t.parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(calls).deep.eq([{from: 1, to: 3, steps: [2, 3], reason: 'card', scoped: true, tr: tr + 1}]);
      expect(t.p1.terraformRating, 'step 2 paid its TR before the hook').eq(tr + 1);
      // Arwind alone on the table: its answer LANDED with the walk — under ITS effect scope (the marker the journal, the
      // stats and the console's reaction scene read), with no question anywhere.
      runAllActions(t.game);
      expect(t.arwind.resourceCount, 'two steps, two fighters, landed at once').eq(2);
      expect(fighterQuestion(t.p1), 'nothing is asked').is.undefined;
      expect(arwindFired(t.game), 'the corporation effect fired ONCE for the walk').eq(1);
    });

    it('the END of the track cuts the walk: only the steps taken are in the list; a walk of no step calls nothing', () => {
      const t = table();
      const calls: Array<Call> = [];
      recorder(t.game, t.p1, calls);
      t.parliament.agenda.set(t.p1.id, 11);
      ChairmanSeat.walkAgenda(t.p1, t.parliament, 3, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(calls.map((c) => [c.from, c.to, c.steps])).deep.eq([[11, 12, [12]]]);
      runAllActions(t.game);
      expect(t.arwind.resourceCount, 'one step taken, one fighter').eq(1);
      const atEnd: Array<Call> = [];
      const u = table();
      recorder(u.game, u.p1, atEnd);
      u.parliament.agenda.set(u.p1.id, 12);
      ChairmanSeat.walkAgenda(u.p1, u.parliament, 1, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(atEnd).deep.eq([]);
      expect(u.arwind.resourceCount).eq(0);
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
    it('two steps with a second holder → ONE question: the LAYOUT of 2 fighters over the holders, marked with the walk, the corporation as the asker', () => {
      const t = table();
      const ships = withShips(t);
      t.parliament.agenda.set(t.p1.id, 0);
      const card = new MinorityRepresentation();
      t.p1.cardsInHand.push(card);
      t.p1.playCard(card, Payment.EMPTY);
      runAllActions(t.game);
      const layout = cast(fighterQuestion(t.p1), AndOptions);
      expect(layout.agendaWalkPrompt).deep.eq({source: CardName.ARWIND_INC, reason: 'card', from: 0, to: 2, card: CardName.MINORITY_REPRESENTATION});
      expect(layout.choiceContext?.source).deep.eq({kind: 'corporation', card: CardName.ARWIND_INC});
      expect(layout.cardResourceDistributionPrompt?.amount, 'two steps → two fighters in ONE layout').eq(2);
      expect(layout.cardResourceDistributionPrompt?.cards.map((c) => c.name)).deep.eq([CardName.ARWIND_INC, CardName.MARS_ARMY_SHIPS]);
      expect(t.parliament.pendingActions, 'a card\'s walk writes no record').deep.eq([]);
      answerLayout(t.game, t.p1, [1, 1]);
      expect(fighterQuestion(t.p1), 'one question, one answer').is.undefined;
      expect(t.arwind.resourceCount).eq(1);
      expect(ships.resourceCount).eq(1);
    });

    it('one step with a second holder → the family\'s PICK of one fighter, marked with the walk', () => {
      const t = table();
      const ships = withShips(t);
      t.parliament.agenda.set(t.p1.id, 11);
      ChairmanSeat.walkAgenda(t.p1, t.parliament, 1, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      runAllActions(t.game);
      const pick = cast(fighterQuestion(t.p1), SelectCard<ICard>);
      expect(pick.agendaWalkPrompt).deep.include({reason: 'card', from: 11, to: 12});
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.ARWIND_INC, CardName.MARS_ARMY_SHIPS]);
      answerPick(t.game, t.p1, CardName.MARS_ARMY_SHIPS);
      expect(ships.resourceCount).eq(1);
      expect(t.arwind.resourceCount).eq(0);
    });
  });

  describe('the SITTING\'s winner step (`phase`)', () => {
    it('with a second holder the sitting WAITS on the question between the agenda step and the support; the answer continues the same sitting', () => {
      const t = table();
      withShips(t);
      p1WinsTheSitting(t);
      t.parliament.agenda.set(t.p1.id, 4);
      passToParliament(t.game);
      runAllActions(t.game);
      const q = cast(fighterQuestion(t.p1), SelectCard<ICard>);
      expect(q.agendaWalkPrompt).deep.include({reason: 'phase', from: 4, to: 5});
      expect(t.parliament.agendaOf(t.p1), 'the step is taken').eq(5);
      expect(t.parliament.phase?.step, 'the support has not run yet').eq('support');
      expect(t.parliament.pendingActions).deep.eq([{kind: 'card-reaction', player: t.p1.id, card: CardName.ARWIND_INC, resource: 'Fighter',
        count: 1, reason: 'phase', from: 4, to: 5}]);
      // Every other seat reads WHO is answering WHAT — and is not offered an early close (the support is still ahead).
      const model = getParliamentModel(t.game, t.p2);
      expect(model?.phase?.pending).deep.eq({player: t.p1.color, key: AGENDA_REACTION_PENDING_KEY, input: 'card'});
      expect(t.p2.getWaitingFor()?.parliamentPhasePrompt, 'no early close while the winner answers').is.undefined;
      answerPick(t.game, t.p1, CardName.ARWIND_INC);
      expect(t.arwind.resourceCount).eq(1);
      expect(t.parliament.pendingActions).deep.eq([]);
      expect(t.parliament.phase, 'the same sitting ran to its end').is.undefined;
      settleParliamentGates(t.game);
      expect(t.game.generation).eq(2);
    });

    it('the corporation alone: the fighter lands with the step and the sitting runs through — no pause, no record', () => {
      const t = table();
      p1WinsTheSitting(t);
      t.parliament.agenda.set(t.p1.id, 4);
      passToParliament(t.game);
      runAllActions(t.game);
      expect(fighterQuestion(t.p1), 'nothing asked').is.undefined;
      expect(t.arwind.resourceCount).eq(1);
      expect(t.parliament.pendingActions).deep.eq([]);
      expect(getParliamentModel(t.game, t.p2)?.phase?.pending, 'no pause published').is.undefined;
      expect(t.parliament.phase, 'the sitting ran to its end in one go').is.undefined;
    });

    it('a RELOAD on the question re-asks it — one fighter, never two, never none', () => {
      const t = table();
      withShips(t);
      p1WinsTheSitting(t);
      passToParliament(t.game);
      runAllActions(t.game);
      expect(fighterQuestion(t.p1)).is.not.undefined;
      const game = reload(t.game);
      runAllActions(game);
      const p1 = game.getPlayerById(t.p1.id) as TestPlayer;
      const q = fighterQuestion(p1)!;
      expect(q, 'the question stands again').is.not.undefined;
      expect(q.agendaWalkPrompt).deep.include({reason: 'phase'});
      answerPick(game, p1, CardName.ARWIND_INC);
      expect(p1.tableau.get(CardName.ARWIND_INC)!.resourceCount).eq(1);
      expect(game.parliament!.pendingActions).deep.eq([]);
      expect(game.parliament!.phase).is.undefined;
    });
  });

  describe('the CHAIRMAN\'S QUEST (`quest`)', () => {
    it('the quest\'s step asks after the gate\'s answer (a second holder); a reload re-asks it', () => {
      const t = table();
      withShips(t);
      t.p1.popWaitingFor();
      t.parliament.agenda.set(t.p1.id, 2);
      asOwnAction(t.p1, () => t.p1.production.add(Resource.HEAT, 3));
      answerQuestGate(t.game, t.p1);
      const q = cast(fighterQuestion(t.p1), SelectCard<ICard>);
      expect(q.agendaWalkPrompt).deep.include({reason: 'quest', from: 2, to: 3});
      expect(t.parliament.chairman, 'the office first').eq(t.p1.id);
      expect(t.parliament.pendingActions.map((a) => a.kind)).deep.eq(['card-reaction']);
      const game = reload(t.game);
      runAllActions(game);
      const p1 = game.getPlayerById(t.p1.id) as TestPlayer;
      expect(fighterQuestion(p1)?.agendaWalkPrompt).deep.include({reason: 'quest'});
      answerPick(game, p1, CardName.ARWIND_INC);
      expect(p1.tableau.get(CardName.ARWIND_INC)!.resourceCount).eq(1);
      expect(game.parliament!.pendingActions).deep.eq([]);
    });

    it('the corporation alone: the quest\'s step lands its fighter, nothing is asked', () => {
      const t = table();
      t.p1.popWaitingFor();
      t.parliament.agenda.set(t.p1.id, 2);
      asOwnAction(t.p1, () => t.p1.production.add(Resource.HEAT, 3));
      answerQuestGate(t.game, t.p1);
      expect(fighterQuestion(t.p1)).is.undefined;
      expect(t.arwind.resourceCount).eq(1);
      expect(t.parliament.pendingActions).deep.eq([]);
    });
  });

  describe('a LAW\'s seat step (`resolution`, RX39 Reds Budget)', () => {
    it('the seat with Arwind and a second holder is asked inside its own step; the other seat walks and is asked nothing', () => {
      const t = table();
      withShips(t);
      seatResolution(t.parliament, 0, resolutionInstanceId(REDS_BUDGET_ID, 0));
      t.parliament.placeVote(t.p2, t.parliament.slots[0], 'lobby');
      for (const p of [t.p1, t.p2]) {
        p.megaCredits = 15;
      }
      t.parliament.agenda.set(t.p1.id, 4);
      passToParliament(t.game);
      runAllActions(t.game);
      const q = cast(fighterQuestion(t.p1), SelectCard<ICard>);
      expect(q.agendaWalkPrompt).deep.include({reason: 'resolution', resolution: REDS_BUDGET_ID, from: 4, to: 5});
      expect(fighterQuestion(t.p2)).is.undefined;
      answerPick(t.game, t.p1, CardName.ARWIND_INC);
      expect(t.arwind.resourceCount).eq(1);
      expect(t.parliament.pendingActions).deep.eq([]);
      settleParliamentGates(t.game);
      expect(t.game.generation).eq(2);
    });
  });

  it('the question is never asked of a title — the marker is structural and survives nesting, on the pick and on the layout', () => {
    const t = table();
    withShips(t);
    t.parliament.agenda.set(t.p1.id, 0);
    ChairmanSeat.walkAgenda(t.p1, t.parliament, 1, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
    runAllActions(t.game);
    const pick = t.p1.getWaitingFor() as PlayerInput;
    expect(pick.toModel(t.p1).agendaWalkPrompt).deep.include({source: CardName.ARWIND_INC, reason: 'card', from: 0, to: 1});
    answerPick(t.game, t.p1, CardName.ARWIND_INC);
    ChairmanSeat.walkAgenda(t.p1, t.parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
    runAllActions(t.game);
    const layout = t.p1.getWaitingFor() as PlayerInput;
    expect(layout.toModel(t.p1).type).eq('and');
    expect(layout.toModel(t.p1).agendaWalkPrompt).deep.include({source: CardName.ARWIND_INC, reason: 'card', from: 1, to: 3});
  });
});
