/*
 * AMOUNT OPERATION — the pure view-model behind the console's premium
 * "spend X of FROM, receive Y of TO" amount presentation. Supercapacitors'
 * optional production-phase energy→heat conversion is the reference case; the
 * SAME composition serves every operation-shaped `SelectAmount` the server
 * marks with a hint:
 *   - `conversion` — energy→heat (Supercapacitors), heat prod→M€ prod (Insulation);
 *   - `amountResult` — spend the dialed icon, receive result×perUnit (Power
 *     Infrastructure, Hi-Tech Lab / Tycho Magnetics, Sulphur Eating Bacteria,
 *     Titan Shuttles);
 *   - `amountCost` — the dial counts the thing GAINED, paid per unit from
 *     another pool (Energy Market's 2 M€ per energy).
 *
 * WHY THIS EXISTS. A marked `SelectAmount` is not a bare number: it is ONE
 * operation with two visible sides, and the presentation's whole job is a
 * deliberate choice plus an honest `current → after` preview of both sides
 * BEFORE commit. This module owns every derived fact of that composition so
 * the surfaces (the task host's standalone prompt AND the two composers'
 * amount rows) render and the spec asserts the SAME numbers:
 *   - both sides' `current → after` + signed delta for the dialed value;
 *   - the NEUTRAL state (value 0 → no deltas, no positive/negative accents);
 *   - the BINARY presentation (a refusable 0..1 conversion is a choice, not a
 *     dial — the console's «THE INSTRUMENT FOLLOWS THE BUDGET» rule);
 *   - the commit verb for a conversion («Не преобразовывать» / «Преобразовать
 *     N») so a zero commit is a stated refusal, never a generic «ОК»;
 *   - the compact headline for the known conversion shapes.
 *
 * The preview NEVER re-implements game rules: `after = current ± value×rate`
 * mirrors exactly what the server's own `andThen` applies, reading `current`
 * through the caller's POOL READER — the composers pass their `poolOf` (which
 * also knows the source card's own floaters/microbes), the standalone host
 * passes the public-player read. One derivation, three surfaces.
 *
 * PURITY: no Vue, no DOM, no i18n — emits English i18n KEYS; the view
 * translates (`translateText` / `translateTextWithParams`).
 */

import {SelectAmountModel, AmountConversionModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';

/** One side of the operation, resolved for the dialed value. */
export type ConversionSideVm = {
  /** Icon key ('energy' / 'heat' / …) — rendered via the shared resource_icon. */
  icon: string;
  /** The side's display-name i18n KEY ('' when nothing honest exists). */
  labelKey: string;
  /** The side reads the player's PRODUCTION figure, not the stock. */
  production: boolean;
  /** The live figure the caller's pool reader resolved — undefined = none. */
  current: number | undefined;
  /** `current ± value×rate` — what the server's own callback will apply. */
  after: number | undefined;
  /** Signed change for the dialed value (spend < 0, gain > 0). */
  delta: number;
};

export type ConversionPromptVm = {
  /** Which server hint produced this operation (drives the commit-verb copy). */
  kind: 'conversion' | 'result' | 'cost';
  /**
   * Compact headline KEY for a recognised conversion shape («Преобразование
   * энергии»). Undefined → the host keeps the server title as the headline
   * (an unrecognised operation still gets the full preview composition).
   */
  headlineKey: string | undefined;
  from: ConversionSideVm;
  to: ConversionSideVm;
  /** value === 0 — both sides unchanged: calm preview, no gain/loss accents. */
  neutral: boolean;
  /**
   * A refusable 0..1 CONVERSION renders as a BINARY CHOICE (two plates), not
   * a stepper — counting a dial to 1 past four verbs is the legacy shape this
   * replaces. Spend-shaped operations (min 1) never qualify.
   */
  binary: boolean;
  min: number;
  max: number;
  value: number;
};

/**
 * The caller's answer to «what is the CURRENT value of this pool?».
 * `undefined` = no single honest figure (the preview degrades to the delta).
 * The composers pass their `poolOf` (standard resources + the source card's
 * own stored resources); the standalone host passes the public-player read.
 */
export type PoolReader = (icon: string, scope: 'stock' | 'production') => number | undefined;

/** Display-name keys for the sides (existing i18n keys). */
const RESOURCE_LABEL_KEY: Record<string, string> = {
  megacredits: 'M€', steel: 'Steel', titanium: 'Titanium',
  plants: 'Plants', energy: 'Energy', heat: 'Heat',
  floater: 'Floaters', microbe: 'Microbes', cards: 'Cards',
};

/**
 * The short headline for a conversion the console recognises. Structural (the
 * hint's own fields) — NEVER the prompt title (cross-cutting invariant 1).
 */
export function conversionHeadlineKey(conversion: AmountConversionModel): string | undefined {
  const fromScope = conversion.fromScope ?? 'stock';
  const toScope = conversion.toScope ?? 'stock';
  if (conversion.from === 'energy' && conversion.to === 'heat' && fromScope === 'stock' && toScope === 'stock') {
    return 'Energy conversion';
  }
  return undefined;
}

function side(
  pool: PoolReader,
  icon: string,
  scope: 'stock' | 'production',
  delta: number,
  labelKey?: string,
): ConversionSideVm {
  const current = pool(icon, scope);
  return {
    icon,
    labelKey: labelKey ?? RESOURCE_LABEL_KEY[icon] ?? '',
    production: scope === 'production',
    current,
    after: current === undefined ? undefined : current + delta,
    delta,
  };
}

/**
 * Resolve the premium two-sided composition for an operation-shaped
 * SelectAmount, or undefined when the model carries none of the three hints
 * (→ the generic dial keeps the prompt).
 */
export function amountOperationVm(
  model: SelectAmountModel | undefined,
  value: number,
  pool: PoolReader,
): ConversionPromptVm | undefined {
  if (model === undefined) {
    return undefined;
  }
  const clamped = Math.min(model.max, Math.max(model.min, value));
  const spent = clamped === 0 ? 0 : -clamped; // normalize -0 away
  const base = {
    headlineKey: undefined as string | undefined,
    neutral: clamped === 0,
    binary: false,
    min: model.min,
    max: model.max,
    value: clamped,
  };

  const conversion = model.conversion;
  if (conversion !== undefined) {
    const gained = clamped * (conversion.ratio ?? 1);
    return {
      ...base,
      kind: 'conversion',
      headlineKey: conversionHeadlineKey(conversion),
      // A refusable one-unit conversion is a CHOICE, not a dial.
      binary: model.min === 0 && model.max === 1,
      from: side(pool, conversion.from, conversion.fromScope ?? 'stock', spent),
      to: side(pool, conversion.to, conversion.toScope ?? 'stock', gained),
    };
  }

  const result = model.amountResult;
  if (result !== undefined && model.icon !== undefined) {
    // Spend the dialed icon (stock / the source card's own store), receive
    // result×perUnit — Power Infrastructure, Hi-Tech Lab, Sulphur, Titan
    // Shuttles. The receiving side prefers the server's own label («Cards
    // drawn») over the plain resource name.
    const gained = clamped * (result.perUnit ?? 1);
    return {
      ...base,
      kind: 'result',
      from: side(pool, model.icon, 'stock', spent),
      to: side(pool, result.icon, 'stock', gained, result.label ?? undefined),
    };
  }

  const cost = model.amountCost;
  if (cost !== undefined && model.icon !== undefined) {
    // The dial counts the thing GAINED; the price leaves another pool
    // (Energy Market: 2 M€ per energy).
    const priced = clamped === 0 ? 0 : -clamped * (cost.perUnit ?? 1);
    return {
      ...base,
      kind: 'cost',
      from: side(pool, cost.icon, cost.scope ?? 'stock', priced),
      to: side(pool, model.icon, 'stock', clamped),
    };
  }

  return undefined;
}

/**
 * The standalone host's spelling — pools read off the public player model
 * (standard resources only; a card-stored pool has no figure there).
 */
export function conversionPromptVm(
  model: SelectAmountModel | undefined,
  player: PublicPlayerModel | undefined,
  value: number,
): ConversionPromptVm | undefined {
  return amountOperationVm(model, value, (icon, scope) => playerResourceValue(player, icon, scope));
}

/**
 * The commit verb for the dialed value — a ZERO commit is a stated refusal
 * («НЕ ПРЕОБРАЗОВЫВАТЬ»), never a generic «ОК». The view translates:
 * `translateTextWithParams(key, params)`.
 */
export function conversionCommitLabel(value: number): {key: string, params: Array<string>} {
  return value === 0 ?
    {key: 'Do not convert', params: []} :
    {key: 'Convert ${0}', params: [String(value)]};
}
