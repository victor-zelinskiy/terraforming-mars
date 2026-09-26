/*
 * A COLONY TRACK ADVANCE, AND THE ROOM IT HAS (Turmoil Redux — Unity Budget, RX29).
 *
 * The first resolution whose enactment moves the COLONY TABLE: «Advance each
 * colony track 2 steps». Like a world move of a global parameter
 * (`parameterMove.ts`) it belongs to NOBODY — every colony tile in play
 * advances ONCE per enactment, the tiles with no cube on them and the bot's
 * alike (the track is the tile's, never a seat's) — and it is therefore a
 * WORLD step: run once, recorded with no player, read the same by every
 * viewer. A card declares the steps and nothing else; the family's ONE shared
 * step (`server/parliament/resolutions/ResolutionColonyTrack.ts`) pays it.
 *
 * WHAT A READING MAY HONESTLY SAY is each track's ROOM: where the marker
 * stands, where the declared steps would take it, and whether the end of the
 * track eats some of them. A track at its maximum does NOT pretend to have
 * moved — `applied: 0` with `atMax: true` is the sentence the surface prints
 * («трек на максимуме»); a track one short of it makes an honest single step.
 *
 * Pure, shared by the server (the step that pays, the contract guard) and the
 * client (the vote reading, the sitting's scene, the results, the stand). No
 * i18n, no DOM: every label is the reader's.
 */
import {ColonyName} from '../colonies/ColonyName';
import {MAX_COLONY_TRACK_POSITION} from '../constants';

/** THE DECLARATION: every colony track in play advances `steps` (> 0), once per enactment. */
export type ColonyTrackAdvance = {
  steps: number;
};

/** The step key the shared colony-track step reports under — the client finds the record by it (structural, never a title). */
export const COLONY_TRACK_STEP_KEY = 'colonyTracks';

/** ONE tile's move as the record keeps it: the marker's position before and after (equal when the track was at its end). */
export type ColonyTrackMove = {
  colony: ColonyName;
  before: number;
  after: number;
};

/** WHAT A DECLARED ADVANCE WOULD DO TO ONE TRACK RIGHT NOW. */
export type ColonyTrackRoom = {
  /** Where the marker stands. */
  current: number;
  max: number;
  /** The steps the advance ASKS for. */
  steps: number;
  /** …and the steps it would actually make, cut by the end of the track. */
  applied: number;
  /** The marker moves at all. */
  moves: boolean;
  /** Nothing moves because the marker already stands at the end of the track. */
  atMax: boolean;
  /** The position reached (== current when nothing moves). */
  resulting: number;
};

/**
 * The room of ONE track against the declared advance. Pure arithmetic over
 * the engine's own ceiling (`MAX_COLONY_TRACK_POSITION` — the very bound
 * `Colony.increaseTrack` clamps to): an advance stops at the end of the track.
 */
export function colonyTrackRoom(advance: ColonyTrackAdvance, current: number): ColonyTrackRoom {
  const max = MAX_COLONY_TRACK_POSITION;
  const steps = Math.max(0, Math.floor(advance.steps));
  const applied = Math.max(0, Math.min(steps, max - current));
  return {
    current,
    max,
    steps,
    applied,
    moves: applied > 0,
    atMax: current >= max,
    resulting: current + applied,
  };
}

/** The steps ONE recorded move actually made (0 for a track that stood at its end). */
export function colonyTrackMoveSteps(move: ColonyTrackMove): number {
  return Math.max(0, move.after - move.before);
}

/** A declared advance asks for a positive whole number of steps — the guard's own check. */
export function colonyTrackAdvanceDeclared(advance: ColonyTrackAdvance | undefined): advance is ColonyTrackAdvance {
  return advance !== undefined && Number.isInteger(advance.steps) && advance.steps > 0;
}

/** THE SKIP REASON of an advance with no track to move — no colony tile is in play at all (an English key). */
export const NO_COLONY_TRACK_REASON = 'No colony tile is in play';
