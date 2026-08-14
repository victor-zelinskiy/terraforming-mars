/*
 * SHARED HOLD-TO-CONFIRM — «keep the button down to do the thing you cannot
 * undo».
 *
 * WHY IT IS NOT A SECOND PRESS. A two-step press is a good gate against a
 * MISAIMED press and a bad one against a FAST press: the player who taps A
 * twice out of habit passes it without ever reading the warning, which is
 * precisely the accident an irreversible action needs protection from. A hold
 * cannot be produced by tapping at all — the input itself carries the
 * deliberation, and letting go is a complete, safe cancel.
 *
 * SHARED BY CONSTRUCTION. One module, one duration, one progress value, one
 * ring — any console surface with a «this cannot be undone» press uses it
 * (`beginHoldConfirm` on the press intent, `cancelHoldConfirm` on the release).
 * It is deliberately keyed by an arbitrary STRING so it knows nothing about
 * preludes or any other feature.
 *
 * The duration is a FIXED constant and deliberately does NOT run through
 * `motionMs`/`--motion-scale`: that scale exists to shorten decoration, and a
 * player who has turned motion down has not asked for a safety gate they can
 * trip by accident. Reduced motion quietens the RING, never the hold.
 */
import {reactive} from 'vue';
import {observeConsoleIntents} from '@/client/console/consoleRouter';
import type {SemanticButton} from '@/client/gamepad/gamepadPollModel';

/** Long enough to be a decision, short enough not to be a chore. */
export const HOLD_CONFIRM_MS = 700;

export const holdConfirmState = reactive({
  /** What is being held right now ('' = nothing). Callers own the namespace. */
  key: '',
  /** 0 → 1 across {@link HOLD_CONFIRM_MS}; drives the ring and nothing else. */
  progress: 0,
});

let frame: number | undefined;
let startedAt = 0;
let pending: (() => void) | undefined;
let watching: (() => void) | undefined;
let heldButton: SemanticButton = 'confirm';

/** The clock, in one place, so the test seam and the frame loop agree. */
function now(): number {
  return typeof performance === 'object' && performance !== null &&
    typeof performance.now === 'function' ? performance.now() : Date.now();
}

function stopFrame(): void {
  if (frame !== undefined && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(frame);
  }
  frame = undefined;
}

function stopWatch(): void {
  watching?.();
  watching = undefined;
}

function tick(now: number): void {
  frame = undefined;
  if (holdConfirmState.key === '') {
    return;
  }
  const elapsed = now - startedAt;
  const progress = Math.max(0, Math.min(1, elapsed / HOLD_CONFIRM_MS));
  holdConfirmState.progress = progress;
  if (progress < 1) {
    if (typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(tick);
    }
    return;
  }
  // COMPLETE. Clear the state BEFORE running the callback: the callback almost
  // always tears down the very surface that armed this, and a hold left
  // «finished but still armed» would re-fire on the next release intent.
  const done = pending;
  pending = undefined;
  stopWatch();
  holdConfirmState.key = '';
  holdConfirmState.progress = 0;
  done?.();
}

/**
 * Start (or restart) the hold for `key`. Re-arming the SAME key mid-hold is
 * treated as a fresh press and restarts the ring — a pad that reports a
 * bounce can never be interpreted as «held all along».
 */
export function beginHoldConfirm(
  key: string, onComplete: () => void, button: SemanticButton = 'confirm'): void {
  if (key === '') {
    return;
  }
  stopFrame();
  stopWatch();
  heldButton = button;
  // THE GATE OWNS ITS OWN RELEASE. It deliberately does not rely on the host
  // surface forwarding the button-up: that edge travels through the shell's
  // routing, where several legitimate branches swallow falling edges, and a
  // hold that outlives the button is the one failure this mechanism may never
  // have. Observing the bus directly makes «letting go cancels» true by
  // construction, for every caller, on the pad and on the keyboard alike.
  watching = observeConsoleIntents((intent) => {
    if (intent.kind === 'release' && intent.button === heldButton) {
      cancelHoldConfirm();
    }
  });
  holdConfirmState.key = key;
  holdConfirmState.progress = 0;
  pending = onComplete;
  startedAt = now();
  if (typeof requestAnimationFrame !== 'function') {
    // No frame clock (unit test / headless): the gate stays armed at zero
    // progress and can only be resolved by an explicit cancel or the test
    // seam. Never auto-complete — an environment that cannot show the ring
    // must not be able to commit the irreversible action behind it.
    return;
  }
  frame = requestAnimationFrame(tick);
}

/**
 * Let go — the safe cancel. With no `key` it cancels whatever is held (the
 * blanket reset a surface uses when it unmounts, loses focus or is minimized);
 * with one it only cancels that hold, so an unrelated release cannot disarm it.
 */
export function cancelHoldConfirm(key?: string): void {
  if (key !== undefined && holdConfirmState.key !== key) {
    return;
  }
  stopFrame();
  stopWatch();
  pending = undefined;
  holdConfirmState.key = '';
  holdConfirmState.progress = 0;
}

export function isHoldConfirmActive(key: string): boolean {
  return holdConfirmState.key === key;
}

/** 0 when this key is not the one being held — safe to bind straight to CSS. */
export function holdConfirmProgress(key: string): number {
  return holdConfirmState.key === key ? holdConfirmState.progress : 0;
}

/** Test seam: drive the clock forward without a frame loop. */
export function advanceHoldConfirmForTest(ms: number): void {
  if (holdConfirmState.key === '') {
    return;
  }
  stopFrame();
  startedAt -= ms;
  tick(now());
}
