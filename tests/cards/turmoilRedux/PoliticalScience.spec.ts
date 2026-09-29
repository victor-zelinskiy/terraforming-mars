import {expect} from 'chai';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {SerializedRenewalEvent} from '../../../src/server/parliament/SerializedParliament';
import {ARCHITECTURE_AWARD_ID} from '../../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {QuestDefinition} from '../../../src/common/parliament/ParliamentTypes';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES} from '../../../src/common/inputs/Spendable';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {normalizeRequirement} from '../../../src/client/components/premiumCard/premiumCardViewModel';
import {answerStandingGates, endGenerationThroughParliament, passToParliament, quietResolutionOf, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../../TestingUtils';

/**
 * TR02 — POLITICAL SCIENCE: the first card of the set the SITTING calls
 * (`onDelegatesDiscarded`), the first to HOLD data, and the first to print the
 * «delegates on resolutions» requirement. Every rule reading of the card
 * file's header is pinned here — above all WHAT is a discard (the refresh of
 * an unenacted resolution) and what is not (the enacted card's return, the
 * final generation, a delegate taken back for the chair).
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

/** A two-seat Redux table with three QUIET real resolutions — the Greens' (slot 0), Mars First's (slot 1), the Industrialists' (slot 2). */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament};
}

/**
 * THE COLLECTION TABLE: p1 holds the card; p2 wins slot 1 (Architecture Award,
 * asks nothing) with 2 delegates against p1's 1 there; p1 also stands with 2
 * on the Greens' loser (slot 0) and 1 on the Industrialists' loser (slot 2).
 * Totals 2 · 3 · 1 — the middle card is enacted, the other two are discarded.
 */
function collectionTable(): Table & {card: PoliticalScience, losers: [string, string]} {
  const t = table();
  const {p1, p2, parliament} = t;
  const card = new PoliticalScience();
  p1.playedCards.push(card);
  parliament.placeVote(p2, parliament.slots[1], 'lobby');
  parliament.placeVote(p2, parliament.slots[1], 'reserve');
  parliament.placeVote(p1, parliament.slots[1], 'lobby');
  parliament.placeVote(p1, parliament.slots[0], 'reserve');
  parliament.placeVote(p1, parliament.slots[0], 'reserve');
  parliament.placeVote(p1, parliament.slots[2], 'reserve');
  expect(parliament.winner()?.player).eq(p2.id);
  return {...t, card, losers: [parliament.slots[0].instance, parliament.slots[2].instance]};
}

function journalOf(parliament: Parliament): ReadonlyArray<SerializedRenewalEvent> {
  return parliament.lastPhase?.renewal ?? parliament.phase?.summary?.renewal ?? [];
}

function cardEffects(parliament: Parliament): Array<Extract<SerializedRenewalEvent, {kind: 'card-effect'}>> {
  return journalOf(parliament).filter((e): e is Extract<SerializedRenewalEvent, {kind: 'card-effect'}> => e.kind === 'card-effect');
}

describe('PoliticalScience', () => {
  it('registers with source-backed metadata', () => {
    const card = new PoliticalScience();
    expect(card.name).eq(CardName.POLITICAL_SCIENCE);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(8);
    // The scan's corner holds two tags; the delegate figure sits in the MIN box — the requirement.
    expect(card.tags).deep.eq([Tag.SCIENCE, Tag.EARTH]);
    expect(card.resourceType).eq(CardResource.DATA);
    expect(card.metadata.cardNumber).eq('TR02');
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.requirements).deep.eq([{delegatesOnResolutions: 3, count: 3}]);
    // The one hook the sitting calls; no card-played hook, no forecast twin to owe.
    expect(typeof card.onDelegatesDiscarded).eq('function');
    const hooks = card as unknown as {onCardPlayed?: unknown, onResourceAdded?: unknown, cardPlayedForecast?: unknown};
    expect(hooks.onCardPlayed).is.undefined;
    expect(hooks.onResourceAdded).is.undefined;
    expect(hooks.cardPlayedForecast).is.undefined;
  });

  describe('the collection — rule 1: the refresh of the UNENACTED resolutions, one call per card', () => {
    it('2 delegates off one loser + 1 off the other + 1 off the WINNER → 3 data, two `card-effect` events right after their own leaves', () => {
      const {game, p1, p2, parliament, card, losers} = collectionTable();
      endGenerationThroughParliament(game);
      expect(parliament.phase, 'the sitting is over (a quiet winner)').is.undefined;
      expect(card.resourceCount).eq(3);
      const effects = cardEffects(parliament);
      expect(effects).deep.eq([
        {kind: 'card-effect', player: p1.id, card: CardName.POLITICAL_SCIENCE, resource: CardResource.DATA, count: 2, instance: losers[0]},
        {kind: 'card-effect', player: p1.id, card: CardName.POLITICAL_SCIENCE, resource: CardResource.DATA, count: 1, instance: losers[1]},
      ]);
      const journal = journalOf(parliament);
      for (const effect of effects) {
        const at = journal.indexOf(effect);
        expect(journal[at - 1], 'the answer follows the leave of the very card').deep.include({kind: 'leave', instance: effect.instance});
      }
      // The enacted card's delegates went home too (stepEnact — p2's two and p1's one) — and paid nothing: 2 + 1, never 4.
      expect(parliament.lastPhase?.returned).has.deep.members([{owner: p2.id, count: 2}, {owner: p1.id, count: 1}]);
    });

    it('the collection is LOGGED with the card as the source, and the recorder holds a card-resource event under the card\'s effect scope', () => {
      const {game, parliament, card} = collectionTable();
      endGenerationThroughParliament(game);
      expect(card.resourceCount).eq(3);
      const lines = game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /added 2 \S* ?to Political Science/i.test(l) || /added 2 .*Political Science/i.test(l)), lines.slice(-30).join('\n')).is.true;
      expect(lines.some((l) => /added 1 .*Political Science/i.test(l))).is.true;
      const events = game.events.events;
      const gains = events.filter((e) => e.type === 'card-resource-changed' && e.source?.kind === 'card' && e.source.card === CardName.POLITICAL_SCIENCE);
      expect(gains.map((e) => e.impact.cardResources?.[0]?.amount)).deep.eq([2, 1]);
      expect(gains.every((e) => e.impact.cardResources?.[0]?.cardResource === CardResource.DATA)).is.true;
      const triggers = events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.POLITICAL_SCIENCE);
      expect(triggers.map((e) => e.trigger)).deep.eq(['delegates-discarded', 'delegates-discarded']);
      expect(parliament.lastPhase, 'the sitting finished').is.not.undefined;
    });

    it('NEUTRAL delegates on a loser count for nobody; another seat\'s delegates pay only THAT seat\'s own card', () => {
      const {game, p1, p2, parliament, card} = collectionTable();
      // A neutral cube beside p1's on the Greens' loser; p2 stands on the Industrialists' loser with its own card —
      // and one more of p2's on the winner, so the middle card still wins outright: 3 · 4 · 2.
      expect(parliament.addNeutralVote(parliament.slots[0])).is.not.undefined;
      const rival = new PoliticalScience();
      p2.playedCards.push(rival);
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      parliament.placeVote(p2, parliament.slots[1], 'reserve');
      expect(parliament.winner()?.instance, 'slot 1 still wins: 3 · 4 · 2').eq(parliament.slots[1].instance);
      expect(parliament.winner()?.player).eq(p2.id);
      endGenerationThroughParliament(game);
      expect(card.resourceCount, 'p1: 2 + 1, the neutral cube never counted').eq(3);
      expect(rival.resourceCount, 'p2: its 1 off the Industrialists\' loser').eq(1);
      const effects = cardEffects(parliament);
      expect(effects.map((e) => [e.player, e.count])).deep.eq([[p1.id, 2], [p1.id, 1], [p2.id, 1]]);
    });

    it('a seat WITHOUT the card collects nothing and writes no event', () => {
      const {game, p1, p2, parliament, card} = collectionTable();
      parliament.placeVote(p2, parliament.slots[2], 'reserve');
      endGenerationThroughParliament(game);
      expect(card.resourceCount).eq(3);
      expect(cardEffects(parliament).every((e) => e.player === p1.id)).is.true;
      expect(p2.playedCards.get(CardName.POLITICAL_SCIENCE)).is.undefined;
    });
  });

  describe('what is NOT a discard', () => {
    it('rule 2 — the ENACTED resolution\'s delegates go home too, and pay nothing', () => {
      const {game, p1, parliament} = table();
      const card = new PoliticalScience();
      p1.playedCards.push(card);
      parliament.placeVote(p1, parliament.slots[1], 'lobby');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      expect(parliament.winner()?.player).eq(p1.id);
      endGenerationThroughParliament(game);
      expect(parliament.lastPhase?.returned).deep.eq([{owner: p1.id, count: 2}]);
      expect(card.resourceCount).eq(0);
      expect(cardEffects(parliament)).deep.eq([]);
    });

    it('rule 3 — the FINAL generation refreshes nothing: the delegates stay on the losers, 0 data, no event', () => {
      const {game, p1, p2, parliament} = table();
      const card = new PoliticalScience();
      p1.playedCards.push(card);
      setTemperature(game, 8);
      setOxygenLevel(game, 14);
      maxOutOceans(p1);
      expect(game.gameIsOver()).is.true;
      seatResolution(parliament, 1, ARCHITECTURE_AWARD_ID);
      // p2 wins the middle card 3 · 2: p1's two stand on the Greens' card, which is NOT refreshed in the final generation.
      parliament.placeVote(p2, parliament.slots[1], 'lobby');
      parliament.placeVote(p2, parliament.slots[1], 'reserve');
      parliament.placeVote(p2, parliament.slots[1], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      expect(parliament.winner()?.player).eq(p2.id);
      passToParliament(game);
      expect(parliament.phase?.final).is.true;
      answerStandingGates(game, 'assembly');
      answerStandingGates(game, 'adjourn');
      expect(parliament.phase).is.undefined;
      expect(parliament.lastPhase?.final).is.true;
      expect(parliament.votesOf(p1), 'p1\'s delegates still stand on the loser').eq(2);
      expect(card.resourceCount).eq(0);
      expect(cardEffects(parliament)).deep.eq([]);
    });

    it('rule 4 — a delegate taken back for the CHAIRMAN\'S SEAT is moved, not discarded: 0 data', () => {
      const {p1, parliament} = table();
      const card = new PoliticalScience();
      p1.playedCards.push(card);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      // Every delegate accounted for on cards: the seat asks which card gives one up.
      parliament.pendingActions.push({kind: 'chairman-seat', player: p1.id});
      const pick = cast(ChairmanSeat.seatPrompt(p1, parliament), SelectParty);
      pick.process({type: 'party', partyName: parliament.resolutionOf(parliament.slots[0].instance).party});
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.votesOf(p1)).eq(1);
      expect(card.resourceCount).eq(0);
    });
  });

  describe('rule 9 — the chairman quest of the COMING generation never moves by the collection', () => {
    it('a «2 data» quest set by the enacted card stays at 0 for p1 after 3 data landed in the refresh', () => {
      const {game, p1, parliament, card} = collectionTable();
      const winner = parliament.resolutionOf(parliament.slots[1].instance);
      const definition = winner as {quest: QuestDefinition};
      const original = definition.quest;
      definition.quest = {goal: {kind: 'cardResource', resource: CardResource.DATA}, count: 2};
      try {
        endGenerationThroughParliament(game);
        expect(card.resourceCount).eq(3);
        expect(parliament.quest?.source).eq(winner.id);
        expect(parliament.quest?.definition).deep.eq({goal: {kind: 'cardResource', resource: CardResource.DATA}, count: 2});
        expect(parliament.questProgressOf(p1), 'the sitting belongs to the closing generation').eq(0);
        expect(parliament.quest?.completedBy).is.undefined;
      } finally {
        definition.quest = original;
      }
    });
  });

  describe('rule 10 — a reload mid-sitting never collects twice', () => {
    it('a save whose cursor is set back to the refresh step re-enters it as applied: the data and the journal stand', () => {
      const {game, p1, parliament, card} = collectionTable();
      passToParliament(game);
      answerStandingGates(game, 'assembly');
      expect(parliament.phase?.step).eq('adjourn');
      expect(card.resourceCount).eq(3);
      const serialized = structuredClone(game.serialize());
      serialized.parliament!.phase!.step = 'refresh';
      const live = Game.deserialize(serialized);
      const again = live.getPlayerById(p1.id);
      const reloadedCard = again.playedCards.get(CardName.POLITICAL_SCIENCE) as IProjectCard;
      expect(live.parliament?.phase?.step, 'driven on from the refresh cursor to the adjourn gate').eq('adjourn');
      expect(reloadedCard.resourceCount).eq(3);
      expect(cardEffects(live.parliament!).map((e) => e.count)).deep.eq([2, 1]);
    });
  });

  describe('the requirement — 3 delegates on resolutions (rule 5)', () => {
    let p1: TestPlayer;
    let parliament: Parliament;
    let card: PoliticalScience;

    beforeEach(() => {
      ({p1, parliament} = table());
      card = new PoliticalScience();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
    });

    it('2 on resolutions → refused with the honest count; 3 → playable', () => {
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)).deep.eq([
        {type: 'count', message: 'Requires ${0} delegate(s) on resolutions', params: ['3'], current: 2, requirement: true, requirementKey: `req:${RequirementType.DELEGATES_ON_RESOLUTIONS}`},
      ]);
      parliament.placeVote(p1, parliament.slots[2], 'reserve');
      expect(p1.canPlay(card)).is.true;
      expect(unplayableReasons(p1, card)).deep.eq([]);
    });

    it('the lobby and the chairman\'s seat never count', () => {
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      parliament.chairman = p1.id;
      expect(parliament.lobby.has(p1.id)).is.true;
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({current: 2});
    });

    it('on a classic Turmoil table the count is 0 and the card is simply unplayable', () => {
      const [classic, one] = testGame(2, {turmoilExtension: true});
      const other = new PoliticalScience();
      one.cardsInHand.push(other);
      one.megaCredits = 20;
      expect(classic.politics?.delegatesOnResolutions(one)).eq(0);
      expect(one.canPlay(other)).is.false;
      expect(unplayableReasons(one, other)[0]).deep.include({current: 0, requirement: true});
    });

    it('the premium chip draws the delegate figure, ≥ 3', () => {
      const chip = normalizeRequirement(card.requirements[0]);
      expect(chip).deep.include({type: RequirementType.DELEGATES_ON_RESOLUTIONS, value: 3, comparator: 'min', iconUrl: 'assets/misc/delegate.png', isBinary: false});
    });
  });

  describe('the action — spend 3 data from here to draw a card (rule 7)', () => {
    let game: IGame;
    let p1: TestPlayer;
    let card: PoliticalScience;

    beforeEach(() => {
      ({game, p1} = table());
      card = new PoliticalScience();
      p1.playedCards.push(card);
    });

    it('below 3 data the automatic reason names the resources on this card', () => {
      card.resourceCount = 2;
      expect(card.canAct(p1)).is.false;
      expect(actionUnavailableReasons(p1, card)).deep.eq([{type: 'count', message: 'Not enough resources on this card', current: 2}]);
    });

    it('with 3 data: the data leave, a card arrives, nothing is asked', () => {
      card.resourceCount = 3;
      const hand = p1.cardsInHand.length;
      expect(card.canAct(p1)).is.true;
      const door = cast(p1.playActionCard(), SelectCard);
      expect(door.cards.map((c) => c.name)).to.include(CardName.POLITICAL_SCIENCE);
      door.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(p1.cardsInHand.length).eq(hand + 1);
      expect(p1.getWaitingFor()).is.undefined;
    });

    it('the preview is DECLARATIVE: a «3 → 0 on this card» cost chip and a card gain', () => {
      card.resourceCount = 3;
      const preview = actionPreview(p1, card);
      expect(preview.kind).eq('declarative');
      if (preview.kind !== 'declarative') {
        return;
      }
      const effects = preview.branches[0].effects;
      expect(effects.find((e) => e.direction === 'cost')).deep.include({icon: 'data', amount: 3, current: 3, resulting: 0, note: 'on this card'});
      expect(effects.find((e) => e.direction === 'gain')).deep.include({icon: 'cards', amount: 1});
    });
  });

  describe('a HOLDER of data (rule 6)', () => {
    it('the Scientists\' action offers this card and puts 2 data on it', () => {
      const {p1, parliament} = table();
      const card = new PoliticalScience();
      p1.playedCards.push(card);
      parliament.grantPartyEffect(p1, PartyName.SCIENTISTS, 'test');
      const action = ParliamentHandler.partyActionOptions(p1).find((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === PartyName.SCIENTISTS);
      const options = cast(action, OrOptions);
      const dataPick = cast(options.options[0], SelectCard);
      expect(dataPick.cards.map((c) => c.name)).deep.eq([CardName.POLITICAL_SCIENCE]);
      options.process({type: 'or', index: 0, response: {type: 'card', cards: [card.name]}}, p1);
      expect(card.resourceCount).eq(2);
    });

    it('data are never a payment unit: no spendable names this card', () => {
      expect(SPENDABLE_CARD_RESOURCES as ReadonlyArray<string>).to.not.include('data');
      expect(Object.values(CARD_FOR_SPENDABLE_RESOURCE)).to.not.include(CardName.POLITICAL_SCIENCE);
    });
  });

  describe('save / reload', () => {
    it('the stored data survive serialization', () => {
      const {game, p1} = table();
      const card = new PoliticalScience();
      p1.playedCards.push(card);
      card.resourceCount = 2;
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(p1.id).playedCards.get(CardName.POLITICAL_SCIENCE) as IProjectCard | undefined;
      expect(again?.resourceCount).eq(2);
    });
  });
});
