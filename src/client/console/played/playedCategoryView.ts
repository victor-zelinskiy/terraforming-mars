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
  /** The card's index in the category list (grid landing / departure slot).
   *  Flights are a BOUNDED subset of the category, so the index is carried
   *  explicitly — never recovered from the flight's array position. */
  index: number,
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
  /** Airborne proxies (the layer renders one chassis per entry). BOUNDED:
   *  only cards landing in (or departing from) the visible grid window plus
   *  a short sweep tail fly — a 100-card category never spawns 100 premium
   *  faces. The rest are `groundedNames`. */
  flights: [] as Array<CategoryFlight>,
  /** Cards of the episode BEYOND the flight budget: they dissolve IN PLACE
   *  on the table (opacity, the off-window language) instead of flying, and
   *  fade back in place on close. Set at spawn for BOTH directions. */
  groundedNames: [] as Array<CardName>,
  /** TRUE while proxies own the cards — both real representations hold. */
  holdCards: false,
  /** The modal frame is assembled (backdrop + panel chrome visible). */
  frameOn: false,
});

/** The names whose table slots render HELD GEOMETRY (invisible, layout
 *  kept) — a card never exists in two places at once. NOT keyed on the bare
 *  phase: during the first 'opening' frames (before the proxies are placed)
 *  the cards still lie on the table — `holdCards` flips in the SAME
 *  synchronous turn the director paints the proxies, so a card never blinks
 *  out before its flying copy exists.
 *
 *  With BOUNDED flights the hold covers only the FLOWN cards during a
 *  transition (the grounded rest dissolve via opacity — a visibility hold
 *  cannot fade); at 'open' everything is away, so the hold covers all. */
export function categoryOutNames(): ReadonlySet<string> {
  const st = playedCategoryState;
  if (st.phase === 'open') {
    return new Set<string>(st.names);
  }
  if ((st.phase === 'opening' && st.holdCards) ||
      (st.phase === 'closing' && st.holdCards)) {
    return new Set<string>(st.flights.map((f) => f.name));
  }
  if (st.phase === 'closing') {
    // The pre-paint gap of the close (proxies not yet placed): every card is
    // still away in the view — release nothing yet.
    return new Set<string>(st.names);
  }
  return EMPTY_SET;
}

/** The names LOGICALLY AWAY from the table (in the category view) — what the
 *  events-pile count and the full-ghost read. This is the pre-bounding
 *  semantics of `categoryOutNames`: once the episode holds, the WHOLE
 *  category is away, flown and grounded alike. */
export function categoryAwayNames(): ReadonlySet<string> {
  const st = playedCategoryState;
  const held = st.phase !== 'closed' && (st.phase !== 'opening' || st.holdCards);
  return held ? new Set<string>(st.names) : EMPTY_SET;
}

/** The grounded set the TABLE paints its dissolve class from: active while
 *  the episode stands (opening / open). At 'closing' it empties — grounded
 *  slots transition opacity back up in place while the flown cards fly home
 *  (their own hold releases at touchdown). */
export function categoryGroundedNames(): ReadonlySet<string> {
  const st = playedCategoryState;
  if ((st.phase === 'opening' || st.phase === 'open') && st.groundedNames.length > 0) {
    return new Set<string>(st.groundedNames);
  }
  return EMPTY_SET;
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
  playedCategoryState.groundedNames = [];
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
