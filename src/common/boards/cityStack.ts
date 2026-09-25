/*
 * THE CITY STACK's arithmetic (Turmoil Redux — Skyscrapers, RX20), shared by
 * the server and the client because BOTH count it: the engine's quantities
 * (`MarsBoard.countCities`, the countables, the global events, the awards)
 * and the parliament's board count that pays PER TIER (Migration Funding,
 * RX21 — the seat's cities on Mars, «each city in a stack counts
 * separately»), which the stand reads over synthetic cells. ONE rule, so a
 * number the panel promises and a number the engine pays can never diverge.
 *
 * Dependency-free on purpose: `stackHeight` is read HERE and nowhere else,
 * and the cell shape asked for is the least a stack needs — a tile (of some
 * kind) and its height. The server's `Space` and the stand's
 * `CountedSpaceFacts` both satisfy it structurally.
 *
 * The rule of the stack: a QUANTITY of tiles / cities sums the height; a
 * PREDICATE about a cell («is this a city», «is it next to a city», «may a
 * tile go here») reads the cell alone and never asks it.
 */
import {CITY_TILES, TileType} from '../TileType';

/** What a stack is made of: a tile of some kind, and how many of it stand on the cell (absent = 1). */
export type StackedCell = {
  tile?: {tileType: TileType};
  stackHeight?: number;
};

/** HOW MANY TILES stand on the cell — the stack's height for a stacked city, 1 for any other tile, 0 for an empty cell. */
export function tiersOf(cell: StackedCell): number {
  return cell.tile === undefined ? 0 : (cell.stackHeight ?? 1);
}

/** HOW MANY CITIES stand on the cell: the stack's height for a city, 0 for anything else. */
export function cityTiersOf(cell: StackedCell): number {
  return cell.tile !== undefined && CITY_TILES.has(cell.tile.tileType) ? tiersOf(cell) : 0;
}

/** The cities standing on a LIST of cells — the stacks summed. */
export function countCityTiers(cells: Iterable<StackedCell>): number {
  let total = 0;
  for (const cell of cells) {
    total += cityTiersOf(cell);
  }
  return total;
}
