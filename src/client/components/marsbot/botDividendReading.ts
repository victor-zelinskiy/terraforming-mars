import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {DIVIDEND_GOAL_LINE, GOAL_TERM_LABEL, MarsBotDividendDetail, SECOND_GOAL_TERM_LABEL, dividendTermFormula} from '@/common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '@/common/automa/MarsBotDividendData';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/**
 * THE LIVE READING OF ONE FURTHER CORPORATION'S DIVIDEND — what the inspected
 * card's «ДИВИДЕНДЫ» box reads (the owner, 2026-10-27:
 * «порог по двум целям и текущий прогресс — взята или нет, сколько ПО дала —
 * и отдельно сколько всего ПО с учётом целей»).
 *
 * Pure, and it counts nothing: every number is the SERVER's — the bot's open
 * VP breakdown carries one `detailsDividends` row per held corporation, its
 * formula terms followed by the two goal terms `withDividendGoal` appended
 * (threshold, the measured operand's count, the VP paid). This module only
 * finds those terms and reads them out.
 *
 * The reading is the WHOLE box (the owner, 2026-10-27, second pass: «первая и
 * основная зона — механика — до того же премиального уровня, целостная
 * композиция»): the mechanic's zone — the dividend's name, its printed rule
 * (the goal line excluded: the goals' own plates state it) and the formula's
 * live terms — stands on the same plate as the goals and the total.
 */

/** One printed line of the rule — an i18n template, its params, quieter when `muted`. */
export type BotDividendRuleLine = {text: string, params: ReadonlyArray<string>, muted: boolean};

/** One live term of the formula: what is counted, the arithmetic now, the VP it pays. */
export type BotDividendTermReading = {
  /** i18n key of the operand («Greenery tiles»). */
  label: string;
  /** The ONE term formula reading (`dividendTermFormula` — «7 × 2 VP», «7 of 6 for +2 VP»). */
  formula: {label: string, params: ReadonlyArray<number>};
  vp: number;
};

export type BotDividendGoalReading = {
  ordinal: 1 | 2;
  /** The threshold on the measured operand. */
  at: number;
  /** What the goal pays once reached (the second goal's VP is ON TOP of the first's). */
  vp: number;
  reached: boolean;
  /** What it pays NOW — `vp` once reached, else 0. */
  paid: number;
  /** Units still missing — 0 once reached. */
  remaining: number;
  /** The meter, 0…1. */
  fill: number;
};

export type BotDividendReading = {
  /** The dividend's own name (i18n key — «Urbanization»). */
  name: string;
  /** The printed rule, without the goal line. */
  rule: ReadonlyArray<BotDividendRuleLine>;
  /** The formula's live terms (the goals excluded), in the clause's order. */
  terms: ReadonlyArray<BotDividendTermReading>;
  /** The operand both goals measure — the term's own i18n label and its live count. */
  operand: {label: string, count: number};
  goals: readonly [BotDividendGoalReading, BotDividendGoalReading];
  /** What the printed formula pays (the dividend minus its goals). */
  formulaVp: number;
  goalsVp: number;
  /** The whole dividend — the formula AND the goals. */
  totalVp: number;
};

/** The bot's dividend row of one held corporation, off the open VP breakdown (absent outside a portfolio). */
export function botDividendDetailOf(players: ReadonlyArray<PublicPlayerModel>, id: MarsBotCorpId): MarsBotDividendDetail | undefined {
  const bot = players.find((p) => p.isMarsBot === true);
  return bot?.victoryPointsBreakdown.automa?.detailsDividends?.find((d) => d.corporation === id);
}

/** The reading — undefined when the row carries no goal terms (nothing live to read: the printed line stands). */
export function botDividendReading(detail: MarsBotDividendDetail | undefined): BotDividendReading | undefined {
  if (detail === undefined) {
    return undefined;
  }
  const first = detail.terms.find((t) => t.label === GOAL_TERM_LABEL);
  const second = detail.terms.find((t) => t.label === SECOND_GOAL_TERM_LABEL);
  const info = marsBotDividendInfo(detail.corporation);
  const measured = detail.terms[info.goal.term];
  if (first?.threshold === undefined || second?.threshold === undefined || measured === undefined) {
    return undefined;
  }
  const goal = (ordinal: 1 | 2, at: number, vp: number, paid: number): BotDividendGoalReading => {
    const reached = first.count >= at;
    return {
      ordinal,
      at,
      vp,
      reached,
      paid,
      remaining: reached ? 0 : at - first.count,
      fill: at <= 0 ? 1 : Math.min(1, first.count / at),
    };
  };
  const goals = [goal(1, first.threshold, first.each, first.vp), goal(2, second.threshold, second.each, second.vp)] as const;
  const goalsVp = first.vp + second.vp;
  return {
    name: info.name,
    rule: info.lines
      .filter((line) => line.text !== DIVIDEND_GOAL_LINE)
      .map((line) => ({text: line.text, params: line.params ?? [], muted: line.muted === true})),
    terms: detail.terms
      .filter((t) => t !== first && t !== second)
      .map((t) => ({label: t.label, formula: dividendTermFormula(t), vp: t.vp})),
    operand: {label: measured.label, count: first.count},
    goals,
    formulaVp: detail.vp - goalsVp,
    goalsVp,
    totalVp: detail.vp,
  };
}
