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
import {ActionEffect} from '@/common/models/ActionPreviewModel';
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

// ── Premium payment VIEW-MODEL (unified chips + inline quick-adjust) ──────────
//
// The SINGLE source of truth for the console-native premium payment PANEL —
// shared by BOTH the play-card composer (ConsolePlayCardConfirm) and the
// blue-card action composer (ConsoleActionComposer), so the two flows speak the
// exact same premium language (icon chips with «было → стало», an «авто» M€
// lane, inline LB/RB quick-adjust for the single-alt case, LT for the detailed
// editor). It lives HERE (not in either composer) precisely so neither owns it
// and they can't diverge — the component only renders it, every rule is below.

const STANDARD_PAY_UNITS: ReadonlySet<string> =
  new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);

/** One payment chip = an `ActionEffect` (icon + spent + было → стало) + the
 *  quick-adjust metadata the UI needs, all derived from the payment logic. */
export type PaymentResourceChip = {
  /** The visual — the SAME chip the result uses (rendered by ActionEffectChip). */
  effect: ActionEffect;
  /** The M€ lane — auto-balances to the remainder (badge «авто»). */
  isAutoBalanced: boolean;
  /** The single quick-adjust alt resource — LB/RB pills live on this chip. */
  isAdjustable: boolean;
  /** LB is live (the alt resource can go down AND M€ still covers the remainder). */
  canDecrease: boolean;
  /** RB is live (the alt resource can go up within its cap). */
  canIncrease: boolean;
};

/**
 * The whole payment as a view-model so the UI never re-derives the rules: the
 * chip list, whether a detailed editor exists (`configurable` → LT), and
 * whether the simple inline LB/RB quick-adjust applies (`quickAdjustEligible`:
 * EXACTLY one non-M€ lane, with M€ auto-covering the remainder). All amounts /
 * caps / coverage come from the lane math above.
 */
export type PlayPaymentView = {
  totalCost: number;
  chips: ReadonlyArray<PaymentResourceChip>;
  /** Any non-M€ lane → the detailed payment editor (LT) is available. */
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

export function payChipEffect(unit: string, spent: number, stock: Partial<Record<string, number>>): ActionEffect {
  const cur = STANDARD_PAY_UNITS.has(unit) ? stock[unit] : undefined;
  if (cur !== undefined) {
    return {direction: 'cost', icon: unit, amount: spent, current: cur, resulting: Math.max(0, cur - spent)};
  }
  return {direction: 'cost', icon: unit, amount: spent};
}

export function buildPaymentView(args: {
  cost: number,
  lanes: ReadonlyArray<PaymentLane>,
  counts: Partial<Record<SpendableResource, number>>,
  mcAvailable: number,
  /** Current stock per unit (megacredits/steel/titanium/plants/energy/heat). */
  stock: Partial<Record<string, number>>,
}): PlayPaymentView {
  const {cost, lanes, counts, mcAvailable, stock} = args;
  const mcSpent = autoMegacredits(cost, lanes, counts, mcAvailable);
  const paymentValid = paymentCovers(cost, lanes, counts, mcAvailable);
  const configurable = lanes.length > 0;
  // The 90% case: exactly ONE alt resource, M€ auto-fills the rest.
  const quickAdjustEligible = lanes.length === 1;
  const quickLane = quickAdjustEligible ? lanes[0] : undefined;

  const mcChip: PaymentResourceChip = {
    effect: payChipEffect('megacredits', mcSpent, stock),
    isAutoBalanced: true, isAdjustable: false, canDecrease: false, canIncrease: false,
  };
  const laneChip = (lane: PaymentLane): PaymentResourceChip => {
    const n = counts[lane.unit] ?? 0;
    const adjustable = quickLane !== undefined && lane.unit === quickLane.unit;
    const cap = laneCap(cost, lane);
    return {
      effect: payChipEffect(lane.unit, n, stock),
      isAutoBalanced: false,
      isAdjustable: adjustable,
      // Up = more alt (less M€), bounded by the anti-overpay cap.
      canIncrease: adjustable && n < cap,
      // Down = less alt, all the way to 0 — PARITY with the detailed lanes editor
      // (adjustLane), which clamps at 0 and freely lets the player dial DOWN into an
      // underpayment; the resulting shortfall is surfaced (deficit / «Not enough
      // resources») and blocks the CONFIRM, never the button. Quick-adjust must not
      // be stricter than the LT editor — an M€-coverage guard here made LB dead the
      // moment the mix reached the exact cost, which read as broken.
      canDecrease: adjustable && n > 0,
    };
  };

  // Layout: quick-adjust → the adjustable alt FIRST (LB/RB read on top), then M€.
  // Else → M€ first (when spent), then each spent lane. A 0-spend non-adjustable
  // lane is noise and omitted; the adjustable lane is ALWAYS shown (its pills live there).
  let chips: Array<PaymentResourceChip>;
  if (quickAdjustEligible) {
    chips = mcSpent > 0 ? [laneChip(lanes[0]), mcChip] : [laneChip(lanes[0])];
  } else if (lanes.length === 0) {
    chips = [mcChip];
  } else {
    chips = mcSpent > 0 ? [mcChip] : [];
    for (const lane of lanes) {
      if ((counts[lane.unit] ?? 0) > 0) {
        chips.push(laneChip(lane));
      }
    }
  }

  const deficit = Math.max(0, cost - paymentTotal(cost, lanes, counts, mcAvailable));
  const overpay = paymentOverpay(cost, lanes, counts, mcAvailable);
  return {totalCost: cost, chips, configurable, quickAdjustEligible, quickAdjustUnit: quickLane?.unit, paymentValid, deficit, overpay};
}
