import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Board} from './Board';
import {Space} from './Space';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';

/**
 * A CITY «ON A NON-RESERVED SPACE …, IGNORING OTHER PLACEMENT RESTRICTIONS» —
 * the Turmoil Redux family that lifts the city rule instead of adding one:
 * TR16 Administration District (adjacent to one of YOUR cities), TR19 Sponsored
 * Settlement (anywhere non-reserved). ONE reading of the rule, so the sisters
 * can never disagree about which cell is legal.
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
 */
export type CityIgnoringRestrictionsOptions = {
  adjacentToOwnCity?: boolean,
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
  const land = player.game.board.getAvailableSpacesOnLand(player, canAffordOptions);
  return options.adjacentToOwnCity === true ? land.filter((space) => isAdjacentToOwnCity(player, space)) : land;
}

/**
 * The per-cell «why not» the rule adds — shared by the live prompt and the
 * staged preview. A land cell with no city of the player's own beside it is
 * `not-adjacent-to-your-city` (a cell beside ANOTHER player's city included);
 * every other illegal cell keeps the generic reason (occupied, ocean-only,
 * reserved-noctis, owned-by-other, cannot-afford …), which the generic
 * pipeline reaches before its own «adjacent to a city» check — so the lifted
 * rule is never quoted back at the player.
 */
export function cityIgnoringRestrictionsReasoner(
  player: IPlayer,
  options: CityIgnoringRestrictionsOptions): (space: Space) => PlacementIllegalReason | undefined {
  if (options.adjacentToOwnCity !== true) {
    return () => undefined;
  }
  const land = new Set(player.game.board.getAvailableSpacesOnLand(player).map((space) => space.id));
  return (space) => land.has(space.id) && !isAdjacentToOwnCity(player, space) ? 'not-adjacent-to-your-city' : undefined;
}
