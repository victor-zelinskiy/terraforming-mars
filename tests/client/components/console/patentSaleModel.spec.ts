import {expect} from 'chai';
import {
  saleSummary, saleStackSlot,
  SALE_FLIGHT_CAP,
} from '@/client/console/patentSale/patentSaleModel';
import {SELL_PATENTS_RATE} from '@/client/components/handCards/sellPatentsState';

describe('patentSaleModel (pure math of the trade-terminal scene)', () => {
  it('saleSummary mirrors the server rate: count → payout → before/after wallet', () => {
    const s = saleSummary(8, 23);
    expect(s.count).to.eq(8);
    expect(s.payout).to.eq(8 * SELL_PATENTS_RATE);
    expect(s.before).to.eq(23);
    expect(s.after).to.eq(23 + 8 * SELL_PATENTS_RATE);
  });

  it('saleSummary at zero picks is an honest no-op (before === after)', () => {
    const s = saleSummary(0, 15);
    expect(s.payout).to.eq(0);
    expect(s.before).to.eq(15);
    expect(s.after).to.eq(15);
  });

  it('saleStackSlot is deterministic and NEAT — hair-width offsets, bounded roll', () => {
    for (let i = 0; i < SALE_FLIGHT_CAP; i++) {
      const a = saleStackSlot(i);
      const b = saleStackSlot(i);
      expect(a).to.deep.eq(b); // never random
      expect(Math.abs(a.dx)).to.be.at.most(4); // a tidy pile, not a fan
      expect(Math.abs(a.rot)).to.be.at.most(3.5);
    }
    // Later cards sit ON TOP (a touch higher) — the pile reads as stacked.
    expect(saleStackSlot(3).dy).to.be.lessThan(saleStackSlot(0).dy);
  });

  // The payout chip's arc / scale maths moved to the shared resource-transfer
  // framework — covered by resourceTransferModel.spec.ts.
});
