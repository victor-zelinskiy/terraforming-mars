import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Board} from './Board';
import {Space} from './Space';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';

/**
 * A CITY «ON A NON-RESERVED SPACE …, IGNORING OTHER PLACEMENT RESTRICTIONS» —
 * the Turmoil Redux family that lifts the city rule instead of adding one:
 * TR16 Administration District (adjacent to one of YOUR cities), TR19 Sponsored
 * Settlement (anywhere non-reserved), TR14 Re-settlement (a city you own MOVES
 * to a cell adjacent to the one it stands on — the destinations of each city
 * are this rule with `adjacentTo`; which cities may move at all is
 * `boards/cityMove.ts`). ONE reading of the rule, so the sisters can never
 * disagree about which cell is legal.
 *
 * WHAT IS LIFTED: only the city's own placement rule — «a city may not be
 * adjacent to another city» (`MarsBoard.getAvailableSpacesForCity`, and the
 * Gordon / Kingdom of Tauraro variants of it). A cell next to another
 * player's city is therefore legal.
 *
 * WHAT STAYS («non-reserved» and the cell's own price): the engine's land set,
 * `Board.getAvailableSpacesOnLand` — the set every ordinary land placement
 * starts from, BEFORE the city rule narrows it:
 *   · a land-type cell (the board's own `getSpaces(LAND)` — coves and
 *     deflection zones where the board counts them as land); an OCEAN cell is
 *     reserved for oceans and stays out;
 *   · no tile on it — an UNPROTECTED Ares hazard is coverable as usual (a
 *     hazard is not a reservation), a protected one is not;
 *   · not the Noctis City cell, not the Mars Nomads camp, not a cell RESERVED
 *     for another player (Land Claim — one's own claim is one's own cell);
 *   · the cell's costs are affordable (Ares hazard removal / adjacency, with
 *     the caller's `canAffordOptions` — a staged play folds its unpaid price in).
 * Everything placing the city then pays is the ordinary city's
 * (`Game.addCity`): the cell's bonus, the ocean adjacency, every city trigger.
 *
 * `adjacentToOwnCity` (TR16): at least one NEIGHBOUR is a city of the player's
 * own — the Capital and any special city tile count (`Board.isCitySpace`), a
 * Skyscrapers stack is still the player's city, another player's city never
 * counts. Neighbours are Mars grid cells, so an off-Mars city (Ganymede,
 * Phobos) gives no adjacency by construction.
 *
 * `adjacentTo` (TR14): the cell is a NEIGHBOUR of this one cell — the city
 * that moves. The land set is read with that city still standing: nothing a
 * cell costs depends on a city tile next to it (a city's own Ares adjacency is
 * a bonus, never a surcharge), so the set is the one the commit will meet
 * after the lift.
 */
export type CityIgnoringRestrictionsOptions = {
  adjacentToOwnCity?: boolean,
  adjacentTo?: Space,
};

/** Is one of `space`'s neighbours a city of `player`'s own? */
export function isAdjacentToOwnCity(player: IPlayer, space: Space): boolean {
  return player.game.board.getAdjacentSpaces(space).some((adj) => Board.isCitySpace(adj) && Board.spaceOwnedBy(adj, player));
}

/** The legal cells — the ONE set the live prompt and the staged preview offer. */
export function cityIgnoringRestrictions(
  player: IPlayer,
  options: CityIgnoringRestrictionsOptions,
  canAffordOptions?: CanAffordOptions): ReadonlyArray<Space> {
  let land = player.game.board.getAvailableSpacesOnLand(player, canAffordOptions);
  if (options.adjacentToOwnCity === true) {
    land = land.filter((space) => isAdjacentToOwnCity(player, space));
  }
  if (options.adjacentTo !== undefined) {
    const neighbours = new Set(player.game.board.getAdjacentSpaces(options.adjacentTo).map((space) => space.id));
    land = land.filter((space) => neighbours.has(space.id));
  }
  return land;
}

/**
 * The per-cell «why not» the rule adds — shared by the live prompt and the
 * staged preview. A land cell with no city of the player's own beside it is
 * `not-adjacent-to-your-city` (a cell beside ANOTHER player's city included);
 * every other illegal cell keeps the generic reason (occupied, ocean-only,
 * reserved-noctis, owned-by-other, cannot-afford …), which the generic
 * pipeline reaches before its own «adjacent to a city» check — so the lifted
 * rule is never quoted back at the player. With `adjacentTo` (TR14) a free
 * land cell that is not a neighbour of the moving city is
 * `not-adjacent-to-the-city`.
 */
export function cityIgnoringRestrictionsReasoner(
  player: IPlayer,
  options: CityIgnoringRestrictionsOptions): (space: Space) => PlacementIllegalReason | undefined {
  if (options.adjacentToOwnCity !== true && options.adjacentTo === undefined) {
    return () => undefined;
  }
  const board = player.game.board;
  const land = new Set(board.getAvailableSpacesOnLand(player).map((space) => space.id));
  const neighbours = options.adjacentTo === undefined ? undefined :
    new Set(board.getAdjacentSpaces(options.adjacentTo).map((space) => space.id));
  return (space) => {
    if (!land.has(space.id)) {
      return undefined;
    }
    if (options.adjacentToOwnCity === true && !isAdjacentToOwnCity(player, space)) {
      return 'not-adjacent-to-your-city';
    }
    if (neighbours !== undefined && !neighbours.has(space.id)) {
      return 'not-adjacent-to-the-city';
    }
    return undefined;
  };
}
