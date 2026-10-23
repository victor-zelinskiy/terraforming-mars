/*
 * THE PACKET SHOWCASE'S READING (T10 · CE) — what the draft workspace says
 * about the card under the cursor, and what the purchase costs.
 *
 * A card on the draft's stage used to be read by its NAME alone (one line at
 * the stage's foot): no cost, no tags, no VP, the requirement's verdict only
 * when one stood. The hand and «Разыграно» read a card fully; the draft — the
 * screen a player studies for longest between generations — did not.
 *
 * ONE pure reading, every number the server's or the manifest's:
 *  · the PLAY cost (`calculatedCost` — the server's own price under the
 *    player's discounts — else the printed cost), with the printed one beside
 *    it when a discount moved it;
 *  · the printed tags (an event wears the event tag — it is not in `tags`);
 *  · the VP badge (a number, or «special» for a counted / bespoke rule);
 *  · the requirement's verdict in the hand's own language
 *    (`buildCardAvailability(…, 'draft')` — only printed requirements speak:
 *    the card is judged for LATER, money will change);
 * and, on the purchase, the WALLET: «N × 3 = −M · у вас A → B», the price per
 * card the server's (`thisPlayer.cardCost`), never a client constant.
 */
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {ClientCard} from '@/common/cards/ClientCard';
import {Tag} from '@/common/cards/Tag';
import {buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';

export type DraftReadingStage = 'pick' | 'buy' | 'inspect';

export type DraftReadingVp = {kind: 'number', value: number} | {kind: 'special'};

export type DraftReading = {
  name: CardName,
  /** The price to PLAY the card (the server's, under the player's discounts). */
  cost: number | undefined,
  /** The printed price, only when the play price differs from it. */
  printedCost: number | undefined,
  tags: ReadonlyArray<Tag>,
  vp: DraftReadingVp | undefined,
  /** The requirement's verdict, the hand's language; `undefined` = nothing to say. */
  availability: CardAvailabilityView | undefined,
};

/** The reading of one card — `client` is the manifest entry (`getCard(name)`), absent for an unknown name. */
export function draftReadingOf(card: CardModel, client: ClientCard | undefined): DraftReading {
  const printed = client?.cost;
  const cost = card.calculatedCost ?? printed;
  const tags: Array<Tag> = [...(client?.tags ?? [])];
  if (client?.type === CardType.EVENT && !tags.includes(Tag.EVENT)) {
    tags.push(Tag.EVENT);
  }
  const raw = client?.victoryPoints;
  const vp: DraftReadingVp | undefined = raw === undefined ? undefined :
    typeof raw === 'number' ? (raw === 0 ? undefined : {kind: 'number', value: raw}) : {kind: 'special'};
  return {
    name: card.name,
    cost,
    printedCost: printed !== undefined && cost !== undefined && printed !== cost ? printed : undefined,
    tags,
    vp,
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
};

/** The purchase's arithmetic — the wallet plate's every number. */
export function draftWalletOf(count: number, perCard: number, onHand: number): DraftWallet {
  const total = count * perCard;
  return {count, perCard, total, onHand, after: onHand - total, affordable: total <= onHand};
}

/** The purchase's honest verb: «Купить N» — «Купить 0» when nothing is chosen (it is still the commit). */
export function draftBuyVerb(count: number): {key: string, params: ReadonlyArray<string>} {
  return {key: 'Buy ${0}', params: [String(count)]};
}
