import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {SoilBacteria} from '../../../src/server/cards/prelude2/SoilBacteria';
import {Tag} from '../../../src/common/cards/Tag';
import {TestPlayer} from '../../TestPlayer';
import {Ants} from '../../../src/server/cards/base/Ants';
import {Moss} from '../../../src/server/cards/base/Moss';
import {AdvancedEcosystems} from '../../../src/server/cards/base/AdvancedEcosystems';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {IGame} from '../../../src/server/IGame';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardName} from '../../../src/common/cards/CardName';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {PRELUDE2_CARDS_TO_ADAPT_IN_PLACE} from '../../../src/common/cards/prelude2Adaptation';
import {runAllActions} from '../../TestingUtils';

describe('SoilBacteria', () => {
  let card: SoilBacteria;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new SoilBacteria();
    [game, player] = testGame(1);
  });

  it('Should play', () => {
    card.play(player);
    expect(player.plants).to.eq(3);
    expect(player.cardsInHand).has.lengthOf(2);
    player.cardsInHand.forEach((card) => expect(card.tags.indexOf(Tag.MICROBE)).not.to.eq(-1));
  });
  it('Runs onCardPlayed', () => {
    card.play(player);
    card.onCardPlayed(player, new Ants());
    // Upstream deferred the plant (`player.defer`, `game.deferredActions.runNext()` here); the fork pays it
    // SYNCHRONOUSLY with the card as its source (rule 3) — the runNext line is dropped knowingly.
    expect(player.stock.plants).to.eq(4);
  });

  /** P61 — the fork's rule readings (the card file's header). */
  describe('P61 · the reactor', () => {
    function factsOf(played: IProjectCard): ReadonlyArray<EffectForecastFact> {
      player.cardsInHand.push(played);
      return effectForecastForPlay(player, played, cardPlayPreview(player, played)).facts
        .filter((f) => f.source.name === CardName.SOIL_BACTERIA);
    }

    function plantsAfterPlaying(played: ICard): number {
      const before = player.plants;
      player.playCard(played as IProjectCard);
      runAllActions(game);
      return player.plants - before;
    }

    beforeEach(() => {
      game.phase = Phase.ACTION;
    });

    it('leaves the hold-back list (the forty-third Prelude 2 card)', () => {
      expect(PRELUDE2_CARDS_TO_ADAPT_IN_PLACE).not.to.include(CardName.SOIL_BACTERIA);
    });

    it('rule 1 — ONE count: the twin promises exactly what the hook pays, per tag', () => {
      player.playedCards.push(card);
      const cases: ReadonlyArray<[IProjectCard, number]> = [
        [new Ants(), 1], // microbe
        [new Moss(), 1], // plant
        [new AdvancedEcosystems(), 2], // plant + microbe + animal
        [new PowerPlant(), 0], // power + building
      ];
      for (const [played, owed] of cases) {
        const facts = factsOf(played);
        if (owed === 0) {
          expect(facts, played.name).deep.eq([]);
        } else {
          expect(facts.map((f) => f.certainty), played.name).deep.eq(['exact']);
          expect(facts[0].effects.map((e) => [e.icon, e.amount]), played.name).deep.eq([[Resource.PLANTS, owed]]);
          expect(facts[0].source.printedEffect, played.name).eq(0);
          expect(facts[0].source.channel, played.name).eq('card-played');
        }
        // Moss needs 3 plants and its requirement; the hook's payout is what is asserted here.
        player.plants = 10;
        game.phase = Phase.ACTION;
        player.cardsInHand = player.cardsInHand.filter((c) => c.name !== played.name);
        expect(plantsAfterPlaying(played) - playCost(played), played.name).eq(owed);
      }
    });

    it('rule 2 — «including this»: the prelude\'s own play pays its own plant, and the twin says so before the press', () => {
      const facts = effectForecastForPlay(player, card, cardPlayPreview(player, card)).facts
        .filter((f) => f.source.name === CardName.SOIL_BACTERIA);
      expect(facts.map((f) => f.effects.map((e) => [e.icon, e.amount]))).deep.eq([[[Resource.PLANTS, 1]]]);
      player.playCard(card);
      runAllActions(game);
      expect(player.plants).eq(4);
      expect(player.cardsInHand).has.lengthOf(2);
    });

    it('rule 3 — paid at once, the card as the source: ONE reaction record (cause = the played card) and a named log line', () => {
      player.playCard(card);
      runAllActions(game);
      player.playCard(new Ants());
      // No `runAllActions`: the plant is already there — nothing waits in the queue for it.
      expect(player.plants).eq(5);
      const records = game.cardReactions.filter((r) => r.card === CardName.SOIL_BACTERIA);
      expect(records.map((r) => [r.channel, r.cause])).deep.eq([
        ['card-played', {card: CardName.SOIL_BACTERIA}],
        ['card-played', {card: CardName.ANTS}],
      ]);
      expect(records.map((r) => r.impacts)).deep.eq([
        [{kind: 'stock', resource: Resource.PLANTS, amount: 1, to: player.color}],
        [{kind: 'stock', resource: Resource.PLANTS, amount: 1, to: player.color}],
      ]);
      const named = game.gameLog.filter((l) => l.message.includes('because of') &&
        l.data.some((d) => d.value === CardName.SOIL_BACTERIA));
      expect(named).has.lengthOf(2);
    });

    it('rule 3 — ONE play, nothing queued for the plant: the stock, the search and the own +1 all land inside the play', () => {
      player.playCard(card);
      // Executor pays the stock and runs the search inside `play`; the fan-out pays the own plant at once.
      expect(player.plants).eq(4);
      expect(player.cardsInHand).has.lengthOf(2);
      expect(game.deferredActions.length).eq(0);
    });

    it('rule 4 — a bare Plant tag answers as one played; any other tag does not (unreachable in scope — Underworld only)', () => {
      card.onNonCardTagAdded(player, Tag.PLANT);
      expect(player.plants).eq(1);
      card.onNonCardTagAdded(player, Tag.MICROBE);
      card.onNonCardTagAdded(player, Tag.SCIENCE);
      expect(player.plants).eq(1);
    });

    it('a rival\'s play never answers (own plays only)', () => {
      const [game2, owner, rival] = testGame(2);
      game2.phase = Phase.ACTION;
      owner.playedCards.push(card);
      rival.playCard(new Ants());
      runAllActions(game2);
      expect(owner.plants).eq(0);
    });
  });
});

/** The plants a played card itself spends (Moss: −1 plant) — the hook's payout is the rest. */
function playCost(card: ICard): number {
  return card.name === CardName.MOSS ? -1 : 0;
}
