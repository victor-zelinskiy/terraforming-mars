/*
 * CARD DISCARD STATE — the reactive stage registry behind
 * ConsoleCardDiscardLayer (the flight list, the tray, the element registry).
 *
 * Split out of the transaction (consoleCardDiscard.ts) for the same reason
 * every other console scene splits it: the layer imports ONLY this, so the
 * stage can never pull the flow's game-facing logic into a render.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {DiscardPhase} from '@/client/console/cardDiscard/discardModel';
import {createFlowRun} from '@/client/console/session/flowRun';

export type DiscardFlight = {
  id: number,
  name: CardName,
  /** Paint order — a later card in the pick lands on top of an earlier one. */
  z: number,
};

/** The hand discard's lease name on the table's discard pile (`console/discardPile/discardPile.ts`). */
export const HAND_DISCARD_PILE_LEASE = 'hand-discard';

export const cardDiscardState = reactive({
  /** The stage is mounted only while a discard is on screen. */
  live: false,
  phase: 'idle' as DiscardPhase,
  flights: [] as Array<DiscardFlight>,
  /** The tray is visible from `leaving` until the scene settles out. */
  trayVisible: false,
  /** ARMED as a RECEIVER: the pile lights up BEFORE the cards start travelling,
   *  so it visibly waits for them instead of materialising under them. */
  trayArmed: false,
  /** Cards ALREADY swallowed by this pile — ticks on physical contact. */
  trayCount: 0,
  /** Bumped on each contact so the layer can replay its one-shot pulse. */
  trayPulseNonce: 0,
});

const els = new Map<number, HTMLElement>();

/**
 * THE STAGE'S RUN — `scene:card-discard:stage#n`: the layer stands from a driver's opening (the hand discard's run,
 * the open cards' refusal) to the stage's reset. `live` is its life: a stage nobody reset — a driver that threw past
 * its `finally`, the game screen leaving under a flight — does not stay mounted; the session's end resets it.
 */
const stageRun = createFlowRun('card-discard:stage', {
  // THE FLAG IS THE RUN'S LIFE (`flowRun.ts`) — written nowhere else: it falls with the run, on every path.
  flag: (up) => {
    cardDiscardState.live = up;
  },
  orphaned: () => resetCardDiscardStage(),
});

/** A driver opens the stage (idempotent while it stands). */
export function openCardDiscardStage(): void {
  if (!stageRun.live()) {
    stageRun.begin();
  }
}

/** The stage closes with NOTHING else touched (a driver that found nothing to fly leaves it as it found it). */
export function closeCardDiscardStage(): void {
  stageRun.end();
}
let seq = 0;
let trayEl: HTMLElement | undefined;

export function nextDiscardFlightId(): number {
  return ++seq;
}

/** Function-ref hook from the layer (v-for order is not guaranteed). */
export function registerDiscardEl(id: number, el: HTMLElement | null): void {
  if (el === null) {
    els.delete(id);
  } else {
    els.set(id, el);
  }
}

export function discardFlightEl(id: number): HTMLElement | undefined {
  return els.get(id);
}

/** The landing box the flying cards aim at (the tray's slot element). */
export function registerDiscardTrayEl(el: HTMLElement | null): void {
  trayEl = el ?? undefined;
}

export function discardTrayEl(): HTMLElement | undefined {
  return trayEl;
}

export function removeDiscardFlights(ids: ReadonlyArray<number>): void {
  const drop = new Set(ids);
  cardDiscardState.flights = cardDiscardState.flights.filter((f) => !drop.has(f.id));
  ids.forEach((id) => els.delete(id));
}

/** One card has physically reached the pile: thicken it and tick the count. */
export function noticeDiscardLanding(): void {
  cardDiscardState.trayCount++;
  cardDiscardState.trayPulseNonce++;
}

export function resetCardDiscardStage(): void {
  stageRun.end();
  cardDiscardState.phase = 'idle';
  cardDiscardState.flights = [];
  cardDiscardState.trayVisible = false;
  cardDiscardState.trayArmed = false;
  cardDiscardState.trayCount = 0;
  cardDiscardState.trayPulseNonce = 0;
  els.clear();
}
