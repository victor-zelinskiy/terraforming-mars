import {expect} from 'chai';
import {
  CARD_NATURAL_W, DECK_SCALE, dealTimings, dealTotalMs, flightPlan, HANDOFF_AT, REVEAL_AT,
} from '@/client/console/cardDeal/cardDealModel';
import {resetCardDealMemory, shouldRunDealOnce} from '@/client/console/cardDeal/cardDealMemory';

describe('cardDealModel', () => {
  it('tightens the stagger for wide sets, keeps small sets deliberate', () => {
    const five = dealTimings(5);
    const ten = dealTimings(10);
    expect(ten.staggerMs).to.be.lessThan(five.staggerMs);
    expect(ten.flightMs).to.be.lessThan(five.flightMs);
  });

  it('keeps the whole sequence inside a confident budget', () => {
    // 5-card corp pick ≈ 1.1s; the 10-card project buy stays under 1.6s.
    expect(dealTotalMs(5, dealTimings(5))).to.be.within(800, 1400);
    expect(dealTotalMs(10, dealTimings(10))).to.be.within(900, 1600);
    expect(dealTotalMs(0, dealTimings(0))).to.eq(0);
  });

  it('flight plans are deterministic, staggered, side-alternating', () => {
    const t = dealTimings(5);
    const a1 = flightPlan(0, t);
    const a2 = flightPlan(0, t);
    expect(a1).to.deep.eq(a2); // no randomness
    const b = flightPlan(1, t);
    expect(b.delayMs - a1.delayMs).to.eq(t.staggerMs);
    expect(Math.sign(a1.rotZFrom)).to.not.eq(Math.sign(b.rotZFrom));
    for (let i = 0; i < 12; i++) {
      expect(Math.abs(flightPlan(i, t).rotZFrom)).to.be.within(2, 6);
    }
  });

  it('reveal fires before the handoff fade within one flight', () => {
    expect(REVEAL_AT).to.be.lessThan(HANDOFF_AT);
    expect(HANDOFF_AT).to.be.lessThan(1);
  });

  it('geometry constants mirror the card frame', () => {
    expect(CARD_NATURAL_W).to.eq(300);
    expect(DECK_SCALE).to.be.within(0.2, 0.6);
  });
});

describe('cardDealMemory', () => {
  beforeEach(() => resetCardDealMemory());

  it('deals once per key — repeats (defer/restore, step back) are instant', () => {
    expect(shouldRunDealOnce('p1|wizard|0|A,B')).to.eq(true);
    expect(shouldRunDealOnce('p1|wizard|0|A,B')).to.eq(false);
    expect(shouldRunDealOnce('p1|wizard|1|C')).to.eq(true);
  });
});
