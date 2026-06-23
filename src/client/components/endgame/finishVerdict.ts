/*
 * Finish VERDICT system (Iteration 19 — three-axis calibration).
 *
 * The verdict is composed from THREE independent axes so "rare" never overclaims:
 *   • SCALE   — how big the win was (photo / close / solid / large / blowout), from margin.
 *   • PATTERN — the SHAPE of the win (lower-terraforming / comeback / single-card swing /
 *               award swing / Jovian / card-resource / hidden reveal / late breakaway / …).
 *   • RARITY  — how UNUSUAL it was (common / notable / rare / legendary), gated by STRONG
 *               evidence. Winning with less terraforming is a normal contrast (notable),
 *               NOT a rare finish unless the deficit is huge AND several scoring lines
 *               compensated.
 *
 * The hero banner shows the SCALE title for common/notable finishes (with the pattern as
 * flavour in the line) and only swaps to a pattern-specific "rare" title + special styling
 * when rarity is rare/legendary. PURE — no Vue / DOM / i18n.
 */
import type {Color} from '@/common/Color';
import type {InsightContext, InsightParam, EvidenceChip} from '@/client/components/endgame/insightEngine';
import {marginClass} from '@/client/components/endgame/keyEpisodeEngine';
import {strategyLabel, type StrategyArchetype} from '@/client/components/endgame/strategyArchetypes';
import {buildStrategyTermDetail} from '@/client/components/endgame/insightDetail';

export type FinishScale = 'photo_finish' | 'close' | 'solid' | 'large' | 'blowout';
export type FinishPattern =
  | 'normal'
  | 'lower_terraforming_win'
  | 'hidden_scoring_reveal'
  | 'late_breakaway'
  | 'comeback'
  | 'single_card_swing'
  | 'award_swing'
  | 'resource_card_finish'
  | 'jovian_finish'
  | 'colony_supported_finish';
export type FinishRarity = 'common' | 'notable' | 'rare' | 'legendary';

export type FinishVerdictLine = {key: string; params: ReadonlyArray<InsightParam>};

/** A rare-candidate evaluation record (debug — §12). */
export type RareCandidateRecord = {type: FinishPattern; accepted: boolean; reason: string};

export type FinishVerdict = {
  scale: FinishScale;
  pattern: FinishPattern;
  rarity: FinishRarity;
  /** i18n KEY — the banner title (scale title for common/notable, pattern title for rare). */
  titleKey: string;
  line: FinishVerdictLine;
  glyph: string;
  chips: ReadonlyArray<EvidenceChip>;
  reason: string;
  /** Rare candidates considered + accepted/rejected (debug, §12). */
  rareCandidates: ReadonlyArray<RareCandidateRecord>;
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

const SCALE_TITLE: Record<FinishScale, string> = {
  photo_finish: 'Photo finish', close: 'A close finish', solid: 'Solid win',
  large: 'A wide finish', blowout: 'A runaway finish',
};
const SCALE_GLYPH: Record<FinishScale, string> = {
  photo_finish: '‖', close: 'Ξ', solid: '✦', large: '↗', blowout: '♛',
};
// A pattern-specific TITLE + glyph used only when rarity is rare/legendary.
const RARE_TITLE: Partial<Record<FinishPattern, string>> = {
  lower_terraforming_win: 'A rare gap against terraforming',
  comeback: 'A finish-line comeback',
  single_card_swing: 'One card decided it',
  award_swing: 'An award decided it',
  jovian_finish: 'A Jovian finish',
  resource_card_finish: 'A card-resource finish',
  hidden_scoring_reveal: 'A hidden finish',
};
const PATTERN_GLYPH: Partial<Record<FinishPattern, string>> = {
  lower_terraforming_win: '◭', comeback: '⇄', single_card_swing: '★', award_swing: '✷',
  jovian_finish: '◆', resource_card_finish: '❋', hidden_scoring_reveal: '◎',
  late_breakaway: '↗', colony_supported_finish: '◉',
};

function scaleOf(margin: number): FinishScale {
  const cls = marginClass(margin);
  if (cls === 'tie' || margin <= 3) {
    return 'photo_finish';
  }
  if (margin <= 5) {
    return 'close';
  }
  return cls === 'solid' ? 'solid' : cls === 'large' ? 'large' : 'blowout';
}
function trOf(p: {categories: {tr: number}}): number {
  return p.categories.tr ?? 0;
}
/** The winner's SCORING lines (≥6 VP), strongest first — for dominance comparisons. */
function scoringLineList(ctx: InsightContext): Array<{archetype: StrategyArchetype; vp: number}> {
  return (ctx.winner.strategyProfile?.all ?? [])
    .filter((d) => d.isScoring && d.vpContribution >= 6)
    .map((d) => ({archetype: d.archetype, vp: d.vpContribution}))
    .sort((a, b) => b.vp - a.vp);
}
function mainArche(ctx: InsightContext): StrategyArchetype | undefined {
  return ctx.winner.strategyProfile?.primary?.archetype;
}

// The default (scale) line when the pattern adds no special flavour.
function scaleLine(ctx: InsightContext): FinishVerdictLine {
  const w = ctx.winner;
  const m = ctx.margin;
  switch (scaleOf(m)) {
  case 'photo_finish':
    return m === 0 ?
      {key: 'Level on points — the title was settled on the M€ tiebreaker.', params: []} :
      {key: 'The game came down to a handful of points at the final count.', params: []};
  case 'close':
    return {key: 'Just +${0} VP decided it — the details mattered.', params: [scoreP(m)]};
  case 'solid':
    return {key: 'The advantage for ${0} held and was sealed at the final count: +${1} VP.', params: [playerP(w.name, w.color), scoreP(m)]};
  case 'large':
    return {key: 'The final count pulled the players far apart: the lead for ${0} reached +${1} VP.', params: [playerP(w.name, w.color), scoreP(m)]};
  default:
    return {key: 'The lead for ${0} reached +${1} VP — no longer a fight over details, but a wide final gap.', params: [playerP(w.name, w.color), scoreP(m)]};
  }
}

type Detected = {pattern: FinishPattern; rarity: FinishRarity; line: FinishVerdictLine; chips: ReadonlyArray<EvidenceChip>; reason: string};

// The "amplifier" line for a STRONG-but-not-dominant secondary scoring line (notable, not a finish).
function normalLine(ctx: InsightContext, lines: ReadonlyArray<{archetype: StrategyArchetype; vp: number}>): FinishVerdictLine {
  const w = ctx.winner;
  const prim = w.strategyProfile?.primary?.archetype;
  const sec = lines.find((l) => l.archetype !== prim);
  const scale = scaleOf(ctx.margin);
  // A wide win with a primary + a real secondary line → name both honestly (§8).
  if ((scale === 'large' || scale === 'blowout') && prim !== undefined && sec !== undefined) {
    return {key: 'A strong final count for ${0} through ${1}, with ${2} adding a second layer of points.',
      params: [playerP(w.name, w.color), stratP(ctx, w.color, prim), stratP(ctx, w.color, sec.archetype)]};
  }
  return scaleLine(ctx);
}

/** Detect the win PATTERN + its RARITY. DRAMA (shape) outranks strategy; close games keep
 *  the close verdict (strategy is flavour, not a "finish"); strategic finishes need real
 *  DOMINANCE (share of total + margin, top/dominant line). Records candidates for debug. */
function detectPattern(ctx: InsightContext, records: Array<RareCandidateRecord>): Detected {
  const w = ctx.winner;
  const m = ctx.margin;
  const t = ctx.timeline;
  const total = Math.max(1, w.total);
  const isClose = scaleOf(m) === 'photo_finish' || scaleOf(m) === 'close';
  const lines = scoringLineList(ctx);
  const topVp = lines[0]?.vp ?? 0;
  const secondVp = lines[1]?.vp ?? 0;
  const note = (type: FinishPattern, accepted: boolean, reason: string) => records.push({type, accepted, reason});

  // ── DRAMA first — the SHAPE of the game outranks any strategic pattern (§5). ──
  // 1) Finish-line comeback (trailed by a real gap, took the lead very late).
  const lateLead = t?.winnerTookLeadGen !== undefined && t.winnerTookLeadGen >= ctx.generation - 1;
  if (lateLead && (t?.maxDeficit ?? 0) >= 5) {
    note('comeback', true, `late lead gen ${t?.winnerTookLeadGen} after −${t?.maxDeficit}`);
    return {pattern: 'comeback', rarity: 'rare',
      line: {key: 'By the final count the hidden points came out and swung the lead to ${0} after trailing.', params: [playerP(w.name, w.color)]},
      chips: [valChip(`−${t?.maxDeficit}`, 'VP', 'bad'), vpChip(m)], reason: 'comeback'};
  }
  // 2) Hidden scoring reveal — the winner was behind at ~2/3 but won.
  if (t?.earlyGap !== undefined && t.earlyGap < 0 && m > 0) {
    const rarity: FinishRarity = m >= 10 ? 'rare' : 'notable';
    note('hidden_scoring_reveal', rarity !== 'notable', `behind at 2/3 (gap ${t.earlyGap}), won by ${m}`);
    return {pattern: 'hidden_scoring_reveal', rarity,
      line: {key: 'It looked close before the final count, but the scoring opened a real gap for ${0}: +${1} VP.', params: [playerP(w.name, w.color), scoreP(m)]},
      chips: [vpChip(m), lblChip('then took the lead', 'good')], reason: 'hidden reveal'};
  }

  // ── CLOSE GAMES — the close verdict IS the story; only close DECIDERS can be rare (§5). ──
  if (isClose) {
    const top = [...w.topCards].sort((a, b) => b.victoryPoint - a.victoryPoint)[0];
    if (top !== undefined && m >= 1 && top.victoryPoint >= m && top.victoryPoint >= 5) {
      note('single_card_swing', true, `${top.cardName} ${top.victoryPoint} ≥ margin ${m}`);
      return {pattern: 'single_card_swing', rarity: 'rare',
        line: {key: 'In a tight game, ${0}’s ${1} alone was worth more than the final gap.', params: [playerP(w.name, w.color), cardP(top.cardName)]},
        chips: [vpChip(top.victoryPoint), gapChip(m)], reason: 'single-card swing'};
    }
    note('single_card_swing', false, `best card ${top?.victoryPoint ?? 0} vs margin ${m}`);
    const awards = w.breakdown.awards ?? 0;
    if (m >= 1 && awards >= m && awards >= 5) {
      note('award_swing', true, `awards ${awards} ≥ margin ${m}`);
      return {pattern: 'award_swing', rarity: 'rare',
        line: {key: 'The award points were the difference for ${0}: +${1} VP, more than the final gap.', params: [playerP(w.name, w.color), scoreP(awards)]},
        chips: [valChip(`+${awards}`, 'VP', 'good'), gapChip(m)], reason: 'award swing'};
    }
    note('award_swing', false, `awards ${awards} vs margin ${m}`);
    // A close finish — strategy is only flavour in the subtitle, never the verdict.
    const src = lines[0];
    return {pattern: 'normal', rarity: 'common',
      line: src !== undefined ?
        {key: 'A handful of points decided it — the decisive ones came from ${0}.', params: [stratP(ctx, w.color, src.archetype)]} :
        scaleLine(ctx),
      chips: m > 0 ? [gapChip(m)] : [], reason: 'close finish'};
  }

  // ── SOLID / LARGE / BLOWOUT — strategic finishes only on real DOMINANCE (§2–§4). ──
  // 3) Card-resource finish: dominant resource line (rare needs ≥30 VP + 16% of total +
  //    75% of margin); a strong-but-secondary line is a NOTABLE amplifier, not a finish.
  const resLine = lines.find((l) => l.archetype === 'animals' || l.archetype === 'microbes' || l.archetype === 'floaters');
  if (resLine !== undefined) {
    const dominant = resLine.vp >= topVp * 0.9 || resLine.vp > secondVp + 5;
    const shareTotal = resLine.vp / total;
    const shareMargin = resLine.vp / Math.max(1, m);
    if (resLine.vp >= 30 && shareTotal >= 0.16 && shareMargin >= 0.75 && dominant) {
      note('resource_card_finish', true, `${resLine.archetype} ${resLine.vp} VP, total ${shareTotal.toFixed(2)}, margin ${shareMargin.toFixed(2)}, dominant`);
      return {pattern: 'resource_card_finish', rarity: 'rare',
        line: {key: 'Resources stored on cards opened up at scoring and gave ${0} a big block through ${1}: +${2} VP.',
          params: [playerP(w.name, w.color), stratP(ctx, w.color, resLine.archetype), scoreP(resLine.vp)]},
        chips: [vpChip(resLine.vp), lblChip(strategyLabel(resLine.archetype), 'good')], reason: 'card-resource finish'};
    }
    if (resLine.vp >= 18 && dominant) {
      note('resource_card_finish', false, `${resLine.archetype} ${resLine.vp} VP — amplifier (rare needs ≥30 & ≥75% of margin)`);
      return {pattern: 'resource_card_finish', rarity: 'notable',
        line: {key: 'A second scoring line for ${0}: ${1} added +${2} VP.',
          params: [playerP(w.name, w.color), stratP(ctx, w.color, resLine.archetype), scoreP(resLine.vp)]},
        chips: [vpChip(resLine.vp)], reason: 'card-resource amplifier'};
    }
    if (resLine.vp >= 12) {
      note('resource_card_finish', false, `${resLine.archetype} ${resLine.vp} VP — secondary contributor (not the verdict)`);
    }
  }

  // 4) Jovian finish: dominant Jovian block (rare needs ≥25 VP + 75% of margin + dominant).
  const jov = w.strategyInput?.cardVp.jovian ?? 0;
  if (jov >= 15) {
    const dominant = jov >= topVp * 0.9 || jov > secondVp + 5;
    const shareMargin = jov / Math.max(1, m);
    if (jov >= 25 && shareMargin >= 0.75 && dominant) {
      note('jovian_finish', true, `jovian ${jov} VP, margin ${shareMargin.toFixed(2)}, dominant`);
      return {pattern: 'jovian_finish', rarity: 'rare',
        line: {key: 'The Jovian tags banked all game folded into a dense block of points for ${0}: +${1} VP.', params: [playerP(w.name, w.color), scoreP(jov)]},
        chips: [vpChip(jov), lblChip('Jovian combo', 'good')], reason: 'Jovian finish'};
    }
    if (dominant) {
      note('jovian_finish', false, `jovian ${jov} VP — important block (rare needs ≥25 & ≥75% of margin)`);
      return {pattern: 'jovian_finish', rarity: 'notable',
        line: {key: 'Jovian tags added an important block of points for ${0}: +${1} VP.', params: [playerP(w.name, w.color), scoreP(jov)]},
        chips: [vpChip(jov)], reason: 'Jovian amplifier'};
    }
    note('jovian_finish', false, `jovian ${jov} VP — not the dominant line`);
  }

  // 5) Late breakaway — close at 2/3, then a wide finish (notable, not rare).
  if (!(t?.wireToWire ?? false) && m >= 16 && t?.earlyGap !== undefined && t.earlyGap >= 0 && t.earlyGap <= m / 3) {
    note('late_breakaway', false, 'notable, not rare');
    return {pattern: 'late_breakaway', rarity: 'notable',
      line: {key: 'It ran close, then the final count sharply pulled ${0} clear: +${1} VP.', params: [playerP(w.name, w.color), scoreP(m)]},
      chips: [vpChip(m)], reason: 'late breakaway'};
  }

  // 6) Won with less terraforming — a CONTRAST. Rare ONLY at a huge deficit + 3 lines.
  const bestOtherTr = Math.max(0, ...ctx.players.filter((p) => p.color !== w.color).map(trOf));
  const trDeficit = bestOtherTr - trOf(w);
  if (trDeficit >= 8 && m >= 6) {
    let rarity: FinishRarity = 'notable';
    if (trDeficit >= 25 && m >= 30 && lines.length >= 3) {
      rarity = 'legendary';
    } else if (trDeficit >= 18 && m >= 22 && lines.length >= 3) {
      rarity = 'rare';
    }
    note('lower_terraforming_win', rarity === 'rare' || rarity === 'legendary',
      `trDeficit ${trDeficit}, margin ${m}, scoringLines ${lines.length}`);
    const arche = mainArche(ctx);
    const chips: Array<EvidenceChip> = [valChip(`+${trDeficit}`, 'TR', 'neutral'), vpChip(m)];
    if (arche !== undefined) {
      chips.push(lblChip(strategyLabel(arche), 'good'));
    }
    return {pattern: 'lower_terraforming_win', rarity,
      line: arche !== undefined ?
        {key: 'Behind on terraforming, ${0} still took the game on the final count through ${1}: +${2} VP.',
          params: [playerP(w.name, w.color), stratP(ctx, w.color, arche), scoreP(m)]} :
        {key: 'Behind on terraforming, ${0} still finished with the stronger count: +${1} VP.',
          params: [playerP(w.name, w.color), scoreP(m)]},
      chips, reason: `lower TR by ${trDeficit}`};
  }

  // 7) Nothing dominant — a plain finish; name a real secondary line if there is one (§8).
  return {pattern: 'normal', rarity: 'common', line: normalLine(ctx, lines), chips: m > 0 ? [vpChip(m)] : [], reason: 'plain finish'};
}

/** Classify + compose the finish verdict for the hero banner. */
export function buildFinishVerdict(ctx: InsightContext): FinishVerdict | undefined {
  if (ctx.mode === 'solo' || ctx.runnerUp === undefined) {
    return undefined;
  }
  const scale = scaleOf(ctx.margin);
  const records: Array<RareCandidateRecord> = [];
  const d = detectPattern(ctx, records);
  const isRare = d.rarity === 'rare' || d.rarity === 'legendary';
  // common/notable → SCALE title (no "rare" wording); rare/legendary → pattern title.
  const titleKey = isRare ? (RARE_TITLE[d.pattern] ?? SCALE_TITLE[scale]) : SCALE_TITLE[scale];
  const glyph = isRare ? (PATTERN_GLYPH[d.pattern] ?? SCALE_GLYPH[scale]) : SCALE_GLYPH[scale];
  return {
    scale, pattern: d.pattern, rarity: d.rarity,
    titleKey, line: d.line, glyph, chips: d.chips,
    reason: `${scale} / ${d.pattern} / ${d.rarity} — ${d.reason}`,
    rareCandidates: records,
  };
}
