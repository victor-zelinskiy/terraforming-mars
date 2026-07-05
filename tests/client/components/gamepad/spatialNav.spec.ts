import {expect} from 'chai';
import {NavRect, pickDirectional, pickNearest, pickStrictGrid} from '@/client/gamepad/spatialNav';

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

  describe('pickStrictGrid (P27b — board inspection traversal)', () => {
    // A hex-like grid: row 0 at y=0, row 1 offset by half a cell (x+22),
    // row 2 back at the row-0 columns. Cell size 40, row pitch 34.
    const grid = [
      r(0, 0), r(44, 0), r(88, 0), // row 0        (idx 0..2)
      r(22, 34), r(66, 34), // row 1 (offset)      (idx 3..4)
      r(0, 68), r(44, 68), r(88, 68), // row 2     (idx 5..7)
    ];

    it('left/right stays STRICTLY in the current row', () => {
      // From row-1 left cell, right goes to its row peer — never the
      // diagonal row-0/row-2 cells the generic picker would also score.
      expect(pickStrictGrid(grid[3], grid, 'right')).to.eq(4);
      expect(pickStrictGrid(grid[4], grid, 'left')).to.eq(3);
      // End of the row → undefined (caller falls back for off-grid cells).
      expect(pickStrictGrid(grid[4], grid, 'right')).to.eq(undefined);
    });

    it('up/down picks the nearest row, closest to the column anchor', () => {
      // From row-0 middle, an anchor right of center picks the right
      // diagonal (idx 4, center 86); left of center — the left one.
      expect(pickStrictGrid(grid[1], grid, 'down', 66)).to.eq(4);
      expect(pickStrictGrid(grid[1], grid, 'down', 40)).to.eq(3);
    });

    it('a vertical run through the offset row returns to the SAME column', () => {
      // row0 idx1 (anchor 64): the offset row's two diagonals are
      // EQUIDISTANT (a structural hex tie — leftmost wins), but the
      // anchor pulls the run back to the starting column in row 2.
      const down1 = pickStrictGrid(grid[1], grid, 'down', 64);
      expect(down1).to.eq(3);
      const down2 = pickStrictGrid(grid[3], grid, 'down', 64);
      expect(down2).to.eq(6);
    });

    it('returns undefined past the last row', () => {
      expect(pickStrictGrid(grid[6], grid, 'down', 64)).to.eq(undefined);
      expect(pickStrictGrid(grid[1], grid, 'up', 64)).to.eq(undefined);
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
