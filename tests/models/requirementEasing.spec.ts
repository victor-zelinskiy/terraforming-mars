import {expect} from 'chai';
import {testGame} from '../TestGame';
import {fakeCard, setOxygenLevel, setTemperature} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {RequirementType} from '../../src/common/cards/RequirementType';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {requirementEasingOf} from '../../src/server/models/requirementEasing';
import {unplayableReasons} from '../../src/server/models/unplayableReasons';
import {SpecialDesign} from '../../src/server/cards/base/SpecialDesign';
import {AdaptationTechnology} from '../../src/server/cards/base/AdaptationTechnology';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {ArchaeBacteria} from '../../src/server/cards/base/ArchaeBacteria';
import {Fish} from '../../src/server/cards/base/Fish';
import {Inventrix} from '../../src/server/cards/corporation/Inventrix';
import {MorningStarInc} from '../../src/server/cards/venusNext/MorningStarInc';
import {EcologyExperts} from '../../src/server/cards/prelude/EcologyExperts';
import {ThinkTank} from '../../src/server/cards/pathfinders/ThinkTank';
import {PartyHooks} from '../../src/server/turmoil/parties/PartyHooks';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';

/**
 * «REQUIREMENT UNDER A MODIFIER» (TR49 class) — the ONE per-card reading: the
 * modifiers named off the engine's own breakdown, printed → effective (or
 * waived), decisive when the card is playable ONLY thanks to them, and in
 * parity with the real `satisfies` and with `effectiveCount`.
 */
describe('requirementEasing', () => {
  it('no modifier → nothing to say (the face stays printed)', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -20);
    expect(requirementEasingOf(player, new LakeMarineris())).deep.eq([]);
  });

  it('a card with no global requirement has no easing, even with a modifier armed', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new SpecialDesign());
    expect(requirementEasingOf(player, fakeCard())).deep.eq([]);
  });

  it('an ARMED Special Design: ±2 named, one play, printed → effective, NOT decisive while still short', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -18);
    player.playCard(new SpecialDesign());
    const [easing] = requirementEasingOf(player, new LakeMarineris()); // requires 0 °C
    expect(easing).deep.eq({
      key: 'req:C',
      index: 0,
      type: RequirementType.TEMPERATURE,
      parameter: GlobalParameter.TEMPERATURE,
      max: false,
      printed: 0,
      effective: -4,
      current: -18,
      sources: [{source: {kind: 'card', card: CardName.SPECIAL_DESIGN, owner: player.color}, kind: 'shift', steps: 2, oneShot: true}],
      met: false,
      decisive: false,
    });
  });

  it('DECISIVE: Fish (+2 °C) at 0 °C is playable only thanks to the armed ±2', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -2);
    player.playCard(new SpecialDesign());
    const [easing] = requirementEasingOf(player, new Fish());
    expect(easing.met).is.true;
    expect(easing.decisive).is.true;
    expect(easing.effective).eq(-2);
  });

  it('a MAX bound stretches UP (Archae Bacteria ≤ −18 °C with Adaptation Technology: −14)', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -16);
    player.playedCards.push(new AdaptationTechnology());
    const [easing] = requirementEasingOf(player, new ArchaeBacteria());
    expect(easing.max).is.true;
    expect(easing.effective).eq(-14);
    expect(easing.sources[0]).deep.eq({source: {kind: 'card', card: CardName.ADAPTATION_TECHNOLOGY, owner: player.color}, kind: 'shift', steps: 2, oneShot: false});
    expect(easing.decisive).is.true;
  });

  it('modifiers stack and each is named, in the order the engine sums them (table order)', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -10);
    player.playedCards.push(new AdaptationTechnology());
    player.playedCards.push(new Inventrix());
    const [easing] = requirementEasingOf(player, new ArchaeBacteria());
    expect(easing.sources.map((s) => s.source.kind === 'card' || s.source.kind === 'corporation' ? s.source.card : '')).deep.eq([CardName.ADAPTATION_TECHNOLOGY, CardName.INVENTRIX]);
    expect(easing.sources[1].source.kind).eq('corporation');
    expect(easing.effective).eq(-10);
  });

  it('a modifier scoped to another parameter is not named (Morning Star vs temperature)', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -20);
    player.playedCards.push(new MorningStarInc());
    expect(requirementEasingOf(player, new LakeMarineris())).deep.eq([]);
  });

  it('PARITY with effectiveCount: the reason prints the bound the easing names', () => {
    const [game, player] = testGame(2);
    player.megaCredits = 50;
    setTemperature(game, -18);
    player.playCard(new SpecialDesign());
    const lake = new LakeMarineris();
    const reason = unplayableReasons(player, lake).find((r) => r.type === 'globalParameter');
    expect(reason?.effectiveCount).eq(requirementEasingOf(player, lake)[0].effective);
  });

  it('PARITY with satisfies: met ⇔ the real requirement check passes (no bridge in play)', () => {
    const [game, player] = testGame(2);
    player.playCard(new SpecialDesign());
    for (const temperature of [-10, -6, -4, -2, 0]) {
      setTemperature(game, temperature);
      const lake = new LakeMarineris();
      const [easing] = requirementEasingOf(player, lake);
      const satisfied = lake.canPlay(player);
      expect(easing.met, `at ${temperature} °C`).eq(satisfied);
    }
  });

  describe('the WAIVER — «ignore» is a kind, never a number', () => {
    it('an armed Ecology Experts waives every global requirement: effective «waived», met, decisive', () => {
      const [game, player] = testGame(2);
      setOxygenLevel(game, 0);
      player.playedCards.push(new EcologyExperts());
      player.lastCardPlayed = CardName.ECOLOGY_EXPERTS;
      const [easing] = requirementEasingOf(player, new Fish()); // +2 °C
      expect(easing.effective).eq('waived');
      expect(easing.met).is.true;
      expect(easing.decisive).is.true;
      expect(easing.sources).deep.eq([{source: {kind: 'card', card: CardName.ECOLOGY_EXPERTS, owner: player.color}, kind: 'waive', oneShot: true}]);
      // No sentinel anywhere: the bonus in steps is zero.
      expect(player.getGlobalParameterRequirementBonus(GlobalParameter.TEMPERATURE)).eq(0);
    });

    it('a shift beside a waiver is not named — the waiver alone decides this play', () => {
      const [game, player] = testGame(2);
      setTemperature(game, -30);
      player.playedCards.push(new AdaptationTechnology());
      player.playedCards.push(new EcologyExperts());
      player.lastCardPlayed = CardName.ECOLOGY_EXPERTS;
      const [easing] = requirementEasingOf(player, new LakeMarineris());
      expect(easing.sources.map((s) => s.kind)).deep.eq(['waive']);
    });

    it('a waived requirement spends NOTHING off Think Tank (the bridge is never asked)', () => {
      const [game, player] = testGame(2);
      setTemperature(game, -30);
      player.megaCredits = 50;
      const thinkTank = new ThinkTank();
      thinkTank.resourceCount = 10;
      player.playedCards.push(thinkTank);
      player.playedCards.push(new EcologyExperts());
      player.lastCardPlayed = CardName.ECOLOGY_EXPERTS;
      const lake = new LakeMarineris();
      expect(player.canPlay(lake)).is.true;
      expect(lake.additionalProjectCosts?.thinkTankResources).is.undefined;
    });

    it('the waiver is not a party, tag or production requirement waiver — only the global ones', () => {
      const [/* game */, player] = testGame(2);
      player.playedCards.push(new EcologyExperts());
      player.lastCardPlayed = CardName.ECOLOGY_EXPERTS;
      const card = fakeCard({requirements: [{production: Resource.ENERGY, count: 3}]});
      expect(requirementEasingOf(player, card)).deep.eq([]);
    });
  });

  it('RULE 12 — the classic Scientists sp02 policy never applies under the Turmoil Redux politics', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    expect(game.turmoil).is.undefined;
    expect(PartyHooks.shouldApplyPolicy(player, PartyName.SCIENTISTS, 'sp02')).is.false;
    expect(player.requirementBonusBreakdown(GlobalParameter.TEMPERATURE)).deep.eq([]);
  });
});
