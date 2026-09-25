/*
 * THE CITY STACK's arithmetic (Turmoil Redux — Skyscrapers, RX20), dependency-
 * free on purpose: `Space.stackHeight` is read HERE and nowhere else, so the
 * board classes, the countables (`behavior/Counter`), the global events and
 * the awards all sum the same number — and a module that must not load the
 * board classes (the countable sits under `Board`'s own import chain) still
 * reads the stack without a cycle.
 *
 * The rule of the stack: a QUANTITY of tiles / cities sums the height; a
 * PREDICATE about a cell («is this a city», «is it next to a city», «may a
 * tile go here») reads the cell alone and never asks it.
 */
import {Space} from './Space';
import {CITY_TILES} from '../../common/TileType';

/** HOW MANY TILES stand on the cell — the stack's height for a stacked city, 1 for any other tile, 0 for an empty cell. */
export function tiersOf(space: Space): number {
  return space.tile === undefined ? 0 : (space.stackHeight ?? 1);
}

/** HOW MANY CITIES stand on the cell: the stack's height for a city, 0 for anything else. */
export function cityTiersOf(space: Space): number {
  return space.tile !== undefined && CITY_TILES.has(space.tile.tileType) ? tiersOf(space) : 0;
}

/** The cities standing on a LIST of cells — the stacks summed. */
export function countCityTiers(spaces: ReadonlyArray<Space>): number {
  let total = 0;
  for (const space of spaces) {
    total += cityTiersOf(space);
  }
  return total;
}
