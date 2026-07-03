import {expect} from 'chai';
import {
  autoMegacredits, initialCounts, laneCap, paymentCovers, paymentFromCounts,
  paymentLanes, paymentTotal, PaymentPromptLike, projectCardPaymentOptions,
  projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';

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

  // ── T8: the project-card payment rules (desktop SelectProjectCardToPlay) ──
  it('project card: tag-gated alternates (steel=building, titanium=space, …)', () => {
    const building = projectCardPaymentOptions([Tag.BUILDING], {}, undefined);
    expect(building.steel).to.eq(true);
    expect(building.titanium).to.eq(false);
    const space = projectCardPaymentOptions([Tag.SPACE], {}, undefined);
    expect(space.steel).to.eq(false);
    expect(space.titanium).to.eq(true);
    expect(space.graphene).to.eq(true);
    const plant = projectCardPaymentOptions([Tag.PLANT], {}, undefined);
    expect(plant.microbes).to.eq(true);
    expect(plant.seeds).to.eq(true);
    const venus = projectCardPaymentOptions([Tag.VENUS], {}, undefined);
    expect(venus.floaters).to.eq(true);
    // Helion heat rides the SERVER flag, never a tag.
    expect(projectCardPaymentOptions([], {heat: true}, undefined).heat).to.eq(true);
    expect(projectCardPaymentOptions([], {}, undefined).heat).to.eq(false);
  });

  it('project card: Last Resort Ingenuity unlocks steel AND full-rate titanium', () => {
    const options = projectCardPaymentOptions([], {}, CardName.LAST_RESORT_INGENUITY);
    expect(options.steel).to.eq(true);
    expect(options.titanium).to.eq(true);
  });

  it('project card: LTF-only titanium pays 1 less; space-tag pays full', () => {
    const ltfOnly = projectCardPaymentPrompt(10, [], {lunaTradeFederationTitanium: true}, undefined, undefined);
    const lanes = paymentLanes(ltfOnly, player());
    expect(lanes.find((l) => l.unit === 'titanium')?.rate).to.eq(2); // 3 − 1
    const space = projectCardPaymentPrompt(10, [Tag.SPACE], {lunaTradeFederationTitanium: true}, undefined, undefined);
    expect(paymentLanes(space, player()).find((l) => l.unit === 'titanium')?.rate).to.eq(3);
  });

  it('project card: reserveUnits are SUBTRACTED from the spendable pool', () => {
    const reserve: Units = {megacredits: 0, steel: 3, titanium: 0, plants: 0, energy: 0, heat: 0};
    const p = projectCardPaymentPrompt(10, [Tag.BUILDING], {}, undefined, reserve);
    const lanes = paymentLanes(p, player({steel: 4}));
    const steel = lanes.find((l) => l.unit === 'steel');
    expect(steel?.available).to.eq(1); // 4 − 3 reserved
    expect(steel?.reserved).to.eq(true);
    // Fully-reserved → the lane disappears (nothing spendable).
    const p2 = projectCardPaymentPrompt(10, [Tag.BUILDING], {}, undefined, {...reserve, steel: 4});
    expect(paymentLanes(p2, player({steel: 4})).find((l) => l.unit === 'steel')).to.eq(undefined);
  });
});
