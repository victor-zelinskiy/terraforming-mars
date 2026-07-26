import {expect} from 'chai';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {
  MARKER_PLACEMENT_ANIMATION_MS,
  MARKER_PLACEMENT_REDUCED_MS,
  applyMarkerPlacementPreview,
  markerPlacementHoldDurationMs,
  shouldHoldForMarkerPlacement,
} from '@/client/components/board/markerPlacementAnimation';

function space(id: string, extra: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: SpaceType.LAND, bonus: [], ...extra} as SpaceModel;
}

describe('markerPlacementAnimation', () => {
  describe('shouldHoldForMarkerPlacement', () => {
    it('a cathedral landing on an existing city is a placement to hold for', () => {
      const before = [space('05', {tileType: TileType.CITY})];
      const after = [space('05', {tileType: TileType.CITY, cathedral: true})];
      expect(shouldHoldForMarkerPlacement(before, after)).is.true;
    });

    it('an unchanged board holds for nothing — including a marker already there', () => {
      const before = [space('05', {tileType: TileType.CITY, cathedral: true})];
      const after = [space('05', {tileType: TileType.CITY, cathedral: true})];
      expect(shouldHoldForMarkerPlacement(before, after)).is.false;
      expect(shouldHoldForMarkerPlacement([space('05')], [space('05')])).is.false;
    });

    it('an ordinary TILE placement is NOT ours (the tile framework owns it)', () => {
      const before = [space('05')];
      const after = [space('05', {tileType: TileType.CITY})];
      expect(shouldHoldForMarkerPlacement(before, after)).is.false;
    });

    it('misaligned ids are skipped, never mistaken for a landing', () => {
      const before = [space('05', {tileType: TileType.CITY})];
      const after = [space('06', {tileType: TileType.CITY, cathedral: true})];
      expect(shouldHoldForMarkerPlacement(before, after)).is.false;
    });
  });

  describe('applyMarkerPlacementPreview', () => {
    it('copies ONLY the fresh markers onto the displayed spaces', () => {
      const displayed = [space('05', {tileType: TileType.CITY}), space('06')];
      const incoming = [
        space('05', {tileType: TileType.CITY, cathedral: true}),
        // A tile in the same response is deliberately left to the tile framework.
        space('06', {tileType: TileType.GREENERY}),
      ];
      applyMarkerPlacementPreview(displayed, incoming);
      expect(displayed[0].cathedral).is.true;
      expect(displayed[1].tileType).is.undefined;
    });

    it('is a no-op when nothing landed', () => {
      const displayed = [space('05', {tileType: TileType.CITY})];
      applyMarkerPlacementPreview(displayed, [space('05', {tileType: TileType.CITY})]);
      expect(displayed[0].cathedral).is.undefined;
    });
  });

  it('the hold spans the WHOLE landing — the prompt it causes must follow it', () => {
    // Whichever motion preference is active, the hold covers its animation.
    expect(markerPlacementHoldDurationMs()).is.at.least(
      Math.min(MARKER_PLACEMENT_ANIMATION_MS, MARKER_PLACEMENT_REDUCED_MS));
  });
});
