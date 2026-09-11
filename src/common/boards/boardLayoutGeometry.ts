import {BoardLayoutSpace} from './BoardLayout';

/**
 * MINIATURE GEOMETRY of the Mars board — the ONE mapping from the server
 * grid (`Space.x/y`, exported in `genfiles/boardLayouts.json`) to screen
 * coordinates, shared by the board-miniature renderer and its guard spec.
 *
 * The server grid encodes the row offset INSIDE `x` (`x = (9 − rowLen) + i`,
 * `BoardBuilder.build`), and the big board centres every row on one axis
 * with neighbouring rows shifted by half a hex (`board_items_positions.less`
 * — step 49 px per column, each row's centre at the same left). The
 * miniature must reproduce exactly that relation:
 *
 *     cx = (x − (9 − rowLen) / 2) · HEX_W
 *
 * (equivalently: column-in-row, centred — `(i − (rowLen−1)/2)·W` around the
 * common axis). Using RAW `x` as the column is the documented regression:
 * every short row slides right by `(9−rowLen)/2` hexes, the x=8 cells of
 * all rows line up into a vertical wall, and the top/bottom rows wedge —
 * the exact skew of the 2026-09-11 screenshots.
 */

export const MINI_HEX_R = 10;
export const MINI_HEX_W = Math.sqrt(3) * MINI_HEX_R;
export const MINI_V_STEP = 1.5 * MINI_HEX_R;
/** Standard Mars silhouette rows (every campaign board is built on it). */
export const MINI_ROWS: ReadonlyArray<number> = [5, 6, 7, 8, 9, 8, 7, 6, 5];

/** Screen centre of a server-grid cell, in miniature units (uncentered —
 *  callers translate by the layout's own bounds). */
export function miniCellCenter(x: number, y: number, rowLen: number): {cx: number, cy: number} {
  return {
    cx: (x - (9 - rowLen) / 2) * MINI_HEX_W,
    cy: y * MINI_V_STEP,
  };
}

export type MiniBounds = {minX: number, minY: number, maxX: number, maxY: number, width: number, height: number};

/**
 * Tight bounds of a layout's ON-MARS surface (hex extents included): the
 * miniature's viewBox derives from THIS, so the planet always fills its
 * frame regardless of which rows a board actually populates — and nothing
 * that is not part of the surface can inflate it.
 */
export function miniLayoutBounds(spaces: ReadonlyArray<Pick<BoardLayoutSpace, 'x' | 'y'>>): MiniBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of spaces) {
    const rowLen = MINI_ROWS[s.y] ?? 9;
    const {cx, cy} = miniCellCenter(s.x, s.y, rowLen);
    minX = Math.min(minX, cx - MINI_HEX_W / 2);
    maxX = Math.max(maxX, cx + MINI_HEX_W / 2);
    minY = Math.min(minY, cy - MINI_HEX_R);
    maxY = Math.max(maxY, cy + MINI_HEX_R);
  }
  if (!Number.isFinite(minX)) {
    minX = 0; minY = 0; maxX = 9 * MINI_HEX_W; maxY = 8 * MINI_V_STEP + 2 * MINI_HEX_R;
  }
  return {minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY};
}

/** The flat-side hex outline (pointy-top, radius R) around (0,0). */
export function miniHexPoints(r = MINI_HEX_R): string {
  const pts: Array<string> = [];
  for (let a = 0; a < 6; a++) {
    const ang = (Math.PI / 180) * (60 * a - 90);
    pts.push(`${(r * Math.cos(ang)).toFixed(2)},${(r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(' ');
}
