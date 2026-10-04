import {expect} from 'chai';
import {HomeostasisBureau} from '@/server/cards/promo/HomeostasisBureau';
import {IGame} from '@/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {setTemperature} from '../../TestingUtils';
import {NitrogenRichAsteroid} from '@/server/cards/base/NitrogenRichAsteroid';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {effectForecastForPlay} from '@/server/models/effectForecast';
import {CardName} from '@/common/cards/CardName';

describe('HomeostasisBureau', () => {
  let card: HomeostasisBureau;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new HomeostasisBureau();
    [game, player, player2] = testGame(2);
    setTemperature(game, 4);
  });

  it('play', () => {
    card.play(player);
    expect(player.production.heat).to.eq(2);
  });

  it('Gains 3 M€ when the temperature is raised by 1 step', () => {
    player.playedCards.push(card);
    game.increaseTemperature(player, 1);
    expect(player.megaCredits).to.eq(3);
  });

  it('Gains 3 M€ per step when the temperature is raised multiple steps at once', () => {
    player.playedCards.push(card);
    game.increaseTemperature(player, 2);
    expect(player.megaCredits).to.eq(6);
  });

  it('Does not gain M€ when oxygen is raised', () => {
    player.playedCards.push(card);
    game.increaseOxygenLevel(player, 1);
    expect(player.megaCredits).to.eq(0);
  });

  it('Only gains M€ when the card owner is credited with raising the temperature', () => {
    player.playedCards.push(card);
    game.increaseTemperature(player2, 1);
    expect(player.megaCredits).to.eq(0);
  });

  describe('the forecast twin (a scale raise is a `global` grant in STEPS)', () => {
    function factsOf(actor: TestPlayer) {
      const asteroid = new NitrogenRichAsteroid();
      actor.megaCredits = 40;
      actor.cardsInHand.push(asteroid);
      return effectForecastForPlay(actor, asteroid, cardPlayPreview(actor, asteroid)).facts
        .filter((f) => f.source.name === CardName.HOMEOSTASIS_BUREAU);
    }

    it('YOUR temperature raise promises 3 M€ per STEP (a +2 °C chip is one step) — and pays it', () => {
      player.playedCards.push(card);
      setTemperature(game, -10);
      const facts = factsOf(player);
      expect(facts).has.length(1);
      expect(facts[0]).deep.include({certainty: 'exact', recipient: {kind: 'you'}});
      expect(facts[0].source.channel).eq('global-parameter');
      expect(facts[0].effects[0]).deep.include({direction: 'gain', icon: 'megacredits', amount: 3});
      const before = player.megaCredits;
      player.playCard(player.cardsInHand.find((c) => c.name === CardName.NITROGEN_RICH_ASTEROID)!);
      expect(player.megaCredits - before).eq(3);
    });

    it('an opponent\'s raise promises nothing (an own, rewarded raise only); a maxed temperature nothing', () => {
      player.playedCards.push(card);
      setTemperature(game, -10);
      expect(factsOf(player2)).deep.eq([]);
      setTemperature(game, 8);
      expect(factsOf(player)).deep.eq([]);
    });
  });
});
