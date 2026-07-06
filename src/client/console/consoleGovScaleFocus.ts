/*
 * GOVERNMENT SUPPORT — post-confirm SCALE-FOCUS gate (console native).
 *
 * After the player confirms a World Government parameter raise, the board
 * global-parameter scale glides AND the top-HUD delta chip fires — the real,
 * premium "the planet changed" feedback. The NEXT prompt (research / draft)
 * arrives on the SAME server commit and its modal backdrop would cover that
 * feedback. This tiny gate HOLDS the shell's next modal for a short beat so
 * the increase reads in ONE place — on the scales — then releases.
 *
 * Deliberately NOT the energy-heat gate's rAF interpolation — just an
 * arm → commit → bounded-hold. A single timer guarantees the hold can never
 * outlive the beat (input is never blocked longer than that). Reduced-motion
 * collapses it to a near-instant handoff (no glide to wait for).
 */

import {reactive} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';

/** The hold beat (ms, standard preset) — long enough for the glide to read. */
export const GOV_SCALE_FOCUS_HOLD_MS = 850;
/** Reduced-motion: just let the modal close + reopen, no real pause. */
const REDUCED_HOLD_MS = 120;

/** The board scales this gate waits on (leaf raises with an arc scale). */
export const SCALE_FOCUS_PARAMS: ReadonlySet<string> = new Set(['temperature', 'oxygen', 'venus']);

export const govScaleFocusState = reactive({
  /** True while the next modal is held so the board scale can animate. */
  holding: false,
  /** The raised parameter (a hook for an optional scale highlight). */
  param: undefined as string | undefined,
});

let armedParam: string | undefined;
let releaseTimer: number | undefined;

function clearTimer(): void {
  if (releaseTimer !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(releaseTimer);
  }
  releaseTimer = undefined;
}

/** Arm right before submitting a leaf WGT parameter raise (temp/oxygen/venus). */
export function armGovScaleFocus(param: string): void {
  armedParam = param;
}

/**
 * Begin the hold IF armed — call on the server commit that follows the
 * submit. The arm is consumed on the first call, so a poll re-commit during
 * the hold never re-arms it. Returns true when a hold started (the shell
 * then snaps to the board so the scale is visible).
 */
export function commitGovScaleFocus(): boolean {
  if (armedParam === undefined) {
    return false;
  }
  const param = armedParam;
  armedParam = undefined;
  govScaleFocusState.holding = true;
  govScaleFocusState.param = param;
  const hold = prefersReducedMotion() ? REDUCED_HOLD_MS : motionMs(GOV_SCALE_FOCUS_HOLD_MS);
  clearTimer();
  if (typeof window !== 'undefined') {
    releaseTimer = window.setTimeout(releaseGovScaleFocus, hold);
  } else {
    releaseGovScaleFocus();
  }
  return true;
}

export function releaseGovScaleFocus(): void {
  clearTimer();
  govScaleFocusState.holding = false;
  govScaleFocusState.param = undefined;
}

/** Drop any armed / holding state (shell unmount / game switch). */
export function resetGovScaleFocus(): void {
  armedParam = undefined;
  releaseGovScaleFocus();
}
