/*
 * Rule-based post-game ANALYSIS ENGINE for the premium endgame experience.
 *
 * Replaces the original five-template insight switch with an extensible,
 * candidate-based system: a set of independent ANALYZERS each inspect the
 * finished game (standings, category values, the VP-by-generation timeline,
 * global-parameter contributions, card details) and emit weighted
 * `InsightCandidate`s; `selectInsights` then ranks them, deduplicates by
 * thought-group + explicit suppression links, and returns the 3–6 strongest
 * lines that make THIS game's story.
 *
 * Design contract (mirrors endgameModel.ts):
 *   • PURE — no Vue / DOM / i18n. Texts are English i18n template KEYS with
 *     `${n}` params; params are typed (`raw` | `i18n` | `card`) so the
 *     component knows which ones to run through the translator.
 *   • DETERMINISTIC — phrasing variants are chosen by a stable hash of the
 *     game's final state (never Math.random), so the same game always reads
 *     the same while different games get different wording.
 *   • EXTENSIBLE — add an analyzer (or a kind inside one) and the selector
 *     picks it up; one insight per `group` keeps the final list non-repetitive.
 *
 * To add a new insight: pick (or add) a group, emit a candidate with a unique
 * `id`, a `priority` (see the rough bands below) and a textKey + params, then
 * add the ru translation in src/locales/ru/endgame.json.
 *
 * Priority bands (guideline, not law):
 *   90+  once-a-season stories (tiebreaker, photo finish, late comeback)
 *   75–89 strong game-specific hooks (lead battles, decisive category, runaway)
 *   55–74 solid color (dominance, surges, mismatches)
 *   35–54 supporting facts (runner-up strength, parameter ownership)
 *   <35  filler that only appears in quiet games (profile line)
 */
import {Color} from '@/common/Color';
import type {
  EndgameCategory,
  EndgameCategoryKey,
  EndgameMode,
  EndgameParameter,
  EndgamePlayerScore,
} from '@/client/components/endgame/endgameModel';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type InsightSeverity = 'minor' | 'normal' | 'major' | 'decisive';

// One final thought per group — the dedup unit of the selector.
export type InsightGroup =
  | 'verdict' // how close / how brutal the final score was
  | 'timeline' // the shape of the lead over generations
  | 'reason' // WHY the winner won (category structure)
  | 'category' // category battles (sweeps, near-flips, runner-up edges)
  | 'momentum' // late-game acceleration
  | 'cards' // single-card stories and penalties
  | 'parameters' // who actually moved the planet
  | 'race' // standings-only: the fight below first place
  | 'profile'; // the victory archetype (only when nothing suppressed it)

export type InsightIcon =
  | 'crown' | 'swap' | 'surge' | 'target' | 'scale'
  | 'globe' | 'cards' | 'hex' | 'flag' | 'spark';

// `raw` — final text (names, numbers); `i18n` — an English key the component
// translates (category/parameter labels); `card` — a card name ($t translates
// card names by exact match too).
export type InsightParam = {t: 'raw' | 'i18n' | 'card'; v: string};

export type InsightCandidate = {
  id: string; // unique, stable — also the dedup/suppression handle
  group: InsightGroup;
  priority: number;
  severity: InsightSeverity;
  icon: InsightIcon;
  badge: string; // i18n key for the compact corner badge
  color?: Color; // player accent
  textKey: string; // English template with ${n} placeholders
  params: Array<InsightParam>;
  // Candidate ids that become redundant when this one is picked (the same
  // thought told from another angle).
  suppresses?: ReadonlyArray<string>;
};

// What the selector returns — same shape; alias for readability at call sites.
export type EndgameInsightView = InsightCandidate;

export type TimelineStats = {
  // Generations with data for every player (the comparable window).
  sampled: number;
  leadChanges: number;
  winnerLedGens: number;
  // The non-winner who led the most generations (for "led most, lost anyway").
  topOtherLeader: {color: Color; gens: number} | undefined;
  // Deepest the eventual winner was BEHIND at any generation (>0 = comeback).
  maxDeficit: number;
  maxDeficitGen: number | undefined; // 1-based
  // Biggest VP gain over the final two generations + the best gain among the rest.
  finalSurge: {color: Color; gain: number; bestOtherGain: number} | undefined;
  winnerTookLeadGen: number | undefined; // 1-based; from endgameModel
  wireToWire: boolean;
  // Winner's signed lead at ~2/3 of the game (negative = was trailing).
  earlyGap: number | undefined;
};

export type VictoryProfileKind = 'terraformer' | 'engine' | 'builder' | 'laurels' | 'balanced';

export type VictoryProfile = {
  kind: VictoryProfileKind;
  label: string; // i18n key (short chip label)
  // Share (0–100) of the winner's positive VP coming from the dominant source.
  share: number;
  sourceKey: EndgameCategoryKey | undefined; // the dominant category (undefined for balanced)
};

export type InsightContext = {
  mode: EndgameMode;
  generation: number;
  players: ReadonlyArray<EndgamePlayerScore>; // ranked, winner first
  winner: EndgamePlayerScore;
  runnerUp: EndgamePlayerScore | undefined;
  margin: number;
  categories: ReadonlyArray<EndgameCategory>;
  parameters: ReadonlyArray<EndgameParameter>;
  timeline: TimelineStats | undefined;
  profile: VictoryProfile | undefined;
  seed: number;
};

// ─────────────────────────────────────────────────────────────────────────
// Deterministic phrasing
// ─────────────────────────────────────────────────────────────────────────

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Stable per-game seed: the final standings fingerprint.
export function gameSeed(players: ReadonlyArray<EndgamePlayerScore>, generation: number): number {
  return hashString(players.map((p) => `${p.name}:${p.total}:${p.megacredits}`).join('|') + '#' + generation);
}

// Same game + same insight → same wording; different games vary.
function pick(seed: number, salt: string, variants: ReadonlyArray<string>): string {
  if (variants.length === 1) {
    return variants[0];
  }
  // `>>> 0` keeps the XOR unsigned — a signed result would index negatively.
  return variants[((hashString(salt) ^ seed) >>> 0) % variants.length];
}

const raw = (v: number | string): InsightParam => ({t: 'raw', v: String(v)});
const key = (v: string): InsightParam => ({t: 'i18n', v});
const card = (v: string): InsightParam => ({t: 'card', v});

// ─────────────────────────────────────────────────────────────────────────
// Timeline statistics
// ─────────────────────────────────────────────────────────────────────────

export function computeTimelineStats(
  players: ReadonlyArray<EndgamePlayerScore>,
  winner: EndgamePlayerScore,
  generation: number,
  winnerTookLeadGen: number | undefined,
): TimelineStats | undefined {
  const others = players.filter((p) => p.color !== winner.color);
  if (others.length === 0) {
    return undefined;
  }
  const len = Math.min(
    generation,
    winner.vpByGeneration.length,
    ...others.map((o) => o.vpByGeneration.length),
  );
  if (len <= 1) {
    return undefined;
  }

  // Strict leader per generation (undefined on a tie at the top).
  const leaderAt = (g: number): Color | undefined => {
    let best: Color | undefined;
    let bestVal = -Infinity;
    let tied = false;
    for (const p of players) {
      const v = p.vpByGeneration[g];
      if (v > bestVal) {
        bestVal = v;
        best = p.color;
        tied = false;
      } else if (v === bestVal) {
        tied = true;
      }
    }
    return tied ? undefined : best;
  };

  let leadChanges = 0;
  let winnerLedGens = 0;
  let prevLeader: Color | undefined;
  const otherLeadGens = new Map<Color, number>();
  let maxDeficit = 0;
  let maxDeficitGen: number | undefined;

  for (let g = 0; g < len; g++) {
    const leader = leaderAt(g);
    if (leader !== undefined) {
      if (prevLeader !== undefined && leader !== prevLeader) {
        leadChanges++;
      }
      prevLeader = leader;
      if (leader === winner.color) {
        winnerLedGens++;
      } else {
        otherLeadGens.set(leader, (otherLeadGens.get(leader) ?? 0) + 1);
      }
    }
    let bestOther = -Infinity;
    for (const o of others) {
      bestOther = Math.max(bestOther, o.vpByGeneration[g]);
    }
    const deficit = bestOther - winner.vpByGeneration[g];
    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      maxDeficitGen = g + 1;
    }
  }

  let topOtherLeader: {color: Color; gens: number} | undefined;
  for (const [color, gens] of otherLeadGens) {
    if (topOtherLeader === undefined || gens > topOtherLeader.gens) {
      topOtherLeader = {color, gens};
    }
  }

  // Final-two-generations surge.
  const window = Math.min(2, len - 1);
  let finalSurge: TimelineStats['finalSurge'];
  if (window > 0) {
    const gains = players.map((p) => ({
      color: p.color,
      gain: p.vpByGeneration[len - 1] - p.vpByGeneration[len - 1 - window],
    }));
    gains.sort((a, b) => b.gain - a.gain);
    finalSurge = {color: gains[0].color, gain: gains[0].gain, bestOtherGain: gains[1]?.gain ?? 0};
  }

  const twoThirdsIdx = Math.max(0, Math.ceil((len * 2) / 3) - 1);
  let bestOtherEarly = -Infinity;
  for (const o of others) {
    bestOtherEarly = Math.max(bestOtherEarly, o.vpByGeneration[twoThirdsIdx]);
  }
  const earlyGap = winner.vpByGeneration[twoThirdsIdx] - bestOtherEarly;

  return {
    sampled: len,
    leadChanges,
    winnerLedGens,
    topOtherLeader,
    maxDeficit,
    maxDeficitGen,
    finalSurge,
    winnerTookLeadGen,
    wireToWire: winnerLedGens === len,
    earlyGap,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Victory profile (the winner's archetype)
// ─────────────────────────────────────────────────────────────────────────

const PROFILE_LABEL: Record<VictoryProfileKind, string> = {
  terraformer: 'Terraforming-driven',
  engine: 'Card engine',
  builder: 'Board control',
  laurels: 'Award hunter',
  balanced: 'All-rounder',
};

export function buildVictoryProfile(winner: EndgamePlayerScore): VictoryProfile | undefined {
  const c = winner.categories;
  const sources: Array<{kind: VictoryProfileKind; catKey: EndgameCategoryKey; value: number; threshold: number}> = [
    {kind: 'terraformer', catKey: 'tr', value: Math.max(0, c.tr ?? 0), threshold: 50},
    {kind: 'engine', catKey: 'cards', value: Math.max(0, c.cards ?? 0), threshold: 34},
    {kind: 'builder', catKey: 'board', value: Math.max(0, c.board ?? 0), threshold: 27},
    {kind: 'laurels', catKey: 'mca', value: Math.max(0, c.mca ?? 0), threshold: 25},
  ];
  const positiveTotal = sources.reduce((s, x) => s + x.value, 0) +
    Math.max(0, c.moon ?? 0) + Math.max(0, c.tracks ?? 0);
  if (positiveTotal <= 0) {
    return undefined;
  }
  // The dominant source is the one exceeding its threshold by the largest
  // factor (TR's threshold is higher because the ~20 starting rating makes it
  // structurally big in every game).
  let best: {kind: VictoryProfileKind; catKey: EndgameCategoryKey; share: number; ratio: number} | undefined;
  for (const s of sources) {
    const share = Math.round((s.value / positiveTotal) * 100);
    const ratio = share / s.threshold;
    if (ratio >= 1 && (best === undefined || ratio > best.ratio)) {
      best = {kind: s.kind, catKey: s.catKey, share, ratio};
    }
  }
  if (best !== undefined) {
    return {kind: best.kind, label: PROFILE_LABEL[best.kind], share: best.share, sourceKey: best.catKey};
  }
  const topShare = Math.max(...sources.map((s) => Math.round((s.value / positiveTotal) * 100)));
  return {kind: 'balanced', label: PROFILE_LABEL.balanced, share: topShare, sourceKey: undefined};
}

// ─────────────────────────────────────────────────────────────────────────
// Analyzer helpers
// ─────────────────────────────────────────────────────────────────────────

// Winner's lead in a category over the best OTHER player (positive = winner ahead).
function winnerCategoryLead(cat: EndgameCategory, winner: Color): number {
  const wv = cat.values[winner] ?? 0;
  let bestOther = 0;
  for (const [color, v] of Object.entries(cat.values)) {
    if (color !== winner && v > bestOther) {
      bestOther = v;
    }
  }
  return wv - bestOther;
}

type CategoryLead = {cat: EndgameCategory; lead: number};

function sortedWinnerLeads(ctx: InsightContext): Array<CategoryLead> {
  return ctx.categories
    .map((cat) => ({cat, lead: winnerCategoryLead(cat, ctx.winner.color)}))
    .sort((a, b) => b.lead - a.lead);
}

// ─────────────────────────────────────────────────────────────────────────
// Analyzers
// ─────────────────────────────────────────────────────────────────────────

type Analyzer = (ctx: InsightContext) => Array<InsightCandidate>;

// ── 1. Verdict: how close the final score was ───────────────────────────
const analyzeVerdict: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const {winner, runnerUp, margin, seed} = ctx;
  if (runnerUp === undefined) {
    return out;
  }
  const name = winner.name;

  if (margin === 0) {
    out.push({
      id: 'verdict.tiebreaker', group: 'verdict', priority: 95, severity: 'decisive', icon: 'scale',
      badge: 'Tiebreaker', color: winner.color,
      textKey: pick(seed, 'verdict.tiebreaker', [
        'Dead even at ${0} VP — the title went to ${1} on the M€ tiebreaker.',
        'The scores finished level at ${0} VP: ${1} took the win on leftover megacredits.',
      ]),
      params: [raw(winner.total), raw(name)],
    });
  } else if (margin <= 2) {
    out.push({
      id: 'verdict.photo-finish', group: 'verdict', priority: 90, severity: 'decisive', icon: 'scale',
      badge: 'Photo finish', color: winner.color,
      textKey: pick(seed, 'verdict.photo', [
        'A photo finish: just ${1} VP separated ${0} from defeat.',
        '${0} escaped with the win by a razor-thin ${1} VP.',
      ]),
      params: [raw(name), raw(margin)],
    });
  } else if (margin <= 7) {
    out.push({
      id: 'verdict.close', group: 'verdict', priority: 60, severity: 'normal', icon: 'scale',
      badge: 'Close game', color: winner.color,
      textKey: pick(seed, 'verdict.close', [
        'A close game — the final margin was only ${0} VP.',
        'The result stayed in doubt until the end: ${0} VP decided it.',
      ]),
      params: [raw(margin)],
    });
  } else if (margin >= 30 || (runnerUp.total > 0 && margin >= runnerUp.total * 0.35)) {
    out.push({
      id: 'verdict.runaway', group: 'verdict', priority: 75, severity: 'major', icon: 'crown',
      badge: 'Runaway', color: winner.color,
      textKey: pick(seed, 'verdict.runaway', [
        'A runaway victory: ${0} finished ${1} VP clear of the field.',
        'Total control — ${0} won by ${1} VP.',
      ]),
      params: [raw(name), raw(margin)],
      suppresses: ['momentum.pulled-away'],
    });
  } else if (margin >= 15) {
    out.push({
      id: 'verdict.commanding', group: 'verdict', priority: 55, severity: 'normal', icon: 'crown',
      badge: 'In control', color: winner.color,
      textKey: '${0} controlled the endgame and won by ${1} VP.',
      params: [raw(name), raw(margin)],
    });
  } else {
    out.push({
      id: 'verdict.solid', group: 'verdict', priority: 40, severity: 'minor', icon: 'flag',
      badge: 'Solid win', color: winner.color,
      textKey: '${0} closed out a confident win: +${1} VP.',
      params: [raw(name), raw(margin)],
    });
  }
  return out;
};

// ── 2. Timeline: the shape of the lead ──────────────────────────────────
const analyzeTimeline: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const t = ctx.timeline;
  const {winner, seed, generation} = ctx;
  if (t === undefined) {
    return out;
  }

  const lateThreshold = Math.max(2, ctx.generation - 1);
  if (t.winnerTookLeadGen !== undefined && t.winnerTookLeadGen >= lateThreshold && t.maxDeficit >= 5) {
    out.push({
      id: 'timeline.late-comeback', group: 'timeline', priority: 92, severity: 'decisive', icon: 'swap',
      badge: 'Comeback', color: winner.color,
      textKey: pick(seed, 'timeline.late-comeback', [
        'A late comeback: ${0} trailed by ${1} VP before snatching the lead in generation ${2}.',
        '${0} turned the game around at the very end — down ${1} VP, then ahead for good in generation ${2}.',
      ]),
      params: [raw(winner.name), raw(t.maxDeficit), raw(t.winnerTookLeadGen)],
      suppresses: ['momentum.winner-surge', 'momentum.pulled-away', 'timeline.lead-taken'],
    });
  } else if (t.maxDeficit >= 8) {
    out.push({
      id: 'timeline.comeback', group: 'timeline', priority: 85, severity: 'major', icon: 'swap',
      badge: 'Comeback', color: winner.color,
      textKey: '${0} trailed by up to ${1} VP and still came back to win.',
      params: [raw(winner.name), raw(t.maxDeficit)],
      suppresses: ['timeline.lead-taken'],
    });
  }

  if (t.topOtherLeader !== undefined && t.topOtherLeader.gens >= Math.ceil(t.sampled / 2)) {
    const leaderName = ctx.players.find((p) => p.color === t.topOtherLeader?.color)?.name ?? '';
    out.push({
      id: 'timeline.led-most-lost', group: 'timeline', priority: 84, severity: 'major', icon: 'swap',
      badge: 'Turnaround', color: t.topOtherLeader.color,
      textKey: '${0} led for most of the game, but ${1} finished stronger.',
      params: [raw(leaderName), raw(winner.name)],
      suppresses: ['timeline.lead-taken'],
    });
  }

  if (t.leadChanges >= 3) {
    out.push({
      id: 'timeline.lead-battle', group: 'timeline', priority: 82, severity: 'major', icon: 'swap',
      badge: 'Lead battle', color: winner.color,
      textKey: 'The lead changed hands ${0} times before ${1} finally kept it.',
      params: [raw(t.leadChanges), raw(winner.name)],
      suppresses: ['timeline.lead-taken'],
    });
  }

  if (t.wireToWire) {
    out.push({
      id: 'timeline.wire-to-wire', group: 'timeline', priority: 76, severity: 'major', icon: 'crown',
      badge: 'Wire to wire', color: winner.color,
      textKey: pick(seed, 'timeline.wire', [
        '${0} led from the first generation to the last.',
        'Wire to wire: ${0} never surrendered the lead.',
      ]),
      params: [raw(winner.name)],
    });
  } else if (t.winnerTookLeadGen !== undefined) {
    const phase = t.winnerTookLeadGen <= Math.ceil(generation / 3) ? 'early' : 'mid';
    out.push({
      id: 'timeline.lead-taken', group: 'timeline', priority: phase === 'early' ? 62 : 58, severity: 'normal', icon: 'flag',
      badge: 'Decisive moment', color: winner.color,
      textKey: '${0} took the lead in generation ${1} and never gave it back.',
      params: [raw(winner.name), raw(t.winnerTookLeadGen)],
    });
  }
  return out;
};

// ── 3. Reason: the category structure of the win ────────────────────────
const analyzeVictoryReasons: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const {winner, margin, seed} = ctx;
  const leads = sortedWinnerLeads(ctx);
  if (leads.length === 0) {
    return out;
  }
  const best = leads[0];
  const worst = leads[leads.length - 1];

  const profileSuppression = (catKey: EndgameCategoryKey): Array<string> => {
    const map: Partial<Record<EndgameCategoryKey, string>> = {
      tr: 'profile.terraformer', cards: 'profile.engine', board: 'profile.builder', mca: 'profile.laurels',
    };
    const id = map[catKey];
    return id !== undefined ? [id] : [];
  };

  // The category that single-handedly covered the final margin.
  if (margin > 0 && best.lead > 0 && best.lead >= margin && best.lead >= 4) {
    out.push({
      id: 'reason.decisive-category', group: 'reason', priority: 88, severity: 'decisive', icon: 'target',
      badge: 'Key category', color: winner.color,
      textKey: pick(seed, 'reason.decisive', [
        '${1} decided the match: ${0} gained +${2} VP there — more than the final margin.',
        'The win was forged in ${1}: ${0}\'s +${2} edge there outweighed the final gap.',
      ]),
      params: [raw(winner.name), key(best.cat.label), raw(best.lead)],
      suppresses: ['reason.dominant-category', ...profileSuppression(best.cat.key)],
    });
  }

  // Plain dominance of one category.
  if (best.lead >= 8) {
    out.push({
      id: 'reason.dominant-category', group: 'reason', priority: 70, severity: 'normal', icon: 'target',
      badge: 'Domination', color: winner.color,
      textKey: '${0} built the win on ${1}: +${2} VP over the closest rival.',
      params: [raw(winner.name), key(best.cat.label), raw(best.lead)],
      suppresses: profileSuppression(best.cat.key),
    });
  }

  // Compensation: gave up one category big, won another big.
  if (worst.lead <= -5 && best.lead >= 5) {
    out.push({
      id: 'reason.compensated', group: 'reason', priority: 78, severity: 'major', icon: 'target',
      badge: 'Compensation', color: winner.color,
      textKey: '${0} gave up ${1} but more than made up for it in ${2}.',
      params: [raw(winner.name), key(worst.cat.label), key(best.cat.label)],
    });
  } else if (worst.lead <= -5 && margin > 0) {
    // Won despite a clearly weak category (without one big counterweight).
    out.push({
      id: 'reason.despite-weak', group: 'reason', priority: 65, severity: 'normal', icon: 'target',
      badge: 'Against the odds', color: winner.color,
      textKey: '${0} won despite conceding ${1} VP in ${2}.',
      params: [raw(winner.name), raw(-worst.lead), key(worst.cat.label)],
    });
  }

  // Balanced: no meaningful lead anywhere, yet first place.
  if (margin > 0 && best.lead <= 3) {
    out.push({
      id: 'reason.balanced', group: 'reason', priority: 72, severity: 'normal', icon: 'hex',
      badge: 'Consistency', color: winner.color,
      textKey: pick(seed, 'reason.balanced', [
        'No single category won it — ${0} simply scored everywhere.',
        '${0} dominated nothing and won anyway: consistency across every category did the job.',
      ]),
      params: [raw(winner.name)],
      suppresses: ['profile.balanced-line'],
    });
  }

  // Small-edge fallback (keeps the reason group alive in quiet games).
  if (best.lead >= 1 && best.lead < 8) {
    const cats = leads.filter((l) => l.lead > 0).slice(0, 2);
    out.push({
      id: 'reason.top-strength', group: 'reason', priority: 38, severity: 'minor', icon: 'flag',
      badge: 'Strength', color: winner.color,
      textKey: cats.length === 2 ?
        '${0} won thanks to a lead in ${1} and ${2}.' :
        '${0} won thanks to a lead in ${1}.',
      params: [raw(winner.name), ...cats.map((c) => key(c.cat.label))],
    });
  }
  return out;
};

// ── 4. Category battles ──────────────────────────────────────────────────
const analyzeCategoryBattles: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const {winner, runnerUp, margin, categories} = ctx;
  if (runnerUp === undefined || categories.length === 0) {
    return out;
  }

  // Clean sweep / "took X of Y" (who holds the strict max of each category).
  let won = 0;
  for (const cat of categories) {
    if (cat.leaders.length === 1 && cat.leaders[0] === winner.color) {
      won++;
    }
  }
  if (won === categories.length && categories.length >= 3) {
    out.push({
      id: 'category.sweep', group: 'category', priority: 86, severity: 'major', icon: 'crown',
      badge: 'Clean sweep', color: winner.color,
      textKey: 'A clean sweep: ${0} led every single scoring category.',
      params: [raw(winner.name)],
      suppresses: ['category.most', 'reason.top-strength'],
    });
  } else if (ctx.mode === 'duel' && won >= Math.ceil(categories.length * 0.7)) {
    out.push({
      id: 'category.most', group: 'category', priority: 62, severity: 'normal', icon: 'target',
      badge: 'Category control', color: winner.color,
      textKey: '${0} took ${1} of the ${2} scoring categories.',
      params: [raw(winner.name), raw(won), raw(categories.length)],
    });
  }

  // The runner-up edge that nearly flipped the result.
  let bestRunnerEdge: {cat: EndgameCategory; lead: number} | undefined;
  for (const cat of categories) {
    const rv = cat.values[runnerUp.color] ?? 0;
    const wv = cat.values[winner.color] ?? 0;
    const lead = rv - wv;
    if (lead > (bestRunnerEdge?.lead ?? 0)) {
      bestRunnerEdge = {cat, lead};
    }
  }
  if (bestRunnerEdge !== undefined && margin > 0 && bestRunnerEdge.lead >= margin && bestRunnerEdge.lead >= 4) {
    out.push({
      id: 'category.nearly-flipped', group: 'category', priority: 80, severity: 'major', icon: 'spark',
      badge: 'Almost', color: runnerUp.color,
      textKey: '${0}\'s +${2} edge in ${1} nearly flipped the result.',
      params: [raw(runnerUp.name), key(bestRunnerEdge.cat.label), raw(bestRunnerEdge.lead)],
      suppresses: ['category.runner-strength'],
    });
  } else if (bestRunnerEdge !== undefined && bestRunnerEdge.lead >= 4) {
    out.push({
      id: 'category.runner-strength', group: 'category', priority: 50, severity: 'minor', icon: 'spark',
      badge: 'Runner-up', color: runnerUp.color,
      textKey: '${0} was clearly stronger in ${1}, but it was not enough.',
      params: [raw(runnerUp.name), key(bestRunnerEdge.cat.label)],
    });
  }
  return out;
};

// ── 5. Momentum: late-game acceleration ──────────────────────────────────
const analyzeMomentum: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const t = ctx.timeline;
  if (t === undefined || t.finalSurge === undefined) {
    return out;
  }
  const surge = t.finalSurge;
  const surgePlayer = ctx.players.find((p) => p.color === surge.color);
  if (surgePlayer === undefined) {
    return out;
  }

  if (surge.color === ctx.winner.color && surge.gain >= 10 && surge.gain >= surge.bestOtherGain * 1.5) {
    out.push({
      id: 'momentum.winner-surge', group: 'momentum', priority: 68, severity: 'normal', icon: 'surge',
      badge: 'Late surge', color: ctx.winner.color,
      textKey: '${0} accelerated at the finish: +${1} VP across the final two generations.',
      params: [raw(ctx.winner.name), raw(surge.gain)],
    });
  } else if (surge.color !== ctx.winner.color && surge.gain >= 10 && surge.gain >= surge.bestOtherGain + 4) {
    out.push({
      id: 'momentum.loser-surge', group: 'momentum', priority: 55, severity: 'normal', icon: 'surge',
      badge: 'Late surge', color: surge.color,
      textKey: '${0} had the fastest finish (+${1} VP late), but the gap was already too wide.',
      params: [raw(surgePlayer.name), raw(surge.gain)],
    });
  }

  // The score looked closer than the final margin until the very end.
  if (t.earlyGap !== undefined && ctx.margin >= 8 && t.earlyGap <= ctx.margin / 2) {
    out.push({
      id: 'momentum.pulled-away', group: 'momentum', priority: 60, severity: 'normal', icon: 'surge',
      badge: 'Endgame push', color: ctx.winner.color,
      textKey: 'The game was closer than the final score — ${0} pulled away only in the last generations.',
      params: [raw(ctx.winner.name)],
    });
  }
  return out;
};

// ── 6. Global parameters: who moved the planet ──────────────────────────
const analyzeParameters: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const {winner, players, parameters} = ctx;

  // The most one-sided parameter (one player did >= 70% of all steps, >= 4 steps).
  let bestDom: {param: EndgameParameter; color: Color; steps: number; total: number; share: number} | undefined;
  for (const param of parameters) {
    let total = 0;
    for (const v of Object.values(param.values)) {
      total += v;
    }
    if (total < 4) {
      continue;
    }
    for (const [color, v] of Object.entries(param.values)) {
      const share = v / total;
      if (share >= 0.7 && v >= 4 && (bestDom === undefined || share > bestDom.share)) {
        bestDom = {param, color: color as Color, steps: v, total, share};
      }
    }
  }
  if (bestDom !== undefined) {
    const domPlayer = players.find((p) => p.color === bestDom?.color);
    if (domPlayer !== undefined) {
      out.push({
        id: 'parameters.owned', group: 'parameters',
        priority: bestDom.color === winner.color ? 45 : 54, severity: 'minor', icon: 'globe',
        badge: 'Global parameters', color: bestDom.color,
        textKey: '${0} drove ${1} almost single-handedly: ${2} of ${3} steps.',
        params: [raw(domPlayer.name), key(bestDom.param.label), raw(bestDom.steps), raw(bestDom.total)],
      });
    }
  }

  // Terraforming mismatch: somebody out-terraformed the winner but lost.
  let topPusher: EndgamePlayerScore | undefined;
  for (const p of players) {
    if (topPusher === undefined || p.parametersTotal > topPusher.parametersTotal) {
      topPusher = p;
    }
  }
  if (topPusher !== undefined && topPusher.color !== winner.color &&
      topPusher.parametersTotal >= winner.parametersTotal + 5) {
    out.push({
      id: 'parameters.mismatch', group: 'parameters', priority: 66, severity: 'normal', icon: 'globe',
      badge: 'Terraforming', color: topPusher.color,
      textKey: '${0} out-terraformed the winner (${1} steps vs ${2}) — but the points came from elsewhere.',
      params: [raw(topPusher.name), raw(topPusher.parametersTotal), raw(winner.parametersTotal)],
    });
  } else if (topPusher !== undefined && topPusher.color === winner.color && players.length > 1) {
    const second = players.filter((p) => p.color !== winner.color)
      .reduce((m, p) => Math.max(m, p.parametersTotal), 0);
    if (winner.parametersTotal >= Math.max(8, second * 1.6)) {
      out.push({
        id: 'parameters.tempo', group: 'parameters', priority: 52, severity: 'minor', icon: 'globe',
        badge: 'Tempo', color: winner.color,
        textKey: '${0} set the terraforming tempo for the entire game (${1} steps).',
        params: [raw(winner.name), raw(winner.parametersTotal)],
      });
    }
  }
  return out;
};

// ── 7. Cards: single-card stories & penalties ────────────────────────────
const analyzeCards: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const {winner, margin, players, seed} = ctx;

  // The single best card across the table.
  let best: {owner: EndgamePlayerScore; cardName: string; vp: number} | undefined;
  for (const p of players) {
    for (const c of p.topCards) {
      if (best === undefined || c.victoryPoint > best.vp) {
        best = {owner: p, cardName: c.cardName, vp: c.victoryPoint};
      }
    }
  }
  if (best !== undefined && best.vp >= 5) {
    if (best.owner.color === winner.color) {
      out.push({
        id: 'cards.best-winner', group: 'cards', priority: 58, severity: 'normal', icon: 'cards',
        badge: 'Best card', color: winner.color,
        textKey: pick(seed, 'cards.best-winner', [
          'The game\'s most valuable card was ${1} — it brought ${0} +${2} VP.',
          '${1} was the single best card on the table: +${2} VP for ${0}.',
        ]),
        params: [raw(winner.name), card(best.cardName), raw(best.vp)],
      });
    } else {
      out.push({
        id: 'cards.best-loser', group: 'cards', priority: 63, severity: 'normal', icon: 'cards',
        badge: 'Best card', color: best.owner.color,
        textKey: 'The game\'s most valuable card (${1}, +${2} VP) belonged to ${0} — and still it was not enough.',
        params: [raw(best.owner.name), card(best.cardName), raw(best.vp)],
      });
    }
  }

  // Penalties that mattered.
  if (margin > 0) {
    for (const p of players) {
      if (p.color === winner.color) {
        continue;
      }
      const penalty = p.penaltyCards.reduce((s, c) => s + c.victoryPoint, 0);
      if (-penalty >= margin && -penalty >= 3) {
        out.push({
          id: 'cards.penalties-cost', group: 'cards', priority: 79, severity: 'major', icon: 'cards',
          badge: 'Penalties', color: p.color,
          textKey: 'Penalties cost ${0} ${1} VP — more than the final margin.',
          params: [raw(p.name), raw(-penalty)],
          suppresses: ['cards.best-winner', 'cards.best-loser'],
        });
        break;
      }
    }
  }
  const winnerPenalty = winner.penaltyCards.reduce((s, c) => s + c.victoryPoint, 0);
  if (-winnerPenalty >= 4) {
    out.push({
      id: 'cards.winner-penalties', group: 'cards', priority: 56, severity: 'minor', icon: 'cards',
      badge: 'Penalties', color: winner.color,
      textKey: '${0} won despite losing ${1} VP to penalties.',
      params: [raw(winner.name), raw(-winnerPenalty)],
    });
  }
  return out;
};

// ── 8. Standings only: the race below first place ────────────────────────
const analyzeRace: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (ctx.mode !== 'standings' || ctx.players.length < 3) {
    return out;
  }
  const [, second, third] = ctx.players;
  const gap23 = second.total - third.total;
  if (gap23 >= 0 && gap23 <= 2 && ctx.margin >= 5) {
    out.push({
      id: 'race.for-second', group: 'race', priority: 48, severity: 'minor', icon: 'spark',
      badge: 'Race for second', color: second.color,
      textKey: 'The fight for second place was the closest battle: ${0} edged ${1} by just ${2} VP.',
      params: [raw(second.name), raw(third.name), raw(gap23)],
    });
  }
  return out;
};

// ── 9. Profile line (only in quiet games — heavily suppressed) ───────────
const analyzeProfileLine: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const p = ctx.profile;
  if (p === undefined || p.kind === 'balanced') {
    // The balanced thought is owned by reason.balanced; the hero chip shows
    // the profile anyway.
    return out;
  }
  const TEXT: Record<Exclude<VictoryProfileKind, 'balanced'>, string> = {
    terraformer: '${0}\'s victory was built on terraforming: ${1}% of the score came from terraform rating.',
    engine: 'A card-engine victory: ${1}% of ${0}\'s score came from cards.',
    builder: '${0} won through the board: cities and greenery delivered ${1}% of the score.',
    laurels: 'Milestones and awards carried ${0}: ${1}% of the final score.',
  };
  out.push({
    id: 'profile.' + p.kind, group: 'profile', priority: 35, severity: 'minor', icon: 'hex',
    badge: 'Victory profile', color: ctx.winner.color,
    textKey: TEXT[p.kind],
    params: [raw(ctx.winner.name), raw(p.share)],
  });
  return out;
};

const ANALYZERS: ReadonlyArray<Analyzer> = [
  analyzeVerdict,
  analyzeTimeline,
  analyzeVictoryReasons,
  analyzeCategoryBattles,
  analyzeMomentum,
  analyzeParameters,
  analyzeCards,
  analyzeRace,
  analyzeProfileLine,
];

// ─────────────────────────────────────────────────────────────────────────
// Selection
// ─────────────────────────────────────────────────────────────────────────

export const MAX_INSIGHTS = 6;

// Reading order of the final list (story flow), independent of priority.
const GROUP_ORDER: ReadonlyArray<InsightGroup> =
  ['verdict', 'timeline', 'reason', 'category', 'momentum', 'cards', 'parameters', 'race', 'profile'];

export function selectInsights(candidates: ReadonlyArray<InsightCandidate>, max: number = MAX_INSIGHTS): Array<EndgameInsightView> {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const usedGroups = new Set<InsightGroup>();
  const suppressed = new Set<string>();
  const picked: Array<InsightCandidate> = [];
  for (const c of sorted) {
    if (picked.length >= max) {
      break;
    }
    if (usedGroups.has(c.group) || suppressed.has(c.id)) {
      continue;
    }
    usedGroups.add(c.group);
    for (const s of c.suppresses ?? []) {
      suppressed.add(s);
    }
    picked.push(c);
  }
  picked.sort((a, b) =>
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || b.priority - a.priority);
  return picked;
}

export function generateInsights(ctx: InsightContext): Array<EndgameInsightView> {
  if (ctx.mode === 'solo') {
    return [];
  }
  const candidates: Array<InsightCandidate> = [];
  for (const analyzer of ANALYZERS) {
    candidates.push(...analyzer(ctx));
  }
  return selectInsights(candidates);
}
