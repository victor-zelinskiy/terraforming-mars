/*
 * HAND INTAKE STATE — the registry behind every "cards physically arrive in
 * the player's hand" cinematic (handDeliveryDirector + ConsoleHandDeliveryLayer):
 * the starting-cards delivery, the reveal-modal takes («взять» / «взять все»),
 * the single-card fullscreen take and the research-buy purchase.
 *
 * TWO hold ledgers keep an arriving card out of the dock until it PHYSICALLY
 * lands (the dock hides it with layout + excludes it from the shown count):
 *
 *  - `held` — the EPISODIC pre-flight hold (armDeliveryHold): the start
 *    ceremony withholds the bought cards from the wizard submit until the
 *    payment confirm fires the flight. Names move `held` → `inFlight` the
 *    moment their flight begins (the dock union makes that hand-off
 *    invisible).
 *  - `inFlight` — a MULTISET of names currently being flown into the dock by
 *    a live intake run. One copy is released per touchdown — that release IS
 *    what materializes the real dock card and ticks the «КАРТЫ» counter, so
 *    the count can only ever grow on a physical landing.
 *
 * `flights` — one face→back flip proxy per travelling card on the fixed
 * delivery layer, each carrying its DOCK-ORDER z (a later hand card always
 * paints over the one it will cover). All motion / lifecycle lives in
 * handDeliveryDirector.ts. Mirrors the reveal / exit layers' function-ref
 * element registry (v-for order is not guaranteed).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

export type DeliveryFlight = {
  id: number,
  name: CardName,
  /** Stacking inside the delivery layer — the card's DOCK order (a card that
   *  ends up higher in the hand pack flies above its neighbours too). */
  z: number,
};

export const handDeliveryState = reactive({
  /** Episodic pre-flight hold (start ceremony) — see the module doc. */
  held: [] as Array<CardName>,
  /** Cards mid-flight into the dock (multiset) — released per touchdown. */
  inFlight: [] as Array<CardName>,
  flights: [] as Array<DeliveryFlight>,
});

/** A TOUCHDOWN listener: one copy of `name` has physically landed in the dock (the «КАРТЫ» counter ticks on this very release). */
export type IntakeTouchdownListener = (name: CardName) => void;
const touchdownListeners = new Set<IntakeTouchdownListener>();

/**
 * Subscribe to the dock's TOUCHDOWNS — the one signal «the card has landed
 * in the hand» (the Parliament's CARD step waits for ITS card to land before
 * the next leg of the walk — `agendaWalkDirector`). Fired for every intake
 * path alike (a reveal take, the fullscreen take, a deal, a degraded run),
 * because every one of them releases its in-flight copy here. Returns the
 * unsubscribe (idempotent).
 */
export function onIntakeTouchdown(listener: IntakeTouchdownListener): () => void {
  touchdownListeners.add(listener);
  return () => {
    touchdownListeners.delete(listener);
  };
}

/** Remove ONE copy of `name` from the in-flight multiset (a touchdown) — and tell whoever waits for it. */
export function releaseInFlight(name: CardName): void {
  const i = handDeliveryState.inFlight.indexOf(name);
  if (i >= 0) {
    handDeliveryState.inFlight = [
      ...handDeliveryState.inFlight.slice(0, i),
      ...handDeliveryState.inFlight.slice(i + 1),
    ];
  }
  for (const listener of [...touchdownListeners]) {
    try {
      listener(name);
    } catch (e) {
      console.warn('[hand-intake] a touchdown listener threw', e);
    }
  }
}

const els = new Map<number, HTMLElement>();
let seq = 0;

export function nextDeliveryId(): number {
  return ++seq;
}

export function registerDeliveryEl(id: number, el: HTMLElement | null): void {
  if (el === null) {
    els.delete(id);
  } else {
    els.set(id, el);
  }
}

export function deliveryEl(id: number): HTMLElement | undefined {
  return els.get(id);
}

/** Drop a finished run's proxies (concurrent runs keep theirs). */
export function removeDeliveryFlights(ids: ReadonlyArray<number>): void {
  const drop = new Set(ids);
  handDeliveryState.flights = handDeliveryState.flights.filter((f) => !drop.has(f.id));
  ids.forEach((id) => els.delete(id));
}

export function clearDeliveryFlights(): void {
  handDeliveryState.flights = [];
  els.clear();
}
