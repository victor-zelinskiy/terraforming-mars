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
// Deliberately RAW ms, never `motionMs()`: the keyframe it mirrors is authored
// as a plain `0.9s` (shared stylesheet, no `--motion-scale` factor), so scaling
// this side would desync the class removal from the animation it times.
const CUBE_DROP_MS = 900;
const CUBE_DROP_BUFFER_MS = 90;
/**
 * Where `pc-place` makes CONTACT: 62% of the keyframe (≈560 ms). Everything
 * after it is the squash recovery, which a follow-up prompt may safely overlap
 * — so this, not the full 900 ms, is the window a commit holds for (the same
 * "hold to the beat that carries the meaning, not to the last frame"
 * convention as `placementHoldDurationMs`).
 */
const CUBE_CONTACT_MS = 560;
/** Reduced motion: the keyframe is off, the cube simply appears — a token wait
 *  so the player still SEES the marker land before the rest of the response. */
const CUBE_MARKER_HOLD_REDUCED_MS = 100;

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

  // Real placement. A cube that lands ON A TILE waits for that tile's own
  // entrance first (tile materialises → cube drops onto it), so it is held
  // hidden for the normal/reduced placement duration — owner cubes only land
  // on city / greenery / special tiles, never hazards.
  //
  // A cube WITHOUT a tile is a PLAYER MARKER — a claimed cell (Land Claim, an
  // Arcadian community). There is no tile entrance to wait behind, and a dead
  // 720 ms pause before the drop is indistinguishable from the "it just
  // appeared" pop this state machine exists to prevent: drop it NOW, in the
  // same synchronous turn the colour was painted, so the cube mounts already
  // carrying `--animate-in`.
  const reduced = prefersReducedMotion();
  if (space.tileType === undefined) {
    startCubeDrop(id, reduced);
    return;
  }
  const tileMs = reduced ? PLACEMENT_ANIMATION_REDUCED_MS : PLACEMENT_ANIMATION_MS;
  phases[id] = 'hidden';
  addTimer(id, window.setTimeout(() => startCubeDrop(id, reduced), tileMs));
}

/** The drop itself: play `pc-place`, then settle to rest. Reduced motion has
 *  no keyframe to play (PlayerCube disables it), so the cube simply rests. */
function startCubeDrop(id: SpaceId, reduced: boolean): void {
  if (reduced) {
    phases[id] = 'rest';
    return;
  }
  phases[id] = 'dropping';
  addTimer(id, window.setTimeout(() => {
    phases[id] = 'rest';
  }, CUBE_DROP_MS + CUBE_DROP_BUFFER_MS));
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
  startCubeDrop(id, prefersReducedMotion());
}

export function restCubeForHeroPlacement(id: SpaceId): void {
  clearTimers(id);
  phases[id] = 'rest';
}

/*
 * ── PLAYER-MARKER (cube-only) placement ─────────────────────────────────────
 *
 * A CLAIM puts a cube on the board with NO tile: Land Claim, and the community
 * an Arcadian Communities player places (as their first action and as their
 * repeatable action). Every existing entrance is keyed on a tile appearing —
 * `shouldHoldForTilePlacement` / the console `verifyPlacement` hero both demand
 * `tileType: undefined → defined`, and `shouldHoldForMarkerPlacement` covers
 * overlay markers (`space.cathedral`) — so a colour-only diff matched nothing
 * and the cube simply POPPED in, in the same frame as whatever followed.
 *
 * These two mirror the tile / overlay-marker frameworks 1:1 so WaitingFor's
 * commit gate and App's poll path can treat all three the same way. There is
 * deliberately NO reward beat here and nothing is captured off the cell: a
 * marker collects no placement bonus (`placementEffect: 'marker'` — see
 * `BoardInformationEngine.grantsPlacementBonus`), so the hex keeps its printed
 * icons and no counter may move at the drop.
 */

/** Did this response put a player MARKER (a cube on a tile-less cell) down? */
export function shouldHoldForOwnerCubePlacement(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): boolean {
  return eachFreshOwnerCube(oldSpaces, newSpaces, () => {}) > 0;
}

/**
 * Stage 1 of the marker hold (mirrors `applyTilePlacementPreview`): copy JUST
 * the fresh owner colours onto the displayed spaces, so the cube lands while
 * the REST of the response (the prompt it caused, the turn handover) is still
 * held. Nothing else about the cell is touched — a claim changes nothing else.
 */
export function applyOwnerCubePlacementPreview(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): void {
  eachFreshOwnerCube(oldSpaces, newSpaces, (oldSpace, newSpace) => {
    oldSpace.color = newSpace.color;
  });
}

/** How long the commit waits: to the cube's CONTACT with the cell. */
export function ownerCubeHoldDurationMs(): number {
  return prefersReducedMotion() ? CUBE_MARKER_HOLD_REDUCED_MS : CUBE_CONTACT_MS + 40;
}

/**
 * Walk the index-aligned diff for cells that gained an owner colour WITHOUT
 * gaining a tile, returning how many there were. A tile arriving in the same
 * response is a build, not a claim — that rides the tile framework (which
 * drops the cube itself, after the tile seats). Defensive id alignment, like
 * every sibling framework.
 */
function eachFreshOwnerCube(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  visit: (oldSpace: SpaceModel, newSpace: SpaceModel) => void,
): number {
  let count = 0;
  const len = Math.min(oldSpaces.length, newSpaces.length);
  for (let i = 0; i < len; i++) {
    const oldSpace = oldSpaces[i];
    const newSpace = newSpaces[i];
    if (oldSpace.id !== newSpace.id) {
      continue;
    }
    if (oldSpace.color !== undefined || newSpace.color === undefined) {
      continue;
    }
    if (oldSpace.tileType !== undefined || newSpace.tileType !== undefined) {
      continue;
    }
    count++;
    visit(oldSpace, newSpace);
  }
  return count;
}
