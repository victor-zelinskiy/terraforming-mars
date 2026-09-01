import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {Resource} from '../Resource';
import {CardResource} from '../CardResource';
import {Tag} from '../cards/Tag';
import type {DeltaMovementBonusProjection} from './DeltaTrackPreviewModel';

/**
 * THE SERVER-AUTHORED PROJECTION of one Corporate Espionage (DP10) play — the
 * single source every surface reads: the card's availability, the target
 * selector, the ghost markers on the track, the reward copy, the setup
 * summary, the commit validation, the execution choreography and the tests.
 *
 * The client never re-derives a transition, a requirement or a reward from a
 * cell number: the projection states, per player, the exact `from → to` and
 * the exact resulting-stage outcome, computed by the same rule sources the
 * commit executes (`DeltaProjectExpansion.stageOutcomeProjection` is the pure
 * mirror of `resolveReward`, co-maintained beside it). A promise made here IS
 * the payout by construction.
 */

/** One alternative of a CHOICE stage's reward (positions 1/2). */
export type DeltaStageOutcomeOption = {
  resource: Resource;
  amount: number;
  /** true = a production step; absent = stock units. */
  production?: true;
};

/**
 * WHAT LANDING ON ONE STAGE PAYS one specific player — the pure projection of
 * `DeltaProjectExpansion.resolveReward`, per subject (a stage whose reward
 * depends on the player's own tableau/tags states THAT player's numbers).
 */
export type DeltaStageOutcomeProjection =
  /** A deterministic stock gain (position 6: 1 plant per plant tag — amount is the subject's own count). */
  | {kind: 'stock', resource: Resource, amount: number}
  /** A deterministic production gain (positions 3/4). */
  | {kind: 'production', resource: Resource, amount: number}
  /** A choice OWNED BY THE LANDING PLAYER (positions 1/2). */
  | {kind: 'choice', options: ReadonlyArray<DeltaStageOutcomeOption>}
  /** Look at `look` cards, keep `keep` (position 5) — the drawn identities stay private to the subject. */
  | {kind: 'draw', look: number, keep: number}
  /** Repeat a used blue-card action (position 7). `candidates` counts the
   *  subject's LIVE eligible cards — 0 is the honest fizzle. `candidateCards`
   *  names them (public tableau info) so the OWNER's pre-select can offer the
   *  pick; a target's pick stays the target's own prompt either way. */
  | {kind: 'repeat-action', candidates: number, candidateCards?: ReadonlyArray<CardName>}
  /** The one-shot Jovian tag (position 8) — `alreadyClaimed` names the no-op honestly. */
  | {kind: 'jovian-tag', alreadyClaimed: boolean}
  /** Add card resources to an eligible card (position 9) — the target card is
   *  the subject's own pick. `candidateCards` mirrors position 7's field. */
  | {kind: 'card-resource', resource: CardResource, amount: number, candidates: number, candidateCards?: ReadonlyArray<CardName>}
  /** A VP terminal (positions 10/11) — positional value, no stage reward. */
  | {kind: 'vp', amount: number}
  /** A cell with no stage reward (the start). */
  | {kind: 'none'};

/** Why an opponent cannot be pushed back. */
export type DeltaEspionageBlockedReason =
  /** «unless they are already at the VP level» — positions 10/11 are protected. */
  | 'vp-protected'
  /** The hard lower bound: a marker on the start cell cannot actually move back. */
  | 'track-start';

/** ONE opponent as an espionage target candidate — legal and blocked alike
 *  (no hidden target: a protected player is SHOWN with the reason). */
export type DeltaEspionageTargetProjection = {
  color: Color;
  fromPosition: number;
  /** Present iff the player can actually be moved (always `fromPosition − 1`). */
  toPosition?: number;
  legal: boolean;
  blocked?: DeltaEspionageBlockedReason;
  /** The reward THIS player would receive at the resulting stage. Absent when
   *  blocked, and when `rewardSkipped` names why no reward applies. */
  reward?: DeltaStageOutcomeProjection;
  /**
   * The landing reward does not apply to this player: MarsBot resolves the
   * Hydronetwork by the Solo Delta Project reference card, which takes NO row
   * rewards (see `AutomaDeltaProject`). The retreat itself is fully legal —
   * only the compensation clause is void for the bot, and the UI must SAY so
   * rather than show a reward that will never arrive.
   */
  rewardSkipped?: 'automa-rules';
};

/** The owner's own mandatory one-step advance. */
export type DeltaEspionageOwnerProjection = {
  color: Color;
  fromPosition: number;
  toPosition: number;
  /** The advance is legal (with the card's one-tag waiver already considered). */
  legal: boolean;
  /**
   * The ONE required path tag DP10's waiver covers for this step — present
   * iff the waiver is actually NEEDED (a fully-met path consumes nothing and
   * shows nothing).
   */
  waivedTag?: Tag;
  reward: DeltaStageOutcomeProjection;
  /** Passive movement bonuses the owner's own advance would pay (Social
   *  Heating) — the same server-authored shape every advance promise uses. */
  movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>;
};

export type DeltaEspionageProjectionModel = {
  source: CardName;
  owner: DeltaEspionageOwnerProjection;
  /** Every OTHER player in seating order. Never includes the owner. */
  targets: ReadonlyArray<DeltaEspionageTargetProjection>;
  /** True ⇔ at least one target is legal — the target pick is then MANDATORY. */
  hasLegalTarget: boolean;
};
