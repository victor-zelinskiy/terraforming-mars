/*
 * WHO SET THE BUY PRICE — the source of a buy-to-hand price that is not the
 * default 3 M€ (Terralabs Research 1, Polyphemos 5, Quantum Research −1).
 *
 * Every purchase surface already prints the HONEST number (the wallet
 * «N × 1 = −N», the start scene's «Проекты N × 1», the fallback buy sum) —
 * the server's `cardCost`, never a client constant. What none of them says is
 * WHY the number is not 3. That is not a line of its own (the owner: the
 * reading row never repeats the face, and the corporation's face already says
 * «1 M€»): it is a `data-hint` on the «× N» the row already has, and it exists
 * only when there is a source to name.
 *
 * In play the sources are the server's (`PublicPlayerModel.cardCostSources` —
 * a discount like Quantum Research's is a server hook the client cannot see);
 * before the corporation is played (the start scene) they are the chosen
 * corporation and the campaign lineage, read off `ClientCard.cardCost` — the
 * same field the scene's own price comes from.
 */
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import * as constants from '@/common/constants';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export type PurchasePriceSource = {
  /** The price per card the surface prints. */
  price: number,
  /** The cards behind it, in the server's order. Never empty. */
  sources: ReadonlyArray<CardName>,
};

export const PURCHASE_PRICE_HINT = 'Card purchase price: ${0} M€ · ${1}';

/** In play: the server's price and the server's sources. `undefined` on a plain table — nothing to explain. */
export function purchasePriceSource(player: {cardCost: number, cardCostSources?: ReadonlyArray<CardName>}): PurchasePriceSource | undefined {
  const sources = player.cardCostSources ?? [];
  return sources.length === 0 ? undefined : {price: player.cardCost, sources};
}

/** Before the corporation is played: the corporations whose PRINTED price replaces the base (the pick + the campaign lineage). */
export function startPurchasePriceSource(price: number, corporations: ReadonlyArray<CardName | undefined>): PurchasePriceSource | undefined {
  const sources: Array<CardName> = [];
  for (const name of corporations) {
    if (name === undefined || sources.includes(name)) {
      continue;
    }
    const cardCost = getCard(name)?.cardCost;
    if (cardCost !== undefined && cardCost !== constants.CARD_COST) {
      sources.push(name);
    }
  }
  return sources.length === 0 ? undefined : {price, sources};
}

/** The hint text — «Цена покупки: 1 M€ · TerraLabs Research»; '' when there is no source (the hint stays off). */
export function purchasePriceHint(source: PurchasePriceSource | undefined): string {
  if (source === undefined) {
    return '';
  }
  return translateTextWithParams(PURCHASE_PRICE_HINT, [String(source.price), source.sources.map((name) => translateText(name)).join(', ')]);
}
