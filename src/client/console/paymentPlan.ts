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

function rateFor(unit: SpendableResource, player: PublicPlayerModel, options: Partial<PaymentOptions>): number {
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

/** Never dial more of one unit than covers the WHOLE cost (anti-overpay cap). */
export function laneCap(cost: number, lane: PaymentLane): number {
  if (lane.rate <= 0) {
    return lane.available;
  }
  return Math.min(lane.available, Math.ceil(cost / lane.rate));
}

function nonMcSpend(lanes: ReadonlyArray<PaymentLane>, counts: Partial<Record<SpendableResource, number>>): number {
  return lanes.reduce((sum, lane) => sum + (counts[lane.unit] ?? 0) * lane.rate, 0);
}

/** The AUTO M€ lane: exactly the uncovered remainder, capped by ownership. */
export function autoMegacredits(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
): number {
  return Math.min(mcAvailable, Math.max(0, cost - nonMcSpend(lanes, counts)));
}

/** M€-equivalent of the whole mix (auto M€ included). */
export function paymentTotal(
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
): number {
  return nonMcSpend(lanes, counts) + autoMegacredits(cost, lanes, counts, mcAvailable);
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
 * ONE payment SOURCE row — everything both densities need about a single way of
 * paying, so the compact summary and the expanded editor can never disagree
 * about a resource. `available → remaining` is the stock story, `used` is the
 * spend, `contribution` is what that spend is WORTH against the price.
 */
export type PaymentSourceRow = {
  unit: SpendableResource;
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
export type PaymentStatusKind = 'free' | 'auto' | 'exact' | 'overpay' | 'short' | 'impossible';

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
};

/**
 * The whole payment as a view-model so no UI re-derives the rules: the source
 * rows, the verdict, whether a detailed editor exists (`configurable` → LT), and
 * whether the simple inline LB/RB quick-adjust applies (`quickAdjustEligible`:
 * EXACTLY one non-M€ lane, with M€ auto-covering the remainder).
 */
export type PaymentView = {
  cost: number;
  /** Alt lanes in payment order, then the auto M€ lane — ALWAYS last, ALWAYS
   *  present (even at 0 spent), so the row count is fixed for a given prompt and
   *  a changing mix can never resize the panel. */
  rows: ReadonlyArray<PaymentSourceRow>;
  status: PaymentStatus;
  /** Any non-M€ lane → the expanded payment editor (LT) is available. */
  configurable: boolean;
  /** Exactly one non-M€ lane → inline LB/RB quick-adjust on the MAIN screen. */
  quickAdjustEligible: boolean;
  quickAdjustUnit: SpendableResource | undefined;
  paymentValid: boolean;
  /** M€-equivalent shortfall (0 when valid). */
  deficit: number;
  /** M€-equivalent OVERPAY — value spent above the cost (unavoidable rate
   *  remainder; 0 when exact). Mutually exclusive with `deficit`. */
  overpay: number;
};

function statusOf(args: {
  cost: number, paid: number, valid: boolean, deficit: number, overpay: number, laneCount: number,
}): PaymentStatus {
  const {cost, paid, valid, deficit, overpay, laneCount} = args;
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
  // No alternative source exists at all — the price is simply debited in M€.
  if (laneCount === 0) {
    return {kind: 'auto', cost, paid, delta: 0, labelKey: 'Paid automatically', ok: true};
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
  const quickLane = quickAdjustEligible ? lanes[0] : undefined;

  const rows: Array<PaymentSourceRow> = lanes.map((lane): PaymentSourceRow => {
    const used = counts[lane.unit] ?? 0;
    const cap = laneCap(cost, lane);
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
      // Up = more alt (less M€), bounded by the anti-overpay cap.
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
    status: statusOf({cost, paid, valid: paymentValid, deficit, overpay, laneCount: lanes.length}),
    configurable,
    quickAdjustEligible,
    quickAdjustUnit: quickLane?.unit,
    paymentValid,
    deficit,
    overpay,
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
