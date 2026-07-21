/*
 * CONSOLE CLIENT HAND-PICK BRIDGE — the console twin of the desktop
 * `enterClientHandSelect` + `handActionPick` pair.
 *
 * A COMPOSER (the play-card confirm / the blue-card action composer) that needs
 * the player to pick one or several cards FROM HAND hands the pick to the HAND
 * SECTION instead of a flat name list: `enterConsoleHandPick(request, onResolve,
 * onCancel)` flips this module state, the shell hides the composer (v-show — its
 * captured state survives), opens the hand section in select mode (the SAME
 * premium pick UI the server `handSelect` task uses: pick bands, the «suitable
 * only» filter, per-card «why not» reasons), and routes input there. A single
 * pick (min===max===1) resolves on A; a multi pick toggles on A and confirms on
 * RT. Resolving / cancelling fires the composer's callback and the shell
 * restores the previous surface.
 *
 * The callbacks live OUTSIDE the reactive state (function identity — mirrors
 * desktop handSelectState's clientResolveCb/clientCancelCb). The composers stay
 * MOUNTED (hidden) for the pick's whole lifetime, so the callbacks always have
 * a live captor; a composer torn down externally (prompt change) is covered by
 * the shell calling `cancelConsoleHandPick()` — the bridge is idempotent.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

export type ConsoleHandPickRequest = {
  /** The server prompt title (i18n key / Message) — names the ask. */
  title: string | Message;
  /** The A-verb (the server SelectCard's buttonLabel, e.g. 'Discard' / 'Link card'). */
  buttonLabel: string;
  /** Candidate (pickable) card names. */
  selectable: ReadonlyArray<CardName>;
  /** Pre-translated per-card «why not» reason for known non-candidates
   *  (from the server's `disabledCards[].disabledReason`). */
  reasons: Record<string, string>;
  min: number;
  max: number;
  /** Selection preserved from a previous visit (multi re-open = «Изменить»). */
  selected: ReadonlyArray<CardName>;
  /** Live per-card payout (Public Plans: +1 M€ per revealed card) — drives the
   *  hand section's sale-bar-style running summary. */
  gainPerCard?: {icon: string, amount: number};
};

export const consoleHandPickState = reactive({
  active: false,
  request: undefined as ConsoleHandPickRequest | undefined,
  /** The live multi-select accumulation (single picks resolve directly). */
  selected: [] as Array<CardName>,
  /** The «suitable only» filter (LT toggles; reset to ON on every enter). */
  suitableOnly: true,
});

let resolveCb: ((cards: ReadonlyArray<CardName>) => void) | undefined;
let cancelCb: (() => void) | undefined;

export function isConsoleHandPickActive(): boolean {
  return consoleHandPickState.active;
}

/** Open the hand section as a client-side card picker. The shell reacts to
 *  `active` (hides the composer, opens the hand, routes input). */
export function enterConsoleHandPick(
  request: ConsoleHandPickRequest,
  onResolve: (cards: ReadonlyArray<CardName>) => void,
  onCancel?: () => void,
): void {
  const selectableSet = new Set(request.selectable);
  consoleHandPickState.request = request;
  // A stale pre-selection (a card that left the candidate set) is dropped.
  consoleHandPickState.selected = request.selected.filter((n) => selectableSet.has(n));
  consoleHandPickState.suitableOnly = true;
  resolveCb = onResolve;
  cancelCb = onCancel;
  consoleHandPickState.active = true;
}

/** Deliver the pick to the waiting composer (single: `[name]`; multi: the
 *  accumulated set — an EMPTY set is a legal answer when `min === 0`). */
export function resolveConsoleHandPick(cards: ReadonlyArray<CardName>): void {
  if (!consoleHandPickState.active) {
    return;
  }
  const cb = resolveCb;
  resetConsoleHandPick();
  cb?.(cards);
}

/** B / an external teardown: return to the composer with the OLD capture kept. */
export function cancelConsoleHandPick(): void {
  if (!consoleHandPickState.active) {
    return;
  }
  const cb = cancelCb;
  resetConsoleHandPick();
  cb?.();
}

/** Hard reset (game switch / shell unmount) — fires NO callbacks. */
export function resetConsoleHandPick(): void {
  consoleHandPickState.active = false;
  consoleHandPickState.request = undefined;
  consoleHandPickState.selected = [];
  consoleHandPickState.suitableOnly = true;
  resolveCb = undefined;
  cancelCb = undefined;
}

/**
 * PURE: a card selection whose EVERY candidate (selectable + disabled) is a
 * card in the player's hand — the console routes such a pick to the hand
 * section (the desktop `cardPickSurface` 'hand' branch, without the ≤3-inline
 * threshold: console has no premium inline tile picker, so hand picks ALWAYS
 * get the full hand surface).
 */
export function isHandCardSelection(model: SelectCardModel, handNames: ReadonlySet<string>): boolean {
  const candidates = [...model.cards, ...(model.disabledCards ?? [])];
  return model.cards.length > 0 && candidates.every((c) => handNames.has(c.name));
}
