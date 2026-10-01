import {PublicPlayerModel} from '@/common/models/PlayerModel';

/**
 * THE BASE A TRADE'S RECEIPT IS MEASURED FROM.
 *
 * The reward package («ВАШ ИТОГ», «ОПЛАТА», the card-target lines) prints
 * every gain as `current → resulting`. Before the commit `current` is simply
 * the viewer's live stock. Past the commit the stage is a RECEIPT of the move
 * that was made (the boundary snapshot already pins the options, the preview
 * and the offset), and the live stock has stopped being `current`: the
 * server's answer has ALREADY paid the fee and credited the income, so a
 * receipt read off it double-counts — Callisto's «+2 энергии, 4 → 6» turned
 * into «6 → 8» the moment the response landed. The base is therefore part of
 * the boundary snapshot: the stocks, the productions and every card's stored
 * resources AS THE PLAYER PRESSED.
 */
export type TradeReceiptBase = {
  readonly stocks: Readonly<Partial<Record<string, number>>>;
  readonly production: Readonly<Partial<Record<string, number>>>;
  /** Every tableau card's stored resources, by card name (any seat). */
  readonly cardResources: Readonly<Partial<Record<string, number>>>;
};

/** The base read off the live models — what «as the player pressed» is at the press. */
export function tradeReceiptBaseOf(
  viewer: PublicPlayerModel | undefined,
  players: ReadonlyArray<PublicPlayerModel>,
): TradeReceiptBase {
  const cardResources: Partial<Record<string, number>> = {};
  for (const player of players) {
    for (const card of player.tableau) {
      if (cardResources[card.name] === undefined) {
        cardResources[card.name] = card.resources ?? 0;
      }
    }
  }
  if (viewer === undefined) {
    return {stocks: {}, production: {}, cardResources};
  }
  return {
    stocks: {
      megacredits: viewer.megacredits,
      steel: viewer.steel,
      titanium: viewer.titanium,
      plants: viewer.plants,
      energy: viewer.energy,
      heat: viewer.heat,
    },
    production: {
      megacredits: viewer.megacreditProduction,
      steel: viewer.steelProduction,
      titanium: viewer.titaniumProduction,
      plants: viewer.plantProduction,
      energy: viewer.energyProduction,
      heat: viewer.heatProduction,
    },
    cardResources,
  };
}
