/*
 * HAND DELIVERY STATE — the registry behind "I paid for the project cards I
 * bought at setup, and now they physically fly into my hand"
 * (handDeliveryDirector + ConsoleHandDeliveryLayer).
 *
 * The bought project cards are ALREADY in `cardsInHand` — the ceremony
 * payment only deducts M€. So the delivery is a purely CLIENT beat: the cards
 * are HELD out of the dock (shown face-up in the payment element instead)
 * until the player confirms the payment, then flown from those face-up cards
 * down into the hand dock and materialized under the landed proxies.
 *
 *  - `held` — bought card names withheld from the dock (hidden-with-layout +
 *    excluded from the shown count) until each proxy touches down.
 *  - `flights` — one face-up→back flip proxy per delivered card on the fixed
 *    delivery layer.
 *
 * All motion / lifecycle lives in handDeliveryDirector.ts. Mirrors the
 * reveal / exit layers' function-ref element registry (v-for order is not
 * guaranteed).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

export type DeliveryFlight = {
  id: number,
  name: CardName,
};

export const handDeliveryState = reactive({
  /** Names withheld from the dock — hidden-with-layout, excluded from the
   *  count — while held (pre-payment) or in flight. Drives the dock's
   *  `deliveryHeld` prop. */
  held: [] as Array<CardName>,
  flights: [] as Array<DeliveryFlight>,
});

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

export function clearDeliveryFlights(): void {
  handDeliveryState.flights = [];
  els.clear();
}
