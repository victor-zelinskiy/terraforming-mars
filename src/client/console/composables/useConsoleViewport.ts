/*
 * CONSOLE VIEWPORT — the ONE reactive viewport/media state of the console UI
 * (foundation layer; CONSOLE_FOUNDATION.md §4).
 *
 * Components must not hand-roll `window.innerWidth` reads, `resize`
 * listeners or `matchMedia` queries — they read THIS. The layout PROFILE
 * (handheld / standard / large) keeps its single source of truth in
 * consoleLayoutProfile.ts (installed by GamepadLayer, honours the
 * `?consoleProfile=` debug override); this composable re-exposes it next to
 * the live geometry so a screen needs one import.
 *
 * VueUse: `useWindowSize` + `useMediaQuery` behind `createGlobalState` — the
 * listeners are created ONCE on first use (module singleton; a viewport is
 * global state, per-component instances would just multiply listeners).
 */

import {computed, ComputedRef, Ref} from 'vue';
import {createGlobalState, useMediaQuery, useWindowSize} from '@vueuse/core';
import {consoleLayoutState, ConsoleLayoutProfile} from '@/client/console/consoleLayoutProfile';

export type ConsoleViewport = {
  /** Live viewport size (reactive). */
  width: Ref<number>,
  height: Ref<number>,
  /** The console layout profile (single source: consoleLayoutProfile.ts). */
  profile: ComputedRef<ConsoleLayoutProfile>,
  isHandheld: ComputedRef<boolean>,
  isLarge: ComputedRef<boolean>,
  /** Living-room TV profile (couch distance, 1920×1080 logical space). */
  isTv: ComputedRef<boolean>,
  /** The TV logical-space UI scale (1 on every non-tv profile). JS geometry
   * that must grow with the TV layout (fit ceilings, scroll steps) reads
   * this — the CSS side consumes the same value via `--con-ui-scale`. */
  uiScale: ComputedRef<number>,
  /** Portrait posture (a rotated handheld / dev window) — layouts may bail to compact. */
  isPortrait: Ref<boolean>,
  /** Steam-Deck-height class of viewports (≤800px tall) — the tightest budget. */
  isDeckHeight: ComputedRef<boolean>,
};

const useState = createGlobalState((): ConsoleViewport => {
  const {width, height} = useWindowSize();
  const isPortrait = useMediaQuery('(orientation: portrait)');
  return {
    width,
    height,
    profile: computed(() => consoleLayoutState.profile),
    isHandheld: computed(() => consoleLayoutState.profile === 'handheld'),
    isLarge: computed(() => consoleLayoutState.profile === 'large'),
    isTv: computed(() => consoleLayoutState.profile === 'tv'),
    uiScale: computed(() => consoleLayoutState.uiScale),
    isPortrait,
    isDeckHeight: computed(() => height.value <= 800),
  };
});

/** The shared reactive viewport state (safe under JSDOM — sizes default sanely). */
export function useConsoleViewport(): ConsoleViewport {
  return useState();
}
