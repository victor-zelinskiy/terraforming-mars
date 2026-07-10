/*
 * CONSOLE TRADE FLEET — controller + reactive state for the colony-trade
 * launch cinematic (the "send a trade fleet to the planet" premium moment).
 *
 * This is the transition GATE for a console colony trade — the colony
 * analogue of the energy→heat conversion / tile-placement holds in
 * WaitingFor.vue: the flight is CLIENT-armed at the composer's confirm (so
 * the ship lifts off immediately, independent of the server), then the
 * commit of the new view (delta chips, the docked-fleet board state, the
 * next prompt) is BLOCKED until the ship physically docks.
 *
 * Two legs compose:
 *   1. arm (confirm)  — launch → transit → APPROACH hold (client-side, plays
 *      at once; the ship hovers at the berth if the server is still working);
 *   2. run (response) — WaitingFor detects the armed flight, fires the final
 *      DOCK snap + colony ack, and resolves the gate → the view commits.
 *
 * Ownership split (mirrors energyConversionTransition):
 *   - the PURE timing / trajectory maths live in `tradeFleetModel.ts`
 *     (unit-tested under the server runner);
 *   - this module owns the reactive `tradeFleetState` (the layer + composer +
 *     tile read it), the director handle, the gate Promise, the arm/detect/
 *     run/abort/end lifecycle, and the poll re-entrancy guard.
 *
 * DESKTOP SAFETY: `armTradeFleet` is ONLY called by the console shell, so on
 * desktop (and for every non-trade submit) `tradeFleetState.active` is false
 * and `detectTradeFleet` returns undefined → the WaitingFor hold never
 * engages. The feature is entirely console-native + fully gated.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import type {TradeFleetDirectorHandle} from '@/client/console/colonyFleet/tradeFleetDirector';

export type FleetPhase = 'idle' | 'launch' | 'transit' | 'approach' | 'dock' | 'ack';

type TradeFleetState = {
  /** Any non-idle phase — the input gate + poll re-entrancy guard. */
  active: boolean;
  phase: FleetPhase;
  /** The colony being traded with (its berth is the landing anchor). */
  colonyName: ColonyName | '';
  /** The trader's fleet colour (the flying ship + owner-hue dock). */
  color: Color | '';
  /** Bumped per launch — the layer re-measures the anchors + re-runs. */
  nonce: number;
  reducedMotion: boolean;
  /**
   * Briefly set to the traded colony right AFTER the commit, so the freshly
   * materialized real docked ship plays a one-shot "settle" seat glow — the
   * handoff from the flown proxy to the board state. Cleared by a timer.
   */
  dockedColonyName: ColonyName | '';
};

export const tradeFleetState = reactive<TradeFleetState>({
  active: false,
  phase: 'idle',
  colonyName: '',
  color: '',
  nonce: 0,
  reducedMotion: false,
  dockedColonyName: '',
});

let handle: TradeFleetDirectorHandle | undefined;
/** Resolves when the DOCK snap completes (the WaitingFor gate awaits this). */
let dockResolve: (() => void) | undefined;
let claimed = false; // detectTradeFleet consumes the arm exactly once
let armSafetyId = 0;
let settleTimerId = 0;

export function isTradeFleetActive(): boolean {
  return tradeFleetState.active;
}

/** The director registers its handle so the controller can drive dock/skip. */
export function registerTradeFleetHandle(h: TradeFleetDirectorHandle | undefined): void {
  handle = h;
}

/** The director reports phase transitions (launch → transit → approach). */
export function setTradeFleetPhase(phase: FleetPhase): void {
  if (tradeFleetState.active) {
    tradeFleetState.phase = phase;
  }
}

function clearArmSafety(): void {
  if (armSafetyId !== 0) {
    clearTimeout(armSafetyId);
    armSafetyId = 0;
  }
}

/**
 * ARM (composer confirm) — start the client-side leg immediately (the ship
 * charges, lifts off the composer and flies toward the target berth, then
 * hovers on approach). Sets `active` SYNCHRONOUSLY so the input gate closes
 * at once (no double submit) and the poll guard is live. The layer's nonce
 * watcher runs the director. A safety net aborts a flight the server never
 * confirms (see the abort timer).
 */
export function armTradeFleet(colonyName: ColonyName, color: Color): void {
  clearArmSafety();
  claimed = false;
  tradeFleetState.active = true;
  tradeFleetState.phase = 'launch';
  tradeFleetState.colonyName = colonyName;
  tradeFleetState.color = color;
  tradeFleetState.reducedMotion = consoleReducedMotionActive();
  tradeFleetState.nonce++;
  // If no server response confirms the trade within a generous window (a
  // dropped/errored submit that never reached the WaitingFor detect), recall
  // the fleet gracefully so the UI can't strand in "in transit forever".
  armSafetyId = setTimeout(() => abortTradeFleet(), 12000) as unknown as number;
}

/**
 * DETECT (WaitingFor commit path) — is there an armed console flight to gate
 * this response behind? Returns a lightweight event exactly ONCE per arm
 * (claimed here, synchronously, so two near-simultaneous responses can't both
 * fire it). Undefined on desktop / for every non-trade submit (never armed).
 */
export function detectTradeFleet(): {colonyName: ColonyName | ''} | undefined {
  if (!tradeFleetState.active || claimed) {
    return undefined;
  }
  claimed = true;
  clearArmSafety(); // the server confirmed — the abort net is no longer needed
  return {colonyName: tradeFleetState.colonyName};
}

/**
 * RUN (WaitingFor await) — the server confirmed the trade: fire the final
 * DOCK snap + colony ack and resolve when the ship is seated. The caller
 * commits the new view right after (delta chips fire on a ship already
 * docked). If the flight is still in transit, the director docks as soon as
 * it reaches the berth; a safety guarantees resolution even if rAF is frozen.
 */
export function runTradeFleet(): Promise<void> {
  const promise = new Promise<void>((resolve) => {
    dockResolve = resolve;
  });
  const done = () => {
    const r = dockResolve;
    dockResolve = undefined;
    r?.();
  };
  if (handle !== undefined) {
    handle.dock(done);
  } else {
    // No live director (degenerate / reduced-motion snap already finished):
    // resolve on the next tick so the commit still sequences cleanly.
    setTimeout(done, tradeFleetState.reducedMotion ? 0 : 120);
  }
  return promise;
}

/**
 * END (next tick, after the view committed) — hand the flight off: mark the
 * traded colony for a brief "settle" seat glow on its now-real docked ship,
 * then clear. Idempotent.
 */
export function endTradeFleet(): void {
  clearArmSafety();
  const colony = tradeFleetState.colonyName;
  tradeFleetState.active = false;
  tradeFleetState.phase = 'idle';
  tradeFleetState.color = '';
  tradeFleetState.colonyName = '';
  handle = undefined;
  claimed = false;
  // The real docked ship just materialized under the (now-gone) proxy —
  // give it a one-shot settle glow so the handoff reads continuous.
  if (colony !== '') {
    tradeFleetState.dockedColonyName = colony;
    if (settleTimerId !== 0) {
      clearTimeout(settleTimerId);
    }
    settleTimerId = setTimeout(() => {
      tradeFleetState.dockedColonyName = '';
      settleTimerId = 0;
    }, 900) as unknown as number;
  }
}

/**
 * ABORT (submit error / stall) — recall the fleet gracefully. The director
 * dissolves the proxy; the shell closes the composer and the WaitingFor error
 * alert (if any) explains. Never resolves a false success. Idempotent.
 */
export function abortTradeFleet(): void {
  clearArmSafety();
  if (!tradeFleetState.active && dockResolve === undefined) {
    return;
  }
  handle?.skip();
  handle = undefined;
  claimed = false;
  tradeFleetState.active = false;
  tradeFleetState.phase = 'idle';
  tradeFleetState.color = '';
  tradeFleetState.colonyName = '';
  const r = dockResolve;
  dockResolve = undefined;
  r?.(); // never leave the WaitingFor gate awaiting
}

/** Test-only full reset. */
export function resetTradeFleet(): void {
  clearArmSafety();
  if (settleTimerId !== 0) {
    clearTimeout(settleTimerId);
    settleTimerId = 0;
  }
  handle = undefined;
  dockResolve = undefined;
  claimed = false;
  tradeFleetState.active = false;
  tradeFleetState.phase = 'idle';
  tradeFleetState.colonyName = '';
  tradeFleetState.color = '';
  tradeFleetState.nonce = 0;
  tradeFleetState.reducedMotion = false;
  tradeFleetState.dockedColonyName = '';
}
