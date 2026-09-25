/*
 * THE CITY STACK's arithmetic (Turmoil Redux — Skyscrapers, RX20), the
 * server's door to it. The rule itself lives in `common/boards/cityStack.ts`
 * — shared with the client since Migration Funding (RX21) pays PER TIER and
 * the stand must sum the same stacks the engine sums — and this module only
 * types it over the server's `Space`. Dependency-free on purpose: a module
 * that must not load the board classes (the countable sits under `Board`'s
 * own import chain) still reads the stack without a cycle.
 *
 * The rule of the stack: a QUANTITY of tiles / cities sums the height; a
 * PREDICATE about a cell («is this a city», «is it next to a city», «may a
 * tile go here») reads the cell alone and never asks it.
 */
import {Space} from './Space';
import {cityTiersOf as cityTiersOfCell, countCityTiers as countCityTiersOfCells, tiersOf as tiersOfCell} from '../../common/boards/cityStack';

/** HOW MANY TILES stand on the cell — the stack's height for a stacked city, 1 for any other tile, 0 for an empty cell. */
export function tiersOf(space: Space): number {
  return tiersOfCell(space);
}

/** HOW MANY CITIES stand on the cell: the stack's height for a city, 0 for anything else. */
export function cityTiersOf(space: Space): number {
  return cityTiersOfCell(space);
}

/** The cities standing on a LIST of cells — the stacks summed. */
export function countCityTiers(spaces: ReadonlyArray<Space>): number {
  return countCityTiersOfCells(spaces);
}
