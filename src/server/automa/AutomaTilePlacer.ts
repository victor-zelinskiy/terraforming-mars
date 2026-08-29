import {Board} from '../boards/Board';
import {CanAffordOptions} from '../IPlayer';
import {GlobalParameter} from '../../common/GlobalParameter';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {AutomaAres} from './AutomaAres';
import {failedAction} from './AutomaFailedAction';
import {marsBotMapProfile} from './boards/MarsBotMapProfile';
import {
  HELLAS_SOUTH_POLE_REBATE,
  hellasSouthPoleUsable,
  isHellasSouthPole,
  needsSouthPoleRebate,
  settleHellasSouthPole,
} from './AutomaPlacementBonus';
import {marsBotOf} from './AutomaUtil';

/**
 * A tile placed by something other than a printed track icon.
 *
 * `restrict` is a card's HARD CONSTRAINT on the legal spaces (B10's Southern
 * Region, B11's board edge); `onEmpty` says what "nowhere to place" means for
 * that caller — a Failed Action (the printed icon) or a silently impossible
 * action (a Corporate Competition helper).
 */
export type BotTileOptions = {
  readonly restrict?: (space: Space) => boolean;
  readonly onEmpty?: 'failed-action' | 'impossible';
};

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
   * The tile placement tiebreakers — the MAP's own ordered list, then the card
   * flip (rulebook p.9; Adding Expansions p.10 for the per-board steps):
   *
   *   Tharsis: 1. adjacent to as many oceans as possible
   *            2. cover the most reward icons possible
   *   Hellas:  1. adjacent to as many oceans as possible
   *            2. Polar Region (bottom two rows)
   *            3. cover the most reward icons possible
   *
   *   last (every board): determine randomly — flip a project card and count
   *   through the tied spaces top-left → right → next row (exactly the
   *   board.spaces order), looping as needed; place on the final space;
   *   discard the flipped card.
   *
   * `beforeFlip` is an EXTRA tiebreaker a CARD may print between the board's
   * last step and the card flip — «before using the final tiebreak, MarsBot
   * first looks for …» (B22 Settlers: the most adjacent ocean-RESERVED spaces).
   * Highest score wins; absent for every ordinary placement, which keeps their
   * behaviour and their rng consumption byte-identical.
   */
  public static breakTie(
    game: IGame,
    candidates: ReadonlyArray<Space>,
    beforeFlip?: (space: Space) => number,
  ): Space {
    if (candidates.length === 0) {
      throw new Error('breakTie requires at least one candidate');
    }
    const bot = marsBotOf(game);
    let tied: ReadonlyArray<Space> = candidates;
    for (const tiebreaker of marsBotMapProfile(game.gameOptions.boardName).placementTiebreakers) {
      if (tied.length <= 1) {
        break;
      }
      tied = keepMax(tied, (space) => tiebreaker.score(game, bot, space));
    }
    if (tied.length > 1 && beforeFlip !== undefined) {
      tied = keepMax(tied, beforeFlip);
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
    // docs/AUTOMA_DATA_AUDIT.md).
    const index = cost <= 0 ? 0 : (cost - 1) % ordered.length;
    return ordered[index];
  }

  /**
   * "Place the greenery tile so that it is adjacent to as many of its own
   * cities while minimizing adjacency to any of your cities", on top of the
   * normal greenery rules (next to its own tiles when possible, not on
   * reserved spaces — the engine's getAvailableSpacesForGreenery).
   *
   * Returns whether the tile actually went down — the answer a HELPER ACTION
   * needs, and the reason this is the ONE pipeline every greenery rides: the
   * legality question and the placement are the same computation, so a caller
   * can never conclude "possible" from one list and then place from a
   * different, smaller one (Ares hazard filtering / a Hellas South Pole rebate
   * are inside here, not in the caller).
   */
  public static placeGreenery(game: IGame, options?: BotTileOptions): boolean {
    const bot = marsBotOf(game);
    // Ares: the bot never places ON a hazard (cleanup is a human economic
    // decision — see AutomaAres); identity without Ares.
    let available = AutomaAres.withoutHazardSpaces(game, AutomaTilePlacer.candidatesFor(game, bot,
      (opts) => game.board.getAvailableSpacesForGreenery(bot, opts)));
    // A card's HARD CONSTRAINT ("in the Southern Region", "adjacent to an
    // ocean") narrows the LEGAL set — it is not a preference and never a
    // tiebreaker, so it is applied before any strategy and an empty result is
    // final. B10's Desert Settler / Estate Dealer helpers are the two today.
    if (options?.restrict !== undefined) {
      available = available.filter(options.restrict);
    }
    if (available.length === 0) {
      // A printed track icon with nowhere to go is a Failed Action (rulebook
      // p.6). A helper action is instead «impossible to resolve»: the
      // Corporate Competition card moves on to the next funded award and
      // MarsBot pays nothing — so it must not spend a Failed Action here.
      if (options?.onEmpty !== 'impossible') {
        failedAction(game, 'no-tile-space');
      }
      return false;
    }
    let candidates = keepMax(available, (space) => AutomaTilePlacer.adjacentCitiesOf(game, space, bot));
    candidates = keepMin(candidates, (space) => AutomaTilePlacer.adjacentOpponentCities(game, space, bot));
    // Ares: strong hazard avoidance — after the printed strategy above, before
    // the generic tiebreakers, so a hazard-adjacent space survives only when it
    // strictly wins on the greenery's own placement criteria.
    candidates = [...AutomaAres.preferAwayFromHazards(game, candidates)];
    const space = AutomaTilePlacer.breakTie(game, candidates);
    AutomaTilePlacer.placeAndSettle(game, bot, space, () => game.addGreenery(bot, space));
    return true;
  }

  /**
   * "MarsBot places a city tile adjacent to as much existing greenery as
   * possible" (any greenery), on top of the normal city rules (not adjacent to
   * other cities, not on reserved spaces).
   *
   * Returns whether the tile went down — the greenery twin above explains why
   * the legality question and the placement have to be the same computation.
   */
  public static placeCity(game: IGame, options?: BotTileOptions): boolean {
    const bot = marsBotOf(game);
    // Ares: never ON a hazard; identity without Ares (see placeGreenery).
    let available = AutomaAres.withoutHazardSpaces(game, AutomaTilePlacer.candidatesFor(game, bot,
      (opts) => game.board.getAvailableSpacesForCity(bot, opts)));
    if (options?.restrict !== undefined) {
      available = available.filter(options.restrict);
    }
    if (available.length === 0) {
      // See placeGreenery: a printed icon spends a Failed Action, a helper
      // action is simply «impossible to resolve» and costs the bot nothing.
      if (options?.onEmpty !== 'impossible') {
        failedAction(game, 'no-tile-space');
      }
      return false;
    }
    let candidates = keepMax(available, (space) => AutomaTilePlacer.adjacentGreeneries(game, space));
    // Ares: strong hazard avoidance after the printed city strategy.
    candidates = [...AutomaAres.preferAwayFromHazards(game, candidates)];
    const space = AutomaTilePlacer.breakTie(game, candidates);
    AutomaTilePlacer.placeAndSettle(game, bot, space, () => game.addCity(bot, space));
    return true;
  }

  /**
   * The bot's candidate list for a land placement.
   *
   * Identical to the plain engine call on every board — EXCEPT that a
   * conditional pay-to-use hex stays legal for MarsBot even when it cannot pay
   * (Hellas' South Pole: «if MarsBot places on here, it doesn't gain or lose
   * anything», Adding Expansions p.11). The engine is asked the very same
   * legality question a second time with that hex's bonus cost rebated, so
   * every OTHER rule still decides — and the rebated list is used for nothing
   * but recovering that one hex.
   */
  private static candidatesFor(
    game: IGame,
    bot: IPlayer,
    spaces: (options?: CanAffordOptions) => ReadonlyArray<Space>,
  ): ReadonlyArray<Space> {
    const available = spaces();
    if (!needsSouthPoleRebate(game, bot)) {
      return available;
    }
    const southPole = spaces({cost: HELLAS_SOUTH_POLE_REBATE, tr: {}})
      .find((space) => isHellasSouthPole(game, space));
    return southPole === undefined || available.includes(southPole) ?
      available :
      [...available, southPole];
  }

  /**
   * Put the tile down, then settle whatever the HEX itself owes — today only
   * Hellas' South Pole, whose printed transaction («places an ocean, loses
   * 6 M€») runs after the tile lands. Usability is read BEFORE the placement:
   * the tile can pay the bot ocean-adjacency M€, and a hex ranked as
   * reward-less must not turn into an ocean because that money just arrived.
   */
  private static placeAndSettle(game: IGame, bot: IPlayer, space: Space, place: () => void): void {
    if (!isHellasSouthPole(game, space)) {
      place();
      return;
    }
    const usable = hellasSouthPoleUsable(game, bot);
    place();
    settleHellasSouthPole(bot, usable, () => AutomaTilePlacer.placeOcean(game));
  }

  /**
   * "MarsBot places an ocean tile on any ocean-reserved space."
   * Ares deliberately changes NOTHING here: ocean tiles are exempt from hazard
   * adjacency (see Game.addTile's `subjectToHazardAdjacency`) and hazards never
   * occupy ocean-reserved spaces, so there is neither a cost to avoid nor a
   * consequence to apply.
   */
  public static placeOcean(game: IGame): void {
    // «…or place an ocean» — the ocean action is one of the four a
    // corporation may take over (C36).
    if (AutomaCorporations.replacesParameterRaise(game, GlobalParameter.OCEANS)) {
      return;
    }
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
