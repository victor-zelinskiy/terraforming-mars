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

/**
 * `absorbed` — the console TOOK the press on purpose and did nothing with it (a deliberate gate — the decision's settle,
 * a batch still landing, a take in flight; `inputAbsorb.ts`): consumed, but not acted on. The gates are named in
 * `last.absorbedBy`, so a driver waits for exactly them and presses again.
 */
export type InputEchoOutcome = 'consumed' | 'absorbed' | 'system' | 'unconsumed' | 'update-gate';

export type InputEchoEvent = {code: string, kind: string, outcome: InputEchoOutcome, at: number, absorbedBy?: Array<string>};

export type InputEchoSnapshot = {
  /** Every recognized console key event — the driver's «did my key arrive at all». */
  seq: number;
  /** PRESS edges alone (keyboard only — the driver's echo). */
  presses: number;
  /**
   * The two VERBS every live surface must answer — A (confirm) and B (back) — pressed on ANY device (counted at the
   * router, `dispatchConsoleIntent`, which both the key bridge and the gamepad layer go through). The liveness
   * arbiter counts THESE: an optional verb with nothing to do (X on a panel with nothing to inspect, an arrow against a
   * ring's wall) is an honest no-op, never a wedge (the false «presses-no-effect» on the pass-confirm panel, 2026-10-31).
   */
  verbPresses: number;
  /** …of those, the ones NO handler took (`dispatchConsoleIntent` answered false) — the deaf screen's signature. */
  verbDropped: number;
  /**
   * …and the B presses a handler DID take. B is never an honest no-op on a frame standing past its commit (it collapses
   * it — `backVerbFor`), so a taken B that changed nothing there is the OTHER deaf screen: a surface whose own handler
   * swallows the verb while nothing is in flight (the chairman quest's leaked beat, 2026-11-07). The arbiter counts these
   * only on such a frame (`LivenessSample.backJudged`).
   */
  backTaken: number;
  consumed: number;
  system: number;
  unconsumed: number;
  updateGate: number;
  /** Presses a deliberate gate swallowed (`absorbed`). */
  absorbed: number;
  last?: InputEchoEvent;
  /** The last PRESS edge (a key press is down + up — `last` is usually the release; a driver reads this). */
  lastPress?: InputEchoEvent;
};

const state: InputEchoSnapshot = {
  seq: 0,
  presses: 0,
  verbPresses: 0,
  verbDropped: 0,
  backTaken: 0,
  consumed: 0,
  system: 0,
  unconsumed: 0,
  updateGate: 0,
  absorbed: 0,
};

export function recordInputEcho(code: string, kind: string, outcome: InputEchoOutcome, absorbedBy?: ReadonlyArray<string>): void {
  state.seq++;
  if (kind === 'press') {
    state.presses++;
  }
  switch (outcome) {
  case 'consumed': state.consumed++; break;
  case 'system': state.system++; break;
  case 'unconsumed': state.unconsumed++; break;
  case 'update-gate': state.updateGate++; break;
  case 'absorbed': state.absorbed++; break;
  }
  state.last = {code, kind, outcome, at: Date.now(), ...(absorbedBy !== undefined && absorbedBy.length > 0 ? {absorbedBy: [...absorbedBy]} : {})};
  if (kind === 'press') {
    state.lastPress = state.last;
  }
}

/**
 * THE PRESS WAS ROUTED TO A SURFACE THAT IS NOT THERE. The shell's router decides who owns the pad from the game's
 * state (`padRouterController.handleIntent`) and hands the intent to that surface's own handler; a surface the state
 * says owns the pad but that is not MOUNTED receives nothing. The router still consumes the intent (nothing may act
 * under an owned pad) — and says here that nobody received it, so the verb is counted DROPPED (`verbDropped`, the deaf
 * screen's signature) instead of taken. Read and cleared by the dispatch that is in progress.
 */
let unreceivedBy: string | undefined;

export function noteUnreceivedPress(surface: string): void {
  unreceivedBy = surface;
}

/** The surface the dispatch in progress was routed to and that was not there (`undefined` — somebody received it). */
export function takeUnreceivedPress(): string | undefined {
  const by = unreceivedBy;
  unreceivedBy = undefined;
  return by;
}

/** A/B reached the console router (any device) — see `verbPresses`; `taken` = a handler consumed it. */
export function recordVerbPress(taken: boolean, back = false): void {
  state.verbPresses++;
  if (!taken) {
    state.verbDropped++;
  } else if (back) {
    state.backTaken++;
  }
}

export function inputEchoSnapshot(): InputEchoSnapshot {
  return {...state, last: state.last === undefined ? undefined : {...state.last},
    lastPress: state.lastPress === undefined ? undefined : {...state.lastPress}};
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
  unreceivedBy = undefined;
  state.seq = 0;
  state.presses = 0;
  state.verbPresses = 0;
  state.verbDropped = 0;
  state.backTaken = 0;
  state.consumed = 0;
  state.system = 0;
  state.unconsumed = 0;
  state.updateGate = 0;
  state.absorbed = 0;
  state.last = undefined;
  state.lastPress = undefined;
}
