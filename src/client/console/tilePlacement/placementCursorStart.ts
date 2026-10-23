/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CURSOR'S FIRST CELL (T15 · CD) — where the placement reticle stands when a pick opens.
 *
 * It used to be the legal hex nearest the centre of the board's on-screen box: a geometry of the SCREEN, blind to the
 * player. On the couch at 4K that is five to eight presses from where the player actually builds — a greenery's
 * legal set hugs the player's own tiles, a city's is the whole map. One law for every pick (staged or live, a tile or
 * a move's source level): the LEGAL cell nearest the CENTRE OF THE PLAYER'S OWN TILES on Mars, and the centre of the
 * board for a player with none yet. Distances are the board's own hex geometry (`miniCellCenter` — the one mapping
 * from the server grid to the plane), never the DOM, so the answer is the same on every profile and for a stage that
 * is still hidden. A tie goes to the cell nearer the board's centre, then to the lower id (deterministic). Off-grid
 * cells (the colony slots) have no plane position: they are never chosen here — a pick of only those keeps the
 * caller's own fallback.
 */
import {SpaceId} from '@/common/Types';
import {MINI_ROWS, miniCellCenter} from '@/common/boards/boardLayoutGeometry';

/** The bits of a board cell the law reads (a `SpaceModel` is one). */
export type CursorStartCell = {
  id: SpaceId;
  x: number;
  y: number;
  /** The tile standing on the cell, if any. */
  tileType?: unknown;
  /** The owner of the tile. */
  color?: string;
};

type Point = {cx: number, cy: number};

/** A cell's centre on the plane — undefined off the Mars grid (a colony slot, a negative row). */
function planeOf(cell: CursorStartCell): Point | undefined {
  const rowLen = MINI_ROWS[cell.y];
  if (rowLen === undefined || cell.x < 0) {
    return undefined;
  }
  return miniCellCenter(cell.x, cell.y, rowLen);
}

function centroid(points: ReadonlyArray<Point>): Point | undefined {
  if (points.length === 0) {
    return undefined;
  }
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.cx;
    cy += p.cy;
  }
  return {cx: cx / points.length, cy: cy / points.length};
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

/**
 * The legal cell the cursor opens on. `cells` is the board (every cell — the on-Mars ones carry the geometry),
 * `legal` the pick's own legal set, `viewer` the colour whose tiles anchor the pick.
 */
export function initialPlacementCursor(opts: {
  cells: ReadonlyArray<CursorStartCell>,
  legal: ReadonlyArray<SpaceId>,
  viewer: string,
}): SpaceId | undefined {
  const byId = new Map(opts.cells.map((c) => [c.id, c]));
  const onMars = opts.cells.map(planeOf).filter((p): p is Point => p !== undefined);
  const boardCentre = centroid(onMars);
  if (boardCentre === undefined) {
    return undefined;
  }
  const own = opts.cells
    .filter((c) => c.color === opts.viewer && c.tileType !== undefined)
    .map(planeOf)
    .filter((p): p is Point => p !== undefined);
  const anchor = centroid(own) ?? boardCentre;
  let best: {id: SpaceId, d: number, centre: number} | undefined;
  for (const id of opts.legal) {
    const cell = byId.get(id);
    const at = cell === undefined ? undefined : planeOf(cell);
    if (at === undefined) {
      continue;
    }
    const d = distance(at, anchor);
    const centre = distance(at, boardCentre);
    const better = best === undefined ||
      d < best.d - 1e-6 ||
      (Math.abs(d - best.d) <= 1e-6 && (centre < best.centre - 1e-6 || (Math.abs(centre - best.centre) <= 1e-6 && id < best.id)));
    if (better) {
      best = {id, d, centre};
    }
  }
  return best?.id;
}
