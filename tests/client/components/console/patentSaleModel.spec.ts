import {expect} from 'chai';
import {
  saleSummary, saleStackSlot, saleChipPlan, saleChipPoint, saleChipScaleAt,
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

  it('the chip arc starts at the slit, ends on the M€ row, and lifts through an apex', () => {
    const from = {x: 640, y: 620};
    const to = {x: 90, y: 120};
    const plan = saleChipPlan(from, to);
    expect(saleChipPoint(plan, 0)).to.deep.eq(from);
    expect(saleChipPoint(plan, 1)).to.deep.eq(to);
    // The mid-arc point rides ABOVE the straight chord — a toss, not a slide.
    const mid = saleChipPoint(plan, 0.5);
    const chordMidY = (from.y + to.y) / 2;
    expect(mid.y).to.be.lessThan(chordMidY);
  });

  it('the apex lift is clamped to a calm band on any travel distance', () => {
    const short = saleChipPlan({x: 0, y: 100}, {x: 40, y: 90});
    const long = saleChipPlan({x: 0, y: 2000}, {x: 3000, y: 0});
    // Apex (t=0.5) never sits more than the clamp above the higher endpoint.
    const shortApex = saleChipPoint(short, 0.5);
    const longApex = saleChipPoint(long, 0.5);
    expect(90 - shortApex.y).to.be.at.least(50 - 0.001);
    expect(90 - shortApex.y).to.be.at.most(170 + 0.001);
    expect(0 - longApex.y).to.be.at.most(170 + 0.001);
  });

  it('the chip scale pops to a readable bloom, then settles under natural for touchdown', () => {
    expect(saleChipScaleAt(0)).to.be.lessThan(0.6); // ejected small
    expect(saleChipScaleAt(0.22)).to.be.greaterThan(1); // the readable bloom
    expect(saleChipScaleAt(1)).to.be.closeTo(0.9, 0.001); // approaches the rail
    // Bounded everywhere — never a runaway inflate.
    for (let t = 0; t <= 1; t += 0.05) {
      expect(saleChipScaleAt(t)).to.be.within(0.4, 1.2);
    }
  });
});
