/*
 * HAND REVEAL STATE — the registry behind the dock ↔ hand-overlay physical
 * transition (ConsoleHandRevealLayer + handRevealDirector).
 *
 * The transition flies ONE proxy per hand card on a fixed app-level layer
 * (above the footer — the flights land INTO the command bar's dock bay).
 * This module owns only the reactive pieces the Vue side renders from:
 *
 *  - `phase` — the presentation state machine:
 *      docked  → the hand lives in the dock (no episode running);
 *      opening → proxies fly dock → overlay slots (reversible);
 *      open    → the overlay owns the cards;
 *      closing → proxies fly overlay slots → dock (reversible).
 *  - `flights` — the proxy list (name + whether it carries a FACE — the
 *    off-screen tail of a huge hand flies back-only, see the director);
 *  - `holdSlots` — the overlay slots render held (`.con-hand--transit`)
 *    while proxies are the single visible representation of each card;
 *  - `dockLifted` — the dock's pack renders held (cards are "in the hand").
 *
 * All motion lives in handRevealDirector.ts. Mirrors cardExitState's
 * function-ref element registry (v-for order is not guaranteed).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

export type HandRevealPhase = 'docked' | 'opening' | 'open' | 'closing';

export type RevealFlight = {
  id: number,
  name: CardName,
  /** Render the FaceLite front (false = back-only tail proxy). */
  face: boolean,
};

export const handRevealState = reactive({
  phase: 'docked' as HandRevealPhase,
  flights: [] as Array<RevealFlight>,
  /** Overlay slots held empty (the proxies are the cards right now). */
  holdSlots: false,
  /** Dock pack held empty (the cards left the tray). */
  dockLifted: false,
});

const els = new Map<number, HTMLElement>();
let seq = 0;

export function nextRevealId(): number {
  return ++seq;
}

export function registerRevealEl(id: number, el: HTMLElement | null): void {
  if (el === null) {
    els.delete(id);
  } else {
    els.set(id, el);
  }
}

export function revealEl(id: number): HTMLElement | undefined {
  return els.get(id);
}

export function clearRevealFlights(): void {
  handRevealState.flights = [];
  els.clear();
}

/** The overlay is mid-episode — hosts gate confirm-inputs on this. */
export function handRevealBusy(): boolean {
  return handRevealState.phase === 'opening' || handRevealState.phase === 'closing';
}
