import {expect} from 'chai';
import {buildBoardLayout} from '../../src/server/boards/boardLayoutExport';
import {BoardName} from '../../src/common/boards/BoardName';
import {
  MINI_HEX_R,
  MINI_HEX_W,
  MINI_ROWS,
  MINI_V_STEP,
  miniCellCenter,
  miniLayoutBounds,
} from '../../src/common/boards/boardLayoutGeometry';

/**
 * REGRESSION GUARD for the miniature grid mapping (the 2026-09-11 skew):
 * using RAW `Space.x` as the screen column slides every short row right by
 * (9−rowLen)/2 hexes — the x=8 cells of all rows line up into a vertical
 * wall, the silhouette wedges, and cells overflow the frame. The shared
 * mapping must reproduce the BIG board's own relation
 * (`board_items_positions.less`): every row centred on one axis,
 * neighbouring rows offset by exactly half a hex, everything inside the
 * bounds-derived frame.
 */
describe('boardLayoutGeometry — the miniature grid mapping', () => {
  const EPS = 1e-6;

  it('every row of every board is centred on ONE axis (the big-board relation)', () => {
    for (const name of Object.values(BoardName)) {
      const layout = buildBoardLayout(name);
      const rowMid = new Map<number, number>();
      for (let y = 0; y < MINI_ROWS.length; y++) {
        const row = layout.filter((s) => s.y === y);
        const cxs = row.map((s) => miniCellCenter(s.x, s.y, MINI_ROWS[s.y]).cx);
        rowMid.set(y, (Math.min(...cxs) + Math.max(...cxs)) / 2);
      }
      const mids = [...rowMid.values()];
      for (const mid of mids) {
        expect(Math.abs(mid - mids[0]), `${name}: a row slid off the common axis`).lessThan(EPS);
      }
    }
  });

  it('neighbouring rows interleave by exactly half a hex — never a vertical wall', () => {
    const layout = buildBoardLayout(BoardName.THARSIS);
    for (let y = 0; y + 1 < MINI_ROWS.length; y++) {
      const a = layout.find((s) => s.y === y)!;
      const b = layout.find((s) => s.y === y + 1)!;
      const ca = miniCellCenter(a.x, a.y, MINI_ROWS[a.y]).cx;
      const cb = miniCellCenter(b.x, b.y, MINI_ROWS[b.y]).cx;
      const offset = Math.abs(ca - cb) % MINI_HEX_W;
      const half = Math.min(offset, MINI_HEX_W - offset);
      expect(Math.abs(half - MINI_HEX_W / 2), `rows ${y}/${y + 1} must interleave`).lessThan(EPS);
    }
    // The regression's smoking gun: x=8 of a SHORT row and of the LONG row
    // sat at the same cx (the vertical wall). Correctly they differ by the
    // rows' offset difference.
    const top = miniCellCenter(8, 0, MINI_ROWS[0]).cx; // row of 5
    const mid = miniCellCenter(8, 4, MINI_ROWS[4]).cx; // row of 9
    expect(Math.abs(top - mid)).greaterThan(MINI_HEX_W); // 2 hexes apart, never 0
  });

  it('the standard silhouette is symmetric and its bounds are tight (9 hexes wide)', () => {
    const layout = buildBoardLayout(BoardName.ELYSIUM);
    const b = miniLayoutBounds(layout);
    expect(Math.abs(b.width - 9 * MINI_HEX_W)).lessThan(EPS);
    expect(Math.abs(b.height - (8 * MINI_V_STEP + 2 * MINI_HEX_R))).lessThan(EPS);
    // Mirror symmetry of the silhouette about the vertical axis.
    const axis = (b.minX + b.maxX) / 2;
    for (const s of layout) {
      const {cx} = miniCellCenter(s.x, s.y, MINI_ROWS[s.y]);
      const mirrored = 2 * axis - cx;
      const twin = layout.some((o) => o.y === s.y &&
        Math.abs(miniCellCenter(o.x, o.y, MINI_ROWS[o.y]).cx - mirrored) < EPS);
      expect(twin, `cell (${s.x},${s.y}) has no mirror twin — the silhouette is skewed`).eq(true);
    }
  });

  it('every cell of every board sits fully inside its own bounds (nothing overflows the frame)', () => {
    for (const name of Object.values(BoardName)) {
      const layout = buildBoardLayout(name);
      const b = miniLayoutBounds(layout);
      for (const s of layout) {
        const {cx, cy} = miniCellCenter(s.x, s.y, MINI_ROWS[s.y]);
        expect(cx - MINI_HEX_W / 2, `${name} (${s.x},${s.y}) left`).gte(b.minX - EPS);
        expect(cx + MINI_HEX_W / 2, `${name} (${s.x},${s.y}) right`).lte(b.maxX + EPS);
        expect(cy - MINI_HEX_R, `${name} (${s.x},${s.y}) top`).gte(b.minY - EPS);
        expect(cy + MINI_HEX_R, `${name} (${s.x},${s.y}) bottom`).lte(b.maxY + EPS);
      }
    }
  });
});
