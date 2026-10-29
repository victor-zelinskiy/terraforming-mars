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
  /** The box's GOAL — three tiers, the rare great game of this very corporation (`withDividendGoal`). */
  goal: MarsBotDividendGoal;
};

/**
 * THE GOAL of a dividend — THREE TIERS on one scale (the owner, 2026-10-27:
 * «иногда реально 70+ … достижимые, но редкие, не теоретические»; 2026-10-28:
 * «три уровня вместо двух — суммарно столько же, но без резких рывков»), on
 * an operand OF ITS OWN (the owner, 2026-10-29: «сам дивиденд и бонусы считают
 * одно и то же … независимые, тематические, умеренно редкие цели, уникальные
 * для каждой корпорации, не завязанные на механику дивиденда»; and never on
 * where the PLAYERS build — «игроки сами хотят ставить города рядом с
 * озеленением, это ломает кор-механику»). The goal has a NAME («Titanium
 * mines»), a MEASURE — what it counts, something the bot itself did or owns
 * that its formula does not count (the corporation's server clause reads it:
 * `MarsBotCorp.goal(game)`) — and three rising thresholds on that count; each
 * tier pays its `vp` once the count reaches its `at`, ON TOP of the tiers
 * below (+7 · +8 · +10 by default, no single step above +10). Never under the
 * box's printed cap (a cap ends the formula; a goal stands beside it).
 *
 * Every pairing is MEASURED, not guessed: the catalog
 * (`docs/claude/marsbot-dividend-goals-catalog.md`, bench
 * `scripts/marsbot-goal-candidates.ts`) keeps the operand's correlation with
 * the corporation's own formula under 0.2 on the owner's real games, picks
 * operands reachable on EVERY map and in every module set, and sets the tiers
 * so the first is reached in at most two games of five, the tiers get rarer,
 * the last is reached in real play, and every corporation's goal pays about
 * the same expected VP.
 */
export type MarsBotDividendTier = {at: number, vp: number};
export type MarsBotDividendGoal = {
  /** The goal's own name (English i18n key) — «Titanium mines». */
  name: string;
  /** What it counts (English i18n key, a short operand label) — «MarsBot tiles on or beside a titanium space». */
  measure: string;
  tiers: readonly [MarsBotDividendTier, MarsBotDividendTier, MarsBotDividendTier];
};

/** The default prizes of the three tiers — rising, the last the biggest, together the old +10 / +15. */
export const DIVIDEND_GOAL_VP: readonly [number, number, number] = [7, 8, 10];

type DividendLine = {text: string, params?: ReadonlyArray<number>, muted?: boolean};

/** The printed goal's own line: its name and what it counts (both params are i18n keys — `keyParams`). */
export const DIVIDEND_GOAL_NAME_LINE = 'Goal «${0}»: ${1}';
/** The printed goal's tiers, under its name line: the three thresholds, each with what it adds. */
export const DIVIDEND_GOAL_LINE = 'Goal: ${0} — +${1} VP · ${2} — +${3} VP · ${4} — +${5} VP';
/** Is this printed line one of the goal's two (the ledger draws the goal itself and skips them)? */
export function isDividendGoalLine(text: string): boolean {
  return text === DIVIDEND_GOAL_NAME_LINE || text === DIVIDEND_GOAL_LINE;
}

/** The three goal terms `withDividendGoal` appends — the labels the live reading finds them by, in tier order. */
export const GOAL_TERM_LABELS: readonly [string, string, string] = ['Goal', 'Second goal', 'Third goal'];

/** A box's goal: its name, what it counts, three rising thresholds on that count, +7 / +8 / +10 VP by default. */
export function dividendGoal(name: string, measure: string, at: number, at2: number, at3: number, opts: {vp?: readonly [number, number, number]} = {}): MarsBotDividendGoal {
  if (!(at < at2 && at2 < at3)) {
    throw new Error(`A dividend goal's tiers must rise: ${at} / ${at2} / ${at3}`);
  }
  const vp = opts.vp ?? DIVIDEND_GOAL_VP;
  return {name, measure, tiers: [{at, vp: vp[0]}, {at: at2, vp: vp[1]}, {at: at3, vp: vp[2]}]};
}

/**
 * Build a box whose printed params are taken from its own `rates`. The goal's
 * numbers JOIN the rates (`goalAt` · `goalAt2` · `goalAt3` · `goalVp` · `goalVp2` ·
 * `goalVp3`), so a printed number stays a rate and the paid number stays the printed one.
 */
export function dividendBox<R extends Record<string, number>>(
  name: string,
  rates: R,
  lines: (r: R) => ReadonlyArray<DividendLine>,
  goal: MarsBotDividendGoal,
): MarsBotDividendInfo & {rates: R} {
  const printed = [...lines(rates)];
  const [t1, t2, t3] = goal.tiers;
  // The goal is its OWN paragraph after the formula: its name and measure, then its tiers.
  const nameLine: BonusCardEffectLine = {icon: 'vp', text: DIVIDEND_GOAL_NAME_LINE, params: [goal.name, goal.measure], keyParams: true};
  const tiersParams = [t1.at, t1.vp, t2.at, t2.vp, t3.at, t3.vp].map(String);
  return {
    name,
    rates: {...rates, goalAt: t1.at, goalAt2: t2.at, goalAt3: t3.at, goalVp: t1.vp, goalVp2: t2.vp, goalVp3: t3.vp},
    goal,
    lines: [
      ...printed.map((line) => ({
        icon: 'vp',
        text: line.text,
        ...(line.params !== undefined ? {params: line.params.map(String)} : {}),
        ...(line.muted === true ? {muted: true} : {}),
      })),
      nameLine,
      {icon: 'vp', text: DIVIDEND_GOAL_LINE, params: tiersParams, muted: true},
    ],
  };
}

/**
 * The clause's result with its GOAL — three threshold terms on the goal's OWN
 * count (`MarsBotCorp.goal(game)`), one per tier, appended after the formula
 * (outside any printed cap). Σ terms.vp === vp still holds; every goal term
 * carries the count, so the live reading finds the operand there.
 */
export function withDividendGoal(result: MarsBotDividendResult, goal: MarsBotDividendGoal, count: number): MarsBotDividendResult {
  const safe = Math.max(0, Math.floor(count));
  const tiers = goal.tiers.map((tier, i) => bonusTerm(GOAL_TERM_LABELS[i], safe, tier.at, tier.vp));
  return {vp: result.vp + tiers.reduce((sum, t) => sum + t.vp, 0), terms: [...result.terms, ...tiers]};
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
