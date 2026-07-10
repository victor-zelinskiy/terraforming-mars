/*
 * ONE reactive reduced-motion source (VueUse `usePreferredReducedMotion`).
 *
 * Replaces the ~5 hand-rolled `window.matchMedia('(prefers-reduced-motion:
 * reduce)')` checks scattered across the animation code (AnimatedScaleMarker,
 * aresMarkerGlide, hazardIntensifyState, the console deal cinematics, …) and
 * the once-cached snapshot in changeFeedbackManager.
 *
 * Why one source: the old `changeFeedbackManager.prefersReducedMotion()`
 * CACHED the value forever ("the media query never changes within a session")
 * — so toggling the OS setting mid-game was ignored. `usePreferredReducedMotion`
 * is LIVE (a single MediaQueryList listener updates a ref) AND cheap to read
 * (reading the ref is O(1) — no matchMedia call per read, so hot loops stay
 * fine). `createGlobalState` sets it up ONCE, lazily, at first use.
 *
 * Browser-safe: under SSR / node / JSDOM (no `window.matchMedia`) VueUse
 * degrades to 'no-preference' → `false`.
 *
 * `prefers-reduced-motion` stays a SEPARATE, overriding axis from the motion
 * SPEED presets (motionTokens / `--motion-scale`) — reduced means switch to the
 * short/static variant, never merely "faster".
 */

import {computed, ComputedRef} from 'vue';
import {createGlobalState, usePreferredReducedMotion} from '@vueuse/core';

const useState = createGlobalState(() => {
  const preference = usePreferredReducedMotion();
  const reduced = computed(() => preference.value === 'reduce');
  return {reduced};
});

/** Reactive: is reduced motion requested? (live — reflects OS-setting changes). */
export function useReducedMotion(): {reduced: ComputedRef<boolean>} {
  return useState();
}

/** Non-reactive snapshot for plain TS modules / per-frame loops. */
export function reducedMotionActive(): boolean {
  return useState().reduced.value;
}
