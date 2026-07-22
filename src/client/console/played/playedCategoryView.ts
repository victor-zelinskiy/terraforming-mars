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
import {Message} from '@/common/logs/Message';
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
 * The TABLEAU-PICK contract of the category view (the composer bridge —
 * consoleHandPick's twin for cards ON THE TABLE). A composer whose card step
 * targets the viewer's OWN played cards hands the pick here: the candidates
 * (+ the known-disabled ones, with reasons) physically LIFT off their real
 * tableau slots into the pick view; the player picks (A single / A-toggle +
 * RT multi); the cards fly HOME and the result lands back in the composer.
 */
export type PlayedTableauPickRequest = {
  /** The server prompt title (i18n key / Message) — names the ask. */
  title: string | Message,
  /** The A-verb (the server SelectCard's buttonLabel — 'Copy' / 'Select' …). */
  buttonLabel: string,
  /** Candidate (pickable) card names. */
  selectable: ReadonlyArray<CardName>,
  /** Shown-but-unpickable candidates (server disabledCards), pre-translated
   *  per-card reasons. They lift into the view too — greyed, explained. */
  disabled: ReadonlyArray<CardName>,
  reasons: Record<string, string>,
  min: number,
  max: number,
  /** Selection preserved from a previous visit (re-open = «Изменить»). */
  selected: ReadonlyArray<CardName>,
  /** Candidates that lie FACE DOWN on the table (played events) — they lift
   *  off the events pile and FLIP open mid-flight. */
  faceDown: ReadonlyArray<CardName>,
};

export const playedCategoryState = reactive({
  phase: 'closed' as PlayedCategoryPhase,
  category: undefined as PlayedCategoryKey | undefined,
  /** The open collection's card names (tableau order — the grid order): the
   *  category's cards in browse mode, the candidate set in pick mode. */
  names: [] as Array<CardName>,
  /** The focused grid index (single card → always 0). */
  focusIndex: 0,
  /** Airborne proxies (the layer renders one chassis per entry). */
  flights: [] as Array<CategoryFlight>,
  /** TRUE while proxies own the cards — both real representations hold. */
  holdCards: false,
  /** The modal frame is assembled (backdrop + panel chrome visible). */
  frameOn: false,
  /** PICK MODE (a composer's tableau-pick is out) — undefined in browse. */
  pick: undefined as PlayedTableauPickRequest | undefined,
  /** The live pick accumulation (multi; a single pick resolves directly). */
  pickSelected: [] as Array<CardName>,
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

/** Hard reset (overlay close / unmount / hard-block) — no animation. A live
 *  pick COMMITS first (its staged outcome, else a cancel — the composer
 *  never waits forever and keeps the old capture on cancel). */
export function resetPlayedCategoryView(): void {
  commitPlayedTableauPick();
  playedCategoryState.phase = 'closed';
  playedCategoryState.category = undefined;
  playedCategoryState.names = [];
  playedCategoryState.focusIndex = 0;
  playedCategoryState.flights = [];
  playedCategoryState.holdCards = false;
  playedCategoryState.frameOn = false;
  playedCategoryState.pick = undefined;
  playedCategoryState.pickSelected = [];
  clearCategoryFlightEls();
}

// ── the tableau-pick bridge (composer ↔ this view) ─────────────────────────

let pickResolveCb: ((cards: ReadonlyArray<CardName>) => void) | undefined;
let pickCancelCb: (() => void) | undefined;
/** The outcome chosen ON the pick surface, delivered AFTER the cards have
 *  physically flown home (undefined = still picking; 'cancel' = B). */
let pickOutcome: ReadonlyArray<CardName> | 'cancel' | undefined;

function clearPickCallbacks(): void {
  pickResolveCb = undefined;
  pickCancelCb = undefined;
  pickOutcome = undefined;
}

export function isPlayedTableauPickActive(): boolean {
  return playedCategoryState.pick !== undefined;
}

/**
 * Open the tableau-pick: the candidate set lifts off the table into the pick
 * view (the shell hides the composer meanwhile — v-show, captures survive).
 * The callbacks fire ONLY after the return flight settles: the pick's whole
 * journey is physical, the composer re-appears to a settled table.
 */
export function enterPlayedTableauPick(
  request: PlayedTableauPickRequest,
  onResolve: (cards: ReadonlyArray<CardName>) => void,
  onCancel?: () => void,
): void {
  const selectableSet = new Set(request.selectable);
  pickResolveCb = onResolve;
  pickCancelCb = onCancel;
  pickOutcome = undefined;
  playedCategoryState.pick = request;
  playedCategoryState.pickSelected = request.selected.filter((n) => selectableSet.has(n));
  playedCategoryState.category = undefined;
  playedCategoryState.names = [...request.selectable, ...request.disabled];
  playedCategoryState.focusIndex = 0;
  playedCategoryState.flights = [];
  playedCategoryState.holdCards = false;
  playedCategoryState.frameOn = false;
  playedCategoryState.phase = 'opening';
}

/** The pick surface chose (cards) or cancelled (undefined) — remembered; the
 *  view now flies the cards home and commits the outcome at touchdown. */
export function stagePlayedTableauPickOutcome(outcome: ReadonlyArray<CardName> | undefined): void {
  if (playedCategoryState.pick === undefined) {
    return;
  }
  pickOutcome = outcome ?? 'cancel';
}

/** The return flight settled — fire the staged outcome to the composer.
 *  Called by the view right before the state reset; idempotent. */
export function commitPlayedTableauPick(): void {
  if (playedCategoryState.pick === undefined) {
    return;
  }
  const outcome = pickOutcome ?? 'cancel';
  const resolve = pickResolveCb;
  const cancel = pickCancelCb;
  clearPickCallbacks();
  playedCategoryState.pick = undefined;
  playedCategoryState.pickSelected = [];
  if (outcome === 'cancel') {
    cancel?.();
  } else {
    resolve?.(outcome);
  }
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
