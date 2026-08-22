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

import {computed, ComputedRef, reactive, watch} from 'vue';
import {createGlobalState, usePreferredReducedMotion} from '@vueuse/core';

const OVERRIDE_STORAGE_KEY = 'tm_reduce_motion';
const HTML_CLASS = 'con-reduced-motion';

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The IN-GAME override («Настройки» → ГРАФИКА → «Меньше движения»). A player
 * on a device whose OS never exposes `prefers-reduced-motion` (SteamOS
 * gamescope, most TVs) must still be able to ask for the reduced experience.
 * Persisted; default OFF; NEVER auto-enabled by device detection.
 */
export const reduceMotionOverrideState = reactive({
  enabled: storage()?.getItem(OVERRIDE_STORAGE_KEY) === '1',
});

/** The ONE policy: OS preference OR the in-game override (pure, spec'd). */
export function effectiveReducedMotion(osPrefersReduce: boolean, override: boolean): boolean {
  return osPrefersReduce || override;
}

const useState = createGlobalState(() => {
  const preference = usePreferredReducedMotion();
  const reduced = computed(() =>
    effectiveReducedMotion(preference.value === 'reduce', reduceMotionOverrideState.enabled));
  // The CSS BRIDGE: `html.con-reduced-motion` mirrors the EFFECTIVE state
  // (OS pref *or* override), so a single class-gated stylesheet
  // (console_reduced_motion.less) serves both sources. The 164 existing
  // `@media (prefers-reduced-motion: reduce)` sites keep serving the OS path
  // untouched; the class adds the loops-don't-loop policy for both.
  watch(reduced, (on) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle(HTML_CLASS, on);
    }
  }, {immediate: true});
  return {reduced};
});

/** Persist + apply the in-game override live (no restart, no remount). */
export function setReduceMotionOverride(on: boolean): void {
  reduceMotionOverrideState.enabled = on;
  try {
    storage()?.setItem(OVERRIDE_STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Private mode etc. — the in-session value still applies.
  }
  // The lazy global state may not exist yet (nothing read the ref) — touch it
  // so the class-bridge watcher exists from the first toggle on.
  void useState().reduced.value;
}

/** Reactive: is reduced motion EFFECTIVE? (OS preference OR in-game override;
 *  live — reflects OS-setting changes and the settings toggle alike). */
export function useReducedMotion(): {reduced: ComputedRef<boolean>} {
  return useState();
}

/** Non-reactive snapshot for plain TS modules / per-frame loops. */
export function reducedMotionActive(): boolean {
  return useState().reduced.value;
}

/** Bootstrap hook (main.ts): install the class bridge before first paint. */
export function applyReducedMotionClass(): void {
  void useState().reduced.value;
}
