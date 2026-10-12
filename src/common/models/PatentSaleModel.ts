import {EffectForecastFact} from './EffectForecastModel';

/**
 * THE PATENT SALE'S RATE — what ONE card sold through the standard project
 * «Sell patents» pays the seller, and what the seller's table answers to it
 * (Turmoil Redux TR46 Research Startups: +1 data per card sold; TR18 Martian
 * Fiber: +1 M€ per data added). Rides the sale prompt (`SelectCardModel.
 * patentSale`, set by `SellPatentsStandardProject`) and is read by the
 * console's live sale summary and the trade terminal's payout: the client
 * MULTIPLIES this rate by the cards picked and never keeps a rate of its own.
 *
 * Every answer in scope is linear in the count (the parity spec
 * `tests/models/patentSaleModel.spec.ts` pins «rate × N = the executed sale»
 * for N = 1…5, with and without Martian Fiber). A reactor whose answer is not
 * linear must not ride a per-card rate — it would need a per-count table.
 */
export type PatentSaleModel = {
  /** M€ the project pays per card sold. */
  megacreditsPerCard: number;
  /**
   * The table's answers to ONE card sold, in the live walk's order: the
   * seller's `onPatentsSold` reactors, then what answers THEM (the cascade —
   * Martian Fiber after the data it answers, PL-189). Chips carry the amount
   * per card and no `current → resulting` (that pool is the client's to
   * compute for the count picked). Absent when nothing answers.
   */
  answers?: ReadonlyArray<EffectForecastFact>;
};
