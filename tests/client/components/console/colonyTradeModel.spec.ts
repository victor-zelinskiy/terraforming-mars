import {expect} from 'chai';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {
  benefitCardCount, benefitTransferSpec, colonyTradeHeldSpecs, incomeTransferSpecs,
  ownBonusTransferSpecs, trackGlidePlan, TRADE_COVER_STAGGER_MS, TRADE_WAVE_GAP_MS,
  tradeCoverPlan, tradeCoverPlanBudgetMs, viewerBonusCubes,
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

  it('the cover plan launches income first, then the bonus wave after a readable gap', () => {
    const plan = tradeCoverPlan(4, [{role: 'income', count: 2}, {role: 'bonus', count: 2}]);
    expect(plan.map((p) => p.index)).deep.eq([0, 1, 2, 3]);
    expect(plan.map((p) => p.role)).deep.eq(['income', 'income', 'bonus', 'bonus']);
    expect(plan[0].delayMs).eq(0);
    expect(plan[1].delayMs).eq(TRADE_COVER_STAGGER_MS);
    const bonusStart = TRADE_COVER_STAGGER_MS + TRADE_WAVE_GAP_MS;
    expect(plan[2].delayMs).eq(bonusStart);
    expect(plan[3].delayMs).eq(bonusStart + TRADE_COVER_STAGGER_MS);
    expect(tradeCoverPlanBudgetMs(plan)).to.be.greaterThan(plan[3].delayMs);
  });

  it('a segment-less batch reads all-income; counts clamp to the real cards', () => {
    const plan = tradeCoverPlan(2, undefined);
    expect(plan.map((p) => p.role)).deep.eq(['income', 'income']);
    // A deck that ran short: segments promise more than the batch holds.
    const short = tradeCoverPlan(1, [{role: 'income', count: 3}]);
    expect(short).has.lengthOf(1);
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
