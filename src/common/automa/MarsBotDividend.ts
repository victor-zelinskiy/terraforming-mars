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
  /** The box's two GOALS — the rare great game of this very corporation (`withDividendGoal`). */
  goal: MarsBotDividendGoal;
};

/**
 * THE TWO GOALS of a dividend (the owner, 2026-10-27: «иногда реально 70+ —
 * два бонусных порога, уникальные, достижимые, но редкие, не теоретические»).
 * Measured on the operand of ONE term of the clause's own formula (`term` —
 * its `count`, so the goal speaks the line it is printed under), paying `vp`
 * once the count reaches `at` and `vp2` MORE at `at2`. Never under the box's
 * printed cap (a cap ends the formula; a goal stands beside it). The numbers
 * are calibrated on the owner's real games — the first reached in about a
 * fifth of them, the second in about one in twenty, and EVERY one reached in
 * real play (`docs/claude/marsbot-dividends-calibration.md` § ЦЕЛИ).
 */
export type MarsBotDividendGoal = {
  term: number;
  at: number;
  at2: number;
  vp: number;
  vp2: number;
};

type DividendLine = {text: string, params?: ReadonlyArray<number>, muted?: boolean};

/** The printed goal line — under the line of the operand it measures. */
export const DIVIDEND_GOAL_LINE = 'Goal: ${0} or more — +${1} VP; ${2} or more — +${3} VP more';

/** A box's goals: the two thresholds on the operand of term `term` (default the first), +10 / +15 VP by default. */
export function dividendGoal(at: number, at2: number, opts: {term?: number, vp?: number, vp2?: number} = {}): MarsBotDividendGoal {
  return {term: opts.term ?? 0, at, at2, vp: opts.vp ?? 10, vp2: opts.vp2 ?? 15};
}

/**
 * Build a box whose printed params are taken from its own `rates`. The goal's
 * numbers JOIN the rates (`goalAt` · `goalAt2` · `goalVp` · `goalVp2`), so a
 * printed number stays a rate and the paid number stays the printed one.
 */
export function dividendBox<R extends Record<string, number>>(
  name: string,
  rates: R,
  lines: (r: R) => ReadonlyArray<DividendLine>,
  goal: MarsBotDividendGoal,
): MarsBotDividendInfo & {rates: R} {
  const printed = [...lines(rates)];
  const goalLine: DividendLine = {text: DIVIDEND_GOAL_LINE, params: [goal.at, goal.vp, goal.at2, goal.vp2]};
  // Under the measured line and the quiet notes that qualify it.
  let at = Math.min(goal.term + 1, printed.length);
  while (at < printed.length && printed[at].muted === true) {
    at++;
  }
  printed.splice(at, 0, goalLine);
  return {
    name,
    rates: {...rates, goalAt: goal.at, goalAt2: goal.at2, goalVp: goal.vp, goalVp2: goal.vp2},
    goal,
    lines: printed.map((line) => ({
      icon: 'vp',
      text: line.text,
      ...(line.params !== undefined ? {params: line.params.map(String)} : {}),
      ...(line.muted === true ? {muted: true} : {}),
    })),
  };
}

/**
 * The clause's result with its two GOALS — two threshold terms on the
 * measured operand, appended after the formula (outside any printed cap).
 * Σ terms.vp === vp still holds.
 */
export function withDividendGoal(result: MarsBotDividendResult, goal: MarsBotDividendGoal): MarsBotDividendResult {
  const measured = result.terms[goal.term];
  if (measured === undefined) {
    return result;
  }
  const first = bonusTerm('Goal', measured.count, goal.at, goal.vp);
  const second = bonusTerm('Second goal', measured.count, goal.at2, goal.vp2);
  return {vp: result.vp + first.vp + second.vp, terms: [...result.terms, first, second]};
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
