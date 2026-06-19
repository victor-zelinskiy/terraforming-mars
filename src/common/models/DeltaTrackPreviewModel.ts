import {Tag} from '../cards/Tag';

/**
 * One reachable destination on the Delta Project ("Гидросеть") track, relative to
 * the player's current position. The server computes the canonical legality so the
 * UI never guesses.
 *
 * The preview covers EVERY remaining position (1..end-of-track), NOT only the
 * energy-affordable ones — so the player can click a distant stage to study what
 * it requires. `legal` = tags + VP occupancy OK (independent of energy);
 * `affordable` = within the player's energy. Confirm needs `legal && affordable`.
 */
export type DeltaTrackDestination = {
  /** Track positions advanced (also the energy cost). */
  steps: number;
  /** Absolute track position reached (currentPosition + steps). */
  position: number;
  /** Tags OK (path requirements met, wilds applied) AND not blocked by VP occupancy. */
  legal: boolean;
  /** Within the player's current energy (steps <= availableEnergy). */
  affordable: boolean;
  /** Extra energy needed beyond what the player has (0 when affordable). */
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
};

/**
 * The viewer's full planning preview, served by `/api/game/delta-preview`. The
 * track DISPLAY (every player's position + stop history) rides the public player
 * model; this is the viewer's action-zone planning data.
 */
export type DeltaTrackPreviewModel = {
  currentPosition: number;
  availableEnergy: number;
  usedThisGeneration: boolean;
  atEndOfTrack: boolean;
  /** Highest legal AND affordable step count (best confirmable move). Drives the default spend. */
  maxLegalSteps: number;
  /** Deepest energy-affordable step count — bounds the −/+ stepper. */
  maxEnergySteps: number;
  /** Deepest reachable step count on the track (= destinations.length) — bounds click-preview. */
  maxPreviewSteps: number;
  /** One entry per reachable step count 1..maxPreviewSteps (whole remaining track). */
  destinations: ReadonlyArray<DeltaTrackDestination>;
};
