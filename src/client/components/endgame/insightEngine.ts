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
import {CardName} from '@/common/cards/CardName';
import type {EndgameFact, FactType, FactTag} from '@/common/events/endgameFacts';
import {analyzeSpecialCardStories} from '@/client/components/endgame/specialCardStories';
import {buildGameStoryDna, type GameStoryDNA} from '@/client/components/endgame/gameStoryDna';
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
  | 'globe' | 'cards' | 'hex' | 'flag' | 'spark'
  // Iteration 11 — a richer registry so a card's TYPE reads from its icon at a glance.
  | 'coin' // economy
  | 'orbit' // colony
  | 'transfer' // steal / transfer (distinct from destroy)
  | 'trophy' // award
  | 'medal' // milestone
  | 'eye' // reveal / card flow
  | 'lock' // unused potential / leftover
  | 'cog' // blue action engine
  | 'star' // special / rare card
  | 'split' // duel style contrast
  | 'finish'; // photo finish / tiebreaker

// `raw` — final text (names, numbers); `i18n` — an English key the component
// translates (category/parameter labels); `card` — a card name ($t translates
// card names by exact match too).
export type InsightParam = {t: 'raw' | 'i18n' | 'card'; v: string};

/**
 * The STORY family an insight belongs to — a finer classification than `group`
 * (which is the legacy dedup unit). Drives the premium UI accent + lets the selector
 * keep the final story diverse (one strong card per family).
 */
export type InsightFamily =
  | 'verdict' | 'turningPoint' | 'economy' | 'blueAction' | 'passiveEngine'
  | 'negativeDrama' | 'colony' | 'standardProject' | 'globalParameter' | 'reveal'
  | 'unusedPotential' | 'runnerUpStory' | 'rareEvent' | 'cardStory' | 'boardStory'
  | 'duelContrast'; // Iteration 7 — 2-player rivalry stories

/** How prominently to render an insight (the UI hierarchy). */
export type InsightUiVariant =
  | 'hero' | 'major' | 'normal' | 'compact' | 'timeline' | 'comparison' | 'warning' | 'legendary';

/** Where the selector placed an insight in the final story. */
export type InsightRankSection = 'hero' | 'primary' | 'secondary' | 'hidden';

/**
 * Iteration 9 — the NARRATIVE role an insight plays in the composed report (set by the
 * composer from the Game Story DNA). Lets the UI lay out story SECTIONS (headline / key
 * moments / player arcs / details) rather than a flat grid. Optional → legacy paths
 * (selectStoryInsights without DNA) leave it undefined.
 */
export type StoryRole =
  | 'headline' // the composed "why this game was special" hero
  | 'whyWinnerWon' // the winner's decisive lever
  | 'whyRunnerLost' // where the runner-up fell short
  | 'turningPoint' // the moment the game swung
  | 'signatureMoment' // a defining beat (on the story spine)
  | 'twist' // a "against expectation" detail
  | 'contrast' // the duel style contrast
  | 'almost' // how close the runner-up got
  | 'rareDetail' // a rare/unusual fact
  | 'supportingDetail' // solid colour
  | 'warning' // a pressure/threat note
  | 'trivia'; // filler (quiet games)

/**
 * Iteration 10 — the report SECTION an insight is laid out under (the UX director's
 * grouping). Derived by the composer from the role + the involved player. The UI renders
 * a header per section ("Почему победил" / "Почему не дожал" / …).
 */
export type StorySection =
  | 'mainStory' // the hero — the headline of the game
  | 'whyWinnerWon' // the winner's decisive levers
  | 'whyRunnerLost' // where the runner-up fell short
  | 'highlights' // the unusual / rare episodes
  | 'details'; // supporting colour + "show more"

/**
 * Iteration 10 — a small metric/label CHIP rendered under a hero / family card so the
 * card SHOWS the evidence (a number + a meaning), not just prose. `t:'raw'` is final
 * text (a composed number like "−9 ПО"); `t:'i18n'` is an English label key the UI
 * translates ("скидки + бонусы оплаты"). `tone` drives the chip colour.
 */
export type EvidenceChip = {t: 'raw' | 'i18n'; v: string; tone?: 'metric' | 'good' | 'bad' | 'neutral'};

/**
 * The scoring components a fact-based analyzer can supply so the smart selector can
 * rank by more than raw `priority` (a rare/dramatic event should out-rank a routine
 * category note). All 0..1; absent → treated as 0 (so legacy analyzers are unaffected).
 */
export type InsightScores = {
  impact?: number;
  rarity?: number;
  drama?: number;
  confidence?: number;
  relevance?: number;
  /** Iteration 7: a DUEL-mode bonus (0..1) — set high by the duel analyzers for
   *  rivalry/contrast/award-race insights so they rank above generic facts in a
   *  2-player game. Ignored (0) elsewhere, so multiplayer is unaffected. */
  duelRelevance?: number;
};

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

  // ── Iteration 5: story metadata (all optional → legacy analyzers unchanged) ──
  /** The story family (premium UI accent + selector diversity unit). */
  family?: InsightFamily;
  /** Preferred render prominence (the selector may downgrade it by section). */
  uiVariant?: InsightUiVariant;
  /** A diversity key — the selector keeps at most one per cluster in the primary band. */
  storyCluster?: string;
  /** Scoring components for the smart selector (0..1 each). */
  scores?: InsightScores;
  /** Drill-down handles for the UI / debug. */
  relatedFactIds?: ReadonlyArray<string>;
  relatedPlayers?: ReadonlyArray<Color>;
  relatedCards?: ReadonlyArray<CardName>;
  relatedGeneration?: number;

  // ── Set by the smart selector (selectStoryInsights) ──
  /** Which band the selector placed this in (hero / primary / secondary / hidden). */
  rankSection?: InsightRankSection;
  /** The combined score the selector ranked by (for debug). */
  finalScore?: number;

  // ── Iteration 9: set by the narrative composer (composeStory) ──
  /** A score adjustment from the Game Story DNA: + for on-story candidates, − for
   *  off-story generics. Folded into {@link finalScore}. Absent → 0 (legacy paths). */
  storyBoost?: number;
  /** The narrative role in the composed report (headline / twist / contrast / …). */
  storyRole?: StoryRole;

  // ── Iteration 10: dedup + section + chips ──
  /** The "what thought is this" identity for EVIDENCE DEDUP — two visible cards must not
   *  share one. Absent → derived from `storyCluster` + the involved players. */
  evidenceKey?: string;
  /** The report section the UI lays this under (set by the composer). */
  storySection?: StorySection;
  /** Small metric/label chips so a hero / family card SHOWS its evidence. */
  evidenceChips?: ReadonlyArray<EvidenceChip>;
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
  /**
   * OPTIONAL analysis-ready facts (Iteration 4 bridge — `buildEndgameFacts(events)`).
   * Future fact-based analyzers read these via the `facts*` selection helpers below;
   * absent today (the existing template analyzers don't need them), so wiring the feed
   * is non-breaking. This is the prepared integration path, NOT a rewrite.
   */
  facts?: ReadonlyArray<EndgameFact>;
  /** Each player's played-card names — lets a rare analyzer detect card presence
   *  (Vermin / Predators) that the facts alone don't name. Optional → graceful. */
  playerCards?: Partial<Record<Color, ReadonlyArray<CardName>>>;
  /** Resource COUNT on a player's cards (card name → units) — lets Vermin 2.0 read the
   *  animals on Vermin (precision the facts don't carry). Optional → graceful. */
  cardResources?: Partial<Record<Color, Partial<Record<CardName, number>>>>;
};

// ── Fact selection helpers (the bridge for future fact-based analyzers) ──────────
// Stable, pure selectors over `ctx.facts` so a new analyzer reads facts without
// re-deriving them. All return [] when no facts are wired (graceful).

export function factsByType(ctx: InsightContext, type: FactType): ReadonlyArray<EndgameFact> {
  return (ctx.facts ?? []).filter((f) => f.type === type);
}
export function factsByPlayer(ctx: InsightContext, player: Color): ReadonlyArray<EndgameFact> {
  return (ctx.facts ?? []).filter((f) => f.player === player);
}
export function factsByTag(ctx: InsightContext, tag: FactTag): ReadonlyArray<EndgameFact> {
  return (ctx.facts ?? []).filter((f) => f.tags.includes(tag));
}
export function factsByGeneration(ctx: InsightContext, generation: number): ReadonlyArray<EndgameFact> {
  return (ctx.facts ?? []).filter((f) => f.generation === generation);
}
/** The strongest facts overall (severity desc), optionally limited. */
export function topFactsBySeverity(ctx: InsightContext, limit = 5): ReadonlyArray<EndgameFact> {
  return [...(ctx.facts ?? [])].sort((a, b) => b.severity - a.severity).slice(0, limit);
}
function topByType(ctx: InsightContext, type: FactType, limit: number): ReadonlyArray<EndgameFact> {
  return [...factsByType(ctx, type)].sort((a, b) => b.severity - a.severity).slice(0, limit);
}
export function topEconomyFacts(ctx: InsightContext, limit = 3): ReadonlyArray<EndgameFact> {
  return topByType(ctx, 'economy', limit);
}
export function topActionFacts(ctx: InsightContext, limit = 3): ReadonlyArray<EndgameFact> {
  return topByType(ctx, 'actionUsage', limit);
}
export function topNegativeFacts(ctx: InsightContext, limit = 3): ReadonlyArray<EndgameFact> {
  return topByType(ctx, 'negativeInteraction', limit);
}
export function topGlobalFacts(ctx: InsightContext, limit = 3): ReadonlyArray<EndgameFact> {
  return topByType(ctx, 'globalParameter', limit);
}

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

// Evidence-chip helpers (Iteration 10): a composed number, or an i18n label.
const chipN = (v: number | string, tone: EvidenceChip['tone'] = 'metric'): EvidenceChip => ({t: 'raw', v: String(v), tone});
const chipL = (v: string, tone: EvidenceChip['tone'] = 'neutral'): EvidenceChip => ({t: 'i18n', v, tone});

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
      family: 'verdict', uiVariant: 'legendary', storyCluster: 'verdict',
      scores: {rarity: 0.95, drama: 0.9, impact: 1, confidence: 1},
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
      family: 'verdict', uiVariant: 'hero', storyCluster: 'verdict',
      scores: {rarity: 0.8, drama: 0.85, impact: 0.9, confidence: 1},
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
      family: 'turningPoint', uiVariant: 'hero', storyCluster: 'turningPoint',
      // Mini-timeline chips: how far down → it turned → the final margin.
      evidenceChips: [chipN(`−${t.maxDeficit}`, 'bad'), chipL('then took the lead', 'good'), chipN(`+${ctx.margin}`, 'good')],
      scores: {rarity: 0.8, drama: 0.85, impact: 0.9, relevance: 1, confidence: 1},
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

// ─────────────────────────────────────────────────────────────────────────
// Iteration 5: FACT-BASED analyzers — the real story of THIS game (ctx.facts).
// Honest with confidence: economy/colony savings are "measured value" / units, never
// invented exact M€. Each is thresholded so it only fires when genuinely notable.
// ─────────────────────────────────────────────────────────────────────────

function playerName(ctx: InsightContext, color: Color): string {
  return ctx.players.find((p) => p.color === color)?.name ?? '';
}
function metric(f: EndgameFact, k: string): number {
  return f.metrics[k] ?? 0;
}
function hasCard(ctx: InsightContext, color: Color, card: CardName): boolean {
  return (ctx.playerCards?.[color] ?? []).includes(card);
}
function boardVp(ctx: InsightContext, color: Color): number {
  return ctx.categories.find((c) => c.key === 'board')?.values[color] ?? 0;
}

// What KIND of economy this was — for an honest source chip (don't blur everything
// into one "+N"). Returns an i18n label key + whether it's exact M€ or measured value.
function economySource(f: EndgameFact): {label: string; exact: boolean} {
  const discount = metric(f, 'discountAndPaymentSaved');
  const valueBonus = metric(f, 'paymentValueBonus');
  const tradeDisc = metric(f, 'tradeDiscountMegacredits');
  if (discount > 0 && valueBonus > 0) {
    return {label: 'discounts + payment bonuses', exact: false};
  }
  if (valueBonus > 0 && discount === 0) {
    return {label: 'steel & titanium value', exact: false};
  }
  if (tradeDisc > 0 && discount === 0 && valueBonus === 0) {
    return {label: 'trade discounts', exact: false};
  }
  // Pure discounts / resource-as-payment are exact M€ savings.
  return {label: 'card discounts', exact: valueBonus === 0 && tradeDisc === 0};
}
// "+N M€" for exact, "+N учтённой выгоды" for mixed/measured units.
function economyValueChip(saved: number, exact: boolean): EvidenceChip {
  return chipN(exact ? `+${saved} M€` : `+${saved}`, 'good');
}

// ── Economy engine (carried a player) + economy-underdog win ──
const analyzeEconomyFacts: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const econ = factsByType(ctx, 'economy');
  if (econ.length === 0) {
    return out;
  }
  const top = [...econ].sort((a, b) => metric(b, 'savedMegacredits') - metric(a, 'savedMegacredits'))[0];
  const saved = metric(top, 'savedMegacredits');
  if (saved >= 12) {
    const src = economySource(top);
    const isWinner = top.player === ctx.winner.color;
    const chips: Array<EvidenceChip> = [economyValueChip(saved, src.exact), chipL(src.label)];
    chips.push(src.exact ? chipL('exact', 'good') : chipL('measured', 'neutral'));
    out.push({
      id: 'fact.economy.engine', group: 'reason', priority: isWinner ? 60 : 56, severity: 'major', icon: 'spark',
      badge: 'Economy engine', color: top.player,
      // Carried-the-winner framing when it's the winner; otherwise a strong-economy note.
      // (The SOURCE — discounts / payment bonuses — rides the chip, so the prose stays clean.)
      textKey: isWinner ?
        'Economy gave ${0} the headroom to win: ${1} of value fed the tempo that decided it.' :
        'Economy did the work for ${0}: ${1} of value built up across the game.',
      params: [raw(playerName(ctx, top.player)), raw(saved)],
      family: 'economy', uiVariant: 'major', storyCluster: 'economy',
      evidenceKey: `economy:${top.player}`, evidenceChips: chips,
      scores: {impact: Math.min(1, saved / 40), confidence: src.exact ? 0.95 : 0.8, relevance: 0.7},
      relatedFactIds: [top.id], relatedPlayers: [top.player],
    });
  }
  // Underdog: the winner was out-economised yet still won (efficiency over economy).
  const winnerSaved = metric(econ.find((f) => f.player === ctx.winner.color) ?? {metrics: {}} as EndgameFact, 'savedMegacredits');
  const oppBest = econ.filter((f) => f.player !== ctx.winner.color)
    .sort((a, b) => metric(b, 'savedMegacredits') - metric(a, 'savedMegacredits'))[0];
  if (oppBest !== undefined && metric(oppBest, 'savedMegacredits') >= 15 && winnerSaved * 2 < metric(oppBest, 'savedMegacredits')) {
    out.push({
      id: 'fact.economy.underdog', group: 'reason', priority: 74, severity: 'major', icon: 'crown',
      badge: 'Economy upset', color: ctx.winner.color,
      textKey: 'Not richer, just sharper: ${1} banked more economy, but ${0} converted fewer resources into more points.',
      params: [raw(ctx.winner.name), raw(playerName(ctx, oppBest.player))],
      family: 'economy', uiVariant: 'major', storyCluster: 'economyUpset',
      evidenceKey: 'economyUpset',
      evidenceChips: [chipN(`${metric(oppBest, 'savedMegacredits')} vs ${winnerSaved}`, 'neutral'), chipL('efficiency', 'good')],
      scores: {rarity: 0.7, drama: 0.6, relevance: 0.8, confidence: 0.8},
      relatedPlayers: [ctx.winner.color, oppBest.player],
    });
  }
  return out;
};

// ── Blue-action engine + unused engine ──
const analyzeBlueActionFacts: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const actions = factsByType(ctx, 'actionUsage');
  const topAction = [...actions].sort((a, b) => metric(b, 'activations') - metric(a, 'activations'))[0];
  if (topAction !== undefined && metric(topAction, 'activations') >= 4 && topAction.sourceCard !== undefined) {
    out.push({
      id: 'fact.action.engine', group: 'cards', priority: 56, severity: 'normal', icon: 'spark',
      badge: 'Action engine', color: topAction.player,
      textKey: 'Blue-action engine: ${0} fired ${1} times for ${2}.',
      params: [card(topAction.sourceCard), raw(metric(topAction, 'activations')), raw(playerName(ctx, topAction.player))],
      family: 'blueAction', uiVariant: 'normal', storyCluster: 'actionEngine',
      evidenceChips: [chipN(`×${metric(topAction, 'activations')}`, 'good'), chipL('blue action', 'neutral')],
      scores: {impact: Math.min(1, metric(topAction, 'activations') / 10), confidence: 1, relevance: 0.6},
      relatedFactIds: [topAction.id], relatedPlayers: [topAction.player], relatedCards: [topAction.sourceCard],
    });
  }
  // Built but never activated — an unrealised engine.
  const unused = factsByType(ctx, 'engineTiming')
    .filter((f) => metric(f, 'neverActivated') === 1 && metric(f, 'availableGenerations') >= 4 && f.sourceCard !== undefined)
    .sort((a, b) => metric(b, 'availableGenerations') - metric(a, 'availableGenerations'))[0];
  if (unused !== undefined && unused.sourceCard !== undefined) {
    out.push({
      id: 'fact.action.unused', group: 'cards', priority: 50, severity: 'minor', icon: 'flag',
      badge: 'Unused engine', color: unused.player,
      textKey: 'Engine built, never switched on: ${0} sat unused for ${1} generations after ${2} played it.',
      params: [card(unused.sourceCard), raw(metric(unused, 'availableGenerations')), raw(playerName(ctx, unused.player))],
      family: 'unusedPotential', uiVariant: 'compact', storyCluster: 'unused',
      scores: {rarity: 0.5, drama: 0.4, relevance: 0.5, confidence: 1},
      relatedFactIds: [unused.id], relatedPlayers: [unused.player], relatedCards: [unused.sourceCard],
    });
  }
  return out;
};

// ── Negative drama: most-targeted player, biggest hit, Predators ──
const analyzeNegativeDramaFacts: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const attacks = factsByType(ctx, 'negativeInteraction');
  if (attacks.length === 0) {
    return out;
  }
  // Most-targeted: sum losses by victim.
  const byVictim = new Map<Color, {lost: number; hits: number}>();
  for (const f of attacks) {
    if (f.targetPlayer === undefined) {
      continue;
    }
    const v = byVictim.get(f.targetPlayer) ?? {lost: 0, hits: 0};
    v.lost += metric(f, 'totalLost');
    v.hits += metric(f, 'hits');
    byVictim.set(f.targetPlayer, v);
  }
  const topVictim = [...byVictim.entries()].sort((a, b) => b[1].lost - a[1].lost)[0];
  if (topVictim !== undefined && topVictim[1].lost >= 6) {
    out.push({
      id: 'fact.negative.targeted', group: 'cards', priority: 60, severity: 'normal', icon: 'target',
      badge: 'Under fire', color: topVictim[0],
      textKey: '${0} took the brunt of the aggression — ${1} resources lost to opponents across ${2} hits.',
      params: [raw(playerName(ctx, topVictim[0])), raw(topVictim[1].lost), raw(topVictim[1].hits)],
      family: 'negativeDrama', uiVariant: 'normal', storyCluster: 'attackPressure',
      evidenceKey: `attack:${topVictim[0]}`,
      evidenceChips: [chipN(`−${topVictim[1].lost}`, 'bad'), chipN(`×${topVictim[1].hits}`, 'neutral'), chipL('under fire', 'bad')],
      // In a duel every attack lands on the single opponent — it weighs more.
      scores: {drama: Math.min(1, topVictim[1].lost / 12), relevance: ctx.mode === 'duel' ? 0.8 : 0.6, confidence: 1, duelRelevance: ctx.mode === 'duel' ? 0.75 : 0},
      relatedPlayers: [topVictim[0]],
    });
  }
  // Predators — source-aware (the attacker owns Predators) + threshold-tuned:
  // 6+ animals = rare/major raid; 3–5 = a normal hunt. Picks the biggest such hit.
  const predatorHit = attacks
    .filter((f) => metric(f, 'Animal') >= 3 && hasCard(ctx, f.player, CardName.PREDATORS))
    .sort((a, b) => metric(b, 'Animal') - metric(a, 'Animal'))[0];
  if (predatorHit !== undefined) {
    const animals = metric(predatorHit, 'Animal');
    const big = animals >= 6;
    out.push({
      id: 'fact.negative.predators', group: 'cards', priority: big ? 78 : 62, severity: big ? 'major' : 'normal', icon: 'target',
      badge: 'Predators', color: predatorHit.player,
      textKey: big ?
        'Predators went hunting: ${0} devoured ${1} animals from ${2} — a rare, painful raid.' :
        'Predators kept feeding: ${0} took ${1} animals from ${2}.',
      params: [raw(playerName(ctx, predatorHit.player)), raw(animals), raw(playerName(ctx, predatorHit.targetPlayer ?? predatorHit.player))],
      family: 'rareEvent', uiVariant: big ? 'major' : 'normal', storyCluster: 'predators',
      scores: {rarity: big ? 0.85 : 0.55, drama: big ? 0.8 : 0.55, relevance: 0.6, confidence: 1},
      relatedPlayers: [predatorHit.player, ...(predatorHit.targetPlayer !== undefined ? [predatorHit.targetPlayer] : [])],
      relatedCards: [CardName.PREDATORS],
    });
  }
  return out;
};

// ── Vermin 2.0: a rare VP-pressure threat — precise about the animals on Vermin ──
// FALSE-POSITIVE FIX: Vermin only matters once it has grown MEANINGFUL animals (its
// rule docks city VP at scoring), so a played-but-empty Vermin yields NO insight. The
// animal count comes from ctx.cardResources (the facts don't carry it); absent → no
// claim (graceful). We never invent an exact VP delta — only "pressure".
const analyzeVerminDrama: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const verminOwner = ctx.players.find((p) => hasCard(ctx, p.color, CardName.VERMIN));
  if (verminOwner === undefined) {
    return out;
  }
  const animals = ctx.cardResources?.[verminOwner.color]?.[CardName.VERMIN] ?? 0;
  if (animals < 4) {
    return out; // played but not grown — not a story
  }
  // The most city-heavy OTHER player (board VP) is the one Vermin pressures.
  const victim = ctx.players
    .filter((p) => p.color !== verminOwner.color)
    .sort((a, b) => boardVp(ctx, b.color) - boardVp(ctx, a.color))[0];
  if (victim === undefined || boardVp(ctx, victim.color) < 8) {
    return out;
  }
  const strong = animals >= 8; // approaching the 10-animal full effect
  // The threat reads stronger when the Vermin owner builds fewer cities themselves.
  const ownerLighter = boardVp(ctx, verminOwner.color) * 1.5 < boardVp(ctx, victim.color);
  out.push({
    id: 'fact.vermin.pressure', group: 'cards', priority: strong ? 84 : 76, severity: 'major', icon: 'spark',
    badge: 'Vermin', color: verminOwner.color,
    textKey: ownerLighter ?
      'A rat infestation: ${0} grew ${1} animals on Vermin — a hidden tax on the cities ${2} built the game around.' :
      'A rat infestation: ${0} grew ${1} animals on Vermin, pressuring everyone’s cities — ${2} most of all.',
    params: [raw(verminOwner.name), raw(animals), raw(victim.name)],
    family: 'rareEvent', uiVariant: 'major', storyCluster: 'vermin',
    scores: {rarity: 0.85, drama: strong ? 0.8 : 0.65, relevance: ownerLighter ? 0.65 : 0.5, confidence: 0.6},
    relatedPlayers: [verminOwner.color, victim.color], relatedCards: [CardName.VERMIN],
  });
  return out;
};

// ── Runner-up story: why second place nearly got there ──
const analyzeRunnerUpStory: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const ru = ctx.runnerUp;
  if (ru === undefined || ctx.margin <= 0 || ctx.margin > 20) {
    return out; // a tiebreaker / a runaway is told elsewhere
  }
  // The category where the runner-up most out-scored the WINNER.
  let bestCat: {cat: EndgameCategory; edge: number} | undefined;
  for (const cat of ctx.categories) {
    const edge = (cat.values[ru.color] ?? 0) - (cat.values[ctx.winner.color] ?? 0);
    if (edge > 0 && (bestCat === undefined || edge > bestCat.edge)) {
      bestCat = {cat, edge};
    }
  }
  // The winner's strongest category (what they beat the runner-up with).
  const winnerLead = sortedWinnerLeads(ctx)[0];
  if (bestCat !== undefined && bestCat.edge >= 5 && winnerLead !== undefined && winnerLead.lead >= 5) {
    out.push({
      id: 'fact.runnerup.category', group: 'race', priority: 64, severity: 'normal', icon: 'scale',
      badge: 'So close', color: ru.color,
      textKey: '${0} won the ${1} race, but ${2} covered it with ${3} — and that was the difference.',
      params: [raw(ru.name), key(bestCat.cat.label), raw(ctx.winner.name), key(winnerLead.cat.label)],
      family: 'runnerUpStory', uiVariant: 'comparison', storyCluster: 'runnerUp',
      evidenceKey: `almost:${ru.color}`,
      evidenceChips: [chipN(`+${bestCat.edge}`, 'good'), chipL('not enough', 'bad')],
      scores: {drama: 0.5, relevance: 0.7, rarity: ctx.margin <= 5 ? 0.55 : 0.3, confidence: 1},
      relatedPlayers: [ru.color, ctx.winner.color],
    });
  }
  // The runner-up had the better economy engine but couldn't convert it.
  const ruEcon = factsByType(ctx, 'economy').find((f) => f.player === ru.color);
  const winEcon = factsByType(ctx, 'economy').find((f) => f.player === ctx.winner.color);
  if (ruEcon !== undefined && metric(ruEcon, 'savedMegacredits') >= 18 &&
      (winEcon === undefined || metric(ruEcon, 'savedMegacredits') > metric(winEcon, 'savedMegacredits') * 1.5)) {
    out.push({
      id: 'fact.runnerup.economy', group: 'reason', priority: 54, severity: 'minor', icon: 'spark',
      badge: 'So close', color: ru.color,
      textKey: '${0} had the better economy but couldn’t turn it into the win.',
      params: [raw(ru.name)],
      family: 'runnerUpStory', uiVariant: 'compact', storyCluster: 'runnerUpEconomy',
      evidenceKey: 'economyUpset',
      scores: {relevance: 0.55, drama: 0.4, confidence: 0.8},
      relatedPlayers: [ru.color],
    });
  }
  return out;
};

// ── Category structure: one-pillar vs two-pillar vs secondary strength ──
const analyzeCategoryStructure: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const leads = sortedWinnerLeads(ctx).filter((l) => l.lead > 0);
  if (leads.length < 2) {
    return out;
  }
  const first = leads[0];
  const second = leads[1];
  // TWO-PILLAR: the second pillar is also substantial (not dwarfed by the first).
  if (second.lead >= 5 && second.lead >= first.lead * 0.55) {
    out.push({
      id: 'fact.category.twopillar', group: 'category', priority: 57, severity: 'normal', icon: 'crown',
      badge: 'Two pillars', color: ctx.winner.color,
      textKey: 'Built on two pillars: ${0} led ${1} (+${2}) and ${3} (+${4}).',
      params: [raw(ctx.winner.name), key(first.cat.label), raw(first.lead), key(second.cat.label), raw(second.lead)],
      family: 'cardStory', uiVariant: 'normal', storyCluster: 'categoryStructure',
      evidenceChips: [chipN(`+${first.lead}`, 'good'), chipN(`+${second.lead}`, 'good')],
      scores: {relevance: 0.6, impact: Math.min(1, (first.lead + second.lead) / 30), confidence: 1},
      // The soft "won via one category" line is redundant when the win had two pillars.
      suppresses: ['reason.dominant-category'],
      relatedPlayers: [ctx.winner.color],
    });
  } else if (first.lead >= 8 && second.lead >= 4) {
    // SECONDARY STRENGTH: a clear main pillar, but a meaningful backup worth naming.
    out.push({
      id: 'fact.category.secondary', group: 'category', priority: 44, severity: 'minor', icon: 'crown',
      badge: 'And more', color: ctx.winner.color,
      textKey: 'Not just ${1}: ${0} also banked a ${2} edge in ${3}.',
      params: [raw(ctx.winner.name), key(first.cat.label), raw(second.lead), key(second.cat.label)],
      family: 'cardStory', uiVariant: 'compact', storyCluster: 'categorySecondary',
      scores: {relevance: 0.45, confidence: 1},
      relatedPlayers: [ctx.winner.color],
    });
  }
  return out;
};

// ── Standard-project strategy (infrastructure over cards) ──
const analyzeStandardProjectStrategy: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const top = [...factsByType(ctx, 'standardProject')].sort((a, b) => metric(b, 'projects') - metric(a, 'projects'))[0];
  if (top === undefined || metric(top, 'projects') < 5) {
    return out;
  }
  const steps = metric(top, 'parameterSteps');
  out.push({
    id: 'fact.standardProject.strategy', group: 'parameters', priority: 52, severity: 'normal', icon: 'hex',
    badge: 'Plan B', color: top.player,
    textKey: steps >= 4 ?
      'Infrastructure plan: ${0} ran ${1} standard projects, terraforming Mars directly (${2} parameter steps).' :
      'Plan B paid off: ${0} leaned on ${1} standard projects when the card engine ran thin.',
    params: [raw(playerName(ctx, top.player)), raw(metric(top, 'projects')), raw(steps)],
    family: 'standardProject', uiVariant: 'normal', storyCluster: 'standardProject',
    scores: {impact: Math.min(1, metric(top, 'projects') / 10), relevance: 0.55, confidence: 1},
    relatedFactIds: [top.id], relatedPlayers: [top.player],
  });
  return out;
};

// ── Unused potential: money / engine left on the table ──
const analyzeUnusedPotential: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  // A big leftover M€ pile — economy that never became points.
  const richest = [...ctx.players].sort((a, b) => b.megacredits - a.megacredits)[0];
  if (richest !== undefined && richest.megacredits >= 30) {
    const isWinner = richest.color === ctx.winner.color;
    out.push({
      id: 'fact.unused.money', group: 'cards', priority: isWinner ? 46 : 56, severity: 'minor', icon: 'flag',
      badge: 'On the table', color: richest.color,
      textKey: isWinner ?
        '${0} still had ${1} M€ in the bank at the finish — plenty of unspent runway.' :
        'Money with nowhere to go: ${0} ended on ${1} M€ that never became points.',
      params: [raw(richest.name), raw(richest.megacredits)],
      family: 'unusedPotential', uiVariant: 'compact', storyCluster: 'unusedMoney',
      evidenceKey: `unused:${richest.color}`,
      evidenceChips: [chipN(`${richest.megacredits} M€`, 'neutral'), chipL('never spent', 'bad')],
      scores: {relevance: isWinner ? 0.35 : 0.6, drama: 0.4, confidence: 1},
      relatedPlayers: [richest.color],
    });
  }
  return out;
};

// ── Resource hoard: building material (steel + titanium) left unspent at the finish ──
// (Iteration 11 — final-inventory bridge. Honest: steel/titanium never become VP directly,
//  so this is "material that never became projects", never a fake "could have won".)
const analyzeResourceHoard: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  let best: {p: EndgamePlayerScore; steel: number; titanium: number; mat: number} | undefined;
  for (const p of ctx.players) {
    const lo = p.leftover;
    if (lo === undefined) {
      continue; // old game / no final-inventory bridge → graceful
    }
    const mat = lo.steel + lo.titanium;
    if (mat >= 16 && (best === undefined || mat > best.mat)) {
      best = {p, steel: lo.steel, titanium: lo.titanium, mat};
    }
  }
  if (best === undefined) {
    return out;
  }
  const isWinner = best.p.color === ctx.winner.color;
  out.push({
    id: `fact.resourceHoard.${best.p.color}`, group: 'cards', priority: isWinner ? 43 : 53, severity: 'minor', icon: 'flag',
    badge: 'Unspent', color: best.p.color,
    textKey: isWinner ?
      '${0} finished with ${1} steel and ${2} titanium to spare — building material the win didn’t even need.' :
      'Building material left on the table: ${0} ended on ${1} steel and ${2} titanium that never became projects.',
    params: [raw(best.p.name), raw(best.steel), raw(best.titanium)],
    family: 'unusedPotential', uiVariant: 'compact', storyCluster: 'resourceHoard',
    // Shares the per-player "unused" key with leftover-M€ → a player gets ONE "on the table" card.
    evidenceKey: `unused:${best.p.color}`,
    evidenceChips: [chipN(`${best.steel}+${best.titanium}`, 'neutral'), chipL('unspent material', 'bad')],
    scores: {relevance: isWinner ? 0.3 : 0.55, drama: 0.35, confidence: 1},
    relatedPlayers: [best.p.color],
  });
  return out;
};

// ── Notable single moments (the biggest one-off events) ──
const analyzeNotableMoments: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const notables = factsByType(ctx, 'notableEvent');
  const burst = notables.find((f) => f.id === 'notable:economyBurst');
  if (burst !== undefined && metric(burst, 'savedMegacredits') >= 12) {
    out.push({
      id: 'fact.notable.economyBurst', group: 'momentum', priority: 50, severity: 'minor', icon: 'surge',
      badge: 'Burst', color: burst.player,
      textKey: 'A late surge of value: ${0} banked ${1} of measured economy in generation ${2}.',
      params: [raw(playerName(ctx, burst.player)), raw(metric(burst, 'savedMegacredits')), raw(burst.generation ?? 0)],
      family: 'economy', uiVariant: 'compact', storyCluster: 'economyBurst',
      scores: {impact: Math.min(1, metric(burst, 'savedMegacredits') / 24), relevance: 0.45, confidence: 0.85},
      relatedFactIds: [burst.id], relatedPlayers: [burst.player], relatedGeneration: burst.generation,
    });
  }
  return out;
};

// ── Who moved the planet (global parameters) ──
const analyzeGlobalParameterFacts: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const top = [...factsByType(ctx, 'globalParameter')].sort((a, b) => metric(b, 'totalSteps') - metric(a, 'totalSteps'))[0];
  if (top === undefined || metric(top, 'totalSteps') < 6) {
    return out;
  }
  out.push({
    id: 'fact.global.driver', group: 'parameters', priority: 48, severity: 'normal', icon: 'globe',
    badge: 'Terraformer', color: top.player,
    textKey: '${0} drove the terraforming — ${1} parameter steps moved this game.',
    params: [raw(playerName(ctx, top.player)), raw(metric(top, 'totalSteps'))],
    family: 'globalParameter', uiVariant: 'compact', storyCluster: 'terraform',
    evidenceChips: [chipN(`${metric(top, 'totalSteps')}`, 'metric'), chipL('parameter steps', 'neutral')],
    scores: {impact: Math.min(1, metric(top, 'totalSteps') / 20), relevance: 0.5, confidence: 1},
    relatedFactIds: [top.id], relatedPlayers: [top.player],
  });
  return out;
};

// ── Card-flow advantage (reveal / search) ──
const analyzeRevealFacts: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const top = [...factsByType(ctx, 'reveal')].sort((a, b) => (metric(b, 'revealed') + metric(b, 'shown')) - (metric(a, 'revealed') + metric(a, 'shown')))[0];
  if (top === undefined) {
    return out;
  }
  const seen = metric(top, 'revealed') + metric(top, 'shown');
  if (seen < 5) {
    return out;
  }
  out.push({
    id: 'fact.reveal.flow', group: 'cards', priority: 46, severity: 'minor', icon: 'cards',
    badge: 'Card flow', color: top.player,
    textKey: 'Card-flow edge: ${0} saw ${1} extra cards through reveals and searches.',
    params: [raw(playerName(ctx, top.player)), raw(seen)],
    family: 'reveal', uiVariant: 'compact', storyCluster: 'reveal',
    evidenceChips: [chipN(`${seen}`, 'metric'), chipL('cards seen', 'neutral')],
    scores: {impact: Math.min(1, seen / 12), relevance: 0.45, confidence: 1},
    relatedFactIds: [top.id], relatedPlayers: [top.player],
  });
  return out;
};

// ── Colony engine + DOMINATION (asymmetry) ──
// Honesty: a "colony domination" story only fires on a genuine ASYMMETRY — one player
// traded far more than the others. If everyone traded similarly, it's just an engine note
// (or nothing). Never claim "colonies decided it" off a couple of even trades.
const analyzeColonyFacts: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const colonies = [...factsByType(ctx, 'colony')].sort((a, b) => metric(b, 'trades') - metric(a, 'trades'));
  const top = colonies[0];
  if (top === undefined || metric(top, 'trades') < 4) {
    return out;
  }
  const topTrades = metric(top, 'trades');
  const totalTrades = colonies.reduce((s, f) => s + metric(f, 'trades'), 0);
  const secondTrades = colonies[1] !== undefined ? metric(colonies[1], 'trades') : 0;
  const share = totalTrades > 0 ? topTrades / totalTrades : 1;
  const track = metric(top, 'trackBonusSteps');
  const discountUnits = metric(top, 'tradeDiscountUnits');
  // DOMINATION: one player owned the colony game (share ≥ 70% or ≥ 3 more trades) AND it
  // mattered (≥ 5 trades). The second player barely touched colonies.
  const domination = topTrades >= 5 && (share >= 0.7 || topTrades - secondTrades >= 3);
  if (domination) {
    const chips: Array<EvidenceChip> = [chipN(`${topTrades} vs ${secondTrades}`, 'good'), chipL('one-sided colonies', 'good')];
    if (track > 0) {
      chips.push(chipL('track bonuses', 'neutral'));
    }
    out.push({
      id: 'fact.colony.domination', group: 'reason', priority: 60, severity: 'major', icon: 'hex',
      badge: 'Colony control', color: top.player,
      textKey: secondTrades === 0 ?
        'Colonies were a one-player game: ${0} traded ${1} times while the rest left them alone — a private engine.' :
        'Colonies tilted one way: ${0} traded ${1} times to ${2}’s ${3}, turning the colony track into a personal engine.',
      params: [raw(playerName(ctx, top.player)), raw(topTrades),
        raw(colonies[1] !== undefined ? playerName(ctx, colonies[1].player) : ''), raw(secondTrades)],
      family: 'colony', uiVariant: 'major', storyCluster: 'colonyDomination',
      evidenceKey: 'colony', evidenceChips: chips,
      scores: {impact: Math.min(1, topTrades / 12), rarity: 0.55, drama: 0.5, relevance: 0.65, confidence: 0.8},
      relatedFactIds: [top.id], relatedPlayers: colonies[1] !== undefined ? [top.player, colonies[1].player] : [top.player],
    });
    return out; // domination supersedes the plain engine note
  }
  // Plain engine note (no clear asymmetry) — enrich with the track/discount angle if present.
  const chips: Array<EvidenceChip> = [chipN(`${topTrades}`, 'metric'), chipL('trades', 'neutral')];
  if (track > 0) {
    chips.push(chipL('track bonuses', 'good'));
  } else if (discountUnits > 0) {
    chips.push(chipL('trade discounts', 'good'));
  }
  out.push({
    id: 'fact.colony.engine', group: 'cards', priority: 47, severity: 'minor', icon: 'hex',
    badge: 'Colony engine', color: top.player,
    textKey: track > 0 ?
      'Colonies powered ${0}: ${1} trades, boosted by the colony track.' :
      'Colonies powered ${0}: ${1} trades fed the engine.',
    params: [raw(playerName(ctx, top.player)), raw(topTrades)],
    family: 'colony', uiVariant: 'compact', storyCluster: 'colony',
    evidenceKey: 'colony', evidenceChips: chips,
    scores: {impact: Math.min(1, topTrades / 12), relevance: 0.45, confidence: 0.8},
    relatedFactIds: [top.id], relatedPlayers: [top.player],
  });
  return out;
};

// ═════════════════════════════════════════════════════════════════════════
// Iteration 7: DUEL-SPECIFIC analyzers (mode === 'duel') — the story of a 2-player
// RIVALRY, not just "winner won categories". All gate on a duel + a runner-up, set a
// high `duelRelevance` so they surface, and involve BOTH players where possible.
// ═════════════════════════════════════════════════════════════════════════

function isDuel(ctx: InsightContext): boolean {
  return ctx.mode === 'duel' && ctx.runnerUp !== undefined;
}

/** A short STYLE label (i18n key) for a player, from their dominant signal. */
function duelStyle(ctx: InsightContext, p: EndgamePlayerScore): string {
  const econ = factsByType(ctx, 'economy').find((f) => f.player === p.color);
  const action = factsByType(ctx, 'actionUsage').filter((f) => f.player === p.color);
  const colony = factsByType(ctx, 'colony').find((f) => f.player === p.color);
  const sp = factsByType(ctx, 'standardProject').find((f) => f.player === p.color);
  const reveal = factsByType(ctx, 'reveal').find((f) => f.player === p.color);
  const attacks = factsByType(ctx, 'negativeInteraction').filter((f) => f.player === p.color);
  if (attacks.reduce((s, f) => s + metric(f, 'totalLost'), 0) >= 8) {
    return 'Disruptor';
  }
  if (sp !== undefined && metric(sp, 'projects') >= 5) {
    return 'Standard Project Builder';
  }
  if (colony !== undefined && metric(colony, 'trades') >= 5) {
    return 'Colony Trader';
  }
  if (action.reduce((s, f) => s + metric(f, 'activations'), 0) >= 6) {
    return 'Blue Action Engine';
  }
  if (econ !== undefined && metric(econ, 'savedMegacredits') >= 18) {
    return 'Economy Engine';
  }
  if (reveal !== undefined && (metric(reveal, 'revealed') + metric(reveal, 'shown')) >= 6) {
    return 'Card Flow';
  }
  // Fall back to the player's strongest VP category.
  switch (p.strongestCategory) {
  case 'tr': return 'Terraformer';
  case 'cards': return 'Card Engine';
  case 'board': return 'Board Builder';
  case 'mca': return 'Award Hunter';
  default: return 'Balanced';
  }
}

// ── Duel style contrast — two plans collide ──
const analyzeDuelStyleContrast: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (!isDuel(ctx) || ctx.runnerUp === undefined) {
    return out;
  }
  const wStyle = duelStyle(ctx, ctx.winner);
  const rStyle = duelStyle(ctx, ctx.runnerUp);
  if (wStyle === rStyle || wStyle === 'Balanced' || rStyle === 'Balanced') {
    return out; // no clear contrast to tell
  }
  out.push({
    id: 'duel.styleContrast', group: 'reason', priority: 70, severity: 'major', icon: 'scale',
    badge: 'Clash of styles', color: ctx.winner.color,
    textKey: 'Two plans: ${0} played as ${1}, ${2} as ${3} — and ${4} prevailed.',
    params: [raw(ctx.winner.name), key(wStyle), raw(ctx.runnerUp.name), key(rStyle), key(wStyle)],
    family: 'duelContrast', uiVariant: 'hero', storyCluster: 'duelContrast',
    evidenceChips: [chipL(wStyle, 'good'), chipL(rStyle, 'neutral')],
    scores: {rarity: 0.5, drama: 0.6, relevance: 0.8, duelRelevance: 1, confidence: 1},
    relatedPlayers: [ctx.winner.color, ctx.runnerUp.color],
  });
  return out;
};

/** Parse the two players' award/milestone detail rows into a per-name view. */
function awardOutcomes(ctx: InsightContext): Map<string, {funder?: string; entries: Array<{player: EndgamePlayerScore; place: string; points: number}>}> {
  const awards = new Map<string, {funder?: string; entries: Array<{player: EndgamePlayerScore; place: string; points: number}>}>();
  for (const p of ctx.players) {
    for (const d of p.breakdown.detailsAwards) {
      const args = d.messageArgs ?? [];
      const name = args[1];
      if (name === undefined) {
        continue;
      }
      const a = awards.get(name) ?? {funder: args[2], entries: []};
      a.funder = a.funder ?? args[2];
      a.entries.push({player: p, place: args[0] ?? '', points: d.victoryPoint});
      awards.set(name, a);
    }
  }
  return awards;
}

// ── Award race — the sponsor who lost their own award / a swing bigger than the margin ──
const analyzeAwardRace: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (!isDuel(ctx)) {
    return out;
  }
  let sponsorLost: {award: string; funder: EndgamePlayerScore; winner: EndgamePlayerScore; points: number} | undefined;
  let bestSwing: {award: string; winner: EndgamePlayerScore; swing: number} | undefined;
  for (const [award, info] of awardOutcomes(ctx)) {
    const first = info.entries.find((e) => e.place === '1st') ??
      [...info.entries].sort((a, b) => b.points - a.points)[0];
    if (first === undefined || first.points === 0) {
      continue;
    }
    const other = info.entries.find((e) => e.player.color !== first.player.color);
    const swing = first.points - (other?.points ?? 0);
    if (bestSwing === undefined || swing > bestSwing.swing) {
      bestSwing = {award, winner: first.player, swing};
    }
    const funder = info.funder !== undefined ? ctx.players.find((p) => p.name === info.funder) : undefined;
    if (funder !== undefined && funder.color !== first.player.color && sponsorLost === undefined) {
      sponsorLost = {award, funder, winner: first.player, points: first.points};
    }
  }
  if (sponsorLost !== undefined) {
    out.push({
      id: 'duel.award.sponsorLost', group: 'category', priority: 76, severity: 'major', icon: 'flag',
      badge: 'Backfired', color: sponsorLost.winner.color,
      textKey: 'A bet that backfired: ${0} funded the ${1} award, but ${2} took the ${3} VP for it.',
      params: [raw(sponsorLost.funder.name), key(sponsorLost.award), raw(sponsorLost.winner.name), raw(sponsorLost.points)],
      family: 'duelContrast', uiVariant: 'major', storyCluster: 'awardRace',
      evidenceKey: `award:${sponsorLost.award}`,
      evidenceChips: [chipL(sponsorLost.award), chipN(`+${sponsorLost.points}`, 'good'), chipL('sponsor lost it', 'bad')],
      scores: {rarity: 0.65, drama: 0.75, relevance: 0.8, duelRelevance: 1, confidence: 1},
      relatedPlayers: [sponsorLost.funder.color, sponsorLost.winner.color],
    });
  } else if (bestSwing !== undefined && ctx.margin > 0 && bestSwing.swing >= ctx.margin && bestSwing.swing >= 3) {
    out.push({
      id: 'duel.award.swing', group: 'category', priority: 66, severity: 'normal', icon: 'scale',
      badge: 'Award swing', color: bestSwing.winner.color,
      textKey: 'The ${0} award alone swung ${1} VP — more than the ${2}-VP final margin.',
      params: [key(bestSwing.award), raw(bestSwing.swing), raw(ctx.margin)],
      family: 'duelContrast', uiVariant: 'normal', storyCluster: 'awardRace',
      evidenceKey: `award:${bestSwing.award}`,
      evidenceChips: [chipL(bestSwing.award), chipN(`+${bestSwing.swing}`, 'good'), chipN(`> ${ctx.margin}`, 'neutral')],
      scores: {rarity: 0.5, drama: 0.6, relevance: 0.75, duelRelevance: 0.9, confidence: 1},
      relatedPlayers: [bestSwing.winner.color],
    });
  }
  return out;
};

// ── Milestone race — who locked the milestones (claims are confirmed; no "almost") ──
const analyzeMilestoneRace: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (!isDuel(ctx) || ctx.runnerUp === undefined) {
    return out;
  }
  const claims = new Map<Color, number>();
  for (const p of ctx.players) {
    claims.set(p.color, p.breakdown.detailsMilestones.length);
  }
  const wClaims = claims.get(ctx.winner.color) ?? 0;
  const rClaims = claims.get(ctx.runnerUp.color) ?? 0;
  // Lockout: the winner took several milestones and the runner-up none.
  if (wClaims >= 2 && rClaims === 0) {
    out.push({
      id: 'duel.milestone.lockout', group: 'momentum', priority: 64, severity: 'normal', icon: 'flag',
      badge: 'Milestone lockout', color: ctx.winner.color,
      textKey: '${0} locked the board, claiming ${1} milestones before ${2} could answer.',
      params: [raw(ctx.winner.name), raw(wClaims), raw(ctx.runnerUp.name)],
      family: 'duelContrast', uiVariant: 'normal', storyCluster: 'milestoneRace',
      scores: {rarity: 0.5, drama: 0.55, relevance: 0.7, duelRelevance: 0.85, confidence: 1},
      relatedPlayers: [ctx.winner.color, ctx.runnerUp.color],
    });
  } else if (rClaims > 0 && wClaims > 0 && (wClaims + rClaims) >= 3) {
    out.push({
      id: 'duel.milestone.contested', group: 'momentum', priority: 50, severity: 'minor', icon: 'swap',
      badge: 'Milestone race', color: ctx.winner.color,
      textKey: 'A contested board: the milestones split ${0}–${1} between ${2} and ${3}.',
      params: [raw(wClaims), raw(rClaims), raw(ctx.winner.name), raw(ctx.runnerUp.name)],
      family: 'duelContrast', uiVariant: 'compact', storyCluster: 'milestoneRace',
      scores: {drama: 0.4, relevance: 0.55, duelRelevance: 0.7, confidence: 1},
      relatedPlayers: [ctx.winner.color, ctx.runnerUp.color],
    });
  }
  return out;
};

// ── Category counterplay — A won X, B won Y ──
const analyzeDuelCategoryCounterplay: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (!isDuel(ctx) || ctx.runnerUp === undefined) {
    return out;
  }
  const w = ctx.winner.color;
  const r = ctx.runnerUp.color;
  let winnerCat: {cat: EndgameCategory; lead: number} | undefined;
  let runnerCat: {cat: EndgameCategory; lead: number} | undefined;
  for (const cat of ctx.categories) {
    const wv = cat.values[w] ?? 0;
    const rv = cat.values[r] ?? 0;
    if (wv - rv > 0 && (winnerCat === undefined || wv - rv > winnerCat.lead)) {
      winnerCat = {cat, lead: wv - rv};
    }
    if (rv - wv > 0 && (runnerCat === undefined || rv - wv > runnerCat.lead)) {
      runnerCat = {cat, lead: rv - wv};
    }
  }
  if (winnerCat !== undefined && runnerCat !== undefined && winnerCat.lead >= 5 && runnerCat.lead >= 5) {
    out.push({
      id: 'duel.counterplay', group: 'category', priority: 62, severity: 'normal', icon: 'target',
      badge: 'Counterplay', color: ctx.winner.color,
      textKey: '${0} vs ${1}: ${2} took ${3}, ${4} answered with ${5} — but ${2}’s edge held.',
      params: [key(winnerCat.cat.label), key(runnerCat.cat.label), raw(ctx.winner.name), key(winnerCat.cat.label), raw(ctx.runnerUp.name), key(runnerCat.cat.label)],
      family: 'duelContrast', uiVariant: 'comparison', storyCluster: 'counterplay',
      evidenceChips: [chipL(winnerCat.cat.label, 'good'), chipL(runnerCat.cat.label, 'neutral')],
      scores: {drama: 0.5, relevance: 0.75, duelRelevance: 0.95, confidence: 1},
      relatedPlayers: [w, r],
    });
  }
  return out;
};

// ── Economy conversion — efficiency over raw economy (duel framing) ──
const analyzeDuelEconomyConversion: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  const ru = ctx.runnerUp;
  if (!isDuel(ctx) || ru === undefined) {
    return out;
  }
  const wEcon = metric(factsByType(ctx, 'economy').find((f) => f.player === ctx.winner.color) ?? {metrics: {}} as EndgameFact, 'savedMegacredits');
  const rEcon = metric(factsByType(ctx, 'economy').find((f) => f.player === ru.color) ?? {metrics: {}} as EndgameFact, 'savedMegacredits');
  if (rEcon >= 15 && rEcon > wEcon * 1.4) {
    out.push({
      id: 'duel.economyConversion', group: 'reason', priority: 73, severity: 'major', icon: 'spark',
      badge: 'Efficiency', color: ctx.winner.color,
      textKey: '${0} wasn’t richer than ${1} — just more efficient, turning fewer resources into more points.',
      params: [raw(ctx.winner.name), raw(ru.name)],
      family: 'duelContrast', uiVariant: 'major', storyCluster: 'economyUpset', // dedups with the generic underdog
      evidenceKey: 'economyUpset',
      evidenceChips: [chipL('efficiency over economy', 'good')],
      scores: {rarity: 0.6, drama: 0.5, relevance: 0.8, duelRelevance: 1, confidence: 0.8},
      suppresses: ['fact.economy.underdog'],
      relatedPlayers: [ctx.winner.color, ru.color],
    });
  }
  return out;
};

// ── "Almost" — how close the runner-up got ──
const analyzeDuelAlmost: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (!isDuel(ctx) || ctx.runnerUp === undefined || ctx.margin <= 0 || ctx.margin > 12) {
    return out;
  }
  const ru = ctx.runnerUp;
  // Penalties cost the match: the runner-up's penalty VP exceeded the final margin.
  const penalty = ru.penaltyCards.reduce((s, c) => s + Math.abs(c.victoryPoint), 0);
  if (penalty > 0 && penalty >= ctx.margin) {
    out.push({
      id: 'duel.almost.penalty', group: 'cards', priority: 68, severity: 'normal', icon: 'flag',
      badge: 'So close', color: ru.color,
      textKey: 'Penalties decided it: ${0} lost ${1} VP to penalties — more than the ${2}-VP gap.',
      params: [raw(ru.name), raw(penalty), raw(ctx.margin)],
      family: 'runnerUpStory', uiVariant: 'normal', storyCluster: 'almostPenalty',
      evidenceKey: `almost:${ru.color}`,
      evidenceChips: [chipN(`−${penalty}`, 'bad'), chipL('penalties', 'bad')],
      scores: {drama: 0.6, relevance: 0.75, rarity: 0.5, duelRelevance: 0.9, confidence: 1},
      relatedPlayers: [ru.color],
    });
  }
  // Leftover M€ exceeded the gap (factual; framed as "had it found a use", no fake VP).
  if (ru.megacredits >= ctx.margin && ru.megacredits >= 10) {
    out.push({
      id: 'duel.almost.money', group: 'cards', priority: 48, severity: 'minor', icon: 'flag',
      badge: 'So close', color: ru.color,
      textKey: '${0} finished on ${1} M€ — more than the ${2}-VP gap, had it found a use.',
      params: [raw(ru.name), raw(ru.megacredits), raw(ctx.margin)],
      family: 'unusedPotential', uiVariant: 'compact', storyCluster: 'almostMoney',
      evidenceKey: `almost:${ru.color}`,
      evidenceChips: [chipN(`${ru.megacredits} M€`, 'neutral'), chipL('no outlet', 'bad')],
      scores: {relevance: 0.55, drama: 0.4, duelRelevance: 0.7, confidence: 0.7},
      relatedPlayers: [ru.color],
    });
  }
  return out;
};

// ─────────────────────────────────────────────────────────────────────────
// Iteration 10: more UNUSUAL-shape analyzers (honest, standings/category-derived).
// ─────────────────────────────────────────────────────────────────────────

// ── One-category trap: a non-winner who dominated ONE category but lost the breadth ──
const analyzeOneCategoryTrap: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (ctx.players.length < 2 || ctx.margin <= 0) {
    return out;
  }
  // The biggest single-category lead held by a NON-winner over the field.
  let best: {p: EndgamePlayerScore; cat: EndgameCategory; lead: number} | undefined;
  for (const p of ctx.players) {
    if (p.color === ctx.winner.color) {
      continue;
    }
    for (const cat of ctx.categories) {
      const mine = cat.values[p.color] ?? 0;
      const fieldBest = Math.max(...ctx.players.filter((o) => o.color !== p.color).map((o) => cat.values[o.color] ?? 0));
      const lead = mine - fieldBest;
      if (lead >= 12 && (best === undefined || lead > best.lead)) {
        best = {p, cat, lead};
      }
    }
  }
  if (best === undefined) {
    return out;
  }
  const trap = best;
  // It's a "trap" only if that one category was their ONLY real strength — measured
  // consistently from the category VALUES (same source as the lead above).
  const otherLeads = ctx.categories
    .filter((c) => c.key !== trap.cat.key)
    .reduce((s, c) => s + Math.max(0, (c.values[trap.p.color] ?? 0) - (c.values[ctx.winner.color] ?? 0)), 0);
  if (otherLeads > trap.lead * 0.4) {
    return out; // they were broad too — not a trap
  }
  out.push({
    id: `story.oneCategoryTrap.${best.p.color}`, group: 'category', priority: 57, severity: 'normal', icon: 'target',
    badge: 'One-track', color: best.p.color,
    textKey: '${0} ran away with ${1} (+${2}), but the win needed breadth — ${3} scored across the board instead.',
    params: [raw(best.p.name), key(best.cat.label), raw(best.lead), raw(ctx.winner.name)],
    family: 'cardStory', uiVariant: 'normal', storyCluster: 'oneCategoryTrap',
    evidenceKey: `oneCategoryTrap:${best.p.color}`,
    evidenceChips: [chipL(best.cat.label), chipN(`+${best.lead}`, 'good'), chipL('but lost the breadth', 'bad')],
    scores: {rarity: 0.55, drama: 0.45, relevance: 0.65, confidence: 1},
    relatedPlayers: [best.p.color, ctx.winner.color],
  });
  return out;
};

// ── Narrow efficiency win: the winner dominated NOTHING, yet had enough everywhere ──
const analyzeNarrowEfficiency: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (ctx.runnerUp === undefined || ctx.margin <= 0 || ctx.margin > 15) {
    return out;
  }
  // A genuinely FLAT win: the winner needs at least one positive category lead (so we
  // have data + they actually won races) but NONE reaching 6 — "enough everywhere,
  // dominant nowhere". A 6+ lead is a real edge → not this story.
  const topLead = sortedWinnerLeads(ctx)[0];
  if (topLead === undefined || topLead.lead <= 0 || topLead.lead >= 6) {
    return out;
  }
  out.push({
    id: 'story.narrowEfficiency', group: 'reason', priority: 55, severity: 'normal', icon: 'scale',
    badge: 'Enough everywhere', color: ctx.winner.color,
    textKey: '${0} didn’t dominate any single race — just had enough in each to edge ${1} by ${2}.',
    params: [raw(ctx.winner.name), raw(ctx.runnerUp.name), raw(ctx.margin)],
    family: 'cardStory', uiVariant: 'normal', storyCluster: 'narrowEfficiency',
    evidenceKey: 'narrowEfficiency',
    evidenceChips: [chipN(`+${ctx.margin}`, 'good'), chipL('balanced edge', 'neutral')],
    // Soft-suppress the "dominant category" line — there wasn't one.
    suppresses: ['reason.dominant-category'],
    scores: {rarity: 0.5, relevance: 0.6, confidence: 1},
    relatedPlayers: [ctx.winner.color, ctx.runnerUp.color],
  });
  return out;
};

// ─────────────────────────────────────────────────────────────────────────
// Iteration 9: CROSS-FACT analyzers — connect TWO fact areas.
// A single-family analyzer says "X had economy". A cross-fact analyzer says
// "X had economy but it never became points" — the connection is where the
// "why THIS game was special" feeling lives. Each gates on data presence +
// thresholds, is confidence-aware, and never invents VP/M€.
// ─────────────────────────────────────────────────────────────────────────

// A · Economy → Scoring conversion: a non-winner with the strongest economy whose
//     card scoring stayed low — the money bought tempo, not the points that decide it.
const analyzeEconomyConversionMismatch: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  let best: {p: EndgamePlayerScore; saved: number} | undefined;
  for (const p of ctx.players) {
    if (p.color === ctx.winner.color) {
      continue;
    }
    const econ = factsByType(ctx, 'economy').find((f) => f.player === p.color);
    const saved = econ !== undefined ? metric(econ, 'savedMegacredits') : 0;
    const cardsVp = p.categories.cards ?? 0;
    if (saved >= 20 && cardsVp <= 6 && (best === undefined || saved > best.saved)) {
      best = {p, saved};
    }
  }
  if (best !== undefined) {
    out.push({
      id: `xfact.econConv.${best.p.color}`, group: 'reason', priority: 58, severity: 'normal', icon: 'spark',
      badge: 'Tempo, not points', color: best.p.color,
      textKey: '${0} built the strongest economy — about ${1} of measured value — but it bought tempo, not the points that decide the game.',
      params: [raw(best.p.name), raw(best.saved)],
      family: 'economy', uiVariant: 'normal', storyCluster: 'economyConversion',
      evidenceKey: `economy:${best.p.color}`,
      evidenceChips: [chipN(`+${best.saved}`, 'neutral'), chipL('tempo not points', 'bad')],
      scores: {impact: 0.5, rarity: 0.55, drama: 0.45, relevance: 0.7, confidence: 0.75},
      relatedPlayers: [best.p.color],
    });
  }
  return out;
};

// B · Card flow → Cards category: heavy card flow that DID (winner) or DID NOT
//     (a loser) turn into card scoring.
const analyzeCardFlowToCards: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  for (const p of ctx.players) {
    const reveal = factsByType(ctx, 'reveal').find((f) => f.player === p.color);
    if (reveal === undefined) {
      continue;
    }
    const flow = metric(reveal, 'revealed') + metric(reveal, 'shown');
    if (flow < 6) {
      continue;
    }
    const cardsVp = p.categories.cards ?? 0;
    const isWinner = p.color === ctx.winner.color;
    if (cardsVp >= 12 && isWinner) {
      out.push({
        id: `xfact.cardFlow.fed.${p.color}`, group: 'reason', priority: 60, severity: 'normal', icon: 'cards',
        badge: 'Card flow', color: p.color,
        textKey: '${0} kept the cards coming (${1} seen) and converted that flow into ${2} VP of card scoring — the engine that won.',
        params: [raw(p.name), raw(flow), raw(cardsVp)],
        family: 'reveal', uiVariant: 'normal', storyCluster: 'cardFlow',
        scores: {impact: 0.55, rarity: 0.55, drama: 0.4, relevance: 0.75, confidence: 0.8},
        relatedPlayers: [p.color],
      });
    } else if (cardsVp <= 5 && !isWinner) {
      out.push({
        id: `xfact.cardFlow.stalled.${p.color}`, group: 'cards', priority: 50, severity: 'minor', icon: 'cards',
        badge: 'Cards, not points', color: p.color,
        textKey: '${0} saw plenty of cards (${1}), but little of it became score — the flow never turned into a card engine.',
        params: [raw(p.name), raw(flow)],
        family: 'reveal', uiVariant: 'compact', storyCluster: 'cardFlow',
        scores: {rarity: 0.5, drama: 0.4, relevance: 0.6, confidence: 0.75},
        relatedPlayers: [p.color],
      });
    }
  }
  // One card-flow story is enough — keep the strongest (winner-fed outranks stalled).
  return out.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).slice(0, 1);
};

// C · Global parameters → category mismatch: the top terraformer didn't win, or the
//     winner barely moved the planet (the points came from cards/laurels, not the board).
const analyzeGlobalParamMismatch: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  if (ctx.players.length < 2) {
    return out;
  }
  const topTerraformer = [...ctx.players].sort((a, b) => b.parametersTotal - a.parametersTotal)[0];
  if (topTerraformer.parametersTotal < 8) {
    return out; // nobody really moved the planet
  }
  if (topTerraformer.color !== ctx.winner.color && topTerraformer.parametersTotal >= ctx.winner.parametersTotal + 4) {
    out.push({
      id: `xfact.globalMismatch.${topTerraformer.color}`, group: 'parameters', priority: 61, severity: 'normal', icon: 'globe',
      badge: 'Moved the planet, lost', color: topTerraformer.color,
      textKey: '${0} did the most terraforming (${1} parameter steps), but the win was decided off the visible board.',
      params: [raw(topTerraformer.name), raw(topTerraformer.parametersTotal)],
      family: 'globalParameter', uiVariant: 'normal', storyCluster: 'globalMismatch',
      scores: {impact: 0.5, rarity: 0.6, drama: 0.5, relevance: 0.75, confidence: 0.85},
      relatedPlayers: [topTerraformer.color, ctx.winner.color],
    });
  } else if (ctx.winner.parametersTotal <= 4 && ((ctx.winner.categories.cards ?? 0) + (ctx.winner.categories.mca ?? 0)) >= 25) {
    out.push({
      id: 'xfact.globalMismatch.winnerNoTerraform', group: 'parameters', priority: 60, severity: 'normal', icon: 'globe',
      badge: 'Won without the planet', color: ctx.winner.color,
      textKey: '${0} barely touched the global parameters and still won — the points came from cards and laurels, not the planet.',
      params: [raw(ctx.winner.name)],
      family: 'globalParameter', uiVariant: 'normal', storyCluster: 'globalMismatch',
      scores: {impact: 0.5, rarity: 0.6, drama: 0.45, relevance: 0.75, confidence: 0.8},
      relatedPlayers: [ctx.winner.color],
    });
  }
  return out;
};

// D · Negative pressure → damaged strategy: the biggest attack that landed on a victim
//     whose plan it actually hit (plant attacks vs a board-heavy player).
const analyzeAttackDamagedStrategy: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  let best: {f: EndgameFact; victim: EndgamePlayerScore; lost: number} | undefined;
  for (const f of factsByType(ctx, 'negativeInteraction')) {
    const lost = metric(f, 'totalLost');
    if (f.targetPlayer === undefined || lost < 6) {
      continue;
    }
    const victim = ctx.players.find((p) => p.color === f.targetPlayer);
    if (victim !== undefined && (best === undefined || lost > best.lost)) {
      best = {f, victim, lost};
    }
  }
  if (best === undefined) {
    return out;
  }
  const hitBoard = metric(best.f, 'plants') > 0 && best.victim.strongestCategory === 'board';
  out.push(hitBoard ? {
    id: `xfact.attackDamage.${best.victim.color}`, group: 'cards', priority: 59, severity: 'normal', icon: 'target',
    badge: 'Hit the plan', color: best.f.player,
    textKey: 'The pressure landed where it hurt: ${0} lost ${1} resources to attacks while leaning on the board — their strongest plan took the hit.',
    params: [raw(best.victim.name), raw(best.lost)],
    family: 'negativeDrama', uiVariant: 'normal', storyCluster: 'attackDamage',
    evidenceKey: `attack:${best.victim.color}`,
    evidenceChips: [chipN(`−${best.lost}`, 'bad'), chipL('hit the board plan', 'bad')],
    scores: {impact: 0.5, rarity: 0.6, drama: 0.6, relevance: 0.7, confidence: 0.7},
    relatedPlayers: [best.f.player, best.victim.color],
  } : {
    id: `xfact.attackDamage.${best.victim.color}`, group: 'cards', priority: 52, severity: 'normal', icon: 'target',
    badge: 'Under fire', color: best.f.player,
    textKey: '${0} spent the game under fire, losing ${1} resources to opponents’ attacks.',
    params: [raw(best.victim.name), raw(best.lost)],
    family: 'negativeDrama', uiVariant: 'compact', storyCluster: 'attackDamage',
    evidenceKey: `attack:${best.victim.color}`,
    evidenceChips: [chipN(`−${best.lost}`, 'bad'), chipL('under fire', 'bad')],
    scores: {impact: 0.4, rarity: 0.5, drama: 0.5, relevance: 0.6, confidence: 0.7},
    relatedPlayers: [best.f.player, best.victim.color],
  });
  return out;
};

// E · Standard projects → card scoring: heavy standard-project use AND low card-VP —
//     projects carried the game in place of a card engine (the richer "plan B" framing
//     of the plain strategy line). Grounded in two KNOWN quantities (projects used vs
//     the cards category), never an unmeasured "draw quality" claim.
const analyzeProjectCardStarvation: Analyzer = (ctx) => {
  const out: Array<InsightCandidate> = [];
  for (const p of ctx.players) {
    const sp = factsByType(ctx, 'standardProject').find((f) => f.player === p.color);
    if (sp === undefined || metric(sp, 'projects') < 5) {
      continue;
    }
    // Only "plan B" when card scoring stayed low — otherwise it's a genuine multi-prong
    // strategy and the neutral base line (fact.standardProject.strategy) tells it.
    if ((p.categories.cards ?? 0) > 6) {
      continue;
    }
    out.push({
      id: `xfact.projectStarvation.${p.color}`, group: 'reason', priority: 56, severity: 'normal', icon: 'hex',
      badge: 'Plan B', color: p.color,
      textKey: '${0} leaned on ${1} standard projects rather than a card engine — the steady, reliable plan when cards weren’t the answer.',
      params: [raw(p.name), raw(metric(sp, 'projects'))],
      family: 'standardProject', uiVariant: 'normal', storyCluster: 'projectStarvation',
      scores: {impact: 0.45, rarity: 0.55, drama: 0.4, relevance: 0.65, confidence: 0.75},
      suppresses: ['fact.standardProject.strategy'],
      relatedPlayers: [p.color],
    });
    break; // one is enough
  }
  return out;
};

const FACT_ANALYZERS: ReadonlyArray<Analyzer> = [
  analyzeEconomyFacts,
  analyzeBlueActionFacts,
  analyzeNegativeDramaFacts,
  analyzeVerminDrama,
  analyzeGlobalParameterFacts,
  analyzeRevealFacts,
  analyzeColonyFacts,
  // Iteration 6 — deep story expansion.
  analyzeRunnerUpStory,
  analyzeCategoryStructure,
  analyzeStandardProjectStrategy,
  analyzeUnusedPotential,
  analyzeNotableMoments,
  // Iteration 7 — duel-specific.
  analyzeDuelStyleContrast,
  analyzeAwardRace,
  analyzeMilestoneRace,
  analyzeDuelCategoryCounterplay,
  analyzeDuelEconomyConversion,
  analyzeDuelAlmost,
  // Iteration 8 — special card story registry (source-aware card attacks).
  analyzeSpecialCardStories,
  // Iteration 9 — cross-fact analyzers (connect two fact areas).
  analyzeEconomyConversionMismatch,
  analyzeCardFlowToCards,
  analyzeGlobalParamMismatch,
  analyzeAttackDamagedStrategy,
  analyzeProjectCardStarvation,
  // Iteration 10 — more unusual shapes.
  analyzeOneCategoryTrap,
  analyzeNarrowEfficiency,
  // Iteration 11 — final-inventory: building material left unspent.
  analyzeResourceHoard,
];

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

// ─────────────────────────────────────────────────────────────────────────
// Iteration 5: the SMART story selector (fact-aware, ranked, hierarchical)
// ─────────────────────────────────────────────────────────────────────────

export const STORY_HERO_MAX = 1;
export const STORY_PRIMARY_MAX = 6;
export const STORY_SECONDARY_MAX = 8;

/** A combined rank: raw priority + the fact scores (a rare/dramatic event out-ranks a
 *  routine note), scaled by confidence so a shaky `partial` fact can't dominate. */
export function finalScore(c: InsightCandidate): number {
  const s = c.scores ?? {};
  const conf = s.confidence ?? 1;
  const bonus = ((s.impact ?? 0) * 40 + (s.rarity ?? 0) * 60 + (s.drama ?? 0) * 40 + (s.relevance ?? 0) * 20) * conf;
  // Duel-mode rivalry bonus (added flat — it's already gated to duel by the analyzer
  // only setting it in a 2-player game, so multiplayer candidates carry 0).
  // `storyBoost` (Iteration 9): the Game Story DNA's on-story reward / off-story penalty.
  return c.priority + bonus + (s.duelRelevance ?? 0) * 30 + (c.storyBoost ?? 0);
}

/** The diversity key (one strong card per cluster in the primary band). */
function clusterOf(c: InsightCandidate): string {
  return c.storyCluster ?? c.family ?? c.group;
}

// ─────────────────────────────────────────────────────────────────────────
// Iteration 11: VISUAL IDENTITY — a card's TYPE reads from its icon at a glance.
// A central registry maps cluster (most specific) → family (fallback) → an icon, so
// the composer can set a meaningful icon without editing every analyzer. Different
// SEMANTIC families get DISTINCT icons (the guard test enforces it).
// ─────────────────────────────────────────────────────────────────────────

const ICON_BY_CLUSTER: Readonly<Record<string, InsightIcon>> = {
  // economy
  economy: 'coin', economyUpset: 'coin', economyConversion: 'coin', economyBurst: 'surge', runnerUpEconomy: 'coin',
  // colony
  colony: 'orbit', colonyDomination: 'orbit',
  // awards / milestones
  awardRace: 'trophy', milestoneRace: 'medal',
  // attacks / pressure
  attackPressure: 'target', attackDamage: 'target', plantDenial: 'target', counterStyle: 'split',
  resourceDisruption: 'star', productionSteal: 'transfer', predators: 'star', vermin: 'star',
  // card flow / reveal
  reveal: 'eye', cardFlow: 'eye',
  // unused potential / leftover
  unused: 'lock', unusedMoney: 'lock', almostMoney: 'lock', projectStarvation: 'hex', resourceHoard: 'lock',
  // engines / infra / planet
  actionEngine: 'cog', standardProject: 'hex', terraform: 'globe', globalMismatch: 'globe',
  // structure / duel
  duelContrast: 'split', counterplay: 'swap', categoryStructure: 'swap', categorySecondary: 'swap', oneCategoryTrap: 'swap',
  narrowEfficiency: 'scale', turningPoint: 'surge',
  // runner-up
  runnerUp: 'flag', almostPenalty: 'flag',
};

const ICON_BY_FAMILY: Readonly<Record<InsightFamily, InsightIcon>> = {
  verdict: 'scale', turningPoint: 'surge', economy: 'coin', blueAction: 'cog', passiveEngine: 'cog',
  negativeDrama: 'target', colony: 'orbit', standardProject: 'hex', globalParameter: 'globe', reveal: 'eye',
  unusedPotential: 'lock', runnerUpStory: 'flag', rareEvent: 'star', cardStory: 'cards', boardStory: 'hex',
  duelContrast: 'split',
};

/** The icon that best conveys an insight's TYPE — cluster first, then family, then the
 *  analyzer's own choice. Photo-finish/tiebreaker get the dedicated finish icon; verdict
 *  cards keep their already-apt analyzer icon (crown for a runaway, scale for a close one). */
export function resolveInsightIcon(c: InsightCandidate): InsightIcon {
  if (c.id === 'verdict.tiebreaker' || c.id === 'verdict.photo-finish') {
    return 'finish';
  }
  if (c.family === 'verdict') {
    return c.icon;
  }
  const cluster = clusterOf(c);
  return ICON_BY_CLUSTER[cluster] ?? (c.family !== undefined ? ICON_BY_FAMILY[c.family] : undefined) ?? c.icon;
}

function heroWorthy(c: InsightCandidate): boolean {
  const s = c.scores ?? {};
  return c.uiVariant === 'hero' || c.uiVariant === 'legendary' ||
    c.severity === 'decisive' || (s.rarity ?? 0) >= 0.7 || (s.drama ?? 0) >= 0.8;
}

/**
 * The premium story selector: rank by {@link finalScore}, pick ONE hero, then a
 * diverse PRIMARY band (≤1 per cluster, rare facts always break through), a looser
 * SECONDARY band, and HIDDEN ("show more"). Honours `suppresses`. Returns a flat list
 * (reading order) with `rankSection` + `finalScore` set, so the UI lays out the
 * hierarchy and tests stay array-based. Deterministic (id tiebreak).
 */
export function selectStoryInsights(
  candidates: ReadonlyArray<InsightCandidate>,
  forceHidden: ReadonlySet<string> = new Set(),
): Array<EndgameInsightView> {
  const scored = candidates.map((c) => ({...c, finalScore: finalScore(c)}));
  scored.sort((a, b) => b.finalScore - a.finalScore || a.id.localeCompare(b.id));

  // Suppression PRE-PASS (by finalScore order): a stronger non-suppressed candidate
  // hides the redundant ones it `suppresses`, regardless of which band each lands in.
  // (Done up-front so a strong PRIMARY candidate can suppress a weaker HERO-worthy one
  // — the per-band order can't.)
  const suppressed = new Set<string>();
  for (const c of scored) {
    if (suppressed.has(c.id)) {
      continue;
    }
    for (const s of c.suppresses ?? []) {
      suppressed.add(s);
    }
  }
  const usedClusters = new Set<string>();
  const usedIds = new Set<string>();

  // HERO — the single strongest hero-worthy candidate.
  let hero: EndgameInsightView | undefined;
  for (const c of scored) {
    if (suppressed.has(c.id) || forceHidden.has(c.id)) {
      continue;
    }
    if (heroWorthy(c)) {
      hero = {...c, rankSection: 'hero'};
      usedIds.add(c.id);
      usedClusters.add(clusterOf(c));
      break;
    }
  }

  // PRIMARY — diverse (≤1 per cluster), but a rare fact (rarity ≥ 0.6) always enters.
  const primary: Array<EndgameInsightView> = [];
  for (const c of scored) {
    if (primary.length >= STORY_PRIMARY_MAX) {
      break;
    }
    if (usedIds.has(c.id) || suppressed.has(c.id) || forceHidden.has(c.id)) {
      continue;
    }
    const cluster = clusterOf(c);
    const rare = (c.scores?.rarity ?? 0) >= 0.6;
    if (usedClusters.has(cluster) && !rare) {
      continue;
    }
    primary.push({...c, rankSection: 'primary'});
    usedIds.add(c.id);
    usedClusters.add(cluster);
  }

  // SECONDARY — looser: any not-yet-used, deduped only by cluster among themselves.
  const secondary: Array<EndgameInsightView> = [];
  const secondaryClusters = new Set<string>();
  for (const c of scored) {
    if (secondary.length >= STORY_SECONDARY_MAX) {
      break;
    }
    if (usedIds.has(c.id) || suppressed.has(c.id) || forceHidden.has(c.id)) {
      continue;
    }
    const cluster = clusterOf(c);
    if (secondaryClusters.has(cluster)) {
      continue;
    }
    secondary.push({...c, rankSection: 'secondary'});
    usedIds.add(c.id);
    secondaryClusters.add(cluster);
  }

  // HIDDEN — the rest (for "show more"), still useful + deduped.
  const hidden: Array<EndgameInsightView> = [];
  for (const c of scored) {
    if (usedIds.has(c.id) || suppressed.has(c.id)) {
      continue;
    }
    hidden.push({...c, rankSection: 'hidden'});
    usedIds.add(c.id);
  }

  // Reading order WITHIN primary = strongest story first (a commentator leads with the
  // biggest beat), with the legacy GROUP_ORDER as a stable tiebreak for equal scores.
  // (This replaces the old GROUP_ORDER-primary sort, which buried strong fact insights
  // behind legacy groups — see Iteration-6 selector tuning.)
  primary.sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0) ||
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.id.localeCompare(b.id));
  return [...(hero !== undefined ? [hero] : []), ...primary, ...secondary, ...hidden];
}

/** Run every analyzer (base + fact) → the raw candidate list (no scores yet). */
function runAnalyzers(ctx: InsightContext): Array<InsightCandidate> {
  const candidates: Array<InsightCandidate> = [];
  for (const analyzer of [...ANALYZERS, ...FACT_ANALYZERS]) {
    candidates.push(...analyzer(ctx));
  }
  return candidates;
}

/** Every candidate from every analyzer (base + fact), with `finalScore` computed and
 *  sorted strongest-first — BEFORE selection. Dev/debug visibility for tuning the
 *  thresholds + understanding why a candidate was/wasn't picked (the selected ones
 *  also carry `rankSection`; an absent `rankSection` here ⇒ it would be dropped). */
export function buildInsightCandidates(ctx: InsightContext): Array<InsightCandidate> {
  return runAnalyzers(ctx)
    .map((c) => ({...c, finalScore: finalScore(c)}))
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0) || a.id.localeCompare(b.id));
}

// ─────────────────────────────────────────────────────────────────────────
// Iteration 9: the NARRATIVE COMPOSER (Game Story DNA → boosted, role-tagged story)
// ─────────────────────────────────────────────────────────────────────────

const HERO_STORY_BOOST = 16; // make the DNA's recommended hero cluster headline
const SIGNATURE_STORY_BOOST = 8; // lift the on-story spine into the primary band
const GENERIC_STORY_PENALTY = 14; // push off-story generics down (only on a strong story)

/** The per-player style label callback the DNA uses (reuses the canonical duelStyle). */
function styleResolver(ctx: InsightContext): (color: Color) => string {
  return (color) => {
    const p = ctx.players.find((x) => x.color === color);
    return p !== undefined ? duelStyle(ctx, p) : 'Balanced';
  };
}

/** Apply the DNA's on-story boost / off-story penalty to each candidate's `storyBoost`. */
function applyStoryBoost(candidates: ReadonlyArray<InsightCandidate>, dna: GameStoryDNA): Array<InsightCandidate> {
  const signature = new Set(dna.signatureClusters);
  const generic = new Set(dna.suppressedGenericThemes);
  return candidates.map((c) => {
    const cluster = clusterOf(c);
    let boost = 0;
    if (cluster === dna.recommendedHeroCluster) {
      boost += HERO_STORY_BOOST;
    } else if (signature.has(cluster)) {
      boost += SIGNATURE_STORY_BOOST;
    }
    // Penalize a generic theme ONLY when it's off-story (not part of the spine).
    if (generic.has(cluster) && !signature.has(cluster) && cluster !== dna.recommendedHeroCluster) {
      boost -= GENERIC_STORY_PENALTY;
    }
    return boost !== 0 ? {...c, storyBoost: (c.storyBoost ?? 0) + boost} : c;
  });
}

/**
 * Guarantee a HERO for a non-quiet story: `selectStoryInsights` only promotes a
 * `heroWorthy` candidate (high rarity/drama/severity), but a strong story can be
 * carried by a candidate that's defining-yet-not-flashy (e.g. an economy conversion
 * at rarity 0.6). When the DNA says the game WAS special (uniqueness ≥ 0.45) but no
 * hero was chosen, promote the strongest ON-STORY insight so the headline always has a
 * subject. A quiet game keeps no forced hero (the headline reads as a calm summary).
 */
function ensureHero(insights: ReadonlyArray<EndgameInsightView>, dna: GameStoryDNA): Array<EndgameInsightView> {
  const list = [...insights];
  if (list.length === 0 || list.some((i) => i.rankSection === 'hero') || dna.uniquenessScore < 0.45) {
    return list;
  }
  const signature = new Set(dna.signatureClusters);
  // The list is already ordered strongest-first (primary band leads), so the first
  // on-story candidate is the best headline; fall back to the overall strongest.
  const idx = Math.max(0, list.findIndex((i) => signature.has(clusterOf(i))));
  const [hero] = list.splice(idx, 1);
  return [{...hero, rankSection: 'hero'}, ...list];
}

/** The dedup IDENTITY of a candidate — its explicit `evidenceKey`, else cluster+players
 *  (so two cards telling the SAME thought about the SAME people collapse). */
function evidenceKeyOf(c: InsightCandidate): string {
  return c.evidenceKey ?? `${clusterOf(c)}|${[...(c.relatedPlayers ?? [])].sort().join('+')}`;
}

/**
 * EVIDENCE DEDUP (Iteration 10): two VISIBLE cards must not tell the same thought. Group
 * the scored candidates by `evidenceKeyOf`; the strongest of each group stays selectable,
 * the rest are FORCED to the hidden band ("show more") — present for the curious, never
 * cluttering the headline. Returns the set of ids to force-hide.
 */
function evidenceDedup(scored: ReadonlyArray<InsightCandidate>): Set<string> {
  const seenKey = new Set<string>();
  const demote = new Set<string>();
  // Strongest-first so the kept card per key is the richest one.
  for (const c of [...scored].sort((a, b) => (b.finalScore ?? finalScore(b)) - (a.finalScore ?? finalScore(a)) || a.id.localeCompare(b.id))) {
    const k = evidenceKeyOf(c);
    if (seenKey.has(k)) {
      demote.add(c.id);
    } else {
      seenKey.add(k);
    }
  }
  return demote;
}

/** The report SECTION an insight lays out under (the UX director's grouping). */
function sectionOf(c: EndgameInsightView, dna: GameStoryDNA): StorySection {
  const runnerColor = dna.mainConflict?.rightPlayer;
  if (c.rankSection === 'hero' || c.storyRole === 'headline' || c.storyRole === 'contrast') {
    return 'mainStory';
  }
  if (c.storyRole === 'whyRunnerLost' || c.storyRole === 'almost') {
    return 'whyRunnerLost';
  }
  if (c.storyRole === 'rareDetail' || c.storyRole === 'warning' || c.storyRole === 'twist') {
    return 'highlights';
  }
  if (c.storyRole === 'whyWinnerWon' || c.storyRole === 'signatureMoment' || c.storyRole === 'turningPoint') {
    // A runner-up-coloured "moment" belongs to why-they-fell-short, not why-winner-won.
    return runnerColor !== undefined && c.color === runnerColor ? 'whyRunnerLost' : 'whyWinnerWon';
  }
  if (c.rankSection === 'hidden' || c.storyRole === 'trivia' || c.storyRole === 'supportingDetail') {
    return 'details';
  }
  return 'whyWinnerWon';
}

/** Assign a `storySection` to every selected insight (after roles). */
function assignStorySections(insights: ReadonlyArray<EndgameInsightView>, dna: GameStoryDNA): Array<EndgameInsightView> {
  return insights.map((c) => ({...c, storySection: sectionOf(c, dna)}));
}

/**
 * Ensure the runner-up has a VOICE: if a duel/standings game has a meaningful runner-up
 * insight (role almost/whyRunnerLost) but it landed in `hidden`, promote it to secondary
 * so "why they didn't close it out" is always part of the visible report. Never invents
 * one — only surfaces an existing hidden insight.
 */
function surfaceRunnerUpVoice(insights: ReadonlyArray<EndgameInsightView>, dna: GameStoryDNA): Array<EndgameInsightView> {
  const list = [...insights];
  if (dna.mainConflict === undefined) {
    return list;
  }
  const hasVisibleVoice = list.some((c) =>
    c.rankSection !== 'hidden' && (c.storyRole === 'almost' || c.storyRole === 'whyRunnerLost'));
  if (hasVisibleVoice) {
    return list;
  }
  const idx = list.findIndex((c) =>
    c.rankSection === 'hidden' && (c.storyRole === 'almost' || c.storyRole === 'whyRunnerLost'));
  if (idx >= 0) {
    list[idx] = {...list[idx], rankSection: 'secondary'};
  }
  return list;
}

/** Tag each selected insight with its NARRATIVE role (drives the UI story sections). */
function assignStoryRoles(insights: ReadonlyArray<EndgameInsightView>, dna: GameStoryDNA): Array<EndgameInsightView> {
  const twistIds = new Set(dna.twists.map((t) => t.candidateId).filter((id): id is string => id !== undefined));
  const momentClusters = new Set(dna.keyMoments.map((m) => m.cluster));
  return insights.map((c) => {
    const cluster = clusterOf(c);
    let role: StoryRole;
    if (c.rankSection === 'hero') {
      role = 'headline';
    } else if (c.family === 'duelContrast' && cluster === 'duelContrast') {
      role = 'contrast';
    } else if (twistIds.has(c.id)) {
      role = 'twist';
    } else if (c.family === 'turningPoint') {
      role = 'turningPoint';
    } else if (c.family === 'runnerUpStory' || cluster.startsWith('almost')) {
      role = 'almost';
    } else if (cluster === dna.recommendedHeroCluster || momentClusters.has(cluster)) {
      role = 'signatureMoment';
    } else if ((c.scores?.rarity ?? 0) >= 0.6 && (c.rankSection === 'secondary' || c.rankSection === 'hidden')) {
      role = 'rareDetail';
    } else if ((c.family === 'negativeDrama' || c.family === 'rareEvent') && (c.scores?.drama ?? 0) >= 0.55) {
      role = 'warning';
    } else if (c.group === 'reason' && c.color === dna.mainConflict?.leftPlayer) {
      role = 'whyWinnerWon';
    } else if (c.rankSection === 'hidden') {
      role = 'trivia';
    } else {
      role = 'supportingDetail';
    }
    return {...c, storyRole: role};
  });
}

/**
 * The full narrative pipeline: analyzers → score → Game Story DNA → on-story boost →
 * select (hero/primary/secondary/hidden) → role tagging. Returns BOTH the typed DNA
 * (for the headline UI / debug) and the composed insight list.
 */
export function composeStory(ctx: InsightContext): {dna: GameStoryDNA; insights: Array<EndgameInsightView>} {
  if (ctx.mode === 'solo') {
    const dna = buildGameStoryDna(ctx, [], {styleOf: styleResolver(ctx)});
    return {dna, insights: []};
  }
  // 1) Score the raw candidates (DNA ranks key moments by finalScore).
  const scored = runAnalyzers(ctx).map((c) => ({...c, finalScore: finalScore(c)}));
  // 2) Classify the game's story from the scored candidates + ctx.
  const dna = buildGameStoryDna(ctx, scored, {styleOf: styleResolver(ctx)});
  // 3) Boost on-story candidates / penalize off-story generics.
  const boosted = applyStoryBoost(scored, dna);
  // 4) Evidence dedup: same-thought duplicates are forced to the hidden band.
  const forceHidden = evidenceDedup(boosted.map((c) => ({...c, finalScore: finalScore(c)})));
  // 5) Select the hierarchy, guarantee a hero, surface the runner-up, tag roles + sections.
  let insights = ensureHero(selectStoryInsights(boosted, forceHidden), dna);
  insights = assignStoryRoles(insights, dna);
  insights = surfaceRunnerUpVoice(insights, dna);
  insights = assignStorySections(insights, dna);
  // 6) Visual identity: a meaningful, type-revealing icon per card (Iteration 11).
  insights = insights.map((c) => ({...c, icon: resolveInsightIcon(c)}));
  return {dna, insights};
}

export function generateInsights(ctx: InsightContext): Array<EndgameInsightView> {
  return composeStory(ctx).insights;
}

/** Dev/debug bundle: the Game Story DNA + every candidate (scored, with `storyBoost` +
 *  `evidenceKey` + the band/section it landed in + whether it was evidence-deduped).
 *  Powers the `?egDebug` panel + tuning — you can't calibrate this blind. */
export function buildStoryDebug(ctx: InsightContext): {dna: GameStoryDNA; candidates: Array<InsightCandidate>} {
  const scored = runAnalyzers(ctx).map((c) => ({...c, finalScore: finalScore(c)}));
  const dna = buildGameStoryDna(ctx, scored, {styleOf: styleResolver(ctx)});
  const boosted = applyStoryBoost(scored, dna).map((c) => ({...c, finalScore: finalScore(c)}));
  const forceHidden = evidenceDedup(boosted);
  // The composed, placed list (same pipeline as composeStory) → band + role + section.
  const composed = composeStory(ctx).insights;
  const placed = new Map(composed.map((c) => [c.id, c]));
  const candidates = boosted
    .map((c) => {
      const p = placed.get(c.id);
      return {
        ...c,
        evidenceKey: evidenceKeyOf(c),
        rankSection: p?.rankSection ?? (forceHidden.has(c.id) ? 'hidden' as const : undefined),
        storyRole: p?.storyRole,
        storySection: p?.storySection,
      };
    })
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0) || a.id.localeCompare(b.id));
  return {dna, candidates};
}
