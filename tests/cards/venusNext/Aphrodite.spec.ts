import {expect} from 'chai';
import {Aphrodite} from '../../../src/server/cards/venusNext/Aphrodite';
import {SpinInducingAsteroid} from '../../../src/server/cards/venusNext/SpinInducingAsteroid';
import {testGame} from '../../TestGame';
import {cast} from '@/common/utils/utils';
import {setVenusScaleLevel} from '../../TestingUtils';
import {Phase} from '../../../src/common/Phase';
import {CardName} from '../../../src/common/cards/CardName';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {Resource} from '../../../src/common/Resource';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';

describe('Aphrodite', () => {
  it('Should play', () => {
    const card = new Aphrodite();
    const [game, player, player2] = testGame(2);
    cast(card.play(player), undefined);
    expect(player.production.plants).to.eq(1);
    player.playedCards.push(card);
    expect(player.megaCredits).to.eq(0);
    game.increaseVenusScaleLevel(player2, 2);
    expect(game.getVenusScaleLevel()).to.eq(4);
    expect(player.megaCredits).to.eq(4);
  });

  /*
   * Since TR24 (Venusian Census) the corporation answers through the engine's
   * ONE dispatcher (`ICard.onGlobalParameterRaised`, `Game.globalParameterRaised`)
   * instead of a name check inside `Game.increaseVenusScaleLevel` — the numbers
   * on every path are the ones the special case paid; what changed is the
   * attribution (an `effect-triggered` parent of the owner's) and the scene's
   * record (`scaleStepRewards`).
   */
  describe('on the shared dispatcher — the same numbers on every path', () => {
    function owned() {
      const [game, player, player2] = testGame(2, {venusNextExtension: true});
      const card = new Aphrodite();
      player.playedCards.push(card);
      player.megaCredits = 0;
      return {game, player, player2, card};
    }

    it('the owner\'s own raise pays 2 M€ per step', () => {
      const {game, player} = owned();
      game.increaseVenusScaleLevel(player, 1);
      expect(player.megaCredits).eq(2);
    });

    it('the World Government\'s Solar Phase step pays too (outside the reward gate)', () => {
      const {game, player, player2} = owned();
      game.phase = Phase.SOLAR;
      game.increaseVenusScaleLevel(player2, 1);
      expect(player.megaCredits).eq(2);
    });

    it('an unrewarded world move pays too (RX12 Gas Export parity)', () => {
      const {game, player, player2} = owned();
      game.increaseVenusScaleLevel(player2, 2, {unrewarded: true});
      expect(player.megaCredits).eq(4);
    });

    it('at 28 % a raise «by 2» pays one step; at 30 % nothing; a lowering nothing', () => {
      const {game, player, player2} = owned();
      setVenusScaleLevel(game, 28);
      game.increaseVenusScaleLevel(player2, 2);
      expect(player.megaCredits).eq(2);
      game.increaseVenusScaleLevel(player2, 1);
      expect(player.megaCredits).eq(2);
      setVenusScaleLevel(game, 10);
      game.increaseVenusScaleLevel(player2, -1);
      expect(player.megaCredits).eq(2);
    });

    it('the payout records as the OWNER\'s effect under a foreign raise, and publishes the scene\'s record', () => {
      const {game, player, player2} = owned();
      setVenusScaleLevel(game, 6);
      game.increaseVenusScaleLevel(player2, 1);
      const fired = game.events.events.filter((e) => e.type === 'effect-triggered' && e.source !== undefined && 'card' in e.source && e.source.card === CardName.APHRODITE);
      expect(fired.map((e) => [e.player, e.trigger])).deep.eq([[player.color, 'global-parameter']]);
      expect(game.scaleStepRewards.at(-1)).deep.include({
        parameter: GlobalParameter.VENUS, steps: 1, before: 6, after: 8, owner: player.color, card: CardName.APHRODITE,
        gain: {kind: 'stock', resource: Resource.MEGACREDITS, amount: 2}, by: player2.color,
      });
    });

    it('the forecast twin: a Venus play promises the owner 2 M€ per step — at 28 % one step', () => {
      const {game, player, player2} = owned();
      player2.megaCredits = 40;
      const asteroid = new SpinInducingAsteroid();
      player2.cardsInHand.push(asteroid);
      const factsOf = () => effectForecastForPlay(player2, asteroid, cardPlayPreview(player2, asteroid)).facts
        .filter((f) => f.source.name === CardName.APHRODITE);
      const facts = factsOf();
      expect(facts).has.length(1);
      expect(facts[0]).deep.include({certainty: 'exact', recipient: {kind: 'player', color: player.color}});
      expect(facts[0].effects[0]).deep.include({direction: 'gain', icon: Resource.MEGACREDITS, amount: 4});
      setVenusScaleLevel(game, 28);
      expect(factsOf()[0].effects[0]).deep.include({amount: 2});
    });
  });
});
