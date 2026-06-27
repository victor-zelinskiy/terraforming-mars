import {expect} from 'chai';
import {ViewModel} from '@/common/models/PlayerModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType} from '@/common/TileType';
import {
  cleanupDurationMs,
  detectHazardCleanups,
  hazardFxAt,
  phaseAt,
  TILE_SWAP_FRACTION,
} from '@/client/components/feedback/hazardCleanupModel';

function view(spaces: Array<Partial<SpaceModel> & {id: string}>): ViewModel {
  return {game: {spaces}} as unknown as ViewModel;
}

describe('hazardCleanupModel', () => {
  describe('detectHazardCleanups', () => {
    it('a mild dust storm built over → cleanup (kind dust-storm, cost 8, +1 TR, placer colour)', () => {
      const prev = view([{id: '05', tileType: TileType.DUST_STORM_MILD}]);
      const next = view([{id: '05', tileType: TileType.CITY, color: 'red'}]);
      const events = detectHazardCleanups(prev, next);
      expect(events).to.have.length(1);
      const e = events[0];
      expect(e.kind).to.eq('dust-storm');
      expect(e.severity).to.eq('mild');
      expect(e.cost).to.eq(8);
      expect(e.trReward).to.eq(1);
      expect(e.newTileType).to.eq(TileType.CITY);
      expect(e.color).to.eq('red');
      expect(e.dedupeKey).to.contain('05');
    });

    it('a severe erosion built over → cleanup (kind erosion, cost 16, +2 TR)', () => {
      const prev = view([{id: '11', tileType: TileType.EROSION_SEVERE}]);
      const next = view([{id: '11', tileType: TileType.GREENERY, color: 'blue'}]);
      const e = detectHazardCleanups(prev, next)[0];
      expect(e.kind).to.eq('erosion');
      expect(e.severity).to.eq('severe');
      expect(e.cost).to.eq(16);
      expect(e.trReward).to.eq(2);
    });

    it('an ORDINARY placement (empty → tile) is NOT a cleanup', () => {
      const prev = view([{id: '05', tileType: undefined}]);
      const next = view([{id: '05', tileType: TileType.CITY}]);
      expect(detectHazardCleanups(prev, next)).to.be.empty;
    });

    it('a hazard INTENSIFICATION (mild → severe) is NOT a cleanup', () => {
      const prev = view([{id: '05', tileType: TileType.EROSION_MILD}]);
      const next = view([{id: '05', tileType: TileType.EROSION_SEVERE}]);
      expect(detectHazardCleanups(prev, next)).to.be.empty;
    });

    it('a hazard that stays a hazard, or a non-hazard untouched, is NOT a cleanup', () => {
      const prev = view([{id: '05', tileType: TileType.DUST_STORM_MILD}, {id: '06', tileType: TileType.CITY}]);
      const next = view([{id: '05', tileType: TileType.DUST_STORM_MILD}, {id: '06', tileType: TileType.CITY}]);
      expect(detectHazardCleanups(prev, next)).to.be.empty;
    });

    it('no prev view (fresh load) → no cleanups', () => {
      expect(detectHazardCleanups(undefined, view([{id: '05', tileType: TileType.CITY}]))).to.be.empty;
    });

    it('handles several cleared cells in one diff', () => {
      const prev = view([{id: '05', tileType: TileType.DUST_STORM_MILD}, {id: '11', tileType: TileType.EROSION_SEVERE}]);
      const next = view([{id: '05', tileType: TileType.CITY}, {id: '11', tileType: TileType.GREENERY}]);
      expect(detectHazardCleanups(prev, next)).to.have.length(2);
    });
  });

  describe('cleanupDurationMs', () => {
    it('strong > weak (a longer, more satisfying transition); reduced motion is the shortest', () => {
      const weak = cleanupDurationMs('mild', false);
      const strong = cleanupDurationMs('severe', false);
      expect(weak).to.be.greaterThan(1100).and.lessThan(1300);
      expect(strong).to.be.greaterThan(1500).and.lessThan(1700);
      expect(strong).to.be.greaterThan(weak);
      expect(cleanupDurationMs('severe', true)).to.be.lessThan(weak);
    });
  });

  describe('phaseAt / fx ordering', () => {
    it('walks the phases in order and ends on done (the materialise owns the back half)', () => {
      expect(phaseAt(0)).to.eq('focus');
      expect(phaseAt(0.2)).to.eq('cleanup-start');
      expect(phaseAt(0.45)).to.eq('cleanup-resolve');
      expect(phaseAt(0.7)).to.eq('tile-materialize');
      expect(phaseAt(0.9)).to.eq('tile-materialize');
      expect(phaseAt(1)).to.eq('done');
    });

    it('the tile swaps only AFTER the hazard has fully dissolved, then materialises in', () => {
      // At the swap mark the hazard is gone (opacity 0) but the tile has not yet materialised.
      const atSwap = hazardFxAt(TILE_SWAP_FRACTION);
      expect(atSwap.hazardOpacity).to.be.closeTo(0, 0.001);
      expect(atSwap.dissolve).to.be.closeTo(1, 0.001);
      expect(atSwap.materialize).to.eq(0);
      // Early: hazard fully visible, nothing dissolved/materialised yet.
      const early = hazardFxAt(0.05);
      expect(early.hazardOpacity).to.eq(1);
      expect(early.dissolve).to.eq(0);
      expect(early.materialize).to.eq(0);
      // Materialise rises monotonically across the back half and completes at the end.
      expect(hazardFxAt(0.75).materialize).to.be.greaterThan(0).and.lessThan(1);
      expect(hazardFxAt(1).materialize).to.be.closeTo(1, 0.001);
    });
  });
});
