import {CardName} from '../cards/CardName';

/**
 * THE PRICE OF A MILESTONE CLAIM / AN AWARD FUNDING, WITH ITS CAUSE (PC01 Nirgal Enterprises · ledger GO).
 *
 * `printed` — the table's own price, as if nothing waived it (a claim's 8 M€, an award's 8 / 14 / 20, plus any
 * surcharge — Staged Protests' +8); `price` — what will actually be charged; `waivedBy` — the card that made it 0
 * (Nirgal Enterprises for both kinds, Van Allen for a claim), named by the SAME branch of the engine's rule that
 * returns the 0 (`Player.maPriceOf`) — there is no second table of «who waives a price». Absent = nobody waived it.
 */
export type MaPrice = {
  printed: number;
  price: number;
  waivedBy?: CardName;
};
