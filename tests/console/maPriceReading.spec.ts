import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {maFundedSlotReading, maPriceCharged, maPriceReading, maPriceWaiverOf} from '../../src/client/console/maPriceReading';

/**
 * PC01 · GO — THE MILESTONE / AWARD PRICE NAMES ITS CAUSE: one pure reading for every surface that prints a claim /
 * funding price. `paid` stays the number it always was (the PL-1621 flight arms only for it); `waived` is the table's
 * price struck + the source; `free` is Vitor's sponsorship (its own words) and the degrade of an unnamed 0.
 */
describe('maPriceReading (PC01 · GO)', () => {
  it('a plain price is PAID — and is the only reading that charges the rail', () => {
    const reading = maPriceReading({price: 8});
    expect(reading).deep.eq({kind: 'paid', price: 8});
    expect(maPriceCharged(reading)).is.true;
  });

  it('a waived price names the table\'s price and the card — and charges nothing', () => {
    const reading = maPriceReading({price: 0, printed: 14, waivedBy: CardName.NIRGAL_ENTERPRISES});
    expect(reading).deep.eq({kind: 'waived', printed: 14, waivedBy: CardName.NIRGAL_ENTERPRISES});
    expect(maPriceCharged(reading)).is.false;
  });

  it('Vitor\'s free sponsorship stays FREE — never merged with a waiver', () => {
    expect(maPriceReading({price: 0, printed: 8, waivedBy: CardName.NIRGAL_ENTERPRISES, free: true})).deep.eq({kind: 'free'});
  });

  it('a 0 with no named cause (a model that predates the waiver) degrades to the old «free»', () => {
    expect(maPriceReading({price: 0})).deep.eq({kind: 'free'});
  });

  it('a printed price that was already 0 strikes nothing — the seal alone names who', () => {
    expect(maPriceReading({price: 0, printed: 0, waivedBy: CardName.VANALLEN})).deep.eq({kind: 'waived', printed: undefined, waivedBy: CardName.VANALLEN});
  });

  describe('a funded slot — the PAST', () => {
    it('reads what it WENT for: a waived 0 with its source, never the rules\' price', () => {
      expect(maFundedSlotReading({paid: 0, waivedBy: CardName.NIRGAL_ENTERPRISES}, 8))
        .deep.eq({kind: 'waived', printed: undefined, waivedBy: CardName.NIRGAL_ENTERPRISES});
      expect(maFundedSlotReading({paid: 14}, 14)).deep.eq({kind: 'paid', price: 14});
    });

    it('Vitor\'s slot is the number it went for — 0', () => {
      expect(maFundedSlotReading({paid: 0}, 8)).deep.eq({kind: 'paid', price: 0});
    });

    it('an old save with no fact prints the rules\' price of the slot', () => {
      expect(maFundedSlotReading({}, 20)).deep.eq({kind: 'paid', price: 20});
    });
  });

  describe('the server\'s waiver of the next price', () => {
    it('reads `maCosts.waiver` with its printed price, per kind', () => {
      const costs = {milestone: 0, award: 8, printed: {milestone: 8, award: 8}, waiver: {milestone: CardName.VANALLEN}};
      expect(maPriceWaiverOf(costs, 'milestones')).deep.eq({printed: 8, waivedBy: CardName.VANALLEN});
      expect(maPriceWaiverOf(costs, 'awards')).is.undefined;
    });

    it('a model without the field waives nothing', () => {
      expect(maPriceWaiverOf({milestone: 8, award: 8}, 'milestones')).is.undefined;
      expect(maPriceWaiverOf(undefined, 'awards')).is.undefined;
    });
  });
});
