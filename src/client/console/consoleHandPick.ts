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
import {DiscardPromptMeta, SelectCardModel} from '@/common/models/PlayerInputModel';
import {ResolutionId} from '@/common/parliament/ParliamentTypes';
import {isHandPick} from '@/client/console/handPickRouting';
import type {DeclineModel} from '@/client/console/optionalChoice';
import type {DeferPlateModel} from '@/client/console/tableQuestionRow';

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
   *  hand section's sale-bar-style running summary. `cards`: a SECOND payout
   *  in cards per card (Open IP Trade: +3 M€ AND +1 card per card discarded). */
  gainPerCard?: {icon: string, amount: number, cards?: number};
  /**
   * The pick stands as a STEP of the workspace that asked (its published zone —
   * `card-actions ⊃ hand`), never as an overlay over a hidden composer: the
   * resolution action's pick, whose hero stays beside the hand. `stage` is the
   * step's crumb tail (an i18n key), handed up the moment the hand opens.
   */
  hosted?: {stage: string};
  /**
   * WHICH cinematic takes the picked cards out of the hand at the confirm:
   * the discard tray (default — a discard's own leaving) or the SALE's trade
   * terminal (Open IP Trade: the cards feed the terminal, the terminal pays).
   * A sale arms its own scene; the shell must not arm the discard's over it.
   *
   * `'none'` — a PRE-SELECT: the pick answers a question a composer asks BEFORE
   * its play / action is committed (Mars University's «discard a card to draw
   * one», a table question — TR51). Nothing has happened yet, so nothing
   * leaves: the card stays in the hand and goes only when the commit's own
   * response takes it. The skin (a discard's copy, verb and accent off the raw
   * marker) is the same; the tray is never armed.
   */
  leaving?: 'discard' | 'sale' | 'none';
  /** The OPERATION this pick belongs to (the source card being played /
   *  activated + a kicker i18n key, e.g. 'Action setup') — the pick surface
   *  shows it so the player never loses WHY they are choosing a target.
   *  `resolution`: the source is an enacted LAW (Open IP Trade's action) —
   *  `card` then carries the law's printed name (an i18n key) for the chip,
   *  and L3 opens the resolution's own inspector, never a card's. */
  source?: {kicker: string, card: CardName, resolution?: ResolutionId};
  /**
   * The server's DISCARD marker, when this pick is a discard from hand (a
   * discard nested in an OrOptions branch — Mars University — or a composer
   * step that throws cards away). Carrying the RAW marker (never a re-derived
   * flag) is what keeps the client-bridge path and the server `handSelect`
   * path on ONE derivation: the shell feeds either into
   * `deriveDiscardIntent`, so the skin, the copy and the leaving animation are
   * physically the same code. See `cardDiscard/discardIntent.ts`.
   */
  discard?: DiscardPromptMeta;
  /**
   * The pick is an OPTIONAL CHOICE's one answer (`optionalChoice.ts` — Mars University's «discard a card to draw one»,
   * declinable): the album opens straight onto it, its question line carries the decline plate, and RT answers the
   * decline (`declineConsoleHandPick`) — never a row, never B (B is one level back).
   */
  decline?: DeclineModel;
  /**
   * The pick answers a TABLE QUESTION THAT MAY WAIT FOR A DRAW (2026-10-15 — Mars University behind Olympus' «remove to
   * draw»): the album's question line carries a second plate, R3 «Решить после добора», and R3 answers it
   * (`deferConsoleHandPick`) — whatever was chosen before the press is let go and the question is asked live once the
   * draw has landed. Never B (B is one level back, the old answer kept).
   */
  defer?: DeferPlateModel;
  /**
   * What B does here, as the bar names it (an i18n key; default «Назад»). An album that IS the decision (the live
   * effect decision's `directPick`) has no screen behind it — its B is the decision's own «Свернуть».
   */
  backLabel?: string;
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
let declineCb: (() => void) | undefined;
let deferCb: (() => void) | undefined;

export function isConsoleHandPickActive(): boolean {
  return consoleHandPickState.active;
}

/**
 * The crumb tail of a pick standing as a STAGE of the flow that asked — one word: a discard «СБРОС КАРТЫ», any
 * other pick «ВЫБОР КАРТ». One answer for the asking door and for the header that names the pick.
 */
export function handPickStageKey(request: Pick<ConsoleHandPickRequest, 'discard'> | undefined): string {
  return request?.discard !== undefined ? 'Discarding a card' : 'Card selection';
}

/**
 * Does answering this pick take the cards out of the hand THROUGH THE DISCARD TRAY? Not a sale (its terminal takes
 * them) and not a pre-select (nothing leaves before the commit) — the ONE answer both confirm paths ask.
 */
export function handPickArmsDiscardTray(request: ConsoleHandPickRequest | undefined): boolean {
  return request?.leaving !== 'sale' && request?.leaving !== 'none';
}

/** Open the hand section as a client-side card picker. The shell reacts to
 *  `active` (hides the composer, opens the hand, routes input). */
export function enterConsoleHandPick(
  request: ConsoleHandPickRequest,
  onResolve: (cards: ReadonlyArray<CardName>) => void,
  onCancel?: () => void,
  onDecline?: () => void,
  onDefer?: () => void,
): void {
  const selectableSet = new Set(request.selectable);
  consoleHandPickState.request = request;
  // A stale pre-selection (a card that left the candidate set) is dropped.
  consoleHandPickState.selected = request.selected.filter((n) => selectableSet.has(n));
  consoleHandPickState.suitableOnly = true;
  resolveCb = onResolve;
  cancelCb = onCancel;
  declineCb = request.decline !== undefined ? onDecline : undefined;
  deferCb = request.defer !== undefined ? onDefer : undefined;
  consoleHandPickState.active = true;
}

/** RT on an optional pick: deliver the DECLINE to the waiting composer (a no-op when the pick has none). */
export function declineConsoleHandPick(): void {
  if (!consoleHandPickState.active || declineCb === undefined) {
    return;
  }
  const cb = declineCb;
  resetConsoleHandPick();
  cb();
}

/** R3 on a pick that may wait for a draw: deliver «decide after the draw» to the waiting composer (a no-op otherwise). */
export function deferConsoleHandPick(): void {
  if (!consoleHandPickState.active || deferCb === undefined) {
    return;
  }
  const cb = deferCb;
  resetConsoleHandPick();
  cb();
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
  declineCb = undefined;
  deferCb = undefined;
}

/**
 * The ownership tests now live in ONE place (`handPickRouting.ts` — the owner's rule 2026-10-13: a card picked from the
 * hand is picked IN THE HAND at every depth). Re-exported here for the callers that grew up with this module.
 */
export {isCardSelectionWithin} from '@/client/console/handPickRouting';

/** Every candidate is a card in the player's HAND (or the server marked the pick a discard) → the hand-section pick. */
export function isHandCardSelection(model: SelectCardModel, handNames: ReadonlySet<string>): boolean {
  return isHandPick(model, handNames);
}
