import {expect} from 'chai';
import {
  saleStackSlot,
  SALE_FLIGHT_CAP,
} from '@/client/console/patentSale/patentSaleModel';

describe('patentSaleModel (pure math of the trade-terminal scene)', () => {
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
