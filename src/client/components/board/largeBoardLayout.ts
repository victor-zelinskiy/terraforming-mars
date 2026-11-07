import {BoardName} from '@/common/boards/BoardName';
import {BoardArcConfigs, LARGE_ARCS, STANDARD_ARCS} from '@/client/components/board/arcScaleConfigs';

/**
 * THE BOARD'S LAYOUT FAMILY — the nine-row Mars every board but one shares, or the ELEVEN-ROW field of Amazonis
 * Planitia (91 hexes, rows 6 … 11 … 6). The family decides the hex positions (`board_large_positions.less`, scoped
 * under `.board-cont--large`), the planet's size behind them, the four dials (`LARGE_ARCS`), the off-Mars flank
 * (`console_board_large.less`) and the camera's focus frame. Phase 1 of the board's adaptation
 * (`docs/claude/amazonis-planitia-phase-1.md` § the field).
 */
export type BoardLayoutKind = 'standard' | 'large';

const LARGE_BOARDS: ReadonlySet<BoardName> = new Set([BoardName.AMAZONIS_PLANITIA]);

export function boardLayoutKind(boardName: BoardName | undefined): BoardLayoutKind {
  return boardName !== undefined && LARGE_BOARDS.has(boardName) ? 'large' : 'standard';
}

/** The four dials of a board. */
export function arcConfigsFor(boardName: BoardName | undefined): BoardArcConfigs {
  return boardLayoutKind(boardName) === 'large' ? LARGE_ARCS : STANDARD_ARCS;
}

/**
 * THE ELEVEN-ROW GRID IN BOARD PX — the ONE construction behind `board_large_positions.less` (its guard recomputes
 * every margin from here): the standard hex (46 × 51) at the standard pitch (49 across, 41 down), every row centred
 * on the planet's axis, the whole grid centred on the dials' centre — `.global-numbers` (300, 301), i.e. (223, 227)
 * in `.board`'s own space (`.board` stands at 93 / 85 in `.board-cont`, `.global-numbers` at 16 / 11). The hexes keep
 * their Tharsis size on purpose (the owner, 2026-11-06: «гексы предельно крупные»); the planet grows behind them.
 */
export const LARGE_BOARD_ROWS: ReadonlyArray<number> = [6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6];
export const HEX_W = 46;
export const HEX_H = 51;
export const HEX_PITCH_X = 49;
export const HEX_PITCH_Y = 41;
const GRID_CENTRE = {x: 223, y: 227};

/** Every Mars cell of the eleven-row grid in id order ('03' …), with its `.board`-space margin (top-left). */
export function largeBoardHexMargins(): Array<{id: string, top: number, left: number}> {
  const out: Array<{id: string, top: number, left: number}> = [];
  const mid = (LARGE_BOARD_ROWS.length - 1) / 2;
  let id = 3;
  LARGE_BOARD_ROWS.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      out.push({
        id: String(id++).padStart(2, '0'),
        top: GRID_CENTRE.y - HEX_H / 2 + (row - mid) * HEX_PITCH_Y,
        left: GRID_CENTRE.x - HEX_W / 2 + (i - (n - 1) / 2) * HEX_PITCH_X,
      });
    }
  });
  return out;
}

type Pt = {x: number, y: number};

/** `.board` → `.global-numbers` (the dials' space): `.board` stands at (93, 85) in `.board-cont`, the dials at (16, 11). */
const BOARD_TO_DIALS = {x: 93 - 16, y: 85 - 11};

/** The eleven-row grid's hexes as polygons in the DIALS' space (pointy-top, the standard 46 × 51). */
export function largeBoardGridPolygons(): Array<Array<Pt>> {
  return largeBoardHexMargins().map(({top, left}) => {
    const cx = left + HEX_W / 2 + BOARD_TO_DIALS.x;
    const cy = top + HEX_H / 2 + BOARD_TO_DIALS.y;
    const hw = HEX_W / 2;
    const hh = HEX_H / 2;
    return [
      {x: cx, y: cy - hh}, {x: cx + hw, y: cy - hh / 2}, {x: cx + hw, y: cy + hh / 2},
      {x: cx, y: cy + hh}, {x: cx - hw, y: cy + hh / 2}, {x: cx - hw, y: cy - hh / 2},
    ];
  });
}

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function insideConvex(p: Pt, poly: ReadonlyArray<Pt>): boolean {
  let sign = 0;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const s = Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    if (s !== 0 && sign !== 0 && s !== sign) {
      return false;
    }
    sign = s === 0 ? sign : s;
  }
  return true;
}

/** How far a point stands off the grid (0 inside a hex). */
export function largeGridClearance(p: Pt, grid: ReadonlyArray<ReadonlyArray<Pt>> = largeBoardGridPolygons()): number {
  let best = Infinity;
  for (const poly of grid) {
    if (Math.abs(poly[0].x - p.x) > 80 || Math.abs(poly[0].y - p.y) > 80) {
      continue;
    }
    if (insideConvex(p, poly)) {
      return 0;
    }
    for (let k = 0; k < poly.length; k++) {
      best = Math.min(best, segmentDistance(p, poly[k], poly[(k + 1) % poly.length]));
    }
  }
  return best;
}

/** How far a square chip (centre, side) stands off the grid — its outline sampled. */
export function largeChipClearance(centre: Pt, size: number, grid: ReadonlyArray<ReadonlyArray<Pt>> = largeBoardGridPolygons()): number {
  const h = size / 2;
  let worst = Infinity;
  for (let k = 0; k < 8; k++) {
    const t = -h + size * k / 8;
    for (const p of [{x: centre.x + t, y: centre.y - h}, {x: centre.x + h, y: centre.y + t}, {x: centre.x - t, y: centre.y + h}, {x: centre.x - h, y: centre.y - t}]) {
      worst = Math.min(worst, largeGridClearance(p, grid));
    }
  }
  return worst;
}

/** The clearance a chip inside the ring keeps from every hex. */
export const LARGE_CHIP_CLEARANCE = 4;

const keepOutCache = new Map<string, ReadonlyArray<readonly [number, number]>>();

/**
 * THE GRID'S KEEP-OUT on a chip row inside the ring: the clock-angle intervals (deg) in `[from, to]` where a square chip
 * of `size` centred at `radius` from `center` would come closer than `LARGE_CHIP_CLEARANCE` to a hex — the corner hexes
 * of the top row reach into the Venus row's inner side. Sampled every ¼°, from the grid's own construction; memoized.
 */
export function largeChipKeepOut(center: Pt, radius: number, size: number, from: number, to: number): ReadonlyArray<readonly [number, number]> {
  const key = `${center.x},${center.y},${radius},${size},${from},${to}`;
  const cached = keepOutCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const grid = largeBoardGridPolygons();
  const out: Array<[number, number]> = [];
  const STEP = 0.25;
  for (let a = Math.min(from, to); a <= Math.max(from, to); a += STEP) {
    const r = a * Math.PI / 180;
    const blocked = largeChipClearance({x: center.x + radius * Math.cos(r), y: center.y + radius * Math.sin(r)}, size, grid) < LARGE_CHIP_CLEARANCE;
    if (!blocked) {
      continue;
    }
    const last = out[out.length - 1];
    if (last !== undefined && a - last[1] <= STEP + 1e-9) {
      last[1] = a;
    } else {
      out.push([a, a]);
    }
  }
  // An interval's ends are the last BLOCKED samples — widen each by one sample so its edge is a free place.
  const intervals = out.map(([a, b]) => [a - STEP, b + STEP] as const);
  keepOutCache.set(key, intervals);
  return intervals;
}
