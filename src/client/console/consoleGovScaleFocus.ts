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
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {consoleSessionScope, sessionState} from '@/client/console/session/consoleSession';

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

// The close beat + the scale glide/accent hold the presentation, so the next
// modal AND any poll-delivered notification wait for the choreography to
// finish (bounded by this module's own timers + safety).
// THE CEILING ENDS THE WEDGE, NOT JUST THE COUNT: the beat's own safety
// release (the lost-commit path) — the arm dropped, the accent cleared, the
// hidden modal / the next modal let go.
registerAnimationHoldSupplier('gov-scale-focus', () => govScaleFocusState.closing || govScaleFocusState.holding, {
  // Waits for the SERVER — never judged as a still motion (`motionWitness.ts`): `closing` stands until the next server commit.
  waitsFor: 'server',
  diagnose: () => ({closing: govScaleFocusState.closing, holding: govScaleFocusState.holding,
    param: govScaleFocusState.param, armed: armedParam}),
  expire: () => {
    if (!govScaleFocusState.closing && !govScaleFocusState.holding) {
      return;
    }
    console.warn('[consoleGovScaleFocus] government-support scale focus: outlived its ceiling — ended');
    armedParam = undefined;
    releaseGovScaleFocus();
  },
});

let armedParam: string | undefined;
// The beat's three waits, owned by the session: the close beat is PACING (its submit must not go into a game that
// left); the hold's end and the lost-commit safety are RELEASES (the hidden modal is let go at their time, or when the
// game screen leaves).
let cancelClose: () => void = () => {};
let disarmRelease: () => void = () => {};
let disarmSafety: () => void = () => {};

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
  cancelClose();
  disarmSafety();
  const delay = prefersReducedMotion() ? REDUCED_CLOSE_MS : motionMs(GOV_CLOSE_MS);
  const fire = () => {
    armedParam = param;
    submit();
    // Safety: if the commit never arrives, don't strand the hidden modal.
    if (typeof window !== 'undefined') {
      disarmSafety = consoleSessionScope().guarantee(SAFETY_MS, 'the government-support raise\'s commit (the hidden modal\'s safety)', () => {
        if (armedParam !== undefined) {
          armedParam = undefined;
          releaseGovScaleFocus();
        }
      });
    }
  };
  if (typeof window !== 'undefined') {
    cancelClose = consoleSessionScope().after(delay, 'the modal\'s close beat — then the submit', fire);
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
  disarmSafety();
  govScaleFocusState.closing = false;
  govScaleFocusState.holding = true;
  govScaleFocusState.param = param;
  applyFocusClass(param); // one-shot scale accent (CSS in console.less)
  disarmRelease();
  const hold = prefersReducedMotion() ? REDUCED_HOLD_MS : motionMs(GOV_HOLD_MS);
  if (typeof window !== 'undefined') {
    disarmRelease = consoleSessionScope().guarantee(hold, 'the raised scale\'s accent hold', releaseGovScaleFocus);
  } else {
    releaseGovScaleFocus();
  }
  return true;
}

export function releaseGovScaleFocus(): void {
  cancelClose();
  disarmRelease();
  disarmSafety();
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

// THE GAME SCREEN LEAVES: this state goes with it — declared here, taken down by the session's ordered pass
// (architecture v2 — PLAN §10 · C5; the number is its place in that pass — `leaveConsoleSession`).
sessionState('gov-scale-focus', resetGovScaleFocus, 460);
