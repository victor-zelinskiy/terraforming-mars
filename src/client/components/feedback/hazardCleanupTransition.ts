/*
 * Hazard-cleanup transition — controller + reactive state.
 *
 * The "transition gate" for building over a hazard zone. The hazard-cleanup
 * analogue of `energyConversionTransition`: detect the cleanup in the prev→next
 * board diff, play ONE bounded premium sequence (focus → the hazard dissolves →
 * the new tile materialises → cost/TR feedback), and HOLD the commit of the new
 * view (and therefore any follow-up modal that keys off it) until it finishes.
 *
 * Ownership split (mirrors the energy-conversion pair):
 *   - PURE detect / duration / phase maths → `hazardCleanupModel.ts`;
 *   - this module owns the reactive `hazardCleanupState` (the overlay reads it),
 *     the rAF timeline, the dedup seen-set, the mid-sequence tile SWAP, and the
 *     gate Promise.
 *
 * Both commit paths (WaitingFor own-submit, App poll for an opponent) call:
 *   detectHazardCleanup(prev, next) → runHazardCleanup(events, applyTileSwap)
 *   (await) → <commit the new view> → endHazardCleanup()
 * plus `isHazardCleanupActive()` as a re-entrancy guard.
 */

import {reactive} from 'vue';
import {ViewModel} from '@/common/models/PlayerModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {prefersReducedMotion} from './changeFeedbackManager';
import {
  HazardCleanupEvent,
  HazardCleanupPhase,
  cleanupDurationMs,
  detectHazardCleanups,
  phaseAt,
  TILE_SWAP_FRACTION,
} from './hazardCleanupModel';

type HazardCleanupTransitionState = {
  /** True from the moment the sequence starts until `endHazardCleanup()`. */
  active: boolean;
  /** The cells being cleared (usually one). The overlay renders one fx per cell. */
  events: ReadonlyArray<HazardCleanupEvent>;
  /** Discrete phase (focus → … → done) — drives the overlay's major states. */
  phase: HazardCleanupPhase;
  /** Continuous 0..1 progress — drives the frame-accurate fx intensities. */
  progress: number;
  /** Whether the mid-sequence tile swap has fired (hazard → new tile). */
  swapped: boolean;
  reducedMotion: boolean;
  /** Bumped on each run so the overlay re-measures the cell rects. */
  nonce: number;
};

export const hazardCleanupState = reactive<HazardCleanupTransitionState>({
  active: false,
  events: [],
  phase: 'focus',
  progress: 0,
  swapped: false,
  reducedMotion: false,
  nonce: 0,
});

// Replays of the same cleanup (the same view re-fetched by the poll loop) must
// not re-animate. Claimed exactly once in `detectHazardCleanup`.
const seen = new Set<string>();

let rafId = 0;
let safetyTimerId = 0;
let resolveActive: (() => void) | undefined;

function now(): number {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
}

function cancelTimers(): void {
  if (rafId !== 0) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
    }
    rafId = 0;
  }
  if (safetyTimerId !== 0) {
    clearTimeout(safetyTimerId);
    safetyTimerId = 0;
  }
}

export function isHazardCleanupActive(): boolean {
  return hazardCleanupState.active;
}

/**
 * Detect (and atomically CLAIM) the cleanups to animate for this prev→next view
 * transition. Returns only the NOT-yet-seen events; every event is marked seen
 * so a poll that re-fetches the SAME diff (a poll firing between the viewer's own
 * submit-detect and the commit) doesn't replay it. A cleanup needs a prev→next
 * DIFF, so a fresh load (no `prev`, the tile already down) yields nothing — there
 * is no diff to claim and no future diff a later poll could replay.
 */
export function detectHazardCleanup(
  prev: ViewModel | undefined,
  next: ViewModel | undefined): ReadonlyArray<HazardCleanupEvent> {
  const events = detectHazardCleanups(prev, next);
  if (events.length === 0) {
    return [];
  }
  const fresh = events.filter((e) => !seen.has(e.dedupeKey));
  events.forEach((e) => seen.add(e.dedupeKey));
  return fresh;
}

/**
 * Start the cleanup sequence and return a Promise that resolves when it has
 * finished (the caller then commits the new view). `applyTileSwap` is invoked
 * ONCE, at the `TILE_SWAP_FRACTION` mark, so the new tile appears only AFTER the
 * hazard has visually dissolved. `state.active` is set synchronously so the
 * re-entrancy guard closes immediately; a safety timer guarantees resolution
 * even if rAF is frozen (backgrounded tab), so the gate can never hang.
 */
export function runHazardCleanup(
  events: ReadonlyArray<HazardCleanupEvent>,
  applyTileSwap: () => void): Promise<void> {
  cancelTimers();
  const reduced = prefersReducedMotion();

  hazardCleanupState.active = true;
  hazardCleanupState.events = events;
  hazardCleanupState.phase = 'focus';
  hazardCleanupState.progress = 0;
  hazardCleanupState.swapped = false;
  hazardCleanupState.reducedMotion = reduced;
  hazardCleanupState.nonce++;

  const severe = events.some((e) => e.severity === 'severe');
  const duration = cleanupDurationMs(severe ? 'severe' : 'mild', reduced);
  const startedAt = now();

  const promise = new Promise<void>((resolve) => {
    resolveActive = resolve;
  });

  const doSwap = () => {
    if (!hazardCleanupState.swapped) {
      hazardCleanupState.swapped = true;
      applyTileSwap();
    }
  };
  const finish = () => {
    doSwap(); // guarantee the swap even if rAF was skipped / frozen
    hazardCleanupState.progress = 1;
    hazardCleanupState.phase = 'done';
    cancelTimers();
    const r = resolveActive;
    resolveActive = undefined;
    r?.();
  };

  if (reduced || typeof requestAnimationFrame !== 'function') {
    // Reduced motion (or no rAF, e.g. tests): swap promptly to the END state
    // (hazard gone + tile placed + cost/TR chips shown), hold a short readable
    // beat, then resolve. progress 0.95 keeps the chips + materialise visible.
    doSwap();
    hazardCleanupState.phase = 'reward-feedback';
    hazardCleanupState.progress = 0.95;
    safetyTimerId = window.setTimeout(finish, duration) as unknown as number;
  } else {
    const tick = () => {
      const t = Math.min(1, (now() - startedAt) / duration);
      hazardCleanupState.progress = t;
      hazardCleanupState.phase = phaseAt(t);
      if (t >= TILE_SWAP_FRACTION) {
        doSwap();
      }
      if (t >= 1) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    // rAF is paused in background tabs; this guarantees resolution + commit.
    safetyTimerId = window.setTimeout(finish, duration + 400) as unknown as number;
  }

  return promise;
}

/** Clear the overlay state AFTER the new view has committed. Idempotent. */
export function endHazardCleanup(): void {
  cancelTimers();
  hazardCleanupState.active = false;
  hazardCleanupState.events = [];
  hazardCleanupState.phase = 'focus';
  hazardCleanupState.progress = 0;
  hazardCleanupState.swapped = false;
}

/** Test-only full reset (state + dedup + timers). */
export function resetHazardCleanup(): void {
  cancelTimers();
  resolveActive = undefined;
  seen.clear();
  endHazardCleanup();
  hazardCleanupState.reducedMotion = false;
  hazardCleanupState.nonce = 0;
}

/**
 * Apply the cleared cells' NEW tile into the DISPLAYED (still-old) spaces so the
 * board shows the hazard replaced by the new tile mid-sequence — mirrors
 * `applyTilePlacementPreview`. Mutates `displayedSpaces` in place (Vue
 * reactivity propagates to BoardSpaceTile); the full view is committed after.
 */
export function applyHazardTileSwap(
  displayedSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  events: ReadonlyArray<HazardCleanupEvent>): void {
  const newById = new Map<string, SpaceModel>(newSpaces.map((s) => [s.id, s]));
  for (const e of events) {
    const disp = displayedSpaces.find((s) => s.id === e.spaceId);
    const ns = newById.get(e.spaceId);
    if (disp !== undefined && ns !== undefined) {
      disp.tileType = ns.tileType;
      disp.color = ns.color;
      disp.highlight = ns.highlight;
      disp.rotated = ns.rotated;
    }
  }
}
