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
import type {Tile} from '../Tile';
import type {AdjacencyBonus} from '../ares/AdjacencyBonus';
import type {IPlayer} from '../IPlayer';
import {TileType} from '../../common/TileType';
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

/** What `liftTopCity` took off a cell — everything the city carries to its next cell. */
export type LiftedCity = {
  /** The tile that travels: the cell's own tile for a single city, a plain CITY for the top tier of a stack. */
  tile: Tile;
  /** The Ares adjacency the tile stood with (the Capital's) — it leaves WITH a single tile, stays under a stack. */
  adjacency?: AdjacencyBonus;
  /** The co-owner of a single tile (The Moon's Hostile Takeover shape) — travels with it. */
  coOwner?: IPlayer;
  /** The cell's height before and after. `after: 0` = the cell is empty now. */
  tiers: {before: number, after: number};
};

/**
 * TAKE THE TOP CITY OFF A CELL (Turmoil Redux TR14 Re-settlement) — the lift
 * half of `Game.moveCityTile`, and the one function that knows what «the top
 * city» is.
 *
 *  · A STACK (Skyscrapers, height ≥ 2) gives up its top tier ONLY: the height
 *    drops by one (the key is REMOVED at 1 — an absent key IS height 1, the
 *    shape a reload produces), and the cell keeps its tile, its card, its
 *    owner and its adjacency. What travels is a plain city, even off a
 *    Capital — the tiers are identical objects, the base is the one tile the
 *    cell holds.
 *  · A SINGLE city leaves WHOLE, with its identity: the tile object (its
 *    `card` — the Capital's VP are counted by the cell that card stands on),
 *    its Ares `adjacency`, its co-owner. The cell is left bare land with no
 *    owner — `adjacency` cleared too, because an adjacency without an owner is
 *    what `AresHandler.earnAdjacencyBonuses` throws on.
 *
 * Mutates ONLY the cell. The caller owns everything about the game that is
 * not the cell (the St. Joseph cathedral list, the events, the landing).
 */
export function liftTopCity(space: Space): LiftedCity {
  if (space.tile === undefined || cityTiersOfCell(space) === 0) {
    throw new Error('No city to lift on ' + space.id);
  }
  const before = tiersOfCell(space);
  if (before > 1) {
    const after = before - 1;
    if (after === 1) {
      delete space.stackHeight;
    } else {
      space.stackHeight = after;
    }
    return {tile: {tileType: TileType.CITY}, tiers: {before, after}};
  }
  const lifted: LiftedCity = {tile: space.tile, tiers: {before, after: 0}};
  if (space.adjacency !== undefined) {
    lifted.adjacency = space.adjacency;
  }
  if (space.coOwner !== undefined) {
    lifted.coOwner = space.coOwner;
  }
  space.tile = undefined;
  space.player = undefined;
  delete space.stackHeight;
  delete space.adjacency;
  delete space.coOwner;
  return lifted;
}
