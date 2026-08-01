/*
 * playedCategoryView — the reactive state of the «Разыграно» CATEGORY VIEW
 * (the physical tableau → category-modal transition), plus the proxy-flight
 * element registry (mirrors handRevealState's function-ref pattern).
 *
 * The state machine is deliberately tiny and one-directional:
 *
 *   closed → opening → open → closing → closed
 *                ↘ (B mid-flight: the SAME timeline reverses) ↙
 *
 * While `phase !== 'closed'` the category view modal is mounted; while the
 * flights are airborne (`opening`/`closing`) BOTH representations hold their
 * cards invisible-with-layout (the tableau slots via `outNames`, the modal
 * grid via its `held` class) — the proxies are the ONLY visible copy of each
 * card, so a card never exists in two places at once (the fork's "one
 * physical object" rule).
 *
 * BROWSING ONLY. This surface once doubled as a PICK surface: a composer whose
 * card step targeted a played card handed the pick here, the candidates lifted
 * off their real tableau slots, and the player answered on the real cards. It
 * was physical — but it took the player OUT of the workspace that asked the
 * question, and it gave them a whole tableau to find two legal targets in. Both
 * composers now descend into the EMBEDDED played-target step
 * (`ConsolePlayedTargetStep`), which costs what the CHOICES cost. What is left
 * here is what this surface is actually for: looking at the table.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayedCategoryKey} from '@/client/components/console/consolePlayedCategoryModel';

export type PlayedCategoryPhase = 'closed' | 'opening' | 'open' | 'closing';

export type CategoryFlight = {
  /** Stable per-flight id (element registry key). */
  id: number,
  name: CardName,
  /** The card lies FACE DOWN on the table (an event) — the proxy starts on
   *  its back and FLIPS open mid-flight (and flips back on the return). */
  faceDown: boolean,
};

export const playedCategoryState = reactive({
  phase: 'closed' as PlayedCategoryPhase,
  category: undefined as PlayedCategoryKey | undefined,
  /** The open category's card names, in tableau (grid) order. */
  names: [] as Array<CardName>,
  /** The focused grid index (single card → always 0). */
  focusIndex: 0,
  /** Airborne proxies (the layer renders one chassis per entry). */
  flights: [] as Array<CategoryFlight>,
  /** TRUE while proxies own the cards — both real representations hold. */
  holdCards: false,
  /** The modal frame is assembled (backdrop + panel chrome visible). */
  frameOn: false,
});

/** The names currently OUT of the tableau (lifted into the view) — the
 *  table renders their slots as held geometry while the view owns them.
 *  NOT keyed on the bare phase: during the first 'opening' frames (before
 *  the proxies are placed) the cards still lie on the table — `holdCards`
 *  flips in the SAME synchronous turn the director paints the proxies, so
 *  a card never blinks out before its flying copy exists. */
export function categoryOutNames(): ReadonlySet<string> {
  const st = playedCategoryState;
  // Held from the proxy-paint turn of the OPEN flight all the way through
  // 'open' and 'closing' (the cards are away until the return touchdown).
  const held = st.phase !== 'closed' && (st.phase !== 'opening' || st.holdCards);
  return held ? new Set<string>(st.names) : EMPTY_SET;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export function isCategoryViewBusy(): boolean {
  return playedCategoryState.phase === 'opening' || playedCategoryState.phase === 'closing';
}

export function isCategoryViewUp(): boolean {
  return playedCategoryState.phase !== 'closed';
}

/** Hard reset (overlay close / unmount / hard-block) — no animation. */
export function resetPlayedCategoryView(): void {
  playedCategoryState.phase = 'closed';
  playedCategoryState.category = undefined;
  playedCategoryState.names = [];
  playedCategoryState.focusIndex = 0;
  playedCategoryState.flights = [];
  playedCategoryState.holdCards = false;
  playedCategoryState.frameOn = false;
  clearCategoryFlightEls();
}

// (The tableau-pick BRIDGE is gone — with it the resolve/cancel callbacks, the
//  staged outcome and the «is a pick out?» predicate every motion director had
//  to consult. Nothing hands a decision to this surface any more, so it has no
//  caller to answer to and no half-answered state to protect.)

// ── the proxy element registry (function refs — never reactive) ────────────

let nextFlightId = 1;

export function nextCategoryFlightId(): number {
  return nextFlightId++;
}

const flightEls = new Map<number, HTMLElement>();

export function registerCategoryFlightEl(id: number, el: unknown): void {
  if (el instanceof HTMLElement) {
    flightEls.set(id, el);
  } else {
    flightEls.delete(id);
  }
}

export function categoryFlightEl(id: number): HTMLElement | undefined {
  return flightEls.get(id);
}

export function clearCategoryFlightEls(): void {
  flightEls.clear();
}
