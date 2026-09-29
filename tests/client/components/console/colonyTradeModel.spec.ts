import {expect} from 'chai';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {
  benefitCardCount, benefitTransferSpec, colonyTradeHeldSpecs, incomeTransferSpecs,
  ownBonusTransferSpecs, revealWaveForIndex, trackAdvancePlan, trackGlidePlan, trackWavePlan, TRACK_WAVE_BREATH_MS, TRACK_WAVE_READ_MS, TRACK_WAVE_STAGGER_MS, TRADE_COVER_STAGGER_MS,
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

  /**
   * A grant over SEVERAL kinds (the Redux Vesta's «mechs, asteroids or
   * fighters») flies as the CHOSEN card's own kind — the card decided what
   * landed, so the chip wears that; the first of the tile's list would be a
   * lie two times out of three. Without a known target there is no flight,
   * exactly as a one-kind grant with no host stays out of the air.
   */
  it('a grant over several kinds flies as the target card\'s own kind — never the first of the list', () => {
    const grant = {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 2, cardResources: [CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER]};
    expect(benefitTransferSpec(grant, CardName.SECURITY_FLEET, 'Fighter'))
      .deep.eq({channel: 'card-resource', resource: 'fighter', amount: 2, targetCard: CardName.SECURITY_FLEET});
    expect(benefitTransferSpec(grant, CardName.SECURITY_FLEET), 'no kind known → no flight').eq(undefined);
    expect(benefitTransferSpec(grant, undefined, 'Fighter'), 'no target → no flight').eq(undefined);
    const m = manifest({tradeIncome: grant});
    expect(incomeTransferSpecs(m, {incomeTargetCard: CardName.SECURITY_FLEET, incomeTargetResource: 'fighter'}))
      .deep.eq([{channel: 'card-resource', resource: 'fighter', amount: 2, targetCard: CardName.SECURITY_FLEET}]);
    expect(incomeTransferSpecs(m, {incomeTargetCard: CardName.SECURITY_FLEET})).deep.eq([]);
    // Per-cube bonuses read their own targets' kinds, index-aligned.
    const b = manifest({colonyBonus: {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResources: [CardResource.MECH, CardResource.ASTEROID]}});
    expect(ownBonusTransferSpecs(b, 'red', {bonusTargetCards: [CardName.EVA_MECHS, CardName.ASTEROID_HOLLOWING], bonusTargetResources: ['mech', 'asteroid']}).map((s) => s.resource))
      .deep.eq(['mech', 'asteroid']);
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
    // ONE CONTINUOUS DEAL: the bonus wave's first departure continues the
    // cadence — one stagger + the wave breath after the last income departure
    // (its fan overlaps the income flight; the lead cancels out).
    const bonusStart = 2 * TRADE_COVER_STAGGER_MS + TRADE_WAVE_GAP_MS;
    expect(plan[2].fanDelayMs).eq(bonusStart);
    expect(plan[2].delayMs).eq(bonusStart + TRADE_FAN_LEAD_MS);
    expect(plan[2].delayMs - plan[1].delayMs).eq(TRADE_COVER_STAGGER_MS + TRADE_WAVE_GAP_MS);
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

  it('the ADVANCE steps RIGHT to the position the reward is read at', () => {
    // «Торговая колония»: one offset card = one step, before the trade.
    const one = trackAdvancePlan(1, 2)!;
    expect(one.path).deep.eq([2]);
    expect(one.from).eq(1);
    expect(one.to).eq(2);
    // SEVERAL offset cards are ONE summed move: the destination is the
    // server's own post-advance position (the manifest's
    // `preTradeTrackPosition`), so the client never adds card behaviours up.
    const many = trackAdvancePlan(1, 4)!;
    expect(many.path).deep.eq([2, 3, 4]);
    expect(many.perCellMs).to.be.greaterThan(0);
    // No advance (no offset card, or a capped track) → no invented motion.
    expect(trackAdvancePlan(3, 3)).eq(undefined);
    expect(trackAdvancePlan(3, 2)).eq(undefined);
  });

  /*
   * THE WAVE (Unity Budget, RX29): the advance leg for EVERY tile in turn —
   * the scene breathes, the tiles start one after another in the table's
   * order, each marker's two steps are countable, a track at its end gets a
   * leg with NO cells (named, never moved), and the plan's length ends with
   * the read. The short form keeps the order and shortens the waits.
   */
  it('the WAVE: a breath, a stagger in the table\'s order, two countable steps per tile, an empty leg for a track at its end, the read at the end', () => {
    const plan = trackWavePlan([
      {colony: ColonyName.LUNA, before: 2, after: 4},
      {colony: ColonyName.CALLISTO, before: 5, after: 6},
      {colony: ColonyName.IO, before: 6, after: 6},
    ], {reduced: false});
    expect(plan.legs.map((leg) => leg.colony)).deep.eq([ColonyName.LUNA, ColonyName.CALLISTO, ColonyName.IO]);
    const [luna, callisto, io] = plan.legs;
    expect(luna.path, 'two steps, cell by cell').deep.eq([3, 4]);
    expect(callisto.path, 'one honest step to the end').deep.eq([6]);
    expect(io.path, 'a track at its end: no cell to step to').deep.eq([]);
    expect(luna.startAtMs, 'the scene breathes first').eq(TRACK_WAVE_BREATH_MS);
    expect(callisto.startAtMs - luna.startAtMs, 'one tile after another').eq(TRACK_WAVE_STAGGER_MS);
    expect(io.startAtMs - callisto.startAtMs).eq(TRACK_WAVE_STAGGER_MS);
    expect(luna.pauseMs, 'a rest between the two steps').to.be.greaterThan(0);
    expect(luna.perCellMs).to.be.greaterThan(0);
    // The plan ends after the LAST landing plus the read — never before the longest leg is over.
    const lunaEnd = luna.startAtMs + 260 + 2 * luna.perCellMs + luna.pauseMs + 180;
    expect(plan.totalMs).to.be.greaterThanOrEqual(lunaEnd + TRACK_WAVE_READ_MS);
    expect(plan.totalMs).to.be.greaterThanOrEqual(io.startAtMs + TRACK_WAVE_READ_MS);
    // The short form: the same order, shorter waits.
    const short = trackWavePlan([{colony: ColonyName.LUNA, before: 2, after: 4}, {colony: ColonyName.CERES, before: 1, after: 3}], {reduced: true});
    expect(short.legs.map((leg) => leg.colony)).deep.eq([ColonyName.LUNA, ColonyName.CERES]);
    expect(short.legs[0].startAtMs).to.be.lessThan(TRACK_WAVE_BREATH_MS);
    expect(short.legs[1].startAtMs - short.legs[0].startAtMs).to.be.lessThan(TRACK_WAVE_STAGGER_MS);
    expect(short.totalMs).to.be.lessThan(plan.totalMs);
    // An empty table plans nothing but the breath and the read.
    expect(trackWavePlan([], {reduced: false}).legs).deep.eq([]);
  });
});
