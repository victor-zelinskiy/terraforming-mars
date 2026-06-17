import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {Payment} from '@/common/inputs/Payment';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {AdvancedAlloys} from '@/server/cards/base/AdvancedAlloys';
import {RegoPlastics} from '@/server/cards/promo/RegoPlastics';
import {TradingColony} from '@/server/cards/colonies/TradingColony';
import {Ceres} from '@/server/colonies/Ceres';
import {aggregateBySource, toEffectOverlayStat} from '@/common/events/aggregate';
import {sourceKey} from '@/common/events/EventSource';

/**
 * Foundation guard for the EVENT/STAT framework's economic special-handlers:
 *  - steel/titanium VALUE modifiers (Advanced Alloys / Rego Plastics / …) record the
 *    EXACT extra M€ value contributed, attributed to the OWNING card;
 *  - a trade-offset effect (Trading Colony) records the EXACT colony-track steps it
 *    advanced + the extra trade-reward units.
 *
 * These used to show the generic "passive rule" fallback; now they write structured
 * GameEvents that the effects overlay (and a future endgame analyzer) can read.
 */
describe('Economic stat special-handlers', () => {
  describe('payment-value modifier (steel/titanium worth more)', () => {
    it('Advanced Alloys records the extra M€ value of spent steel AND titanium', () => {
      const [game, player] = testGame(2);
      const aa = new AdvancedAlloys();
      aa.play(player); // applies steelValue +1 and titaniumValue +1
      player.playedCards.push(aa);
      player.steel = 4;
      player.titanium = 3;

      game.events.beginAction(player, {kind: 'card', card: CardName.ADVANCED_ALLOYS}, {category: 'card-play'});
      player.pay(Payment.of({steel: 4, titanium: 3}));
      game.events.endScope();

      const ev = game.events.events.find((e) => e.impact.paymentValueBonus !== undefined);
      expect(ev, 'a payment-bonus event was recorded').to.not.be.undefined;
      expect(ev!.source).to.deep.eq({kind: 'card', card: CardName.ADVANCED_ALLOYS, owner: player.color});
      expect(ev!.tags).to.contain('passive-effect');
      expect(ev!.tags).to.contain('payment-bonus');
      // +1 per steel × 4 spent + 1 per titanium × 3 spent.
      expect(ev!.impact.paymentValueBonus).to.deep.eq([
        {resource: 'steel', amountSpent: 4, bonusValue: 4},
        {resource: 'titanium', amountSpent: 3, bonusValue: 3},
      ]);
    });

    it('aggregates into the effect-overlay stat (extra value + spent under effect)', () => {
      const [game, player] = testGame(2);
      const rego = new RegoPlastics(); // steel value +1 only
      rego.play(player);
      player.playedCards.push(rego);
      player.steel = 5;

      game.events.beginAction(player, {kind: 'card', card: CardName.REGO_PLASTICS}, {category: 'card-play'});
      player.pay(Payment.of({steel: 5}));
      game.events.endScope();

      const stats = aggregateBySource(game.events.events);
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'card', card: CardName.REGO_PLASTICS, owner: player.color}))!);
      expect(stat.paymentValueBonus.steel).to.eq(5);
      expect(stat.paymentValueBonus.titanium).to.eq(0);
      expect(stat.paymentValueBonus.bonusValue).to.eq(5);
      expect(stat.paymentValueBonus.count).to.eq(1);
    });

    it('records nothing when the resource is not worth more than base', () => {
      const [game, player] = testGame(2);
      player.steel = 4; // no value-modifier card in play → base value
      game.events.beginAction(player, {kind: 'card', card: CardName.ADVANCED_ALLOYS}, {category: 'card-play'});
      player.pay(Payment.of({steel: 4}));
      game.events.endScope();
      expect(game.events.events.some((e) => e.impact.paymentValueBonus !== undefined)).to.be.false;
    });
  });

  describe('colony-track bonus (Trading Colony advancing a track before trade)', () => {
    it('records the track steps + exact extra reward, attributed to Trading Colony', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      const ceres = new Ceres(); // trade quantity [1,2,3,4,6,8,10] steel; auto-increases
      game.colonies = [ceres];
      const tc = new TradingColony();
      player.playedCards.push(tc);
      player.colonies.tradeOffset = 1; // what playing Trading Colony grants

      // trackPosition starts at 1 → +1 step → position 2; extra reward = q[2]−q[1] = 3−2 = 1.
      game.events.beginAction(player, {kind: 'colony', name: ceres.name}, {category: 'colony'});
      ceres.trade(player);
      game.events.endScope();
      runAllActions(game);

      const ev = game.events.events.find((e) => e.impact.colonyTrackAdvanced !== undefined);
      expect(ev, 'a colony-track event was recorded').to.not.be.undefined;
      expect(ev!.source).to.deep.eq({kind: 'card', card: CardName.TRADING_COLONY, owner: player.color});
      expect(ev!.tags).to.contain('passive-effect');
      expect(ev!.tags).to.contain('colony-track');
      expect(ev!.impact.colonyTrackAdvanced).to.deep.eq([
        {colony: ColonyName.CERES, steps: 1, extraReward: 1},
      ]);
    });

    it('aggregates into the effect-overlay colony-track stat (steps + per-colony breakdown)', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      const ceres = new Ceres();
      game.colonies = [ceres];
      player.playedCards.push(new TradingColony());
      player.colonies.tradeOffset = 1;

      game.events.beginAction(player, {kind: 'colony', name: ceres.name}, {category: 'colony'});
      ceres.trade(player);
      game.events.endScope();
      runAllActions(game);

      const stats = aggregateBySource(game.events.events);
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'card', card: CardName.TRADING_COLONY, owner: player.color}))!);
      expect(stat.colonyTrack.steps).to.eq(1);
      expect(stat.colonyTrack.extraReward).to.eq(1);
      expect(stat.colonyTrack.count).to.eq(1);
      expect(stat.colonyTrack.colonies[ColonyName.CERES]).to.eq(1);
    });
  });
});
