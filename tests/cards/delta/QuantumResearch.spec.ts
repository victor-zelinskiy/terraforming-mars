import {expect} from 'chai';
import {QuantumResearch} from '../../../src/server/cards/delta/QuantumResearch';
import {DeltaProject} from '../../../src/server/cards/delta/DeltaProject';
import {Polyphemos} from '../../../src/server/cards/colonies/Polyphemos';
import {TerralabsResearch} from '../../../src/server/cards/turmoil/TerralabsResearch';
import {EarthCatapult} from '../../../src/server/cards/base/EarthCatapult';
import {ChooseCards} from '../../../src/server/deferredActions/ChooseCards';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Player} from '../../../src/server/Player';
import {Server} from '../../../src/server/models/ServerModel';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import * as constants from '../../../src/common/constants';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

describe('QuantumResearch', () => {
  let card: QuantumResearch;
  let player: TestPlayer;

  beforeEach(() => {
    card = new QuantumResearch();
    [/* game */, player] = testGame(2);
  });

  describe('metadata', () => {
    it('matches the printed card', () => {
      expect(card.name).to.eq(CardName.QUANTUM_RESEARCH);
      expect(card.type).to.eq(CardType.ACTIVE);
      expect(card.cost).to.eq(9);
      expect(card.tags).to.deep.eq([Tag.WILD]);
      expect(card.getVictoryPoints(player)).to.eq(1);
      expect(card.metadata.cardNumber).to.eq('DP02');
      expect(card.requirements).to.deep.eq([{tag: Tag.SCIENCE, count: 3}]);
    });

    it('belongs to the Delta Project card set', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.module).to.eq('deltaProject');
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.QUANTUM_RESEARCH]).is.not.undefined;
      // The subsystem card keeps DP01; this is the set's first REAL card.
      expect(new DeltaProject().metadata.cardNumber).to.eq('DP01');
    });

    it('carries no science tag of its own — the atom is the REQUIREMENT', () => {
      expect(card.tags).to.not.contain(Tag.SCIENCE);
    });
  });

  describe('requirement', () => {
    it('cannot be played with 2 science tags', () => {
      player.playedCards.push(fakeCard({tags: [Tag.SCIENCE, Tag.SCIENCE]}));
      expect(card.canPlay(player)).is.false;
    });

    it('can be played with 3 science tags', () => {
      player.playedCards.push(fakeCard({tags: [Tag.SCIENCE, Tag.SCIENCE, Tag.SCIENCE]}));
      expect(card.canPlay(player)).is.true;
    });

    // Wild tags satisfy a tag requirement under the project's own rules —
    // nothing about this card changes that.
    it('accepts wild tags the player already has, by the standard rule', () => {
      player.playedCards.push(fakeCard({tags: [Tag.SCIENCE, Tag.SCIENCE, Tag.WILD]}));
      expect(card.canPlay(player)).is.true;
    });

    // The card is not in the tableau until it is played, so its own wild tag
    // can never be part of the count that admits it.
    it('its own wild tag does not help it be played', () => {
      player.playedCards.push(fakeCard({tags: [Tag.SCIENCE, Tag.SCIENCE]}));
      expect(card.canPlay(player)).is.false;
      expect(player.tags.count(Tag.WILD, 'raw')).to.eq(0);
      player.playedCards.push(card);
      expect(player.tags.count(Tag.WILD, 'raw')).to.eq(1);
    });
  });

  describe('the buy-to-hand discount', () => {
    it('does nothing until the card is in play', () => {
      expect(player.cardCost).to.eq(constants.CARD_COST);
      expect(player.cardCost).to.eq(3);
    });

    it('drops the price by 1 M€ once the card is in play', () => {
      player.playedCards.push(card);
      expect(player.cardCost).to.eq(2);
    });

    it('only helps its owner', () => {
      const [/* game */, owner, opponent] = testGame(2);
      owner.playedCards.push(new QuantumResearch());
      expect(owner.cardCost).to.eq(2);
      expect(opponent.cardCost).to.eq(3);
    });

    it('applies once, not once per read', () => {
      player.playedCards.push(card);
      expect(player.cardCost).to.eq(2);
      expect(player.cardCost).to.eq(2);
      expect(player.cardCost).to.eq(2);
    });

    it('does not change the cost of PLAYING a project card', () => {
      const project = newProjectCard(CardName.AQUIFER_PUMPING)!;
      const before = player.getCardCost(project);
      player.playedCards.push(card);
      expect(player.getCardCost(project)).to.eq(before);
      // …and the play-cost discounts still work, untouched.
      player.playedCards.push(new EarthCatapult());
      expect(player.getCardCost(project)).to.eq(before - 2);
      // The buy price is unmoved by a PLAY discount, in the same direction.
      expect(player.cardCost).to.eq(2);
    });
  });

  describe('stacking with the corporations that set the price', () => {
    it('Polyphemos: 5 → 4', () => {
      player.playCorporationCard(new Polyphemos());
      expect(player.cardCost).to.eq(5);
      player.playedCards.push(card);
      expect(player.cardCost).to.eq(4);
    });

    it('Terralabs Research: 1 → 0', () => {
      player.playCorporationCard(new TerralabsResearch());
      expect(player.cardCost).to.eq(1);
      player.playedCards.push(card);
      expect(player.cardCost).to.eq(0);
    });

    it('never turns a purchase into income', () => {
      player.playCorporationCard(new TerralabsResearch());
      player.playedCards.push(card);
      // A second modifier of the same kind still cannot go below zero.
      player.playedCards.push(fakeCard({name: 'fake' as CardName, getCardPurchaseDiscount: () => 5}));
      expect(player.cardCost).to.eq(0);
    });

    it('the corporation still writes the base price after the card is in play', () => {
      player.playedCards.push(card);
      expect(player.cardCost).to.eq(2);
      // Merger's second corporation lands later; the base moves, the card's
      // −1 keeps riding on top of it.
      player.playCorporationCard(new Polyphemos());
      expect(player.cardCost).to.eq(4);
    });
  });

  describe('through the real purchase pipeline', () => {
    /** Runs a `ChooseCards` buy for `count` cards and returns the M€ charged. */
    function buy(p: TestPlayer, count: number): number {
      const offered: Array<IProjectCard> = [
        newProjectCard(CardName.AQUIFER_PUMPING)!,
        newProjectCard(CardName.IO_MINING_INDUSTRIES)!,
        newProjectCard(CardName.BUSHES)!,
      ];
      const before = p.megaCredits;
      const selectCard = cast(new ChooseCards(p, offered, {paying: true}).execute(), SelectCard<IProjectCard>);
      selectCard.cb(offered.slice(0, count));
      // The player holds only M€, so SelectPaymentDeferred charges directly
      // instead of prompting — the deferred queue IS the whole purchase.
      runAllActions(p.game);
      return before - p.megaCredits;
    }

    it('charges 3 M€ per card without the effect', () => {
      player.megaCredits = 100;
      expect(buy(player, 1)).to.eq(3);
    });

    it('charges 2 M€ per card with the effect', () => {
      player.megaCredits = 100;
      player.playedCards.push(card);
      expect(buy(player, 1)).to.eq(2);
      expect(player.cardsInHand.map(toName)).to.contain(CardName.AQUIFER_PUMPING);
    });

    it('discounts EVERY card of a multi-card buy', () => {
      player.megaCredits = 100;
      player.playedCards.push(card);
      expect(buy(player, 3)).to.eq(6); // 3 × 2, not 3 × 3 − 1
    });

    it('raises how many cards the player can afford', () => {
      player.megaCredits = 4;
      const offered = [
        newProjectCard(CardName.AQUIFER_PUMPING)!,
        newProjectCard(CardName.IO_MINING_INDUSTRIES)!,
        newProjectCard(CardName.BUSHES)!,
      ];
      // 4 M€ / 3 = 1 card…
      expect(cast(new ChooseCards(player, offered, {paying: true}).execute(), SelectCard<IProjectCard>).config.max).to.eq(1);
      // …but 4 M€ / 2 = 2 cards.
      player.playedCards.push(card);
      expect(cast(new ChooseCards(player, offered, {paying: true}).execute(), SelectCard<IProjectCard>).config.max).to.eq(2);
    });

    it('leaves a FREE draw free — no charge, and no M€ gained', () => {
      player.megaCredits = 7;
      player.playedCards.push(card);
      const offered = [newProjectCard(CardName.AQUIFER_PUMPING)!];
      const selectCard = cast(new ChooseCards(player, offered, {}).execute(), SelectCard<IProjectCard>);
      selectCard.cb(offered);
      runAllActions(player.game);
      expect(player.megaCredits).to.eq(7);
      expect(player.cardsInHand.map(toName)).to.deep.eq([CardName.AQUIFER_PUMPING]);
    });
  });

  describe('persistence', () => {
    it('survives a serialize/deserialize round trip without applying twice', () => {
      const game = player.game;
      player.playCorporationCard(new Polyphemos());
      player.playedCards.push(card);
      expect(player.cardCost).to.eq(4);
      // The BASE is what is stored; the card's −1 is re-derived from the tableau.
      const serialized = player.serialize();
      expect(serialized.cardCost).to.eq(5);

      const restored = Player.deserialize(serialized);
      restored.game = game;
      expect(restored.baseCardCost).to.eq(5);
      expect(restored.cardCost).to.eq(4);

      // A second round trip cannot compound it.
      const twice = Player.deserialize(restored.serialize());
      twice.game = game;
      expect(twice.cardCost).to.eq(4);
    });

    it('an old save with no such card restores its price unchanged', () => {
      const game = player.game;
      player.playCorporationCard(new TerralabsResearch());
      const restored = Player.deserialize(player.serialize());
      restored.game = game;
      expect(restored.cardCost).to.eq(1);
    });
  });

  // The client NEVER recomputes a buy price: both console purchase surfaces
  // (ConsoleTaskHost.buyCostPerCard, ConsoleDraftWorkspace.buyCostPerCard) read
  // `thisPlayer.cardCost` off this model, so what the server charges and what
  // the UI shows are the same number by construction.
  describe('the client-facing model', () => {
    it('publishes the discounted price on PublicPlayerModel', () => {
      expect(Server.getPlayerModel(player).thisPlayer.cardCost).to.eq(3);
      player.playedCards.push(card);
      expect(Server.getPlayerModel(player).thisPlayer.cardCost).to.eq(2);
    });

    it('publishes it for every seat, so an opponent price is honest too', () => {
      const [/* game */, owner, opponent] = testGame(2);
      owner.playedCards.push(new QuantumResearch());
      const seats = Server.getPlayerModel(opponent).players;
      expect(seats.find((p) => p.color === owner.color)?.cardCost).to.eq(2);
      expect(seats.find((p) => p.color === opponent.color)?.cardCost).to.eq(3);
    });
  });

  describe('victory points', () => {
    it('scores its fixed 1 VP through the standard breakdown', () => {
      player.playedCards.push(card);
      expect(player.getVictoryPoints().victoryPoints).to.eq(1);
      expect(player.getVictoryPoints().total).to.eq(player.getVictoryPoints().terraformRating + 1);
    });
  });
});
