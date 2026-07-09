/*
 * Corporation Impact Engine (Iteration 17) — the per-corporation endgame analysis layer.
 *
 * A corporation is the IDENTITY of a Terraforming Mars game: it sets the opening, may
 * carry a passive rule and an activatable action, and usually defines a player's whole
 * plan. Iteration 13 gave us the measured `corporationImpact` FACT + a registry of
 * archetypes; this engine turns those into a formal, ranked `CorporationImpact` per
 * player — ALWAYS a readout (even when nothing measurable happened), with achievements,
 * tiers and a SECTION placement so the endgame report can call a corporation out exactly
 * as much as it earned (player profile → additional observation → unusual episode → why
 * the winner won → what defined the game).
 *
 * Design contract (mirrors strategyArchetypes / keyEpisodeEngine / specialCardStories):
 *   • PURE — no Vue / DOM / i18n. Texts are English i18n KEYS. Deterministic.
 *   • NO runtime dependency on insightEngine / endgameModel (type-only imports) → no
 *     module cycle. Reads ONLY the existing event-derived fact + the player's scoring
 *     outcome (no parallel store, no server bridge — per the project's "derive from the
 *     stream" rule). Reuses `InsightContext` rather than a parallel context type.
 *   • SCOPE = base, Corporate Era, promo, Venus, Colonies, Prelude 1 (the project's
 *     pre-Turmoil scope). An out-of-scope corp degrades to a conservative generic readout.
 */
import {CardName} from '@/common/cards/CardName';
import type {EndgameFact} from '@/common/events/endgameFacts';
import type {InsightContext, InsightParam, EvidenceChip} from '@/client/components/endgame/insightEngine';
import type {EndgameCategoryKey} from '@/client/components/endgame/endgameModel';
import {Color} from '@/common/Color';
import {
  ARCHETYPE_LABEL, ARCHETYPE_ENGINE_TEXT, type CorporationArchetype, corporationProfile,
  type CorporationProfile, isCapitalArchetype, registeredCorporationNames, MERGER_PRELUDE,
} from '@/client/components/endgame/corporationStories';

// ─────────────────────────────────────────────────────────────────────────
// Model (the spec's §4/§6 shapes, mapped onto data we actually have)
// ─────────────────────────────────────────────────────────────────────────

/** How fully the player realised the corporation's power. */
export type EfficiencyTier = 'missed' | 'minor' | 'solid' | 'strong' | 'exceptional' | 'signature';

/** Where the report may show this corporation's story (§7). */
export type CorporationPlacement =
  | 'player_profile_only' // default — always enrich "How the players played"
  | 'suppress' // unknown / out-of-scope with no data
  | 'additional_observation' // bronze / silver
  | 'unusual_episode' // gold — a memorable episode
  | 'why_winner_won' // platinum — a decisive lever (winner only, high confidence)
  | 'what_defined_game'; // signature — the corporation WAS the game (rare)

export type ImpactConfidence = 'high' | 'medium' | 'low';

/** A small i18n template line (key + params) the UI renders with translateTextWithParams. */
export type CorporationLine = {key: string; params: ReadonlyArray<InsightParam>};

export type CorporationImpactMetric = {
  id: string;
  label: string; // i18n KEY
  value: number | string;
  unit?: 'vp' | 'mc' | 'cards' | 'resources' | 'tr' | 'uses' | 'generations' | 'tags' | 'tiles' | 'percent';
  role: 'primary' | 'supporting' | 'context';
  confidence: 'measured' | 'derived' | 'partial';
};

export type CorporationAchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type CorporationAchievement = {
  id: string;
  title: string; // i18n KEY
  description: string; // i18n KEY
  tier: CorporationAchievementTier;
  placementHint: 'additional_observation' | 'unusual_episode' | 'why_winner_won' | 'what_defined_game';
  evidenceChips: ReadonlyArray<EvidenceChip>;
};

export type CorporationImpact = {
  corporationName: string;
  /** A second corporation (Merger) — present only on a fused double-corp player. */
  mergedWith?: string;
  color: Color;
  archetype: CorporationArchetype;
  archetypeLabel: string; // i18n KEY (reused from ARCHETYPE_LABEL)
  efficiencyTier: EfficiencyTier;
  placement: CorporationPlacement;
  confidence: ImpactConfidence;
  /** How the corporation played out — drives the player-arc tag + episode role. */
  realized: 'carried' | 'start' | 'underused' | 'merged' | 'present';
  title: string; // i18n KEY (the archetype label)
  /** The longer story line (used by the additional-observation insight + episodes). */
  summary: CorporationLine;
  /** The ALWAYS-shown profile readout (the spec's §5 — never empty). */
  playerProfileSummary: CorporationLine;
  worked?: string; // i18n KEY (short)
  missed?: string; // i18n KEY (short)
  metrics: ReadonlyArray<CorporationImpactMetric>;
  achievements: ReadonlyArray<CorporationAchievement>;
  caveats?: ReadonlyArray<string>; // i18n KEYS
  /** Whether a SPECIFIC per-corp override produced this readout (vs the generic archetype
   *  path) — surfaced in ?egDebug for the coverage audit. */
  ruleStatus: 'specific' | 'generic' | 'missing';
};

// ─────────────────────────────────────────────────────────────────────────
// Param / chip helpers (the insight-param shape, no i18n at build time)
// ─────────────────────────────────────────────────────────────────────────

const raw = (v: number | string): InsightParam => ({t: 'raw', v: String(v)});
const cardP = (v: string): InsightParam => ({t: 'card', v});
const i18nP = (v: string): InsightParam => ({t: 'i18n', v});
const chipN = (v: number | string, tone: EvidenceChip['tone'] = 'metric', label?: string): EvidenceChip => ({t: 'raw', v: String(v), tone, label});
const chipL = (v: string, tone: EvidenceChip['tone'] = 'neutral'): EvidenceChip => ({t: 'i18n', v, tone});

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function m(f: EndgameFact | undefined, k: string): number {
  return f?.metrics[k] ?? 0;
}
function playerOf(ctx: InsightContext, color: Color) {
  return ctx.players.find((p) => p.color === color);
}
function categoryVp(ctx: InsightContext, color: Color, key: EndgameCategoryKey): number {
  return playerOf(ctx, color)?.categories[key] ?? 0;
}
function corpFactFor(ctx: InsightContext, color: Color, corp: CardName): EndgameFact | undefined {
  return (ctx.facts ?? []).find((f) => f.type === 'corporationImpact' && f.player === color && f.sourceCard === corp);
}

// ─────────────────────────────────────────────────────────────────────────
// Archetype → impact FAMILY (what to measure for this corporation)
// ─────────────────────────────────────────────────────────────────────────

type ImpactFamily = 'action' | 'passive' | 'cardResource' | 'economy' | 'board' | 'space' | 'colony' | 'cardFlow' | 'terraform' | 'start' | 'generalist';

function familyOf(profile: CorporationProfile): ImpactFamily {
  if (profile.hasAction && profile.archetype === 'actionEngine') {
    return 'action';
  }
  switch (profile.archetype) {
  case 'actionEngine': return 'action';
  case 'cardResourceEngine': return 'cardResource';
  case 'capitalStarter': return 'start';
  case 'discountHouse': return 'economy';
  case 'energyEngine': return 'economy';
  case 'metalEconomy': return 'economy';
  case 'spaceEngine': return 'space';
  case 'plantEngine': return 'board';
  case 'cityEngine': return 'board';
  case 'colonyEngine': return 'colony';
  case 'cardFlow': return 'cardFlow';
  case 'terraformEngine': return 'terraform';
  case 'tagFlex': return 'generalist';
  case 'eventTempo': return 'economy';
  case 'disruption': return 'passive';
  case 'standardProjectEngine': return 'economy';
  case 'generalist': return 'generalist';
  }
}

/** The scoring CATEGORY a board/space/terraform/colony corp's plan should pay off in —
 *  used for the §8 "did the start/engine convert to points" check. */
function conversionCategory(family: ImpactFamily): EndgameCategoryKey | undefined {
  switch (family) {
  case 'board': return 'board';
  case 'colony': return 'tracks';
  case 'terraform': return 'tr';
  case 'space': return 'cards';
  default: return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Action stats (§9) — derived, no new data
// ─────────────────────────────────────────────────────────────────────────

export type CorporationActionStats = {
  availableGenerations: number;
  uses: number;
  missedUses: number;
  useRate: number; // 0..1
  lastGeneration: number;
};

/** Derive action-usage stats from the fact + the game length. A corporate action is
 *  available from generation 1, so availableGenerations ≈ finalGen (an honest upper bound;
 *  some actions unlock conditionally — flagged via `confidence` downstream). */
export function corporationActionStats(f: EndgameFact | undefined, finalGen: number): CorporationActionStats {
  const uses = m(f, 'actionActivations');
  const available = Math.max(1, finalGen);
  const useRate = clamp01(uses / available);
  return {
    availableGenerations: available,
    uses,
    missedUses: Math.max(0, available - uses),
    useRate,
    lastGeneration: m(f, 'actionLastGeneration'),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Signal score — a 0..1 "how much did this corporation actually do" + conversion flag
// ─────────────────────────────────────────────────────────────────────────

type Signal = {impact: number; converted: boolean; capabilityButZero: boolean};

function genericSignal(ctx: InsightContext, color: Color, profile: CorporationProfile, f: EndgameFact | undefined): Signal {
  const family = familyOf(profile);
  const act = corporationActionStats(f, ctx.generation);
  const total = m(f, 'totalMeasuredValue');
  const saved = m(f, 'passiveSaved');
  const triggers = m(f, 'passiveTriggers');
  const cardRes = m(f, 'passiveCardResources') + m(f, 'actionResources');
  const early = m(f, 'earlyValue');
  const convCat = conversionCategory(family);
  const convVp = convCat !== undefined ? categoryVp(ctx, color, convCat) : 0;

  let impact = 0;
  let capabilityButZero = false;
  switch (family) {
  case 'action':
    impact = clamp01(act.uses / 9) * 0.7 + clamp01(act.useRate) * 0.3;
    capabilityButZero = profile.hasAction && act.uses === 0;
    break;
  case 'passive':
    impact = clamp01((triggers / 12) * 0.5 + (saved + total) / 40 * 0.5);
    capabilityButZero = triggers === 0 && total === 0;
    break;
  case 'cardResource':
    impact = clamp01(cardRes / 24 * 0.6 + total / 40 * 0.4);
    capabilityButZero = cardRes === 0 && total === 0;
    break;
  case 'economy':
    impact = clamp01((saved + total) / 36);
    capabilityButZero = saved === 0 && total === 0;
    break;
  case 'start':
    impact = clamp01(early / 22 * 0.65 + total / 40 * 0.35);
    capabilityButZero = early === 0 && total === 0;
    break;
  case 'board':
  case 'colony':
  case 'space':
  case 'terraform':
    // A strategy corp: weigh the corp's MEASURED contribution AND the player's score in the
    // matching category (the §18 "support evidence" — the corp helped the plan that scored).
    impact = clamp01(total / 30 * 0.4 + convVp / 36 * 0.6);
    capabilityButZero = total === 0 && convVp === 0;
    break;
  case 'cardFlow':
    impact = clamp01((m(f, 'passiveCardsDrawn') + m(f, 'actionCardsDrawn')) / 14 * 0.6 + total / 30 * 0.4);
    capabilityButZero = total === 0 && m(f, 'passiveCardsDrawn') === 0;
    break;
  case 'generalist':
    impact = clamp01(total / 32);
    capabilityButZero = total === 0;
    break;
  }

  // Conversion: a board/colony/space/terraform/start corp "converted" when its matching
  // category actually scored well (§8 — strong start without conversion stays solid/strong).
  const converted = convCat !== undefined ? convVp >= 8 :
    family === 'start' ? playerScored(ctx, color) :
      true; // engines/economy/cardResource that produced measured value are self-evidently converted
  return {impact, converted, capabilityButZero};
}

/** Did the player turn their game into a competitive score (a soft conversion proxy). */
function playerScored(ctx: InsightContext, color: Color): boolean {
  const p = playerOf(ctx, color);
  if (p === undefined) {
    return false;
  }
  if (p.isWinner) {
    return true;
  }
  // Within a third of the winner's total = a real, converted game (not a collapse).
  return ctx.winner.total > 0 && p.total >= ctx.winner.total * 0.78;
}

// ─────────────────────────────────────────────────────────────────────────
// Tier
// ─────────────────────────────────────────────────────────────────────────

function deriveTier(signal: Signal): EfficiencyTier {
  if (signal.capabilityButZero) {
    return 'missed';
  }
  const {impact, converted} = signal;
  if (impact < 0.18) {
    return 'minor';
  }
  if (impact < 0.42) {
    return 'solid';
  }
  if (impact < 0.66) {
    return converted ? 'strong' : 'solid';
  }
  if (impact < 0.86) {
    return converted ? 'exceptional' : 'strong';
  }
  return converted ? 'signature' : 'strong';
}

const TIER_RANK: Record<EfficiencyTier, number> = {
  missed: 0, minor: 1, solid: 2, strong: 3, exceptional: 4, signature: 5,
};

// ─────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────

function buildMetrics(ctx: InsightContext, color: Color, profile: CorporationProfile, f: EndgameFact | undefined): Array<CorporationImpactMetric> {
  const family = familyOf(profile);
  const out: Array<CorporationImpactMetric> = [];
  const act = corporationActionStats(f, ctx.generation);
  const push = (id: string, label: string, value: number | string, unit: CorporationImpactMetric['unit'], role: CorporationImpactMetric['role'], confidence: CorporationImpactMetric['confidence'] = 'measured') => {
    out.push({id, label, value, unit, role, confidence});
  };
  if (family === 'action' && profile.hasAction) {
    push('activations', 'activations', act.uses, 'uses', 'primary');
    push('useRate', 'use rate', Math.round(act.useRate * 100), 'percent', 'supporting', 'derived');
  }
  const saved = m(f, 'passiveSaved');
  if (saved > 0) {
    push('saved', 'M€ saved', saved, 'mc', family === 'economy' ? 'primary' : 'supporting');
  }
  const triggers = m(f, 'passiveTriggers');
  if (triggers > 0 && family !== 'action') {
    push('triggers', 'triggers', triggers, undefined, family === 'passive' ? 'primary' : 'supporting');
  }
  const cardRes = m(f, 'passiveCardResources') + m(f, 'actionResources');
  if (cardRes > 0 && family === 'cardResource') {
    push('cardResources', 'resources on cards', cardRes, 'resources', 'primary');
  }
  const drawn = m(f, 'passiveCardsDrawn') + m(f, 'actionCardsDrawn');
  if (drawn > 0 && family === 'cardFlow') {
    push('cardsDrawn', 'cards drawn', drawn, 'cards', 'primary');
  }
  const convCat = conversionCategory(family);
  if (convCat !== undefined) {
    const vp = categoryVp(ctx, color, convCat);
    if (vp > 0) {
      push('boardVp', convCat === 'board' ? 'board VP' : 'measured VP', vp, 'vp', 'primary', 'derived');
    }
  }
  if (family === 'start') {
    push('startingCapital', 'starting capital', profile.startingMegacredits, 'mc', 'supporting', 'measured');
    const early = m(f, 'earlyValue');
    if (early > 0) {
      push('earlyTempo', 'early tempo', early, 'mc', 'primary', 'partial');
    }
  }
  if (out.length === 0) {
    // Never an empty metric list — show the starting capital as the honest baseline.
    push('startingCapital', 'starting capital', profile.startingMegacredits, 'mc', 'context', 'measured');
  }
  return out.slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────
// Achievements (generic archetype-driven; overrides may add bespoke ones)
// ─────────────────────────────────────────────────────────────────────────

function genericAchievements(ctx: InsightContext, _color: Color, profile: CorporationProfile, f: EndgameFact | undefined): Array<CorporationAchievement> {
  const family = familyOf(profile);
  const out: Array<CorporationAchievement> = [];
  const act = corporationActionStats(f, ctx.generation);
  const total = m(f, 'totalMeasuredValue');
  const saved = m(f, 'passiveSaved');
  const triggers = m(f, 'passiveTriggers');
  const cardRes = m(f, 'passiveCardResources') + m(f, 'actionResources');

  const add = (id: string, tier: CorporationAchievementTier, chips: Array<EvidenceChip>, title: string) => {
    out.push({id, title, description: title, tier, placementHint: hintFor(tier), evidenceChips: chips});
  };

  if (family === 'action' && profile.hasAction && act.uses > 0) {
    const tier: CorporationAchievementTier | undefined =
      act.uses >= 10 && act.useRate >= 0.85 ? 'platinum' :
        act.uses >= 8 ? 'gold' :
          act.uses >= 6 ? 'silver' :
            act.uses >= 4 ? 'bronze' : undefined;
    if (tier !== undefined) {
      add('actionEngine', tier, [chipN(`×${act.uses}`, 'good', 'uses')], 'A button worth pressing');
    }
  }
  if (family === 'cardResource' && cardRes > 0) {
    // A dominant resource engine can reach platinum (the path to "why the winner won").
    const tier: CorporationAchievementTier | undefined =
      cardRes >= 36 ? 'platinum' : cardRes >= 24 ? 'gold' : cardRes >= 14 ? 'silver' : cardRes >= 7 ? 'bronze' : undefined;
    if (tier !== undefined) {
      add('resourceFarm', tier, [chipN(cardRes, 'good', 'resources')], 'Farmed its own resources');
    }
  }
  if ((family === 'economy' || isCapitalArchetype(profile.archetype)) && saved > 0) {
    const tier: CorporationAchievementTier | undefined =
      saved >= 30 ? 'gold' : saved >= 18 ? 'silver' : saved >= 9 ? 'bronze' : undefined;
    if (tier !== undefined) {
      add('economyEngine', tier, [chipN(`+${saved}`, 'good', 'M€')], 'A standing economy');
    }
  }
  // A passive engine (any family that isn't action/cardResource/economy — city / terraform /
  // colony / space / disruption / card flow) that triggered a lot or produced measured value.
  if (family !== 'action' && family !== 'cardResource' && family !== 'economy' && (triggers > 0 || total > 0)) {
    const tier: CorporationAchievementTier | undefined =
      triggers >= 12 || total >= 30 ? 'gold' : triggers >= 7 || total >= 16 ? 'silver' : triggers >= 3 ? 'bronze' : undefined;
    if (tier !== undefined) {
      add('passiveEngine', tier, [chipN(triggers, 'metric', 'triggers')], 'A passive that paid');
    }
  }
  return out;
}

function hintFor(tier: CorporationAchievementTier): CorporationAchievement['placementHint'] {
  switch (tier) {
  case 'platinum': return 'why_winner_won';
  case 'gold': return 'unusual_episode';
  default: return 'additional_observation';
  }
}

function topAchievementTier(achievements: ReadonlyArray<CorporationAchievement>): CorporationAchievementTier | undefined {
  const order: Array<CorporationAchievementTier> = ['platinum', 'gold', 'silver', 'bronze'];
  return order.find((t) => achievements.some((a) => a.tier === t));
}

// ─────────────────────────────────────────────────────────────────────────
// Placement (§7) + anti-overclaim (§19) + loser handling (§20)
// ─────────────────────────────────────────────────────────────────────────

function derivePlacement(
  ctx: InsightContext, color: Color, tier: EfficiencyTier,
  achievements: ReadonlyArray<CorporationAchievement>, confidence: ImpactConfidence,
): CorporationPlacement {
  const isWinner = color === ctx.winner.color;
  const top = topAchievementTier(achievements);
  let placement: CorporationPlacement = 'player_profile_only';
  if (top === 'platinum') {
    placement = 'why_winner_won';
  } else if (top === 'gold') {
    placement = 'unusual_episode';
  } else if (top === 'silver' || top === 'bronze') {
    placement = 'additional_observation';
  }

  // why_winner_won is reserved: winner only, high confidence, and a real magnitude. A
  // platinum achievement on a non-winner (or a shaky read) drops to an episode/observation.
  if (placement === 'why_winner_won') {
    if (!isWinner || confidence !== 'high' || TIER_RANK[tier] < TIER_RANK.exceptional) {
      placement = isWinner ? 'unusual_episode' : 'additional_observation';
    }
  }
  // what_defined_game is only for a signature winner corp (the corporation WAS the game).
  if (isWinner && tier === 'signature' && confidence === 'high' && top === 'platinum') {
    placement = 'what_defined_game';
  }

  // Anti-overclaim (§19): a winner whose corp was only minor/solid never reaches the main
  // sections automatically — cap at an observation so a pretty corp doesn't "win the game".
  if (isWinner && TIER_RANK[tier] <= TIER_RANK.solid) {
    placement = placement === 'player_profile_only' ? 'player_profile_only' : 'additional_observation';
  }
  return placement;
}

// ─────────────────────────────────────────────────────────────────────────
// Narrative (the spec's §5/§16 — ALWAYS a readout, even with no achievements)
// ─────────────────────────────────────────────────────────────────────────

// What "worked" reads as, per impact family (English i18n KEYS — the convention is
// English text as key; ru/endgame.json maps each to Russian).
const WORKED_BY_FAMILY: Record<ImpactFamily, string> = {
  action: 'the corporate action fired repeatedly',
  passive: 'the passive triggered steadily',
  cardResource: 'resources stacked up on the corporation card',
  economy: 'the economy bought tempo',
  board: 'the board paid off in points',
  space: 'the space line compounded',
  colony: 'the colonies fed an economy',
  cardFlow: 'cards kept flowing',
  terraform: 'terraforming paid the corporation',
  start: 'the opening package bought early tempo',
  generalist: 'the flexible base opened plays',
};

// The SUPPORT / minor readout per family — the corporation NAME is interpolated (${1}) so
// the line still reads bespoke. Params: ${0}=player, ${1}=corp, ${2}=archetype label.
const SUPPORT_BY_FAMILY: Record<ImpactFamily, string> = {
  action: '${1} gave ${0} an action engine, but the corporation was not a separate source of the lead.',
  passive: '${1}’s passive ticked along for ${0}, but it stayed in the background.',
  cardResource: '${1} fed resources onto its own card for ${0}, but the stockpile was not the deciding block.',
  economy: '${1} supported ${0}’s economy with discounts and cash, but it was not a decisive engine.',
  board: '${1} set ${0} a board direction, but it did not become a separate source of the lead.',
  space: '${1} pushed ${0} toward space, but the orbital line stayed secondary.',
  colony: '${1} set ${0} a colony tempo, but trade stayed a support rather than the main source of points.',
  cardFlow: '${1} kept cards flowing for ${0}, but the draw advantage did not turn into a clear swing.',
  terraform: '${1} opened a terraforming line for ${0}, but it stayed a support line.',
  start: '${1}’s opening package gave ${0} early tempo, but the game was decided by other lines.',
  generalist: '${1} gave ${0} a flexible base, but no single line became the reason for the result.',
};

function buildNarrative(
  ctx: InsightContext, color: Color, corp: CardName, profile: CorporationProfile,
  family: ImpactFamily, tier: EfficiencyTier,
): {summary: CorporationLine; worked?: string; missed?: string} {
  const p = playerOf(ctx, color);
  const params: Array<InsightParam> = [raw(p?.name ?? ''), cardP(corp), i18nP(ARCHETYPE_LABEL[profile.archetype])];
  let key: string;
  let worked: string | undefined = WORKED_BY_FAMILY[family];
  let missed: string | undefined;
  switch (tier) {
  case 'signature':
    key = 'The ${1} corporation was central to ${0}’s game.';
    break;
  case 'exceptional':
  case 'strong':
    // Reuse the archetype's "engine did its job" line (already translated).
    key = ARCHETYPE_ENGINE_TEXT[profile.archetype];
    break;
  case 'solid':
    if (family === 'start') {
      key = 'A fast start by design: ${1} handed ${0} an opening budget that bought early tempo others had to wait for.';
      missed = 'the early lead never reached the final score';
    } else {
      key = SUPPORT_BY_FAMILY[family];
    }
    break;
  case 'minor':
    key = SUPPORT_BY_FAMILY[family];
    worked = undefined;
    break;
  case 'missed':
  default:
    worked = undefined;
    if (profile.hasAction) {
      key = '${1} could have been an engine for ${0} — its corporate action sat unused while the game slipped away.';
      missed = 'the corporate action was barely used';
    } else {
      key = '${1}’s potential was visible, but it never built up enough to affect ${0}’s score.';
      missed = 'the corporation never built up a measured contribution';
    }
    break;
  }
  return {summary: {key, params}, worked, missed};
}

// ─────────────────────────────────────────────────────────────────────────
// Per-corporation OVERRIDE map (generic + bespoke — the project's pattern)
// ─────────────────────────────────────────────────────────────────────────

/**
 * A bespoke override refines the GENERIC archetype readout for a marquee corporation: it can
 * supply a custom signal (combining the corp fact with the player's strategic OUTCOME) and/or
 * extra achievements. Both optional — the generic archetype path (+ the family support template,
 * which interpolates the corp name so it still reads bespoke) fills the rest. Corps without an
 * override are handled wholly by the generic path (ruleStatus 'generic' — honest, not "missing").
 */
export type CorporationRuleOverride = {
  /** Refine / replace the 0..1 impact signal (e.g. read the board category, awards, …). */
  signal?: (ctx: InsightContext, color: Color, profile: CorporationProfile, f: EndgameFact | undefined, base: Signal) => Signal;
  /** Extra achievements on top of the generic ones. */
  achievements?: (ctx: InsightContext, color: Color, profile: CorporationProfile, f: EndgameFact | undefined) => Array<CorporationAchievement>;
};

const ach = (id: string, tier: CorporationAchievementTier, chips: Array<EvidenceChip>, title: string): CorporationAchievement =>
  ({id, title, description: title, tier, placementHint: hintFor(tier), evidenceChips: chips});

const CORP_RULE_OVERRIDES: Partial<Record<CardName, CorporationRuleOverride>> = {
  // Ecoline — greenery / board engine (§13). Its story is board VP, not the corp's own events.
  [CardName.ECOLINE]: {
    signal: (ctx, color, _p, f, base) => {
      const board = categoryVp(ctx, color, 'board');
      return {...base, impact: clamp01(board / 32 * 0.7 + m(f, 'totalMeasuredValue') / 30 * 0.3), converted: board >= 10};
    },
    achievements: (ctx, color) => {
      const board = categoryVp(ctx, color, 'board');
      const t: CorporationAchievementTier | undefined = board >= 22 ? 'gold' : board >= 12 ? 'silver' : board >= 6 ? 'bronze' : undefined;
      return t !== undefined ? [ach('ecolineBoard', t, [chipN(board, 'good', 'VP')], 'Greened the planet')] : [];
    },
  },
  // Tharsis Republic — city / board economy (§13).
  [CardName.THARSIS_REPUBLIC]: {
    signal: (ctx, color, _p, f, base) => {
      const board = categoryVp(ctx, color, 'board');
      const saved = m(f, 'passiveSaved') + m(f, 'passiveProduction');
      return {...base, impact: clamp01(board / 30 * 0.55 + saved / 24 * 0.45), converted: board >= 8};
    },
    achievements: (ctx, color) => {
      const board = categoryVp(ctx, color, 'board');
      const t: CorporationAchievementTier | undefined = board >= 22 ? 'gold' : board >= 12 ? 'silver' : board >= 6 ? 'bronze' : undefined;
      return t !== undefined ? [ach('cityNetwork', t, [chipN(board, 'good', 'VP')], 'Ran the city economy')] : [];
    },
  },
  // Credicor — big-project rebate economy (§13). Not just starting cash — measured rebates.
  [CardName.CREDICOR]: {
    signal: (ctx, color, _p, f, base) => {
      const saved = m(f, 'passiveSaved');
      return {...base, impact: clamp01(saved / 28 * 0.7 + m(f, 'earlyValue') / 24 * 0.3), converted: playerScored(ctx, color)};
    },
  },
  // Saturn Systems — Jovian / space synergy (§13). Don't claim a "Jovian finish" unless cards scored.
  [CardName.SATURN_SYSTEMS]: {
    signal: (ctx, color, _p, f, base) => {
      const cards = categoryVp(ctx, color, 'cards');
      return {...base, impact: clamp01(m(f, 'totalMeasuredValue') / 28 * 0.4 + cards / 34 * 0.6), converted: cards >= 10};
    },
  },
  // Point Luna — Earth-tag card flow (§13).
  [CardName.POINT_LUNA]: {
    achievements: (_ctx, _color, _p, f) => {
      const drawn = m(f, 'passiveCardsDrawn') + m(f, 'actionCardsDrawn');
      const t: CorporationAchievementTier | undefined = drawn >= 12 ? 'gold' : drawn >= 7 ? 'silver' : drawn >= 4 ? 'bronze' : undefined;
      return t !== undefined ? [ach('cardFlowEngine', t, [chipN(drawn, 'good', 'cards drawn')], 'Drew the deck into an engine')] : [];
    },
  },
  // Poseidon — colony engine (§13). Dedups the generic colony insight.
  [CardName.POSEIDON]: {
    signal: (ctx, color, _p, f, base) => {
      const tracks = categoryVp(ctx, color, 'tracks');
      return {...base, impact: clamp01(m(f, 'totalMeasuredValue') / 26 * 0.5 + tracks / 20 * 0.5), converted: tracks >= 4 || playerScored(ctx, color)};
    },
  },
  // Vitor — card-VP + award funding (§13).
  [CardName.VITOR]: {
    achievements: (ctx, color) => {
      const p = playerOf(ctx, color);
      // The funder token is the RAW server name — match the raw name, not the
      // localized display «Бот».
      const funded = (p?.breakdown.detailsAwards ?? []).some((d) => (d.messageArgs ?? [])[2] === (p?.rawName ?? p?.name));
      const mca = categoryVp(ctx, color, 'mca');
      return funded && mca >= 8 ? [ach('vitorAwards', mca >= 14 ? 'gold' : 'silver', [chipN(mca, 'good', 'VP')], 'Funded the awards that paid off')] : [];
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Single-corporation impact
// ─────────────────────────────────────────────────────────────────────────

function confidenceOf(profile: CorporationProfile | undefined, f: EndgameFact | undefined, family: ImpactFamily): ImpactConfidence {
  if (profile === undefined) {
    return 'low';
  }
  if (f === undefined) {
    return 'low';
  }
  // Mixed-unit / flag-ish families never claim high confidence.
  if (family === 'generalist' || family === 'terraform') {
    return 'medium';
  }
  const total = m(f, 'totalMeasuredValue');
  return total >= 14 ? 'high' : total > 0 ? 'medium' : 'low';
}

function buildSingleImpact(ctx: InsightContext, color: Color, corp: CardName): CorporationImpact {
  const profile = corporationProfile(corp);
  const f = corpFactFor(ctx, color, corp);

  // Out-of-scope / unknown corporation — a conservative generic readout, never above an
  // observation, never hidden from the player profile (§12).
  if (profile === undefined) {
    const total = m(f, 'totalMeasuredValue');
    const p = playerOf(ctx, color);
    return {
      corporationName: corp, color, archetype: 'generalist', archetypeLabel: ARCHETYPE_LABEL.generalist,
      efficiencyTier: total > 0 ? 'solid' : 'minor',
      placement: total > 0 ? 'additional_observation' : (f === undefined ? 'suppress' : 'player_profile_only'),
      confidence: 'low', realized: 'present', title: ARCHETYPE_LABEL.generalist,
      summary: {key: 'The ${1} corporation was central to ${0}’s game.', params: [raw(p?.name ?? ''), cardP(corp)]},
      playerProfileSummary: {key: 'The ${1} corporation was central to ${0}’s game.', params: [raw(p?.name ?? ''), cardP(corp)]},
      metrics: total > 0 ? [{id: 'measured', label: 'measured VP', value: total, unit: 'vp', role: 'primary', confidence: 'partial'}] : [],
      achievements: [], caveats: ['This corporation is outside the current analysis scope.'], ruleStatus: 'missing',
    };
  }

  const family = familyOf(profile);
  const override = CORP_RULE_OVERRIDES[corp];
  const baseSignal = genericSignal(ctx, color, profile, f);
  const signal = override?.signal !== undefined ? override.signal(ctx, color, profile, f, baseSignal) : baseSignal;
  const tier = deriveTier(signal);

  const achievements = [
    ...genericAchievements(ctx, color, profile, f),
    ...(override?.achievements !== undefined ? override.achievements(ctx, color, profile, f) : []),
  ];
  const confidence = confidenceOf(profile, f, family);
  let placement = derivePlacement(ctx, color, tier, achievements, confidence);
  // Underused corporation (§7) — an unfired corporate ACTION on a player who lost CLOSELY
  // is surfaced as an observation (untapped potential tied to the result), never for a
  // winner or a blowout (no toxic "you misplayed").
  if (placement === 'player_profile_only' && profile.hasAction && tier === 'missed' &&
      color !== ctx.winner.color && ctx.margin > 0 && ctx.margin <= 10) {
    placement = 'additional_observation';
  }
  const metrics = buildMetrics(ctx, color, profile, f);
  const {summary, worked, missed} = buildNarrative(ctx, color, corp, profile, family, tier);

  const caveats: Array<string> = [];
  if (f === undefined) {
    caveats.push('This corporation produced no measured events — its value was its start and rules.');
  } else if (family === 'generalist' || family === 'terraform') {
    caveats.push('Part of the value is in mixed units — no exact M€/VP estimate is made.');
  }

  const realized: CorporationImpact['realized'] =
    TIER_RANK[tier] >= TIER_RANK.strong ? 'carried' :
      profile.hasAction && tier === 'missed' ? 'underused' :
        isCapitalArchetype(profile.archetype) && tier !== 'missed' ? 'start' : 'present';

  return {
    corporationName: corp, color, archetype: profile.archetype, archetypeLabel: ARCHETYPE_LABEL[profile.archetype],
    efficiencyTier: tier, placement, confidence, realized,
    title: ARCHETYPE_LABEL[profile.archetype], summary,
    playerProfileSummary: summary, worked, missed, metrics, achievements,
    caveats: caveats.length > 0 ? caveats : undefined,
    ruleStatus: override !== undefined ? 'specific' : 'generic',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Merger — a fused double corporation (the special high-priority case, §9 of Iter13)
// ─────────────────────────────────────────────────────────────────────────

function buildMergerImpact(ctx: InsightContext, color: Color, corps: ReadonlyArray<string>): CorporationImpact {
  const details = corps
    .map((name) => ({name, value: m(corpFactFor(ctx, color, name as CardName), 'totalMeasuredValue')}))
    .sort((a, b) => b.value - a.value);
  const [a0, a1] = details;
  const both = a0.value >= 8 && a1.value >= 8;
  const isWinner = color === ctx.winner.color;
  const p = playerOf(ctx, color);
  const tier: EfficiencyTier = both ? (isWinner ? 'exceptional' : 'strong') : a0.value >= 8 ? 'solid' : 'minor';
  const mergedBothKey = 'A double corporation paid off: ${0} fused ${1} and ${2}, and both pulled their weight.';
  const mergedOneKey = '${0} merged into ${1} and ${2}, but only one of the two really carried the game.';
  const achievements: Array<CorporationAchievement> = both ?
    [ach('mergerDouble', isWinner ? 'platinum' : 'gold', [chipL(a0.name, 'good'), chipL(a1.name, 'neutral')], 'A double engine')] :
    a0.value >= 8 ? [ach('mergerOne', 'silver', [chipL(a0.name, 'good')], 'A double start')] : [];
  const placement = derivePlacement(ctx, color, tier, achievements, both ? 'high' : 'medium');
  return {
    corporationName: a0.name, mergedWith: a1.name, color, archetype: 'generalist',
    archetypeLabel: ARCHETYPE_LABEL.generalist, efficiencyTier: tier, placement,
    confidence: both ? 'high' : 'medium', realized: 'merged', title: ARCHETYPE_LABEL.generalist,
    summary: {key: both ? mergedBothKey : mergedOneKey, params: [raw(p?.name ?? ''), cardP(a0.name), cardP(a1.name)]},
    playerProfileSummary: {key: both ? mergedBothKey : mergedOneKey, params: [raw(p?.name ?? ''), cardP(a0.name), cardP(a1.name)]},
    worked: both ? 'both corporations pulled their weight' : undefined,
    metrics: [
      {id: 'corpA', label: 'measured VP', value: a0.value, unit: 'vp', role: 'primary', confidence: 'partial'},
      {id: 'corpB', label: 'measured VP', value: a1.value, unit: 'vp', role: 'supporting', confidence: 'partial'},
    ],
    achievements, ruleStatus: 'specific',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public — build every player's corporation impact (ALWAYS one per player, §5)
// ─────────────────────────────────────────────────────────────────────────

export function buildCorporationImpacts(ctx: InsightContext): Array<CorporationImpact> {
  const out: Array<CorporationImpact> = [];
  for (const p of ctx.players) {
    const corps = p.corporations.filter((c) => c !== MERGER_PRELUDE);
    if (corps.length === 0) {
      continue;
    }
    if (corps.length >= 2) {
      out.push(buildMergerImpact(ctx, p.color, corps));
      continue;
    }
    out.push(buildSingleImpact(ctx, p.color, corps[0] as CardName));
  }
  return out;
}

export function corporationImpactFor(ctx: InsightContext, color: Color): CorporationImpact | undefined {
  return (ctx.corporationImpacts ?? []).find((i) => i.color === color);
}

// ─────────────────────────────────────────────────────────────────────────
// Audit (§2) + debug (§23)
// ─────────────────────────────────────────────────────────────────────────

export type CorporationAuditEntry = {
  corporationName: string;
  includedInCurrentScope: boolean;
  hasStartPackage: boolean;
  hasActiveAction: boolean;
  hasPassiveOrEngine: boolean;
  archetype: CorporationArchetype;
  ruleStatus: 'specific' | 'generic';
};

/** The static scope audit — every registered (in-scope) corporation, whether it has a
 *  bespoke override (specific) or only the generic archetype path. Turmoil and other
 *  out-of-scope corporations are intentionally absent from the registry → not required. */
export function buildCorporationAudit(): Array<CorporationAuditEntry> {
  const out: Array<CorporationAuditEntry> = [];
  for (const name of registeredCorporationNames()) {
    const profile = corporationProfile(name);
    if (profile === undefined) {
      continue; // unreachable — registeredCorporationNames() returns only registry keys
    }
    const family = familyOf(profile);
    out.push({
      corporationName: name,
      includedInCurrentScope: true,
      hasStartPackage: profile.startingMegacredits > 0,
      hasActiveAction: profile.hasAction,
      hasPassiveOrEngine: family !== 'start' && family !== 'generalist',
      archetype: profile.archetype,
      ruleStatus: CORP_RULE_OVERRIDES[name] !== undefined ? 'specific' : 'generic',
    });
  }
  return out;
}

export type CorporationDebug = {
  coverage: {totalInScope: number; specific: number; generic: number};
  byPlayer: Array<{
    color: Color; corporationName: string; archetype: string; tier: EfficiencyTier;
    placement: CorporationPlacement; confidence: ImpactConfidence; ruleStatus: string;
    achievements: ReadonlyArray<{id: string; tier: CorporationAchievementTier}>;
    metrics: ReadonlyArray<{label: string; value: number | string}>;
    caveats: ReadonlyArray<string>;
  }>;
  suppressed: Array<{color: Color; corporationName: string}>;
};

export function buildCorporationDebug(ctx: InsightContext): CorporationDebug {
  const audit = buildCorporationAudit();
  const impacts = ctx.corporationImpacts ?? buildCorporationImpacts(ctx);
  return {
    coverage: {
      totalInScope: audit.length,
      specific: audit.filter((a) => a.ruleStatus === 'specific').length,
      generic: audit.filter((a) => a.ruleStatus === 'generic').length,
    },
    byPlayer: impacts.map((i) => ({
      color: i.color, corporationName: i.corporationName, archetype: i.archetype,
      tier: i.efficiencyTier, placement: i.placement, confidence: i.confidence, ruleStatus: i.ruleStatus,
      achievements: i.achievements.map((a) => ({id: a.id, tier: a.tier})),
      metrics: i.metrics.map((mm) => ({label: mm.label, value: mm.value})),
      caveats: i.caveats ?? [],
    })),
    suppressed: impacts.filter((i) => i.placement === 'suppress').map((i) => ({color: i.color, corporationName: i.corporationName})),
  };
}
