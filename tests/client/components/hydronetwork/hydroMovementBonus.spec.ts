import {expect} from 'chai';
import {CardName} from '../../../../src/common/cards/CardName';
import {Resource} from '../../../../src/common/Resource';
import type {DeltaMovementBonusProjection} from '../../../../src/common/models/DeltaTrackPreviewModel';
import {
  movementBonusTotal,
  movementBonusTransfers,
  withMovementBonusOnLastLeg,
} from '../../../../src/client/console/hydroFlow/hydroMovementBonus';
import type {ResourceTransferSpec} from '../../../../src/client/console/resourceTransfer/resourceTransferModel';

function bonus(amount: number, before = 0, card = CardName.SOCIAL_HEATING): DeltaMovementBonusProjection {
  return {card, resource: Resource.HEAT, amount, before, after: before + amount};
}

describe('hydroMovementBonus', () => {
  describe('the flight', () => {
    it('a projected bonus becomes one STOCK chip', () => {
      expect(movementBonusTransfers([bonus(3, 4)]))
        .deep.eq([{channel: 'stock', resource: Resource.HEAT, amount: 3}]);
    });

    it('two sources of one resource merge into a single chip', () => {
      expect(movementBonusTransfers([bonus(2), bonus(3)]))
        .deep.eq([{channel: 'stock', resource: Resource.HEAT, amount: 5}]);
    });

    it('nothing owed → no chips (the historical wave is untouched)', () => {
      expect(movementBonusTransfers(undefined)).deep.eq([]);
      expect(movementBonusTransfers([])).deep.eq([]);
    });

    it('a zero amount never flies', () => {
      expect(movementBonusTransfers([bonus(0)])).deep.eq([]);
    });
  });

  describe('where it lands on a traversal', () => {
    const leg = (position: number, transfers: Array<ResourceTransferSpec> = []) => ({position, transfers});

    it('ONE aggregate on the DESTINATION leg — never a chip per crossed cell', () => {
      const legs = [leg(1), leg(2, [{channel: 'stock', resource: Resource.STEEL, amount: 2}]), leg(3)];
      const out = withMovementBonusOnLastLeg(legs, [bonus(3)]);
      expect(out[0].transfers).deep.eq([]);
      expect(out[1].transfers).deep.eq([{channel: 'stock', resource: Resource.STEEL, amount: 2}]);
      expect(out[2].transfers).deep.eq([{channel: 'stock', resource: Resource.HEAT, amount: 3}]);
    });

    it('merges with the destination stage’s own reward of the same pool', () => {
      const legs = [leg(1, [{channel: 'stock', resource: Resource.HEAT, amount: 1}])];
      const out = withMovementBonusOnLastLeg(legs, [bonus(2)]);
      expect(out[0].transfers).deep.eq([{channel: 'stock', resource: Resource.HEAT, amount: 3}]);
    });

    it('leaves the legs untouched when nothing is owed', () => {
      const legs = [leg(1), leg(2)];
      expect(withMovementBonusOnLastLeg(legs, [])).deep.eq(legs);
      expect(withMovementBonusOnLastLeg(legs, undefined)).deep.eq(legs);
    });

    it('an empty plan is not a place to land', () => {
      expect(withMovementBonusOnLastLeg([], [bonus(2)])).deep.eq([]);
    });
  });

  describe('the total', () => {
    it('sums what the result summary must match', () => {
      expect(movementBonusTotal([bonus(2), bonus(3)])).eq(5);
      expect(movementBonusTotal(undefined)).eq(0);
    });
  });
});
