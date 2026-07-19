/*
 * CONSOLE REDUCED-MOTION POLICY — the console-facing reduced-motion helpers
 * (foundation layer; docs/CONSOLE_FOUNDATION.md §5).
 *
 * The reactive SOURCE is now shared fork-wide: `src/client/utils/reducedMotion`
 * (VueUse `usePreferredReducedMotion` behind `createGlobalState` — ONE
 * MediaQueryList listener, live). This module re-exposes it under the console
 * names and adds the console MOTION-DURATION policy on top; it no longer owns a
 * second matchMedia subscription.
 *
 * Contract (matches the motion system, motionTokens.ts): `--motion-scale` /
 * `motionMs()` own SPEED; reduced-motion is a SEPARATE OVERRIDING axis — when
 * reduced, motion-heavy effects switch to their short/static variant, not
 * merely play faster. `consoleMotionMs` encodes the default policy: scaled
 * duration normally, a short fixed cap when reduced (mirrors the 480ms
 * convention of energyConversionModel).
 */

import {ComputedRef} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {reducedMotionActive, useReducedMotion} from '@/client/utils/reducedMotion';

/** Reduced variants keep a SHORT, functional duration — never a hard pop-in. */
export const REDUCED_MOTION_CAP_MS = 160;

/** Reactive: is reduced motion requested? (delegates to the shared source). */
export function useConsoleReducedMotion(): {reduced: ComputedRef<boolean>} {
  return useReducedMotion();
}

/** Non-reactive snapshot for plain TS modules (timers, one-shot effects). */
export function consoleReducedMotionActive(): boolean {
  return reducedMotionActive();
}

/**
 * The default duration policy for simple JS-driven console animation:
 * preset-scaled normally (through `motionMs`), capped short when reduced.
 */
export function consoleMotionMs(base: number): number {
  return consoleReducedMotionActive() ? Math.min(REDUCED_MOTION_CAP_MS, base) : motionMs(base);
}
