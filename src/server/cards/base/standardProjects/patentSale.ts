/**
 * THE PATENT SALE's own numbers — the standard project «Sell patents» and its
 * fork hook `ICard.onPatentsSold` (Turmoil Redux TR46 Research Startups).
 *
 * The project's rate lives HERE, on the server: the sale prompt carries it to
 * the client on its `patentSale` model (`models/patentSaleModel.ts`), so the
 * console's sale summary never keeps a rate of its own (it used to:
 * `sellPatentsPayout` — a client constant that only happened to match).
 */

/** M€ the standard project pays per card sold. */
export const SELL_PATENTS_MEGACREDITS_PER_CARD = 1;

/** The journal's unit of a reward counted by the cards sold («for 4 patents sold») — its plural group agrees with the count. */
export const PATENTS_SOLD_UNIT = '{patent|patents} sold';
