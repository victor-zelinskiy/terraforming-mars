/*
 * PURE payment-lane math for the console-native payment task — CTS T3
 * (CONSOLE_MODE_CONCEPT.md §CTS-3). Reuses the EXACT desktop rate/available
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
