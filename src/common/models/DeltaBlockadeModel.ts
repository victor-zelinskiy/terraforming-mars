import {CardName} from '../cards/CardName';
import {Color} from '../Color';

/**
 * THE SERVER-AUTHORED PROJECTION of one Modular Floodgates (DP11) blockade
 * deployment — the single source every surface reads: the action variant's
 * availability, the target selector, the ghost blockade on the track, the
 * setup summary, the commit validation and the tests. The sibling of
 * {@link DeltaEspionageProjectionModel} (DP10), for the same reason: the
 * client never re-derives a target's eligibility from a cell number.
 *
 * Built twice on purpose, from the same functions both times: by
 * `actionPreview` (the selector and the summary read this payload) and by
 * `action()` at the commit request, where it becomes the input's own
 * validation baseline — so what the player saw and what the server checks are
 * the same derivation.
 */

/** Why an opponent cannot receive a blockade in front of their marker. */
export type DeltaBlockadeTargetBlockedReason =
  /** The printed «excluding the VP steps»: the cell in FRONT of this marker
   *  is a VP terminal, so no blockade may stand there. */
  | 'vp-protected'
  /** The marker stands on the last cell — there is no forward movement left
   *  to block. */
  | 'track-end'
  /** An equivalent blockade is already active against this player this
   *  generation — a second module adds no rule-valid effect. */
  | 'already-blocked';

/** ONE opponent as a blockade target candidate — legal and blocked alike
 *  (no hidden target: a protected player is SHOWN with the reason). */
export type DeltaBlockadeTargetProjection = {
  color: Color;
  /** The target's CURRENT track position (the marker does not move). */
  position: number;
  /** The cell the blockade would occupy (`position + 1`). Present iff legal. */
  blockadePosition?: number;
  legal: boolean;
  blocked?: DeltaBlockadeTargetBlockedReason;
};

export type DeltaBlockadeProjectionModel = {
  source: CardName;
  /** Steel resources currently ON the source card — the variant's own premise
   *  (`resourceCount`), restated so the selector can promise `N → N-1`. */
  cardSteel: number;
  /** Every OTHER player in seating order. Never includes the owner. */
  targets: ReadonlyArray<DeltaBlockadeTargetProjection>;
  /** True ⇔ at least one target is legal — the target pick is then MANDATORY. */
  hasLegalTarget: boolean;
  /** The generation the blockade would be active in (= the current one);
   *  it is removed at the start of generation `activeGeneration + 1`. */
  activeGeneration: number;
};
