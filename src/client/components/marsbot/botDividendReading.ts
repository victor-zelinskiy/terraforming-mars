import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {DIVIDEND_GOAL_LINE, GOAL_TERM_LABELS, MarsBotDividendDetail, MarsBotDividendTerm, dividendTermFormula} from '@/common/automa/MarsBotDividend';
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
 * formula terms followed by the three goal tiers `withDividendGoal` appended
 * (threshold, the measured operand's count, the VP paid). This module only
 * finds those terms and reads them out.
 *
 * The goal is ONE SCALE of three tiers (the owner, 2026-10-28: «одна шкала с
 * тремя делениями, последнее в конце — бонусы не должны забирать внимание у
 * самой механики»): the scale's three equal segments are the three steps, so
 * the last tier stands at its end; the fill crosses each segment by the
 * operand's progress from the previous threshold to the next one.
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

export type BotDividendTierReading = {
  ordinal: 1 | 2 | 3;
  /** The threshold on the measured operand. */
  at: number;
  /** What the tier adds once reached — ON TOP of the tiers below. */
  vp: number;
  reached: boolean;
  /** What it pays NOW — `vp` once reached, else 0. */
  paid: number;
};

export type BotDividendGoalReading = {
  /** The operand the tiers measure — the term's own i18n label and its live count. */
  operand: {label: string, count: number};
  tiers: readonly [BotDividendTierReading, BotDividendTierReading, BotDividendTierReading];
  /** The scale's fill, 0…1 — three equal segments, one per tier, each crossed by the progress toward it. */
  progress: number;
  /** The first tier not yet reached and how many units it still needs — absent once all three are paid. */
  next?: {ordinal: 1 | 2 | 3, vp: number, remaining: number};
  /** What the reached tiers pay together. */
  vp: number;
};

export type BotDividendReading = {
  /** The dividend's own name (i18n key — «Urbanization»). */
  name: string;
  /** The printed rule, without the goal line. */
  rule: ReadonlyArray<BotDividendRuleLine>;
  /** The formula's live terms (the goals excluded), in the clause's order. */
  terms: ReadonlyArray<BotDividendTermReading>;
  goal: BotDividendGoalReading;
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

/** The scale's fill: three equal segments, the first unreached one crossed by the progress from the threshold below. */
function scaleProgress(count: number, thresholds: ReadonlyArray<number>): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (count < thresholds[i]) {
      const from = i === 0 ? 0 : thresholds[i - 1];
      const span = thresholds[i] - from;
      const within = span <= 0 ? 0 : Math.max(0, Math.min(1, (count - from) / span));
      return (i + within) / thresholds.length;
    }
  }
  return 1;
}

/** The reading — undefined when the row carries no goal terms (nothing live to read: the printed line stands). */
export function botDividendReading(detail: MarsBotDividendDetail | undefined): BotDividendReading | undefined {
  if (detail === undefined) {
    return undefined;
  }
  const goalTerms = GOAL_TERM_LABELS.map((label) => detail.terms.find((t) => t.label === label));
  const info = marsBotDividendInfo(detail.corporation);
  const measured = detail.terms[info.goal.term];
  if (measured === undefined || goalTerms.some((t) => t?.threshold === undefined)) {
    return undefined;
  }
  const [a, b, c] = goalTerms as ReadonlyArray<MarsBotDividendTerm>;
  const count = a.count;
  const tier = (ordinal: 1 | 2 | 3, t: MarsBotDividendTerm): BotDividendTierReading => {
    const at = t.threshold ?? 0; // checked above: every goal term carries its threshold
    return {ordinal, at, vp: t.each, reached: count >= at, paid: t.vp};
  };
  const tiers = [tier(1, a), tier(2, b), tier(3, c)] as const;
  const nextTier = tiers.find((t) => !t.reached);
  const goalsVp = a.vp + b.vp + c.vp;
  return {
    name: info.name,
    rule: info.lines
      .filter((line) => line.text !== DIVIDEND_GOAL_LINE)
      .map((line) => ({text: line.text, params: line.params ?? [], muted: line.muted === true})),
    terms: detail.terms
      .filter((t) => !goalTerms.includes(t))
      .map((t) => ({label: t.label, formula: dividendTermFormula(t), vp: t.vp})),
    goal: {
      operand: {label: measured.label, count},
      tiers,
      progress: scaleProgress(count, tiers.map((t) => t.at)),
      ...(nextTier !== undefined ? {next: {ordinal: nextTier.ordinal, vp: nextTier.vp, remaining: nextTier.at - count}} : {}),
      vp: goalsVp,
    },
    formulaVp: detail.vp - goalsVp,
    goalsVp,
    totalVp: detail.vp,
  };
}
