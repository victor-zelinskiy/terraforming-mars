/*
 * THE PIECES ON A CELL — what physically lies there, bottom-up (Turmoil Redux
 * TR44 Aquatic Research Station: «place a city ON TOP OF AN OCEAN TILE IN
 * PLAY … the ocean underneath still grants its adjacency bonus»). Shared by
 * the server and the client because BOTH read it: the engine's «is there an
 * ocean here» (the nine-ocean count, the adjacency M€, the Capital's VP, a
 * card's requirement, the removal's and the move's candidate sets, the TR45
 * census) and the board's picture of the cell (the base, the tiers, the
 * mark of the piece the top no longer shows). ONE reading, so the number the
 * engine pays and the tile the player sees can never disagree.
 *
 * TWO TILES ON ONE CELL — the owner's ruling (2026-10-13) and the set's FAQ
 * (p. 18: «remove only the ocean at the bottom of the stack, and keep the
 * city in place»): a plain CITY placed over a plain OCEAN is TWO pieces, and
 * neither changes its kind. The city is an ordinary city everywhere a city is
 * asked about (Mayor, the greenery VP, a Skyscrapers tier, a Re-settlement
 * move); the ocean is an ordinary ocean everywhere an ocean is asked about
 * (the count toward nine, the +2 M€ to every tile placed beside it, the
 * Capital's point, a Canyon Carving move OUT FROM UNDER the city, a Water
 * Export removal). The model keeps one `tile` per cell: the city on top,
 * the ocean in its `covers` — the same field the Ares survey family already
 * reads as «the cell's printed bonus was not paid».
 *
 * A COMPOSITE TILE IS ONE PIECE — the same ruling, the other side: an Ocean
 * City / Ocean Farm / Ocean Sanctuary / New Holland is a single special tile
 * that COUNTS as a city and an ocean (`CITY_TILES` ∩ `OCEAN_TILES`). It too
 * records the ocean it replaced in `covers`, but that ocean is no longer a
 * piece of its own: nothing can move it out from under, nothing removes it
 * alone, the census counts one tile (`tests/boards/marsTileCensus.spec.ts`),
 * and `cityStandsOnOcean` keeps the composite from travelling. The rule that
 * tells the two apart is ONE function here (`buriedOceanUnder`): a covered
 * ocean is a piece exactly when the tile over it is not itself an ocean.
 *
 * THE SHAPE asked for is structural and serves both sides: the server's
 * `Space` (`tile.tileType`, `tile.covers`, `stackHeight`) and the client's
 * `SpaceModel` (`tileType`, `under`, `stackHeight` — `under` is what the
 * server publishes from THIS reading, so the client never re-derives the
 * composite rule). `cityStack.ts` keeps the tiers' arithmetic; this module
 * composes it with the buried ocean and is the ONE place `covers` is read as
 * a piece. The rule of the stack stands: a QUANTITY sums the pieces, a
 * PREDICATE about a cell reads the pieces and never guesses from the art.
 */
import {OCEAN_TILES, TileType} from '../TileType';
import {stackBuriedTile, stackTopTile, tiersOf} from './cityStack';

/**
 * The least a pieces reading needs of a cell — the server's `Space` (`tile`,
 * `stackHeight`) and the client's `SpaceModel` (`tileType`, `under`,
 * `stackHeight`) both satisfy it; a synthetic cell may give either form.
 */
export type PiecedCell = {
  tile?: {tileType: TileType, covers?: {tileType: TileType}};
  tileType?: TileType;
  under?: TileType;
  stackHeight?: number;
};

/** What lies on a cell, read once. */
export type CellPieces = {
  /** The tile the model names: the one tile of an ordinary cell, the BASE of a city stack. Undefined = empty. */
  tile: TileType | undefined;
  /** A plain OCEAN lying under `tile` as a piece of its own (TR44); undefined for every other cell. */
  under: TileType | undefined;
  /** How many tiles the stack of `tile` holds — 1 for any single tile, 0 for an empty cell. */
  tiers: number;
};

/**
 * THE COMPOSITE RULE — is the ocean a tile covers still a PIECE? Yes when the
 * tile above is not itself an ocean (a plain city, TR44); no when it is (an
 * Ocean City and its family absorb the water into their one tile).
 */
export function buriedOceanUnder(top: TileType | undefined, covers: TileType | undefined): TileType | undefined {
  if (top === undefined || covers !== TileType.OCEAN || OCEAN_TILES.has(top)) {
    return undefined;
  }
  return TileType.OCEAN;
}

/** The pieces of a cell — from either shape. */
export function piecesOf(cell: PiecedCell): CellPieces {
  const tile = cell.tile?.tileType ?? cell.tileType;
  const under = cell.under ?? buriedOceanUnder(tile, cell.tile?.covers?.tileType);
  return {tile, under, tiers: tiersOf({tile: tile === undefined ? undefined : {tileType: tile}, stackHeight: cell.stackHeight})};
}

/** The plain ocean lying under the cell's tile as a piece of its own — undefined otherwise. */
export function buriedOceanOf(cell: PiecedCell): TileType | undefined {
  return piecesOf(cell).under;
}

/** Is a PLAIN ocean on the cell at all — on top, or under an ordinary city? (the move's and the removal's source test) */
export function hasPlainOcean(cell: PiecedCell): boolean {
  const pieces = piecesOf(cell);
  return pieces.tile === TileType.OCEAN || pieces.under === TileType.OCEAN;
}

/** Is the TOP of the cell a plain ocean with nothing on it? (what a tile may be placed ON TOP OF) */
export function isPlainOceanTop(cell: PiecedCell): boolean {
  return piecesOf(cell).tile === TileType.OCEAN;
}

/**
 * Does the cell COUNT AS an ocean — `Board.isOceanSpace`'s one reading: a
 * tile of the ocean family on top (a plain ocean, a composite, Wetlands), or
 * a plain ocean lying under an ordinary city.
 */
export function countsAsOcean(cell: PiecedCell): boolean {
  const pieces = piecesOf(cell);
  return (pieces.tile !== undefined && OCEAN_TILES.has(pieces.tile)) || pieces.under !== undefined;
}

/** The tile ON TOP of the cell as the player sees it: a plain city once a tier stands on a city, else the cell's own tile. */
export function topTileOf(cell: PiecedCell): TileType | undefined {
  const pieces = piecesOf(cell);
  return pieces.tile === undefined ? undefined : stackTopTile(pieces.tile, pieces.tiers);
}

/**
 * THE PIECE THE TOP NO LONGER SHOWS — what the cell must MARK: the plain ocean
 * under an ordinary city (TR44), else a special city under a tier (the Capital
 * beneath a plain city — `stackBuriedTile`). The physically lowest piece wins
 * when both would apply. Undefined for a cell whose top says everything.
 */
export function buriedTileOf(cell: PiecedCell): TileType | undefined {
  const pieces = piecesOf(cell);
  return pieces.under ?? stackBuriedTile(pieces.tile, pieces.tiers);
}

/** HOW MANY PIECES lie on the cell — the stack's tiers plus the buried ocean (the census's count). */
export function pieceCountOf(cell: PiecedCell): number {
  const pieces = piecesOf(cell);
  return pieces.tiers + (pieces.under === undefined ? 0 : 1);
}
