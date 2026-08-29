/*
 * PURE payment-lane math for the console-native payment task — CTS T3
 * (docs/CONSOLE_MODE_CONCEPT.md §CTS-3). Reuses the EXACT desktop rate/available
 * sources (paymentModelUtils + PaymentDefaults + the PaymentWidgetMixin
 * ledger rules) so a console payment is always a mix the desktop
 * PaymentFormV2 could also produce — byte-parity by construction:
 *
 *  - lane order  = GENERIC_PAYMENT_ORDER filtered by paymentOptions
 *  - available   = getSpendablePaymentAmounts (incl. Stormcraft heat)
 *  - rate        = steelValue / titaniumValue (incl. the Luna Trade
 *                  Federation −1 rule) / DEFAULT_PAYMENT_VALUES
 *  - M€ is an AUTO lane: always exactly the uncovered remainder (mirrors
 *    the desktop form's own auto-M€ behavior), so under/over-payment by
 *    M€ is impossible; overpay can only be an unavoidable rate remainder.
 *  - the initial mix comes from the SAME computeDefaultPayment the
 *    desktop form initializes with.
 *
 * No Vue / DOM / i18n — unit-tested under the server runner
 * (tests/client/components/console/paymentPlan.spec.ts).
 */

import {DEFAULT_PAYMENT_VALUES, Payment, PaymentOptions} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Units} from '@/common/Units';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {newDefaultLedger} from '@/client/components/PaymentLedger';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';
import {
  GENERIC_PAYMENT_ORDER,
  getSpendablePaymentAmounts,
  paymentOptionsAllowResource,
} from '@/client/components/payment/paymentModelUtils';

/** The subset of SelectPaymentModel the plan needs (also client-built models). */
export type PaymentPromptLike = {
  amount: number,
  paymentOptions: Partial<PaymentOptions>,
  reserveUnits?: Readonly<Units>,
  /**
   * The PROJECT-CARD payment semantic (desktop SelectProjectCardToPlay):
   * the reserved units are SUBTRACTED from what's spendable (the card
   * itself needs them). The SelectPayment flow only FLAGS them (default).
   */
  subtractReserve?: boolean,
};

export type PaymentLane = {
  unit: SpendableResource,
  rate: number,
  available: number,
  /** Units the card itself needs (desktop `reserved` flag — display only). */
  reserved: boolean,
};

const STANDARD_UNIT_KEYS: ReadonlyArray<keyof Units> =
  ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

function isStandardUnit(unit: string): unit is keyof Units {
  return (STANDARD_UNIT_KEYS as ReadonlyArray<string>).includes(unit);
}

/**
 * M€ bought by ONE unit of `unit` for this player under `options` — THE rate
 * every console payment number is built from. Exported for the left rail's
 * passive value badges (railValueModel), which must state the same rate the
 * payment editor would charge by; never duplicate this table.
 */
export function rateFor(unit: SpendableResource, player: PublicPlayerModel, options: Partial<PaymentOptions>): number {
  if (unit === 'steel') {
    return player.steelValue;
  }
  if (unit === 'titanium') {
    // The Luna Trade Federation rule (mirrors PaymentWidgetMixin):
    // titanium usable ONLY via LTF pays 1 less.
    if (options.titanium !== true && options.lunaTradeFederationTitanium === true) {
      return player.titaniumValue - 1;
    }
    return player.titaniumValue;
  }
  return DEFAULT_PAYMENT_VALUES[unit];
}

/**
 * The adjustable NON-M€ lanes for this prompt: allowed by paymentOptions AND
 * actually owned (a 0-available lane offers no decision — omitted).
 */
export function paymentLanes(prompt: PaymentPromptLike, player: PublicPlayerModel): Array<PaymentLane> {
  const available = getSpendablePaymentAmounts(player);
  const reserve = prompt.reserveUnits;
  const lanes: Array<PaymentLane> = [];
  for (const unit of GENERIC_PAYMENT_ORDER) {
    if (unit === 'megacredits' || !paymentOptionsAllowResource(prompt.paymentOptions, unit)) {
      continue;
    }
    let amount = available[unit] ?? 0;
    const reservedHere = reserve !== undefined && isStandardUnit(unit) && reserve[unit] > 0;
    if (prompt.subtractReserve === true && reservedHere && reserve !== undefined && isStandardUnit(unit)) {
      // Project-card semantic: the card's own reserve is NOT spendable.
      amount = Math.max(amount - reserve[unit], 0);
    }
    if (amount <= 0) {
      continue;
    }
    lanes.push({
      unit,
      rate: rateFor(unit, player, prompt.paymentOptions),
      available: amount,
      reserved: reservedHere,
    });
  }
  return lanes;
}

/** Player M€ on hand (the auto lane's ceiling). */
export function megacreditsAvailable(player: PublicPlayerModel): number {
  return player.megacredits ?? 0;
}

/**
 * The PROJECT-CARD payment rules — a PURE mirror of the desktop
 * `SelectProjectCardToPlay.canUse` (regular-card branch): tag-gated
 * alternates + the Last Resort Ingenuity steel/titanium exception + the
 * Luna Trade Federation reduced-rate titanium. `tags` are the card's
 * manifest tags (resolved by the caller — this module stays manifest-free
 * so the spec runs under the server runner).
 */
export function projectCardPaymentOptions(
  tags: ReadonlyArray<Tag>,
  inputOptions: Partial<PaymentOptions>,
  lastCardPlayed: CardName | undefined,
): Partial<PaymentOptions> {
  const lastResort = lastCardPlayed === CardName.LAST_RESORT_INGENUITY;
  return {
    heat: inputOptions.heat === true,
    steel: tags.includes(Tag.BUILDING) || lastResort,
    // `titanium: true` = the FULL rate (space tag / Last Resort); LTF-only
    // titanium pays 1 less (rateFor mirrors getTitaniumResourceRate).
    titanium: tags.includes(Tag.SPACE) || lastResort,
    lunaTradeFederationTitanium: inputOptions.lunaTradeFederationTitanium === true,
    plants: tags.includes(Tag.BUILDING) && inputOptions.plants === true,
    microbes: tags.includes(Tag.PLANT),
    floaters: tags.includes(Tag.VENUS),
    lunaArchivesScience: tags.includes(Tag.MOON),
    seeds: tags.includes(Tag.PLANT),
    graphene: tags.includes(Tag.SPACE) || tags.includes(Tag.CITY),
  };
}

/** The full project-card payment prompt (native play flow — CTS T8). */
export function projectCardPaymentPrompt(
  cost: number,
  tags: ReadonlyArray<Tag>,
  inputOptions: Partial<PaymentOptions>,
  lastCardPlayed: CardName | undefined,
  reserveUnits: Readonly<Units> | undefined,
): PaymentPromptLike {
  return {
    amount: cost,
    paymentOptions: projectCardPaymentOptions(tags, inputOptions, lastCardPlayed),
    reserveUnits,
    subtractReserve: true,
  };
}

/**
 * Everything the ALTERNATIVE (non-M€) sources pay in this mix, in M€ —
 * `Σ(used × rate)`. This is the ONE quantity the anti-overpay limit is measured
 * against. M€ is deliberately not part of it: it is the AUTO lane and always
 * settles exactly the remainder, so it can neither overpay nor take room away
 * from an alternative.
 */
export function alternativeContribution(
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
): number {
  return lanes.reduce((sum, lane) => sum + (counts[lane.unit] ?? 0) * lane.rate, 0);
}

/**
 * The anti-overpay CAP of ONE lane — AGGREGATE, never per-row.
 *
 * A lane may only cover what the OTHER alternative sources leave unpaid, so the
 * limit tightens as soon as a second alternative is dialed up. Computing it per
 * row (`ceil(cost / rate)` on its own) let EVERY alternative reach the full
 * price independently: a 12 M€ card accepted 4 steel ×3 AND 3 titanium ×4 and
 * committed 24 for a 12 M€ card, because neither lane could see the other.
 *
 * `ceil` is what leaves room for the LAST unit to cross the price for the first
 * time — an indivisible rate remainder is an unavoidable overpay (3 steel ×3 +
 * 1 titanium ×4 = 13 / 12). A second unit past that crossing is not, and this
 * cap is what makes it unreachable: once the aggregate contribution meets or
 * passes the price, EVERY alternative's cap equals what it already spends.
 */
export function laneCap(
  cost: number,
  lane: PaymentLane,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
): number {
  if (lane.rate <= 0) {
    return lane.available;
  }
  const others = alternativeContribution(lanes.filter((l) => l.unit !== lane.unit), counts);
  return Math.min(lane.available, Math.ceil(Math.max(0, cost - others) / lane.rate));
}

/**
 * The next count of ONE lane after a dial press — THE single place the
 * aggregate limit is enforced, so `RB`/`+`, the keyboard, a fast repeat and
 * `RT МАКС.` all obey it by construction rather than by four host copies of the
 * same clamp. (A row's `canIncrease` paint is the same rule stated visually;
 * a repeat firing twice between two renders never reaches a render.)
 *
 * `max` is «as much of THIS source as is still useful», i.e. the aggregate cap —
 * never «enough to cover the whole price alone». Down is always free: dialing
 * into a shortfall is legal, the verdict says so and the CONFIRM is what blocks.
 */
export function dialLaneCount(
  cost: number,
  lane: PaymentLane,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  step: number | 'max',
): number {
  const cur = counts[lane.unit] ?? 0;
  const cap = laneCap(cost, lane, lanes, counts);
  if (step === 'max') {
    return cap;
  }
  // A «+» may never LOWER the count — at (or past) the limit it is a no-op.
  return step > 0 ? Math.max(cur, Math.min(cap, cur + step)) : Math.max(0, cur + step);
}

/** The AUTO M€ lane: exactly the uncovered remainder, capped by ownership. */
export function autoMegacredits(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
): number {
  return Math.min(mcAvailable, Math.max(0, cost - alternativeContribution(lanes, counts)));
}

/** M€-equivalent of the whole mix (auto M€ included). */
export function paymentTotal(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
): number {
  return alternativeContribution(lanes, counts) + autoMegacredits(cost, lanes, counts, mcAvailable);
}

/**
 * M€-equivalent OVERPAY — how much value above the cost the current mix spends
 * (an unavoidable rate remainder: e.g. an 11 M€ card paid with 6 steel @2 = 12,
 * overpaying 1). 0 when the mix is exact or the cost is not yet covered (M€ is
 * an auto lane, so it never overpays — only rate>1 alt resources can).
 */
export function paymentOverpay(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
): number {
  return Math.max(0, paymentTotal(cost, lanes, counts, mcAvailable) - cost);
}

/** Cost covered AND no lane exceeds ownership (mirrors PaymentFormV2.canSave). */
export function paymentCovers(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
): boolean {
  for (const lane of lanes) {
    if ((counts[lane.unit] ?? 0) > lane.available) {
      return false;
    }
  }
  return paymentTotal(cost, lanes, counts, mcAvailable) >= cost;
}

/** The full Payment payload (byte-parity: every spendable key present). */
export function paymentFromCounts(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
): Payment {
  const payment = {...Payment.EMPTY};
  for (const lane of lanes) {
    payment[lane.unit] = counts[lane.unit] ?? 0;
  }
  payment.megacredits = autoMegacredits(cost, lanes, counts, mcAvailable);
  return payment;
}

/**
 * The opening mix — the SAME optimal default the desktop form starts with
 * (computeDefaultPayment: alternates FIRST in lane order — steel/titanium
 * are useless for anything else, so they're spent before flexible M€ —
 * then M€ tops up the remainder; unavoidable rate-remainder overpay is
 * trimmed by its post-pass).
 */
export function initialCounts(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  mcAvailable: number,
): Partial<Record<SpendableResource, number>> {
  const ledger = newDefaultLedger();
  ledger.megacredits = {available: mcAvailable, rate: 1};
  for (const lane of lanes) {
    ledger[lane.unit] = {available: lane.available, rate: lane.rate, reserved: lane.reserved};
  }
  const order: Array<SpendableResource> = [...lanes.map((l) => l.unit), 'megacredits'];
  const payment = computeDefaultPayment(cost, order, ledger, false);
  const counts: Partial<Record<SpendableResource, number>> = {};
  for (const lane of lanes) {
    counts[lane.unit] = payment[lane.unit];
  }
  return counts;
}

// ── Premium payment PRESENTATION model (ONE model, two densities) ────────────
//
// The SINGLE source of truth for EVERY console-native payment surface — the
// play-card composer, the blue-card action composer, the standalone
// `SelectPayment` task and the colony-trade confirm. Every one of them renders
// `ConsolePaymentPanel` over the `PaymentView` built here, in one of two
// DENSITIES (`compact` summary inside a composer / `expanded` editor behind LT).
// Both densities read the SAME rows, in the SAME order, with the SAME numbers —
// the difference is how much of each row is spelled out and whether a row can be
// dialed by hand. Nothing downstream re-derives payment math: if a number is
// shown anywhere, it comes from a field below.

/**
 * A unit the payment PANEL can present. The M€ ledger's spendables, plus the
 * units a NON-M€-denominated price is stated in: the Delta Works energy fee
 * (Hydronetwork advance / colony trade) is priced and paid in energy, which is
 * deliberately NOT a `SpendableResource` — nothing may ever pay an M€ cost
 * with it, and widening THAT union would widen server validation.
 */
export type PaymentPanelUnit = SpendableResource | 'energy';

/** The i18n key naming a payment unit — shared by every payment surface (the
 *  per-component `laneLabel` copies this table used to drift). */
const PAY_UNIT_LABELS: Readonly<Record<string, string>> = {
  megacredits: 'Megacredits', steel: 'Steel', titanium: 'Titanium',
  plants: 'Plants', energy: 'Energy', heat: 'Heat',
  microbes: 'Microbes', floaters: 'Floaters', seeds: 'Seeds',
  auroraiData: 'Data', graphene: 'Graphene', kuiperAsteroids: 'Asteroids', spireScience: 'Science',
  lunaArchivesScience: 'Science', corruption: 'Corruption',
};

export function paymentUnitLabel(unit: string): string {
  return PAY_UNIT_LABELS[unit] ?? unit;
}

/**
 * The SPRITE key of a payment unit — a `SpendableResource` is the payment
 * LEDGER's name for a source, not the art's name for the thing being spent, so
 * the two must be translated on purpose. `iconClassFor` resolves standard
 * resources by key (`plants` → `resource_icon--plants`) and everything else as
 * `card-resource-<key>`, and those classes are generated SINGULAR from
 * `@card_resource_types` — so `seeds` / `auroraiData` / `kuiperAsteroids` /
 * `spireScience` all resolved to classes no stylesheet defines and rendered an
 * empty box where the resource should be. One table, next to the labels.
 */
const PAY_UNIT_ICONS: Readonly<Record<string, string>> = {
  microbes: 'microbe',
  floaters: 'floater',
  seeds: 'seed',
  auroraiData: 'data',
  kuiperAsteroids: 'asteroid',
  spireScience: 'science',
  lunaArchivesScience: 'science',
};

export function paymentUnitIcon(unit: string): string {
  return PAY_UNIT_ICONS[unit] ?? unit;
}

/**
 * ONE payment SOURCE row — everything both densities need about a single way of
 * paying, so the compact summary and the expanded editor can never disagree
 * about a resource. `available → remaining` is the stock story, `used` is the
 * spend, `contribution` is what that spend is WORTH against the price.
 */
export type PaymentSourceRow = {
  unit: PaymentPanelUnit;
  /** i18n key for the resource name (English text IS the key here). */
  labelKey: string;
  /** M€ bought by ONE unit (1 for M€, `steelValue` for steel, …). */
  rate: number;
  /** Owned before this payment (already net of a subtracted card reserve). */
  available: number;
  /** Units this mix spends. */
  used: number;
  /** `available - used` — what the player keeps. */
  remaining: number;
  /** `used * rate` — this source's share of the price, in M€. */
  contribution: number;
  /** The M€ lane: it always balances to the uncovered remainder, never dialed. */
  auto: boolean;
  /** The player may dial this row by hand (in the EXPANDED editor). */
  editable: boolean;
  /** The card itself needs these units (desktop `reserved` flag — display only). */
  reserved: boolean;
  min: number;
  /** The anti-overpay cap — never more of one unit than covers the whole price. */
  max: number;
  canDecrease: boolean;
  canIncrease: boolean;
  /** This row owns LB/RB on the COMPACT screen (the single-alt quick-adjust). */
  quickAdjust: boolean;
};

/**
 * The payment VERDICT — one element, one geometry, both densities. `short` and
 * `impossible` block the confirm; `overpay` is a warning, never an error.
 */
export type PaymentStatusKind = 'free' | 'exact' | 'overpay' | 'short' | 'impossible';

export type PaymentStatus = {
  kind: PaymentStatusKind;
  /** The price being paid. */
  cost: number;
  /** M€-equivalent actually committed by the current mix. */
  paid: number;
  /** Overpay (kind `overpay`) or shortfall (kind `short`); 0 otherwise. */
  delta: number;
  /** i18n key of the verdict phrase. */
  labelKey: string;
  /** The mix covers the price (the confirm may proceed). */
  ok: boolean;
  /** The unit the price is DENOMINATED in — M€ for a card/project payment
   *  (default), `energy` for the Delta Works energy-equivalent fee. Only the
   *  ledger's icon/aria change; the arithmetic is unit-blind. */
  costUnit?: PaymentPanelUnit;
};

/**
 * The whole payment as a view-model so no UI re-derives the rules: the source
 * rows, the verdict, whether the mix is the player's to shape (`configurable`),
 * whether the simple inline LB/RB quick-adjust applies (`quickAdjustEligible`:
 * EXACTLY one non-M€ lane, with M€ auto-covering the remainder) and whether the
 * expanded editor is a stage worth offering at all (`editorEligible` → LT).
 */
export type PaymentView = {
  cost: number;
  /** Alt lanes in payment order, then the auto M€ lane — ALWAYS last, ALWAYS
   *  present (even at 0 spent), so the row count is fixed for a given prompt and
   *  a changing mix can never resize the panel. */
  rows: ReadonlyArray<PaymentSourceRow>;
  status: PaymentStatus;
  /** Any non-M€ lane → the mix is the player's to shape (inline, or in the
   *  editor). Paint + accessibility; NOT the editor's entry condition. */
  configurable: boolean;
  /** Exactly one non-M€ lane → inline LB/RB quick-adjust on the MAIN screen. */
  quickAdjustEligible: boolean;
  /**
   * TWO OR MORE non-M€ lanes → the expanded editor (LT) is a REAL second stage:
   * a cursor with somewhere to go, and a mix the bumpers cannot express.
   *
   * With exactly ONE alternative the compact summary already IS the editor —
   * same row, same numbers, same captions, and the bumpers (+ RT МАКС.) drive
   * that very lane on the main screen. Offering «Настроить оплату» there
   * advertises a stage that changes nothing: the player presses LT and lands on
   * the same block with a cursor that cannot move. So the entry is not offered
   * (and the hosts refuse to open it) — one flow, no redundant depth.
   */
  editorEligible: boolean;
  quickAdjustUnit: PaymentPanelUnit | undefined;
  paymentValid: boolean;
  /** M€-equivalent shortfall (0 when valid). */
  deficit: number;
  /** M€-equivalent OVERPAY — value spent above the cost (unavoidable rate
   *  remainder; 0 when exact). Mutually exclusive with `deficit`. */
  overpay: number;
  /** The price's denomination (see PaymentStatus.costUnit). Absent = M€. */
  costUnit?: PaymentPanelUnit;
};

/**
 * ONE verdict vocabulary for every density and every payment context: the mix
 * either meets the price exactly, wastes an unavoidable remainder, or does not
 * cover it. Deliberately NOT «оплачено автоматически» when no alternative
 * exists — only the M€ lane is automatic, while the combination the phrase
 * would judge can also hold hand-picked resources; the mix is exact or it is
 * not, and that is the same sentence in the quick summary and in the editor.
 */
function statusOf(args: {
  cost: number, paid: number, valid: boolean, deficit: number, overpay: number,
}): PaymentStatus {
  const {cost, paid, valid, deficit, overpay} = args;
  if (!valid) {
    return deficit > 0 ?
      {kind: 'short', cost, paid, delta: deficit, labelKey: 'Not enough', ok: false} :
      // Covered by value but a lane exceeds what is owned — an impossible mix.
      {kind: 'impossible', cost, paid, delta: 0, labelKey: 'Not enough resources', ok: false};
  }
  if (cost === 0) {
    return {kind: 'free', cost, paid, delta: 0, labelKey: 'Free', ok: true};
  }
  if (overpay > 0) {
    return {kind: 'overpay', cost, paid, delta: overpay, labelKey: 'Overpay', ok: true};
  }
  return {kind: 'exact', cost, paid, delta: 0, labelKey: 'Exact payment', ok: true};
}

export function buildPaymentView(args: {
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
}): PaymentView {
  const {cost, lanes, counts, mcAvailable} = args;
  const mcSpent = autoMegacredits(cost, lanes, counts, mcAvailable);
  const paymentValid = paymentCovers(cost, lanes, counts, mcAvailable);
  const configurable = lanes.length > 0;
  // The 90% case: exactly ONE alt resource, M€ auto-fills the rest.
  const quickAdjustEligible = lanes.length === 1;
  // ...and that case needs no editor: the one lane is dialed in place.
  const editorEligible = lanes.length > 1;
  const quickLane = quickAdjustEligible ? lanes[0] : undefined;

  const rows: Array<PaymentSourceRow> = lanes.map((lane): PaymentSourceRow => {
    const used = counts[lane.unit] ?? 0;
    // AGGREGATE: this lane's ceiling reads what the OTHER alternatives already
    // pay, so «+» dies on every alternative at once the moment the combination
    // meets the price — never once per row.
    const cap = laneCap(cost, lane, lanes, counts);
    return {
      unit: lane.unit,
      labelKey: paymentUnitLabel(lane.unit),
      rate: lane.rate,
      available: lane.available,
      used,
      remaining: Math.max(0, lane.available - used),
      contribution: used * lane.rate,
      auto: false,
      editable: true,
      reserved: lane.reserved,
      min: 0,
      max: cap,
      // Up = more alt (less M€), bounded by the AGGREGATE anti-overpay cap:
      // true exactly while `alternativeContribution < cost` (and the units are
      // owned), so decreasing one source re-opens «+» on all of them.
      canIncrease: used < cap,
      // Down = less alt, all the way to 0: the player may freely dial INTO a
      // shortfall; the verdict says so and blocks the CONFIRM, never the button.
      canDecrease: used > 0,
      quickAdjust: quickLane !== undefined && lane.unit === quickLane.unit,
    };
  });

  // M€ is ALWAYS the last row and ALWAYS rendered — a lane that appears and
  // disappears with the mix was the old source of the modal's height jump.
  rows.push({
    unit: 'megacredits',
    labelKey: paymentUnitLabel('megacredits'),
    rate: 1,
    available: mcAvailable,
    used: mcSpent,
    remaining: Math.max(0, mcAvailable - mcSpent),
    contribution: mcSpent,
    auto: true,
    editable: false,
    reserved: false,
    min: mcSpent,
    max: mcSpent,
    canIncrease: false,
    canDecrease: false,
    quickAdjust: false,
  });

  const paid = paymentTotal(cost, lanes, counts, mcAvailable);
  const deficit = Math.max(0, cost - paid);
  const overpay = paymentOverpay(cost, lanes, counts, mcAvailable);
  return {
    cost,
    rows,
    status: statusOf({cost, paid, valid: paymentValid, deficit, overpay}),
    configurable,
    quickAdjustEligible,
    editorEligible,
    quickAdjustUnit: quickLane?.unit,
    paymentValid,
    deficit,
    overpay,
  };
}

// ── The ENERGY-EQUIVALENT mix (Delta Works: 1 steel = 1 energy) ──────────────
//
// The Hydronetwork advance and the colony trade's energy family charge a price
// DENOMINATED IN ENERGY, and Delta Works lets steel substitute 1:1. That is
// the M€ panel's shape with the units renamed: steel is the one dialable
// alternative lane, ENERGY is the auto lane that always settles the remainder
// — so both surfaces render the ordinary ConsolePaymentPanel over the ordinary
// PaymentView, and no second arithmetic exists.
//
// The draft is ONE number (the steel share; energy is the remainder by
// construction, so the total can never disagree with the price) and its legal
// range comes from the SERVER's own payment model (the colony preview's
// `energyMix`, the hydro preview's budget fields) — this builder never
// re-derives eligibility, it only presents the numbers it is handed.

export type EnergyMixArgs = {
  /** The energy-equivalent price (discounts applied — the server's number). */
  cost: number;
  /** Live energy stock. */
  energyAvailable: number;
  /** Steel usable 1:1 (Delta Works in the tableau; 0 = no substitution). */
  steelAvailable: number;
  /** Server-model bounds of the steel share (minSteel = the energy deficit). */
  minSteel: number;
  maxSteel: number;
  /** The CANONICAL draft: the dialed steel share, already clamped by the host
   *  to [minSteel, maxSteel]. Everything below derives from this one value. */
  steelUsed: number;
};

/**
 * ONE clamp for the dialed steel share — both hosts route their preference
 * through this instead of keeping a private copy of the bounds arithmetic.
 * An unaffordable price (minSteel > maxSteel) clamps to the maximum usable
 * steel: the draft stays showable, the verdict says «Не хватает».
 */
export function clampEnergyMixSteel(preferred: number, bounds: {minSteel: number, maxSteel: number}): number {
  if (bounds.minSteel > bounds.maxSteel) {
    return bounds.maxSteel;
  }
  return Math.max(bounds.minSteel, Math.min(preferred, bounds.maxSteel));
}

/**
 * The energy-equivalent price as the SHARED PaymentView: a dialable steel lane
 * (present only while the substitution is live) + the auto energy lane that
 * tops up the remainder. Rate is 1:1 BY RULE (the printed effect), never
 * `steelValue` — Delta Works substitutes, it does not convert.
 *
 * With `steelAvailable === 0` the view is the read-only energy-only price
 * (one row, no controls) — the same panel a player without the card reads,
 * so «single allocation» and «adjustable» are states of one surface, never
 * two designs.
 */
export function buildEnergyMixView(args: EnergyMixArgs): PaymentView {
  const {cost, energyAvailable, steelAvailable} = args;
  const steelLaneExists = steelAvailable > 0;
  const steelUsed = steelLaneExists ? clampEnergyMixSteel(args.steelUsed, args) : 0;
  // The energy share is the remainder; when the combined pool cannot cover
  // the price the lane honestly empties the stock and the verdict blocks.
  const energyUsed = Math.min(Math.max(0, cost - steelUsed), energyAvailable);
  const paid = energyUsed + steelUsed;
  const deficit = Math.max(0, cost - paid);
  const adjustable = steelLaneExists && args.maxSteel > args.minSteel;

  const rows: Array<PaymentSourceRow> = [];
  if (steelLaneExists) {
    rows.push({
      unit: 'steel',
      labelKey: paymentUnitLabel('steel'),
      rate: 1,
      available: steelAvailable,
      used: steelUsed,
      remaining: Math.max(0, steelAvailable - steelUsed),
      contribution: steelUsed,
      auto: false,
      editable: adjustable,
      reserved: false,
      min: args.minSteel,
      max: args.maxSteel,
      canIncrease: adjustable && steelUsed < args.maxSteel,
      canDecrease: adjustable && steelUsed > args.minSteel,
      quickAdjust: adjustable,
    });
  }
  rows.push({
    unit: 'energy',
    labelKey: paymentUnitLabel('energy'),
    rate: 1,
    available: energyAvailable,
    used: energyUsed,
    remaining: Math.max(0, energyAvailable - energyUsed),
    contribution: energyUsed,
    // Energy is the AUTO lane only while steel actually shares the bill —
    // alone it is simply the price, not a lane «topping up» anything.
    auto: steelLaneExists,
    editable: false,
    reserved: false,
    min: energyUsed,
    max: energyUsed,
    canIncrease: false,
    canDecrease: false,
    quickAdjust: false,
  });

  // Rate 1:1 on both lanes ⇒ overpay is unreachable; the verdict is exact,
  // free, or an honest shortfall naming the missing amount.
  const status = statusOf({cost, paid, valid: deficit === 0, deficit, overpay: 0});
  status.costUnit = 'energy';
  return {
    cost,
    rows,
    status,
    configurable: adjustable,
    quickAdjustEligible: adjustable,
    // The compact block IS the whole editor here (one dialable lane) — LT
    // must never advertise a second stage.
    editorEligible: false,
    quickAdjustUnit: adjustable ? 'steel' : undefined,
    paymentValid: deficit === 0,
    deficit,
    overpay: 0,
    costUnit: 'energy',
  };
}

/** The row LB/RB act on in the compact summary (the single-alt quick lane). */
export function quickAdjustRow(view: PaymentView): PaymentSourceRow | undefined {
  return view.quickAdjustEligible ? view.rows.find((r) => r.quickAdjust) : undefined;
}

/** The EDITABLE rows, in panel order — the expanded editor's focus ring. */
export function editableRows(view: PaymentView): ReadonlyArray<PaymentSourceRow> {
  return view.rows.filter((r) => r.editable);
}
