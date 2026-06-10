import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

/**
 * Module-level reactive state for the MANDATORY "select cards from your hand"
 * mode of the КАРТЫ В РУКЕ overlay (HandCardsOverlay). This is the sibling of
 * `sellPatentsState`: when a played card (or a forced event) asks the player to
 * pick cards that are ALREADY IN THEIR HAND (discard N, reveal up to N, keep X,
 * choose a card to copy…), we drive it through the same premium hand overlay
 * instead of a separate modal grid — it's the surface already built for showing
 * a large hand with filters / sort / fullscreen.
 *
 * Lives at module scope (NOT in `data()`) so it survives the
 * `<player-home :key="playerkey">` remount that fires on every server response,
 * exactly like `sellPatentsState` / `journalState`.
 *
 * Difference from sell-patents:
 *   - This is a TOP-LEVEL `SelectCard` prompt (the server's `waitingFor`), so
 *     the response is the bare `{type:'card', cards}` — no nested-OR wrapping.
 *   - It is MANDATORY: the player can minimize the overlay to inspect the board
 *     (a pill appears), but cannot dismiss the prompt. They leave it only by
 *     confirming a valid selection.
 */

type HandSelectState = {
  active: boolean;
  // Minimized to a pill (player is inspecting the board). The prompt is still
  // pending; clicking the pill re-opens the overlay in this mode.
  minimized: boolean;
  min: number;
  max: number;
  title: string | Message;
  buttonLabel: string;
  // Names the player is allowed to pick (the prompt's candidate cards). The
  // overlay shows the WHOLE hand for context but only lets these be selected.
  selectable: Array<CardName>;
  selected: Array<CardName>;
  // Identity of the prompt we entered for — lets a remount tell "same prompt,
  // keep my picks" from "a new prompt, reset".
  signature: string;
  /**
   * CLIENT-driven pick (not a server prompt). When true the select mode is owned
   * by a client flow — currently the card-action confirmation modal asking the
   * player to pick a card from hand (Self-Replicating Robots "link a card"). The
   * confirm DOESN'T POST to the server; it resolves back to the initiating flow
   * via `resolveClientHandSelect`. The `handCardSelectionInput` watcher must NOT
   * clear the state in this mode (there is no server prompt backing it).
   */
  clientPick: boolean;
  /**
   * Per-card reason (already-translated text) explaining why a NON-selectable
   * card can't be picked — shown as a premium tooltip on its disabled toggle
   * (e.g. "No building or space tag"). Keyed by CardName.
   */
  reasons: Record<string, string>;
};

export const handSelectState: HandSelectState = reactive({
  active: false,
  minimized: false,
  min: 0,
  max: 0,
  title: '',
  buttonLabel: '',
  selectable: [],
  selected: [],
  signature: '',
  clientPick: false,
  reasons: {},
});

// The resolve callback for a CLIENT-driven pick (stored OUTSIDE the reactive
// state — a function isn't reactive data). Set by `enterClientHandSelect`, fired
// by `resolveClientHandSelect`, cleared on exit.
let clientResolveCb: ((cards: ReadonlyArray<CardName>) => void) | undefined;
let clientCancelCb: (() => void) | undefined;

function titleText(title: string | Message | undefined): string {
  if (title === undefined) {
    return '';
  }
  return typeof title === 'string' ? title : title.message;
}

/**
 * The top-level `SelectCard` prompt IF it's a hand-card selection — i.e. every
 * candidate card is already in the player's hand. Draft / research deal cards
 * that aren't in hand yet, so those keep their own flow (DraftFlowOverlay).
 * Sell-patents is nested inside the action menu (top-level is `or`), so it is
 * never matched here either.
 */
export function handCardSelectionPrompt(view: PlayerViewModel): SelectCardModel | undefined {
  const wf = view.waitingFor;
  if (wf === undefined || wf.type !== 'card') {
    return undefined;
  }
  if (wf.cards.length === 0) {
    return undefined;
  }
  const hand = new Set(view.cardsInHand.map((c) => c.name));
  const allInHand = wf.cards.every((c) => hand.has(c.name));
  return allInHand ? wf : undefined;
}

/** Stable identity for a hand-select prompt (title + bounds + candidate set). */
export function handSelectSignature(input: SelectCardModel): string {
  const names = input.cards.map((c) => c.name).join(',');
  return `${titleText(input.title)}|${input.min}|${input.max}|${names}`;
}

export function enterHandSelect(input: SelectCardModel): void {
  handSelectState.active = true;
  handSelectState.minimized = false;
  handSelectState.min = input.min;
  handSelectState.max = input.max;
  handSelectState.title = input.title;
  handSelectState.buttonLabel = input.buttonLabel;
  handSelectState.selectable = input.cards.map((c) => c.name);
  handSelectState.selected = [];
  handSelectState.signature = handSelectSignature(input);
}

export function exitHandSelect(): void {
  handSelectState.active = false;
  handSelectState.minimized = false;
  handSelectState.selectable = [];
  handSelectState.selected = [];
  handSelectState.signature = '';
  handSelectState.clientPick = false;
  handSelectState.reasons = {};
  clientResolveCb = undefined;
  clientCancelCb = undefined;
}

/**
 * Enter the hand overlay's select mode for a CLIENT-driven single-card pick (the
 * action confirmation flow). `selectable` = the eligible cards; `reasons` maps a
 * NON-eligible card to the premium-tooltip text on its disabled toggle. On
 * confirm `resolveClientHandSelect` fires `onResolve` with the picked names; on
 * dismiss `cancelClientHandSelect` fires `onCancel`. Single-pick by default.
 */
export function enterClientHandSelect(opts: {
  title: string | Message,
  buttonLabel: string,
  selectable: ReadonlyArray<CardName>,
  reasons: Record<string, string>,
  min?: number,
  max?: number,
  onResolve: (cards: ReadonlyArray<CardName>) => void,
  onCancel?: () => void,
}): void {
  clientResolveCb = opts.onResolve;
  clientCancelCb = opts.onCancel;
  handSelectState.active = true;
  handSelectState.minimized = false;
  handSelectState.clientPick = true;
  handSelectState.min = opts.min ?? 1;
  handSelectState.max = opts.max ?? 1;
  handSelectState.title = opts.title;
  handSelectState.buttonLabel = opts.buttonLabel;
  handSelectState.selectable = [...opts.selectable];
  handSelectState.reasons = {...opts.reasons};
  handSelectState.selected = [];
  handSelectState.signature = '';
}

/** Commit the current client pick — fires `onResolve` with the picked names. */
export function resolveClientHandSelect(): void {
  const cb = clientResolveCb;
  const picked = [...handSelectState.selected];
  exitHandSelect();
  cb?.(picked);
}

/** Abandon the client pick (overlay closed without confirming) — fires onCancel. */
export function cancelClientHandSelect(): void {
  const cb = clientCancelCb;
  exitHandSelect();
  cb?.();
}

/** Premium-tooltip reason for a non-selectable card (empty when selectable). */
export function handSelectReason(name: CardName): string {
  return handSelectState.reasons[name] ?? '';
}

/** A CLIENT-driven hand pick is in progress — modals hand off to the overlay
 *  and SUPPRESS themselves (stay mounted, hidden) while it's up. */
export function isClientHandPickActive(): boolean {
  return handSelectState.active && handSelectState.clientPick;
}

export function isHandSelectable(name: CardName): boolean {
  return handSelectState.selectable.includes(name);
}

export function isSelectedForHandSelect(name: CardName): boolean {
  return handSelectState.selected.includes(name);
}

export function toggleHandSelectSelection(name: CardName): void {
  if (!isHandSelectable(name)) {
    return;
  }
  const idx = handSelectState.selected.indexOf(name);
  if (idx === -1) {
    // Single-pick (max === 1): selecting a different card REPLACES the previous
    // one (no need to deselect first) — the natural behaviour for "pick one".
    if (handSelectState.max === 1) {
      handSelectState.selected = [name];
      return;
    }
    if (handSelectState.selected.length >= handSelectState.max) {
      return;
    }
    handSelectState.selected.push(name);
  } else {
    handSelectState.selected.splice(idx, 1);
  }
}
