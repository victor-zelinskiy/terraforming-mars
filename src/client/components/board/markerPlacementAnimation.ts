/*
 * markerPlacementAnimation — the arrival beat of an OVERLAY MARKER: a token
 * that lands ON an existing tile instead of filling an empty cell. Today the
 * only one a player deliberately places is St. Joseph's cathedral (the mission
 * builds it IN a city, which is why the city tile stays visible during the
 * pick — see placementRenderState).
 *
 * Why a sibling of `tilePlacementAnimation` rather than a case inside it: the
 * tile framework's whole vocabulary is `space.tileType: undefined → defined`
 * (it verifies exactly that, and the console placement HERO refuses anything
 * else). A marker changes NO tile — `space.cathedral` flips to `true` over an
 * untouched city — so it fell through every existing entrance and simply
 * POPPED into the board, in the same frame as the follow-up prompt it causes.
 *
 * This module mirrors the tile framework's proven shape 1:1:
 *   - a module-level BASELINE map, so the `<player-home :key="playerkey">`
 *     remount (and every poll) can't replay a landing;
 *   - an ACTIVE map, so a mid-flight remount RESUMES (negative animation-delay)
 *     instead of restarting from frame 0;
 *   - the SAME `arePlacementAnimationsArmed()` window, so the initial render of
 *     a board that already has cathedrals (F5 / share-link join) stays silent;
 *   - `shouldHoldFor…` + `apply…Preview` for WaitingFor's commit gate.
 *
 * The hold here is the FULL animation (not the tile framework's shorter
 * perceptual window): a marker landing is what CAUSES the city owner's
 * "pay 2 M€ to draw a card" prompt, and a decision modal must never open over
 * its own explanation.
 */

import {SpaceId} from '@/common/Types';
import {SpaceModel} from '@/common/models/SpaceModel';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {motionMs} from '@/client/components/motion/motionTokens';
import {arePlacementAnimationsArmed} from './tilePlacementAnimation';

/**
 * Total CSS animation length on the marker element (`marker-placement-drop` in
 * board_placement_animation.less): the token descends onto the tile, contacts
 * with a short damped settle, and its halo retires. Deliberately shorter than
 * a full tile placement — a marker is a smaller object with less mass.
 */
export const MARKER_PLACEMENT_ANIMATION_MS = 620;
/** Reduced motion: one short controlled fade-in, no travel, no halo. */
export const MARKER_PLACEMENT_REDUCED_MS = 200;
/**
 * The Mars Nomads FIRST LANDING (`nomad-landing-drop` in nomad_token.less):
 * cell focus halo → the module materializes over the surface → descends with
 * its shadow converging → micro-compression + dust → settle. Longer than the
 * cathedral's drop — the camp arrives from altitude, it is not set down.
 * The cell's printed bonuses deliberately do NOT react: the first placement
 * grants nothing (`placementEffect: 'marker'`), so no icon may lift, no
 * counter may move, and no collection flow may start.
 */
export const NOMAD_LANDING_ANIMATION_MS = 860;

/** The overlay markers this framework animates (`SpaceModel` flag fields). */
export type MarkerKey = 'cathedral' | 'nomads';

const MARKERS: ReadonlyArray<MarkerKey> = ['cathedral', 'nomads'];

const MARKER_MS: Record<MarkerKey, number> = {
  cathedral: MARKER_PLACEMENT_ANIMATION_MS,
  nomads: NOMAD_LANDING_ANIMATION_MS,
};

function has(space: SpaceModel, marker: MarkerKey): boolean {
  return space[marker] === true;
}

/**
 * A nomads flag APPEARING is only a first LANDING when no cell LOST the flag
 * in the same response — otherwise it is the camp MOVING, which belongs to
 * the console nomad-move scene (lift → arc → displace the bonus → collect →
 * restore), never to this framework's descent. The cathedral has no move.
 */
function isMarkerMove(
  marker: MarkerKey,
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): boolean {
  if (marker !== 'nomads') {
    return false;
  }
  const len = Math.min(oldSpaces.length, newSpaces.length);
  for (let i = 0; i < len; i++) {
    if (oldSpaces[i].id === newSpaces[i].id && has(oldSpaces[i], marker) && !has(newSpaces[i], marker)) {
      return true;
    }
  }
  return false;
}

type ActiveMarker = {
  startedAt: number;
  duration: number;
};

const markerBaseline = new Map<string, boolean>();
const activeMarkers = new Map<string, ActiveMarker>();

function key(spaceId: SpaceId, marker: MarkerKey): string {
  return `${spaceId}:${marker}`;
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export type MarkerObservation = {
  marker: MarkerKey;
  durationMs: number;
  /** Negative on a mid-flight remount — the visual fast-forwards to elapsed. */
  delayMs: number;
};

/**
 * Called by BoardSpace on mount and whenever a marker flag changes. Returns the
 * landing descriptor while the beat is (still) running, else null. Updates the
 * baseline as a side effect, so a second observation of the same state never
 * re-triggers it.
 */
export function observeMarkerPlacement(space: SpaceModel, marker: MarkerKey = 'cathedral'): MarkerObservation | null {
  const k = key(space.id, marker);
  const incoming = has(space, marker);
  const tracked = markerBaseline.has(k);
  const baseline = markerBaseline.get(k) === true;

  if (tracked && baseline === incoming) {
    const active = activeMarkers.get(k);
    if (active === undefined) {
      return null;
    }
    const elapsed = now() - active.startedAt;
    if (active.duration - elapsed <= 0) {
      activeMarkers.delete(k);
      return null;
    }
    return {marker, durationMs: active.duration, delayMs: -elapsed};
  }

  markerBaseline.set(k, incoming);

  if (!incoming) {
    // A marker never leaves a space in the real game; this covers a game switch
    // / board variant swap resetting the cell.
    activeMarkers.delete(k);
    return null;
  }

  // Not a real in-play landing (initial render / reconnect / a poll outside the
  // window): adopt it silently, exactly like an existing tile.
  if (!arePlacementAnimationsArmed()) {
    return null;
  }

  const duration = motionMs(prefersReducedMotion() ? MARKER_PLACEMENT_REDUCED_MS : MARKER_MS[marker]);
  activeMarkers.set(k, {startedAt: now(), duration});
  return {marker, durationMs: duration, delayMs: 0};
}

/**
 * Pre-adopt a marker the CALLER is about to paint (the console nomad-move
 * scene flips the destination flag under its own settled proxy): the
 * baseline is set as if the marker had always been there, and any in-flight
 * landing on that cell is dropped — so the very next `observeMarkerPlacement`
 * is a silent no-op even if the placement-animation window happens to be
 * open for something else in the same response.
 */
export function adoptMarkerSilently(spaceId: SpaceId, marker: MarkerKey): void {
  const k = key(spaceId, marker);
  markerBaseline.set(k, true);
  activeMarkers.delete(k);
}

/** The mirror for a marker the caller REMOVED (the move's source cell). */
export function forgetMarkerSilently(spaceId: SpaceId, marker: MarkerKey): void {
  const k = key(spaceId, marker);
  markerBaseline.set(k, false);
  activeMarkers.delete(k);
}

/** GC the in-flight entry once the element's timer fired. */
export function clearActiveMarker(spaceId: SpaceId, marker: MarkerKey = 'cathedral'): void {
  activeMarkers.delete(key(spaceId, marker));
}

/** Every marker kind this response LANDS (fresh appearances that are NOT a
 *  move — a nomads move is the console move scene's, never a landing). */
export function landedMarkersIn(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): Array<MarkerKey> {
  const out: Array<MarkerKey> = [];
  const len = Math.min(oldSpaces.length, newSpaces.length);
  for (const marker of MARKERS) {
    if (isMarkerMove(marker, oldSpaces, newSpaces)) {
      continue;
    }
    for (let i = 0; i < len; i++) {
      const oldSpace = oldSpaces[i];
      const newSpace = newSpaces[i];
      if (oldSpace.id !== newSpace.id) {
        continue;
      }
      if (!has(oldSpace, marker) && has(newSpace, marker)) {
        out.push(marker);
        break;
      }
    }
  }
  return out;
}

/**
 * Did this response land at least one overlay marker? (WaitingFor's hold gate —
 * mirrors `shouldHoldForTilePlacement`, including its defensive id alignment.)
 */
export function shouldHoldForMarkerPlacement(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): boolean {
  return landedMarkersIn(oldSpaces, newSpaces).length > 0;
}

/**
 * Stage 1 of the marker hold (mirrors `applyTilePlacementPreview`): copy JUST
 * the fresh markers onto the displayed spaces, so the landing plays while the
 * REST of the response (the prompt it caused, resources, TR) is still held.
 * A nomads MOVE is skipped whole — its from/to pair belongs to the console
 * move scene, which applies its own targeted preview at the touchdown.
 */
export function applyMarkerPlacementPreview(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): void {
  const len = Math.min(oldSpaces.length, newSpaces.length);
  for (const marker of MARKERS) {
    if (isMarkerMove(marker, oldSpaces, newSpaces)) {
      continue;
    }
    for (let i = 0; i < len; i++) {
      const oldSpace = oldSpaces[i];
      const newSpace = newSpaces[i];
      if (oldSpace.id !== newSpace.id) {
        continue;
      }
      if (!has(oldSpace, marker) && has(newSpace, marker)) {
        oldSpace[marker] = true;
      }
    }
  }
}

/**
 * How long the commit waits: the WHOLE landing, so the follow-up decision modal
 * opens strictly AFTER the marker has settled on the city (never over it).
 * With the diff supplied, the wait covers the LONGEST landing this response
 * actually contains (a nomads first landing runs longer than the cathedral's
 * drop); argless keeps the historical cathedral duration.
 */
export function markerPlacementHoldDurationMs(
  oldSpaces?: ReadonlyArray<SpaceModel>,
  newSpaces?: ReadonlyArray<SpaceModel>,
): number {
  let base = MARKER_PLACEMENT_ANIMATION_MS;
  if (oldSpaces !== undefined && newSpaces !== undefined) {
    const landed = landedMarkersIn(oldSpaces, newSpaces);
    if (landed.length > 0) {
      base = Math.max(...landed.map((m) => MARKER_MS[m]));
    }
  }
  return motionMs(prefersReducedMotion() ? MARKER_PLACEMENT_REDUCED_MS : base) + 40;
}
