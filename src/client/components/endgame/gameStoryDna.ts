/*
 * Game Story DNA — the META-LAYER above facts + insight candidates (Iteration 9).
 *
 * The fact-based analyzers (Iterations 5–8) each notice ONE true thing. That gives a
 * pile of correct-but-disconnected cards. This layer answers the question the pile
 * can't: "WHY was THIS game special?" — it classifies the game's STORY TYPE, names the
 * main CONFLICT, builds per-player ARCS, lists the TWISTS and SIGNATURE moments, and
 * recommends which insight CLUSTER should headline. The composer (insightEngine
 * `composeStory`) then boosts on-story candidates, penalizes off-story generics, picks
 * a hero that MATCHES the DNA, and assigns story ROLES — turning the candidate list
 * into a composed post-game report.
 *
 * Design contract (mirrors insightEngine.ts / specialCardStories.ts):
 *   • PURE — no Vue / DOM / i18n. Texts are English i18n KEYS. Deterministic.
 *   • NO RUNTIME dependency on insightEngine (type-only imports) — avoids a module
 *     cycle (insightEngine imports THIS for the composer). Player styles are injected
 *     via the optional `styleOf` callback so the canonical `duelStyle` isn't duplicated.
 *   • CANDIDATE-DRIVEN — the candidates already encode the detected facts (cluster /
 *     family / id / scores / finalScore), so the storyType is a meta-classification
 *     over them + a few raw ctx fields (margin, timeline, leftover M€). Graceful: an
 *     empty candidate set / quiet game resolves to `balanced_control` with low scores.
 */
import type {Color} from '@/common/Color';
import type {CardName} from '@/common/cards/CardName';
import type {EndgameFact} from '@/common/events/endgameFacts';
import type {EndgameCategoryKey} from '@/client/components/endgame/endgameModel';
import type {InsightCandidate, InsightContext, InsightFamily} from '@/client/components/endgame/insightEngine';
import {buildStyleDetail, buildCorporationDetail, type ChipDetail} from '@/client/components/endgame/insightDetail';
import {ARCHETYPE_LABEL, corporationProfile} from '@/client/components/endgame/corporationStories';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** The single dominant SHAPE of a finished game (the "what kind of game was this"). */
export type StoryType =
  | 'photo_finish' // decided by a hair / tiebreaker
  | 'late_comeback' // winner trailed, then surged
  | 'runaway' // never in doubt
  | 'duel_styles' // two clearly different plans collided
  | 'economy_upset' // efficiency beat raw economy
  | 'terraforming_vs_cards' // visible planet vs hidden card scoring
  | 'award_betrayal' // a sponsor lost their own award
  | 'attack_pressure' // direct interaction shaped the result
  | 'rare_card_drama' // a rare/strong card scenario defined it
  | 'category_counterplay' // A took X, B answered with Y
  | 'card_flow_advantage' // card flow fed the scoring engine
  | 'colony_engine' // colonies carried a player
  | 'standard_project_plan' // standard projects as the plan
  | 'engine_not_converted' // resources/engine that never became points
  | 'merger_story' // a rare double corporation (Merger) defined the game
  | 'corporation_identity' // the corporation itself was the plan, and it delivered
  | 'balanced_control'; // a clean, all-round win — no single defining beat

export type StoryTitleKind = 'clash' | 'comeback' | 'domination' | 'upset' | 'duel' | 'pressure' | 'quiet';

export type PlayerStyle = string; // an i18n KEY (reuses the engine's duelStyle labels)

export type StoryTwistKind =
  | 'weakerEconomyWon' // winner had less economy but won
  | 'lessTerraformingWon' // winner moved the planet less but won
  | 'bestCardLost' // the single best card belonged to a loser
  | 'ledMostLost' // a player led most generations but lost
  | 'moneyNoConversion' // a big resource pile never became points
  | 'sponsorLostAward'; // funded an award, opponent took the points

export type StoryTwist = {
  kind: StoryTwistKind;
  players: ReadonlyArray<Color>;
  /** The candidate id that evidences this twist (for drill-down / debug). */
  candidateId?: string;
};

export type StoryMoment = {
  cluster: string;
  candidateId: string;
  /** i18n KEY — the candidate's badge (a short label for the moment). */
  label: string;
  color?: Color;
};

export type PlayerArc = {
  color: Color;
  style: PlayerStyle;
  strongestCategory: EndgameCategoryKey | undefined;
  /** The fact families this player's insights came from (their identity in the data). */
  strongestFactFamilies: ReadonlyArray<InsightFamily>;
  /** Leftover M€ — a high value with low card flow reads as "money with no outlet". */
  unusedPotential: number;
  directPressureApplied: number; // resources this player destroyed/stole from others
  directPressureReceived: number; // resources lost to others
  lateMomentum: number; // VP gained over the final two generations
  /** Short i18n tag KEYS describing the arc (e.g. 'Economy Engine', 'Under pressure'). */
  shortSummaryTags: ReadonlyArray<string>;
  /** Iteration 12 — the "why this style" explainability detail for the style chip. */
  styleDetail?: ChipDetail;
  /** Iteration 13 — the player's CORPORATION identity (name + archetype + how realized). */
  corporation?: {
    /** The (primary) corporation card name. */
    name: string;
    /** i18n KEY — the archetype label (Capital Starter / Metal Economy / …). */
    archetypeLabel: string;
    /** How the corporation played out this game. */
    realized: 'carried' | 'start' | 'underused' | 'merged' | 'present';
    /** The hover detail (what the corporation did) for the arc chip. */
    detail?: ChipDetail;
  };
};

export type GameStoryDNA = {
  storyType: StoryType;
  titleKind: StoryTitleKind;
  /** i18n KEY — the one-line "why this game was special" subtitle for the headline. */
  headlineKey: string;
  mainConflict?: {
    leftPlayer: Color;
    rightPlayer: Color;
    leftStyle: PlayerStyle;
    rightStyle: PlayerStyle;
    /** 0..1 — how different the two plans were (1 = sharply opposed styles). */
    contrastScore: number;
  };
  uniquenessScore: number; // 0..1 — how far from a generic game this was
  dramaScore: number; // 0..1
  rarityScore: number; // 0..1
  confidence: number; // 0..1 — min confidence of the signature evidence
  /** Clusters the composer should BOOST (the on-story spine). */
  signatureClusters: ReadonlyArray<string>;
  signatureCandidateIds: ReadonlyArray<string>;
  /** The cluster whose candidate should headline (the hero). */
  recommendedHeroCluster: string | undefined;
  recommendedPrimaryFamilies: ReadonlyArray<InsightFamily>;
  playerArcs: Partial<Record<Color, PlayerArc>>;
  twists: ReadonlyArray<StoryTwist>;
  keyMoments: ReadonlyArray<StoryMoment>;
  /** Generic theme clusters the composer should PENALIZE (they'd dilute the story). */
  suppressedGenericThemes: ReadonlyArray<string>;
  debug: {
    reasons: ReadonlyArray<string>;
    rejectedStoryTypes: ReadonlyArray<{type: StoryType; reason: string}>;
  };
};

// ─────────────────────────────────────────────────────────────────────────
// Self-contained helpers (no insightEngine runtime import → no cycle)
// ─────────────────────────────────────────────────────────────────────────

function facts(ctx: InsightContext): ReadonlyArray<EndgameFact> {
  return ctx.facts ?? [];
}
function factMetric(f: EndgameFact, k: string): number {
  return f.metrics[k] ?? 0;
}
/** A loss/attack fact's magnitude — `totalLost` (negativeInteraction) or `total` (cardAttack). */
function lossMagnitude(f: EndgameFact): number {
  return factMetric(f, 'totalLost') || factMetric(f, 'total');
}
const ATTACK_FACT_TYPES: ReadonlyArray<EndgameFact['type']> = ['negativeInteraction', 'cardAttack'];

const GENERIC_THEME_CLUSTERS: ReadonlyArray<string> = ['verdict', 'race', 'profile', 'categorySecondary'];

/** A clusterKey for a candidate (mirrors insightEngine.clusterOf without importing it). */
function clusterKey(c: InsightCandidate): string {
  return c.storyCluster ?? c.family ?? c.group;
}

/** A loose, style label fallback when no `styleOf` callback is supplied. */
function fallbackStyle(strongest: EndgameCategoryKey | undefined): PlayerStyle {
  switch (strongest) {
  case 'tr': return 'Terraformer';
  case 'cards': return 'Card Engine';
  case 'board': return 'Board Builder';
  case 'mca': return 'Award Hunter';
  case 'moon': return 'Board Builder';
  case 'tracks': return 'Card Engine';
  default: return 'Balanced';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Story-type detection — an ordered, most-special-first detector list
// ─────────────────────────────────────────────────────────────────────────

type DetectorInput = {
  ctx: InsightContext;
  hasId: (id: string) => boolean;
  hasCluster: (cluster: string) => boolean;
  topClusterScore: (cluster: string) => number;
};

type StoryDetector = {
  type: StoryType;
  titleKind: StoryTitleKind;
  heroCluster: string | undefined;
  primaryFamilies: ReadonlyArray<InsightFamily>;
  headlineKey: string;
  /** Returns a reason string when it matches, else undefined. */
  test: (i: DetectorInput) => string | undefined;
};

// The order is the priority: the FIRST matching detector wins. Most special / rarest
// shapes first so a once-a-season story is never masked by a routine one.
const DETECTORS: ReadonlyArray<StoryDetector> = [
  {
    type: 'photo_finish', titleKind: 'clash', heroCluster: 'verdict',
    primaryFamilies: ['verdict', 'turningPoint', 'duelContrast'],
    headlineKey: 'A photo finish — the game came down to the wire.',
    test: ({ctx}) => ctx.players.length >= 2 && ctx.margin >= 0 && ctx.margin <= 2 ?
      (ctx.margin === 0 ? 'tiebreaker (margin 0)' : `razor-thin margin (${ctx.margin})`) : undefined,
  },
  {
    type: 'late_comeback', titleKind: 'comeback', heroCluster: 'turningPoint',
    primaryFamilies: ['turningPoint', 'verdict', 'economy'],
    headlineKey: 'A late turn — the winner was behind, then surged to the front.',
    test: ({ctx, hasId}) => hasId('timeline.late-comeback') || hasId('timeline.comeback') ?
      'late-comeback timeline candidate' :
      ((ctx.timeline?.maxDeficit ?? 0) >= 8 && (ctx.timeline?.winnerTookLeadGen ?? 0) >= ctx.generation - 2 ?
        `winner overcame a ${ctx.timeline?.maxDeficit}-VP deficit late` : undefined),
  },
  {
    type: 'award_betrayal', titleKind: 'upset', heroCluster: 'awardRace',
    primaryFamilies: ['duelContrast', 'cardStory'],
    headlineKey: 'An award backfired on its own sponsor.',
    test: ({hasId}) => hasId('duel.award.sponsorLost') ? 'a sponsor lost their own award' : undefined,
  },
  {
    type: 'merger_story', titleKind: 'upset', heroCluster: 'merger',
    primaryFamilies: ['corporationImpact', 'economy', 'cardStory'],
    headlineKey: 'A rare double corporation defined the game.',
    test: ({hasCluster}) => hasCluster('merger') ? 'merger (double corporation) present' : undefined,
  },
  {
    type: 'rare_card_drama', titleKind: 'pressure', heroCluster: undefined,
    primaryFamilies: ['rareEvent', 'negativeDrama', 'cardStory'],
    headlineKey: 'A rare card scenario defined the game.',
    test: ({hasCluster}) => {
      for (const c of ['resourceDisruption', 'predators', 'vermin']) {
        if (hasCluster(c)) {
          return `rare-card cluster present: ${c}`;
        }
      }
      return undefined;
    },
  },
  {
    type: 'attack_pressure', titleKind: 'pressure', heroCluster: undefined,
    primaryFamilies: ['negativeDrama', 'rareEvent', 'duelContrast'],
    headlineKey: 'Direct pressure shaped the result.',
    test: ({hasCluster}) => {
      for (const c of ['attackPressure', 'productionSteal', 'plantDenial', 'counterStyle', 'attackDamage']) {
        if (hasCluster(c)) {
          return `attack cluster present: ${c}`;
        }
      }
      return undefined;
    },
  },
  {
    type: 'economy_upset', titleKind: 'upset', heroCluster: 'economyUpset',
    primaryFamilies: ['economy', 'duelContrast', 'unusedPotential'],
    headlineKey: 'Economy on one side, efficiency on the other.',
    test: ({hasCluster}) => hasCluster('economyUpset') || hasCluster('economyConversion') ?
      'economy-upset / conversion cluster present' : undefined,
  },
  {
    type: 'terraforming_vs_cards', titleKind: 'clash', heroCluster: 'globalMismatch',
    primaryFamilies: ['globalParameter', 'cardStory', 'duelContrast'],
    headlineKey: 'Visible terraforming against hidden card scoring.',
    test: ({hasCluster}) => hasCluster('globalMismatch') ? 'planet-moved-but-lost cross-fact present' : undefined,
  },
  {
    type: 'category_counterplay', titleKind: 'duel', heroCluster: 'counterplay',
    primaryFamilies: ['duelContrast', 'cardStory'],
    headlineKey: 'Move and counter-move across two categories.',
    test: ({hasId}) => hasId('duel.counterplay') ? 'duel category counterplay present' : undefined,
  },
  {
    type: 'duel_styles', titleKind: 'duel', heroCluster: 'duelContrast',
    primaryFamilies: ['duelContrast', 'economy', 'cardStory'],
    headlineKey: 'A duel of styles — two different plans collided.',
    test: ({hasId}) => hasId('duel.styleContrast') ? 'duel style contrast present' : undefined,
  },
  {
    type: 'card_flow_advantage', titleKind: 'domination', heroCluster: 'cardFlow',
    primaryFamilies: ['reveal', 'cardStory', 'economy'],
    headlineKey: 'Card flow fed the engine that won.',
    test: ({hasCluster}) => hasCluster('cardFlow') || hasCluster('reveal') ?
      'card-flow / reveal cluster present' : undefined,
  },
  {
    type: 'corporation_identity', titleKind: 'domination', heroCluster: 'corporation',
    primaryFamilies: ['corporationImpact', 'economy', 'cardStory'],
    headlineKey: 'The corporation was the plan — and it delivered.',
    test: ({hasCluster}) => hasCluster('corporation') ? 'corporation engine cluster present' : undefined,
  },
  {
    type: 'colony_engine', titleKind: 'domination', heroCluster: 'colony',
    primaryFamilies: ['colony', 'economy'],
    headlineKey: 'A colony engine carried the game.',
    test: ({hasCluster}) => hasCluster('colony') ? 'colony cluster present' : undefined,
  },
  {
    type: 'standard_project_plan', titleKind: 'domination', heroCluster: 'standardProject',
    primaryFamilies: ['standardProject', 'globalParameter'],
    headlineKey: 'Standard projects were the plan.',
    test: ({hasCluster}) => hasCluster('standardProject') ? 'standard-project cluster present' : undefined,
  },
  {
    type: 'engine_not_converted', titleKind: 'upset', heroCluster: 'unusedMoney',
    primaryFamilies: ['unusedPotential', 'blueAction', 'economy'],
    headlineKey: 'An engine that never turned into points.',
    test: ({hasCluster}) => hasCluster('unusedMoney') || hasCluster('unused') ?
      'unused-potential cluster present' : undefined,
  },
  {
    type: 'runaway', titleKind: 'domination', heroCluster: 'verdict',
    primaryFamilies: ['verdict', 'economy', 'cardStory'],
    headlineKey: 'Never in doubt — a commanding, wire-to-wire win.',
    test: ({ctx}) => ctx.margin >= 30 || (ctx.timeline?.wireToWire === true && ctx.margin >= 20) ?
      `commanding margin (${ctx.margin})` : undefined,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// buildGameStoryDna
// ─────────────────────────────────────────────────────────────────────────

export type BuildStoryDnaOptions = {
  /** Inject the canonical style label (insightEngine.duelStyle) — avoids duplication. */
  styleOf?: (color: Color) => PlayerStyle;
};

/**
 * Classify the game's story from the (already-scored) candidates + ctx.
 * `candidates` should carry `finalScore` (the composer scores them first) so key
 * moments rank correctly; if absent, priority is used as a fallback ranking key.
 */
export function buildGameStoryDna(
  ctx: InsightContext,
  candidates: ReadonlyArray<InsightCandidate>,
  opts: BuildStoryDnaOptions = {},
): GameStoryDNA {
  const ids = new Set(candidates.map((c) => c.id));
  const clusters = new Map<string, Array<InsightCandidate>>();
  for (const c of candidates) {
    const k = clusterKey(c);
    let arr = clusters.get(k);
    if (arr === undefined) {
      arr = [];
      clusters.set(k, arr);
    }
    arr.push(c);
  }
  const scoreOf = (c: InsightCandidate): number => c.finalScore ?? c.priority;
  const di: DetectorInput = {
    ctx,
    hasId: (id) => ids.has(id),
    hasCluster: (cl) => clusters.has(cl),
    topClusterScore: (cl) => (clusters.get(cl) ?? []).reduce((m, c) => Math.max(m, scoreOf(c)), 0),
  };

  // 1) Detect the story type.
  const reasons: Array<string> = [];
  const rejected: Array<{type: StoryType; reason: string}> = [];
  let chosen: StoryDetector | undefined;
  for (const d of DETECTORS) {
    const reason = d.test(di);
    if (reason === undefined) {
      continue;
    }
    if (chosen === undefined) {
      chosen = d;
      reasons.push(`${d.type}: ${reason}`);
    } else {
      rejected.push({type: d.type, reason: `also matched (${reason}) but ${chosen.type} ranked higher`});
    }
  }
  // Fallback — a clean, undramatic win.
  const detector: StoryDetector = chosen ?? {
    type: 'balanced_control', titleKind: 'quiet', heroCluster: undefined,
    primaryFamilies: ['verdict', 'cardStory', 'economy'],
    headlineKey: 'A steady, all-round win without one decisive moment.',
    test: () => undefined,
  };
  if (chosen === undefined) {
    reasons.push('balanced_control: no special story signal — falling back');
  }

  // 2) Resolve the recommended hero cluster (must be a cluster that actually exists).
  let heroCluster = detector.heroCluster;
  if (heroCluster === undefined || !clusters.has(heroCluster)) {
    // Pick the highest-scoring present cluster among the story's primary families.
    let best: {cluster: string; score: number} | undefined;
    for (const [cl, list] of clusters) {
      const inFamily = list.some((c) => c.family !== undefined && detector.primaryFamilies.includes(c.family));
      const top = list.reduce((m, c) => Math.max(m, scoreOf(c)), 0);
      if (inFamily && (best === undefined || top > best.score)) {
        best = {cluster: cl, score: top};
      }
    }
    // Last resort: the single highest-scoring candidate's cluster.
    if (best === undefined && candidates.length > 0) {
      const top = [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a))[0];
      best = {cluster: clusterKey(top), score: scoreOf(top)};
    }
    heroCluster = best?.cluster ?? heroCluster;
  }

  // 3) Signature clusters / candidates — the on-story spine the composer boosts.
  const signatureClusters = new Set<string>();
  if (heroCluster !== undefined) {
    signatureClusters.add(heroCluster);
  }
  for (const [cl, list] of clusters) {
    if (list.some((c) => c.family !== undefined && detector.primaryFamilies.includes(c.family))) {
      signatureClusters.add(cl);
    }
  }
  const signatureCandidateIds = candidates
    .filter((c) => signatureClusters.has(clusterKey(c)))
    .map((c) => c.id);

  // 4) Player arcs.
  const playerArcs: Partial<Record<Color, PlayerArc>> = {};
  for (const p of ctx.players) {
    const familiesSet = new Set<InsightFamily>();
    for (const c of candidates) {
      if (c.family !== undefined && (c.relatedPlayers ?? []).includes(p.color)) {
        familiesSet.add(c.family);
      }
    }
    const style = opts.styleOf?.(p.color) ?? fallbackStyle(p.strongestCategory);
    // The attacker is `player`; the victim is `targetPlayer`.
    const pressureApplied = facts(ctx)
      .filter((f) => ATTACK_FACT_TYPES.includes(f.type) && f.player === p.color)
      .reduce((s, f) => s + lossMagnitude(f), 0);
    const received = facts(ctx)
      .filter((f) => ATTACK_FACT_TYPES.includes(f.type) && f.targetPlayer === p.color)
      .reduce((s, f) => s + lossMagnitude(f), 0);
    const gens = p.vpByGeneration;
    const lateMomentum = gens.length >= 3 ? Math.max(0, gens[gens.length - 1] - gens[gens.length - 3]) : 0;
    const tags: Array<string> = [style];
    if (received >= 6) {
      tags.push('Under pressure');
    }
    if (p.megacredits >= 25) {
      tags.push('Money to spare');
    }
    // Iteration 13 — the corporation identity for this player's arc.
    let corporation: PlayerArc['corporation'];
    const corpName = p.corporations[0];
    if (corpName !== undefined) {
      const profile = corporationProfile(corpName as CardName);
      const corpInsight = candidates.find((c) => c.family === 'corporationImpact' && (c.relatedPlayers ?? []).includes(p.color));
      let realized: NonNullable<PlayerArc['corporation']>['realized'] = 'present';
      if (corpInsight !== undefined) {
        if (corpInsight.id.startsWith('corp.merger')) {
          realized = 'merged';
        } else if (corpInsight.id.startsWith('corp.underused')) {
          realized = 'underused';
        } else if (corpInsight.id.startsWith('corp.start')) {
          realized = 'start';
        } else {
          realized = 'carried';
        }
      } else if (p.corporations.length >= 2) {
        realized = 'merged';
      }
      corporation = {
        name: corpName,
        archetypeLabel: profile !== undefined ? ARCHETYPE_LABEL[profile.archetype] : 'Corporation',
        realized,
        detail: buildCorporationDetail(ctx, p.color, corpName as CardName),
      };
    }
    playerArcs[p.color] = {
      color: p.color,
      style,
      strongestCategory: p.strongestCategory,
      strongestFactFamilies: [...familiesSet],
      unusedPotential: p.megacredits,
      directPressureApplied: pressureApplied,
      directPressureReceived: received,
      lateMomentum,
      shortSummaryTags: tags,
      styleDetail: buildStyleDetail(ctx, p.color, style),
      corporation,
    };
  }

  // 5) Twists — interesting "против ожидания".
  const twists: Array<StoryTwist> = [];
  const w = ctx.winner;
  const ru = ctx.runnerUp;
  const pushTwist = (kind: StoryTwistKind, players: ReadonlyArray<Color>, candidateId?: string) =>
    twists.push({kind, players, candidateId});
  if (ids.has('duel.award.sponsorLost')) {
    pushTwist('sponsorLostAward', [w.color], 'duel.award.sponsorLost');
  }
  if (clusters.has('economyUpset') || ids.has('duel.economyConversion')) {
    pushTwist('weakerEconomyWon', ru !== undefined ? [w.color, ru.color] : [w.color],
      clusters.get('economyUpset')?.[0]?.id ?? 'duel.economyConversion');
  }
  if (clusters.has('globalMismatch')) {
    pushTwist('lessTerraformingWon', [w.color], clusters.get('globalMismatch')?.[0]?.id);
  }
  if (ctx.timeline?.topOtherLeader !== undefined && ctx.timeline.topOtherLeader.gens >= Math.ceil(ctx.generation / 2)) {
    pushTwist('ledMostLost', [ctx.timeline.topOtherLeader.color]);
  }
  if (clusters.has('unusedMoney') || clusters.has('unused')) {
    const c = clusters.get('unusedMoney')?.[0] ?? clusters.get('unused')?.[0];
    pushTwist('moneyNoConversion', c?.relatedPlayers ?? (ru !== undefined ? [ru.color] : []), c?.id);
  }
  // The single best card belonged to a non-winner.
  const bestLoserCard = candidates.find((c) => c.id === 'cards.best-loser');
  if (bestLoserCard !== undefined) {
    pushTwist('bestCardLost', bestLoserCard.relatedPlayers ?? [], bestLoserCard.id);
  }

  // 6) Key moments — the top signature candidates (deduped by cluster), strongest first.
  const sortedSig = candidates
    .filter((c) => signatureClusters.has(clusterKey(c)))
    .sort((a, b) => scoreOf(b) - scoreOf(a) || a.id.localeCompare(b.id));
  const keyMoments: Array<StoryMoment> = [];
  const seenMomentClusters = new Set<string>();
  for (const c of sortedSig) {
    const cl = clusterKey(c);
    if (seenMomentClusters.has(cl)) {
      continue;
    }
    seenMomentClusters.add(cl);
    keyMoments.push({cluster: cl, candidateId: c.id, label: c.badge, color: c.color});
    if (keyMoments.length >= 3) {
      break;
    }
  }

  // 7) Main conflict (duel only) — the two players + their styles.
  let mainConflict: GameStoryDNA['mainConflict'];
  if (ctx.mode === 'duel' && ru !== undefined) {
    const leftStyle = opts.styleOf?.(w.color) ?? fallbackStyle(w.strongestCategory);
    const rightStyle = opts.styleOf?.(ru.color) ?? fallbackStyle(ru.strongestCategory);
    const differ = leftStyle !== rightStyle && leftStyle !== 'Balanced' && rightStyle !== 'Balanced';
    mainConflict = {
      leftPlayer: w.color, rightPlayer: ru.color, leftStyle, rightStyle,
      contrastScore: differ ? (ids.has('duel.styleContrast') ? 1 : 0.7) : 0.3,
    };
  }

  // 8) Scores — uniqueness from the storyType + the signature evidence strength.
  const STORY_UNIQUENESS: Record<StoryType, number> = {
    photo_finish: 0.85, late_comeback: 0.9, runaway: 0.45, duel_styles: 0.7,
    economy_upset: 0.75, terraforming_vs_cards: 0.8, award_betrayal: 0.9,
    attack_pressure: 0.8, rare_card_drama: 0.95, category_counterplay: 0.7,
    card_flow_advantage: 0.65, colony_engine: 0.65, standard_project_plan: 0.6,
    engine_not_converted: 0.75, merger_story: 0.9, corporation_identity: 0.62,
    balanced_control: 0.2,
  };
  const sigCands = candidates.filter((c) => signatureCandidateIds.includes(c.id));
  const maxOf = (k: 'rarity' | 'drama') => sigCands.reduce((m, c) => Math.max(m, c.scores?.[k] ?? 0), 0);
  const rarityScore = maxOf('rarity');
  const dramaScore = maxOf('drama');
  const confidence = sigCands.length > 0 ?
    Math.min(...sigCands.map((c) => c.scores?.confidence ?? 1)) : (chosen !== undefined ? 0.7 : 1);
  const uniquenessScore = Math.min(1, Math.max(STORY_UNIQUENESS[detector.type], (rarityScore + dramaScore) / 2));

  return {
    storyType: detector.type,
    titleKind: detector.titleKind,
    headlineKey: detector.headlineKey,
    mainConflict,
    uniquenessScore,
    dramaScore,
    rarityScore,
    confidence,
    signatureClusters: [...signatureClusters],
    signatureCandidateIds,
    recommendedHeroCluster: heroCluster,
    recommendedPrimaryFamilies: detector.primaryFamilies,
    playerArcs,
    twists,
    keyMoments,
    suppressedGenericThemes: uniquenessScore >= 0.5 ?
      GENERIC_THEME_CLUSTERS.filter((g) => g !== heroCluster) : [],
    debug: {reasons, rejectedStoryTypes: rejected},
  };
}
