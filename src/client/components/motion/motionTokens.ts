/*
 * Unified premium motion system — the single source of truth for animation
 * SPEED, easing and frame-rate policy (REMOUNT_ANIMATION_REWORK_DESIGN.md,
 * Phase 2 / brief Цель B).
 *
 * Design rules (CLAUDE.md goal #3 — Ark Nova BGA feel):
 *   - short ease-out curves, subtle scale/glow, no hard pop-ins;
 *   - one SPEED PRESET scales every coordinated animation in lockstep:
 *     JS-driven timers/holds read `motionMs(base)`, CSS animations read the
 *     `--motion-scale` custom property (set on <html> at bootstrap and on
 *     preset change) via `calc(<base>ms * var(--motion-scale, 1))`;
 *   - `prefers-reduced-motion` stays a SEPARATE, overriding axis — the
 *     existing reduced paths (shorter fades, no travel) are untouched and
 *     still consult `prefersReducedMotion()`.
 *
 * Config (mirrors the realtime flag ladder — URL param wins, then
 * localStorage, then the default):
 *   speed  : `?motion=calm|standard|swift`   / localStorage `tm_motion_speed`
 *   fps cap: `?motionFps=30|60|auto`         / localStorage `tm_motion_fps`
 *
 * The FPS cap applies ONLY to JS/rAF-driven animation loops (marker glides,
 * count-ups) via `createFrameGate()` — CSS/WAAPI animations are composited
 * by the browser and are not throttleable from here (documented limitation).
 *
 * Pure & DOM-optional: everything degrades safely under JSDOM/tests.
 */

export type MotionSpeedPreset = 'calm' | 'standard' | 'swift';

const SPEED_MULTIPLIER: Record<MotionSpeedPreset, number> = {
  // Slower, statelier pacing (+30%).
  calm: 1.3,
  // The tuned defaults that ship today — multiplier 1 keeps every existing
  // duration byte-identical.
  standard: 1,
  // Snappier pacing for experienced players (−35%).
  swift: 0.65,
};

const SPEED_STORAGE_KEY = 'tm_motion_speed';
const FPS_STORAGE_KEY = 'tm_motion_fps';

/**
 * Named easing tokens for NEW animation work (and gradual migration of the
 * flagship ones). Values follow the Ark-Nova-like language already used by
 * the fork's premium animations: decisive ease-out entries, soft settles.
 */
export const MOTION_EASE = {
  /** Default interactive transition — quick start, gentle landing. */
  standard: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  /** Element entering the scene (chips, overlays). */
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Element leaving the scene — slightly sharper. */
  exit: 'cubic-bezier(0.4, 0, 0.7, 0.2)',
  /** Damped-spring style settle for arrival pulses. */
  settle: 'cubic-bezier(0.34, 1.26, 0.44, 1)',
} as const;

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
  } catch (err) {
    return undefined;
  }
}

function searchString(): string {
  return typeof window !== 'undefined' ? window.location.search : '';
}

let cachedPreset: MotionSpeedPreset | undefined;

function isPreset(value: unknown): value is MotionSpeedPreset {
  return value === 'calm' || value === 'standard' || value === 'swift';
}

/** The active speed preset (URL param → localStorage → 'standard'). */
export function motionSpeedPreset(): MotionSpeedPreset {
  if (cachedPreset !== undefined) {
    return cachedPreset;
  }
  const fromUrl = /[?&]motion=([a-z]+)/.exec(searchString())?.[1];
  if (isPreset(fromUrl)) {
    cachedPreset = fromUrl;
    return cachedPreset;
  }
  const stored = storage()?.getItem(SPEED_STORAGE_KEY);
  cachedPreset = isPreset(stored) ? stored : 'standard';
  return cachedPreset;
}

/** Persist + apply a new speed preset (updates the CSS bridge immediately). */
export function setMotionSpeedPreset(preset: MotionSpeedPreset): void {
  cachedPreset = preset;
  try {
    storage()?.setItem(SPEED_STORAGE_KEY, preset);
  } catch (err) {
    // Private mode etc. — the in-session value still applies.
  }
  applyMotionCssScale();
}

/** The duration multiplier of the active preset. */
export function motionScale(): number {
  return SPEED_MULTIPLIER[motionSpeedPreset()];
}

/**
 * Scale a base duration (ms) by the active speed preset. THE way every
 * JS-driven animation duration / hold / chip lifetime should be resolved,
 * so presets keep the whole choreography in lockstep with the CSS side
 * (`--motion-scale`). `standard` returns `base` unchanged.
 */
export function motionMs(base: number): number {
  return Math.round(base * motionScale());
}

/**
 * Write the CSS bridge: `--motion-scale` on the root element. Call once at
 * bootstrap (main.ts) and after `setMotionSpeedPreset`. CSS animations opt in
 * with `animation-duration: calc(<base>ms * var(--motion-scale, 1))` — the
 * fallback `1` keeps un-migrated styles byte-identical.
 */
export function applyMotionCssScale(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.style.setProperty('--motion-scale', String(motionScale()));
}

// ---------------------------------------------------------------------------
// FPS policy for JS/rAF-driven loops.
// ---------------------------------------------------------------------------

export type MotionFpsCap = 'auto' | 30 | 60;

let cachedFps: MotionFpsCap | undefined;

function parseFps(value: string | null | undefined): MotionFpsCap | undefined {
  if (value === 'auto') {
    return 'auto';
  }
  if (value === '30') {
    return 30;
  }
  if (value === '60') {
    return 60;
  }
  return undefined;
}

/** The configured FPS cap for rAF-driven animations ('auto' = every frame). */
export function motionFpsCap(): MotionFpsCap {
  if (cachedFps !== undefined) {
    return cachedFps;
  }
  const fromUrl = parseFps(/[?&]motionFps=([a-z0-9]+)/.exec(searchString())?.[1]);
  if (fromUrl !== undefined) {
    cachedFps = fromUrl;
    return cachedFps;
  }
  cachedFps = parseFps(storage()?.getItem(FPS_STORAGE_KEY)) ?? 'auto';
  return cachedFps;
}

/** Persist + apply a new FPS cap for rAF-driven animation loops. */
export function setMotionFpsCap(cap: MotionFpsCap): void {
  cachedFps = cap;
  try {
    storage()?.setItem(FPS_STORAGE_KEY, cap === 'auto' ? 'auto' : String(cap));
  } catch (err) {
    // Ignore — in-session value applies.
  }
}

export type FrameGate = {
  /**
   * Should this rAF tick do render work? Under 'auto' — always yes. Under a
   * cap — skips ticks so work runs at ~cap Hz (the loop keeps requesting
   * frames; only the WORK is gated, so cadence stays smooth).
   */
  shouldRender(nowMs: number): boolean;
};

export function createFrameGate(): FrameGate {
  let lastRenderAt = -Infinity;
  return {
    shouldRender(nowMs: number): boolean {
      const cap = motionFpsCap();
      if (cap === 'auto') {
        return true;
      }
      const minInterval = 1000 / cap;
      // The -1ms slack absorbs rAF timestamp jitter so a 60Hz display under a
      // 60fps cap doesn't skip every other frame.
      if (nowMs - lastRenderAt >= minInterval - 1) {
        lastRenderAt = nowMs;
        return true;
      }
      return false;
    },
  };
}

/** Test-only: drop the memoised config so specs can vary it. */
export function __resetMotionTokensForTesting(): void {
  cachedPreset = undefined;
  cachedFps = undefined;
}
