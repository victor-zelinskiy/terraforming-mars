import {expect} from 'chai';
import {DATA_PER_SCIENCE_TAG, VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {SupremeExpertise} from '../../../src/server/cards/turmoilRedux/SupremeExpertise';
import {HabitatMarte} from '../../../src/server/cards/pathfinders/HabitatMarte';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES} from '../../../src/common/inputs/Spendable';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {newProjectCard} from '../../../src/server/createCard';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR05 — VECTOR COMPUTATIONS: the first card of the set with a CARD-PLAYED
 * trigger (and so the first to owe the forecast twin), the first action of
 * the set to draw through a TAG FILTER, and the second data holder. Every
 * rule reading of the card file's header is pinned here — above all what
 * counts as a science tag (each printed one, «including this», a Mars tag
 * under Habitat Marte, a non-card tag) and what does not (a wild tag, an
 * opponent's play).
 */
function reduxTable(): [IGame, TestPlayer, TestPlayer] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2];
}

/**
 * Stack the draw pile so the LAST array element is drawn first (`draw()`
 * pops); `spare` cards sit at the bottom, so the search never empties the
 * pile and reshuffles its own discards back in.
 */
function stackDeck(game: IGame, topLast: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = []): void {
  game.projectDeck.drawPile.length = 0;
  game.projectDeck.discardPile.length = 0;
  game.projectDeck.drawPile.push(...[...spare, ...topLast].map((name) => newProjectCard(name)!));
}

function played(tags: Array<Tag>, type: CardType = CardType.AUTOMATED): IProjectCard {
  return fakeCard({tags, type});
}

describe('VectorComputations', () => {
  let card: VectorComputations;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new VectorComputations();
    [game, player, opponent] = reduxTable();
  });

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.VECTOR_COMPUTATIONS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(6);
    // The corner holds two tags — the atom and the yellow star on black (Space, not Energy).
    expect(card.tags).deep.eq([Tag.SCIENCE, Tag.SPACE]);
    expect(card.resourceType).eq(CardResource.DATA);
    expect(card.metadata.cardNumber).eq('TR05');
    // The MIN box is empty; no VP badge.
    expect(card.requirements).is.empty;
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(DATA_PER_SCIENCE_TAG).eq(2);
    // The live hook carries its forecast twin (the coverage guard's pair).
    expect(typeof card.onCardPlayed).eq('function');
    expect(typeof card.cardPlayedForecast).eq('function');
  });

  it('the info panel reads the printed rules — the effect and the action from their own descriptions', () => {
    const info = buildCardInformation(card, 'turmoilRedux');
    const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
    expect(blocks.map((b) => [b.kind, b.text, b.short])).to.have.deep.members([
      ['effect', 'Effect: Whenever you play a Science tag (including this), add 2 data resources to this card.', 'Science tag: +2 data here'],
      ['action', 'Action: Spend 4 data from here to draw a Space card.', 'Spend 4 data to draw a Space card'],
    ]);
  });

  describe('the trigger — 2 data per science tag you play (rules 1–4)', () => {
    beforeEach(() => {
      player.playedCards.push(card);
    });

    it('one science tag → 2 data', () => {
      player.playCard(played([Tag.SCIENCE]));
      runAllActions(game);
      expect(card.resourceCount).eq(DATA_PER_SCIENCE_TAG);
    });

    it('rule 1 — EVERY science tag counts: two → 4', () => {
      player.playCard(played([Tag.SCIENCE, Tag.SCIENCE]));
      runAllActions(game);
      expect(card.resourceCount).eq(2 * DATA_PER_SCIENCE_TAG);
    });

    it('no science tag → nothing', () => {
      player.playCard(played([Tag.BUILDING, Tag.SPACE]));
      runAllActions(game);
      expect(card.resourceCount).eq(0);
    });

    it('rule 1 — a WILD tag is not a science tag here', () => {
      player.playCard(played([Tag.WILD]));
      runAllActions(game);
      expect(card.resourceCount).eq(0);
    });

    it('rule 1 — a played EVENT with a science tag counts', () => {
      player.playCard(played([Tag.SCIENCE], CardType.EVENT));
      runAllActions(game);
      expect(card.resourceCount).eq(DATA_PER_SCIENCE_TAG);
    });

    it('rule 1 — a Mars tag under Habitat Marte is a science tag', () => {
      player.playedCards.push(new HabitatMarte());
      player.playCard(played([Tag.MARS]));
      runAllActions(game);
      expect(card.resourceCount).eq(DATA_PER_SCIENCE_TAG);
    });

    it('only the OWNER\'s plays trigger it: an opponent\'s science tag pays nothing', () => {
      opponent.playCard(played([Tag.SCIENCE]));
      runAllActions(game);
      expect(card.resourceCount).eq(0);
    });

    it('rule 3 — a science tag NOT from a card (Leavitt, a colony) pays 2; any other tag nothing', () => {
      player.triggerOnNonCardTagAdded(Tag.SCIENCE);
      expect(card.resourceCount).eq(DATA_PER_SCIENCE_TAG);
      player.triggerOnNonCardTagAdded(Tag.SPACE);
      expect(card.resourceCount).eq(DATA_PER_SCIENCE_TAG);
      const trigger = game.events.events.find((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.VECTOR_COMPUTATIONS);
      expect(trigger?.trigger).eq('tag-added');
    });

    it('rule 4 — the collection is LOGGED and RECORDED under the card\'s own effect scope, nothing is asked', () => {
      player.playCard(played([Tag.SCIENCE]));
      expect(card.resourceCount, 'at once — no deferred step').eq(DATA_PER_SCIENCE_TAG);
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      const lines = game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /added 2 .*Vector Computations/i.test(l)), lines.slice(-10).join('\n')).is.true;
      const events = game.events.events;
      const gains = events.filter((e) => e.type === 'card-resource-changed' && e.source?.kind === 'card' && e.source.card === CardName.VECTOR_COMPUTATIONS);
      expect(gains.map((e) => e.impact.cardResources?.[0]?.amount)).deep.eq([DATA_PER_SCIENCE_TAG]);
      expect(gains[0].impact.cardResources?.[0]?.cardResource).eq(CardResource.DATA);
      const triggers = events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.VECTOR_COMPUTATIONS);
      expect(triggers.map((e) => e.trigger)).deep.eq(['card-played']);
    });
  });

  it('rule 2 — «including this»: its own play puts 2 data on it', () => {
    player.cardsInHand.push(card);
    player.playCard(card);
    runAllActions(game);
    expect(player.playedCards.get(CardName.VECTOR_COMPUTATIONS)).eq(card);
    expect(card.resourceCount).eq(DATA_PER_SCIENCE_TAG);
  });

  describe('the forecast twin — what the play preview promises', () => {
    function forecastOf(target: ICard) {
      return effectForecastForPlay(player, target, cardPlayPreview(player, target))
        .facts.filter((f) => f.source.name === CardName.VECTOR_COMPUTATIONS);
    }

    it('one science tag: ONE exact fact, «+2 data here (0 → 2)», the science-tag reason', () => {
      player.playedCards.push(card);
      const trigger = played([Tag.SCIENCE]);
      player.cardsInHand.push(trigger);
      const facts = forecastOf(trigger);
      expect(facts).has.length(1);
      expect(facts[0]).deep.include({certainty: 'exact', timing: 'immediate', recipient: {kind: 'you'}, reasonTag: Tag.SCIENCE});
      expect(facts[0].source).deep.include({kind: 'card', channel: 'card-played', owner: player.color});
      expect(facts[0].effects).has.length(1);
      expect(facts[0].effects[0]).deep.include({direction: 'gain', icon: 'data', amount: 2, current: 0, resulting: 2});
    });

    it('two science tags on 3 stored: «+4 (3 → 7)» — the SAME current the live hook adds to', () => {
      player.playedCards.push(card);
      card.resourceCount = 3;
      const trigger = played([Tag.SCIENCE, Tag.SCIENCE]);
      player.cardsInHand.push(trigger);
      const facts = forecastOf(trigger);
      expect(facts).has.length(1);
      expect(facts[0].effects[0]).deep.include({icon: 'data', amount: 4, current: 3, resulting: 7});
      // …and the live play lands exactly there.
      player.playCard(trigger);
      runAllActions(game);
      expect(card.resourceCount).eq(7);
    });

    it('no science tag, or a wild one: no fact', () => {
      player.playedCards.push(card);
      for (const tags of [[Tag.BUILDING], [Tag.WILD]]) {
        const trigger = played(tags);
        player.cardsInHand.push(trigger);
        expect(forecastOf(trigger), tags.join()).deep.eq([]);
      }
    });

    it('«including this»: the play of the card itself forecasts its own 2 data', () => {
      player.cardsInHand.push(card);
      const facts = forecastOf(card);
      expect(facts).has.length(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].effects[0]).deep.include({icon: 'data', amount: 2, current: 0, resulting: 2});
    });
  });

  describe('the action — spend 4 data from here to draw a Space card (rules 5–6)', () => {
    beforeEach(() => {
      player.playedCards.push(card);
    });

    it('below 4 data the automatic reason names the resources on this card', () => {
      card.resourceCount = 3;
      expect(card.canAct(player)).is.false;
      expect(actionUnavailableReasons(player, card)).deep.eq([{type: 'count', message: 'Not enough resources on this card', current: 3}]);
    });

    it('with 4 data: the deck is discarded down to the first Space card — it alone lands in hand, the search is logged and replayable', () => {
      card.resourceCount = 4;
      // Top-first: Ants (microbe) → Birds (animal) → Asteroid (space).
      stackDeck(game, [CardName.ASTEROID, CardName.BIRDS, CardName.ANTS], [CardName.TARDIGRADES]);
      const hand = player.cardsInHand.map((c) => c.name);
      expect(card.canAct(player)).is.true;
      const door = cast(player.playActionCard(), SelectCard);
      expect(door.cards.map((c) => c.name)).to.include(CardName.VECTOR_COMPUTATIONS);
      door.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(player.cardsInHand.map((c) => c.name)).deep.eq([...hand, CardName.ASTEROID]);
      expect(game.projectDeck.discardPile.map((c) => c.name)).to.have.members([CardName.ANTS, CardName.BIRDS]);
      expect(player.getWaitingFor(), 'nothing is asked').is.undefined;
      const lines = game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /Discarded 2 cards/.test(l)), lines.slice(-10).join('\n')).is.true;
      // The reveal names the card and carries the search the console's discard tray replays.
      const reveal = player.cardDrawReveals[player.cardDrawReveals.length - 1];
      expect(reveal.source).deep.eq({type: 'card', cardName: CardName.VECTOR_COMPUTATIONS});
      expect(reveal.cards.map((c) => c.name)).deep.eq([CardName.ASTEROID]);
      expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).deep.eq([
        [CardName.ANTS, false],
        [CardName.BIRDS, false],
        [CardName.ASTEROID, true],
      ]);
    });

    it('rule 6 — a deck with NO Space card is searched through: the action ends without an exception, nothing drawn, no card lost', () => {
      card.resourceCount = 4;
      stackDeck(game, [CardName.BIRDS, CardName.ANTS]);
      const hand = player.cardsInHand.length;
      expect(card.canAct(player)).is.true;
      const door = cast(player.playActionCard(), SelectCard);
      expect(() => {
        door.cb([card]);
        runAllActions(game);
      }).to.not.throw();
      expect(card.resourceCount).eq(0);
      expect(player.cardsInHand.length).eq(hand);
      expect(game.projectDeck.size(), 'both cards are still in the deck or its discard pile').eq(2);
    });

    it('rule 5 — an empty deck: the action is off with the automatic «The deck is empty»', () => {
      card.resourceCount = 4;
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      expect(card.canAct(player)).is.false;
      expect(actionUnavailableReasons(player, card)).deep.include({type: 'rule', message: 'The deck is empty'});
    });

    it('the preview is DECLARATIVE: a «4 → 0 on this card» cost chip and a card draw', () => {
      card.resourceCount = 4;
      const preview = actionPreview(player, card);
      expect(preview.kind).eq('declarative');
      if (preview.kind !== 'declarative') {
        return;
      }
      const effects = preview.branches[0].effects;
      expect(effects.find((e) => e.direction === 'cost')).deep.include({icon: 'data', amount: 4, current: 4, resulting: 0, note: 'on this card'});
      expect(effects.find((e) => e.direction === 'gain')).deep.include({icon: 'cards', amount: 1});
    });
  });

  describe('a HOLDER of data (rule 7)', () => {
    it('the Scientists\' action offers this card and puts 2 data on it', () => {
      player.playedCards.push(card);
      const parliament = game.parliament!;
      parliament.grantPartyEffect(player, PartyName.SCIENTISTS, 'test');
      const action = ParliamentHandler.partyActionOptions(player).find((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === PartyName.SCIENTISTS);
      const options = cast(action, OrOptions);
      const dataPick = cast(options.options[0], SelectCard);
      expect(dataPick.cards.map((c) => c.name)).deep.eq([CardName.VECTOR_COMPUTATIONS]);
      options.process({type: 'or', index: 0, response: {type: 'card', cards: [card.name]}}, player);
      expect(card.resourceCount).eq(2);
    });

    it('TR01 Supreme Expertise feeds it twice: its science tag triggers 2 data, then its «4 data to ANY card» lands here — 6, enough for the action', () => {
      player.playedCards.push(card);
      for (let i = 0; i < 10; i++) {
        player.playedCards.push(played([Tag.BUILDING]));
      }
      const expertise = new SupremeExpertise();
      player.cardsInHand.push(expertise);
      player.megaCredits = 20;
      expect(player.canPlay(expertise)).is.true;
      player.playCard(expertise);
      runAllActions(game);
      expect(card.resourceCount, 'the trigger lands at once').eq(DATA_PER_SCIENCE_TAG);
      const pick = cast(player.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.VECTOR_COMPUTATIONS]);
      pick.cb([card]);
      expect(card.resourceCount).eq(6);
      expect(card.canAct(player)).is.true;
    });

    it('data are never a payment unit: no spendable names this card', () => {
      expect(SPENDABLE_CARD_RESOURCES as ReadonlyArray<string>).to.not.include('data');
      expect(Object.values(CARD_FOR_SPENDABLE_RESOURCE)).to.not.include(CardName.VECTOR_COMPUTATIONS);
    });
  });

  describe('save / reload', () => {
    it('the stored data survive serialization', () => {
      player.playedCards.push(card);
      card.resourceCount = 5;
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(player.id).playedCards.get(CardName.VECTOR_COMPUTATIONS) as IProjectCard | undefined;
      expect(again?.resourceCount).eq(5);
    });
  });
});
