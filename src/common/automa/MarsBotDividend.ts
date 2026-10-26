import {MarsBotCorpId} from './AutomaTypes';
import type {BonusCardEffectLine} from './BonusCardData';

/**
 * MarsBot «ПОРТФЕЛЬ И ДИВИДЕНДЫ» — the campaign answer to the humans' three
 * corporations (docs/claude/prompts/marsbot-portfolio-dividends.md).
 *
 * In a campaign the bot acquires corporations alongside the humans (missions
 * 2 and 3), but only its PRIMARY corporation runs the printed boxes. Every
 * further corporation is a HOLDING: its boxes are switched off and it pays ONE
 * DIVIDEND — victory points computed at the end of the game from what the bot
 * has ALREADY accumulated (its played pile, its tracks, its tiles, its
 * colonies). A dividend never moves a track, places a tile, raises a
 * parameter, gains M€ or changes a single decision of the bot, so the pace of
 * terraforming cannot change by construction; it is zero early and grows with
 * the game.
 *
 * This file holds the SHARED shapes: the printed box (`MarsBotDividendInfo`,
 * one per corporation in `CORP_INFO`, its numbers the ONE source the server
 * clause reads) and the live answer (`MarsBotDividendResult`, the formula as
 * terms the score explorer prints).
 */

/**
 * One operand of a dividend's formula, with the VP it pays. Shapes:
 *  · per unit  — `vp = floor(count × each / per)` (`per` absent = 1);
 *  · a bonus   — `vp = count >= threshold ? each : 0`.
 * Σ terms.vp === the result's vp, by construction of `dividendResult`.
 */
export type MarsBotDividendTerm = {
  /** English i18n key naming what is counted («Greenery tiles of MarsBot»). */
  label: string;
  /** How many were counted — the live operand. */
  count: number;
  /** VP this term pays. */
  vp: number;
  /** The printed rate: VP per `per` units (or the bonus, with `threshold`). */
  each: number;
  /** Units per `each` VP (absent = 1). */
  per?: number;
  /** A bonus term: `each` VP once `count` reaches this. */
  threshold?: number;
  /** A ceiling the printed box names («at most N VP»). */
  cap?: number;
};

export type MarsBotDividendResult = {
  vp: number;
  terms: ReadonlyArray<MarsBotDividendTerm>;
};

/** One holding's dividend in the bot's VP breakdown. */
export type MarsBotDividendDetail = MarsBotDividendResult & {
  corporation: MarsBotCorpId;
};

/**
 * The printed «ДИВИДЕНДЫ» box of a MarsBot corporation — a fork addition on
 * every card (the box works only while the corporation is a HOLDING). `rates`
 * are the printed numbers: the server clause reads them, the box prints them,
 * so the two can never disagree.
 */
export type MarsBotDividendInfo = {
  /** The dividend's own name (English i18n key) — «Green Belt». */
  name: string;
  rates: Readonly<Record<string, number>>;
  lines: ReadonlyArray<BonusCardEffectLine>;
};

type DividendLine = {text: string, params?: ReadonlyArray<number>, muted?: boolean};

/** Build a box whose printed params are taken from its own `rates`. */
export function dividendBox<R extends Record<string, number>>(
  name: string,
  rates: R,
  lines: (r: R) => ReadonlyArray<DividendLine>,
): MarsBotDividendInfo & {rates: R} {
  return {
    name,
    rates,
    lines: lines(rates).map((line) => ({
      icon: 'vp',
      text: line.text,
      ...(line.params !== undefined ? {params: line.params.map(String)} : {}),
      ...(line.muted === true ? {muted: true} : {}),
    })),
  };
}

/** A per-unit term: `floor(count × each / per)`. */
export function perUnitTerm(label: string, count: number, each: number, per: number = 1): MarsBotDividendTerm {
  const safe = Math.max(0, count);
  return {
    label,
    count: safe,
    vp: Math.floor(safe * each / per),
    each,
    ...(per !== 1 ? {per} : {}),
  };
}

/** A threshold bonus: `each` VP once `count` reaches `threshold`. */
export function bonusTerm(label: string, count: number, threshold: number, each: number): MarsBotDividendTerm {
  return {label, count: Math.max(0, count), vp: count >= threshold ? each : 0, each, threshold};
}

/** Sum the terms (dropping nothing — a zero term still explains a zero). */
export function dividendResult(terms: ReadonlyArray<MarsBotDividendTerm>, cap?: number): MarsBotDividendResult {
  const raw = terms.reduce((sum, t) => sum + t.vp, 0);
  if (cap === undefined || raw <= cap) {
    return {vp: raw, terms};
  }
  // A capped box: the LAST term absorbs the cut, so Σ terms.vp === vp still holds.
  const cut = raw - cap;
  const last = terms[terms.length - 1];
  return {
    vp: cap,
    terms: [...terms.slice(0, -1), {...last, vp: last.vp - cut, cap}],
  };
}

/**
 * THE ONE READING of a term's formula — an i18n template + its params — for
 * every surface that explains a dividend (the score explorer, the bot screen).
 * Numbers only; the operand's NAME is the term's own `label`.
 */
export function dividendTermFormula(term: MarsBotDividendTerm): {label: string, params: ReadonlyArray<number>} {
  if (term.threshold !== undefined) {
    return {label: '${0} of ${1} for +${2} VP', params: [term.count, term.threshold, term.each]};
  }
  if (term.cap !== undefined) {
    return {label: '${0} × ${1} VP, at most ${2}', params: [term.count, term.each, term.cap]};
  }
  if (term.per !== undefined && term.per !== 1) {
    return {label: '${0} ÷ ${1} × ${2} VP', params: [term.count, term.per, term.each]};
  }
  return {label: '${0} × ${1} VP', params: [term.count, term.each]};
}

/** The empty answer (no holdings, a legacy save). */
export const NO_DIVIDEND: MarsBotDividendResult = {vp: 0, terms: []};
