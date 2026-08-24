import {expect} from 'chai';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {
  MARKER_PLACEMENT_ANIMATION_MS,
  MARKER_PLACEMENT_REDUCED_MS,
  NOMAD_LANDING_ANIMATION_MS,
  adoptMarkerSilently,
  applyMarkerPlacementPreview,
  landedMarkersIn,
  markerPlacementHoldDurationMs,
  observeMarkerPlacement,
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

  describe('the Mars Nomads camp (Flow A — the first landing)', () => {
    it('the FIRST placement (a bare appearance) is a landing to hold for', () => {
      const before = [space('05'), space('06')];
      const after = [space('05', {nomads: true}), space('06')];
      expect(shouldHoldForMarkerPlacement(before, after)).is.true;
      expect(landedMarkersIn(before, after)).to.deep.equal(['nomads']);
    });

    it('a MOVE (one cell lost the flag, one gained it) is NOT a landing — the move scene owns it', () => {
      const before = [space('05', {nomads: true}), space('06')];
      const after = [space('05'), space('06', {nomads: true})];
      expect(shouldHoldForMarkerPlacement(before, after)).is.false;
      expect(landedMarkersIn(before, after)).to.deep.equal([]);
    });

    it('the preview never paints a MOVE — its from/to pair belongs to the move scene', () => {
      const displayed = [space('05', {nomads: true}), space('06')];
      const incoming = [space('05'), space('06', {nomads: true})];
      applyMarkerPlacementPreview(displayed, incoming);
      expect(displayed[0].nomads).is.true; // untouched — the scene flips it
      expect(displayed[1].nomads).is.undefined;
    });

    it('…but a genuine first landing IS previewed', () => {
      const displayed = [space('05'), space('06')];
      applyMarkerPlacementPreview(displayed, [space('05', {nomads: true}), space('06')]);
      expect(displayed[0].nomads).is.true;
    });

    it('the hold covers the LONGEST landing in the response — the nomad descent outlasts the cathedral drop', () => {
      const before = [space('05')];
      const after = [space('05', {nomads: true})];
      // Reduced-motion may cap both; the diff-aware duration must never be
      // SHORTER than the argless (cathedral-length) one for a nomad landing.
      expect(markerPlacementHoldDurationMs(before, after)).is.at.least(markerPlacementHoldDurationMs());
      expect(NOMAD_LANDING_ANIMATION_MS).is.greaterThan(MARKER_PLACEMENT_ANIMATION_MS);
    });

    it('adoptMarkerSilently pre-sets the baseline so the flag flip is silent', () => {
      // The move scene paints the destination under its settled proxy: even a
      // response that ALSO armed the placement window may not replay a landing.
      adoptMarkerSilently('77', 'nomads');
      const cell = space('77', {nomads: true});
      // A tracked baseline equal to the incoming value observes to null (no
      // animation), and the baseline itself keeps later observations silent.
      expect(observeMarkerPlacement(cell, 'nomads')).is.null;
    });
  });
});
