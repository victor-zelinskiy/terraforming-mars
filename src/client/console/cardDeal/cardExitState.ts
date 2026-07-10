/*
 * CARD EXIT STATE — the flight registry behind ConsoleCardExitLayer.
 *
 * The exit/transfer cinematics (take / collect / hero-pick / hand→modal
 * transfer) fly lightweight FaceLite proxies on ONE app-level layer that
 * lives in ConsoleShell — so a flight SURVIVES its host surface closing
 * mid-animation (taking the last revealed card closes the overlay; the
 * proxy keeps flying over the shell). The director (cardExitDirector.ts)
 * owns all motion; this module only owns the reactive flight list + the
 * proxy element registry.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

export type ExitFlight = {
  id: number,
  name: CardName,
  /** Hero accent (the draft pick): a static cyan rim on the proxy. */
  hero: boolean,
};

export const cardExitState = reactive({
  flights: [] as Array<ExitFlight>,
});

const els = new Map<number, HTMLElement>();
let seq = 0;

export function nextFlightId(): number {
  return ++seq;
}

/** Function-ref hook from the layer (v-for order is not guaranteed). */
export function registerFlightEl(id: number, el: HTMLElement | null): void {
  if (el === null) {
    els.delete(id);
  } else {
    els.set(id, el);
  }
}

export function flightEl(id: number): HTMLElement | undefined {
  return els.get(id);
}

export function removeFlights(ids: ReadonlyArray<number>): void {
  const drop = new Set(ids);
  cardExitState.flights = cardExitState.flights.filter((f) => !drop.has(f.id));
  ids.forEach((id) => els.delete(id));
}
