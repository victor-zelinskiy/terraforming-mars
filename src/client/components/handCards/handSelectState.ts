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
});

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
    if (handSelectState.selected.length >= handSelectState.max) {
      return;
    }
    handSelectState.selected.push(name);
  } else {
    handSelectState.selected.splice(idx, 1);
  }
}
