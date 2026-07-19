import {expect} from 'chai';
import {colonyMetadata, ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Resource} from '@/common/Resource';
import {Color} from '@/common/Color';
import {buildRewardSpecs, buildBonusIsCard, verifyColonyBuild} from '@/client/console/colonyBuild/colonyBuildModel';

/** A ColonyMetadata whose BUILD bonus is `build` (trade/colony are inert). */
function metaWith(build: {type: ColonyBenefit, quantity?: Array<number>, resource?: Resource}): ColonyMetadata {
  return colonyMetadata({
    name: ColonyName.LUNA,
    build: {description: '', type: build.type, quantity: build.quantity, resource: build.resource},
    trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.MEGACREDITS},
    colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.MEGACREDITS},
  });
}

function colony(name: ColonyName, colonies: Array<Color>): ColonyModel {
  return {colonies, isActive: true, name, trackPosition: 1, visitor: undefined};
}

describe('colonyBuildModel', () => {
  describe('buildRewardSpecs', () => {
    it('GAIN_RESOURCES → a stock spec with the slot amount', () => {
      const meta = metaWith({type: ColonyBenefit.GAIN_RESOURCES, quantity: [1, 2, 3], resource: Resource.TITANIUM});
      expect(buildRewardSpecs(meta, 0)).to.deep.eq([{channel: 'stock', resource: 'titanium', amount: 1}]);
      expect(buildRewardSpecs(meta, 1)).to.deep.eq([{channel: 'stock', resource: 'titanium', amount: 2}]);
    });

    it('GAIN_PRODUCTION → a production spec with the slot amount', () => {
      const meta = metaWith({type: ColonyBenefit.GAIN_PRODUCTION, quantity: [1, 1, 1], resource: Resource.MEGACREDITS});
      expect(buildRewardSpecs(meta, 2)).to.deep.eq([{channel: 'production', resource: 'megacredits', amount: 1}]);
    });

    it('DRAW_CARDS / ADD_RESOURCES_TO_CARD / GAIN_TR → no panel chip ([])', () => {
      expect(buildRewardSpecs(metaWith({type: ColonyBenefit.DRAW_CARDS, quantity: [2, 2, 2]}), 0)).to.deep.eq([]);
      expect(buildRewardSpecs(metaWith({type: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: [1, 1, 1]}), 0)).to.deep.eq([]);
      expect(buildRewardSpecs(metaWith({type: ColonyBenefit.GAIN_TR, quantity: [1, 1, 1]}), 0)).to.deep.eq([]);
    });

    it('a zero-quantity slot yields no spec', () => {
      const meta = metaWith({type: ColonyBenefit.GAIN_RESOURCES, quantity: [0, 0, 0], resource: Resource.PLANTS});
      expect(buildRewardSpecs(meta, 0)).to.deep.eq([]);
    });
  });

  describe('buildBonusIsCard', () => {
    it('is true ONLY for DRAW_CARDS (Pluto — the one with a colony reveal source)', () => {
      expect(buildBonusIsCard(metaWith({type: ColonyBenefit.DRAW_CARDS, quantity: [2, 2, 2]}))).to.eq(true);
    });

    it('is false for DRAW_EARTH_CARD (Terra draws with no reveal source → cube-only)', () => {
      expect(buildBonusIsCard(metaWith({type: ColonyBenefit.DRAW_EARTH_CARD, quantity: [1, 1, 1]}))).to.eq(false);
    });

    it('is false for a resource bonus', () => {
      expect(buildBonusIsCard(metaWith({type: ColonyBenefit.GAIN_RESOURCES, quantity: [1, 1, 1], resource: Resource.STEEL}))).to.eq(false);
    });
  });

  describe('verifyColonyBuild', () => {
    it('proves the viewer cube landed in the next slot (0-indexed)', () => {
      const prev = [colony(ColonyName.LUNA, [])];
      const next = [colony(ColonyName.LUNA, ['red'])];
      expect(verifyColonyBuild(prev, next, ColonyName.LUNA, 'red')).to.deep.eq({slotIndex: 0});
    });

    it('proves the second slot', () => {
      const prev = [colony(ColonyName.LUNA, ['red'])];
      const next = [colony(ColonyName.LUNA, ['red', 'blue'])];
      expect(verifyColonyBuild(prev, next, ColonyName.LUNA, 'blue')).to.deep.eq({slotIndex: 1});
    });

    it('refuses when the colony did not grow', () => {
      const prev = [colony(ColonyName.LUNA, ['red'])];
      const next = [colony(ColonyName.LUNA, ['red'])];
      expect(verifyColonyBuild(prev, next, ColonyName.LUNA, 'red')).to.eq(undefined);
    });

    it('refuses when the added cube is NOT the viewer (an opponent built)', () => {
      const prev = [colony(ColonyName.LUNA, [])];
      const next = [colony(ColonyName.LUNA, ['blue'])];
      expect(verifyColonyBuild(prev, next, ColonyName.LUNA, 'red')).to.eq(undefined);
    });

    it('refuses an unknown / missing colony', () => {
      const prev = [colony(ColonyName.LUNA, [])];
      const next = [colony(ColonyName.LUNA, ['red'])];
      expect(verifyColonyBuild(prev, next, ColonyName.TITAN, 'red')).to.eq(undefined);
    });
  });
});
