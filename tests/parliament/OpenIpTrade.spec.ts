import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {
  OPEN_IP_TRADE, OPEN_IP_TRADE_CARDS_PER_CARD, OPEN_IP_TRADE_CODE, OPEN_IP_TRADE_DRAW, OPEN_IP_TRADE_ID, OPEN_IP_TRADE_MEGACREDITS_PER_CARD,
  OPEN_IP_TRADE_NO_CARDS_REASON, OPEN_IP_TRADE_USES_PER_GENERATION,
} from '../../src/server/parliament/resolutions/scientists/OpenIpTrade';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {PlayerInput} from '../../src/server/PlayerInput';
import {ResolutionActionPromptMeta} from '../../src/common/models/PlayerInputModel';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {IPlayer} from '../../src/server/IPlayer';
import {EventSource} from '../../src/common/events/EventSource';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {potentialActions} from '../../src/server/models/potentialActions';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * OPEN IP TRADE (Turmoil Redux, RX24) — the FIRST resolution with an ACTION:
 * «discard any number of cards; for each, gain 3 M€ and draw a card», plus a
 * draw by influence at the enactment.
 *
 * What these specs pin: the action is a MEMBER OF THE PARTY-ACTION FAMILY —
 * one option of the action menu beside the party actions, carrying the
 * structural marker `resolutionActionPrompt` (never read by its title), held
 * by participants only while the card stands enacted, once per generation,
 * unavailable WITH A REASON (an empty hand, a spent use) rather than hidden;
 * «any number» is never zero; the commit discards, pays 3 × N and draws N in
 * that order under the resolution's own source, with the use recorded at the
 * commit; a short deck is honest; the generation boundary restores the use;
 * the enactment draws every participant its influence through the shared
 * intake (influence 0 named, a reload inside the take drawing nothing twice);
 * the chairman quest counts GREEN (automated) cards played — never a blue, an
 * event, a discard by this action or a play under a resolution source; the
 * party actions are untouched; MarsBot is never in it.
 */
const TRADE = resolutionInstanceId(OPEN_IP_TRADE_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Open IP Trade in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, TRADE);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

/** The card ENACTED without a sitting (the government holds it), the table in its action phase. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatEnacted(parliament, TRADE);
  expect(parliament.enactedDefinition()).eq(OPEN_IP_TRADE);
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
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

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
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

function takeAll(player: IPlayer): Array<CardName> {
  const ask = takePrompt(player);
  if (ask === undefined) {
    throw new Error(`${player.color} is not being asked to take cards`);
  }
  const names = ask.cards.map((c) => c.name);
  player.process({type: 'card', cards: names});
  return names;
}

/** The structural marker of an option (the `PlayerInput` interface does not declare the field). */
function markerOf(input: PlayerInput): ResolutionActionPromptMeta | undefined {
  return (input as {resolutionActionPrompt?: ResolutionActionPromptMeta}).resolutionActionPrompt;
}

/** The resolution action's option of the action menu, by its MARKER (never by its title). */
function actionOption(player: IPlayer): SelectCard<IProjectCard> | undefined {
  const option = ParliamentHandler.resolutionActionOptions(player).find((o: PlayerInput) => markerOf(o) !== undefined);
  return option === undefined ? undefined : cast(option, SelectCard) as unknown as SelectCard<IProjectCard>;
}

/** …and the same option INSIDE the player's live action menu (the whole path: `Player.getActions`). */
function menuOption(player: TestPlayer): {menu: OrOptions, index: number} {
  const menu = player.getActions();
  const index = menu.options.findIndex((o) => markerOf(o) !== undefined);
  return {menu, index};
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

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

describe('OpenIpTrade', () => {
  describe('the catalog entry', () => {
    it('is RX24 of the Scientists — one copy, no expansion needed, an immediate draw AND an action, the two-green-cards quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(OPEN_IP_TRADE_ID)).eq(OPEN_IP_TRADE);
      expect(OPEN_IP_TRADE_CODE).eq('RX24');
      expect(OPEN_IP_TRADE_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX24')).eq(OPEN_IP_TRADE);
      expect(OPEN_IP_TRADE.party).eq(PartyName.SCIENTISTS);
      expect(OPEN_IP_TRADE.compatibility, 'a base card').is.undefined;
      expect(OPEN_IP_TRADE.winnerSteps, 'no winner-only part').is.undefined;
      expect(OPEN_IP_TRADE.winnerReward).is.undefined;
      expect(OPEN_IP_TRADE.worldSteps).is.undefined;
      expect(OPEN_IP_TRADE.passive).is.undefined;
      expect(OPEN_IP_TRADE.action, 'the first real action').is.not.undefined;
      expect(OPEN_IP_TRADE.text.action).eq('Discard any number of cards. For each card discarded, gain 3 M€ and draw a card.');
      expect(OPEN_IP_TRADE.immediateSteps?.map((s) => s.key)).deep.eq(['draw']);
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === TRADE), 'one physical copy').has.length(1);
    });

    it('declares ONE scaled part — 1 card per influence for every participant, no cap, no count — and the stand opens the influence family', () => {
      expect(OPEN_IP_TRADE.scaled).deep.eq([OPEN_IP_TRADE_DRAW]);
      expect(OPEN_IP_TRADE_DRAW).deep.eq({id: 'draw', unit: {kind: 'cards'}, perInfluence: 1, recipient: 'each'});
      for (const influence of [0, 1, 2, 3, 5]) {
        expect(scaledAmount(OPEN_IP_TRADE_DRAW, influence)).eq(influence);
      }
      expect(familyOf(OPEN_IP_TRADE)).eq('influence');
    });

    it('its chairman quest is PLAY 2 GREEN CARDS — a card-type goal (automated), never a tag, never a colour', () => {
      expect(OPEN_IP_TRADE.quest).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2});
      expect(OPEN_IP_TRADE.text.quest).eq('Play 2 green cards');
    });

    it('the action declares the family\'s rate: once per generation, 3 M€ and 1 card per card discarded, an empty hand named', () => {
      const [, p1] = reduxGame();
      const action = OPEN_IP_TRADE.action!;
      expect(action.usesPerGeneration(p1)).eq(OPEN_IP_TRADE_USES_PER_GENERATION).and.eq(1);
      expect(OPEN_IP_TRADE_MEGACREDITS_PER_CARD).eq(3);
      expect(OPEN_IP_TRADE_CARDS_PER_CARD).eq(1);
      setHand(p1.game, p1, 0);
      expect(action.canAct(p1)).deep.eq({available: false, reason: OPEN_IP_TRADE_NO_CARDS_REASON});
      setHand(p1.game, p1, 1);
      expect(action.canAct(p1)).deep.eq({available: true});
      expect(action.preview(p1)).deep.eq([
        {direction: 'cost', icon: 'cards', amount: 1, note: 'per card'},
        {direction: 'gain', icon: 'megacredits', amount: 3, note: 'per card'},
        {direction: 'gain', icon: 'cards', amount: 1, note: 'per card'},
      ]);
    });
  });

  describe('the enactment — 1 card per influence, through the shared intake', () => {
    it('draws EVERY participant its own influence — the winner after its Agenda step, a non-voter by its own track — as a mandatory take withheld from the hand', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      setHand(game, p1, 3);
      setHand(game, p2, 3);
      const deckBefore = game.projectDeck.drawPile.length;
      endGenerationThroughParliament(game);
      expect(parliament.enacted).eq(TRADE);
      expect(parliament.rulingParty()).eq(PartyName.SCIENTISTS);
      // p1 (the winner): Agenda 0 → step 1 in the phase = influence 1 → 1 card.
      const ask = takePrompt(p1);
      expect(ask, 'the phase asks the recipient to take them').is.not.undefined;
      expect(ask?.cards).has.length(1);
      expect(ask?.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: OPEN_IP_TRADE_ID, effect: 'draw'});
      expect(ask?.choiceContext?.source).deep.eq({kind: 'resolution', resolution: OPEN_IP_TRADE_ID});
      expect(game.projectDeck.drawPile.length, 'withheld: the deck lost it, the hand has not gained it').eq(deckBefore - 1);
      expect(p1.cardsInHand).has.length(3);
      expect(p2.getWaitingFor(), 'p2 waits its turn').is.undefined;
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(4);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'cards', effect: 'draw', amount: 1, drawn: 1, influence: 1});
      // p2: influence 2 → 2 cards.
      expect(takePrompt(p2)?.cards).has.length(2);
      takeAll(p2);
      runAllActions(game);
      expect(p2.cardsInHand).has.length(5);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'cards', amount: 2, drawn: 2, influence: 2});
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
    });

    it('influence 0 is a NAMED skip — no intake, no empty prompt', () => {
      const [game, p1, p2, parliament] = stage();
      expect(parliament.influence(p2)).eq(0);
      setHand(game, p2, 2);
      endGenerationThroughParliament(game);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2)).is.undefined;
      expect(p2.cardsInHand).has.length(2);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', effect: 'draw', amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((e) => e.message === '${0} has no influence — no cards from ${1}')).is.true;
    });

    it('a short deck delivers what it has and says so; an empty one is a named skip', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1); // the winner's step lands on influence 3
      setHand(game, p1, 2);
      const only = game.projectDeck.drawPile.slice(-1);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      game.projectDeck.drawPile.push(...only);
      endGenerationThroughParliament(game);
      expect(takePrompt(p1)?.cards).has.length(1);
      takeAll(p1);
      runAllActions(game);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'cards', amount: 3, drawn: 1, influence: 3});
      expect(game.gameLog.some((e) => e.message.includes('were left in the deck for'))).is.true;

      const [game2, q1, , parliament2] = stage();
      setHand(game2, q1, 2);
      game2.projectDeck.drawPile.length = 0;
      game2.projectDeck.discardPile.length = 0;
      endGenerationThroughParliament(game2);
      expect(takePrompt(q1)).is.undefined;
      expect(outcomeOf(parliament2, q1)).deep.include({kind: 'skipped', amount: 1, drawn: 0, reason: 'The project deck is empty'});
    });

    it('a reload inside the take rebuilds the same prompt from the intake and draws nothing twice', () => {
      const [game, p1] = stage();
      game.parliament!.agenda.set(p1.id, agendaForInfluence(2) - 1); // influence 2 after the step
      setHand(game, p1, 3);
      endGenerationThroughParliament(game);
      const before = takePrompt(p1)!.cards.map((c) => c.name);
      expect(before).has.length(2);
      const deck = game.projectDeck.drawPile.length;
      const again = reload(game);
      const seat = again.getPlayerById(p1.id);
      const rebuilt = takePrompt(seat);
      expect(rebuilt?.cards.map((c) => c.name)).deep.eq(before);
      expect(again.projectDeck.drawPile.length, 'nothing drawn again').eq(deck);
      seat.process({type: 'card', cards: before});
      runAllActions(again);
      expect(seat.cardsInHand.map((c) => c.name)).includes.members(before);
      expect(seat.cardsInHand).has.length(5);
    });
  });

  describe('the action — a member of the party-action family', () => {
    it('stands in the action menu beside the party actions for a participant in their own turn, marked `resolutionActionPrompt` — a SelectCard of the whole hand, 1 to all, marked as a discard that BUYS 3 M€ and a card per card', () => {
      const [game, p1, , parliament] = enacted();
      setHand(game, p1, 4);
      const {menu, index} = menuOption(p1);
      expect(index, 'one option, by its marker').is.greaterThanOrEqual(0);
      const option = cast(menu.options[index], SelectCard) as unknown as SelectCard<IProjectCard>;
      expect(option.resolutionActionPrompt).deep.eq({
        resolution: OPEN_IP_TRADE_ID, party: PartyName.SCIENTISTS, stage: 'choose', usesLeft: 1, usesPerGeneration: 1,
      });
      expect(option.cards.map((c) => c.name)).deep.eq(p1.cardsInHand.map((c) => c.name));
      expect(option.config.min).eq(1);
      expect(option.config.max).eq(4);
      expect(option.discardPrompt).deep.eq({
        min: 1, max: 4, source: {kind: 'resolution', resolution: OPEN_IP_TRADE_ID},
        exchange: {icon: 'megacredits', amount: 3, perCard: true, draw: 1},
      });
      expect(option.choiceContext?.source).deep.eq({kind: 'resolution', resolution: OPEN_IP_TRADE_ID});
      // …and the marker survives the wire (the input's own toModel — nesting-safe).
      const model = menu.toModel(p1);
      expect(model.options[index].resolutionActionPrompt).deep.eq(option.resolutionActionPrompt);
      expect(model.options[index].discardPrompt?.exchange).deep.eq({icon: 'megacredits', amount: 3, perCard: true, draw: 1});
      // The party actions the player holds are still there, untouched.
      expect(menu.options.filter((o) => (o as {partyActionPrompt?: unknown}).partyActionPrompt !== undefined).length).eq(ParliamentHandler.partyActionOptions(p1).length);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(1);
    });

    it('is NOT offered — and the model says why — with an empty hand, a spent use, or once another law took the slot', () => {
      const [game, p1, , parliament] = enacted();
      setHand(game, p1, 0);
      expect(actionOption(p1), 'nothing to discard').is.undefined;
      let model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({resolution: OPEN_IP_TRADE_ID, party: PartyName.SCIENTISTS, hasAccess: true, usesLeft: 1, usesPerGeneration: 1, available: false, reason: OPEN_IP_TRADE_NO_CARDS_REASON});
      setHand(game, p1, 2);
      expect(actionOption(p1)).is.not.undefined;
      model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({available: true, reason: ''});
      expect(model.preview).deep.eq(OPEN_IP_TRADE.action!.preview(p1));
      parliament.recordResolutionActionUse(p1);
      expect(actionOption(p1), 'the use is spent').is.undefined;
      model = getParliamentModel(game, p1)!.viewer!.resolutionAction!;
      expect(model).deep.include({usesLeft: 0, available: false, reason: 'This resolution action was already used this generation'});
      parliament.resetGenerationUses();
      expect(actionOption(p1)).is.not.undefined;
      // Another law takes the government: the action is gone, and the model has no action at all.
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(actionOption(p1)).is.undefined;
      expect(getParliamentModel(game, p1)!.viewer!.resolutionAction).is.undefined;
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
    });

    it('the wheel\'s count of actions includes it — the same verdict the menu lists it by', () => {
      const [game, p1] = enacted();
      setHand(game, p1, 2);
      const parties = ParliamentHandler.partyActionOptions(p1).length;
      expect(potentialActions(p1).partyActions).eq(parties + 1);
      setHand(game, p1, 0);
      expect(potentialActions(p1).partyActions).eq(parties);
    });

    it('«any number» is never zero: an empty answer is refused, and nothing was spent', () => {
      const [game, p1, , parliament] = enacted();
      setHand(game, p1, 3);
      const option = actionOption(p1)!;
      expect(() => option.process({type: 'card', cards: []})).to.throw(/Not enough cards/);
      expect(p1.cardsInHand).has.length(3);
      expect(p1.megaCredits).eq(20);
      expect(parliament.resolutionActionUsesLeft(p1), 'the use is recorded at the commit, not at the prompt').eq(1);
    });

    it('THE COMMIT: 3 cards → −3 in hand, +9 M€, +3 drawn — in that order, under the resolution\'s own source; the use is spent; the journal names it', () => {
      const [game, p1, , parliament] = enacted();
      setHand(game, p1, 5);
      const picked = p1.cardsInHand.slice(0, 3).map((c) => c.name);
      const deckBefore = game.projectDeck.drawPile.length;
      const discardBefore = game.projectDeck.discardPile.length;
      const eventsBefore = game.events.events.length;
      const option = actionOption(p1)!;
      option.process({type: 'card', cards: picked});
      runAllActions(game);
      expect(p1.cardsInHand, 'discarded 3, drew 3').has.length(5);
      expect(p1.cardsInHand.map((c) => c.name)).not.includes.members(picked);
      expect(game.projectDeck.discardPile.length, 'the discarded cards went to the discard').eq(discardBefore + 3);
      expect(game.projectDeck.drawPile.length).eq(deckBefore - 3);
      expect(p1.megaCredits).eq(29);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
      expect(parliament.resolutionActionUsesOf(p1)).eq(1);
      // The scope: every mutation carries the law as its source and the seat as its owner.
      const mine = game.events.events.slice(eventsBefore).filter((e) => e.source !== undefined);
      expect(mine.length).greaterThan(0);
      expect(mine.every((e) => e.source?.kind === 'resolution' && e.source.id === OPEN_IP_TRADE_ID && e.source.owner === p1.color),
        `every event sourced by the law (${mine.map((e) => JSON.stringify(e.source)).join(' ')})`).is.true;
      expect(game.events.events.slice(eventsBefore).some((e) => e.type === 'action' && e.category === 'parliament')).is.true;
      expect(game.gameLog.some((e) => e.message === '${0} used the action of ${1}')).is.true;
      expect(game.gameLog.some((e) => e.message === '${0} discarded ${1} card(s) for ${2}: gains ${3} M€ and draws ${4} card(s)')).is.true;
      // …and it is gone from the menu until the next generation.
      expect(actionOption(p1)).is.undefined;
    });

    it('a short deck is honest: what is left is drawn, the M€ are paid in full, and the shortfall is journaled', () => {
      const [game, p1] = enacted();
      setHand(game, p1, 3);
      const picked = p1.cardsInHand.slice(0, 2).map((c) => c.name);
      // Every deck card gone but one; the discard is emptied too, so the reshuffle finds only the cards this very action throws.
      const only = game.projectDeck.drawPile.slice(-1);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      game.projectDeck.drawPile.push(...only);
      actionOption(p1)!.process({type: 'card', cards: picked});
      runAllActions(game);
      expect(p1.megaCredits, '2 × 3, whatever the deck could give').eq(26);
      // The engine reshuffles the discard (the two just thrown) when the pile runs dry, so the second card is one of them.
      expect(p1.cardsInHand).has.length(3);
      expect(p1.cardsInHand.map((c) => c.name)).includes(only[0].name);
    });

    it('the generation boundary restores the use — through the real sitting', () => {
      const [game, p1, p2, parliament] = enacted();
      setHand(game, p1, 2);
      actionOption(p1)!.process({type: 'card', cards: [p1.cardsInHand[0].name]});
      runAllActions(game);
      expect(parliament.resolutionActionUsesLeft(p1)).eq(0);
      // Nobody votes: the quiet slot wins, the government changes hands — so seat a Scientists card the phase keeps
      // (the enacted one stays enacted only if a card of ITS party wins; here we only need the boundary).
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      endGenerationThroughParliament(game);
      settleParliamentGates(game);
      for (const seat of [p1, p2]) {
        if (takePrompt(seat) !== undefined) {
          takeAll(seat);
          runAllActions(game);
        }
      }
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(parliament.resolutionActionUsesOf(p1), 'the counter is reset').eq(0);
    });

    it('a reload keeps the spent use and the hand — nothing is paid twice, the option stays gone', () => {
      const [game, p1] = enacted();
      setHand(game, p1, 3);
      actionOption(p1)!.process({type: 'card', cards: [p1.cardsInHand[0].name, p1.cardsInHand[1].name]});
      runAllActions(game);
      const again = reload(game);
      const seat = again.getPlayerById(p1.id);
      expect(again.parliament!.resolutionActionUsesOf(seat)).eq(1);
      expect(seat.megaCredits).eq(26);
      expect(seat.cardsInHand).has.length(3);
      expect(actionOption(seat)).is.undefined;
    });

    it('a NON-participant never holds it: MarsBot is never offered the action, and its model carries no access', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.playerIsFinishedWithResearchPhase(human);
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatEnacted(parliament, TRADE);
      human.cardsInHand.push(game.projectDeck.drawOrThrow(game));
      bot.cardsInHand.push(game.projectDeck.drawOrThrow(game));
      expect(parliament.participates(bot)).is.false;
      expect(ParliamentHandler.resolutionActionOptions(bot)).is.empty;
      expect(getParliamentModel(game, bot)!.viewer!.resolutionAction).deep.include({hasAccess: false, available: false});
      expect(ParliamentHandler.resolutionActionOptions(human), 'the human holds it').has.length(1);
    });
  });

  describe('the chairman quest — play 2 green cards', () => {
    function enactedTrade(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      setHand(game, p1, 3);
      endGenerationThroughParliament(game);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2});
      expect(parliament.quest?.source).eq(OPEN_IP_TRADE_ID);
      game.phase = Phase.ACTION;
      return [game, p1, p2, parliament];
    }

    /** A card of `type` in the hand, playable at once (no cost, no requirement). */
    function handCard(player: IPlayer, name: CardName, type: CardType): IProjectCard {
      const card = fakeCard({name, type});
      player.cardsInHand.push(card);
      return card;
    }

    it('the goal matches an AUTOMATED card and nothing else', () => {
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'automated'}, {kind: 'cardsPlayed', cardType: CardType.AUTOMATED})).eq(1);
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'automated'}, {kind: 'cardsPlayed', cardType: CardType.ACTIVE})).eq(0);
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'automated'}, {kind: 'cardsPlayed', cardType: CardType.EVENT})).eq(0);
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'automated'}, {kind: 'cardsPlayed', cardType: CardType.PRELUDE})).eq(0);
      expect(QuestTracker.match({kind: 'cardsPlayed', cardType: 'automated'}, {kind: 'cardsPlayed', cardType: CardType.CORPORATION})).eq(0);
    });

    it('PLAYING two green cards completes it — one, then the second — and the seat is offered', () => {
      const [game, p1, , parliament] = enactedTrade();
      expect(parliament.questProgressOf(p1)).eq(0);
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.MICRO_MILLS, CardType.AUTOMATED)));
      expect(parliament.questProgressOf(p1)).eq(1);
      expect(parliament.quest?.completedBy).is.undefined;
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.TREES, CardType.AUTOMATED)));
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
    });

    it('a BLUE card, an EVENT and a PRELUDE are not green', () => {
      const [, p1, , parliament] = enactedTrade();
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.BIRDS, CardType.ACTIVE)));
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.ASTEROID, CardType.EVENT)));
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.LOAN, CardType.PRELUDE)));
      expect(parliament.questProgressOf(p1)).eq(0);
    });

    it('THIS card\'s own action is a DISCARD, not a play: throwing green cards progresses nothing — and its draw neither', () => {
      const [game, p1, , parliament] = enactedTrade();
      p1.cardsInHand.length = 0;
      handCard(p1, CardName.MICRO_MILLS, CardType.AUTOMATED);
      handCard(p1, CardName.TREES, CardType.AUTOMATED);
      const before = p1.megaCredits;
      const option = actionOption(p1)!;
      option.process({type: 'card', cards: [CardName.MICRO_MILLS, CardName.TREES]});
      runAllActions(game);
      expect(p1.megaCredits).eq(before + 6);
      expect(parliament.questProgressOf(p1)).eq(0);
      expect(parliament.quest?.completedBy).is.undefined;
    });

    it('a green card played under a RESOLUTION source, or outside the action phase, never counts (decision Q5)', () => {
      const [game, p1, , parliament] = enactedTrade();
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.MICRO_MILLS, CardType.AUTOMATED)), {kind: 'resolution', id: OPEN_IP_TRADE_ID, owner: p1.color});
      expect(parliament.questProgressOf(p1)).eq(0);
      game.phase = Phase.PARLIAMENT;
      asOwnAction(p1, () => p1.playCard(handCard(p1, CardName.TREES, CardType.AUTOMATED)));
      expect(parliament.questProgressOf(p1)).eq(0);
      game.phase = Phase.ACTION;
      p1.playCard(handCard(p1, CardName.ALGAE, CardType.AUTOMATED));
      expect(parliament.questProgressOf(p1), 'a plain play counts by itself').eq(1);
    });
  });

  describe('the model', () => {
    it('carries the action to the viewer with the same fields a party action has; a spectator-less table without an action carries none', () => {
      const [game, p1, p2] = enacted();
      setHand(game, p1, 2);
      const model = getParliamentModel(game, p1)!;
      expect(model.viewer?.resolutionAction).deep.eq({
        resolution: OPEN_IP_TRADE_ID, party: PartyName.SCIENTISTS, hasAccess: true, usesLeft: 1, usesPerGeneration: 1, available: true, reason: '',
        preview: OPEN_IP_TRADE.action!.preview(p1),
      });
      expect(model.viewer?.partyActions.length, 'the party actions are still listed beside it').greaterThan(0);
      expect(getParliamentModel(game, p2)!.viewer?.resolutionAction).deep.include({hasAccess: true});
      expect(getParliamentModel(game)!.viewer, 'no viewer, no verdicts').is.undefined;
      const [game2, q1] = reduxGame();
      seatEnacted(game2.parliament!, ARCHITECTURE_AWARD_ID);
      expect(getParliamentModel(game2, q1)!.viewer?.resolutionAction).is.undefined;
    });
  });
});
