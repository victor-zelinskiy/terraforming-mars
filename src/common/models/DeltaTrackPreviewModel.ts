import {Tag} from '../cards/Tag';
import {CardName} from '../cards/CardName';
import {Resource} from '../Resource';
import {Units} from '../Units';
import {DeltaBlockade} from './DeltaProjectPlayerModel';

/**
 * ONE passive movement bonus the viewer WOULD be paid for making a move — the
 * SERVER's own projection, not a hint the client may re-derive.
 *
 * A card may pay its owner for movement on this track whoever moved (Social
 * Heating: heat per actual step). When the viewer plans their OWN move, that
 * payment is part of the outcome and belongs beside the stage reward — so the
 * server states it here, per destination, as a finished reading: which card
 * owes it, what and how much, and the resulting «sejchas → stanet».
 *
 * AUTHORITATIVE AND SINGLE-SOURCED. `DeltaProjectExpansion.projectedMovementBonuses`
 * builds this by asking the very `deltaMovementBonus` hooks the COMMIT pays
 * out (`deltaMovement.ts`), with the actual, already-legality-checked step
 * count of that destination. The client never searches a tableau for a card
 * and never multiplies a planned step count — a promise the CTA makes here is
 * the payout by construction.
 */
export type DeltaMovementBonusProjection = {
  /** The card that owes it — the row's source, inspectable by name. */
  card: CardName;
  resource: Resource;
  /** Always > 0. */
  amount: number;
  /** The viewer's stock of `resource` before the move … */
  before: number;
  /** … and after it (two bonuses of one resource thread their readings). */
  after: number;
};

/**
 * One reachable destination on the Delta Project ("Гидросеть") track, relative to
 * the player's current position. The server computes the canonical legality so the
 * UI never guesses.
 *
 * The preview covers EVERY remaining position (1..end-of-track), NOT only the
 * affordable ones — so the player can click a distant stage to study what it
 * requires. `legal` = tags + VP occupancy OK (independent of the budget);
 * `affordable` = within the player's payment budget (energy, plus steel 1:1
 * while Delta Works is in the tableau). Confirm needs `legal && affordable`.
 */
export type DeltaTrackDestination = {
  /** Track positions advanced (also the energy-equivalent cost). */
  steps: number;
  /** Absolute track position reached (currentPosition + steps). */
  position: number;
  /** Tags OK (path requirements met, wilds applied) AND not blocked by VP occupancy. */
  legal: boolean;
  /** Within the player's payment budget (steps <= energy + steel substitute). */
  affordable: boolean;
  /** Energy-equivalent units missing beyond the whole budget (0 when affordable). */
  energyDeficit: number;
  /** The destination is a VP slot already occupied by another player. */
  occupied: boolean;
  /** Reaching position 11 (5 VP) by passing an occupied position 10 (2 VP). */
  jumpedOverVp2: boolean;
  /** Every path tag required to reach this position (track positions 1..9 up to it). */
  requiredTags: ReadonlyArray<Tag>;
  /** Path tags the player lacks (raw) but a wild tag covers. */
  wildCoveredTags: ReadonlyArray<Tag>;
  /** Path tags still uncovered even after wilds — non-empty ⇒ illegal by tags. */
  missingTags: ReadonlyArray<Tag>;
  /** The move's ORDERED reward plan (one entry per crossed/landed stage) —
   *  present only while a traversal modifier (Delta Surge) is live. See
   *  {@link DeltaTraversalStep}. */
  traversal?: ReadonlyArray<DeltaTraversalStep>;
  /**
   * PASSIVE bonuses this move would pay the viewer on top of the stage
   * reward(s) — server-authored, one entry per owed card. Absent when nothing
   * is owed, so the historical payload stays byte-identical for a table with
   * no such card in play. See {@link DeltaMovementBonusProjection}.
   */
  movementBonuses?: ReadonlyArray<DeltaMovementBonusProjection>;
};

/**
 * ONE crossed-or-landed stage of a single advance — the ordered reward plan
 * the SERVER authored for it. Present on a destination only while a tableau
 * modifier (Delta Surge) turns the intermediate stages into paying ones; the
 * unmodified track needs no plan (only the destination pays, which the client
 * already knows).
 *
 * The SAME builder (`DeltaProjectExpansion.traversalSteps`) produces this for
 * the preview and drives the committed advance, so the promise and the payout
 * cannot diverge. Positions run in PATH ORDER, `from+1 .. destination`.
 */
export type DeltaTraversalStep = {
  position: number;
  /** This stage's reward is granted by this move. The destination always is. */
  rewarded: boolean;
  /**
   * Why a crossed stage pays nothing:
   *  - 'vp-step' — the 2 VP stage's value is POSITIONAL (scored from the final
   *    marker position, the slot exclusive), so the modifier's own rule
   *    excludes it («Does not apply to the 2 VP step»);
   *  - 'standing-rule' — no modifier: intermediates never pay (the base rule).
   */
  skipped?: 'vp-step' | 'standing-rule';
};

/**
 * The viewer's full planning preview, served by `/api/game/delta-preview`. The
 * track DISPLAY (every player's position + stop history) rides the public player
 * model; this is the viewer's action-zone planning data.
 */
export type DeltaTrackPreviewModel = {
  currentPosition: number;
  availableEnergy: number;
  /**
   * Steel usable 1:1 in place of energy for the STANDARD advance (Delta Works
   * in the viewer's tableau) — 0 when the substitution is not live. The budget
   * behind `affordable`/`maxEnergySteps` is `availableEnergy + this`.
   */
  availableSteelSubstitute: number;
  /** The card granting the steel substitution (its source badge) — present iff
   *  `availableSteelSubstitute > 0`. */
  steelSubstituteCard?: CardName;
  /**
   * Modular Floodgates steel usable 1:1 in place of energy under the SAME
   * Delta Works substitution — its OWN pool beside `availableSteelSubstitute`
   * (deducted from the card, chosen explicitly, never auto-mixed). Present
   * iff > 0; the source card is Modular Floodgates by construction.
   */
  availableFloodgateSteelSubstitute?: number;
  /**
   * A MODULAR FLOODGATES blockade standing against the VIEWER: every forward
   * move is rule-blocked for this generation, whatever pays for or grants it.
   * When present, `maxLegalSteps` is 0 and nothing is confirmable — the
   * per-destination `legal` flags stay informational (studying a stage is not
   * an advance). Same shape as the player model's own record, so the plan
   * panel names the deployer and the source card from structured state.
   */
  blockade?: DeltaBlockade;
  usedThisGeneration: boolean;
  atEndOfTrack: boolean;
  /** Highest legal AND affordable step count (best confirmable move). Drives the default spend. */
  maxLegalSteps: number;
  /** Deepest affordable step count (energy + steel substitute) — bounds the −/+ stepper. */
  maxEnergySteps: number;
  /** Deepest reachable step count on the track (= destinations.length) — bounds click-preview. */
  maxPreviewSteps: number;
  /** One entry per reachable step count 1..maxPreviewSteps (whole remaining track). */
  destinations: ReadonlyArray<DeltaTrackDestination>;
  /** Used-this-generation blue card actions eligible for the pos 7 reuse reward —
   *  pre-collected in the overlay before confirm. */
  reuseActionCards: ReadonlyArray<CardName>;
  /**
   * The MANDATORY declarative stock cost of each reusable action, extracted by
   * the server from the card's own data-defined behavior (`action.spend`) —
   * the projected resource plan's per-candidate price. The client only ever
   * REPEATS ordered arithmetic over these numbers; it never computes a card
   * cost itself. Sparse: only candidates with a stock cost appear, so the
   * historical payload stays byte-identical when none of them has one.
   */
  reuseActionCosts?: Partial<Record<CardName, Partial<Units>>>;
  /** Cards that can receive the pos 9 animals — pre-collected before confirm. */
  animalTargetCards: ReadonlyArray<CardName>;
  /** The tableau card whose effect grants each crossed stage's reward on a
   *  multi-step advance (Delta Surge) — absent when none is live. The client
   *  presents it as the move's secondary MODIFIER, never as the source. */
  traversalModifierCard?: CardName;
};
