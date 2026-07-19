/*
 * HAND REVEAL STATE — the registry behind the dock ↔ hand-overlay physical
 * transition (ConsoleHandRevealLayer + handRevealDirector).
 *
 * The transition flies ONE proxy per hand card on a fixed app-level layer
 * (UNDER the footer band — the dock/bar furniture occludes a landing card
 * per pixel, so it slots in BEHIND the tray texture; console_card_deal.less).
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
 *  - `dockExtraLift` — names whose DOCK backs stay hidden BEYOND the
 *    visible-entries set: the tag-filter episode's leavers are no longer in
 *    the overlay's entries but are still airborne on their way back to the
 *    pack. (The dock's main hidden set is DERIVED in the shell from
 *    `phase` + the visible hand entries — see `dockLiftedNames` — so a
 *    filtered-out card's back never leaves the tray while the hand is open.)
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
  /** Extra dock backs held hidden: filter-episode leavers still in flight. */
  dockExtraLift: [] as Array<string>,
  /** A tag-FILTER episode is airborne — the status rail holds its text
   *  until the cards settle (the section's `--hold` class). */
  filterActive: false,
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
