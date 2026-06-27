import {expect} from 'chai';
import {ViewModel} from '@/common/models/PlayerModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType} from '@/common/TileType';
import {
  applyHazardTileSwap,
  detectHazardCleanup,
  resetHazardCleanup,
} from '@/client/components/feedback/hazardCleanupTransition';

function view(spaces: Array<Partial<SpaceModel> & {id: string}>): ViewModel {
  return {game: {spaces}} as unknown as ViewModel;
}

describe('hazardCleanupTransition', () => {
  beforeEach(() => resetHazardCleanup());

  describe('detectHazardCleanup (dedup / no double-run)', () => {
    it('returns the cleanup ONCE, then nothing on a poll replay of the same diff', () => {
      const prev = view([{id: '05', tileType: TileType.DUST_STORM_MILD}]);
      const next = view([{id: '05', tileType: TileType.CITY, color: 'red'}]);

      const first = detectHazardCleanup(prev, next);
      expect(first).to.have.length(1);
      expect(first[0].spaceId).to.eq('05');

      // The poll loop re-fetches the SAME new view → must not re-animate.
      expect(detectHazardCleanup(prev, next)).to.be.empty;
    });

    it('a fresh load (no prev) animates nothing — a cleanup needs a prev→next diff', () => {
      const next = view([{id: '05', tileType: TileType.CITY}]);
      // On F5 the board hydrates with the tile already down: no diff → no cleanup.
      expect(detectHazardCleanup(undefined, next)).to.be.empty;
    });

    it('resetHazardCleanup clears the seen set so the same cleanup can fire again', () => {
      const prev = view([{id: '05', tileType: TileType.EROSION_SEVERE}]);
      const next = view([{id: '05', tileType: TileType.GREENERY}]);
      expect(detectHazardCleanup(prev, next)).to.have.length(1);
      resetHazardCleanup();
      expect(detectHazardCleanup(prev, next)).to.have.length(1);
    });
  });

  describe('applyHazardTileSwap', () => {
    it('mutates the displayed (old) cell to the new tile + colour', () => {
      const displayed: Array<SpaceModel> = [{id: '05', tileType: TileType.DUST_STORM_MILD} as SpaceModel];
      const next = view([{id: '05', tileType: TileType.CITY, color: 'blue'}]);
      const events = detectHazardCleanup(view([{id: '05', tileType: TileType.DUST_STORM_MILD}]), next);

      applyHazardTileSwap(displayed, next.game.spaces, events);

      expect(displayed[0].tileType).to.eq(TileType.CITY);
      expect(displayed[0].color).to.eq('blue');
    });

    it('only touches the cleared cells, leaving the rest of the board alone', () => {
      const displayed: Array<SpaceModel> = [
        {id: '05', tileType: TileType.EROSION_MILD} as SpaceModel,
        {id: '06', tileType: TileType.OCEAN} as SpaceModel,
      ];
      const next = view([
        {id: '05', tileType: TileType.GREENERY, color: 'red'},
        {id: '06', tileType: TileType.OCEAN},
      ]);
      const events = detectHazardCleanup(
        view([{id: '05', tileType: TileType.EROSION_MILD}, {id: '06', tileType: TileType.OCEAN}]),
        next);

      applyHazardTileSwap(displayed, next.game.spaces, events);
      expect(displayed[0].tileType).to.eq(TileType.GREENERY);
      expect(displayed[1].tileType).to.eq(TileType.OCEAN); // untouched
    });
  });
});
