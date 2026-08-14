/*
 * THE ACTION WHEEL'S GREEN NUMBERS — one meaning, four categories.
 *
 * A green count is the number of things the player COULD do in the current game
 * state if it were their window — never "what the server is offering me on this
 * exact frame". The distinction is the whole reason this module exists: the
 * counts used to be read off `playerView.waitingFor` (the live prompt tree),
 * which only exists on the viewer's own turn, so «КАРТЫ 4» simply disappeared
 * the moment an opponent started thinking — the wheel stopped being a planning
 * instrument exactly when the player had time to plan.
 *
 * Every number here is the SERVER's own answer (`PublicPlayerModel.potentialActions`,
 * built from `getPlayableCards` / `getPlayableActionCards` / the Delta-track
 * validator / the colony trade validators). This module re-derives NO rule: it
 * only applies the two presentation facts the server cannot know —
 *
 *   · the INTAKE clamp: a drawn card mid-flight into the dock is not "in hand"
 *     on any HUD readout, so the playable count may never run ahead of the
 *     physical take (the same rule the dock's «КАРТЫ n/m» line obeys);
 *   · a category that is not in this game at all shows nothing.
 *
 * Pure — unit-tested by tests/client/components/console/potentialAvailability.spec.ts.
 */
import {NO_POTENTIAL_ACTIONS, PotentialActionsModel} from '@/common/models/PotentialActionsModel';

export type WheelCountsInput = {
  /**
   * The server's turn-independent projection, `undefined` on a model that
   * carries none (an opponent's seat, an older server) — then every count is 0
   * and the wheel simply shows no badge, which is the honest degradation.
   */
  potential: PotentialActionsModel | undefined;
  /**
   * The intake-aware hand total (`ConsoleShell.cardsTotalCount`): held /
   * in-flight / untaken-reveal copies already excluded.
   */
  handTotal: number;
  /** This game has colony tiles (the Trading category exists at all). */
  hasColonies: boolean;
  /** This game has the Delta Project / Hydronetwork expansion. */
  hasHydro: boolean;
};

export type WheelCounts = {
  /** Potentially playable project cards. */
  cards: number;
  /** Potentially performable card / corporation actions. */
  cardActions: number;
  /** 0 or 1 — a Hydronetwork advance is still potentially possible. */
  hydro: number;
  /** Remaining potential trade actions: min(tradeable colonies, free fleets). */
  trade: number;
};

/** The four wheel counts. Pure. */
export function wheelPotentialCounts(input: WheelCountsInput): WheelCounts {
  const p = input.potential ?? NO_POTENTIAL_ACTIONS;
  return {
    // Never ahead of the intake-aware total — a card still flying into the dock
    // is not in hand yet, however playable the rules say it is.
    cards: Math.max(0, Math.min(p.playableCards, input.handTotal)),
    cardActions: Math.max(0, p.cardActions),
    // A category absent from this game shows nothing at all rather than a 0.
    hydro: input.hasHydro ? Math.max(0, p.hydroAdvance) : 0,
    trade: input.hasColonies ? Math.max(0, p.colonyTrades) : 0,
  };
}
