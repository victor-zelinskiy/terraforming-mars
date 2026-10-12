/*
 * THE CENSUS OF TILES ON MARS — «1 microbe for each tile on Mars» (Turmoil
 * Redux TR45 Composting Initiative) and every later rule that counts the
 * planet's tiles of ANY player. Shared by the server and the client for the
 * reason `cityStack.ts` is: the number a card pays, the composition the
 * composer explains it with and the cells the board peek lights are ONE
 * reading, so they can never disagree.
 *
 * WHAT IS A TILE ON MARS (the owner's decision, 2026-10-12 — the census's
 * edges, read by `tests/boards/marsTileCensus.spec.ts` as a table):
 *  - every PHYSICAL tile standing on a cell of the Mars grid, of any owner —
 *    a player's, MarsBot's, the solo neutral's, an ownerless ocean;
 *  - a city STACK (Skyscrapers, RX20) is as many tiles as it has tiers — the
 *    stack's own law: a quantity of tiles sums the height (`tiersOf`);
 *  - an UPGRADED ocean (Ocean City / Ocean Farm / Ocean Sanctuary / New
 *    Holland) is ONE tile — the engine keeps one, TR39 never moves it as an
 *    ocean;
 *  - NOT a tile: an Ares HAZARD («hazard tiles don't really count as tiles»,
 *    `Board.hasRealTile`), a neutral CUBE kept in `space.tile` so it renders
 *    (`CUBE_TILES` — Martian Nature Wonders, Rey Skywalker), a marker with no
 *    tile at all (Land Claim, the Mars Nomads camp, Underworld tokens), a Moon
 *    tile (its own board);
 *  - NOT on Mars: every off-board cell (`SpaceType.COLONY` — Ganymede, Phobos,
 *    the Venus cities, TR27 Aurora Station, TR22 Nova City on its colony tile).
 * Exclusions are NAMED, never silent: a number that does not match the board
 * the player sees must say why (`excluded`).
 *
 * THE KIND OF A TILE (the composition the player checks against the board) is
 * a PARTITION — every tile in exactly one kind, by the first that matches:
 * city (`CITY_TILES` — the Capital, Ocean City, New Holland), greenery
 * (`GREENERY_TILES` — Wetlands), ocean (the rest of `OCEAN_TILES` — Ocean
 * Farm, Ocean Sanctuary), else special.
 *
 * TR44 FORWARD: Aquatic Research Station puts a city ON TOP of an ocean (the
 * rulebook FAQ p.18 — two tiles on one cell). The census asks «what pieces
 * stand on this cell» (`marsTilePiecesOn`), so that card adds its buried
 * ocean there in one line, and the total, the kinds and the cells follow.
 *
 * Dependency-free on purpose: the cell shape asked for is structural (the
 * server's `Space` and the client's `SpaceModel` both satisfy it).
 */
import {SpaceId} from '../Types';
import {SpaceType} from './SpaceType';
import {CITY_TILES, CUBE_TILES, GREENERY_TILES, HAZARD_TILES, OCEAN_TILES, TileType} from '../TileType';
import {tiersOf} from './cityStack';

/** What the census reads of a cell: where it is, the tile on it and how high it stands. */
export type CensusCell = {
  id: SpaceId;
  spaceType: SpaceType;
  tile?: {tileType: TileType};
  stackHeight?: number;
};

/** The kinds a tile on Mars is counted in — the composition, in the order it is read. */
export type MarsTileKind = 'city' | 'greenery' | 'ocean' | 'special';
export const MARS_TILE_KINDS: ReadonlyArray<MarsTileKind> = ['city', 'greenery', 'ocean', 'special'];

/** Why something standing on a cell is NOT a tile on Mars — named, in the order it is read. */
export type MarsTileExclusion = 'off-mars' | 'hazard' | 'cube';
export const MARS_TILE_EXCLUSIONS: ReadonlyArray<MarsTileExclusion> = ['off-mars', 'hazard', 'cube'];

/** One share of the census: how many, and on which cells (a cell carrying two pieces of one share is listed once). */
export type MarsTileCensusPart<K extends string> = {kind: K, count: number, spaces: ReadonlyArray<SpaceId>};

export type MarsTileCensus = {
  /** The number a «per tile on Mars» rule pays — Σ `parts[].count`. */
  total: number;
  /** The kinds with at least one tile, in `MARS_TILE_KINDS` order. */
  parts: ReadonlyArray<MarsTileCensusPart<MarsTileKind>>;
  /** What stands on the board and is NOT counted, in `MARS_TILE_EXCLUSIONS` order (absent kinds omitted). */
  excluded: ReadonlyArray<MarsTileCensusPart<MarsTileExclusion>>;
};

/** The kind a tile type is counted in — the partition's first match. */
export function marsTileKindOf(tileType: TileType): MarsTileKind {
  if (CITY_TILES.has(tileType)) {
    return 'city';
  }
  if (GREENERY_TILES.has(tileType)) {
    return 'greenery';
  }
  if (OCEAN_TILES.has(tileType)) {
    return 'ocean';
  }
  return 'special';
}

/** Why the cell's tile is not a tile on Mars — `undefined` for a counted tile and for an empty cell. */
export function marsTileExclusionOf(cell: CensusCell): MarsTileExclusion | undefined {
  if (cell.tile === undefined) {
    return undefined;
  }
  if (HAZARD_TILES.has(cell.tile.tileType)) {
    return 'hazard';
  }
  if (CUBE_TILES.has(cell.tile.tileType)) {
    return 'cube';
  }
  if (cell.spaceType === SpaceType.COLONY) {
    return 'off-mars';
  }
  return undefined;
}

/**
 * THE PHYSICAL PIECES ON ONE CELL — what a «per tile» rule counts there, by
 * kind: the stack's tiers in the base tile's kind (a stack is built of plain
 * cities on a city — `cityStack.ts`), nothing for an empty cell. The ONE place
 * a cell's piece count is decided (TR44 adds its buried ocean here).
 */
export function marsTilePiecesOn(cell: CensusCell): ReadonlyArray<{kind: MarsTileKind, count: number}> {
  if (cell.tile === undefined) {
    return [];
  }
  return [{kind: marsTileKindOf(cell.tile.tileType), count: tiersOf(cell)}];
}

/**
 * THE CENSUS over a list of cells — the board's, already narrowed by the
 * caller to whose tiles count (`all: false` — the player's own) and to the
 * neighbours of a tile (`nextToThis`). Read-only, order-preserving: a part's
 * cells are in the order of the list.
 */
export function marsTileCensus(cells: Iterable<CensusCell>): MarsTileCensus {
  const kinds = new Map<MarsTileKind, {count: number, spaces: Array<SpaceId>}>();
  const excluded = new Map<MarsTileExclusion, {count: number, spaces: Array<SpaceId>}>();
  const add = <K>(into: Map<K, {count: number, spaces: Array<SpaceId>}>, key: K, count: number, id: SpaceId): void => {
    if (count <= 0) {
      return;
    }
    const entry = into.get(key) ?? {count: 0, spaces: []};
    entry.count += count;
    if (!entry.spaces.includes(id)) {
      entry.spaces.push(id);
    }
    into.set(key, entry);
  };
  for (const cell of cells) {
    const exclusion = marsTileExclusionOf(cell);
    if (exclusion !== undefined) {
      add(excluded, exclusion, tiersOf(cell), cell.id);
      continue;
    }
    for (const piece of marsTilePiecesOn(cell)) {
      add(kinds, piece.kind, piece.count, cell.id);
    }
  }
  const parts = MARS_TILE_KINDS.flatMap((kind) => {
    const e = kinds.get(kind);
    return e === undefined ? [] : [{kind, count: e.count, spaces: e.spaces}];
  });
  return {
    total: parts.reduce((n, p) => n + p.count, 0),
    parts,
    excluded: MARS_TILE_EXCLUSIONS.flatMap((kind) => {
      const e = excluded.get(kind);
      return e === undefined ? [] : [{kind, count: e.count, spaces: e.spaces}];
    }),
  };
}
