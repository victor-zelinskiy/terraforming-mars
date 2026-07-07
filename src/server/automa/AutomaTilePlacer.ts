import {Board} from '../boards/Board';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {failedAction} from './AutomaFailedAction';
import {marsBotOf} from './AutomaUtil';

/** Keep the items with the highest score. */
function keepMax(spaces: ReadonlyArray<Space>, score: (space: Space) => number): Array<Space> {
  const max = Math.max(...spaces.map(score));
  return spaces.filter((space) => score(space) === max);
}

/** Keep the items with the lowest score. */
function keepMin(spaces: ReadonlyArray<Space>, score: (space: Space) => number): Array<Space> {
  const min = Math.min(...spaces.map(score));
  return spaces.filter((space) => score(space) === min);
}

/**
 * MarsBot tile placement (rulebook pp.8–9): the per-tile adjacency priorities,
 * then the shared tiebreakers, then the tile itself through the ordinary
 * engine paths (addGreenery/addCity/addOcean) — so tile identity, journal
 * events, TR, oxygen, "any player" card triggers (Arctic Algae, Tharsis
 * Republic, ...) and the ocean-adjacency M€ all ride the standard machinery.
 * Only the printed space rewards differ: `Game.grantPlacementBonuses` grants
 * the bot 1 M€ per covered bonus icon instead.
 */
export class AutomaTilePlacer {
  private static adjacentOceans(game: IGame, space: Space): number {
    return game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length;
  }

  private static adjacentCitiesOf(game: IGame, space: Space, owner: IPlayer): number {
    return game.board.getAdjacentSpaces(space)
      .filter((adj) => Board.isCitySpace(adj) && adj.player?.id === owner.id).length;
  }

  private static adjacentOpponentCities(game: IGame, space: Space, bot: IPlayer): number {
    return game.board.getAdjacentSpaces(space)
      .filter((adj) => Board.isCitySpace(adj) && adj.player !== undefined && adj.player.id !== bot.id).length;
  }

  private static adjacentGreeneries(game: IGame, space: Space): number {
    return game.board.getAdjacentSpaces(space).filter(Board.isGreenerySpace).length;
  }

  /**
   * The shared tile placement tiebreakers (rulebook p.9):
   * 1. Adjacent to as many oceans as possible.
   * 2. Cover the most placement bonus icons possible.
   * 3. Determine randomly: flip a project card and count through the tied
   *    spaces top-left → right → next row (exactly the board.spaces order),
   *    looping as needed; place on the final space; discard the flipped card.
   */
  public static breakTie(game: IGame, candidates: ReadonlyArray<Space>): Space {
    if (candidates.length === 0) {
      throw new Error('breakTie requires at least one candidate');
    }
    let tied = keepMax(candidates, (space) => AutomaTilePlacer.adjacentOceans(game, space));
    if (tied.length > 1) {
      tied = keepMax(tied, (space) => space.bonus.length);
    }
    if (tied.length === 1) {
      return tied[0];
    }
    // board.spaces is built top row → bottom row, left → right within a row —
    // exactly the official counting order.
    const ordered = game.board.spaces.filter((space) => tied.includes(space));
    const flipped = game.projectDeck.draw(game);
    if (flipped === undefined) {
      // Draw+discard piles fully exhausted — practically unreachable. Stay deterministic.
      return ordered[0];
    }
    const cost = flipped.cost;
    game.projectDeck.discard(flipped);
    game.log('${0} flipped ${1} (cost ${2}) to break a placement tie', (b) =>
      b.player(marsBotOf(game)).card(flipped).number(cost));
    // Counting starts at 1 on the first tied space and loops. A cost of 0 is not
    // defined by the official text — normalized to the first space (OQ-5 in
    // AUTOMA_DATA_AUDIT.md).
    const index = cost <= 0 ? 0 : (cost - 1) % ordered.length;
    return ordered[index];
  }

  /**
   * "Place the greenery tile so that it is adjacent to as many of its own
   * cities while minimizing adjacency to any of your cities", on top of the
   * normal greenery rules (next to its own tiles when possible, not on
   * reserved spaces — the engine's getAvailableSpacesForGreenery).
   */
  public static placeGreenery(game: IGame): void {
    const bot = marsBotOf(game);
    const available = game.board.getAvailableSpacesForGreenery(bot);
    if (available.length === 0) {
      failedAction(game, 'no-tile-space');
      return;
    }
    let candidates = keepMax(available, (space) => AutomaTilePlacer.adjacentCitiesOf(game, space, bot));
    candidates = keepMin(candidates, (space) => AutomaTilePlacer.adjacentOpponentCities(game, space, bot));
    const space = AutomaTilePlacer.breakTie(game, candidates);
    game.addGreenery(bot, space);
  }

  /**
   * "MarsBot places a city tile adjacent to as much existing greenery as
   * possible" (any greenery), on top of the normal city rules (not adjacent to
   * other cities, not on reserved spaces).
   */
  public static placeCity(game: IGame): void {
    const bot = marsBotOf(game);
    const available = game.board.getAvailableSpacesForCity(bot);
    if (available.length === 0) {
      failedAction(game, 'no-tile-space');
      return;
    }
    const candidates = keepMax(available, (space) => AutomaTilePlacer.adjacentGreeneries(game, space));
    const space = AutomaTilePlacer.breakTie(game, candidates);
    game.addCity(bot, space);
  }

  /** "MarsBot places an ocean tile on any ocean-reserved space." */
  public static placeOcean(game: IGame): void {
    if (!game.canAddOcean()) {
      failedAction(game, 'oceans-complete');
      return;
    }
    const bot = marsBotOf(game);
    const available = game.board.getAvailableSpacesForOcean(bot);
    if (available.length === 0) {
      failedAction(game, 'no-tile-space');
      return;
    }
    const space = AutomaTilePlacer.breakTie(game, available);
    game.addOcean(bot, space);
  }
}
