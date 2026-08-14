/**
 * THE TURN-INDEPENDENT AVAILABILITY PROJECTION — «what could this player do, if
 * it were their action window right now».
 *
 * Every number here is computed from the REAL domain validators (the same
 * `canPlay` / `canAct` / trade / Delta-track rules the engine executes with),
 * with the TURN GATE deliberately left out: a decision is a domain fact about
 * the game state, and whose clock is running is not part of it. That is exactly
 * what the action wheel's green numbers must count, so they cannot vanish just
 * because an opponent took over (`docs/claude/console/potential-availability.md`).
 *
 * Self-model ONLY (like `CardModel.actionReasons`): it is the viewer's own
 * planning information and would leak an opponent's hand playability.
 *
 * NB «potential» never means «ignore the rules»: a used-up card action, a taken
 * Hydronetwork advance, a docked trade fleet and an unaffordable trade fee are
 * all domain facts and all bring their number down.
 */
export type PotentialActionsModel = {
  /**
   * Project cards (hand + Self-Replicating-Robots hosted) that pass every rule
   * right now — `Player.getPlayableCards()`, the very list the action menu
   * offers on the player's own turn.
   */
  playableCards: number;
  /**
   * Blue-card / corporation actions that pass their own `canAct` and have not
   * been used this generation — `Player.getPlayableActionCards()`.
   */
  cardActions: number;
  /**
   * 0 or 1: the Hydronetwork («Гидросеть») advance is still possible this
   * generation — the expansion is on, the player has not used it, a legal
   * destination exists and they can pay for it.
   */
  hydroAdvance: number;
  /**
   * How many more colony trades the player could execute:
   * `min(colonies legally tradeable now, free trade fleets)`, and 0 when no
   * payment path is usable at all (or the game embargoes trade).
   */
  colonyTrades: number;
};

/** An all-zero projection — the shape a client can safely default to. */
export const NO_POTENTIAL_ACTIONS: PotentialActionsModel = {
  playableCards: 0,
  cardActions: 0,
  hydroAdvance: 0,
  colonyTrades: 0,
};
