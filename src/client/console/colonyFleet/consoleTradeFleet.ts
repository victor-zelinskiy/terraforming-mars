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
import {CardName} from '@/common/cards/CardName';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import type {TradeFleetDirectorHandle} from '@/client/console/colonyFleet/tradeFleetDirector';

export type FleetPhase = 'idle' | 'launch' | 'transit' | 'approach' | 'dock' | 'ack';

/**
 * WHERE THE FLEET GOES — a colony tile, or a fleet-dock CARD of the trader's
 * own (Turmoil Redux TR06 Water Hauling and its sisters: the trade's
 * destination is the card, and the fleet lands on the ▲ of its printed effect).
 * One director, one ship, one layer for both — only the landing anchor differs.
 */
export type TradeFleetTarget = {kind: 'colony', colonyName: ColonyName} | {kind: 'card', card: CardName};

type TradeFleetState = {
  /** Any non-idle phase — the input gate + poll re-entrancy guard. */
  active: boolean;
  phase: FleetPhase;
  /** Where the armed fleet goes (undefined while idle). */
  target: TradeFleetTarget | undefined;
  /**
   * The colony being traded with (its berth is the landing anchor) — the
   * COLONY half of `target`, kept as its own field because every colony
   * reader (the tile, the stage's orbit, the settle glow) asks exactly this;
   * '' for a card target, so no colony ever claims a dock's flight.
   */
  colonyName: ColonyName | '';
  /** The fleet-dock card the armed fleet goes to ('' for a colony target). */
  card: CardName | '';
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
  /** …and the same one-shot for a fleet that just landed on a dock CARD. */
  dockedCard: CardName | '';
};

export const tradeFleetState = reactive<TradeFleetState>({
  active: false,
  phase: 'idle',
  target: undefined,
  colonyName: '',
  card: '',
  color: '',
  nonce: 0,
  reducedMotion: false,
  dockedColonyName: '',
  dockedCard: '',
});

/** A bare colony name is a colony target (every pre-dock caller's shape). */
function normalizeTarget(target: TradeFleetTarget | ColonyName): TradeFleetTarget {
  return typeof target === 'string' ? {kind: 'colony', colonyName: target} : target;
}

let handle: TradeFleetDirectorHandle | undefined;
/** Resolves when the DOCK snap completes (the WaitingFor gate awaits this). */
let dockResolve: (() => void) | undefined;
/**
 * THE LAYER IS STILL MEASURING ITS ANCHORS (the launch pad and the berth) — a
 * director is ABOUT to exist. A fast server can answer inside that window
 * (measured at 4K headless: the response at ~200 ms, the director at ~250 ms),
 * and resolving the gate there committed the view with the ship still on its
 * pad — the fleet never flew, the mark appeared on the berth from nowhere. So
 * while a launch is pending the gate WAITS for the director (or for the
 * layer's own «no flight» verdict), bounded by `LAUNCH_WAIT_MS`.
 */
let launchPending = false;
/** The gate's resolver parked while the launch is still measuring. */
let parkedDock: (() => void) | undefined;
let parkedDockSafety = 0;
/** The longest a gate waits for a pending launch to produce its director. */
const LAUNCH_WAIT_MS = 1500;

function clearParkedDock(): void {
  if (parkedDockSafety !== 0) {
    clearTimeout(parkedDockSafety);
    parkedDockSafety = 0;
  }
}

/** Hand a parked gate to whoever can resolve it now: the director's dock, or nothing (resolve). */
function releaseParkedDock(): void {
  const done = parkedDock;
  parkedDock = undefined;
  clearParkedDock();
  if (done === undefined) {
    return;
  }
  if (handle !== undefined) {
    handle.dock(done);
  } else {
    done();
  }
}

/**
 * The layer reports its launch's measurement window: `true` while it probes
 * the anchors, `false` once it has either registered a director or decided
 * there is no believable flight (the phases still advance — the gate resolves).
 */
export function setTradeFleetLaunchPending(pending: boolean): void {
  launchPending = pending;
  if (!pending) {
    releaseParkedDock();
  }
}
let claimed = false; // detectTradeFleet consumes the arm exactly once
let armSafetyId = 0;
let settleTimerId = 0;

export function isTradeFleetActive(): boolean {
  return tradeFleetState.active;
}

// The flight is VISUAL from the arm itself (the ship lifts off at confirm —
// the client-side leg), so the whole active window holds the presentation;
// releases the instant end/abort drops `active` (dock = the GSAP signal).
// The ceiling's owner recovery is the module's own recall — the hydro-marker
// sibling law: past every net a still-active flight is a dead transaction.
registerAnimationHoldSupplier('trade-fleet', isTradeFleetActive, {
  expire: () => abortTradeFleet(),
});

/** The director registers its handle so the controller can drive dock/skip. */
export function registerTradeFleetHandle(h: TradeFleetDirectorHandle | undefined): void {
  handle = h;
  if (h !== undefined && parkedDock !== undefined) {
    launchPending = false;
    releaseParkedDock();
  }
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
export function armTradeFleet(destination: TradeFleetTarget | ColonyName, color: Color): void {
  const target = normalizeTarget(destination);
  clearArmSafety();
  claimed = false;
  tradeFleetState.active = true;
  tradeFleetState.phase = 'launch';
  tradeFleetState.target = target;
  tradeFleetState.colonyName = target.kind === 'colony' ? target.colonyName : '';
  tradeFleetState.card = target.kind === 'card' ? target.card : '';
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
export function detectTradeFleet(): {colonyName: ColonyName | '', card: CardName | ''} | undefined {
  if (!tradeFleetState.active || claimed) {
    return undefined;
  }
  claimed = true;
  clearArmSafety(); // the server confirmed — the abort net is no longer needed
  return {colonyName: tradeFleetState.colonyName, card: tradeFleetState.card};
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
  } else if (launchPending && tradeFleetState.active) {
    // The director is ABOUT to exist (the layer is measuring its anchors): the
    // gate waits for it, never commits the view under a ship still on its pad.
    parkedDock = done;
    clearParkedDock();
    parkedDockSafety = setTimeout(() => {
      parkedDockSafety = 0;
      const parked = parkedDock;
      parkedDock = undefined;
      parked?.();
    }, LAUNCH_WAIT_MS) as unknown as number;
  } else {
    // No live director (degenerate / reduced-motion snap already finished):
    // resolve on the next tick so the commit still sequences cleanly.
    setTimeout(done, tradeFleetState.reducedMotion ? 0 : 120);
  }
  return promise;
}

/**
 * END (next tick, after the view committed) — the REAL docked ship has now
 * materialized in the exact berth rect UNDER the pixel-perfect landed proxy.
 * CROSSFADE the proxy out onto it (`handle.release`), and only when the fade
 * completes CLEAR the flight (unmount the proxy) + fire the one-shot settle
 * glow on the real ship — so the handoff is seamless (proxy → real, same
 * position/size/angle), never a "vanish at centre then reappear". Idempotent.
 */
export function endTradeFleet(): void {
  clearArmSafety();
  const colony = tradeFleetState.colonyName;
  const card = tradeFleetState.card;
  const finalize = () => {
    tradeFleetState.active = false;
    tradeFleetState.phase = 'idle';
    tradeFleetState.color = '';
    tradeFleetState.target = undefined;
    tradeFleetState.colonyName = '';
    tradeFleetState.card = '';
    handle = undefined;
    claimed = false;
    // The real docked ship is in place — give it a one-shot settle glow now
    // the proxy has fully faded (never a double image during the crossfade).
    if (colony !== '' || card !== '') {
      tradeFleetState.dockedColonyName = colony;
      tradeFleetState.dockedCard = card;
      if (settleTimerId !== 0) {
        clearTimeout(settleTimerId);
      }
      settleTimerId = setTimeout(() => {
        tradeFleetState.dockedColonyName = '';
        tradeFleetState.dockedCard = '';
        settleTimerId = 0;
      }, 900) as unknown as number;
    }
  };
  if (handle !== undefined) {
    handle.release(finalize);
  } else {
    finalize();
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
  launchPending = false;
  parkedDock = undefined;
  clearParkedDock();
  tradeFleetState.active = false;
  tradeFleetState.phase = 'idle';
  tradeFleetState.color = '';
  tradeFleetState.target = undefined;
  tradeFleetState.colonyName = '';
  tradeFleetState.card = '';
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
  launchPending = false;
  parkedDock = undefined;
  clearParkedDock();
  tradeFleetState.active = false;
  tradeFleetState.phase = 'idle';
  tradeFleetState.target = undefined;
  tradeFleetState.colonyName = '';
  tradeFleetState.card = '';
  tradeFleetState.color = '';
  tradeFleetState.nonce = 0;
  tradeFleetState.reducedMotion = false;
  tradeFleetState.dockedColonyName = '';
  tradeFleetState.dockedCard = '';
}
