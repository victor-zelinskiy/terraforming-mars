/*
 * Input-mode machine (GAMEPAD_SUPPORT_DESIGN.md §4.3): gamepad ↔ pointer.
 *
 * Module-level reactive (survives everything, like journalState). Entering
 * gamepad mode adds `gp-mode` to <html> — CSS hides the cursor and gates
 * every gamepad visual (ring / hints / glyphs), so mouse+keyboard players
 * are byte-identical while the class is absent (invariant 2).
 *
 * Exit detection listens ONLY to TRUSTED events (`isTrusted === true`) —
 * the focus engine dispatches synthetic clicks / mouseover / Escape, and
 * those must never flap the mode back to pointer. Mouse movement exits only
 * after >12px accumulated travel (hysteresis: a nudged desk doesn't exit).
 */

import {reactive} from 'vue';

export type InputMode = 'pointer' | 'gamepad';

/** How far (px, accumulated) a TRUSTED pointer must travel to exit gamepad mode. */
export const POINTER_EXIT_TRAVEL_PX = 12;

type ModeListener = (mode: InputMode) => void;

export const inputModeState = reactive({
  mode: 'pointer' as InputMode,
  /** Number of connected pads (display/debug; gamepadCore maintains it). */
  padsConnected: 0,
});

const listeners = new Set<ModeListener>();

/** Subscribe to mode changes (returns an unsubscribe fn). */
export function onInputModeChange(fn: ModeListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyModeClass(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('gp-mode', inputModeState.mode === 'gamepad');
}

function setMode(mode: InputMode): void {
  if (inputModeState.mode === mode) {
    return;
  }
  inputModeState.mode = mode;
  applyModeClass();
  for (const fn of listeners) {
    fn(mode);
  }
}

/** Called by gamepadCore on any pad intent. */
export function enterGamepadMode(): void {
  setMode('gamepad');
}

/** Called by the trusted-event watchers (and on active-pad disconnect). */
export function exitGamepadMode(): void {
  setMode('pointer');
}

export function isGamepadMode(): boolean {
  return inputModeState.mode === 'gamepad';
}

// ---------------------------------------------------------------------------
// Trusted-event exit watchers.
// ---------------------------------------------------------------------------

let watchersInstalled = false;
let travel = 0;
let lastX: number | undefined;
let lastY: number | undefined;

function onTrustedPointerMove(e: PointerEvent | MouseEvent): void {
  if (!e.isTrusted || inputModeState.mode !== 'gamepad') {
    return;
  }
  if (lastX !== undefined && lastY !== undefined) {
    travel += Math.hypot(e.clientX - lastX, e.clientY - lastY);
  }
  lastX = e.clientX;
  lastY = e.clientY;
  if (travel > POINTER_EXIT_TRAVEL_PX) {
    exitGamepadMode();
  }
}

function onTrustedDiscrete(e: Event): void {
  if (!e.isTrusted) {
    return;
  }
  exitGamepadMode();
}

/** Reset the travel accumulator whenever gamepad mode (re-)engages. */
export function resetPointerTravel(): void {
  travel = 0;
  lastX = undefined;
  lastY = undefined;
}

export function installInputModeWatchers(): void {
  if (watchersInstalled || typeof window === 'undefined') {
    return;
  }
  watchersInstalled = true;
  // Capture + passive: we only OBSERVE, never intercept — mouse/keyboard
  // behaviour is untouched.
  window.addEventListener('pointermove', onTrustedPointerMove, {capture: true, passive: true});
  window.addEventListener('pointerdown', onTrustedDiscrete, {capture: true, passive: true});
  window.addEventListener('wheel', onTrustedDiscrete, {capture: true, passive: true});
  window.addEventListener('keydown', onTrustedDiscrete, {capture: true, passive: true});
}

export function uninstallInputModeWatchers(): void {
  if (!watchersInstalled || typeof window === 'undefined') {
    return;
  }
  watchersInstalled = false;
  window.removeEventListener('pointermove', onTrustedPointerMove, {capture: true});
  window.removeEventListener('pointerdown', onTrustedDiscrete, {capture: true});
  window.removeEventListener('wheel', onTrustedDiscrete, {capture: true});
  window.removeEventListener('keydown', onTrustedDiscrete, {capture: true});
}
