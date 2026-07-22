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
 * PICK-MODE SEAM (phase 2 — tableau-pick): `pick` is the typed extension
 * point the future composer bridge fills (mirrors consoleHandPick's request
 * shape). In browse mode it is ALWAYS undefined — no pick UI renders, no
 * behaviour branches on it yet; the field exists so the category grid is the
 * ready-made pick surface (filter/disabled/reasons/min-max/confirm arrive as
 * data, not as a new screen).
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

/**
 * The FUTURE pick contract of the category grid (tableau-pick, phase 2).
 * Shape mirrors ConsoleHandPickRequest so the two pick surfaces stay twins.
 * NOT consumed anywhere yet — the architectural seam only.
 */
export type PlayedCategoryPickContext = {
  title: string,
  buttonLabel: string,
  selectable: ReadonlyArray<CardName>,
  reasons: Record<string, string>,
  min: number,
  max: number,
  selected: ReadonlyArray<CardName>,
  onResolve: (cards: ReadonlyArray<CardName>) => void,
  onCancel?: () => void,
};

export const playedCategoryState = reactive({
  phase: 'closed' as PlayedCategoryPhase,
  category: undefined as PlayedCategoryKey | undefined,
  /** The open category's card names (tableau order — the grid order). */
  names: [] as Array<CardName>,
  /** The focused grid index (single card → always 0). */
  focusIndex: 0,
  /** Airborne proxies (the layer renders one chassis per entry). */
  flights: [] as Array<CategoryFlight>,
  /** TRUE while proxies own the cards — both real representations hold. */
  holdCards: false,
  /** The modal frame is assembled (backdrop + panel chrome visible). */
  frameOn: false,
  /** Browse today; the tableau-pick context arrives here in phase 2. */
  pick: undefined as PlayedCategoryPickContext | undefined,
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
  playedCategoryState.pick = undefined;
  clearCategoryFlightEls();
}

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
