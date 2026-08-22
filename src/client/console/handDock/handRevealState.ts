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
import {CardModel} from '@/common/models/CardModel';

export type HandRevealPhase = 'docked' | 'opening' | 'open' | 'closing';

/**
 * The card's FINAL grid presentation, carried by its flying proxy so the
 * landed state can never pop at the handoff: `dim` mirrors the slot's
 * unplayable ('soft') / select-disabled ('strong') filter, `chip` is the
 * compact blocker label (english i18n key — the layer translates). The
 * face flips into view mid-flight ALREADY in its true state.
 *
 * `card` is the LIVE model the landed slot renders from, and it belongs here
 * for exactly the same reason the dim does: the discount chip, the stored-
 * resource capsule and the disabled wash are all read off it, and the cost
 * chip's presence additionally re-insets the title (`--pcard-title-safe-l`),
 * so a model-less proxy also breaks the name's SIZE and line breaks. Flying
 * without it made the whole grid change composition at the handoff.
 */
export type RevealVisual = {
  card?: CardModel,
  dim?: 'soft' | 'strong',
  chip?: string,
};

export type RevealFlight = {
  id: number,
  name: CardName,
  /** Render the FaceLite front (false = back-only tail proxy). */
  face: boolean,
  /** The landed state the face carries (dim + blocker chip). */
  visual?: RevealVisual,
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
  /** THE DESTINATION'S ART TIER (perf iteration 3) — stamped by the hand
   *  section from its solved album plan, read by the reveal layer's proxies
   *  so a flight decodes the same file its landing slot paints («the copies
   *  are identical» is a contract about the SOURCE too). */
  artTier: 'full' as 'full' | 'thumb',
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
