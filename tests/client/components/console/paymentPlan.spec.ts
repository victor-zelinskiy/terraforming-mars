import {expect} from 'chai';
import {
  alternativeContribution, autoMegacredits, dialLaneCount, initialCounts, laneCap,
  paymentCovers, paymentFromCounts, PaymentLane,
  paymentLanes, paymentOverpay, paymentTotal, PaymentPromptLike, projectCardPaymentOptions,
  projectCardPaymentPrompt, paymentUnitIcon,
} from '@/client/console/paymentPlan';
import {buildStandardProjectPaymentOptions, GENERIC_PAYMENT_ORDER} from '@/client/components/payment/paymentModelUtils';
import {SPENDABLE_RESOURCES} from '@/common/inputs/Spendable';
import {CardModel} from '@/common/models/CardModel';
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
    const steel: PaymentLane = {unit: 'steel', rate: 2, available: 10, reserved: false};
    expect(laneCap(7, steel, [steel], {})).to.eq(4); // ceil(7/2)
    const scarce: PaymentLane = {...steel, available: 2};
    expect(laneCap(7, scarce, [scarce], {})).to.eq(2); // ownership caps
  });

  /**
   * THE AGGREGATE ANTI-OVERPAY LIMIT.
   *
   * The reported bug: a 12 M€ card with steel ×3 AND titanium ×4 accepted 4
   * steel (12) AND 3 titanium (12) — 24 paid for a 12 M€ card — because each
   * lane computed its cap alone (`ceil(cost / rate)`) and could not see what
   * the other one was already paying. The cap is now measured against
   * `alternativeContribution` (M€ excluded: it is the auto lane), so «+» dies
   * on EVERY alternative at once and comes back only when the combination
   * drops below the price again.
   */
  describe('the aggregate anti-overpay limit (12 M€ · steel ×3 · titanium ×4)', () => {
    const STEEL: PaymentLane = {unit: 'steel', rate: 3, available: 496, reserved: false};
    const TITANIUM: PaymentLane = {unit: 'titanium', rate: 4, available: 531, reserved: false};
    const LANES = [STEEL, TITANIUM];
    const COST = 12;

    it('alternativeContribution sums every alt lane and never counts M€', () => {
      expect(alternativeContribution(LANES, {steel: 3, titanium: 1})).to.eq(13); // 9 + 4
      expect(alternativeContribution(LANES, {steel: 3, titanium: 1, megacredits: 7})).to.eq(13);
      expect(alternativeContribution(LANES, {})).to.eq(0);
    });

    it('one alternative alone still reaches the whole price (unchanged behaviour)', () => {
      expect(laneCap(COST, STEEL, LANES, {})).to.eq(4); // ceil(12/3)
      expect(laneCap(COST, TITANIUM, LANES, {})).to.eq(3); // ceil(12/4)
    });

    it('a SECOND alternative may only cover what the first leaves unpaid', () => {
      // 4 steel already pay the whole price → titanium has nothing to buy.
      expect(laneCap(COST, TITANIUM, LANES, {steel: 4})).to.eq(0);
      // 3 steel pay 9 → titanium may take the last unit (which crosses to 13).
      expect(laneCap(COST, TITANIUM, LANES, {steel: 3})).to.eq(1);
      // …and steel cannot then grow either: 4 + 9 would be a SECOND crossing.
      expect(laneCap(COST, STEEL, LANES, {steel: 3, titanium: 1})).to.eq(3);
    });

    it('the last unit MAY cross the price once — a second one may not', () => {
      // 3 steel + 1 titanium = 13/12: legal, an indivisible rate remainder.
      expect(paymentOverpay(COST, LANES, {steel: 3, titanium: 1}, 650)).to.eq(1);
      // Every alternative is capped at what it already spends past the crossing.
      for (const lane of LANES) {
        expect(laneCap(COST, lane, LANES, {steel: 3, titanium: 1}))
          .to.eq({steel: 3, titanium: 1}[lane.unit as 'steel' | 'titanium']);
      }
    });

    it('«+» is refused on EVERY alternative the moment the price is met', () => {
      const at = (counts: Record<string, number>) =>
        LANES.map((l) => dialLaneCount(COST, l, LANES, counts, 1) > (counts[l.unit] ?? 0));
      expect(at({})).to.deep.eq([true, true]);
      expect(at({steel: 3})).to.deep.eq([true, true]); // 9 < 12 — both still open
      expect(at({steel: 4})).to.deep.eq([false, false]); // 12 — met exactly
      expect(at({steel: 3, titanium: 1})).to.deep.eq([false, false]); // 13 — crossed
    });

    it('«−» stays live, and dropping a source re-opens «+» on all of them', () => {
      const counts = {steel: 3, titanium: 1};
      expect(dialLaneCount(COST, TITANIUM, LANES, counts, -1)).to.eq(0);
      const after = {steel: 3, titanium: 0};
      expect(alternativeContribution(LANES, after)).to.eq(9); // M€ tops the last 3 up
      expect(autoMegacredits(COST, LANES, after, 650)).to.eq(3);
      expect(dialLaneCount(COST, STEEL, LANES, after, 1)).to.eq(4);
      expect(dialLaneCount(COST, TITANIUM, LANES, after, 1)).to.eq(1);
    });

    it('«−» may always be pressed down to zero, even into a shortfall', () => {
      const poor = 0; // no M€ to top up with
      expect(dialLaneCount(COST, STEEL, LANES, {steel: 1}, -1)).to.eq(0);
      expect(paymentCovers(COST, LANES, {steel: 0}, poor)).to.eq(false); // the CONFIRM blocks, not the button
    });

    it('MAX takes what the OTHER sources leave — never the whole price alone', () => {
      expect(dialLaneCount(COST, STEEL, LANES, {}, 'max')).to.eq(4);
      // 1 titanium already pays 4 → steel maxes at ceil(8/3) = 3, not 4.
      expect(dialLaneCount(COST, STEEL, LANES, {titanium: 1}, 'max')).to.eq(3);
      // …and with the price already met, MAX on the other lane is a no-op.
      expect(dialLaneCount(COST, TITANIUM, LANES, {steel: 4}, 'max')).to.eq(0);
    });

    it('a repeat that arrives between two renders cannot push a unit through', () => {
      // The limit lives in the mutation, not only in the row's `canIncrease`
      // paint: pressing «+» at (or past) the limit returns the SAME count.
      const met = {steel: 4};
      expect(dialLaneCount(COST, STEEL, LANES, met, 1)).to.eq(4);
      expect(dialLaneCount(COST, TITANIUM, LANES, met, 1)).to.eq(0);
      const crossed = {steel: 3, titanium: 1};
      expect(dialLaneCount(COST, STEEL, LANES, crossed, 1)).to.eq(3);
      expect(dialLaneCount(COST, TITANIUM, LANES, crossed, 1)).to.eq(1);
    });

    it('ownership still caps a lane below the aggregate room', () => {
      const scarce: PaymentLane = {unit: 'titanium', rate: 4, available: 1, reserved: false};
      expect(laneCap(COST, scarce, [scarce], {})).to.eq(1); // ceil(12/4) = 3, owns 1
      expect(dialLaneCount(COST, scarce, [scarce], {titanium: 1}, 'max')).to.eq(1);
    });
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

  it('paymentOverpay: M€-value spent above the cost (0 when exact / under)', () => {
    const lanes = paymentLanes(prompt(11, {steel: true}), player({steel: 6, megacredits: 20}));
    // 6 steel @2 = 12 for an 11 cost → overpay 1 (M€ auto-lane stays 0).
    expect(paymentOverpay(11, lanes, {steel: 6}, 20)).to.eq(1);
    // 5 steel @2 = 10, +1 auto M€ = 11 exact → no overpay.
    expect(paymentOverpay(11, lanes, {steel: 5}, 20)).to.eq(0);
    // Under-covered → deficit, never a phantom overpay.
    expect(paymentOverpay(11, lanes, {steel: 2}, 0)).to.eq(0);
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

  // ── every spendable resource must REACH the panel ────────────────────────
  //
  // `paymentLanes` iterates GENERIC_PAYMENT_ORDER, so a unit missing from that
  // list is a unit no console payment surface can offer — however loudly the
  // server says it may be spent. Four of them (plants / microbes / floaters /
  // lunaArchivesScience) were absent by omission and silently disabled Martian
  // Lumber Corp, Psychrophiles, Dirigibles and Luna Archives everywhere.
  it('the lane order covers EVERY spendable resource (no unit can be unreachable)', () => {
    const missing = SPENDABLE_RESOURCES.filter((unit) => !GENERIC_PAYMENT_ORDER.includes(unit));
    expect(missing, `unreachable in every console payment surface: ${missing.join(', ')}`).to.deep.eq([]);
  });

  it('Martian Lumber Corp: a BUILDING card gets a plants lane at ×3', () => {
    // The server grant (`paymentOptions.plants`) plus the card's building tag.
    const p = projectCardPaymentPrompt(12, [Tag.BUILDING], {plants: true}, undefined, undefined);
    const plants = paymentLanes(p, player({plants: 6})).find((l) => l.unit === 'plants');
    expect(plants).to.deep.include({unit: 'plants', rate: 3, available: 6});
  });

  it('Martian Lumber Corp: no building tag OR no grant → no plants lane', () => {
    const noTag = projectCardPaymentPrompt(12, [Tag.SPACE], {plants: true}, undefined, undefined);
    expect(paymentLanes(noTag, player({plants: 6})).find((l) => l.unit === 'plants')).to.eq(undefined);
    const noGrant = projectCardPaymentPrompt(12, [Tag.BUILDING], {}, undefined, undefined);
    expect(paymentLanes(noGrant, player({plants: 6})).find((l) => l.unit === 'plants')).to.eq(undefined);
  });

  it('the card-bound alternates reach the panel too (Psychrophiles / Dirigibles / Luna Archives)', () => {
    const holder = (name: CardName, resources: number) => ({name, resources});
    const rich = player({
      tableau: [
        holder(CardName.PSYCHROPHILES, 3),
        holder(CardName.DIRIGIBLES, 2),
        holder(CardName.LUNA_ARCHIVES, 4),
      ],
    });
    const plant = projectCardPaymentPrompt(12, [Tag.PLANT], {}, undefined, undefined);
    expect(paymentLanes(plant, rich).find((l) => l.unit === 'microbes')).to.deep.include({rate: 2, available: 3});
    const venus = projectCardPaymentPrompt(12, [Tag.VENUS], {}, undefined, undefined);
    expect(paymentLanes(venus, rich).find((l) => l.unit === 'floaters')).to.deep.include({rate: 3, available: 2});
    const moon = projectCardPaymentPrompt(12, [Tag.MOON], {}, undefined, undefined);
    expect(paymentLanes(moon, rich).find((l) => l.unit === 'lunaArchivesScience')).to.deep.include({rate: 1, available: 4});
  });

  // ── the DEFAULT mix never cashes in a resource that has another use ──────
  it('initialCounts: steel stays greedy, plants are left alone (per-unit exemption)', () => {
    // 8 plants are a greenery, a TR step and a VP — spending them by default
    // for money the player already has is a silent loss (heat, the other
    // convertible resource, has always been exempt from the greedy pass).
    // Steel buys nothing else, so it keeps filling the price first.
    const p = projectCardPaymentPrompt(12, [Tag.BUILDING], {plants: true}, undefined, undefined);
    const lanes = paymentLanes(p, player({steel: 4, plants: 6, megacredits: 20}));
    const counts = initialCounts(12, lanes, 20);
    expect(counts.steel).to.eq(4); // 4 × 2 = 8 — greedy, as before
    expect(counts.plants).to.eq(0);
    expect(autoMegacredits(12, lanes, counts, 20)).to.eq(4);
  });

  it('initialCounts: plants still cover the MINIMUM when M€ falls short', () => {
    // Plants the only alternative, 4 M€ on hand against 12: they must close
    // the 8 M€ gap (ceil(8/3) = 3), and no further — the last 3 come from M€.
    const p = projectCardPaymentPrompt(12, [Tag.BUILDING], {plants: true}, undefined, undefined);
    const lanes = paymentLanes(p, player({steel: 0, titanium: 0, plants: 6, megacredits: 4}));
    const counts = initialCounts(12, lanes, 4);
    expect(counts.plants).to.eq(3);
    expect(autoMegacredits(12, lanes, counts, 4)).to.eq(3);
    expect(paymentCovers(12, lanes, counts, 4)).to.eq(true);
    expect(paymentOverpay(12, lanes, counts, 4)).to.eq(0);
  });

  /**
   * A STANDARD PROJECT accepts a closed list the server enforces on submit, and
   * the project-card grants are not on it. Offering a lane the server will
   * reject is worse than offering none — the player builds a mix, presses
   * confirm and gets «Did not spend enough».
   */
  it('a standard project never inherits the project-card grants (plants above all)', () => {
    const card = {standardProjectCanPayWith: {steel: true}} as unknown as CardModel;
    const options = buildStandardProjectPaymentOptions(
      // Exactly what `SelectCardToPlay.toModel` sends for a Martian Lumber player.
      {heat: true, lunaTradeFederationTitanium: true, plants: true},
      card);
    expect(options.plants).to.not.eq(true);
    expect(paymentLanes({amount: 8, paymentOptions: options}, player({plants: 9})).map((l) => l.unit))
      .to.not.include('plants');
    // …while the grants a standard project DOES honour still come through.
    expect(options.heat).to.eq(true);
    expect(options.lunaTradeFederationTitanium).to.eq(true);
    expect(options.steel).to.eq(true);
  });

  it('the panel icon key is the SPRITE name, not the ledger key', () => {
    // `card-resource-<key>` classes are generated SINGULAR from the LESS
    // `@card_resource_types` list, so the plural/camelCase ledger keys resolve
    // to classes no stylesheet defines (an empty box where the resource goes).
    expect(paymentUnitIcon('microbes')).to.eq('microbe');
    expect(paymentUnitIcon('floaters')).to.eq('floater');
    expect(paymentUnitIcon('seeds')).to.eq('seed');
    expect(paymentUnitIcon('auroraiData')).to.eq('data');
    expect(paymentUnitIcon('kuiperAsteroids')).to.eq('asteroid');
    expect(paymentUnitIcon('spireScience')).to.eq('science');
    expect(paymentUnitIcon('lunaArchivesScience')).to.eq('science');
    // Standard resources already ARE their sprite key.
    expect(paymentUnitIcon('plants')).to.eq('plants');
    expect(paymentUnitIcon('megacredits')).to.eq('megacredits');
  });
});
