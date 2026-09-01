import {CardName} from '../cards/CardName';
import type {DeltaMovementBonusProjection} from './DeltaTrackPreviewModel';

/**
 * A CARD-GRANTED BONUS MOVE on the Delta Project («Гидросеть») track — the
 * structured, translation-proof description of the offer.
 *
 * WHY IT EXISTS. The offer reaches the client as an ordinary `OrOptions`, and
 * everything the workspace needs to present it — WHICH card granted it, where
 * the marker stands, where it would land, whether the step is free or buys a
 * tag waiver, and what that costs — lives in the option TITLES, which i18n
 * rewrites in place (cross-cutting invariant 1). So it is stated structurally
 * here instead, once, by the server that already decided all of it.
 *
 * THE SERVER IS AUTHORITATIVE. `energyCost` and `waivesTag` are not a
 * suggestion the client may re-derive: `BonusDeltaAdvance` asked the standard
 * movement pipeline (tags, wilds, requirement modifiers, VP occupancy, the end
 * of the track) and this is its verdict. The client never counts a tag, never
 * decides whether energy is owed, and never guesses whether the move is legal
 * — it renders this and submits the option index.
 *
 * THE SHAPE IS THE FAMILY, NOT THE CARD. Nothing here mentions Dynamic Ocean
 * Barrier: any future card that grants a move on this track fills in the same
 * fields (`source`, `steps`, `energyCost`, `waivesTag`) and reuses the whole
 * presentation — the same way `BonusDeltaAdvance` is the one server entry
 * point for such a move.
 *
 * Serialized centrally in `ServerModel.getWaitingFor`: a bonus offer is always
 * the TOP-LEVEL prompt (it is queued at `BACK_OF_THE_LINE`, after everything
 * the placement itself owed), so it can never arrive nested.
 */
export type DeltaAdvanceOffer = {
  /** The card that granted the move — the workspace's source card. */
  source: CardName;
  /** How many track positions the move covers (1 today; the field is the rule). */
  steps: number;
  /** Track position the marker stands on right now. */
  fromPosition: number;
  /** Track position the move would land on — the destination to highlight. */
  toPosition: number;
  /**
   * Energy the player pays for the move, decided by the server: 0 for a plain
   * bonus step, 1 when the offer is the tag waiver. Never the per-step price of
   * the STANDARD action — a bonus move does not pay that.
   */
  energyCost: number;
  /**
   * True ⇔ this offer covers exactly one otherwise-uncoverable required tag,
   * for THIS move only. Mutually exclusive with a free step by construction: a
   * move the player can already make is never sold to them.
   */
  waivesTag: boolean;
  /**
   * PASSIVE bonuses the move would pay the mover on top of the landing
   * stage's reward (Social Heating's heat) — the SAME server-authored
   * projection the planning preview carries per destination
   * (`DeltaTrackDestination.movementBonuses`), so a bonus move and a standard
   * one promise the outcome in one vocabulary. Absent when nothing is owed.
   */
  movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>;
};

/**
 * THE OFFER AS A STANDING SERVER PROMPT (Dynamic Ocean Barrier): the player did
 * not ask for it, so it arrives as an `OrOptions` and carries the two option
 * indices the console binds its CTA and its refusal to — never a title.
 *
 * The OTHER provenance of the very same offer is a CARD ACTION the player chose
 * (Storm Surge Barrier's advance mode). Nothing is on the wire there: the whole
 * pre-commit step is a client draft and the batch leaves only at the final
 * confirm, so there is no option index to bind and no «Skip» to offer — B is the
 * way out. That is exactly the difference the split expresses, and it is the
 * whole difference: everything the workspace PRESENTS comes from the base
 * {@link DeltaAdvanceOffer}, which both provenances fill identically.
 */
export type DeltaBonusPromptMeta = DeltaAdvanceOffer & {
  /**
   * The option index that TAKES the move, and the one that declines it — so the
   * console binds its CTA and its refusal without reading either title.
   */
  advanceIndex: number;
  skipIndex: number;
};
