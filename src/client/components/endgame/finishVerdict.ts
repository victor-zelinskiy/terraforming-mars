/*
 * Finish VERDICT system (Iteration 17 §2/§17 + Iteration 18 rare finishes).
 *
 * Classifies HOW the game finished and produces a typed verdict the hero renders as a
 * VISUAL banner (tier + glyph + accent + evidence chips + a short rich-text line). On top
 * of the margin tiers (photo / close / solid / wide / blowout) + the shape tiers (comeback
 * / late breakaway), it detects RARE finishes — won-without-terraforming, a single-card
 * decider, an award decider, a card-resource reveal, a Jovian finish, a colony-trade
 * finish — but ONLY on strong evidence, so the "wow" tier is reserved for genuinely unusual
 * games. PURE — no Vue / DOM / i18n; the line is an i18n template + typed params.
 */
import type {Color} from '@/common/Color';
import type {InsightContext, InsightParam, EvidenceChip} from '@/client/components/endgame/insightEngine';
import {marginClass} from '@/client/components/endgame/keyEpisodeEngine';
import {strategyLabel, type StrategyArchetype} from '@/client/components/endgame/strategyArchetypes';
import {buildStrategyTermDetail} from '@/client/components/endgame/insightDetail';

export type FinishVerdictType =
  // margin / shape tiers
  | 'photo_finish' | 'close_finish' | 'solid_win' | 'large_win' | 'blowout'
  | 'comeback' | 'late_breakaway'
  // rare finishes (strong-evidence only)
  | 'low_terraforming_big_win'
  | 'single_card_decider'
  | 'award_decider'
  | 'resource_card_finish'
  | 'jovian_reveal'
  | 'colony_trade_finish';

export type FinishVerdictTier = 'normal' | 'strong' | 'rare' | 'legendary';

export type FinishVerdictLine = {key: string; params: ReadonlyArray<InsightParam>};

export type FinishVerdict = {
  type: FinishVerdictType;
  tier: FinishVerdictTier;
  /** i18n KEY — the short, strong banner title. */
  titleKey: string;
  /** The one-line explanation (rich-text template + params). */
  line: FinishVerdictLine;
  /** A monochrome glyph (tinted via CSS by type/tier). */
  glyph: string;
  /** Evidence chips (real numbers — the "why this finish") rendered under the line. */
  chips: ReadonlyArray<EvidenceChip>;
  /** Why this type was chosen (debug, §14). */
  reason: string;
  /** Rare candidates considered + why rejected (debug, §14). */
  rejected: ReadonlyArray<string>;
};

const playerP = (name: string, color: Color | undefined): InsightParam =>
  color !== undefined ? {t: 'raw', v: name, term: {kind: 'player', color}} : {t: 'raw', v: name};
const scoreP = (v: number | string): InsightParam => ({t: 'raw', v: String(v), term: {kind: 'score', accent: true}});
const cardP = (v: string): InsightParam => ({t: 'card', v, term: {kind: 'card'}});
function stratP(ctx: InsightContext, color: Color, archetype: StrategyArchetype): InsightParam {
  return {t: 'i18n', v: strategyLabel(archetype), term: {kind: 'strategy', detail: buildStrategyTermDetail(ctx.players, color, archetype)}};
}

const vpChip = (n: number): EvidenceChip => ({t: 'raw', v: `+${n}`, label: 'VP', tone: 'good'});
const gapChip = (n: number): EvidenceChip => ({t: 'raw', v: `+${n}`, label: 'VP', tone: 'metric'});
const valChip = (v: string, label: string, tone: EvidenceChip['tone'] = 'metric'): EvidenceChip => ({t: 'raw', v, label, tone});
const lblChip = (k: string, tone: EvidenceChip['tone'] = 'neutral'): EvidenceChip => ({t: 'i18n', v: k, tone});

const GLYPH: Record<FinishVerdictType, string> = {
  photo_finish: '‖', close_finish: 'Ξ', solid_win: '✦', large_win: '↗', blowout: '♛',
  comeback: '⇄', late_breakaway: '↗',
  low_terraforming_big_win: '◭', single_card_decider: '★', award_decider: '✷',
  resource_card_finish: '❋', jovian_reveal: '◆', colony_trade_finish: '◉',
};

function tr(p: {categories: {tr: number}}): number {
  return p.categories.tr ?? 0;
}
function mainLine(ctx: InsightContext): {archetype: StrategyArchetype; label: string} | undefined {
  const a = ctx.winner.strategyProfile?.primary?.archetype;
  return a !== undefined ? {archetype: a, label: strategyLabel(a)} : undefined;
}

// ── Rare-finish detectors. Each returns a verdict on STRONG evidence, else a reject reason. ──
type RareResult = {verdict?: FinishVerdict; reject?: string};
type RareDetector = (ctx: InsightContext) => RareResult;

// Won despite a clearly weaker terraforming race (the flagship rare finish).
const detectLowTerraforming: RareDetector = (ctx) => {
  const w = ctx.winner;
  const bestOtherTr = Math.max(0, ...ctx.players.filter((p) => p.color !== w.color).map(tr));
  const trDeficit = bestOtherTr - tr(w);
  if (ctx.margin < 6 || trDeficit < 8) {
    return {reject: `low-terraforming: trDeficit ${trDeficit} (need ≥8), margin ${ctx.margin}`};
  }
  const line = mainLine(ctx);
  const chips: Array<EvidenceChip> = [valChip(`+${trDeficit}`, 'TR', 'neutral'), vpChip(ctx.margin)];
  if (line !== undefined) {
    chips.push(lblChip(line.label, 'good'));
  }
  return {verdict: {
    type: 'low_terraforming_big_win', tier: ctx.margin >= 20 ? 'legendary' : 'rare',
    titleKey: ctx.margin >= 20 ? 'A rare wide finish' : 'Won without the parameter race',
    glyph: GLYPH.low_terraforming_big_win,
    line: line !== undefined ?
      {key: 'Behind on terraforming, ${0} still took the game on the final count through ${1}: +${2} VP.',
        params: [playerP(w.name, w.color), stratP(ctx, w.color, line.archetype), scoreP(ctx.margin)]} :
      {key: 'Behind on terraforming, ${0} still finished with the stronger count: +${1} VP.',
        params: [playerP(w.name, w.color), scoreP(ctx.margin)]},
    chips, reason: `won with ${trDeficit} less TR at +${ctx.margin}`, rejected: [],
  }};
};

// A single card worth more than the final gap in a close game.
const detectSingleCard: RareDetector = (ctx) => {
  if (ctx.margin < 1 || ctx.margin > 5) {
    return {reject: `single-card: margin ${ctx.margin} not close (1–5)`};
  }
  const top = [...ctx.winner.topCards].sort((a, b) => b.victoryPoint - a.victoryPoint)[0];
  if (top === undefined || top.victoryPoint < ctx.margin || top.victoryPoint < 5) {
    return {reject: `single-card: best ${top?.victoryPoint ?? 0} < margin ${ctx.margin}`};
  }
  return {verdict: {
    type: 'single_card_decider', tier: 'rare', titleKey: 'One card decided it',
    glyph: GLYPH.single_card_decider,
    line: {key: 'In a tight game, ${0}’s ${1} alone was worth more than the final gap.',
      params: [playerP(ctx.winner.name, ctx.winner.color), cardP(top.cardName)]},
    chips: [vpChip(top.victoryPoint), gapChip(ctx.margin)],
    reason: `${top.cardName} ${top.victoryPoint} ≥ margin ${ctx.margin}`, rejected: [],
  }};
};

// Award points larger than the final gap (the award swung the result).
const detectAward: RareDetector = (ctx) => {
  const awards = ctx.winner.breakdown.awards ?? 0;
  if (ctx.margin < 1 || ctx.margin > 7 || awards < ctx.margin || awards < 5) {
    return {reject: `award: awards ${awards} vs margin ${ctx.margin}`};
  }
  return {verdict: {
    type: 'award_decider', tier: 'rare', titleKey: 'An award decided it',
    glyph: GLYPH.award_decider,
    line: {key: 'The award points were the difference for ${0}: +${1} VP, more than the final gap.',
      params: [playerP(ctx.winner.name, ctx.winner.color), scoreP(awards)]},
    chips: [valChip(`+${awards}`, 'VP', 'good'), gapChip(ctx.margin)],
    reason: `awards ${awards} ≥ margin ${ctx.margin}`, rejected: [],
  }};
};

// A card-resource line (animals / microbes / floaters) that opened up for a big block.
const RESOURCE_ARCHE: ReadonlyArray<StrategyArchetype> = ['animals', 'microbes', 'floaters'];
const RESOURCE_TITLE: Partial<Record<StrategyArchetype, string>> = {
  animals: 'The animal line came good', microbes: 'The microbe line came good', floaters: 'The floater line came good',
};
const detectResourceCard: RareDetector = (ctx) => {
  const det = (ctx.winner.strategyProfile?.all ?? [])
    .filter((d) => RESOURCE_ARCHE.includes(d.archetype) && d.isScoring)
    .sort((a, b) => b.vpContribution - a.vpContribution)[0];
  if (det === undefined || det.vpContribution < 14) {
    return {reject: `resource-card: best resource line ${det?.vpContribution ?? 0} VP (need ≥14)`};
  }
  return {verdict: {
    type: 'resource_card_finish', tier: 'rare', titleKey: RESOURCE_TITLE[det.archetype] ?? 'A card-resource finish',
    glyph: GLYPH.resource_card_finish,
    line: {key: 'Resources stored on cards opened up at scoring and gave ${0} a big block through ${1}: +${2} VP.',
      params: [playerP(ctx.winner.name, ctx.winner.color), stratP(ctx, ctx.winner.color, det.archetype), scoreP(det.vpContribution)]},
    chips: [vpChip(det.vpContribution), lblChip(strategyLabel(det.archetype), 'good')],
    reason: `${det.archetype} ${det.vpContribution} VP`, rejected: [],
  }};
};

// A heavy Jovian combo that folded into a dense block of points.
const detectJovian: RareDetector = (ctx) => {
  const jov = ctx.winner.strategyInput?.cardVp.jovian ?? 0;
  if (jov < 12) {
    return {reject: `jovian: ${jov} VP (need ≥12)`};
  }
  return {verdict: {
    type: 'jovian_reveal', tier: 'rare', titleKey: 'A Jovian finish', glyph: GLYPH.jovian_reveal,
    line: {key: 'The Jovian tags banked all game folded into a dense block of points for ${0}: +${1} VP.',
      params: [playerP(ctx.winner.name, ctx.winner.color), scoreP(jov)]},
    chips: [vpChip(jov), lblChip('Jovian combo', 'good')],
    reason: `jovian ${jov} VP`, rejected: [],
  }};
};

// A colony trade engine that clearly powered the winner.
const detectColony: RareDetector = (ctx) => {
  const colony = (ctx.facts ?? []).find((f) => f.type === 'colony' && f.player === ctx.winner.color);
  const trades = colony?.metrics.trades ?? 0;
  const topTrades = Math.max(0, ...(ctx.facts ?? []).filter((f) => f.type === 'colony').map((f) => f.metrics.trades ?? 0));
  if (ctx.margin < 6 || trades < 8 || trades < topTrades) {
    return {reject: `colony: winner trades ${trades} (need ≥8 and top), margin ${ctx.margin}`};
  }
  return {verdict: {
    type: 'colony_trade_finish', tier: 'rare', titleKey: 'A colony-trade finish', glyph: GLYPH.colony_trade_finish,
    line: {key: 'A colony trade engine fed ${0}’s scoring plays all game.', params: [playerP(ctx.winner.name, ctx.winner.color)]},
    chips: [valChip(`${trades}`, 'Trades', 'good')],
    reason: `colony trades ${trades}`, rejected: [],
  }};
};

// Order = most specific / decisive first.
const RARE_DETECTORS: ReadonlyArray<RareDetector> = [
  detectSingleCard, detectAward, detectLowTerraforming, detectResourceCard, detectJovian, detectColony,
];

/** Classify + compose the finish verdict for the hero banner. */
export function buildFinishVerdict(ctx: InsightContext): FinishVerdict | undefined {
  if (ctx.mode === 'solo' || ctx.runnerUp === undefined) {
    return undefined;
  }
  const w = ctx.winner;
  const margin = ctx.margin;
  const t = ctx.timeline;
  const cls = marginClass(margin);

  // 1) Rare finishes — strong evidence only. Collect rejects for debug.
  const rejected: Array<string> = [];
  for (const d of RARE_DETECTORS) {
    const r = d(ctx);
    if (r.verdict !== undefined) {
      return {...r.verdict, rejected};
    }
    if (r.reject !== undefined) {
      rejected.push(r.reject);
    }
  }

  // 2) Shape tiers — a finish-line comeback / late breakaway.
  const lateLead = t?.winnerTookLeadGen !== undefined && t.winnerTookLeadGen >= ctx.generation - 1;
  if (lateLead && (t?.maxDeficit ?? 0) >= 5) {
    return {
      type: 'comeback', tier: 'rare', titleKey: 'A finish-line comeback', glyph: GLYPH.comeback,
      line: {key: 'By the final count the hidden points came out and swung the lead to ${0} after trailing.', params: [playerP(w.name, w.color)]},
      chips: [valChip(`−${t?.maxDeficit}`, 'VP', 'bad'), vpChip(margin)],
      reason: `late lead (gen ${t?.winnerTookLeadGen}) after a ${t?.maxDeficit}-VP deficit`, rejected,
    };
  }
  if (!(t?.wireToWire ?? false) && margin >= 16 && t?.earlyGap !== undefined && t.earlyGap <= margin / 3) {
    return {
      type: 'late_breakaway', tier: 'strong', titleKey: 'A late breakaway', glyph: GLYPH.late_breakaway,
      line: {key: 'It ran close, then the final count sharply pulled ${0} clear: +${1} VP.', params: [playerP(w.name, w.color), scoreP(margin)]},
      chips: [vpChip(margin)],
      reason: `close at 2/3 (gap ${t.earlyGap}) → +${margin} at the finish`, rejected,
    };
  }

  // 3) Margin tiers.
  if (cls === 'tie' || margin <= 3) {
    return {
      type: 'photo_finish', tier: 'strong', titleKey: 'Photo finish', glyph: GLYPH.photo_finish,
      line: margin === 0 ?
        {key: 'Level on points — the title was settled on the M€ tiebreaker.', params: []} :
        {key: 'The game came down to a handful of points at the final count.', params: []},
      chips: margin > 0 ? [gapChip(margin)] : [], reason: `margin ${margin}`, rejected,
    };
  }
  if (margin <= 5) {
    return {
      type: 'close_finish', tier: 'normal', titleKey: 'A close finish', glyph: GLYPH.close_finish,
      line: {key: 'Just +${0} VP decided it — the details mattered.', params: [scoreP(margin)]},
      chips: [gapChip(margin)], reason: `margin ${margin}`, rejected,
    };
  }
  if (cls === 'solid') {
    return {
      type: 'solid_win', tier: 'normal', titleKey: 'Solid win', glyph: GLYPH.solid_win,
      line: {key: 'The advantage for ${0} held and was sealed at the final count: +${1} VP.', params: [playerP(w.name, w.color), scoreP(margin)]},
      chips: [vpChip(margin)], reason: `margin ${margin}`, rejected,
    };
  }
  if (cls === 'large') {
    return {
      type: 'large_win', tier: 'normal', titleKey: 'A wide finish', glyph: GLYPH.large_win,
      line: {key: 'The final count pulled the players far apart: the lead for ${0} reached +${1} VP.', params: [playerP(w.name, w.color), scoreP(margin)]},
      chips: [vpChip(margin)], reason: `margin ${margin}`, rejected,
    };
  }
  return {
    type: 'blowout', tier: 'strong', titleKey: 'A runaway finish', glyph: GLYPH.blowout,
    line: {key: 'The lead for ${0} reached +${1} VP — no longer a fight over details, but a wide final gap.', params: [playerP(w.name, w.color), scoreP(margin)]},
    chips: [vpChip(margin)], reason: `margin ${margin} (blowout)`, rejected,
  };
}
