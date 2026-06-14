import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, addCity} from '../TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Units} from '@/common/Units';
import {Pets} from '@/server/cards/base/Pets';
import {effectOverlayStats, EffectOverlayStat} from '@/common/events/aggregate';
import {getEffectSummary, classifyEffect} from '@/client/components/effects/effectSummary';

function stat(overrides: Partial<EffectOverlayStat>): EffectOverlayStat {
  return {
    sourceKey: 'card:Test',
    kind: 'card',
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: Units.EMPTY,
    production: Units.EMPTY,
    cardResources: {},
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
    ...overrides,
  };
}

describe('effect summary view-model', () => {
  it('reports an empty state for an effect that never fired', () => {
    const vm = getEffectSummary(stat({card: CardName.EARTH_CATAPULT}), {sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card'});
    expect(vm.empty).to.be.true;
    expect(vm.triggerCount).to.eq(0);
  });

  it('builds generic impact lines from the aggregate', () => {
    const vm = getEffectSummary(
      stat({card: CardName.EARTH_CATAPULT, triggerCount: 12, megacreditsSaved: 24}),
      {sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card'});
    expect(vm.empty).to.be.false;
    expect(vm.triggerCount).to.eq(12);
    const saved = vm.lines.find((l) => l.label === 'Saved');
    expect(saved?.value).to.eq('24');
    expect(saved?.icon).to.eq('megacredits');
  });

  it('uses a bespoke summary for a registered card (Pharmacy Union)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PHARMACY_UNION, kind: 'corporation', triggerCount: 5, tr: 2, cardResources: {[CardResource.DISEASE]: 4}}),
      {sourceName: CardName.PHARMACY_UNION, sourceKind: 'corporation'});
    expect(vm.headline).to.eq('Corporation ability');
    expect(vm.lines[0]).to.deep.include({icon: CardResource.DISEASE, label: 'Diseases', value: '+4'});
  });

  it('integrates with the real stream (Pets gathers animals)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new Pets());
    addCity(player);
    addCity(player);
    runAllActions(game);

    const stats = effectOverlayStats(game.events.events, player.color);
    const pets = stats.find((s) => s.card === CardName.PETS);
    expect(pets, 'Pets overlay stat').to.not.be.undefined;
    expect(pets!.cardResources[CardResource.ANIMAL]).to.eq(2);

    const vm = getEffectSummary(pets!, {sourceName: CardName.PETS, sourceKind: 'card'});
    expect(vm.headline).to.eq('Animals gathered from cities');
    expect(vm.empty).to.be.false;
    const animals = vm.lines.find((l) => l.icon === CardResource.ANIMAL);
    expect(animals?.value).to.eq('+2');
    expect(vm.lastTrigger?.generation).to.eq(game.generation);
  });

  it('classifies an effect by its nature', () => {
    const ctx = (overrides: Partial<{sourceKind: 'card' | 'corporation', cardResourceType: CardResource}> = {}) =>
      ({sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card' as const, ...overrides});
    expect(classifyEffect(ctx({sourceKind: 'corporation'}), stat({}))).to.eq('corporation');
    expect(classifyEffect(ctx(), stat({megacreditsSaved: 4}))).to.eq('discount');
    expect(classifyEffect(ctx({cardResourceType: CardResource.ANIMAL}), stat({}))).to.eq('resourceAccumulation');
    expect(classifyEffect(ctx(), stat({tr: 2}))).to.eq('passiveTr');
    expect(classifyEffect(ctx(), stat({production: {...Units.EMPTY, heat: 1}}))).to.eq('passiveProduction');
    expect(classifyEffect(ctx(), stat({triggerCount: 3}))).to.eq('trigger');
    expect(classifyEffect(ctx(), stat({}))).to.eq('ruleChange');
  });

  it('a discount effect reads as savings (category + headline)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.EARTH_CATAPULT, triggerCount: 6, megacreditsSaved: 12}),
      {sourceName: CardName.EARTH_CATAPULT, sourceKind: 'card'});
    expect(vm.category).to.eq('discount');
    expect(vm.headline).to.eq('Cost reductions this game');
    expect(vm.empty).to.be.false;
    expect(vm.lines[0]).to.deep.include({label: 'Saved', value: '12'});
  });

  it('a resource card shows the live current value (distinct from cumulative added)', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PETS, triggerCount: 3, cardResources: {[CardResource.ANIMAL]: 3}}),
      {sourceName: CardName.PETS, sourceKind: 'card', cardResourceType: CardResource.ANIMAL, currentCardResource: 5});
    expect(vm.category).to.eq('resourceAccumulation');
    expect(vm.currentValue).to.deep.eq({icon: CardResource.ANIMAL, value: '5'});
  });

  it('an empty rule-changing effect shows a thematic note, never a dead state', () => {
    const vm = getEffectSummary(
      stat({card: CardName.PROTECTED_HABITATS}),
      {sourceName: CardName.PROTECTED_HABITATS, sourceKind: 'card'});
    expect(vm.empty).to.be.true;
    expect(vm.lines).to.have.length(0);
    expect(vm.note).to.not.be.undefined;
  });

  it('a corporation effect is framed as a corporation ability', () => {
    const vm = getEffectSummary(
      stat({card: CardName.THARSIS_REPUBLIC, kind: 'corporation', triggerCount: 4}),
      {sourceName: CardName.THARSIS_REPUBLIC, sourceKind: 'corporation'});
    expect(vm.category).to.eq('corporation');
    expect(vm.headline).to.eq('Corporation ability');
  });
});
