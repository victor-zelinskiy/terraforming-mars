import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {Payment} from '@/common/inputs/Payment';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {AdvancedAlloys} from '@/server/cards/base/AdvancedAlloys';
import {RegoPlastics} from '@/server/cards/promo/RegoPlastics';
import {TradingColony} from '@/server/cards/colonies/TradingColony';
import {CryoSleep} from '@/server/cards/colonies/CryoSleep';
import {Helion} from '@/server/cards/corporation/Helion';
import {TopsoilContract} from '@/server/cards/promo/TopsoilContract';
import {MeatIndustry} from '@/server/cards/promo/MeatIndustry';
import {MonsInsurance} from '@/server/cards/promo/MonsInsurance';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {Birds} from '@/server/cards/base/Birds';
import {EcoLine} from '@/server/cards/corporation/EcoLine';
import {ConvertPlants} from '@/server/cards/base/standardActions/ConvertPlants';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {Ceres} from '@/server/colonies/Ceres';
import {TradeWithEnergy} from '@/server/player/Colonies';
import {GlobalParameter} from '@/common/GlobalParameter';
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

  describe('colony trade discount (Cryo-Sleep paying fewer resources)', () => {
    it('records the trade resources saved, attributed to Cryo-Sleep', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      const ceres = new Ceres();
      game.colonies = [ceres];
      player.playedCards.push(new CryoSleep());
      player.colonies.tradeDiscount = 1; // what playing Cryo-Sleep grants
      player.energy = 6;

      game.events.beginAction(player, {kind: 'colony', name: ceres.name}, {category: 'colony'});
      new TradeWithEnergy(player).trade(ceres); // base energy cost 3 → pays 2, saves 1
      game.events.endScope();
      runAllActions(game);

      const ev = game.events.events.find((e) => e.impact.tradeDiscountSaved !== undefined);
      expect(ev, 'a trade-discount event was recorded').to.not.be.undefined;
      expect(ev!.source).to.deep.eq({kind: 'card', card: CardName.CRYO_SLEEP, owner: player.color});
      expect(ev!.tags).to.contain('trade-discount');
      expect(ev!.impact.tradeDiscountSaved).to.deep.eq([
        {colony: ColonyName.CERES, resource: 'energy', amount: 1},
      ]);

      const stats = aggregateBySource(game.events.events);
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'card', card: CardName.CRYO_SLEEP, owner: player.color}))!);
      expect(stat.tradeDiscount.energy).to.eq(1);
      expect(stat.tradeDiscount.count).to.eq(1);
      expect(stat.tradeDiscount.colonies[ColonyName.CERES]).to.eq(1);
    });
  });

  describe('heat-as-M€ payment (Helion)', () => {
    it('records heat spent as M€ as a passive-effect saving attributed to Helion', () => {
      const [game, player] = testGame(2);
      const helion = new Helion();
      helion.play(player); // sets canUseHeatAsMegaCredits
      player.playedCards.push(helion);
      player.heat = 7;

      game.events.beginAction(player, {kind: 'corporation', card: CardName.HELION, owner: player.color}, {category: 'corporation-action'});
      game.events.withSource({kind: 'payment'}, () => player.pay(Payment.of({heat: 5})));
      game.events.endScope();
      runAllActions(game);

      const ev = game.events.events.find((e) =>
        e.impact.megacreditsSaved !== undefined &&
        e.source?.kind === 'corporation' && e.source.card === CardName.HELION);
      expect(ev, 'a heat-as-M€ saving event was recorded').to.not.be.undefined;
      expect(ev!.impact.megacreditsSaved).to.eq(5);
      expect(ev!.tags).to.contain('passive-effect');
      expect(ev!.tags).to.contain('resource-payment');

      // It aggregates into the effect-overlay stat so the ability no longer reads
      // as "hasn't triggered yet".
      const stats = aggregateBySource(game.events.events.filter((e) => e.tags?.includes('passive-effect') === true));
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'corporation', card: CardName.HELION, owner: player.color}))!);
      expect(stat.megacreditsSaved).to.eq(5);
    });

    it('does not record when no heat is used as payment', () => {
      const [game, player] = testGame(2);
      const helion = new Helion();
      helion.play(player);
      player.playedCards.push(helion);
      player.megaCredits = 10;

      game.events.beginAction(player, {kind: 'corporation', card: CardName.HELION, owner: player.color}, {category: 'corporation-action'});
      game.events.withSource({kind: 'payment'}, () => player.pay(Payment.of({megacredits: 5})));
      game.events.endScope();
      runAllActions(game);

      const ev = game.events.events.find((e) =>
        e.impact.megacreditsSaved !== undefined &&
        e.source?.kind === 'corporation' && e.source.card === CardName.HELION);
      expect(ev, 'no heat-as-M€ event when paying with M€').to.be.undefined;
    });
  });

  describe('onResourceAdded passive effects (wrapped in an effect scope)', () => {
    it('TopsoilContract records +1 M€ per microbe, attributed as a passive effect', () => {
      const [game, player] = testGame(2);
      const topsoil = new TopsoilContract();
      player.playedCards.push(topsoil);
      const tardigrades = new Tardigrades();
      player.playedCards.push(tardigrades);

      player.addResourceTo(tardigrades, 3); // 3 microbes → TopsoilContract grants +3 M€
      runAllActions(game);

      const ev = game.events.events.find((e) =>
        e.impact.stock?.megacredits === 3 &&
        e.source?.card === CardName.TOPSOIL_CONTRACT);
      expect(ev, 'TopsoilContract gain recorded under its effect').to.not.be.undefined;
      expect(ev!.tags).to.contain('passive-effect');

      const stats = aggregateBySource(game.events.events.filter((e) => e.tags?.includes('passive-effect') === true));
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'card', card: CardName.TOPSOIL_CONTRACT, owner: player.color}))!);
      expect(stat.stock.megacredits).to.eq(3);
    });

    it('MeatIndustry records +2 M€ per animal, attributed as a passive effect', () => {
      const [game, player] = testGame(2);
      const meat = new MeatIndustry();
      player.playedCards.push(meat);
      const birds = new Birds();
      player.playedCards.push(birds);

      player.addResourceTo(birds, 2); // 2 animals → MeatIndustry grants +4 M€
      runAllActions(game);

      const stats = aggregateBySource(game.events.events.filter((e) => e.tags?.includes('passive-effect') === true));
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'card', card: CardName.MEAT_INDUSTRY, owner: player.color}))!);
      expect(stat.stock.megacredits).to.eq(4);
    });
  });

  describe('MonsInsurance compensation (attributed to the owner effect)', () => {
    it('records the M€ paid out as a passive effect on the owner', () => {
      const [game, owner, attacker] = testGame(2);
      const mons = new MonsInsurance();
      mons.play(owner);
      owner.playedCards.push(mons);
      game.monsInsuranceOwner = owner;
      owner.megaCredits = 10;

      // An attack on the attacker triggers the owner's compensation to a victim.
      // Simulate the resolution directly: the victim (attacker here) claims.
      game.events.beginAction(attacker, {kind: 'card', card: CardName.MEAT_INDUSTRY, owner: attacker.color}, {category: 'card-play'});
      attacker.resolveInsurance();
      game.events.endScope();
      runAllActions(game);

      const ev = game.events.events.find((e) =>
        e.source?.card === CardName.MONS_INSURANCE &&
        e.impact.stock?.megacredits === -3);
      expect(ev, 'owner payout recorded under MonsInsurance effect').to.not.be.undefined;
      expect(ev!.tags).to.contain('passive-effect');

      // No cancellation: the victim's +3 is NOT attributed to MonsInsurance.
      const stats = aggregateBySource(game.events.events.filter((e) => e.tags?.includes('passive-effect') === true));
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'corporation', card: CardName.MONS_INSURANCE, owner: owner.color}))!);
      expect(stat.stock.megacredits).to.eq(-3);
    });
  });

  describe('greenery discount (EcoLine paying fewer plants)', () => {
    it('records the plants saved on a conversion, attributed to EcoLine', () => {
      const [game, player] = testGame(2);
      const ecoline = new EcoLine();
      player.playedCards.push(ecoline);
      player.plantsNeededForGreenery = 7; // EcoLine discount active (8 → 7)
      player.plants = 9;

      const convert = new ConvertPlants();
      const selectSpace = cast(convert.action(player), SelectSpace);
      selectSpace.cb(selectSpace.spaces[0]);
      runAllActions(game);

      const ev = game.events.events.find((e) =>
        e.impact.greeneryDiscountSaved !== undefined &&
        e.source?.card === CardName.ECOLINE);
      expect(ev, 'a greenery-discount event was recorded').to.not.be.undefined;
      expect(ev!.impact.greeneryDiscountSaved).to.eq(1); // 8 − 7
      expect(ev!.tags).to.contain('passive-effect');
      expect(ev!.tags).to.contain('greenery-discount');

      const stats = aggregateBySource(game.events.events.filter((e) => e.tags?.includes('passive-effect') === true));
      const stat = toEffectOverlayStat(stats.get(sourceKey({kind: 'corporation', card: CardName.ECOLINE, owner: player.color}))!);
      expect(stat.greeneryDiscount.plants).to.eq(1);
      expect(stat.greeneryDiscount.count).to.eq(1);
    });
  });

  describe('global-parameter-changed recorder path', () => {
    it('records who raised a global parameter, attributed to the active scope source', () => {
      const [game, player] = testGame(2);
      game.events.beginAction(player, {kind: 'card', card: CardName.ADVANCED_ALLOYS, owner: player.color}, {category: 'card-play'});
      game.increaseOxygenLevel(player, 2);
      game.increaseTemperature(player, 1);
      game.events.endScope();

      const oxygen = game.events.events.find((e) => e.type === 'global-parameter-changed' &&
        e.impact.globalParameter?.parameter === GlobalParameter.OXYGEN);
      expect(oxygen, 'oxygen raise recorded').to.not.be.undefined;
      expect(oxygen!.impact.globalParameter!.steps).to.eq(2);
      expect(oxygen!.source).to.deep.eq({kind: 'card', card: CardName.ADVANCED_ALLOYS, owner: player.color});
      expect(oxygen!.tags).to.contain('global-parameter');

      // It aggregates into the source's globalParameterSteps (the "who terraformed" feed).
      const stats = aggregateBySource(game.events.events);
      const stat = stats.get(sourceKey({kind: 'card', card: CardName.ADVANCED_ALLOYS, owner: player.color}))!;
      expect(stat.globalParameterSteps[GlobalParameter.OXYGEN]).to.eq(2);
    });
  });
});
