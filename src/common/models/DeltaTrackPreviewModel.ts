import {Tag} from '../cards/Tag';

/**
 * One reachable-by-energy destination on the Delta Project ("Гидросеть") track,
 * relative to the player's current position. The server computes the canonical
 * legality so the UI never guesses.
 *
 * Energy bounds the DEPTH of the preview (`steps` <= available energy); tags bound
 * LEGALITY (`legal`) but NOT the preview depth — the player may explore an
 * out-of-reach destination to see which tags / reward it would require.
 */
export type DeltaTrackDestination = {
  /** Energy that would be spent (equals the number of track positions advanced). */
  steps: number;
  /** Absolute track position reached (currentPosition + steps). */
  position: number;
  /** Tags OK (all path requirements met, wilds applied) AND not blocked by VP occupancy. */
  legal: boolean;
  /** The destination is a VP slot already occupied by another player (cannot land here). */
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
 * The viewer's full planning preview for the Delta Project track action, served by
 * `/api/game/delta-preview`. The track DISPLAY (every player's position) rides the
 * public player model; this is purely the viewer's action-zone planning data.
 */
export type DeltaTrackPreviewModel = {
  currentPosition: number;
  availableEnergy: number;
  /** The once-per-generation track action has already been used this generation. */
  usedThisGeneration: boolean;
  /** Already at the final position (11) — no further advance possible. */
  atEndOfTrack: boolean;
  /** Highest legal step count (best confirmable move). 0 when none. Drives the default spend. */
  maxLegalSteps: number;
  /** Deepest energy-reachable step count (legal or not) — the preview's max depth. */
  maxPreviewSteps: number;
  /** One entry per reachable step count 1..maxPreviewSteps. */
  destinations: ReadonlyArray<DeltaTrackDestination>;
};
