/*
 * Strategy ARCHETYPE detection (rework §4, §5, §7–§20).
 *
 * The old `duelStyle` reduced a player's plan to one of 5 loose labels (Terraformer /
 * Card Engine / Board Builder / Award Hunter / Balanced). This module replaces that with
 * the REAL strategy archetypes of Terraforming Mars — Jovian combo, animals, microbes,
 * floaters, science card-flow, colony trade, cities & greenery, global parameters, space
 * & titanium, Earth discounts, standard projects, milestones & awards, Venus, the
 * "resources-on-cards" scoring line — detected from the FULL signal (tag counts, card-VP
 * by source, accumulated card resources, colonies, the event-stream facts), and graded by
 * CONTRIBUTION, not mere presence (§5): a line that gave few points is at most a colour
 * note, never "why the winner won".
 *
 * Design contract (mirrors gameStoryDna / corporationStories):
 *   • PURE — no Vue / DOM / i18n / card manifest. Texts are English i18n KEYS.
 *   • NO runtime dependency on insightEngine (type-only imports) → no module cycle.
 *   • The per-player raw inputs (`StrategyInput`) are computed by the client
 *     (EndgameExperience, which has the manifest) and threaded onto `EndgamePlayerScore`.
 */
import type {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {GlobalParameter} from '@/common/GlobalParameter';
import type {ColonyName} from '@/common/colonies/ColonyName';
import type {EndgameFact, FactType} from '@/common/events/endgameFacts';
import type {InsightContext, InsightFamily, EvidenceChip} from '@/client/components/endgame/insightEngine';
import type {EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import type {CardVpBySource} from '@/client/components/endgame/cardScoreContribution';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type StrategyArchetype =
  | 'jovian'
  | 'animals'
  | 'microbes'
  | 'floaters'
  | 'scienceDraw'
  | 'colonyTrade'
  | 'cityGreenery'
  | 'globalParams'
  | 'spaceTitanium'
  | 'earthDiscounts'
  | 'standardProjects'
  | 'milestonesAwards'
  | 'venus'
  | 'cardResources';

/** Accumulated card-resource totals + the count of cards holding each (from the tableau). */
export type ResourceTotals = {
  animals: number; microbes: number; floaters: number;
  animalCards: number; microbeCards: number; floaterCards: number;
};

/** Per-player raw inputs for archetype detection (computed client-side, threaded in). */
export type StrategyInput = {
  tags: Partial<Record<Tag, number>>;
  coloniesOwned: ReadonlyArray<ColonyName>;
  cardVp: CardVpBySource;
  resourceTotals: ResourceTotals;
};

export type StrategyConfidence = 'high' | 'medium' | 'low';

/** One detected strategy line for a player. */
export type StrategyDetection = {
  archetype: StrategyArchetype;
  /** 0..1 significance — contribution-weighted (relative to the player total + the margin). */
  score: number;
  /** VP attributable to this line (0 for pure-support lines that don't score directly). */
  vpContribution: number;
  /** A SCORING line (gives VP) vs a SUPPORT/tempo line (funds or feeds the scoring). */
  isScoring: boolean;
  /** Premium evidence chips with REAL numbers (no internal metrics). */
  evidence: ReadonlyArray<EvidenceChip>;
  confidence: StrategyConfidence;
};

export type PlayerStrategyProfile = {
  color: Color;
  /** The defining line (highest score, eligible as primary), if any. */
  primary?: StrategyDetection;
  /** Up to 2 supporting lines. */
  secondary: ReadonlyArray<StrategyDetection>;
  /** Every detection, strongest first (for debug / the player-arc facets). */
  all: ReadonlyArray<StrategyDetection>;
  confidence: StrategyConfidence;
};

// ─────────────────────────────────────────────────────────────────────────
// Labels + UI mapping (i18n KEYS)
// ─────────────────────────────────────────────────────────────────────────

export const ARCHETYPE_LABEL: Readonly<Record<StrategyArchetype, string>> = {
  jovian: 'Jovian combo',
  animals: 'Animals',
  microbes: 'Microbes',
  floaters: 'Floaters',
  scienceDraw: 'Science & card flow',
  colonyTrade: 'Colony trade',
  cityGreenery: 'Cities & greenery',
  globalParams: 'Global parameters',
  spaceTitanium: 'Space & titanium',
  earthDiscounts: 'Earth tags & discounts',
  standardProjects: 'Standard projects',
  milestonesAwards: 'Milestones & awards',
  venus: 'Venus',
  cardResources: 'Resources on cards',
};

/** The story family an archetype's insight belongs to (premium UI accent). */
export const ARCHETYPE_FAMILY: Readonly<Record<StrategyArchetype, InsightFamily>> = {
  jovian: 'cardStory',
  animals: 'cardStory',
  microbes: 'cardStory',
  floaters: 'cardStory',
  scienceDraw: 'reveal',
  colonyTrade: 'colony',
  cityGreenery: 'boardStory',
  globalParams: 'globalParameter',
  spaceTitanium: 'cardStory',
  earthDiscounts: 'economy',
  standardProjects: 'standardProject',
  milestonesAwards: 'cardStory',
  venus: 'cardStory',
  cardResources: 'cardStory',
};

/** The diversity cluster key for the selector (one strong card per cluster). */
export function archetypeCluster(a: StrategyArchetype): string {
  return `strategy:${a}`;
}

export function strategyLabel(a: StrategyArchetype): string {
  return ARCHETYPE_LABEL[a];
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
/** A value chip with a translated unit/descriptor suffix ("+14" + "VP" → "+14 ПО"). */
function val(value: string, label: string, tone: EvidenceChip['tone'] = 'metric'): EvidenceChip {
  return {t: 'raw', v: value, label, tone};
}
/** A VP value chip (green) with the localized "VP" unit. */
function vpChip(amount: number): EvidenceChip {
  return val(`+${amount}`, 'VP', 'good');
}
function tagCount(si: StrategyInput, tag: Tag): number {
  return si.tags[tag] ?? 0;
}
function pFact(ctx: InsightContext, color: Color, type: FactType): EndgameFact | undefined {
  return (ctx.facts ?? []).find((f) => f.type === type && f.player === color);
}
function fMetric(f: EndgameFact | undefined, k: string): number {
  return f?.metrics[k] ?? 0;
}
function categoryVp(p: EndgamePlayerScore, key: 'tr' | 'cards' | 'board' | 'mca'): number {
  return p.categories[key] ?? 0;
}
function paramSteps(p: EndgamePlayerScore): number {
  let s = 0;
  for (const v of Object.values(p.globalSteps)) {
    s += v ?? 0;
  }
  return s;
}

/**
 * Significance of a SCORING line: grows with its VP relative to a "real line" chunk of the
 * player's total AND relative to the final margin (§5 — a line that covers the margin is
 * decisive; a line that's a fraction of the total is a footnote).
 */
function scoringScore(vp: number, total: number, margin: number): number {
  const rel = vp / Math.max(total * 0.16, 8);
  const vsMargin = margin > 0 ? vp / Math.max(margin, 3) : 0.5;
  return clamp01(0.62 * clamp01(rel) + 0.38 * clamp01(vsMargin));
}

// ─────────────────────────────────────────────────────────────────────────
// Detectors — one per archetype. Each returns a StrategyDetection or undefined.
// ─────────────────────────────────────────────────────────────────────────

type Detector = (p: EndgamePlayerScore, si: StrategyInput, ctx: InsightContext) => StrategyDetection | undefined;

const detectJovian: Detector = (p, si, ctx) => {
  const vp = si.cardVp.jovian;
  const tags = tagCount(si, Tag.JOVIAN);
  if (vp < 4 && !(tags >= 4 && vp >= 2)) {
    return undefined;
  }
  const score = clamp01(scoringScore(vp, p.total, ctx.margin) + (tags >= 6 ? 0.1 : 0));
  return {
    archetype: 'jovian', score, vpContribution: vp, isScoring: true,
    evidence: [vpChip(vp), val(`${tags}`, 'Jovian tags')],
    confidence: si.cardVp.confidence,
  };
};

const detectAnimals: Detector = (p, si, ctx) => {
  const vp = si.cardVp.animal;
  const animals = si.resourceTotals.animals;
  if (vp < 5 && !(animals >= 8 && vp >= 3)) {
    return undefined;
  }
  return {
    archetype: 'animals', score: scoringScore(vp, p.total, ctx.margin), vpContribution: vp, isScoring: true,
    evidence: [vpChip(vp), val(`${animals}`, 'Animals')],
    confidence: si.cardVp.confidence,
  };
};

const detectMicrobes: Detector = (p, si, ctx) => {
  const vp = si.cardVp.microbe;
  const microbes = si.resourceTotals.microbes;
  if (vp < 4 && microbes < 8) {
    return undefined;
  }
  const isScoring = vp >= 4;
  // When microbes scored little but accumulated a lot, it was a tempo/support line (§9).
  const score = isScoring ? scoringScore(vp, p.total, ctx.margin) : clamp01(microbes / 18) * 0.5;
  return {
    archetype: 'microbes', score, vpContribution: vp, isScoring,
    evidence: vp > 0 ? [vpChip(vp), val(`${microbes}`, 'Microbes')] : [val(`${microbes}`, 'Microbes')],
    confidence: si.cardVp.confidence,
  };
};

const detectFloaters: Detector = (p, si, ctx) => {
  const vp = si.cardVp.floater;
  const floaters = si.resourceTotals.floaters;
  if (vp < 4 && floaters < 8) {
    return undefined;
  }
  const isScoring = vp >= 4;
  const score = isScoring ? scoringScore(vp, p.total, ctx.margin) : clamp01(floaters / 18) * 0.5;
  return {
    archetype: 'floaters', score, vpContribution: vp, isScoring,
    evidence: vp > 0 ? [vpChip(vp), val(`${floaters}`, 'Floaters')] : [val(`${floaters}`, 'Floaters')],
    confidence: si.cardVp.confidence,
  };
};

const detectScienceDraw: Detector = (p, si, ctx) => {
  const science = tagCount(si, Tag.SCIENCE);
  const reveal = pFact(ctx, p.color, 'reveal');
  const seen = fMetric(reveal, 'revealed') + fMetric(reveal, 'shown');
  const cardsVp = categoryVp(p, 'cards');
  if (science < 5 || (seen < 4 && cardsVp < 24)) {
    return undefined;
  }
  // A SUPPORT line: science + draw FEED the card engine; the VP is the card category.
  const score = clamp01(0.4 * clamp01(seen / 10) + 0.45 * clamp01(cardsVp / 45) + (science >= 8 ? 0.12 : 0));
  const ev: Array<EvidenceChip> = [val(`${science}`, 'Science tags')];
  if (seen >= 4) {
    ev.push(val(`${seen}`, 'Cards seen', 'good'));
  }
  return {archetype: 'scienceDraw', score, vpContribution: 0, isScoring: false, evidence: ev, confidence: 'medium'};
};

const detectColonyTrade: Detector = (p, si, ctx) => {
  const colony = pFact(ctx, p.color, 'colony');
  const trades = fMetric(colony, 'trades');
  const owned = si.coloniesOwned.length;
  if (trades < 4 && owned < 3) {
    return undefined;
  }
  const score = clamp01(0.5 * clamp01(trades / 10) + 0.35 * clamp01(owned / 4) + (fMetric(colony, 'trackBonusSteps') > 0 ? 0.1 : 0));
  const ev: Array<EvidenceChip> = [];
  if (owned > 0) {
    ev.push(val(`${owned}`, 'Colonies'));
  }
  if (trades > 0) {
    ev.push(val(`${trades}`, 'Trades', 'good'));
  }
  return {archetype: 'colonyTrade', score, vpContribution: 0, isScoring: false, evidence: ev, confidence: 'high'};
};

const detectCityGreenery: Detector = (p, _si, ctx) => {
  const boardVp = categoryVp(p, 'board');
  if (boardVp < 12) {
    return undefined;
  }
  return {
    archetype: 'cityGreenery', score: scoringScore(boardVp, p.total, ctx.margin), vpContribution: boardVp, isScoring: true,
    evidence: [vpChip(boardVp), {t: 'i18n', v: 'cities & greenery', tone: 'neutral'}],
    confidence: 'high',
  };
};

// Rework §14 — raise the abstract "global parameters" into the concrete parameters driven.
const PARAM_CHIP_LABEL: Partial<Record<GlobalParameter, string>> = {
  [GlobalParameter.TEMPERATURE]: 'Temperature', [GlobalParameter.OXYGEN]: 'Oxygen',
  [GlobalParameter.OCEANS]: 'Oceans', [GlobalParameter.VENUS]: 'Venus',
};
const detectGlobalParams: Detector = (p, _si, _ctx) => {
  const steps = paramSteps(p);
  const trVp = categoryVp(p, 'tr');
  if (steps < 8) {
    return undefined;
  }
  // TR is structurally large (≈20 base); the SIGNAL is the steps the player drove.
  const score = clamp01(0.55 * clamp01(steps / 22) + 0.3 * clamp01((trVp - 20) / 30));
  // §14 — name the dominant parameters (temperature / oxygen / oceans / Venus), not just "steps".
  const topParams = Object.entries(p.globalSteps)
    .filter(([k, v]) => (v ?? 0) > 0 && PARAM_CHIP_LABEL[k as GlobalParameter] !== undefined)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2);
  const evidence: Array<EvidenceChip> = [val(`${trVp}`, 'TR')];
  for (const [k, v] of topParams) {
    evidence.push(val(`${v}`, PARAM_CHIP_LABEL[k as GlobalParameter] as string));
  }
  if (topParams.length === 0) {
    evidence.push(val(`${steps}`, 'parameter steps', 'good'));
  }
  return {
    archetype: 'globalParams', score, vpContribution: Math.max(0, trVp - 20), isScoring: true,
    evidence,
    confidence: 'high',
  };
};

const detectSpaceTitanium: Detector = (p, si, _ctx) => {
  const space = tagCount(si, Tag.SPACE);
  const titaniumProd = p.production?.titanium ?? 0;
  if (space < 6 && titaniumProd < 4) {
    return undefined;
  }
  // Mostly a tempo/identity line — titanium funds expensive space cards (§16).
  const score = clamp01(0.45 * clamp01(space / 10) + 0.35 * clamp01(titaniumProd / 6));
  const ev: Array<EvidenceChip> = [val(`${space}`, 'Space tags')];
  if (titaniumProd > 0) {
    ev.push(val(`${titaniumProd}`, 'Titanium production'));
  }
  return {archetype: 'spaceTitanium', score, vpContribution: 0, isScoring: false, evidence: ev, confidence: 'medium'};
};

const detectEarthDiscounts: Detector = (p, si, ctx) => {
  const earth = tagCount(si, Tag.EARTH);
  const econ = pFact(ctx, p.color, 'economy');
  const saved = fMetric(econ, 'savedMegacredits');
  if (earth < 5 || saved < 12) {
    return undefined;
  }
  // Funds the rest of the plan (§17) — a support line, never the scoring itself.
  const score = clamp01(0.4 * clamp01(earth / 9) + 0.4 * clamp01(saved / 30));
  return {
    archetype: 'earthDiscounts', score, vpContribution: 0, isScoring: false,
    evidence: [val(`${earth}`, 'Earth tags'), {t: 'raw', v: `+${saved} M€`, tone: 'good'}],
    confidence: 'medium',
  };
};

const detectStandardProjects: Detector = (p, _si, ctx) => {
  const sp = pFact(ctx, p.color, 'standardProject');
  const projects = fMetric(sp, 'projects');
  if (projects < 4) {
    return undefined;
  }
  const steps = fMetric(sp, 'parameterSteps');
  const score = clamp01(0.55 * clamp01(projects / 8) + 0.3 * clamp01(steps / 10));
  const ev: Array<EvidenceChip> = [val(`${projects}`, 'Standard projects', 'good')];
  if (steps > 0) {
    ev.push(val(`${steps}`, 'parameter steps'));
  }
  return {archetype: 'standardProjects', score, vpContribution: 0, isScoring: false, evidence: ev, confidence: 'high'};
};

const detectMilestonesAwards: Detector = (p, _si, ctx) => {
  const vp = categoryVp(p, 'mca');
  if (vp < 8) {
    return undefined;
  }
  return {
    archetype: 'milestonesAwards', score: scoringScore(vp, p.total, ctx.margin), vpContribution: vp, isScoring: true,
    evidence: [vpChip(vp), {t: 'i18n', v: 'milestones & awards', tone: 'neutral'}],
    confidence: 'high',
  };
};

const detectVenus: Detector = (p, si, _ctx) => {
  const venusTags = tagCount(si, Tag.VENUS);
  const venusSteps = p.globalSteps[GlobalParameter.VENUS] ?? 0;
  const floaterVp = si.cardVp.floater;
  if (venusTags < 4 || (venusSteps < 3 && floaterVp < 3)) {
    return undefined;
  }
  const score = clamp01(0.4 * clamp01(venusTags / 8) + 0.35 * clamp01(venusSteps / 6) + clamp01(floaterVp / 10) * 0.25);
  const ev: Array<EvidenceChip> = [val(`${venusTags}`, 'Venus tags')];
  if (venusSteps > 0) {
    ev.push(val(`${venusSteps}`, 'Venus steps', 'good'));
  }
  return {archetype: 'venus', score, vpContribution: floaterVp, isScoring: floaterVp >= 3, evidence: ev, confidence: 'medium'};
};

const detectCardResources: Detector = (p, si, ctx) => {
  const a = si.cardVp.animal; const m = si.cardVp.microbe; const f = si.cardVp.floater;
  const vp = a + m + f;
  const top = Math.max(a, m, f);
  // Only when the resource VP is a real combined line AND no single resource dominates
  // (else that single archetype tells the story instead).
  if (vp < 8 || top >= 6) {
    return undefined;
  }
  return {
    archetype: 'cardResources', score: scoringScore(vp, p.total, ctx.margin), vpContribution: vp, isScoring: true,
    evidence: [vpChip(vp), {t: 'i18n', v: 'resources on cards', tone: 'neutral'}],
    confidence: si.cardVp.confidence,
  };
};

const DETECTORS: ReadonlyArray<Detector> = [
  detectJovian, detectAnimals, detectMicrobes, detectFloaters, detectScienceDraw,
  detectColonyTrade, detectCityGreenery, detectGlobalParams, detectSpaceTitanium,
  detectEarthDiscounts, detectStandardProjects, detectMilestonesAwards, detectVenus,
  detectCardResources,
];

// ─────────────────────────────────────────────────────────────────────────
// buildStrategyProfiles
// ─────────────────────────────────────────────────────────────────────────

const PRIMARY_MIN = 0.3; // a line must clear this to be the defining strategy
const SECONDARY_MIN = 0.18;

function worstConfidence(ds: ReadonlyArray<StrategyDetection>): StrategyConfidence {
  if (ds.some((d) => d.confidence === 'low')) {
    return 'low';
  }
  if (ds.some((d) => d.confidence === 'medium')) {
    return 'medium';
  }
  return 'high';
}

/** Detect every player's strategy profile from their threaded `strategyInput` + the facts. */
export function buildStrategyProfiles(ctx: InsightContext): Partial<Record<Color, PlayerStrategyProfile>> {
  const out: Partial<Record<Color, PlayerStrategyProfile>> = {};
  for (const p of ctx.players) {
    const si = p.strategyInput;
    if (si === undefined) {
      continue;
    }
    const detections: Array<StrategyDetection> = [];
    for (const d of DETECTORS) {
      const det = d(p, si, ctx);
      if (det !== undefined && det.score > 0) {
        detections.push(det);
      }
    }
    detections.sort((a, b) => b.score - a.score ||
      b.vpContribution - a.vpContribution || a.archetype.localeCompare(b.archetype));
    // Primary = the strongest line clearing the bar. A SUPPORT line can be primary only
    // when it's clearly the dominant identity (high score) — otherwise the scoring line
    // leads and the support is secondary (§5).
    let primary: StrategyDetection | undefined;
    const top = detections[0];
    if (top !== undefined && top.score >= PRIMARY_MIN && (top.isScoring || top.score >= 0.5)) {
      primary = top;
    } else {
      // No qualifying dominant line — fall back to the strongest SCORING line if any clears the bar.
      primary = detections.find((d) => d.isScoring && d.score >= PRIMARY_MIN);
    }
    const secondary = detections
      .filter((d) => d !== primary && d.score >= SECONDARY_MIN)
      .slice(0, 2);
    out[p.color] = {
      color: p.color,
      primary,
      secondary,
      all: detections,
      confidence: worstConfidence(primary !== undefined ? [primary, ...secondary] : detections),
    };
  }
  return out;
}

/** The canonical short STYLE label for a player (replaces the old `duelStyle`). */
export function strategyStyleLabel(profile: PlayerStrategyProfile | undefined): string {
  if (profile?.primary !== undefined) {
    return strategyLabel(profile.primary.archetype);
  }
  return 'Balanced';
}
