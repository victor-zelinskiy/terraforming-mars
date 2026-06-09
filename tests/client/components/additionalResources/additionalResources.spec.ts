import {expect} from 'chai';
import {additionalResourceGroups, additionalResourceGroup, additionalResourceMetricKey, resourceScoring, vpPerResource, accumulatedVp} from '@/client/components/additionalResources/additionalResources';
import {specialResourceState} from '@/client/components/additionalResources/additionalResourceSpecialCases';
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

  describe('resource VP scoring', () => {
    it('detects the per/each modifiers, or undefined for non-scoring storage', () => {
      expect(resourceScoring(CardName.PREDATORS)).to.deep.eq({per: 1, each: 1}); // 1 VP / animal
      expect(resourceScoring(CardName.ANTS)).to.deep.eq({per: 2, each: 1}); // 1 VP / 2 microbes
      expect(resourceScoring(CardName.PHYSICS_COMPLEX)).to.deep.eq({per: 1, each: 2}); // 2 VP / science
      // Stores microbes for an action but scores NO VP from them.
      expect(resourceScoring(CardName.GHG_PRODUCING_BACTERIA)).to.eq(undefined);
    });

    it('computes the VP-per-resource display rate', () => {
      expect(vpPerResource(CardName.PREDATORS)).to.eq(1);
      expect(vpPerResource(CardName.ANTS)).to.eq(0.5);
      expect(vpPerResource(CardName.DECOMPOSERS)).to.eq(0.33); // 1/3
      expect(vpPerResource(CardName.PHYSICS_COMPLEX)).to.eq(2);
      expect(vpPerResource(CardName.GHG_PRODUCING_BACTERIA)).to.eq(0);
    });

    it('computes accrued VP via the exact server formula (each, then floor by per)', () => {
      expect(accumulatedVp(CardName.PREDATORS, 4)).to.eq(4);
      expect(accumulatedVp(CardName.ANTS, 5)).to.eq(2); // floor(5/2)
      expect(accumulatedVp(CardName.DECOMPOSERS, 7)).to.eq(2); // floor(7/3)
      expect(accumulatedVp(CardName.PHYSICS_COMPLEX, 3)).to.eq(6); // 3*2
      expect(accumulatedVp(CardName.GHG_PRODUCING_BACTERIA, 9)).to.eq(0); // no scoring
    });
  });

  describe('special-case presenters', () => {
    it('Search for Life: pending with no resource, success (3 VP) once it has one', () => {
      expect(specialResourceState(CardName.SEARCH_FOR_LIFE, 0)).to.deep.eq({
        tone: 'pending', label: 'Searching for life', vp: 0, replacesCardChrome: true,
      });
      expect(specialResourceState(CardName.SEARCH_FOR_LIFE, 1)).to.deep.eq({
        tone: 'success', label: 'Life found', vp: 3, replacesCardChrome: true,
      });
    });

    it('Vermin: inactive below 10 animals, warning + active at the threshold', () => {
      expect(specialResourceState(CardName.VERMIN, 5)).to.deep.eq({
        tone: 'pending', label: 'Vermin inactive', detail: '-1 VP per city for all',
        threshold: {current: 5, required: 10, reached: false},
      });
      expect(specialResourceState(CardName.VERMIN, 10)).to.deep.eq({
        tone: 'warning', label: 'Vermin active', detail: '-1 VP per city for all',
        threshold: {current: 10, required: 10, reached: true},
      });
      expect(specialResourceState(CardName.VERMIN, 12)?.threshold?.reached).to.eq(true);
    });

    it('returns undefined for cards with no bespoke presenter (generic summary)', () => {
      expect(specialResourceState(CardName.ANTS, 3)).to.eq(undefined);
      expect(specialResourceState(CardName.PREDATORS, 0)).to.eq(undefined);
    });
  });
});
