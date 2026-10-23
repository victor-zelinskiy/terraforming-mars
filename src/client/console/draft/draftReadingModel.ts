/*
 * THE PACKET SHOWCASE'S READING (T10 · CE) — what the draft workspace says
 * about the card under the cursor, and what the purchase costs.
 *
 * THE ROW SAYS ONLY WHAT THE FACE DOES NOT. The card under the cursor stands
 * right above this row, whole and large: its cost (already the server's
 * discounted price — the premium face prints `calculatedCost`), its tags, its
 * VP and its VP condition are PRINTED there. A first cut of this row repeated
 * all four as icon «facts» beside the name — the owner (2026-10-23): «слишком
 * много лишней инфы… это уже перебор». So the reading is the name and the ONE
 * thing the face cannot show:
 *  · the requirement's VERDICT for this player, in the hand's own language
 *    (`buildCardAvailability(…, 'draft')` — only printed requirements speak:
 *    the card is judged for LATER, money will change), and only when there is
 *    something to say;
 * and, on the purchase, the WALLET: «N × 3 = −M · у вас A → B», the price per
 * card the server's (`thisPlayer.cardCost`), never a client constant. When that
 * price is not the default 3 M€ the «× N» carries a hint naming who set it
 * (`purchasePriceSource.ts`) — a hint, never a line.
 */
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';

export type DraftReadingStage = 'pick' | 'buy' | 'inspect';

export type DraftReading = {
  name: CardName,
  /** The requirement's verdict, the hand's language; `undefined` = nothing to say. */
  availability: CardAvailabilityView | undefined,
};

/** The reading of one card — its name and the verdict the face cannot print. */
export function draftReadingOf(card: CardModel): DraftReading {
  return {
    name: card.name,
    availability: buildCardAvailability({reasons: card.unplayableReasons, easing: card.requirementEasing}, 'draft'),
  };
}

export type DraftWallet = {
  /** Cards selected for purchase. */
  count: number,
  /** The server's price per card (`thisPlayer.cardCost`). */
  perCard: number,
  /** count × perCard. */
  total: number,
  onHand: number,
  after: number,
  affordable: boolean,
  /** Who set a non-default price — the «× N»'s hint; '' on a plain table. */
  priceHint: string,
};

/** The purchase's arithmetic — the wallet plate's every number. */
export function draftWalletOf(count: number, perCard: number, onHand: number, priceHint = ''): DraftWallet {
  const total = count * perCard;
  return {count, perCard, total, onHand, after: onHand - total, affordable: total <= onHand, priceHint};
}

/** The purchase's honest verb: «Купить N» — «Купить 0» when nothing is chosen (it is still the commit). */
export function draftBuyVerb(count: number): {key: string, params: ReadonlyArray<string>} {
  return {key: 'Buy ${0}', params: [String(count)]};
}
