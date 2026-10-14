/*
 * THE PIECES ON A CELL, the server's door (Turmoil Redux TR44 Aquatic
 * Research Station — a city ON TOP OF an ocean: two tiles on one cell). The
 * rule itself lives in `common/boards/cellPieces.ts` (shared with the client,
 * which draws the cell from the same reading); this module types it over the
 * server's `Space` and holds the ONE lift of the buried piece. Dependency-free
 * on purpose: a module that must not load the board classes (`cityStack.ts`'s
 * own law) still reads the pieces without a cycle.
 *
 * THREE WRITERS touch two-piece cells, and all three read here:
 *   · `Game.simpleAddTile` records the ocean a tile lands on (`tile.covers`),
 *     for TR44's city and the Ares composites alike — ONE place;
 *   · `liftTopCity` (a city leaves — TR14) leaves the ocean standing, ownerless;
 *   · `liftOcean` (the ocean leaves — TR39 out from under, RX33 / the Reds'
 *     removal) leaves the city standing, its owner and its stack untouched.
 */
import type {Space} from './Space';
import type {Tile} from '../Tile';
import {
  buriedOceanOf as buriedOceanOfCell, hasPlainOcean as hasPlainOceanCell, isPlainOceanTop as isPlainOceanTopCell,
} from '../../common/boards/cellPieces';

/** The plain ocean TILE lying under the cell's own tile as a piece of its own (TR44) — undefined for every other cell. */
export function buriedOceanOf(space: Space): Tile | undefined {
  return buriedOceanOfCell(space) === undefined ? undefined : space.tile?.covers;
}

/** Is a PLAIN ocean on the cell at all — on top, or under an ordinary city? (TR39's and RX33's source test) */
export function hasPlainOcean(space: Space): boolean {
  return hasPlainOceanCell(space);
}

/** Is the TOP of the cell a plain ocean with nothing on it? (what TR44 and the Ares composites may be placed ON) */
export function isPlainOceanTop(space: Space): boolean {
  return isPlainOceanTopCell(space);
}

/**
 * THE OCEAN LEAVES A CELL — the one lift of a plain ocean (`Game.moveOceanTile`,
 * `Game.removeTile`, the dossier's hypothesis), from either of its places:
 *   · ON TOP (an ordinary ocean cell): the cell is bare — an ocean has no
 *     owner, no stack, no adjacency, no co-owner, so the tile is all there is
 *     to take;
 *   · UNDER AN ORDINARY CITY (TR44): only the ocean goes — the city keeps its
 *     place, its card, its owner and its stack (the set's FAQ, p. 18: «remove
 *     only the ocean at the bottom of the stack, and keep the city in place»);
 *     the cell's tile is rebuilt WITHOUT its `covers` (a fresh object, so a
 *     caller that saved the old one can put it back exactly — the preview's
 *     undo).
 * Returns the ocean tile that left. Throws when no plain ocean is on the cell —
 * a composite (Ocean City) is one tile and never gives its water up alone.
 */
export function liftOcean(space: Space): Tile {
  const tile = space.tile;
  if (tile === undefined) {
    throw new Error('No ocean to lift on ' + space.id);
  }
  if (isPlainOceanTopCell(space)) {
    space.tile = undefined;
    return tile;
  }
  const ocean = buriedOceanOf(space);
  if (ocean === undefined) {
    throw new Error('No plain ocean to lift on ' + space.id);
  }
  const {covers: _covers, ...standing} = tile;
  space.tile = standing;
  return ocean;
}
