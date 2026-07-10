/*
 * CONSOLE REDUCED-MOTION POLICY — the ONE JS-side reduced-motion source
 * (foundation layer; CONSOLE_FOUNDATION.md §5).
 *
 * CSS keeps handling `@media (prefers-reduced-motion: reduce)` natively; this
 * module is for JS-driven choreography (timers, rAF glides, WAAPI), where the
 * fork today re-implements a one-shot `matchMedia` read in ~5 places
 * (changeFeedbackManager / AnimatedScaleMarker / aresMarkerGlide /
 * hazardIntensifyState / …). New console work reads THIS instead; the legacy
 * spots migrate opportunistically.
 *
 * Contract (matches the motion system, motionTokens.ts): `--motion-scale` /
 * `motionMs()` own SPEED; reduced-motion is a SEPARATE OVERRIDING axis —
 * when reduced, motion-heavy effects should switch to their short/static
 * variant, not merely play faster. `consoleMotionMs` encodes the default
 * policy for simple cases: scaled duration normally, a short fixed cap when
 * reduced (mirrors the 480ms convention of energyConversionModel).
 *
 * VueUse: `usePreferredReducedMotion` behind `createGlobalState` (one
 * matchMedia subscription, REACTIVE — flips live when the OS setting
 * changes, which the legacy one-shot reads never did).
 */

import {computed, ComputedRef} from 'vue';
import {createGlobalState, usePreferredReducedMotion} from '@vueuse/core';
import {motionMs} from '@/client/components/motion/motionTokens';

/** Reduced variants keep a SHORT, functional duration — never a hard pop-in. */
export const REDUCED_MOTION_CAP_MS = 160;

const useState = createGlobalState(() => {
  const preference = usePreferredReducedMotion();
  const reduced = computed(() => preference.value === 'reduce');
  return {reduced};
});

/** Reactive: is reduced motion requested? */
export function useConsoleReducedMotion(): {reduced: ComputedRef<boolean>} {
  return useState();
}

/**
 * Non-reactive snapshot for plain TS modules (timers, one-shot effects) —
 * the console twin of the scattered `prefersReducedMotion()` helpers.
 */
export function consoleReducedMotionActive(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The default duration policy for simple JS-driven console animation:
 * preset-scaled normally (through `motionMs`), capped short when reduced.
 */
export function consoleMotionMs(base: number): number {
  return consoleReducedMotionActive() ? Math.min(REDUCED_MOTION_CAP_MS, base) : motionMs(base);
}
