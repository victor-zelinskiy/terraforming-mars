/*
 * CONVERSION PROMPT — the pure view-model behind the console's premium
 * "convert X of FROM into TO" amount prompt (Supercapacitors' optional
 * production-phase energy→heat conversion is the reference case).
 *
 * WHY THIS EXISTS. A `SelectAmount` carrying the server's `conversion` hint is
 * not a bare number: it is ONE operation with two visible sides (spend / gain),
 * and the prompt's whole job is a deliberate choice plus an honest
 * `current → resulting` preview of both sides BEFORE commit. This module owns
 * every derived fact of that composition so the host component renders and the
 * spec asserts the SAME numbers:
 *   - both sides' `current → after` + signed delta for the dialed value;
 *   - the NEUTRAL state (value 0 → no deltas, no positive/negative accents);
 *   - the BINARY presentation (a 0..1 range is a choice, not a dial — the
 *     console's «THE INSTRUMENT FOLLOWS THE BUDGET» rule);
 *   - the commit verb («Не преобразовывать» / «Преобразовать N») so a zero
 *     commit is a stated refusal, never a generic «ОК»;
 *   - the compact headline for the known conversion shapes.
 *
 * The preview NEVER re-implements game rules: `after = current ± value×ratio`
 * mirrors exactly what the server's own `andThen` applies (`energy -= amount;
 * heat += amount`), reading `current` off the live public player model — the
 * same one-source rule ModernAmountSelector's conversion preview follows.
 *
 * PURITY: no Vue, no DOM, no i18n — emits English i18n KEYS; the view
 * translates (`translateText` / `translateTextWithParams`).
 */

import {SelectAmountModel, AmountConversionModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';

/** One side of the conversion, resolved for the dialed value. */
export type ConversionSideVm = {
  /** Icon key ('energy' / 'heat' / …) — rendered via the shared resource_icon. */
  icon: string;
  /** The resource's display-name i18n KEY ('' when not a standard resource). */
  labelKey: string;
  /** The side reads the player's PRODUCTION figure, not the stock. */
  production: boolean;
  /** The viewer's live figure — undefined for a non-standard resource. */
  current: number | undefined;
  /** `current ± value×ratio` — what the server's own callback will apply. */
  after: number | undefined;
  /** Signed change for the dialed value (spend < 0, gain > 0). */
  delta: number;
};

export type ConversionPromptVm = {
  /**
   * Compact headline KEY for a recognised conversion shape («Преобразование
   * энергии»). Undefined → the host keeps the server title as the headline
   * (an unrecognised conversion still gets the full preview composition).
   */
  headlineKey: string | undefined;
  from: ConversionSideVm;
  to: ConversionSideVm;
  /** value === 0 — both sides unchanged: calm preview, no gain/loss accents. */
  neutral: boolean;
  /**
   * A 0..1 range renders as a BINARY CHOICE (two plates), not a stepper —
   * counting a dial to 1 past four verbs is the legacy shape this replaces.
   */
  binary: boolean;
  min: number;
  max: number;
  value: number;
};

/** Display-name keys for the standard resources (existing i18n keys). */
const RESOURCE_LABEL_KEY: Record<string, string> = {
  megacredits: 'M€', steel: 'Steel', titanium: 'Titanium',
  plants: 'Plants', energy: 'Energy', heat: 'Heat',
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
  player: PublicPlayerModel | undefined,
  icon: string,
  scope: 'stock' | 'production',
  delta: number,
): ConversionSideVm {
  const current = playerResourceValue(player, icon, scope);
  return {
    icon,
    labelKey: RESOURCE_LABEL_KEY[icon] ?? '',
    production: scope === 'production',
    current,
    after: current === undefined ? undefined : current + delta,
    delta,
  };
}

/**
 * Resolve the premium conversion composition for a SelectAmount, or undefined
 * when the model carries no `conversion` hint (→ the generic stepper).
 */
export function conversionPromptVm(
  model: SelectAmountModel | undefined,
  player: PublicPlayerModel | undefined,
  value: number,
): ConversionPromptVm | undefined {
  const conversion = model?.conversion;
  if (model === undefined || conversion === undefined) {
    return undefined;
  }
  const clamped = Math.min(model.max, Math.max(model.min, value));
  const gained = clamped * (conversion.ratio ?? 1);
  const spent = clamped === 0 ? 0 : -clamped; // normalize -0 away
  return {
    headlineKey: conversionHeadlineKey(conversion),
    from: side(player, conversion.from, conversion.fromScope ?? 'stock', spent),
    to: side(player, conversion.to, conversion.toScope ?? 'stock', gained),
    neutral: clamped === 0,
    binary: model.min === 0 && model.max === 1,
    min: model.min,
    max: model.max,
    value: clamped,
  };
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
