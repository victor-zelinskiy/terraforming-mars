import {reactive} from 'vue';
import {createFrameGate, motionMs} from '@/client/components/motion/motionTokens';
import {reducedMotionActive} from '@/client/utils/reducedMotion';

/**
 * Smooth GLIDE for the Ares scale event markers when their threshold shifts
 * (Butterfly Effect). The marker position is derived from its threshold VALUE; on
 * a shift the value would jump in one frame. This controller tweens the DISPLAYED
 * value toward the new threshold over ~1.5s so the marker glides along the arc
 * (the position recomputes each frame, so the connector re-aims correctly too).
 *
 * Module-level on purpose: PlayerHome (and the board within it) REMOUNTS on every
 * server response, and the new threshold arrives via exactly such an update — so a
 * component-local CSS transition would be reset by the remount. The glide state
 * lives here (like AnimatedScaleMarker's accentBaseline), so the animation runs
 * across the remount. Read `glidedThreshold(id, target)` inside a computed: it
 * depends on the reactive frame tick, so the position recomputes each frame.
 */

export const ARES_MARKER_GLIDE_MS = 1500;

type Glide = {value: number, from: number, target: number, start: number};
const glides: Record<string, Glide> = {};
// A reactive frame counter bumped each animation frame — the reactive dependency
// that makes consumer computeds recompute while a glide is in flight.
const tickState = reactive({frame: 0});
let rafId = 0;

/** Pure easing (cubic in-out) — exported for tests. */
export function aresGlideEase(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

/** Pure interpolation of a glide at `now` — exported for tests. */
export function aresGlideValue(from: number, target: number, start: number, now: number,
  durationMs: number = ARES_MARKER_GLIDE_MS): number {
  const t = (now - start) / durationMs;
  return t >= 1 ? target : from + (target - from) * aresGlideEase(t);
}

// FPS policy for this rAF loop (motionTokens): under a configured cap the
// WORK is skipped on gated frames while the loop cadence continues.
const frameGate = createFrameGate();

function loop(now: number): void {
  if (!frameGate.shouldRender(now)) {
    rafId = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(loop) : 0;
    return;
  }
  let active = false;
  const duration = motionMs(ARES_MARKER_GLIDE_MS);
  for (const id of Object.keys(glides)) {
    const g = glides[id];
    if (g.value === g.target) {
      continue;
    }
    g.value = aresGlideValue(g.from, g.target, g.start, now, duration);
    if (g.value !== g.target) {
      active = true;
    }
  }
  tickState.frame++;
  rafId = active && typeof requestAnimationFrame === 'function' ? requestAnimationFrame(loop) : 0;
}

/**
 * The DISPLAYED threshold value for marker `id`, glided toward `target` over
 * ~1.5s when `target` changes. First sighting (or reduced-motion / no rAF) snaps.
 */
export function glidedThreshold(id: string, target: number): number {
  void tickState.frame; // reactive dependency — recompute while gliding
  let g = glides[id];
  if (g === undefined) {
    g = glides[id] = {value: target, from: target, target, start: 0};
    return target;
  }
  if (g.target !== target) {
    if (reducedMotionActive() || typeof requestAnimationFrame !== 'function') {
      g.value = g.from = target;
      g.target = target;
    } else {
      g.from = g.value;
      g.target = target;
      g.start = typeof performance !== 'undefined' ? performance.now() : 0;
      if (rafId === 0) {
        rafId = requestAnimationFrame(loop);
      }
    }
  }
  return g.value;
}

/** Test hook — clear all glide state. */
export function resetAresMarkerGlide(): void {
  for (const k of Object.keys(glides)) {
    delete glides[k];
  }
  tickState.frame = 0;
}
