import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Space} from './Space';
import {Board} from './Board';
import {SpaceType} from '../../common/boards/SpaceType';
import {TileType} from '../../common/TileType';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';
import {
  MovableTile, TileMoveBlock, TileMoveOffer, destinationsClockwise, markSiblingCells, tileMoveDestinations,
} from './tileMove';

/**
 * WHICH OCEAN MAY MOVE, AND WHERE (Turmoil Redux TR39 Canyon Carving:
 * «remove any 1 ocean tile from the board and place it in an adjacent space
 * that's reserved for ocean or not reserved at all») — the ONE reading the
 * play gate, the live prompt, its staged twin, the placement dossier and the
 * commit's own validation share. The project's second move set, in the one
 * offer shape (`boards/tileMove.ts`) the city's set speaks.
 *
 * WHO MAY MOVE — ANY plain ocean tile on the board: an ocean has no owner
 * (`simpleAddTile` seats it unowned), so «any 1 ocean tile» is every one of
 * them, whoever placed it — on an ocean reserve or on land (after Artificial
 * Lake, or after this very card). The reading of «ocean tile» is the Water
 * Export removal's (RX33, `RemoveOceanTile`): `getOceanSpaces({upgradedOceans:
 * false})` — a plain ocean, never a Wetlands.
 *
 * WHERE — the cells ADJACENT to the ocean out of TWO families, and the card
 * prints no «ignoring other placement restrictions», so the ordinary cell
 * rules stand:
 *   · RESERVED FOR OCEAN — an empty ocean-reserve cell nobody else claimed
 *     (`getAvailableSpacesForOcean`);
 *   · NOT RESERVED AT ALL — Artificial Lake's land (`getAvailableSpacesOnLand`
 *     with the ocean's own hazard rule): empty land, or an unprotected Ares
 *     hazard at its own price; never Noctis, never the Nomads camp, never
 *     another player's claim (the player's own claim is fine); an ocean pays
 *     no hazard-ADJACENCY penalty (`AresHandler.subjectToHazardAdjacency`).
 * A colony slot is neither family.
 *
 * WHO STAYS, and why — ONE reason per ocean tile, the more fundamental first:
 *   · `upgraded-ocean` — an Ocean City / Ocean Farm / Ocean Sanctuary / New
 *     Holland (and a Wetlands) is a special tile that only COUNTS as an ocean;
 *     the card moves an «ocean tile», which these are not (the removal reads
 *     it the same way). Listed, never hidden.
 *   · `ocean-no-space-to-move` — every adjacent cell is taken, reserved for
 *     something else, or too dear.
 *
 * Read-only: nothing here mutates the board.
 */

/** Why an ocean on the board cannot be the one that moves. */
export type OceanMoveBlock = Extract<TileMoveBlock, 'upgraded-ocean' | 'ocean-no-space-to-move'>;

/** ONE ocean that may move, and where to — `tiers: 1`, `arrives: OCEAN`, no card. */
export type MovableOcean = MovableTile;

/** The ocean's offer — the project's one move offer. */
export type OceanMoveOffer = TileMoveOffer;

/** Is this cell an ocean tile at all — plain or special — the population `oceanMoveOffer` partitions? */
function isAnyOceanTile(space: Space): boolean {
  return space.spaceType !== SpaceType.COLONY && Board.isOceanSpace(space);
}

/** A PLAIN ocean tile — the one kind the card may lift. */
export function isPlainOcean(space: Space): boolean {
  return space.tile?.tileType === TileType.OCEAN;
}

/**
 * EVERY cell an ocean may come to rest on, board-wide — the union of the two
 * families: empty ocean reserves, and Artificial Lake's land. `canAffordOptions`
 * folds the unpaid card's price into the hazard cells' affordability.
 */
export function oceanMoveCells(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
  const board = player.game.board;
  // Oceans are not subject to Ares hazard adjacency costs (Artificial Lake's own reading).
  return [...board.getAvailableSpacesForOcean(player), ...board.getAvailableSpacesOnLand(player, canAffordOptions, false)];
}

/**
 * The destinations of ONE ocean, clockwise from its east neighbour — the
 * order a cursor placed on «the first legal cell» is deterministic by.
 */
function destinationsOf(player: IPlayer, from: Space, canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
  const legal = new Set(oceanMoveCells(player, canAffordOptions).map((space) => space.id));
  return destinationsClockwise(player.game.board, from, legal);
}

/** Every ocean tile on the board, partitioned: those that may move (with where to) and those that may not (with why). */
export function oceanMoveOffer(player: IPlayer, canAffordOptions?: CanAffordOptions): OceanMoveOffer {
  const sources: Array<MovableOcean> = [];
  const disabledSources: Array<{space: Space, reason: OceanMoveBlock}> = [];
  for (const from of player.game.board.spaces) {
    if (!isAnyOceanTile(from)) {
      continue;
    }
    if (!isPlainOcean(from)) {
      disabledSources.push({space: from, reason: 'upgraded-ocean'});
      continue;
    }
    const to = destinationsOf(player, from, canAffordOptions);
    if (to.length === 0) {
      disabledSources.push({space: from, reason: 'ocean-no-space-to-move'});
      continue;
    }
    sources.push({from, tileType: TileType.OCEAN, tiers: 1, arrives: TileType.OCEAN, to, illegal: []});
  }
  // A cell the prompt offers to a sibling ocean, but not to this one.
  markSiblingCells(sources, 'not-adjacent-to-the-ocean');
  return {sources, disabledSources};
}

/** The oceans that may move — the shortcut every «is there a move at all» question reads. */
export function movableOceans(player: IPlayer, canAffordOptions?: CanAffordOptions): ReadonlyArray<MovableOcean> {
  return oceanMoveOffer(player, canAffordOptions).sources;
}

/** Every cell SOME ocean may move to, in the board's own order, each once — the prompt's `spaces`. */
export const oceanMoveDestinations = tileMoveDestinations;

/**
 * The prompt-level «why not» the move adds: a cell of either family that is
 * no neighbour of any ocean that could travel is `not-adjacent-to-the-ocean`.
 * Every other illegal cell keeps the generic reason (occupied, reserved-noctis,
 * owned-by-other, cannot-afford with its honest gap …). Asked only about cells
 * outside the offer's destinations.
 */
export function oceanMoveReasoner(player: IPlayer, offer: OceanMoveOffer): (space: Space) => PlacementIllegalReason | undefined {
  const board = player.game.board;
  const family = new Set(oceanMoveCells(player).map((space) => space.id));
  const travellers = [
    ...offer.sources.map((source) => source.from),
    ...offer.disabledSources.filter((entry) => entry.reason === 'ocean-no-space-to-move').map((entry) => entry.space),
  ];
  const neighbours = new Set(travellers.flatMap((from) => board.getAdjacentSpaces(from).map((space) => space.id)));
  return (space) => family.has(space.id) && !neighbours.has(space.id) ? 'not-adjacent-to-the-ocean' : undefined;
}
