/**
 * @console-shared LIVE — console native stands on this file.
 *
 * INPUT ECHO — counters at the ONE keyboard→intent seam (consoleKeyBridge).
 *
 * Every RECOGNIZED console key event (press and release edges alike) is
 * counted with its OUTCOME, so an external driver (the e2e suite) can tell
 * «the press was delivered and consumed» apart from «the press was swallowed»
 * apart from «the press never mapped to anything» — three states that used to
 * be indistinguishable from the outside and each of which has produced its
 * own class of silent test failure (a visible button eating A during a
 * `submitting` re-arm, a disabled wheel slot, a key sent before the bridge
 * installed).
 *
 * Deliberately DEPENDENCY-FREE and non-reactive: the bridge is imported by
 * surfaces all over the app (menu screens included), so this module must not
 * drag the game-transport graph in behind it (a static import chain reaching
 * a webpack-chunk consumer silently zeroes mochapack spec files). Readers
 * poll; nothing watches.
 *
 * Published as `window.__conInputEcho` (a function returning a fresh
 * snapshot) by the key bridge's install — present wherever keyboard input is,
 * including pre-game menus. The in-game aggregate probe (`window.__conReady`,
 * `e2eReadiness.ts`) folds this snapshot in.
 */

export type InputEchoOutcome = 'consumed' | 'system' | 'unconsumed' | 'update-gate';

export type InputEchoSnapshot = {
  /** Every recognized console key event — the driver's «did my key arrive at all». */
  seq: number;
  consumed: number;
  system: number;
  unconsumed: number;
  updateGate: number;
  last?: {code: string, kind: string, outcome: InputEchoOutcome, at: number};
};

const state: InputEchoSnapshot = {
  seq: 0,
  consumed: 0,
  system: 0,
  unconsumed: 0,
  updateGate: 0,
};

export function recordInputEcho(code: string, kind: string, outcome: InputEchoOutcome): void {
  state.seq++;
  switch (outcome) {
  case 'consumed': state.consumed++; break;
  case 'system': state.system++; break;
  case 'unconsumed': state.unconsumed++; break;
  case 'update-gate': state.updateGate++; break;
  }
  state.last = {code, kind, outcome, at: Date.now()};
}

export function inputEchoSnapshot(): InputEchoSnapshot {
  return {...state, last: state.last === undefined ? undefined : {...state.last}};
}

/** Idempotent; called from the key bridge's install so the probe exists
 *  exactly where keyboard input does. */
export function installInputEchoProbe(): void {
  if (typeof window === 'undefined') {
    return;
  }
  (window as unknown as {__conInputEcho?: () => InputEchoSnapshot}).__conInputEcho = inputEchoSnapshot;
}

export function resetInputEchoForTest(): void {
  state.seq = 0;
  state.consumed = 0;
  state.system = 0;
  state.unconsumed = 0;
  state.updateGate = 0;
  state.last = undefined;
}
