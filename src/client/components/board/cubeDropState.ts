/*
 * Cube-drop coordinator — chains the player-ownership cube's drop animation
 * AFTER the tile placement animation on the same space.
 *
 * Requirement: when a player builds, the TILE materialises first (the existing
 * `tilePlacementAnimation` framework), and ONLY when that finishes does the
 * owner CUBE drop onto it. The cube must therefore be HELD HIDDEN for the
 * duration of the tile placement, then dropped in, then settle to rest.
 *
 * Like `tilePlacementAnimation`, this is module-level so it survives the
 * `<player-home :key="playerkey">` remount WaitingFor.vue forces on every
 * server response — otherwise each poll would replay the drop. `phases` is a
 * Vue `reactive` map so a BoardSpace's `cubePhase` computed re-renders when the
 * module advances the state machine; `colorBaseline` + the per-space timers
 * persist across remounts so a mid-sequence remount resumes rather than
 * restarts. Existing tiles (page load / share-link join) show their cube at
 * rest immediately — the drop only plays for a REAL in-play placement, gated by
 * the same `arePlacementAnimationsArmed()` window the tile framework uses.
 */
import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';
import {Color} from '@/common/Color';
import {SpaceModel} from '@/common/models/SpaceModel';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {
  arePlacementAnimationsArmed,
  PLACEMENT_ANIMATION_MS,
  PLACEMENT_ANIMATION_REDUCED_MS,
} from './tilePlacementAnimation';

export type CubePhase = 'hidden' | 'dropping' | 'rest';

// Must match the `pc-place` keyframe length in `player_cube.less` (0.9s) + a
// small buffer so the `--animate-in` class is dropped only after it settles.
const CUBE_DROP_MS = 900;
const CUBE_DROP_BUFFER_MS = 90;

const phases = reactive<Partial<Record<SpaceId, CubePhase>>>({});
const colorBaseline = new Map<SpaceId, Color | undefined>();
const timers = new Map<SpaceId, Array<number>>();

function clearTimers(id: SpaceId): void {
  const ts = timers.get(id);
  if (ts !== undefined) {
    ts.forEach((t) => clearTimeout(t));
    timers.delete(id);
  }
}

function addTimer(id: SpaceId, handle: number): void {
  const arr = timers.get(id) ?? [];
  arr.push(handle);
  timers.set(id, arr);
}

/** Current cube phase for a space (`rest` = show static, the default). */
export function cubePhase(id: SpaceId): CubePhase {
  return phases[id] ?? 'rest';
}

/*
 * Drive the cube reveal state machine for one board space. Call on mount and
 * whenever `space.color` changes (BoardSpace does both via an immediate watch).
 */
export function observeCube(space: SpaceModel): void {
  const id = space.id;
  const incoming = space.color;
  const tracked = colorBaseline.has(id);
  const baseline = colorBaseline.get(id);

  // No owner on this space → nothing to reveal; reset tracking (covers a
  // cancelled placement reverting the colour, and keeps an empty space's
  // baseline defined-as-undefined so a later build reads as fresh).
  if (incoming === undefined) {
    colorBaseline.set(id, undefined);
    clearTimers(id);
    if (phases[id] !== undefined) {
      delete phases[id];
    }
    return;
  }

  // Already tracked with a colour, or a phase is already in flight (a
  // mid-sequence remount, or the owner was known at load): keep the current
  // phase — NEVER restart the drop.
  if ((tracked && baseline !== undefined) || phases[id] !== undefined) {
    colorBaseline.set(id, incoming);
    if (phases[id] === undefined) {
      phases[id] = 'rest';
    }
    return;
  }

  // Fresh owner colour on this space.
  colorBaseline.set(id, incoming);

  // Not a real in-play placement (initial render / reconnect): show at rest.
  if (!arePlacementAnimationsArmed()) {
    phases[id] = 'rest';
    return;
  }

  // Real placement: hold the cube hidden for the tile placement animation,
  // then drop it in, then settle. Owner cubes only land on city / greenery /
  // special tiles (never hazards), so the tile length is the normal/reduced
  // placement duration.
  const reduced = prefersReducedMotion();
  const tileMs = reduced ? PLACEMENT_ANIMATION_REDUCED_MS : PLACEMENT_ANIMATION_MS;
  phases[id] = 'hidden';
  addTimer(id, window.setTimeout(() => {
    if (reduced) {
      // Reduced motion: the cube simply appears (PlayerCube disables the drop
      // keyframe), no separate settle beat.
      phases[id] = 'rest';
      return;
    }
    phases[id] = 'dropping';
    addTimer(id, window.setTimeout(() => {
      phases[id] = 'rest';
    }, CUBE_DROP_MS + CUBE_DROP_BUFFER_MS));
  }, tileMs));
}

/*
 * ── Console HERO-placement bridge ───────────────────────────────────────────
 *
 * The console tile-placement hero paints the space's owner colour OUTSIDE the
 * `arePlacementAnimationsArmed()` window (its own flight replaces the generic
 * entrance), so `observeCube` would show the cube at rest the instant the
 * proxy lands — the cube "just appears". These three explicit controls let
 * the hero drive the SAME premium drop on its own timeline:
 *
 *   holdCubeForHeroPlacement — call BEFORE the colour is painted (same
 *     synchronous block): pre-sets the phase to `hidden`, which observeCube
 *     respects (a phase already in flight is never restarted). A safety timer
 *     auto-drops a stranded hold so a cube can never stay invisible.
 *   dropCubeForHeroPlacement — the tile has physically seated: play the
 *     premium drop (`pc-place`), then settle to rest.
 *   restCubeForHeroPlacement — the degraded/abort path: show the cube at
 *     rest immediately, no drop beat.
 */

// Covers the longest honest wait: a queued remote flight several tiles deep
// (~1s each) — far past that, the hold is a leak and the cube must land.
const HERO_CUBE_HOLD_SAFETY_MS = 10000;

export function holdCubeForHeroPlacement(id: SpaceId): void {
  clearTimers(id);
  phases[id] = 'hidden';
  addTimer(id, window.setTimeout(() => {
    if (phases[id] === 'hidden') {
      dropCubeForHeroPlacement(id);
    }
  }, HERO_CUBE_HOLD_SAFETY_MS));
}

export function dropCubeForHeroPlacement(id: SpaceId): void {
  clearTimers(id);
  if (prefersReducedMotion()) {
    phases[id] = 'rest';
    return;
  }
  phases[id] = 'dropping';
  addTimer(id, window.setTimeout(() => {
    phases[id] = 'rest';
  }, CUBE_DROP_MS + CUBE_DROP_BUFFER_MS));
}

export function restCubeForHeroPlacement(id: SpaceId): void {
  clearTimers(id);
  phases[id] = 'rest';
}
