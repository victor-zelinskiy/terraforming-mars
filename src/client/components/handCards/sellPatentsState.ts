import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

/**
 * Module-level reactive state for the "Sell patents" sale mode of the hand
 * overlay (КАРТЫ В РУКЕ). Lives at module scope — NOT in the overlay's
 * `data()` — so it survives the `<player-home :key="playerkey">` remount that
 * fires on every server response (same trick as `journalState`). Without
 * this, a poll from another player mid-selection would reset the overlay and
 * lose the player's picks.
 *
 * Nothing here talks to the server. The selection is purely client-side until
 * the player presses ПРОДАТЬ — PlayerHome then submits the chosen cards
 * through the existing `Sell patents` action (`WaitingFor.onsave`). Cancel /
 * close / Escape just clear this state with no round-trip.
 *
 * Server payout is a flat 1 M€ per card sold, with no modifiers anywhere in
 * the codebase — `SELL_PATENTS_RATE` centralises it so the summary mirrors the
 * server, and a future per-card modifier would only need changing here.
 */
export const SELL_PATENTS_RATE = 1;

type SellPatentsState = {
  active: boolean;
  selected: Array<CardName>;
  // True between pressing ПРОДАТЬ and the server response landing. The hand
  // overlay sets it on submit so the post-sale remount knows to drop sale
  // mode (the sold cards are gone); cleared by exitSellPatents.
  submitting: boolean;
};

export const sellPatentsState: SellPatentsState = reactive({
  active: false,
  selected: [],
  submitting: false,
});

export function enterSellPatents(): void {
  sellPatentsState.active = true;
  sellPatentsState.selected = [];
  sellPatentsState.submitting = false;
}

export function exitSellPatents(): void {
  sellPatentsState.active = false;
  sellPatentsState.selected = [];
  sellPatentsState.submitting = false;
}

export function toggleSellSelection(name: CardName): void {
  const idx = sellPatentsState.selected.indexOf(name);
  if (idx === -1) {
    sellPatentsState.selected.push(name);
  } else {
    sellPatentsState.selected.splice(idx, 1);
  }
}

export function isSelectedForSale(name: CardName): boolean {
  return sellPatentsState.selected.includes(name);
}

/** M€ the player would gain for selling `count` cards. */
export function sellPatentsPayout(count: number): number {
  return count * SELL_PATENTS_RATE;
}

/**
 * True right after ПРОДАТЬ is pressed, until the sale response lands. Used by
 * WaitingFor / App to SKIP the `playerkey++` remount for that one response, so
 * the hand overlay instance survives: the sold cards then leave `cardsInHand`
 * reactively and the overlay's transition-group plays the dissolve → reflow
 * (and the M€ delta chip fires from the same reactive update) instead of the
 * overlay just closing on the remount.
 */
export function shouldPreserveSaleOverlay(): boolean {
  return sellPatentsState.submitting === true;
}
