import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {GOAL_TERM_LABEL, MarsBotDividendDetail, SECOND_GOAL_TERM_LABEL} from '@/common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '@/common/automa/MarsBotDividendData';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/**
 * THE LIVE READING OF ONE FURTHER CORPORATION'S DIVIDEND — what the inspected
 * card's «ДИВИДЕНДЫ» box adds under its printed rule (the owner, 2026-10-27:
 * «порог по двум целям и текущий прогресс — взята или нет, сколько ПО дала —
 * и отдельно сколько всего ПО с учётом целей»).
 *
 * Pure, and it counts nothing: every number is the SERVER's — the bot's open
 * VP breakdown carries one `detailsDividends` row per held corporation, its
 * formula terms followed by the two goal terms `withDividendGoal` appended
 * (threshold, the measured operand's count, the VP paid). This module only
 * finds those terms and reads them out.
 */

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
  const measured = detail.terms[marsBotDividendInfo(detail.corporation).goal.term];
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
    operand: {label: measured.label, count: first.count},
    goals,
    formulaVp: detail.vp - goalsVp,
    goalsVp,
    totalVp: detail.vp,
  };
}
