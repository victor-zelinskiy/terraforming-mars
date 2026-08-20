import {SpaceType} from '../../common/boards/SpaceType';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {AutomaAres} from './AutomaAres';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {marsBotOf} from './AutomaUtil';

/**
 * «Place one of MarsBot's player markers on the map on a non-reserved area»
 * (B22 Settlers) — the bot's CLAIM, the exact twin of the community an
 * Arcadian Communities human places: a cube on a tile-less cell, no tile, no
 * placement bonus. Reserving is all it does; the reward comes later, when the
 * bot builds there.
 *
 * WHY A MARKER IS NOT A TILE. The engine already treats `space.player` on a
 * tile-less cell as a RESERVATION for that player — `Board.getAvailableSpacesOnLand`
 * refuses it to everyone else — so «only MarsBot may build on the areas
 * reserved by its player markers» needs no code at all: claiming IS the block.
 *
 * THE CANDIDATES are non-reserved land: no tile, no marker of ANY player
 * («a non-reserved area» — the bot may not stack a second marker on its own
 * claim either). Ares hazard cells are excluded like everywhere else the bot
 * touches the map (`AutomaAres.withoutHazardSpaces`) — the bot never deals
 * with hazards, and a claim it cannot later build on would be a wasted marker.
 *
 * THE TIEBREAKERS are the shared ones (rulebook p.9: most adjacent oceans →
 * most covered bonus icons → flip a card), with ONE printed insertion: «before
 * using the final tiebreak, MarsBot first looks for the space with the most
 * adjacent spaces that are RESERVED FOR OCEANS». That is the blue ocean-
 * reserved cells of the map, tiled or not — a different question from step 1,
 * which counts oceans already PLACED. Settlers therefore claims the shoreline
 * of the future, where its later builds will collect ocean adjacency.
 */
export class AutomaMarkerPlacer {
  /** Spaces the bot may claim: empty, unreserved, non-hazard land. */
  public static availableSpaces(game: IGame): ReadonlyArray<Space> {
    const bot = marsBotOf(game);
    const candidates = game.board.getAvailableSpacesOnLand(bot)
      .filter((space) => space.tile === undefined && space.player === undefined);
    return AutomaAres.withoutHazardSpaces(game, candidates);
  }

  /**
   * Claim one area. Returns the claimed space, or undefined when the map has
   * nothing left to claim — the CALLER decides what that means (B22 prints no
   * fallback, so it is a Failed Action there).
   */
  public static claimSpace(game: IGame): Space | undefined {
    const candidates = AutomaMarkerPlacer.availableSpaces(game);
    if (candidates.length === 0) {
      return undefined;
    }
    const bot = marsBotOf(game);
    const space = AutomaTilePlacer.breakTie(game, candidates,
      (candidate) => AutomaMarkerPlacer.adjacentOceanReserved(game, candidate));
    // The claim itself: a marker is `space.player` with no tile — the same
    // state the human Arcadian's community produces, so the board model, the
    // reservation rule and the client's owner-cube drop all read it the same.
    space.player = bot;
    game.log('${0} placed a Community (player marker)', (b) => b.player(bot));
    return space;
  }

  /** «Adjacent spaces that are RESERVED for oceans» — the blue cells, tiled or not. */
  private static adjacentOceanReserved(game: IGame, space: Space): number {
    return game.board.getAdjacentSpaces(space)
      .filter((adj) => adj.spaceType === SpaceType.OCEAN).length;
  }
}
