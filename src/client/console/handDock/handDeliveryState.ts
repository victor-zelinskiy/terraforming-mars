/*
 * HAND DELIVERY STATE — the registry behind the "you paid for your starting
 * cards, and now they physically fly into your hand" cinematic
 * (handDeliveryDirector + ConsoleHandDeliveryLayer).
 *
 * The starting-projects buy is ONE atomic server submit — the paid cards
 * land in `cardsInHand` on the very next playerView. A plain reactive jump
 * would read as "the cards were already mine the instant I clicked". This
 * layer sequences the DELIVERY so the moment reads honestly: the bought
 * cards are HELD out of the dock (never shown before the payment lands),
 * then flown from the project deck (top HUD) down into the hand dock bay
 * and materialized under the landed proxies.
 *
 *  - `held` — bought card names withheld from the dock (hidden + excluded
 *    from the shown count) until each one's proxy touches down. Set at
 *    SUBMIT time so the cards can never flash in the dock before delivery.
 *  - `flights` — one proxy per delivered card on the fixed delivery layer.
 *
 * All motion lives in handDeliveryDirector.ts. Mirrors the reveal / exit
 * layers' function-ref element registry (v-for order is not guaranteed).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

export type DeliveryFlight = {
  id: number,
  name: CardName,
};

export const handDeliveryState = reactive({
  /** A delivery is armed or in flight (the dock withholds `held`). */
  active: false,
  /** Names still IN FLIGHT — hidden in the dock, excluded from the count. */
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
