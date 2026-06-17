import {expect} from 'chai';
import {Units} from '@/common/Units';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {getActionUsageSummary} from '@/client/components/actions/actionUsageSummary';

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
});
