/*
 * GOVERNMENT SUPPORT — post-confirm SCALE-FOCUS choreography (console native).
 *
 * The premium beat the player asked for, in strict order:
 *   1. CLOSE the modal first (the pick is registered) — `closing`.
 *   2. THEN submit → the server raises the parameter → the board scale glides
 *      AND gets a one-shot ACCENT glow (an `<html>` class this module toggles;
 *      the CSS lives in console.less, so NO shared board component is edited).
 *   3. Only AFTER that beat does the next modal (research / draft) open — the
 *      hold gates it (`holding`).
 *
 * Why submit is DELAYED until the modal has closed: the scale glide is driven
 * by the parameter VALUE change, which only lands on the server commit. If we
 * submitted on press, the glide fired WHILE the modal was still dismissing
 * ("at press"). Submitting AFTER the close means the value change — and thus
 * the glide + accent — happens on a already-clean board.
 *
 * Bounded by timers so the UI can never get stuck (a lost response force-
 * releases). Reduced motion collapses every beat to a near-instant handoff.
 */

import {reactive} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';

/** Modal-close beat before the submit (≥ the con-layer leave fade ~140ms). */
export const GOV_CLOSE_MS = 200;
/** Accent + hold window after the commit, before the next modal opens. */
export const GOV_HOLD_MS = 900;
const REDUCED_CLOSE_MS = 60;
const REDUCED_HOLD_MS = 150;
/** A lost response can never strand the hidden modal. */
const SAFETY_MS = 5000;

/** The leaf raises with a board arc scale to accent (temp/oxygen/venus). */
export const SCALE_FOCUS_PARAMS: ReadonlySet<string> = new Set(['temperature', 'oxygen', 'venus']);
const FOCUS_CLASS_PARAMS: ReadonlyArray<string> = ['temperature', 'oxygen', 'venus'];

export const govScaleFocusState = reactive({
  /** Modal is closing before the submit — hide the panel, swallow input. */
  closing: false,
  /** Next modal is held while the scale glides + accents. */
  holding: false,
  /** The raised parameter (drives the accent class + which scale). */
  param: undefined as string | undefined,
});

let armedParam: string | undefined;
let closeTimer: number | undefined;
let releaseTimer: number | undefined;
let safetyTimer: number | undefined;

function clearTimer(t: number | undefined): void {
  if (t !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(t);
  }
}

function applyFocusClass(param: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('con-scale-focus-' + param);
  }
}

function clearFocusClass(): void {
  if (typeof document !== 'undefined') {
    for (const p of FOCUS_CLASS_PARAMS) {
      document.documentElement.classList.remove('con-scale-focus-' + p);
    }
  }
}

/**
 * Press → CLOSE the modal, THEN (after the close beat) run `submit`. The arm
 * is set only at submit time so a poll-commit BETWEEN press and submit can't
 * trigger the hold early.
 */
export function beginGovScaleClose(param: string, submit: () => void): void {
  govScaleFocusState.closing = true;
  govScaleFocusState.param = param;
  clearTimer(closeTimer);
  clearTimer(safetyTimer);
  const delay = prefersReducedMotion() ? REDUCED_CLOSE_MS : motionMs(GOV_CLOSE_MS);
  const fire = () => {
    armedParam = param;
    submit();
    // Safety: if the commit never arrives, don't strand the hidden modal.
    if (typeof window !== 'undefined') {
      safetyTimer = window.setTimeout(() => {
        if (armedParam !== undefined) {
          armedParam = undefined;
          releaseGovScaleFocus();
        }
      }, SAFETY_MS);
    }
  };
  if (typeof window !== 'undefined') {
    closeTimer = window.setTimeout(fire, delay);
  } else {
    fire();
  }
}

/**
 * Begin the hold + accent IF armed — call on the server commit that follows
 * the submit. The arm is consumed on the first call (a poll re-commit during
 * the hold never re-arms). Returns true when a hold started (the shell then
 * snaps to the board so the scale is visible).
 */
export function commitGovScaleFocus(): boolean {
  if (armedParam === undefined) {
    return false;
  }
  const param = armedParam;
  armedParam = undefined;
  clearTimer(safetyTimer);
  govScaleFocusState.closing = false;
  govScaleFocusState.holding = true;
  govScaleFocusState.param = param;
  applyFocusClass(param); // one-shot scale accent (CSS in console.less)
  clearTimer(releaseTimer);
  const hold = prefersReducedMotion() ? REDUCED_HOLD_MS : motionMs(GOV_HOLD_MS);
  if (typeof window !== 'undefined') {
    releaseTimer = window.setTimeout(releaseGovScaleFocus, hold);
  } else {
    releaseGovScaleFocus();
  }
  return true;
}

export function releaseGovScaleFocus(): void {
  clearTimer(closeTimer);
  clearTimer(releaseTimer);
  clearTimer(safetyTimer);
  clearFocusClass();
  govScaleFocusState.closing = false;
  govScaleFocusState.holding = false;
  govScaleFocusState.param = undefined;
}

/** Drop any pending state (shell unmount / game switch). */
export function resetGovScaleFocus(): void {
  armedParam = undefined;
  releaseGovScaleFocus();
}
