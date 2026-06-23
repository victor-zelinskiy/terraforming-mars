/*
 * Key-EPISODE engine (rework Iteration 15, §3–§5).
 *
 * Turns the finished game into an ORDERED set of episodes — the beats that actually tell
 * the story of THIS match — instead of a flat pile of "unusual facts". Each episode is
 * CLASSIFIED by ROLE (decisive driver / structural contrast / turning point / ironic
 * twist / signature moment / …) and graded by IMPACT relative to the final margin, so the
 * SAME fact lands in the right place: a 5-VP award at a +42 margin is an ironic twist, not
 * a reason for the win (§5/§16). Episodes carry a game PHASE (early / mid / late / scoring,
 * with a generation when the data pins one) so the UI can lay them on a timeline (§9).
 *
 * Sources (all already on the client — no server change; the passive-effect "came online"
 * beat is INFERRED from VP-by-generation acceleration, documented in `?egDebug`):
 *   • the strategy profiles (the plans)            → decisive_driver / structural_contrast / late_scoring
 *   • the VP-by-generation timeline                → turning_point / tempo_shift / engine_online
 *   • the endgame facts (award/colony/attack/…)    → ironic_twist / signature_moment
 *   • the final scoring breakdown (board/cards/MA)  → decisive_driver / near_miss / missed_conversion
 *
 * Design contract (mirrors strategyArchetypes / gameStoryDna):
 *   • PURE — no Vue / DOM / i18n. Texts are English i18n KEYS. Deterministic.
 *   • NO runtime dependency on insightEngine (type-only imports) → no module cycle.
 */
import type {Color} from '@/common/Color';
import type {EndgameFact, FactType} from '@/common/events/endgameFacts';
import type {InsightContext, InsightParam, EvidenceChip} from '@/client/components/endgame/insightEngine';
import type {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {strategyLabel, type StrategyDetection} from '@/client/components/endgame/strategyArchetypes';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type EpisodeRole =
  | 'decisive_driver' // really explains the win
  | 'turning_point' // a beat that changed the standings
  | 'signature_moment' // a defining beat (not necessarily decisive)
  | 'ironic_twist' // a memorable reversal (award sponsor lost it, …)
  | 'near_miss' // how close the runner-up got
  | 'structural_contrast' // the two plans differed (context, not a driver)
  | 'late_scoring' // a line that paid off near the end
  | 'tempo_shift' // a surge / burst that moved the pace
  | 'engine_online' // the moment the scoring engine started working
  | 'missed_conversion' // resources/economy that never became points
  | 'flavor_only'; // memorable, but not part of the causal chain

export type EpisodePhase = 'early' | 'mid' | 'late' | 'scoring';

export type KeyEpisode = {
  id: string;
  role: EpisodeRole;
  phase: EpisodePhase;
  /** The generation this beat happened in, when the data pins one. */
  generation?: number;
  /** Sort key — chronological (phase rank, then generation). */
  order: number;
  color?: Color;
  badge: string; // i18n KEY (a short label)
  textKey: string; // i18n template
  params: ReadonlyArray<InsightParam>;
  evidenceChips: ReadonlyArray<EvidenceChip>;
  /** 0..1 — how much this beat weighs against the FINAL MARGIN (impact-aware §5). */
  impact: number;
  confidence: 'high' | 'medium' | 'low';
  relatedPlayers?: ReadonlyArray<Color>;
  /** Same-thought collapse key (e.g. 'award' — the two award phrasings never co-appear). */
  dedupeKey?: string;
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const raw = (v: number | string): InsightParam => ({t: 'raw', v: String(v)});
const key = (v: string): InsightParam => ({t: 'i18n', v});
const cardP = (v: string): InsightParam => ({t: 'card', v});
const vpChip = (n: number): EvidenceChip => ({t: 'raw', v: `+${n}`, label: 'VP', tone: 'good'});
const labelChip = (k: string, tone: EvidenceChip['tone'] = 'neutral'): EvidenceChip => ({t: 'i18n', v: k, tone});
const valChip = (v: string, label: string, tone: EvidenceChip['tone'] = 'metric'): EvidenceChip => ({t: 'raw', v, label, tone});

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function factsByType(ctx: InsightContext, type: FactType): ReadonlyArray<EndgameFact> {
  return (ctx.facts ?? []).filter((f) => f.type === type);
}
function m(f: EndgameFact | undefined, k: string): number {
  return f?.metrics[k] ?? 0;
}
function nameOf(ctx: InsightContext, color: Color | undefined): string {
  return color !== undefined ? (ctx.players.find((p) => p.color === color)?.name ?? '') : '';
}
/** How much a VP amount weighs against the margin (impact-aware §5). margin 0 → tiebreaker. */
function impactVsMargin(vp: number, margin: number): number {
  return clamp01(vp / Math.max(margin, 4));
}
const PHASE_RANK: Readonly<Record<EpisodePhase, number>> = {early: 0, mid: 1, late: 2, scoring: 3};
function phaseOf(gen: number | undefined, finalGen: number): EpisodePhase {
  if (gen === undefined) {
    return 'mid';
  }
  if (gen <= Math.max(2, Math.round(finalGen * 0.35))) {
    return 'early';
  }
  if (gen <= Math.round(finalGen * 0.7)) {
    return 'mid';
  }
  if (gen < finalGen) {
    return 'late';
  }
  return 'scoring';
}
function orderOf(phase: EpisodePhase, gen: number | undefined): number {
  return PHASE_RANK[phase] * 1000 + (gen ?? PHASE_RANK[phase] * 5 + 200);
}
function confOf(d: StrategyDetection | undefined): 'high' | 'medium' | 'low' {
  return d?.confidence ?? 'medium';
}

/** The generation the winner's scoring clearly ACCELERATED (engine came online). Reads the
 *  cumulative VP-by-generation series; returns the gen where the per-gen gain first jumped
 *  well above the running average. undefined when no clear acceleration (steady game). */
function accelerationGen(p: EndgamePlayerScore, finalGen: number): {gen: number; gain: number} | undefined {
  const series = p.vpByGeneration;
  if (series.length < 4) {
    return undefined;
  }
  const len = Math.min(series.length, finalGen);
  let best: {gen: number; gain: number} | undefined;
  let prevAvg = 0;
  for (let g = 1; g < len; g++) {
    const gain = series[g] - series[g - 1];
    const avgSoFar = series[g - 1] / g;
    // A jump = a per-gen gain clearly above the running pace, in the middle of the game.
    if (g >= 2 && g <= len - 1 && gain >= avgSoFar * 1.6 && gain >= 6 && gain > prevAvg) {
      if (best === undefined || gain > best.gain) {
        best = {gen: g + 1, gain}; // 1-based generation
      }
    }
    prevAvg = gain;
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────
// Episode generators
// ─────────────────────────────────────────────────────────────────────────

type Gen = (ctx: InsightContext, finalGen: number) => Array<KeyEpisode>;

// 1) The winner's primary SCORING line — the decisive driver (or a late-scoring beat).
const episodeWinnerDriver: Gen = (ctx) => {
  const prof = ctx.winner.strategyProfile;
  const det = prof?.primary;
  if (det === undefined || !det.isScoring || det.vpContribution < 5) {
    return [];
  }
  const impact = impactVsMargin(det.vpContribution, ctx.margin);
  const decisive = impact >= 0.4;
  return [{
    id: `episode.driver.${ctx.winner.color}`,
    role: decisive ? 'decisive_driver' : 'late_scoring',
    phase: 'scoring', generation: undefined, order: orderOf('scoring', undefined),
    color: ctx.winner.color, badge: strategyLabel(det.archetype),
    textKey: decisive ?
      'The win was built at scoring: ${0}’s ${1} delivered the decisive block of points.' :
      'A line that paid off late: ${0}’s ${1} added points right at the finish.',
    params: [raw(ctx.winner.name), key(strategyLabel(det.archetype))],
    evidenceChips: [vpChip(det.vpContribution), ...det.evidence.slice(1, 2)],
    impact, confidence: confOf(det), relatedPlayers: [ctx.winner.color], dedupeKey: 'winnerDriver',
  }];
};

// 1b) The winner's SECOND scoring line (so "why won" can show 2–3 real drivers).
const episodeSecondaryScoring: Gen = (ctx) => {
  const sec = (ctx.winner.strategyProfile?.secondary ?? []).find((d) => d.isScoring && d.vpContribution >= 6);
  if (sec === undefined) {
    return [];
  }
  return [{
    id: `episode.secondary.${ctx.winner.color}`, role: 'late_scoring',
    phase: 'scoring', generation: undefined, order: orderOf('scoring', undefined) + 2,
    color: ctx.winner.color, badge: strategyLabel(sec.archetype),
    textKey: 'A second scoring line backed it up: ${0}’s ${1} added another block of points.',
    params: [raw(ctx.winner.name), key(strategyLabel(sec.archetype))],
    evidenceChips: [vpChip(sec.vpContribution)],
    impact: impactVsMargin(sec.vpContribution, ctx.margin), confidence: confOf(sec),
    relatedPlayers: [ctx.winner.color], dedupeKey: 'secondaryScoring',
  }];
};

// 1c) The winner's strongest single CARD — integrated into the story (§14), not a stray strip.
const episodeBestCard: Gen = (ctx) => {
  const top = [...ctx.winner.topCards].sort((a, b) => b.victoryPoint - a.victoryPoint)[0];
  if (top === undefined || top.victoryPoint < 8) {
    return [];
  }
  const impact = impactVsMargin(top.victoryPoint, ctx.margin);
  return [{
    id: 'episode.bestCard', role: impact >= 0.4 ? 'decisive_driver' : 'signature_moment',
    phase: 'scoring', generation: undefined, order: orderOf('scoring', undefined) + 3,
    color: ctx.winner.color, badge: 'Best card',
    textKey: '${0}’s strongest card, ${1}, brought a big block of points on its own.',
    params: [raw(ctx.winner.name), cardP(top.cardName)],
    evidenceChips: [vpChip(top.victoryPoint)],
    impact, confidence: 'high', relatedPlayers: [ctx.winner.color], dedupeKey: 'bestCard',
  }];
};

// 2) Structural contrast — the two plans differed (context, never a driver).
const episodeContrast: Gen = (ctx) => {
  if (ctx.mode !== 'duel' || ctx.runnerUp === undefined) {
    return [];
  }
  const w = ctx.winner.strategyProfile?.primary;
  const r = ctx.runnerUp.strategyProfile?.primary;
  if (w === undefined || r === undefined || w.archetype === r.archetype) {
    return [];
  }
  return [{
    id: 'episode.contrast', role: 'structural_contrast',
    phase: 'early', generation: undefined, order: orderOf('early', undefined),
    color: ctx.winner.color, badge: 'Two plans',
    textKey: 'The game split into two plans: ${0} went for ${1}, ${2} for ${3}.',
    params: [raw(ctx.winner.name), key(strategyLabel(w.archetype)), raw(ctx.runnerUp.name), key(strategyLabel(r.archetype))],
    evidenceChips: [labelChip(strategyLabel(w.archetype), 'good'), labelChip(strategyLabel(r.archetype), 'neutral')],
    impact: 0.2, confidence: 'high',
    relatedPlayers: [ctx.winner.color, ctx.runnerUp.color], dedupeKey: 'contrast',
  }];
};

// 3) The "engine online" beat — when the winner's scoring accelerated (inferred from VP/gen).
const episodeEngineOnline: Gen = (ctx, finalGen) => {
  const acc = accelerationGen(ctx.winner, finalGen);
  if (acc === undefined) {
    return [];
  }
  const phase = phaseOf(acc.gen, finalGen);
  if (phase === 'scoring') {
    return [];
  }
  return [{
    id: `episode.engine.${ctx.winner.color}`, role: 'engine_online',
    phase, generation: acc.gen, order: orderOf(phase, acc.gen),
    color: ctx.winner.color, badge: 'Engine online',
    textKey: '${0}’s plan started clicking — the points began coming noticeably faster.',
    params: [raw(ctx.winner.name)],
    evidenceChips: [valChip(`+${acc.gain}`, 'VP', 'good')],
    impact: 0.35, confidence: 'medium', relatedPlayers: [ctx.winner.color], dedupeKey: 'engineOnline',
  }];
};

// 4) Turning point — the winner took the lead late after trailing.
const episodeTurningPoint: Gen = (ctx) => {
  const t = ctx.timeline;
  if (t === undefined || t.winnerTookLeadGen === undefined || t.maxDeficit < 5) {
    return [];
  }
  const phase = phaseOf(t.winnerTookLeadGen, ctx.generation);
  return [{
    id: 'episode.turningPoint', role: 'turning_point',
    phase, generation: t.winnerTookLeadGen, order: orderOf(phase, t.winnerTookLeadGen),
    color: ctx.winner.color, badge: 'Took the lead',
    textKey: '${0} was behind, then pulled ahead for good and never gave the lead back.',
    params: [raw(ctx.winner.name)],
    evidenceChips: [valChip(`−${t.maxDeficit}`, 'VP', 'bad'), labelChip('then took the lead', 'good')],
    impact: clamp01(t.maxDeficit / 14), confidence: 'high', relatedPlayers: [ctx.winner.color], dedupeKey: 'turningPoint',
  }];
};

// 5) Tempo shift — a late economic surge (the burst notable carries a generation).
const episodeTempo: Gen = (ctx, finalGen) => {
  const burst = factsByType(ctx, 'notableEvent').find((f) => f.id === 'notable:economyBurst');
  if (burst === undefined || m(burst, 'savedMegacredits') < 14 || burst.generation === undefined) {
    return [];
  }
  const phase = phaseOf(burst.generation, finalGen);
  return [{
    id: 'episode.tempo', role: 'tempo_shift',
    phase, generation: burst.generation, order: orderOf(phase, burst.generation),
    color: burst.player, badge: 'Late surge',
    textKey: '${0} hit a late economic surge — a burst of resources right when it mattered.',
    params: [raw(nameOf(ctx, burst.player))],
    evidenceChips: [valChip(`+${m(burst, 'savedMegacredits')}`, 'M€', 'good')],
    impact: 0.25, confidence: 'medium', relatedPlayers: [burst.player], dedupeKey: 'tempo',
  }];
};

// 6) Award sponsor-lost — IMPACT-AWARE (twist when small vs the margin, decisive when it covers it).
function awardSponsorLost(ctx: InsightContext): {funder: string; winner: Color; winnerName: string; award: string; points: number; generation?: number} | undefined {
  const byAward = new Map<string, {funder?: string; entries: Array<{color: Color; name: string; place: string; points: number}>}>();
  for (const p of ctx.players) {
    for (const d of p.breakdown.detailsAwards) {
      const args = d.messageArgs ?? [];
      const award = args[1];
      if (award === undefined) {
        continue;
      }
      const a = byAward.get(award) ?? {funder: args[2], entries: []};
      a.funder = a.funder ?? args[2];
      a.entries.push({color: p.color, name: p.name, place: args[0] ?? '', points: d.victoryPoint});
      byAward.set(award, a);
    }
  }
  for (const [award, info] of byAward) {
    const first = info.entries.find((e) => e.place === '1st') ?? [...info.entries].sort((a, b) => b.points - a.points)[0];
    if (first === undefined || first.points === 0 || info.funder === undefined) {
      continue;
    }
    const funder = ctx.players.find((p) => p.name === info.funder);
    if (funder !== undefined && funder.color !== first.color) {
      const gen = factsByType(ctx, 'awardFunding').find((f) => f.id === `award:${award}`)?.generation;
      return {funder: info.funder, winner: first.color, winnerName: first.name, award, points: first.points, generation: gen};
    }
  }
  return undefined;
}
const episodeAward: Gen = (ctx) => {
  const a = awardSponsorLost(ctx);
  if (a === undefined) {
    return [];
  }
  const impact = impactVsMargin(a.points, ctx.margin);
  // Decisive only when the swing genuinely covers the margin (§16) — else a memorable twist.
  const role: EpisodeRole = impact >= 0.8 ? 'turning_point' : 'ironic_twist';
  return [{
    id: 'episode.award', role, phase: 'scoring', generation: a.generation, order: orderOf('scoring', a.generation),
    color: a.winner, badge: 'Award backfired',
    textKey: 'The award went to the wrong player: ${0} funded ${1}, but ${2} took the points for it.',
    params: [raw(nameOf(ctx, ctx.players.find((p) => p.name === a.funder)?.color)), key(a.award), raw(a.winnerName)],
    evidenceChips: [labelChip(a.award), vpChip(a.points)],
    impact, confidence: 'high', relatedPlayers: [a.winner], dedupeKey: 'award',
  }];
};

// 7) Signature moments — colony domination, a Predators raid, the most-targeted player.
const episodeSignature: Gen = (ctx) => {
  const out: Array<KeyEpisode> = [];
  // Colony domination (one player traded far more).
  const colonies = [...factsByType(ctx, 'colony')].sort((a, b) => m(b, 'trades') - m(a, 'trades'));
  const topC = colonies[0];
  const secondTrades = colonies[1] !== undefined ? m(colonies[1], 'trades') : 0;
  if (topC !== undefined && m(topC, 'trades') >= 5 && m(topC, 'trades') - secondTrades >= 3) {
    out.push({
      id: 'episode.colony', role: 'signature_moment', phase: 'mid', generation: undefined, order: orderOf('mid', undefined) + 1,
      color: topC.player, badge: 'Colony control',
      textKey: 'Colonies ran one way: ${0} kept the trade routes turning far more than anyone else.',
      params: [raw(nameOf(ctx, topC.player))],
      evidenceChips: [valChip(`${m(topC, 'trades')}`, 'Trades', 'good')],
      impact: 0.25, confidence: 'medium', relatedPlayers: [topC.player], dedupeKey: 'colony',
    });
  }
  // Most-targeted player (took the most direct pressure).
  const byVictim = new Map<Color, number>();
  for (const f of factsByType(ctx, 'negativeInteraction')) {
    if (f.targetPlayer !== undefined) {
      byVictim.set(f.targetPlayer, (byVictim.get(f.targetPlayer) ?? 0) + m(f, 'totalLost'));
    }
  }
  const topV = [...byVictim.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topV !== undefined && topV[1] >= 8) {
    out.push({
      id: 'episode.pressure', role: 'signature_moment', phase: 'mid', generation: undefined, order: orderOf('mid', undefined) + 2,
      color: topV[0], badge: 'Under fire',
      textKey: '${0} spent the game under pressure, losing resources to opponents’ attacks.',
      params: [raw(nameOf(ctx, topV[0]))],
      evidenceChips: [valChip(`−${topV[1]}`, '', 'bad')],
      impact: 0.2, confidence: 'high', relatedPlayers: [topV[0]], dedupeKey: 'pressure',
    });
  }
  return out;
};

// 8) Near miss / missed conversion — the runner-up's "so close" or unconverted resources.
const episodeRunnerUp: Gen = (ctx) => {
  const ru = ctx.runnerUp;
  if (ru === undefined || ctx.margin <= 0 || ctx.margin > 8) {
    return [];
  }
  // Penalties / leftover M€ larger than the gap → it really was that close.
  const penalties = ru.penaltyCards.reduce((s, c) => s + Math.abs(c.victoryPoint), 0);
  const leftover = ru.megacredits - Math.max(0, ru.production?.megacredits ?? 0);
  if (penalties >= ctx.margin) {
    return [{
      id: 'episode.nearMiss.penalty', role: 'near_miss', phase: 'scoring', generation: undefined, order: orderOf('scoring', undefined) + 1,
      color: ru.color, badge: 'So close',
      textKey: 'It was that close for ${0}: the penalties cost more than the final gap.',
      params: [raw(ru.name)],
      evidenceChips: [valChip(`−${penalties}`, 'VP', 'bad')],
      impact: 0.5, confidence: 'high', relatedPlayers: [ru.color], dedupeKey: 'nearMiss',
    }];
  }
  if (leftover >= ctx.margin && leftover >= 12) {
    return [{
      id: 'episode.nearMiss.money', role: 'missed_conversion', phase: 'scoring', generation: undefined, order: orderOf('scoring', undefined) + 1,
      color: ru.color, badge: 'On the table',
      textKey: '${0} finished with money still in the bank — more than the final gap.',
      params: [raw(ru.name)],
      evidenceChips: [valChip(`${leftover}`, 'M€', 'bad')],
      impact: 0.45, confidence: 'medium', relatedPlayers: [ru.color], dedupeKey: 'nearMiss',
    }];
  }
  return [];
};

const GENERATORS: ReadonlyArray<Gen> = [
  episodeWinnerDriver, episodeSecondaryScoring, episodeBestCard, episodeContrast,
  episodeEngineOnline, episodeTurningPoint, episodeTempo, episodeAward,
  episodeSignature, episodeRunnerUp,
];

// ─────────────────────────────────────────────────────────────────────────
// buildKeyEpisodes
// ─────────────────────────────────────────────────────────────────────────

/** Build the ordered, role-classified, impact-graded episodes of the game (§3–§5). */
export function buildKeyEpisodes(ctx: InsightContext): Array<KeyEpisode> {
  if (ctx.mode === 'solo') {
    return [];
  }
  const finalGen = ctx.generation;
  const all: Array<KeyEpisode> = [];
  for (const g of GENERATORS) {
    all.push(...g(ctx, finalGen));
  }
  // Same-thought dedup (§6): keep the strongest per dedupeKey (impact, then high confidence).
  const rank = (e: KeyEpisode) => e.impact + (e.confidence === 'high' ? 0.15 : e.confidence === 'medium' ? 0.05 : 0);
  const best = new Map<string, KeyEpisode>();
  for (const e of all) {
    const k = e.dedupeKey ?? e.id;
    const cur = best.get(k);
    if (cur === undefined || rank(e) > rank(cur)) {
      best.set(k, e);
    }
  }
  return [...best.values()].sort((a, b) => a.order - b.order || b.impact - a.impact || a.id.localeCompare(b.id));
}

// Role groupings the UI consumes.
const TIMELINE_ROLES: ReadonlyArray<EpisodeRole> = [
  'structural_contrast', 'engine_online', 'tempo_shift', 'turning_point', 'decisive_driver', 'late_scoring',
];
const UNUSUAL_ROLES: ReadonlyArray<EpisodeRole> = [
  'ironic_twist', 'signature_moment', 'near_miss', 'missed_conversion', 'flavor_only',
];

/** The chronological timeline beats (the "how the game played out" thread). */
export function timelineEpisodes(episodes: ReadonlyArray<KeyEpisode>): Array<KeyEpisode> {
  return episodes.filter((e) => TIMELINE_ROLES.includes(e.role)).slice(0, 5);
}
/** The memorable-but-not-decisive episodes (kept separate from the timeline, §10). */
export function unusualEpisodes(episodes: ReadonlyArray<KeyEpisode>): Array<KeyEpisode> {
  return episodes
    .filter((e) => UNUSUAL_ROLES.includes(e.role))
    .sort((a, b) => b.impact - a.impact || a.id.localeCompare(b.id))
    .slice(0, 4);
}
/** The decisive drivers (what really explains the win) — for "why the winner won" (§11). */
export function decisiveEpisodes(episodes: ReadonlyArray<KeyEpisode>): Array<KeyEpisode> {
  return episodes.filter((e) => e.role === 'decisive_driver' || e.role === 'late_scoring')
    .sort((a, b) => b.impact - a.impact).slice(0, 3);
}
export function contrastEpisode(episodes: ReadonlyArray<KeyEpisode>): KeyEpisode | undefined {
  return episodes.find((e) => e.role === 'structural_contrast');
}
/** The single most memorable twist/moment (for the "what defined" editorial episode line). */
export function memorableEpisode(episodes: ReadonlyArray<KeyEpisode>): KeyEpisode | undefined {
  return [...episodes].filter((e) => e.role === 'ironic_twist' || e.role === 'signature_moment' || e.role === 'turning_point')
    .sort((a, b) => b.impact - a.impact)[0];
}
