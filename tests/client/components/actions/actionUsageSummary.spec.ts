import {expect} from 'chai';
import {Units} from '@/common/Units';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {getActionUsageSummary, branchMetricTokens} from '@/client/components/actions/actionUsageSummary';
import {ActionEffect} from '@/common/models/ActionPreviewModel';

/**
 * PURE view-model for the ДЕЙСТВИЯ overlay's "this game" usage summary. No Vue deps,
 * so it runs under the server runner like `effectSummary.spec`.
 */
function stat(overrides: Partial<EffectOverlayStat>): EffectOverlayStat {
  return {
    sourceKey: 'card:Test',
    kind: 'card',
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: Units.of({}),
    production: Units.of({}),
    cardResources: {},
    paymentResources: {},
    paymentValueBonus: {steel: 0, titanium: 0, bonusValue: 0, count: 0},
    colonyTrack: {steps: 0, extraReward: 0, count: 0, colonies: {}},
    tradeDiscount: {energy: 0, titanium: 0, megacredits: 0, count: 0, colonies: {}},
    greeneryDiscount: {plants: 0, count: 0},
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
    ...overrides,
  };
}

describe('action usage summary view-model', () => {
  it('an unused action shows a "not used yet" note, never a dead state', () => {
    const vm = getActionUsageSummary(undefined);
    expect(vm.empty).to.be.true;
    expect(vm.activations).to.eq(0);
    expect(vm.note).to.not.be.undefined;
  });

  it('a resource-gain action shows activations + what it produced', () => {
    const vm = getActionUsageSummary(stat({triggerCount: 3, stock: Units.of({plants: 6})}));
    expect(vm.empty).to.be.false;
    expect(vm.activations).to.eq(3);
    expect(vm.kind).to.eq('resource');
    expect(vm.headline).to.eq('Resources gained');
    expect(vm.lines).to.deep.include({icon: 'plants', label: 'Gained', value: '+6'});
    expect(vm.confidence).to.eq('exact');
  });

  it('a draw action is classified as draw', () => {
    const vm = getActionUsageSummary(stat({triggerCount: 4, cardsDrawn: 8}));
    expect(vm.kind).to.eq('draw');
    expect(vm.headline).to.eq('Cards drawn');
    expect(vm.lines).to.deep.include({icon: 'cards', label: 'Cards drawn', value: '+8'});
  });

  it('a spend → gain action is classified as a conversion', () => {
    const vm = getActionUsageSummary(stat({triggerCount: 2, stock: Units.of({heat: -8, energy: 4})}));
    expect(vm.kind).to.eq('conversion');
    expect(vm.headline).to.eq('Conversions');
  });

  it('a parameter-raising action is classified as terraforming', () => {
    const vm = getActionUsageSummary(stat({triggerCount: 1, tr: 1, globalParameterSteps: {temperature: 1} as any}));
    expect(vm.kind).to.eq('terraform');
    expect(vm.headline).to.eq('Terraforming');
  });

  it('an action with only activations (no measurable impact) is rule-only', () => {
    const vm = getActionUsageSummary(stat({triggerCount: 2, lastTrigger: {generation: 5, impact: {}}}));
    expect(vm.empty).to.be.false; // it WAS used
    expect(vm.kind).to.eq('usage');
    expect(vm.confidence).to.eq('ruleOnly');
    expect(vm.lastGeneration).to.eq(5);
  });

  it('surfaces the victim breakdown of an attack action', () => {
    const vm = getActionUsageSummary(stat({
      triggerCount: 2,
      victims: [{color: 'blue', hits: 2, totalLost: 4, resources: {plants: 4}}],
    }));
    expect(vm.victims).to.have.length(1);
    expect(vm.victims[0].color).to.eq('blue');
    expect(vm.victims[0].resources.plants).to.eq(4);
  });

  it('defaults victims to an empty list for a non-attack action', () => {
    expect(getActionUsageSummary(stat({triggerCount: 1, cardsDrawn: 2})).victims).to.have.length(0);
  });

  describe('per-branch filtering (Red Spot Observatory shape)', () => {
    // The whole-card aggregate folds BOTH the "add a floater" and "spend a floater
    // to draw" outcomes onto one stat. Each branch's details must show only ITS own.
    const addEffects: ReadonlyArray<ActionEffect> = [
      {direction: 'gain', icon: 'floater', amount: 1, note: 'on this card'},
    ];
    const drawEffects: ReadonlyArray<ActionEffect> = [
      {direction: 'cost', icon: 'floater', amount: 1, note: 'on this card'},
      {direction: 'gain', icon: 'cards', amount: 1, note: 'draw'},
    ];
    const mixedStat = stat({triggerCount: 3, cardResources: {floater: 2}, cardsDrawn: 4});

    it('maps branch effects to metric tokens (a card-resource COST does not claim "Added")', () => {
      expect(branchMetricTokens(addEffects)).to.deep.eq(['cardres:floater']);
      expect(branchMetricTokens(drawEffects)).to.deep.eq(['cards']);
    });

    it('the ADD branch shows only floaters added, never cards drawn', () => {
      const vm = getActionUsageSummary(mixedStat, {mineTokens: ['cardres:floater'], siblingTokens: ['cards']});
      expect(vm.lines).to.deep.eq([{icon: 'floater', label: 'Added', value: '+2'}]);
      expect(vm.kind).to.eq('resource');
      expect(vm.cardScoped).to.be.true;
    });

    it('the DRAW branch shows only cards drawn, never floaters added', () => {
      const vm = getActionUsageSummary(mixedStat, {mineTokens: ['cards'], siblingTokens: ['cardres:floater']});
      expect(vm.lines).to.deep.eq([{icon: 'cards', label: 'Cards drawn', value: '+4'}]);
      expect(vm.kind).to.eq('draw');
      expect(vm.cardScoped).to.be.true;
    });

    it('a single-branch action (no siblings) is never filtered or card-scoped', () => {
      const vm = getActionUsageSummary(mixedStat);
      expect(vm.lines).to.have.length(2);
      expect(vm.cardScoped).to.be.undefined;
    });
  });

  describe('per-branch filtering (BioPrinting Facility shape: plants OR add-to-a-card)', () => {
    // BioPrinting's two branches: "gain 2 plants" (stock) and "add 1 animal to
    // ANOTHER card" (`to a card`). The aggregate folds plants gained + animals added
    // onto one stat; each branch's details must show only ITS own metric.
    const plantsEffects: ReadonlyArray<ActionEffect> = [
      {direction: 'cost', icon: 'energy', amount: 2},
      {direction: 'gain', icon: 'plants', amount: 2},
    ];
    const animalEffects: ReadonlyArray<ActionEffect> = [
      {direction: 'cost', icon: 'energy', amount: 2},
      {direction: 'gain', icon: 'animal', amount: 1, note: 'to a card'},
    ];
    const mixedStat = stat({triggerCount: 5, stock: Units.of({plants: 6, energy: -10}), cardResources: {animal: 3}});

    it('an "add to a card" gain claims the cardres token (so the sibling filter works)', () => {
      // The fix: `to a card` (add to ANOTHER card) maps to `cardres:animal`, matching
      // the aggregate's net "Added" line — else it leaked onto the plants branch.
      expect(branchMetricTokens(animalEffects)).to.include('cardres:animal');
      expect(branchMetricTokens(plantsEffects)).to.include('plants');
    });

    it('the PLANTS branch shows plants gained, never the animals added', () => {
      const mine = branchMetricTokens(plantsEffects);
      const sibling = branchMetricTokens(animalEffects);
      const vm = getActionUsageSummary(mixedStat, {mineTokens: mine, siblingTokens: sibling});
      expect(vm.lines.some((l) => l.icon === 'plants' && l.label === 'Gained')).to.be.true;
      expect(vm.lines.some((l) => l.label === 'Added'), 'no animal "Added" line on the plants branch').to.be.false;
      expect(vm.cardScoped).to.be.true;
    });

    it('the ANIMAL branch shows the animals added, never the plants gained', () => {
      const mine = branchMetricTokens(animalEffects);
      const sibling = branchMetricTokens(plantsEffects);
      const vm = getActionUsageSummary(mixedStat, {mineTokens: mine, siblingTokens: sibling});
      expect(vm.lines.some((l) => l.icon === 'animal' && l.label === 'Added')).to.be.true;
      expect(vm.lines.some((l) => l.icon === 'plants' && l.label === 'Gained'), 'no plants line on the animal branch').to.be.false;
      expect(vm.cardScoped).to.be.true;
    });
  });
});
