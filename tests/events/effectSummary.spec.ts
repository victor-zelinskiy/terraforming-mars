import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, addCity} from '../TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Units} from '@/common/Units';
import {Pets} from '@/server/cards/base/Pets';
import {effectOverlayStats, EffectOverlayStat} from '@/common/events/aggregate';
import {getEffectSummary} from '@/client/components/effects/effectSummary';

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
});
