import {CardName} from '../cards/CardName';
import {Color} from '../Color';

/**
 * One landing on the Delta Project ("Гидросеть") track — a position the player
 * STOPPED on (and so received its reward), with the generation it happened and,
 * for a choice stage (positions 1/2), which reward alternative was taken.
 * Positions a player merely jumped OVER are NOT recorded (they get no reward),
 * so the client can tell "stopped + rewarded" from "passed through" by comparing
 * stops to the current position.
 */
export type DeltaStop = {
  position: number;
  generation: number;
  /** Chosen reward alternative index for a choice stage (0/1); omitted otherwise. */
  choice?: number;
  /**
   * The marker CROSSED this stage instead of landing on it, and it PAID anyway
   * — a traversal modifier was in play (Delta Surge, «Нагонная волна»).
   *
   * Without this the history had only two readings, «stopped here» and «not in
   * the list», and a crossed-but-paid stage fell into the second: the track
   * marked seven stages the player had just been paid for as «Прошёл мимо — без
   * награды». The client cannot re-derive it — whether a modifier was in the
   * tableau AT THE TIME is not in the view, and the card can leave.
   *
   * Absent = the historical landing (every save written before Delta Surge, and
   * every ordinary advance since).
   */
  crossed?: true;
};

/**
 * A MODULAR FLOODGATES (DP11) blockade standing against THIS player: their
 * forward Hydronetwork advancement is blocked for the generation it was
 * deployed in, whatever the movement's source (the standard action, a card
 * bonus move, the MarsBot resolution). PLAYER-TARGETED domain state, never a
 * property of one track cell — a legal backward move keeps it attached.
 *
 * Rides `deltaProjectData`, so it serializes, reconnects and reaches every
 * viewer with the ordinary player model (a blockade is public table state).
 * ACTIVE ⇔ `generation === game.generation`; the record is removed exactly
 * once at the start of the next generation (`DeltaProjectExpansion.
 * expireBlockades`), and a stale record is inert by construction — a reload
 * ON the boundary can never resurrect an expired blockade.
 */
export type DeltaBlockade = {
  /** The player who deployed it (provenance + the victim's notification). */
  by: Color;
  /** The source card (inspection + every blocked-reason surface). */
  card: CardName;
  /** The generation the blockade is active in. */
  generation: number;
};

export type DeltaProjectPlayerModel = {
  position: number;
  jovianBonus: boolean;
  // True once the player has advanced on the track this generation. Reset at the
  // start of each generation (runProductionPhase). Gates the once-per-generation
  // global "Гидросеть" action. Optional for backward-compatibility with saves
  // created before the Delta Project became a global subsystem action.
  usedThisGeneration?: boolean;
  // Landing history (positions the player stopped on + reward choice), oldest
  // first. Drives the per-stage history panel. Optional for old saves.
  stops?: Array<DeltaStop>;
  // An active Modular Floodgates blockade against this player. Optional for
  // every save written before DP11 existed.
  blockade?: DeltaBlockade;
}
