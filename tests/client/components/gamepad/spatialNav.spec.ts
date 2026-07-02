import {expect} from 'chai';
import {NavRect, pickDirectional, pickNearest} from '@/client/gamepad/spatialNav';

function r(left: number, top: number, width = 40, height = 40): NavRect {
  return {left, top, width, height};
}

describe('spatialNav', () => {
  describe('pickDirectional', () => {
    it('picks the nearest element in a row', () => {
      const from = r(0, 0);
      const row = [r(60, 0), r(120, 0), r(180, 0)];
      expect(pickDirectional(from, row, 'right')).to.eq(0);
      expect(pickDirectional(r(180, 0), row, 'left')).to.eq(1);
    });

    it('returns undefined at the edge of the set (bounded, no wrap)', () => {
      const from = r(0, 0);
      const row = [r(60, 0), r(120, 0)];
      expect(pickDirectional(from, row, 'left')).to.eq(undefined);
      expect(pickDirectional(from, row, 'up')).to.eq(undefined);
      expect(pickDirectional(from, row, 'down')).to.eq(undefined);
    });

    it('prefers the aligned same-column element over a nearer diagonal one', () => {
      const from = r(100, 0);
      const candidates = [
        r(100, 90), // same column, farther down
        r(150, 60), // nearer, but off-column
      ];
      expect(pickDirectional(from, candidates, 'down')).to.eq(0);
    });

    it('navigates a grid correctly in all four directions', () => {
      // 3×3 grid, 60px pitch; from the center cell (index 4).
      const grid: Array<NavRect> = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          grid.push(r(col * 60, row * 60));
        }
      }
      const from = grid[4];
      expect(pickDirectional(from, grid, 'up')).to.eq(1);
      expect(pickDirectional(from, grid, 'down')).to.eq(7);
      expect(pickDirectional(from, grid, 'left')).to.eq(3);
      expect(pickDirectional(from, grid, 'right')).to.eq(5);
    });

    it('reaches hex-offset neighbours (±30° off axis) going up/down', () => {
      // Pointy-top hex row offsets: the two upper neighbours sit half a cell
      // to the side and one row up.
      const from = r(100, 100, 50, 50);
      const upLeft = r(75, 55, 50, 50);
      const upRight = r(125, 55, 50, 50);
      const sameRowRight = r(155, 100, 50, 50);
      const idx = pickDirectional(from, [sameRowRight, upLeft, upRight], 'up');
      // Either upper neighbour is acceptable; the same-row cell is not.
      expect(idx).to.be.oneOf([1, 2]);
    });

    it('rejects nearly-perpendicular candidates outside the cone', () => {
      const from = r(0, 0);
      // Far to the side, barely forward: not a "down" move.
      const candidates = [r(400, 30)];
      expect(pickDirectional(from, candidates, 'down')).to.eq(undefined);
    });

    it('skips zero-area rects (hidden elements)', () => {
      const from = r(0, 0);
      const candidates = [r(60, 0, 0, 0), r(120, 0)];
      expect(pickDirectional(from, candidates, 'right')).to.eq(1);
    });

    it('ignores the origin itself when present in candidates', () => {
      const from = r(0, 0);
      const candidates = [r(0, 0), r(60, 0)];
      expect(pickDirectional(from, candidates, 'right')).to.eq(1);
    });
  });

  describe('pickNearest', () => {
    it('finds the closest rect to a point', () => {
      const candidates = [r(0, 0), r(100, 100), r(300, 0)];
      expect(pickNearest({x: 110, y: 130}, candidates)).to.eq(1);
      expect(pickNearest({x: 305, y: 10}, candidates)).to.eq(2);
    });

    it('returns undefined for an empty/hidden set', () => {
      expect(pickNearest({x: 0, y: 0}, [])).to.eq(undefined);
      expect(pickNearest({x: 0, y: 0}, [r(0, 0, 0, 0)])).to.eq(undefined);
    });
  });
});
