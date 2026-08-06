import {expect} from 'chai';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {Color} from '@/common/Color';
import {
  applyOwnerCubePlacementPreview,
  ownerCubeHoldDurationMs,
  shouldHoldForOwnerCubePlacement,
} from '@/client/components/board/cubeDropState';

function space(id: string, extra: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: SpaceType.LAND, bonus: [], ...extra} as SpaceModel;
}

describe('cubeDropState — player-marker (cube-only) placement', () => {
  describe('shouldHoldForOwnerCubePlacement', () => {
    it('a claim on an empty cell is a landing to hold for (Land Claim / an Arcadian community)', () => {
      const before = [space('05')];
      const after = [space('05', {color: 'red' as Color})];
      expect(shouldHoldForOwnerCubePlacement(before, after)).is.true;
    });

    it('an ordinary TILE build is NOT ours — the tile framework drops that cube', () => {
      // The colour arrives WITH the tile; holding here too would replay the drop
      // ahead of the tile it is supposed to land on.
      const before = [space('05')];
      const after = [space('05', {tileType: TileType.CITY, color: 'red' as Color})];
      expect(shouldHoldForOwnerCubePlacement(before, after)).is.false;
    });

    it('a tile built LATER on an already-claimed cell is not a fresh claim', () => {
      // Arcadian Communities' own follow-up: the cube is already standing there.
      const before = [space('05', {color: 'red' as Color})];
      const after = [space('05', {color: 'red' as Color, tileType: TileType.CITY})];
      expect(shouldHoldForOwnerCubePlacement(before, after)).is.false;
    });

    it('an unchanged board holds for nothing — including a marker already there', () => {
      const claimed = [space('05', {color: 'red' as Color})];
      expect(shouldHoldForOwnerCubePlacement(claimed, [space('05', {color: 'red' as Color})])).is.false;
      expect(shouldHoldForOwnerCubePlacement([space('05')], [space('05')])).is.false;
    });

    it('misaligned ids are skipped, never mistaken for a landing', () => {
      const before = [space('05')];
      const after = [space('06', {color: 'red' as Color})];
      expect(shouldHoldForOwnerCubePlacement(before, after)).is.false;
    });
  });

  describe('applyOwnerCubePlacementPreview', () => {
    it('copies ONLY the fresh owner colour onto the displayed spaces', () => {
      const displayed = [space('05'), space('06')];
      const incoming = [
        space('05', {color: 'blue' as Color}),
        // A tile in the same response is deliberately left to the tile framework.
        space('06', {tileType: TileType.GREENERY, color: 'blue' as Color}),
      ];
      applyOwnerCubePlacementPreview(displayed, incoming);
      expect(displayed[0].color).to.eq('blue');
      expect(displayed[1].color).is.undefined;
      expect(displayed[1].tileType).is.undefined;
    });

    it('touches nothing else on the claimed cell — a claim collects no bonus', () => {
      // `placementEffect: 'marker'` grants nothing, so the hex must keep its
      // printed icons and no counter may move at the drop.
      const displayed = [space('05', {bonus: [1, 1]} as Partial<SpaceModel>)];
      applyOwnerCubePlacementPreview(displayed, [space('05', {color: 'green' as Color, bonus: [1, 1]} as Partial<SpaceModel>)]);
      expect(displayed[0].color).to.eq('green');
      expect(displayed[0].bonus).to.deep.eq([1, 1]);
      expect(displayed[0].tileType).is.undefined;
    });

    it('is a no-op when nothing landed', () => {
      const displayed = [space('05')];
      applyOwnerCubePlacementPreview(displayed, [space('05')]);
      expect(displayed[0].color).is.undefined;
    });
  });

  it('the hold reaches the cube\'s contact with the cell', () => {
    // Whichever motion preference is active, the commit waits for the beat that
    // carries the meaning (never zero — that IS the pop this framework removes).
    expect(ownerCubeHoldDurationMs()).is.at.least(100);
  });
});
