import {Space} from './Space';
import {TileType} from '../../common/TileType';
import {CardName} from '../../common/cards/CardName';
import {PlacementIllegalReason, PlacementIllegalSpace} from '../../common/inputs/PlacementIllegalReason';
import {TileMovePromptModel} from '../../common/boards/TileMove';
import {SpaceId} from '../../common/Types';

/**
 * A TILE MOVES — the ONE shape of «who may travel, and where» every move of
 * the project speaks (Turmoil Redux TR14 Re-settlement: a city of the
 * player's own; TR39 Canyon Carving: any plain ocean), whatever the tile.
 *
 * The SET of a move is the tile's own (`boards/cityMove.ts`, `boards/
 * oceanMove.ts` — each decides who may travel and which cells it may reach,
 * by its own rule sources); the OFFER they produce is this one type, so the
 * shared step (`deferredActions/MoveTile`), the prompt (`SelectSpace.tileMove`),
 * its staged twin, the wire model (`TileMovePromptModel`), the dossier's
 * hypothesis and the commit's validation read a move without knowing which
 * tile it is. A second offer type per tile would be the second contract the
 * contract forbids.
 *
 * Read-only: nothing here mutates the board.
 */

/** Why a tile that could be «the one that moves» cannot be it — ONE reason, the more fundamental first. */
export type TileMoveBlock = Extract<PlacementIllegalReason,
  'city-stands-on-ocean' | 'no-space-to-move' | 'upgraded-ocean' | 'ocean-no-space-to-move'>;

/** ONE tile that may move, and where to. */
export type MovableTile = {
  /** The cell the tile stands on. */
  from: Space;
  /** The tile standing on that cell (a stack's base). */
  tileType: TileType;
  /** The card recorded on that tile. */
  card?: CardName;
  /** The cell's height — 1 for anything but a city stack. */
  tiers: number;
  /** What lands on the destination: the tile itself, or a plain CITY for a stack's top tier. */
  arrives: TileType;
  /** The legal destinations, clockwise from the east neighbour. Never empty. */
  to: ReadonlyArray<Space>;
  /** The cells offered to a SIBLING source that this one cannot reach, with the reason. */
  illegal: ReadonlyArray<PlacementIllegalSpace>;
};

/**
 * Every candidate of the move's population, partitioned: the sources that
 * may travel (with where to) and those that may not (with why). Together
 * they are EXHAUSTIVE over the population — a source that cannot move is
 * LISTED, never hidden — so every other cell is, by the server's own
 * exclusion, «not one of the tiles this move is about».
 */
export type TileMoveOffer = {
  sources: ReadonlyArray<MovableTile>;
  disabledSources: ReadonlyArray<{space: Space, reason: TileMoveBlock}>;
};

/** The least a destination walk needs of a board — its adjacency (structural: the sets must not load the board classes). */
type Neighbourhood = {getAdjacentSpacesClockwise(space: Space): ReadonlyArray<Space | undefined>};

/**
 * The destinations of ONE source among `legal`, clockwise from its EAST
 * neighbour — the order a cursor placed on «the first legal cell» is
 * deterministic by. `getAdjacentSpacesClockwise` runs top-left, top-right,
 * RIGHT, bottom-right, bottom-left, left; the walk starts at RIGHT.
 */
export function destinationsClockwise(board: Neighbourhood, from: Space, legal: ReadonlySet<SpaceId>): ReadonlyArray<Space> {
  if (legal.size === 0) {
    return [];
  }
  const ring = board.getAdjacentSpacesClockwise(from);
  const fromEast = [...ring.slice(2), ...ring.slice(0, 2)];
  return fromEast.filter((space): space is Space => space !== undefined && legal.has(space.id));
}

/**
 * A cell the prompt offers to a SIBLING source, but not to this one, carries
 * this source's own reason (`reason`) — filled in place, once the offer's
 * destinations are known.
 */
export function markSiblingCells(sources: ReadonlyArray<MovableTile>, reason: PlacementIllegalReason): void {
  const offered = tileMoveDestinations({sources, disabledSources: []});
  for (const source of sources) {
    const own = new Set(source.to.map((space) => space.id));
    (source as {illegal: ReadonlyArray<PlacementIllegalSpace>}).illegal = offered
      .filter((space) => !own.has(space.id))
      .map((space) => ({spaceId: space.id, reason}));
  }
}

/** Every cell SOME source may move to, in the board's own order, each once — the prompt's `spaces`. */
export function tileMoveDestinations(offer: TileMoveOffer): ReadonlyArray<Space> {
  const seen = new Map<string, Space>();
  for (const source of offer.sources) {
    for (const space of source.to) {
      seen.set(space.id, space);
    }
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** The one move the answer names, or undefined when the offer does not hold it. */
export function findTileMove(offer: TileMoveOffer, from: string, to: string): {source: MovableTile, to: Space} | undefined {
  const source = offer.sources.find((candidate) => candidate.from.id === from);
  const destination = source?.to.find((space) => space.id === to);
  return source === undefined || destination === undefined ? undefined : {source, to: destination};
}

/** The offer in the id vocabulary the client reads (`SelectSpaceModel.tileMove` / `StagedPlacementModel.tileMove`). */
export function tileMovePromptModel(offer: TileMoveOffer): TileMovePromptModel {
  const model: TileMovePromptModel = {
    sources: offer.sources.map((source) => ({
      from: source.from.id,
      tileType: source.tileType,
      ...(source.card !== undefined ? {card: source.card} : {}),
      tiers: source.tiers,
      arrives: source.arrives,
      to: source.to.map((space) => space.id),
      ...(source.illegal.length > 0 ? {illegal: source.illegal} : {}),
    })),
  };
  if (offer.disabledSources.length > 0) {
    model.disabledSources = offer.disabledSources.map((entry) => ({spaceId: entry.space.id, reason: entry.reason}));
  }
  return model;
}
