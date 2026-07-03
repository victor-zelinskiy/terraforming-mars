import {expect} from 'chai';
import {
  autoMegacredits, initialCounts, laneCap, paymentCovers, paymentFromCounts,
  paymentLanes, paymentTotal, PaymentPromptLike,
} from '@/client/console/paymentPlan';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';

/**
 * CTS T3: the console payment lanes reuse the EXACT desktop ledger math —
 * these fixtures pin the rate rules (steelValue / titaniumValue / the Luna
 * −1 rule), lane filtering, the auto-M€ remainder and cost coverage so a
 * console payment is always a mix the desktop form could also produce.
 */

function player(overrides: Partial<Record<string, unknown>> = {}): PublicPlayerModel {
  return {
    megacredits: 20,
    steel: 4,
    titanium: 2,
    plants: 3,
    heat: 6,
    steelValue: 2,
    titaniumValue: 3,
    tableau: [],
    ...overrides,
  } as unknown as PublicPlayerModel;
}

function prompt(amount: number, options: PaymentPromptLike['paymentOptions'], reserveUnits?: Readonly<Units>): PaymentPromptLike {
  return {amount, paymentOptions: options, reserveUnits};
}

describe('paymentPlan (T3 native payment math)', () => {
  it('lanes: filtered by paymentOptions, 0-available omitted, M€ never a lane', () => {
    const lanes = paymentLanes(prompt(10, {steel: true, titanium: true, heat: true}), player({titanium: 0}));
    expect(lanes.map((l) => l.unit)).to.deep.eq(['steel', 'heat']); // titanium: none owned
    expect(lanes[0]).to.deep.include({unit: 'steel', rate: 2, available: 4});
    expect(lanes[1]).to.deep.include({unit: 'heat', rate: 1, available: 6});
  });

  it('rates: steelValue / titaniumValue come from the player (Advanced Alloys etc.)', () => {
    const lanes = paymentLanes(prompt(10, {steel: true, titanium: true}), player({steelValue: 3, titaniumValue: 4}));
    expect(lanes.find((l) => l.unit === 'steel')?.rate).to.eq(3);
    expect(lanes.find((l) => l.unit === 'titanium')?.rate).to.eq(4);
  });

  it('the Luna Trade Federation rule: LTF-only titanium pays 1 less', () => {
    const ltfOnly = paymentLanes(prompt(10, {lunaTradeFederationTitanium: true}), player());
    expect(ltfOnly.find((l) => l.unit === 'titanium')?.rate).to.eq(2); // 3 − 1
    const both = paymentLanes(prompt(10, {titanium: true, lunaTradeFederationTitanium: true}), player());
    expect(both.find((l) => l.unit === 'titanium')?.rate).to.eq(3);
  });

  it('reserved flag mirrors reserveUnits (display-only, desktop parity)', () => {
    const reserve: Units = {megacredits: 0, steel: 2, titanium: 0, plants: 0, energy: 0, heat: 0};
    const lanes = paymentLanes(prompt(10, {steel: true, heat: true}, reserve), player());
    expect(lanes.find((l) => l.unit === 'steel')?.reserved).to.eq(true);
    expect(lanes.find((l) => l.unit === 'heat')?.reserved).to.eq(false);
  });

  it('laneCap: never more of one unit than covers the whole cost', () => {
    expect(laneCap(7, {unit: 'steel', rate: 2, available: 10, reserved: false})).to.eq(4); // ceil(7/2)
    expect(laneCap(7, {unit: 'steel', rate: 2, available: 2, reserved: false})).to.eq(2); // ownership caps
  });

  it('auto-M€ is exactly the uncovered remainder, capped by ownership', () => {
    const lanes = paymentLanes(prompt(10, {steel: true}), player());
    expect(autoMegacredits(10, lanes, {}, 20)).to.eq(10);
    expect(autoMegacredits(10, lanes, {steel: 3}, 20)).to.eq(4); // 10 − 6
    expect(autoMegacredits(10, lanes, {steel: 3}, 2)).to.eq(2); // capped
    expect(autoMegacredits(10, lanes, {steel: 5}, 20)).to.eq(0); // covered (overpay remainder)
  });

  it('coverage + total mirror PaymentFormV2.canSave semantics', () => {
    const lanes = paymentLanes(prompt(10, {steel: true}), player({megacredits: 3}));
    expect(paymentTotal(10, lanes, {steel: 2}, 3)).to.eq(7); // 4 + auto 3
    expect(paymentCovers(10, lanes, {steel: 2}, 3)).to.eq(false); // 7 < 10
    expect(paymentCovers(10, lanes, {steel: 4}, 3)).to.eq(true); // 8 + 2 = 10
    expect(paymentCovers(10, lanes, {steel: 9}, 3)).to.eq(false); // exceeds ownership
  });

  it('paymentFromCounts: full Payment payload, auto-M€ baked in', () => {
    const lanes = paymentLanes(prompt(10, {steel: true}), player());
    const payment = paymentFromCounts(10, lanes, {steel: 3}, 20);
    expect(payment.steel).to.eq(3);
    expect(payment.megacredits).to.eq(4);
    expect(payment.titanium).to.eq(0);
    expect(payment.heat).to.eq(0);
    // Every spendable key must be present (server contract).
    expect(Object.keys(payment)).to.include.members(['seeds', 'floaters', 'microbes', 'auroraiData']);
  });

  it('initialCounts: the DESKTOP default — idle alternates first, M€ tops up', () => {
    // computeDefaultPayment spends steel/titanium first (they are useless
    // for anything else), M€ covers the remainder — desktop parity.
    const lanes = paymentLanes(prompt(10, {steel: true}), player({megacredits: 20}));
    const counts = initialCounts(10, lanes, 20);
    expect(counts.steel).to.eq(4); // all 4 steel (8), auto-M€ adds 2
    expect(autoMegacredits(10, lanes, counts, 20)).to.eq(2);
    expect(paymentCovers(10, lanes, counts, 20)).to.eq(true);
  });

  it('initialCounts: unavoidable rate-remainder overpay survives the trim pass', () => {
    // Cost 5, steel ×2: 3 steel = 6 — trimming to 2 (4) would UNDER-pay,
    // so the 1 M€ overpay is unavoidable (same as the desktop form).
    const lanes = paymentLanes(prompt(5, {steel: true}), player({megacredits: 0}));
    const counts = initialCounts(5, lanes, 0);
    expect(counts.steel).to.eq(3);
    expect(paymentTotal(5, lanes, counts, 0)).to.eq(6);
    expect(paymentCovers(5, lanes, counts, 0)).to.eq(true);
  });

  it('zero-cost prompt: no lanes needed, trivially covered', () => {
    const lanes = paymentLanes(prompt(0, {}), player());
    expect(lanes).to.deep.eq([]);
    expect(paymentCovers(0, lanes, {}, 0)).to.eq(true);
    expect(paymentFromCounts(0, lanes, {}, 0).megacredits).to.eq(0);
  });
});
