import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  JOINT_RESEARCH, JOINT_RESEARCH_AT_TARGET_REASON, JOINT_RESEARCH_CODE, JOINT_RESEARCH_DRAW, JOINT_RESEARCH_HAND_BASE, JOINT_RESEARCH_ID,
} from '../../src/server/parliament/resolutions/scientists/JointResearch';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, seatResolution, settleParliamentGates, answerGate} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, levelAmount} from '../../src/common/parliament/influenceScaling';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {IPlayer} from '../../src/server/IPlayer';
import {EventSource} from '../../src/common/events/EventSource';

/**
 * JOINT RESEARCH (Turmoil Redux, RX16) — the first resolution whose value is
 * a LEVEL: every participant draws UP TO 6 + influence cards in hand.
 *
 * What these specs pin: the formula yields the TARGET and the one top-up
 * division yields the payout (max(0, target − hand)); the hand is the
 * engine's at the step; a hand at or above the target draws zero and that
 * zero names itself as the rule working (never «no influence»); influence 0
 * still means a target of 6; the cards come through the shared intake
 * (withheld until taken, a reload inside the take draws nothing twice, a
 * short deck is named); seats draw in order; the record carries the target,
 * the hand before and after and the amount; and the chairman quest counts the
 * EVENT CARDS the player plays — by the card's TYPE, since the event tag is
 * never in `card.tags` — never an automated / active card, a play under a
 * resolution source, the political phase or this card's own take.
 */
const RESEARCH = resolutionInstanceId(JOINT_RESEARCH_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Joint Research in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, RESEARCH);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

/** Bring `player`'s hand to exactly `n` cards — off the top of the project deck, as an ordinary draw would. */
function setHand(game: IGame, player: IPlayer, n: number): void {
  while (player.cardsInHand.length > n) {
    player.cardsInHand.pop();
  }
  while (player.cardsInHand.length < n) {
    player.cardsInHand.push(game.projectDeck.drawOrThrow(game));
  }
}

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return summary?.outcomes?.find((o) => o.player === player.id && o.step === 'draw');
}

/** The live mandatory take of `player`, if that is what it is waiting for. */
function takePrompt(player: IPlayer): SelectCard<IProjectCard> | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectCard && (wf as SelectCard<IProjectCard>).externalDrawPrompt !== undefined ?
    wf as SelectCard<IProjectCard> : undefined;
}

/** Answer the whole take in one press (what «B забрать все» sends). */
function takeAll(player: IPlayer): Array<CardName> {
  const ask = takePrompt(player);
  if (ask === undefined) {
    throw new Error(`${player.color} is not being asked to take cards`);
  }
  const names = ask.cards.map((c) => c.name);
  player.process({type: 'card', cards: names});
  return names;
}

function takeAllIfAsked(player: IPlayer): Array<CardName> {
  return takePrompt(player) === undefined ? [] : takeAll(player);
}

/** Run `f` as one of `player`'s own actions (a card play by default). */
function asOwnAction(player: IPlayer, f: () => void, source: EventSource = {kind: 'card', card: CardName.TREES, owner: player.color}): void {
  const events = player.game.events;
  events.beginAction(player, source, {category: 'card-play'});
  try {
    f();
  } finally {
    events.endScope();
  }
}

describe('JointResearch', () => {
  describe('the catalog entry', () => {
    it('is RX16 of the Scientists — their FIRST real resolution, dealt as ONE card, with no winner-only part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(JOINT_RESEARCH_ID)).eq(JOINT_RESEARCH);
      expect(JOINT_RESEARCH_CODE).eq('RX16');
      expect(JOINT_RESEARCH_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX16')).eq(JOINT_RESEARCH);
      expect(JOINT_RESEARCH.party).eq(PartyName.SCIENTISTS);
      expect(JOINT_RESEARCH.compatibility, 'a base card').is.undefined;
      expect(JOINT_RESEARCH.winnerSteps, 'no winner-only part').is.undefined;
      expect(JOINT_RESEARCH.winnerReward).is.undefined;
      expect(JOINT_RESEARCH.worldSteps).is.undefined;
      expect(JOINT_RESEARCH.levy).is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((i) => i === RESEARCH), 'one physical copy').has.length(1);
      // The Scientists' deck grew after this card (Medical Database, RX18): the card is AMONG their dealt cards, not alone.
      expect(dealt.filter((i) => REDUX_RESOLUTION_CATALOG.ofInstance(i).party === PartyName.SCIENTISTS), 'the Scientists are in the deck now')
        .includes(RESEARCH);
    });

    it('declares ONE part, and it is a LEVEL: up to 6 + influence cards in hand — never an amount', () => {
      expect(JOINT_RESEARCH.scaled).deep.eq([JOINT_RESEARCH_DRAW]);
      expect(JOINT_RESEARCH_DRAW).deep.eq({
        id: 'draw', unit: {kind: 'cards'}, base: 6, perInfluence: 1, level: {total: {kind: 'cards'}, direction: 'up'}, recipient: 'each',
      });
      expect(JOINT_RESEARCH_HAND_BASE).eq(6);
      expect(JOINT_RESEARCH_DRAW.cap, 'no ceiling').is.undefined;
      expect(JOINT_RESEARCH_DRAW.count, 'nothing is counted').is.undefined;
      expect(JOINT_RESEARCH_DRAW.sequel, 'nothing is divided').is.undefined;
    });

    it('its chairman quest is PLAY 2 EVENT CARDS — a card-type goal (the footnote prints two event tags)', () => {
      expect(JOINT_RESEARCH.quest).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'event'}, count: 2});
      expect(JOINT_RESEARCH.text.quest).eq('Play 2 event cards');
    });

    it('the ONE formula: the target is 6 + influence, the payout is max(0, target − hand) — every control example of the brief', () => {
      // hand | influence | target | cards drawn
      const cases: Array<[number, number, number, number]> = [
        [5, 3, 9, 4], [9, 3, 9, 0], [12, 3, 9, 0], [2, 0, 6, 4], [0, 0, 6, 6], [6, 0, 6, 0], [7, 0, 6, 0],
        [9, 5, 11, 2], [11, 5, 11, 0], [0, 5, 11, 11],
      ];
      for (const [hand, influence, target, drawn] of cases) {
        expect(scaledAmount(JOINT_RESEARCH_DRAW, influence), `influence ${influence} → target`).eq(target);
        expect(levelAmount(JOINT_RESEARCH_DRAW, influence, hand), `hand ${hand} at influence ${influence}`).eq(drawn);
      }
      // A nonsense level reads as an empty hand; an effect without a level term pays its formula.
      expect(levelAmount(JOINT_RESEARCH_DRAW, 1, -3)).eq(7);
      expect(levelAmount({...JOINT_RESEARCH_DRAW, level: undefined}, 2, 5), 'no level term — the formula alone').eq(8);
    });
  });

  describe('the enactment', () => {
    it('brings EVERY participant up to 6 + THEIR influence — voters or not — as a mandatory take of cards withheld from the hand', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 0 → step 1 in the phase = influence 1 → target 7; hand 3 → 4 cards.
      // p2 never voted: influence 3 by its own track → target 9; hand 5 → 4 cards.
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      setHand(game, p1, 3);
      setHand(game, p2, 5);
      const deckBefore = game.projectDeck.drawPile.length;
      endGeneration(game);
      expect(parliament.enacted).eq(RESEARCH);
      expect(parliament.rulingParty()).eq(PartyName.SCIENTISTS);
      const ask = takePrompt(p1);
      expect(ask, 'the phase asks the recipient to take them').is.not.undefined;
      expect(ask?.cards, '7 − 3 = 4 cards').has.length(4);
      expect(ask?.externalDrawPrompt).deep.include({count: 4, remaining: 4});
      expect(ask?.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: JOINT_RESEARCH_ID, effect: 'draw'});
      expect(ask?.choiceContext?.source).deep.eq({kind: 'resolution', resolution: JOINT_RESEARCH_ID});
      // WITHHELD: the deck lost them, the hand has not gained them.
      expect(game.projectDeck.drawPile.length).eq(deckBefore - 4);
      expect(p1.cardsInHand, 'not in the hand until taken').has.length(3);
      expect(p1.pendingCardIntakes).has.length(1);
      expect(p2.getWaitingFor(), 'p2 waits its turn').is.undefined;
      const taken = takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand, '3 + 4').has.length(7);
      expect(p1.cardsInHand.map((c) => c.name)).includes.members(taken);
      expect(p1.pendingCardIntakes).is.empty;
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'cards', effect: 'draw', amount: 4, drawn: 4, influence: 1, target: 7});
      expect(outcomeOf(parliament, p1)?.total, 'the hand before and after').deep.eq({before: 3, after: 7});
      // Then p2 — its own target, its own hand.
      expect(takePrompt(p2)?.cards, '9 − 5 = 4').has.length(4);
      takeAll(p2);
      runAllActions(game);
      expect(p2.cardsInHand).has.length(9);
      expect(outcomeOf(parliament, p2)).deep.include({amount: 4, drawn: 4, influence: 3, target: 9});
      expect(outcomeOf(parliament, p2)?.total).deep.eq({before: 5, after: 9});
      settleParliamentGates(game);
      expect(parliament.lastPhase, 'the political phase finished only after the takes').is.not.undefined;
      expect(game.generation).eq(2);
    });

    it('a hand at or above the target draws NOTHING, asks nothing, and the zero names itself as the rule — never «no influence»', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3)); // target 9
      setHand(game, p1, 0);
      setHand(game, p2, 9);
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2), 'no empty take step').is.undefined;
      expect(p2.pendingCardIntakes).is.empty;
      expect(p2.cardsInHand).has.length(9);
      expect(outcomeOf(parliament, p2)).deep.include({
        kind: 'skipped', effect: 'draw', amount: 0, influence: 3, target: 9, reason: JOINT_RESEARCH_AT_TARGET_REASON,
      });
      expect(outcomeOf(parliament, p2)?.total).deep.eq({before: 9, after: 9});
      expect(outcomeOf(parliament, p2)?.reason, 'the rule working, not a want of influence').not.eq('No influence');
      const line = game.gameLog.find((e) => e.message.startsWith('${0} has ${1} card(s) in hand — at least ${2} already'));
      expect(line, 'the journal names the hand and the target').is.not.undefined;
      expect(line?.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['9', '9']);
      settleParliamentGates(game);
      expect(parliament.lastPhase).is.not.undefined;
    });

    it('a hand ABOVE the target is just as much at the target: 12 in hand at target 9 draws none', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      setHand(game, p1, 7); // the winner: target 7 — nothing either
      setHand(game, p2, 12);
      endGeneration(game);
      runAllActions(game);
      expect(takePrompt(p1)).is.undefined;
      expect(takePrompt(p2)).is.undefined;
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'skipped', amount: 0, target: 7});
      expect(outcomeOf(parliament, p1)?.total).deep.eq({before: 7, after: 7});
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', amount: 0, target: 9});
      expect(parliament.lastPhase, 'a quiet enactment ends the phase by itself').is.not.undefined;
    });

    it('influence 0 never cancels the card: the target is still 6, and a hand of 2 draws 4', () => {
      const [game, p1, p2, parliament] = stage();
      setHand(game, p1, 6); // the winner at target 7 → 1 card, so the walk reaches p2
      setHand(game, p2, 2);
      expect(parliament.influence(p2)).eq(0);
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2)?.cards, '6 − 2').has.length(4);
      takeAll(p2);
      runAllActions(game);
      expect(p2.cardsInHand).has.length(6);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'cards', amount: 4, drawn: 4, influence: 0, target: 6});
      expect(outcomeOf(parliament, p2)?.total).deep.eq({before: 2, after: 6});
    });

    it('influence is the Redux ledger AFTER the winner\'s Agenda step, and the hand is the one the player left themselves', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 2); // influence 1 now; the phase's step lands on 3 = influence 2 → target 8
      setHand(game, p1, 5);
      // The player empties their hand a little before the sitting: the target does not move, the draw grows.
      p1.cardsInHand.pop();
      p1.cardsInHand.pop();
      endGeneration(game);
      expect(parliament.agendaOf(p1)).eq(3);
      expect(takePrompt(p1)?.cards, '8 − 3').has.length(5);
      takeAll(p1);
      runAllActions(game);
      expect(outcomeOf(parliament, p1)).deep.include({influence: 2, target: 8, amount: 5});
      expect(outcomeOf(parliament, p1)?.total).deep.eq({before: 3, after: 8});
    });

    it('the seats draw IN ORDER off the top of the project deck: the first seat takes the top cards, the next seat the ones beneath', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(1)); // target 7
      setHand(game, p1, 4); // the winner: target 7 → 3 cards
      setHand(game, p2, 5); // target 7 → 2 cards
      const pile = game.projectDeck.drawPile.map((c) => c.name);
      endGeneration(game);
      const first = takePrompt(p1)!.cards.map((c) => c.name);
      expect(first.slice().sort(), 'the top three').deep.eq(pile.slice(-3).sort());
      expect(p2.getWaitingFor(), 'the next seat is not asked while one still owes a take').is.undefined;
      takeAll(p1);
      runAllActions(game);
      const second = takePrompt(p2)!.cards.map((c) => c.name);
      expect(second.slice().sort(), 'the two beneath them').deep.eq(pile.slice(-5, -3).sort());
      takeAll(p2);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase).is.not.undefined;
    });

    it('the deck is short: what is left is delivered, and the record keeps the amount owed, the amount drawn and the hand reached', () => {
      const [game, p1, , parliament] = stage();
      setHand(game, p1, 3); // target 7 → 4 owed
      const only = game.projectDeck.drawPile.slice(-2);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      game.projectDeck.drawPile.push(...only);
      endGeneration(game);
      expect(takePrompt(p1)?.cards).has.length(2);
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand, 'short of the target').has.length(5);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'cards', amount: 4, drawn: 2, target: 7});
      expect(outcomeOf(parliament, p1)?.total, 'the hand the take reached, never the target').deep.eq({before: 3, after: 5});
      expect(game.gameLog.some((e) => e.message.includes('were left in the deck for'))).is.true;
    });

    it('an empty deck is named, nothing is substituted, and the record still carries the target and the hand', () => {
      const [game, p1, , parliament] = stage();
      setHand(game, p1, 3);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      endGeneration(game);
      runAllActions(game);
      expect(takePrompt(p1), 'nothing to take').is.undefined;
      expect(p1.cardsInHand).has.length(3);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'skipped', amount: 4, drawn: 0, target: 7, reason: 'The project deck is empty'});
      expect(outcomeOf(parliament, p1)?.total).deep.eq({before: 3, after: 3});
    });

    it('the journal carries the whole calculation with the resolution as its source, and the names stay private to the recipient', () => {
      const [game, p1, p2] = stage();
      setHand(game, p1, 3);
      setHand(game, p2, 6); // at its target: quiet
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      const line = game.gameLog.filter((e) => e.message.startsWith('${0} draws ${1} card(s) from ${2}: up to ${3}'));
      expect(line).has.length(1);
      expect(line[0].data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(JOINT_RESEARCH_ID);
      // drawn 4 · target 7 · influence 1 · had 3
      expect(line[0].data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['4', '7', '1', '3']);
      // The intake's own line names the cards — RESERVED for the recipient (`LogHelper.logDrawnCards`, private).
      const named = game.gameLog.filter((e) => e.message === '${0} drew ${1}' && e.playerId === p1.id);
      expect(named, 'the card names are reserved for the recipient').has.length(1);
      expect(game.gameLog.filter((e) => e.message === '${0} drew ${1}' && e.playerId === undefined), 'never a public line with names').is.empty;
    });

    it('a neutral winner cancels nothing: every participant is still brought up to their own target', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, RESEARCH);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(1));
      setHand(game, p1, 4);
      setHand(game, p2, 0);
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      takeAll(p2);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(RESEARCH);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 3, target: 7, influence: 1});
      expect(outcomeOf(parliament, p2)).deep.include({amount: 6, target: 6, influence: 0});
    });
  });

  describe('once per enactment', () => {
    it('a repeated answer pays nothing twice, and a later draw of the player\'s own never re-tops the hand', () => {
      const [game, p1, , parliament] = stage();
      setHand(game, p1, 3);
      endGeneration(game);
      const ask = takePrompt(p1)!;
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(7);
      expect(() => ask.process({type: 'card', cards: ask.cards.map((c) => c.name)})).to.throw();
      expect(p1.cardsInHand).has.length(7);
      game.phase = Phase.ACTION;
      p1.cardsInHand.pop();
      p1.cardsInHand.pop();
      runAllActions(game);
      expect(p1.cardsInHand, 'no second top-up').has.length(5);
      expect(p1.pendingCardIntakes).is.empty;
      expect(outcomeOf(parliament, p1)).deep.include({amount: 4, drawn: 4});
    });

    it('a LATER, legal enactment of the same card is a NEW calculation by the hand of the day', () => {
      const [game, p1, p2, parliament] = stage();
      setHand(game, p1, 3);
      setHand(game, p2, 6); // at its target: quiet, both generations
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(p1.cardsInHand).has.length(7);
      game.phase = Phase.ACTION;
      setHand(game, p1, 2);
      seatResolution(parliament, 0, RESEARCH);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGeneration(game);
      // Agenda 1 → 2 = influence 1 still → target 7; hand 2 → 5 cards.
      expect(takePrompt(p1)?.cards).has.length(5);
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(7);
    });
  });

  describe('reload', () => {
    it('INSIDE the take: the cards are not re-drawn, the target and the hand are not recomputed, and the phase still waits', () => {
      const [game, p1, p2, parliament] = stage();
      setHand(game, p1, 3); // target 7 → 4 cards
      setHand(game, p2, 6); // at its target: quiet
      endGeneration(game);
      const offered = takePrompt(p1)!.cards.map((c) => c.name).sort();
      const deckAfterDraw = game.projectDeck.drawPile.length;
      expect(parliament.phase?.step).eq('effects');

      const copy = reload(game);
      const c1 = copy.playersInGenerationOrder[0] as TestPlayer;
      expect(copy.projectDeck.drawPile.length, 'nothing is drawn again').eq(deckAfterDraw);
      expect(c1.pendingCardIntakes).has.length(1);
      const again = takePrompt(c1);
      expect(again?.cards.map((c) => c.name).sort(), 'the same four cards').deep.eq(offered);
      // The hand grows behind the take (a card slipped in): the draw does not follow it.
      c1.cardsInHand.push(copy.projectDeck.drawOrThrow(copy));
      takeAll(c1);
      runAllActions(copy);
      expect(c1.cardsInHand, '3 + 1 + the same 4').has.length(8);
      expect(c1.pendingCardIntakes).is.empty;
      const record = copy.parliament?.phase?.summary?.outcomes?.find((o) => o.player === c1.id && o.step === 'draw');
      expect(record).deep.include({amount: 4, drawn: 4, target: 7});
      expect(record?.total, 'as read at the step').deep.eq({before: 3, after: 7});
      settleParliamentGates(copy);
      expect(copy.parliament?.lastPhase).is.not.undefined;
    });

    it('a PARTIAL take survives the reload: only the remainder is offered, nothing is doubled', () => {
      const [game, p1, p2] = stage();
      setHand(game, p1, 3);
      setHand(game, p2, 6); // at its target: quiet
      endGeneration(game);
      const ask = takePrompt(p1)!;
      const first = ask.cards[0].name;
      p1.process({type: 'card', cards: [first]});
      const copy = reload(game);
      const c1 = copy.playersInGenerationOrder[0] as TestPlayer;
      expect(c1.cardsInHand.map((c) => c.name)).includes(first);
      expect(c1.cardsInHand).has.length(4);
      const again = takePrompt(c1);
      expect(again?.cards).has.length(3);
      expect(again?.externalDrawPrompt).deep.include({count: 4, remaining: 3});
      takeAll(c1);
      runAllActions(copy);
      expect(c1.cardsInHand).has.length(7);
      settleParliamentGates(copy);
      expect(copy.parliament?.lastPhase).is.not.undefined;
    });

    it('between two seats: the finished seat is not topped up again', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      setHand(game, p1, 4);
      setHand(game, p2, 4);
      endGeneration(game);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2), 'p2 is the one being asked now').is.not.undefined;
      const copy = reload(game);
      const [c1, c2] = copy.playersInGenerationOrder as Array<TestPlayer>;
      expect(c1.cardsInHand, 'p1\'s cards are not repeated').has.length(7);
      expect(c1.pendingCardIntakes).is.empty;
      takeAll(c2);
      runAllActions(copy);
      expect(c2.cardsInHand).has.length(7);
      expect(c1.cardsInHand).has.length(7);
      settleParliamentGates(copy);
      expect(copy.parliament?.lastPhase).is.not.undefined;
    });
  });

  describe('the chairman quest — play 2 event cards', () => {
    function enactedResearch(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      setHand(game, p1, 7);
      setHand(game, p2, 6);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'event'}, count: 2});
      expect(parliament.quest?.source).eq(JOINT_RESEARCH_ID);
      game.phase = Phase.ACTION;
      return [game, p1, p2, parliament];
    }

    /** A card of `type` in the hand, playable at once (no cost, no requirement). */
    function handCard(player: IPlayer, name: CardName, type: CardType): IProjectCard {
      const card = fakeCard({name, type});
      player.cardsInHand.push(card);
      return card;
    }

    it('THE TRAP: the event tag is not printed in `card.tags` — a tag goal could never see an event; the goal matches the card\'s TYPE', () => {
      // A real event: its tags are what it prints beside the event tag (space), never the event tag itself.
      expect(new Asteroid().type).eq(CardType.EVENT);
      expect(new Asteroid().tags, 'the event tag follows from the type, `Tags.count` adds it').not.includes(Tag.EVENT);
      expect(QuestTracker.match({kind: 'tag', tag: Tag.EVENT}, {kind: 'tag', tags: new Asteroid().tags}), 'a tag goal sits at zero').eq(0);
      // The type goal sees it — and nothing but an event.
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'event'}, {kind: 'cardsPlayed', cardType: CardType.EVENT})).eq(1);
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'event'}, {kind: 'cardsPlayed', cardType: CardType.AUTOMATED})).eq(0);
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'event'}, {kind: 'cardsPlayed', cardType: CardType.ACTIVE})).eq(0);
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'active'}, {kind: 'cardsPlayed', cardType: CardType.EVENT}), 'and an event is not an active card').eq(0);
    });

    it('PLAYING two event cards completes it — one, then the second — and the seat is offered', () => {
      const [game, p1, , parliament] = enactedResearch();
      expect(parliament.questProgressOf(p1)).eq(0);
      const first = handCard(p1, CardName.ASTEROID, CardType.EVENT);
      asOwnAction(p1, () => p1.playCard(first));
      expect(p1.cardsInHand.map((c) => c.name), 'the card left the hand').not.includes(CardName.ASTEROID);
      expect(parliament.questProgressOf(p1)).eq(1);
      expect(parliament.quest?.completedBy).is.undefined;
      const second = handCard(p1, CardName.COMET, CardType.EVENT);
      asOwnAction(p1, () => p1.playCard(second));
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });

    it('an AUTOMATED or an ACTIVE card is not an event — the type is what counts, not the play', () => {
      const [, p1, , parliament] = enactedResearch();
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.MICRO_MILLS, CardType.AUTOMATED)));
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.BIRDS, CardType.ACTIVE)));
      expect(parliament.questProgressOf(p1)).eq(0);
    });

    it('an event played under a RESOLUTION source, or outside the action phase, never counts (decision Q5)', () => {
      const [game, p1, , parliament] = enactedResearch();
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.ASTEROID, CardType.EVENT)), {kind: 'resolution', id: JOINT_RESEARCH_ID, owner: p1.color});
      expect(parliament.questProgressOf(p1)).eq(0);
      game.phase = Phase.PARLIAMENT;
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.COMET, CardType.EVENT)));
      expect(parliament.questProgressOf(p1)).eq(0);
      game.phase = Phase.ACTION;
      // A bare play needs no wrapper: `Player.playCard` opens the player's OWN root (`card-play`) — it IS their action.
      p1.playCard(handCard(p1, CardName.DEIMOS_DOWN, CardType.EVENT));
      expect(parliament.questProgressOf(p1), 'a plain play counts by itself').eq(1);
    });

    it('THIS card\'s own draw — a take, not a play — never progresses the quest it brings', () => {
      const [, p1, , parliament] = enactedResearch();
      expect(parliament.questProgressOf(p1)).eq(0);
    });
  });

  describe('the model', () => {
    it('carries the seat\'s HAND — the level the top-up is read against — and the recorded outcomes with the target', () => {
      const [game, p1, p2] = stage();
      setHand(game, p1, 3);
      setHand(game, p2, 9);
      const before = getParliamentModel(game, p1)!;
      expect(before.players.find((s) => s.color === p1.color)?.hand).eq(3);
      expect(before.players.find((s) => s.color === p2.color)?.hand).eq(9);
      endGeneration(game);
      // While p1's cards are still owed, the hand the model carries is the hand the step read — the intake is not in it.
      expect(getParliamentModel(game, p1)!.players.find((s) => s.color === p1.color)?.hand).eq(3);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      const after = getParliamentModel(game, p1)!;
      const outcomes = after.lastPhase?.outcomes ?? [];
      const mine = outcomes.find((o) => o.player === p1.color && o.step === 'draw');
      expect(mine).deep.include({kind: 'cards', amount: 4, drawn: 4, influence: 1, target: 7});
      expect(mine?.total).deep.eq({before: 3, after: 7});
      const theirs = outcomes.find((o) => o.player === p2.color && o.step === 'draw');
      expect(theirs).deep.include({kind: 'skipped', amount: 0, target: 6, reason: JOINT_RESEARCH_AT_TARGET_REASON});
      expect(theirs?.total).deep.eq({before: 9, after: 9});
      expect(after.players.find((s) => s.color === p1.color)?.hand).eq(7);
    });
  });

  describe('MarsBot', () => {
    it('stays out of the parliament entirely — nothing is drawn for it, and its hand counts for nobody', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.playerIsFinishedWithResearchPhase(human);
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, RESEARCH);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      setHand(game, human, 2);
      const botCards = bot.cardsInHand.length;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      expect(takePrompt(human)?.cards, '7 − 2').has.length(5);
      takeAll(human);
      runAllActions(game);
      expect(parliament.participates(bot)).is.false;
      expect(bot.cardsInHand.length).eq(botCards);
      expect(bot.pendingCardIntakes).is.empty;
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === bot.id)).is.false;
      expect(getParliamentModel(game, human)!.players.find((s) => s.color === bot.color)?.hand, 'no level for a seat outside the parliament').is.undefined;
    });
  });

  it('every other resolution still asks nothing of the take: the shared intake\'s prompt is the same one Climate Research owes', () => {
    const [game, p1] = stage();
    setHand(game, p1, 3);
    endGeneration(game);
    const ask = takePrompt(p1)!;
    expect(ask.choiceContext?.mode).eq('reward');
    takeAllIfAsked(p1);
    runAllActions(game);
    expect(p1.pendingCardIntakes).is.empty;
  });
});
