import {expect} from 'chai';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {
  benefitCardCount, benefitTransferSpec, colonyTradeHeldSpecs, incomeTransferSpecs,
  ownBonusTransferSpecs, revealWaveForIndex, trackGlidePlan, TRADE_COVER_STAGGER_MS,
  TRADE_FAN_LEAD_MS, TRADE_FAN_STAGGER_MS, TRADE_WAVE_GAP_MS,
  tradeCoverPlan, tradeCoverPlanBudgetMs, tradeRoleForIndex, viewerBonusCubes,
} from '@/client/console/colonyTrade/colonyTradeModel';

function manifest(over: Partial<ColonyTradeManifestModel> = {}): ColonyTradeManifestModel {
  return {
    tradeId: 'Triton:g3:a120',
    colonyName: ColonyName.TRITON,
    trader: 'red',
    generation: 3,
    preTradeTrackPosition: 4,
    postTradeTrackPosition: 1,
    tradeIncome: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 3, resource: Resource.TITANIUM},
    colonyBonus: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 1, resource: Resource.TITANIUM},
    bonusRecipients: [{color: 'red', cubes: 2}, {color: 'blue', cubes: 1}],
    ...over,
  };
}

describe('colonyTradeModel', () => {
  it('maps grants to transfer specs (stock / production / card-resource / none)', () => {
    expect(benefitTransferSpec({benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 3, resource: Resource.TITANIUM}))
      .deep.eq({channel: 'stock', resource: 'titanium', amount: 3});
    expect(benefitTransferSpec({benefit: ColonyBenefit.GAIN_PRODUCTION, quantity: 1, resource: Resource.ENERGY}))
      .deep.eq({channel: 'production', resource: 'energy', amount: 1});
    expect(benefitTransferSpec({benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 2, cardResource: CardResource.FLOATER}, CardName.DIRIGIBLES))
      .deep.eq({channel: 'card-resource', resource: 'floater', amount: 2, targetCard: CardName.DIRIGIBLES});
    // Cards fly as covers, not chips; unexpressible benefits stay on the
    // ordinary commit chips (the honest degrade).
    expect(benefitTransferSpec({benefit: ColonyBenefit.DRAW_CARDS, quantity: 2})).eq(undefined);
    expect(benefitTransferSpec({benefit: ColonyBenefit.GAIN_TR, quantity: 1})).eq(undefined);
    expect(benefitTransferSpec({benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 0, resource: Resource.STEEL})).eq(undefined);
  });

  it('counts planned cards per grant', () => {
    expect(benefitCardCount({benefit: ColonyBenefit.DRAW_CARDS, quantity: 3})).eq(3);
    expect(benefitCardCount({benefit: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE, quantity: 1})).eq(1);
    expect(benefitCardCount({benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 3, resource: Resource.TITANIUM})).eq(0);
  });

  it('own colony bonuses come ONE SPEC PER CUBE (countable flights, never merged)', () => {
    const specs = ownBonusTransferSpecs(manifest(), 'red');
    expect(specs).deep.eq([
      {channel: 'stock', resource: 'titanium', amount: 1},
      {channel: 'stock', resource: 'titanium', amount: 1},
    ]);
    expect(viewerBonusCubes(manifest(), 'red')).eq(2);
    expect(viewerBonusCubes(manifest(), 'yellow')).eq(0);
    expect(ownBonusTransferSpecs(manifest(), 'yellow')).deep.eq([]);
  });

  it('per-cube card-resource bonuses land on the composer-picked host cards in order', () => {
    const m = manifest({
      colonyBonus: {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResource: CardResource.ANIMAL},
    });
    const specs = ownBonusTransferSpecs(m, 'red', {bonusTargetCards: [CardName.PETS, CardName.BIRDS]});
    expect(specs.map((s) => s.targetCard)).deep.eq([CardName.PETS, CardName.BIRDS]);
  });

  it('the reward hold seeds the viewer’s whole pending amount, merged per metric', () => {
    const held = colonyTradeHeldSpecs(manifest(), 'red');
    expect(held).deep.eq([{channel: 'stock', resource: 'titanium', amount: 5}]); // income 3 + 2 own cubes
    // A bonus recipient who is NOT the trader holds only their own cubes.
    expect(colonyTradeHeldSpecs(manifest(), 'blue')).deep.eq([{channel: 'stock', resource: 'titanium', amount: 1}]);
  });

  it('income specs are the trader’s only', () => {
    expect(incomeTransferSpecs(manifest())).deep.eq([{channel: 'stock', resource: 'titanium', amount: 3}]);
  });

  it('the cover plan fans each wave first, then departs income, then the bonus wave', () => {
    const plan = tradeCoverPlan(4, [{role: 'income', count: 2}, {role: 'bonus', count: 2}]);
    expect(plan.map((p) => p.index)).deep.eq([0, 1, 2, 3]);
    expect(plan.map((p) => p.role)).deep.eq(['income', 'income', 'bonus', 'bonus']);
    // The FAN leads: the wave's covers peel out one after another…
    expect(plan[0].fanDelayMs).eq(0);
    expect(plan[1].fanDelayMs).eq(TRADE_FAN_STAGGER_MS);
    expect(plan.map((p) => p.fanIndex)).deep.eq([0, 1, 0, 1]);
    expect(plan.map((p) => p.fanCount)).deep.eq([2, 2, 2, 2]);
    // …and the departures fire only past the fan lead.
    expect(plan[0].delayMs).eq(TRADE_FAN_LEAD_MS);
    expect(plan[1].delayMs).eq(TRADE_FAN_LEAD_MS + TRADE_COVER_STAGGER_MS);
    const bonusStart = TRADE_FAN_LEAD_MS + TRADE_COVER_STAGGER_MS + TRADE_WAVE_GAP_MS;
    expect(plan[2].fanDelayMs).eq(bonusStart);
    expect(plan[2].delayMs).eq(bonusStart + TRADE_FAN_LEAD_MS);
    expect(plan[3].delayMs).eq(bonusStart + TRADE_FAN_LEAD_MS + TRADE_COVER_STAGGER_MS);
    // Every departure happens after its own fan settled.
    for (const p of plan) {
      expect(p.delayMs).to.be.greaterThan(p.fanDelayMs);
    }
    expect(tradeCoverPlanBudgetMs(plan)).to.be.greaterThan(plan[3].delayMs);
  });

  it('a bonus-only batch fans from time zero (the wave gap belongs between waves)', () => {
    const plan = tradeCoverPlan(1, [{role: 'bonus', count: 1}]);
    expect(plan[0].fanDelayMs).eq(0);
    expect(plan[0].delayMs).eq(TRADE_FAN_LEAD_MS);
    expect(plan[0].fanCount).eq(1);
  });

  it('a segment-less batch reads all-income; counts clamp to the real cards', () => {
    const plan = tradeCoverPlan(2, undefined);
    expect(plan.map((p) => p.role)).deep.eq(['income', 'income']);
    // A deck that ran short: segments promise more than the batch holds.
    const short = tradeCoverPlan(1, [{role: 'income', count: 3}]);
    expect(short).has.lengthOf(1);
  });

  it('a bonus card leaves the strip ONLY when a zone will draw it', () => {
    const segments = [{role: 'income' as const, count: 1}, {role: 'bonus' as const, count: 1}];
    // ZONED (Pluto: the per-colony discard sequence renders the zones).
    expect(revealWaveForIndex(segments, 0, true)).eq('income');
    expect(revealWaveForIndex(segments, 1, true)).eq('bonus');
    // UNZONED (Miranda: a plain owner-bonus draw) — the bonus card is an
    // ordinary card of the payout. Splitting it out with nothing to receive
    // it is what rendered the card NOWHERE: no slot, no cover target, no take.
    expect(revealWaveForIndex(segments, 1, false)).eq('income');
  });

  it('maps a batch card index to its trade wave (the reveal’s bonus-zone grouping)', () => {
    const segments = [{role: 'income' as const, count: 2}, {role: 'bonus' as const, count: 2}];
    expect(tradeRoleForIndex(segments, 0)).eq('income');
    expect(tradeRoleForIndex(segments, 1)).eq('income');
    expect(tradeRoleForIndex(segments, 2)).eq('bonus');
    expect(tradeRoleForIndex(segments, 3)).eq('bonus');
    expect(tradeRoleForIndex(segments, 9)).eq('income'); // out of range → plain
    expect(tradeRoleForIndex(undefined, 0)).eq('income'); // no segments → no zone
    expect(tradeRoleForIndex([{role: 'bonus', count: 1}], 0)).eq('bonus'); // bonus-only batch
  });

  it('the track glide steps LEFT through every passed cell; no movement → no plan', () => {
    const plan = trackGlidePlan(4, 1)!;
    expect(plan.path).deep.eq([3, 2, 1]);
    expect(plan.from).eq(4);
    expect(plan.to).eq(1);
    expect(plan.perCellMs).to.be.greaterThan(0);
    expect(trackGlidePlan(2, 2)).eq(undefined);
    expect(trackGlidePlan(1, 2)).eq(undefined);
  });
});
