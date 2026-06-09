import {expect} from 'chai';
import {additionalResourceGroups, additionalResourceGroup, additionalResourceMetricKey} from '@/client/components/additionalResources/additionalResources';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {CardModel} from '@/common/models/CardModel';

function card(name: CardName, resources?: number): CardModel {
  return {name, resources} as CardModel;
}

describe('additionalResources', () => {
  it('groups capable cards by resource type in FIRST-APPEARANCE (play) order', () => {
    const groups = additionalResourceGroups([
      card(CardName.ANTS, 2), // microbe
      card(CardName.PREDATORS, 1), // animal
      card(CardName.TARDIGRADES, 0), // microbe — unlocked earlier, must NOT reorder
    ]);
    expect(groups.map((g) => g.resource)).to.deep.eq([CardResource.MICROBE, CardResource.ANIMAL]);
  });

  it('aggregates totals across every capable card, INCLUDING those holding 0', () => {
    const groups = additionalResourceGroups([
      card(CardName.ANTS, 2),
      card(CardName.TARDIGRADES, 0),
    ]);
    const microbe = groups.find((g) => g.resource === CardResource.MICROBE);
    expect(microbe?.total).to.eq(2);
    expect(microbe?.cards.map((c) => c.name)).to.deep.eq([CardName.ANTS, CardName.TARDIGRADES]);
    expect(microbe?.cards[1].amount).to.eq(0);
  });

  it('keeps a resource type visible even when the aggregate total is 0', () => {
    const groups = additionalResourceGroups([card(CardName.PETS, 0)]);
    expect(groups).to.have.length(1);
    expect(groups[0].resource).to.eq(CardResource.ANIMAL);
    expect(groups[0].total).to.eq(0);
    expect(groups[0].cards).to.have.length(1);
  });

  it('ignores cards that cannot store a card resource', () => {
    const groups = additionalResourceGroups([
      card('Definitely Not A Real Card' as CardName, 5),
      card(CardName.ANTS, 1),
    ]);
    expect(groups.map((g) => g.resource)).to.deep.eq([CardResource.MICROBE]);
  });

  it('treats an undefined resource count as 0', () => {
    const groups = additionalResourceGroups([card(CardName.ANTS)]);
    expect(groups[0].total).to.eq(0);
  });

  it('additionalResourceGroup resolves a single group, or undefined when absent', () => {
    const tableau = [card(CardName.PREDATORS, 3), card(CardName.PETS, 1)];
    expect(additionalResourceGroup(tableau, CardResource.ANIMAL)?.total).to.eq(4);
    expect(additionalResourceGroup(tableau, CardResource.MICROBE)).to.eq(undefined);
  });

  it('produces a stable, per-resource metric key for the delta system', () => {
    expect(additionalResourceMetricKey(CardResource.ANIMAL)).to.eq('card-resource.Animal.stock');
  });
});
