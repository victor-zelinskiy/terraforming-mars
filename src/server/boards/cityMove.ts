import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Space} from './Space';
import {Board} from './Board';
import {SpaceType} from '../../common/boards/SpaceType';
import {OCEAN_UPGRADE_TILES, TileType} from '../../common/TileType';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';
import {cityIgnoringRestrictions} from './ignoreRestrictionsCity';
import {
  MovableTile, TileMoveBlock, TileMoveOffer, destinationsClockwise, findTileMove, markSiblingCells, tileMoveDestinations,
  tileMovePromptModel,
} from './tileMove';

/**
 * WHICH OF A PLAYER'S CITIES MAY MOVE, AND WHERE (Turmoil Redux TR14
 * Re-settlement: «remove a city tile you own on Mars and place it in an
 * ADJACENT, NON-RESERVED, unoccupied space, ignoring other placement
 * restrictions») — the ONE reading the play gate, the live prompt, its staged
 * twin, the placement dossier and the commit's own validation share.
 *
 * The SHAPE of the answer is the project's one move offer (`boards/tileMove.ts`
 * — the same one the ocean's set speaks, TR39); this file decides only the
 * city's own population and cell rule.
 *
 * WHO MAY MOVE — a city tile of the player's own ON MARS
 * (`MarsBoard.getCitiesOnMars`: an ordinary city, the Capital, a city on the
 * Noctis cell; a city on a colony slot — Ganymede, Phobos, Venus — is not on
 * Mars; a neutral or another player's city is not theirs). A Skyscrapers
 * STACK is one source: its TOP tier moves (the set's FAQ), and what travels is
 * a plain city even off a Capital (`arrives`).
 *
 * WHERE — the cells ADJACENT to the city, out of the family's one cell rule
 * (`cityIgnoringRestrictions` with `adjacentTo`): land, no player tile, not an
 * ocean cell, not Noctis, not the Nomads camp, not another player's claim,
 * affordable (Ares); a cell beside any city is fine, an unprotected hazard is
 * coverable at its own price.
 *
 * WHO STAYS, and why — ONE reason per city, the more fundamental first:
 *   · `city-stands-on-ocean` — an Ocean City / New Holland is the special
 *     «city AND ocean» tile that exists only on top of an ocean. The card
 *     moves «it» — that same tile — and the only cells it offers are
 *     non-reserved, i.e. land: on land the tile would still count as an ocean,
 *     and a plain city may not be substituted for it. It is the player's city
 *     everywhere a city is counted; it simply has no cell to go to, ever. (A
 *     tier built ON such a tile is a plain city and moves like any tier.)
 *   · `no-space-to-move` — every adjacent cell is taken, reserved or too dear.
 * Such a city is LISTED (`disabledSources`), never hidden.
 *
 * Read-only: nothing here mutates the board.
 */

/** Why a city of the player's own cannot be the one that moves. */
export type CityMoveBlock = Extract<TileMoveBlock, 'city-stands-on-ocean' | 'no-space-to-move'>;

/** ONE city that may move, and where to — the project's one movable-tile shape. */
export type MovableCity = MovableTile;

/** The city's offer — the project's one move offer. */
export type CityMoveOffer = TileMoveOffer;

/**
 * Rule 4-bis: the tile on this cell is the special «city and ocean» tile
 * (Ocean City, New Holland) and it is the one that would travel — the cell
 * holds no tier above it.
 */
export function cityStandsOnOcean(space: Space): boolean {
  return space.tile !== undefined && OCEAN_UPGRADE_TILES.has(space.tile.tileType) && Board.tiersOf(space) === 1;
}

/** Is this cell a city of `player`'s own on Mars — the population `cityMoveOffer` partitions? */
export function isOwnCityOnMars(player: IPlayer, space: Space): boolean {
  return space.spaceType !== SpaceType.COLONY && Board.isCitySpace(space) && Board.spaceOwnedBy(space, player);
}

/**
 * The destinations of ONE city, clockwise from its east neighbour — the order
 * a cursor placed on «the first legal cell» is deterministic by.
 */
function destinationsOf(player: IPlayer, from: Space, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
  const legal = new Set(cityIgnoringRestrictions(player, {adjacentTo: from}, canAffordOptions).map((space) => space.id));
  return destinationsClockwise(player.game.board, from, legal);
}

/** Every city of the player's on Mars, partitioned: those that may move (with where to) and those that may not (with why). */
export function cityMoveOffer(player: IPlayer, canAffordOptions?: CanAffordOptions): CityMoveOffer {
  const sources: Array<MovableCity> = [];
  const disabledSources: Array<{space: Space, reason: CityMoveBlock}> = [];
  for (const from of player.game.board.getCitiesOnMars(player)) {
    const tile = from.tile;
    if (tile === undefined) {
      continue;
    }
    if (cityStandsOnOcean(from)) {
      disabledSources.push({space: from, reason: 'city-stands-on-ocean'});
      continue;
    }
    const to = destinationsOf(player, from, canAffordOptions);
    if (to.length === 0) {
      disabledSources.push({space: from, reason: 'no-space-to-move'});
      continue;
    }
    const tiers = Board.tiersOf(from);
    const source: MovableCity = {from, tileType: tile.tileType, tiers, arrives: tiers > 1 ? TileType.CITY : tile.tileType, to, illegal: []};
    if (tile.card !== undefined) {
      source.card = tile.card;
    }
    sources.push(source);
  }
  // A cell the prompt offers to a sibling city, but not to this one.
  markSiblingCells(sources, 'not-adjacent-to-the-city');
  return {sources, disabledSources};
}

/** The cities that may move — the shortcut every «is there a move at all» question reads. */
export function movableCities(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<MovableCity> {
  return cityMoveOffer(player, canAffordOptions).sources;
}

/** Every cell SOME city may move to, in the board's own order, each once — the prompt's `spaces`. */
export const cityMoveDestinations = tileMoveDestinations;

/** The one move the answer names, or undefined when the offer does not hold it. */
export const findCityMove = findTileMove;

/**
 * The prompt-level «why not» the move adds: a free land cell that is no
 * neighbour of any city that could travel is `not-adjacent-to-the-city`.
 * Every other illegal cell keeps the generic reason (occupied, ocean-only,
 * reserved-noctis, owned-by-other …) — and a NEIGHBOUR the offer left out was
 * left out for its price, so it falls through to the generic `cannot-afford`
 * with its honest gap. Asked only about cells outside the offer's
 * destinations.
 */
export function cityMoveReasoner(player: IPlayer, offer: CityMoveOffer): (space: Space) => PlacementIllegalReason | undefined {
  const board = player.game.board;
  const land = new Set(board.getAvailableSpacesOnLand(player).map((space) => space.id));
  const travellers = [
    ...offer.sources.map((source) => source.from),
    ...offer.disabledSources.filter((entry) => entry.reason === 'no-space-to-move').map((entry) => entry.space),
  ];
  const neighbours = new Set(travellers.flatMap((from) => board.getAdjacentSpaces(from).map((space) => space.id)));
  return (space) => land.has(space.id) && !neighbours.has(space.id) ? 'not-adjacent-to-the-city' : undefined;
}

/** The offer in the id vocabulary the client reads (`SelectSpaceModel.tileMove` / `StagedPlacementModel.tileMove`). */
export const cityMovePromptModel = tileMovePromptModel;
