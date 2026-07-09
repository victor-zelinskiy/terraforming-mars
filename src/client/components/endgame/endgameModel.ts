/*
 * Pure, framework-agnostic model builder for the premium END-OF-GAME report.
 *
 * Turns the per-player end-state (each player's `VictoryPointsBreakdown`, VP-by-
 * generation series and global-parameter contributions) into the analytic model
 * the endgame overlay renders:
 *   • `players`     — ranked standings (winner first), each with headline
 *                     category values + top scoring cards + parameter steps.
 *   • `mode`        — 'solo' | 'duel' (exactly 2 players) | 'standings' (3+).
 *   • `categories`  — VP categories with a per-player value + the leader(s), so
 *                     the overview can show "who won what" at a glance.
 *   • `parameters`  — per-global-parameter contribution (steps) + leader(s).
 *   • `insights`    — rule-based, structured "why won / how it was decided"
 *                     tokens the component renders into translated sentences.
 *
 * NO Vue / DOM / i18n here — labels are English i18n KEYS the component
 * translates, so this stays unit-testable (see endgameModel.spec.ts). Corp
 * names are resolved by the caller (needs the client card manifest) and passed
 * in via `EndgamePlayerInput.corporations`, keeping this module client-free.
 */
import {Color} from '@/common/Color';
import {GlobalParameter} from '@/common/GlobalParameter';
import type {CardName} from '@/common/cards/CardName';
import type {EndgameFact} from '@/common/events/endgameFacts';
import {CardVictoryPointsDetail, CardVictoryPointsKind, VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {
  EndgameInsightView,
  TimelineStats,
  VictoryProfile,
  buildVictoryProfile,
  computeTimelineStats,
  gameSeed,
  composeStory,
  type InsightContext,
} from '@/client/components/endgame/insightEngine';
import type {GameStoryDNA} from '@/client/components/endgame/gameStoryDna';
import {buildStrategyProfiles, type StrategyInput, type PlayerStrategyProfile} from '@/client/components/endgame/strategyArchetypes';
import {buildKeyEpisodes, coveredInsightClusters, type KeyEpisode} from '@/client/components/endgame/keyEpisodeEngine';
import {
  buildGameStory, buildHeroThesis, buildWhatDefined, buildStoryQuality,
  type StorySentence, type WhatDefinedRow, type StoryQuality,
} from '@/client/components/endgame/gameNarrative';
import {buildFinishVerdict, type FinishVerdict} from '@/client/components/endgame/finishVerdict';
import {buildCorporationImpacts, type CorporationImpact} from '@/client/components/endgame/corporationImpactEngine';

// What the builder needs from each player — a thin, pure projection of
// PublicPlayerModel (the component maps it before calling the builder).
// Iteration 11 — the final-inventory / production bridge. Leftover STOCK at game end +
// the player's PRODUCTION profile (both from PublicPlayerModel). Optional → old games /
// callers without it degrade gracefully (the analyzers that read it simply don't fire).
export type ResourceInventory = {steel: number; titanium: number; heat: number; plants: number; energy: number};
export type ProductionProfile = {megacredits: number; steel: number; titanium: number; plants: number; energy: number; heat: number};

export type EndgamePlayerInput = {
  color: Color;
  /** DISPLAY name (the MarsBot seat is already «Бот» — resolved by the adapter). */
  name: string;
  /**
   * The RAW server name (the MarsBot seat stays «MarsBot»). Needed to match the
   * server's award-funder log tokens (`detailsAwards.messageArgs[2]` is the raw
   * name) back to a player, since `name` is the localized display label.
   * Optional — defaults to `name` (correct for humans, where raw === display).
   */
  rawName?: string;
  corporations: ReadonlyArray<string>;
  megacredits: number;
  breakdown: VictoryPointsBreakdown;
  vpByGeneration: ReadonlyArray<number>;
  globalSteps: Partial<Record<GlobalParameter, number>>;
  leftover?: ResourceInventory;
  production?: ProductionProfile;
  // Rework §4–§20 — strategy-archetype raw inputs (tags / colonies / card-VP-by-source /
  // accumulated card resources), computed client-side (needs the card manifest).
  strategyInput?: StrategyInput;
};

export type EndgameModelOptions = {
  hasMoon: boolean;
  hasPathfinders: boolean;
  hasVenus: boolean;
  generation: number;
  // game.isSoloModeWin — only meaningful for a solo game.
  soloWin?: boolean;
  /**
   * MarsBot won ON THE CLOCK (the game entered its final generation before
   * the human ended it — `automa.instantWin`). Per the Automa rules this
   * OVERRIDES the score comparison: the given color is THE winner regardless
   * of VP totals, and the tie-break never applies.
   */
  automaClockWinner?: Color;
  // Iteration 5: the analysis-ready facts (`buildEndgameFacts`) + per-player card
  // names, fetched/derived upstream. Optional → the engine falls back to the base
  // template analyzers when absent (old games / before the fetch resolves).
  facts?: ReadonlyArray<EndgameFact>;
  playerCards?: Partial<Record<Color, ReadonlyArray<CardName>>>;
  /** Resource count on each player's cards (card name → units) — for Vermin 2.0. */
  cardResources?: Partial<Record<Color, Partial<Record<CardName, number>>>>;
};

// The major VP families compared across players ("who won what").
export type EndgameCategoryKey = 'tr' | 'cards' | 'board' | 'mca' | 'moon' | 'tracks';

export type EndgameCategory = {
  key: EndgameCategoryKey;
  label: string; // i18n KEY
  accent: string; // victory_points.less accent family — reused for colour
  values: Record<string, number>; // color -> value
  max: number;
  leaders: Array<Color>; // who holds the max (>0); empty if all zero
};

export type EndgameParameter = {
  key: GlobalParameter;
  label: string; // i18n KEY
  accent: string;
  values: Record<string, number>; // color -> steps contributed
  max: number;
  leaders: Array<Color>;
};

export type EndgameTopCard = {
  cardName: string;
  victoryPoint: number;
  kind: CardVictoryPointsKind;
};

export type EndgamePlayerScore = {
  color: Color;
  name: string;
  /** The RAW server name (matches award-funder log tokens); defaults to `name`. */
  rawName?: string;
  corporations: ReadonlyArray<string>;
  place: number; // 1-based, ties share the lower place number
  isWinner: boolean;
  total: number;
  megacredits: number;
  breakdown: VictoryPointsBreakdown;
  vpByGeneration: ReadonlyArray<number>;
  categories: Record<EndgameCategoryKey, number>;
  // The player's biggest VP cards (positives desc), penalties excluded — used
  // for "key cards" callouts.
  topCards: Array<EndgameTopCard>;
  penaltyCards: Array<EndgameTopCard>;
  globalSteps: Partial<Record<GlobalParameter, number>>;
  parametersTotal: number;
  // The single category this player scored the most in (their identity).
  strongestCategory: EndgameCategoryKey | undefined;
  // Iteration 11 — leftover stock + production profile (optional → absent on old games).
  leftover?: ResourceInventory;
  production?: ProductionProfile;
  // Rework §4–§20 — the strategy-archetype raw inputs (threaded from the client) + the
  // detected profile (computed in buildEndgameModel, read by the UI player-profile section).
  strategyInput?: StrategyInput;
  strategyProfile?: PlayerStrategyProfile;
};

export type EndgameMode = 'solo' | 'duel' | 'standings';

// The single most valuable card on the table — a headline "match fact".
export type EndgameBestCard = {color: Color; owner: string; cardName: string; victoryPoint: number};

export type EndgameModel = {
  mode: EndgameMode;
  players: Array<EndgamePlayerScore>; // ranked, winner first
  winner: EndgamePlayerScore | undefined;
  runnerUp: EndgamePlayerScore | undefined;
  margin: number; // winner.total - runnerUp.total (0 for solo)
  categories: Array<EndgameCategory>; // only categories with any non-zero value
  parameters: Array<EndgameParameter>;
  // Selected analytical story lines from the insight engine (3–6, deduped).
  insights: Array<EndgameInsightView>;
  // Iteration 15 — the directed story layer: classified, impact-graded, ordered episodes
  // (§3–§5); the 30-second narrative (§8); and the impact-correct hero thesis (§16).
  keyEpisodes: ReadonlyArray<KeyEpisode>;
  story: ReadonlyArray<StorySentence>;
  heroThesis: StorySentence | undefined;
  // Iteration 17 — the finish VERDICT for the hero banner (tier + glyph + rich-text line).
  finishVerdict: FinishVerdict | undefined;
  // Iteration 16 — the editorial "what defined this game" synopsis (§8/§13) + the deduped
  // residual analysis (§8/§21: every insight whose cluster is NOT already an episode).
  whatDefined: ReadonlyArray<WhatDefinedRow>;
  // §14 — a self-check of how well the story tells THIS game (surfaced in ?egDebug).
  storyQuality: StoryQuality | undefined;
  additionalInsights: ReadonlyArray<EndgameInsightView>;
  // Iteration 9: the Game Story DNA — the meta-classification (storyType, main
  // conflict, twists, player arcs) that drives the "why this game was special"
  // headline + the composer. undefined for solo / when no winner.
  storyDna: GameStoryDNA | undefined;
  // Iteration 17 — the per-player corporation impact (also embedded in the player arcs);
  // carried here for the ?egDebug coverage panel. Empty for solo / no winner.
  corporationImpacts: ReadonlyArray<CorporationImpact>;
  // Timeline shape (lead changes, comeback depth, final surge…) — also feeds
  // the chart annotations and the overview "match facts".
  timeline: TimelineStats | undefined;
  // The winner's victory archetype (hero chip + analytics).
  profile: VictoryProfile | undefined;
  bestCard: EndgameBestCard | undefined;
  generation: number;
  soloWin: boolean;
  // Generation (1-based) the eventual winner took the lead and never lost it.
  // undefined when they led from generation 1 (wire-to-wire) or it's solo.
  winnerTookLeadGen: number | undefined;
  /** MarsBot won on the clock — the winner override, not a score comparison. */
  automaClockWin: boolean;
};

const CATEGORY_LABEL: Record<EndgameCategoryKey, string> = {
  tr: 'Terraform rating',
  cards: 'Cards',
  board: 'Cities & greenery',
  mca: 'Milestones & awards',
  moon: 'Moon',
  tracks: 'Planetary tracks',
};
const CATEGORY_ACCENT: Record<EndgameCategoryKey, string> = {
  tr: 'tr-cards',
  cards: 'cards-resource',
  board: 'greenery',
  mca: 'milestones',
  moon: 'moon',
  tracks: 'tracks',
};

const PARAMETER_META: ReadonlyArray<{key: GlobalParameter; label: string; accent: string}> = [
  {key: GlobalParameter.TEMPERATURE, label: 'Temperature', accent: 'temperature'},
  {key: GlobalParameter.OXYGEN, label: 'Oxygen', accent: 'oxygen'},
  {key: GlobalParameter.OCEANS, label: 'Oceans', accent: 'oceans'},
  {key: GlobalParameter.VENUS, label: 'Venus', accent: 'venus'},
  {key: GlobalParameter.MOON_HABITAT_RATE, label: 'L. Habitat', accent: 'moon'},
  {key: GlobalParameter.MOON_MINING_RATE, label: 'L. Mining', accent: 'moon-mine'},
  {key: GlobalParameter.MOON_LOGISTIC_RATE, label: 'L. Logistic', accent: 'moon-road'},
];

function categoryValue(b: VictoryPointsBreakdown, key: EndgameCategoryKey): number {
  switch (key) {
  case 'tr': return b.terraformRating;
  case 'cards': return b.victoryPoints;
  case 'board': return b.city + b.greenery;
  case 'mca': return b.milestones + b.awards;
  case 'moon': return b.moonHabitats + b.moonMines + b.moonRoads;
  case 'tracks': return b.planetaryTracks;
  }
}

function leadersOf(values: Record<string, number>): {max: number; leaders: Array<Color>} {
  let max = 0;
  for (const v of Object.values(values)) {
    if (v > max) {
      max = v;
    }
  }
  const leaders: Array<Color> = [];
  if (max > 0) {
    for (const [color, v] of Object.entries(values)) {
      if (v === max) {
        leaders.push(color as Color);
      }
    }
  }
  return {max, leaders};
}

// Tiebreak mirrors the legacy game-end: higher total wins, then higher M€.
function compareScores(a: EndgamePlayerInput, b: EndgamePlayerInput): number {
  const at = a.breakdown.total;
  const bt = b.breakdown.total;
  if (at !== bt) {
    return bt - at;
  }
  return b.megacredits - a.megacredits;
}

function topCardsOf(details: ReadonlyArray<CardVictoryPointsDetail>): {top: Array<EndgameTopCard>; penalties: Array<EndgameTopCard>} {
  const top: Array<EndgameTopCard> = [];
  const penalties: Array<EndgameTopCard> = [];
  for (const d of details) {
    const card: EndgameTopCard = {cardName: d.cardName, victoryPoint: d.victoryPoint, kind: d.kind};
    if (d.victoryPoint < 0 || d.kind === 'penalty') {
      penalties.push(card);
    } else if (d.victoryPoint > 0) {
      top.push(card);
    }
  }
  top.sort((x, y) => y.victoryPoint - x.victoryPoint);
  penalties.sort((x, y) => x.victoryPoint - y.victoryPoint);
  return {top, penalties};
}

function strongestCategoryOf(categories: Record<EndgameCategoryKey, number>, present: ReadonlyArray<EndgameCategoryKey>): EndgameCategoryKey | undefined {
  let best: EndgameCategoryKey | undefined;
  let bestVal = 0;
  for (const key of present) {
    const v = categories[key];
    if (v > bestVal) {
      bestVal = v;
      best = key;
    }
  }
  return best;
}

// The generation (1-based) the eventual winner first held a strict, never-lost
// lead. Reads each player's cumulative VP-by-generation series. Returns
// undefined when the winner led from generation 1 (wire-to-wire).
function computeWinnerTookLeadGen(winner: EndgamePlayerInput, others: ReadonlyArray<EndgamePlayerInput>, generation: number): number | undefined {
  const len = Math.min(
    winner.vpByGeneration.length,
    ...others.map((o) => o.vpByGeneration.length),
    generation,
  );
  if (len <= 0 || others.length === 0) {
    return undefined;
  }
  // Find the LAST generation where the winner was NOT strictly ahead of all
  // others; they took the final lead the generation after that.
  let lastNotAhead = -1;
  for (let g = 0; g < len; g++) {
    const w = winner.vpByGeneration[g];
    let ahead = true;
    for (const o of others) {
      if (o.vpByGeneration[g] >= w) {
        ahead = false;
        break;
      }
    }
    if (!ahead) {
      lastNotAhead = g;
    }
  }
  if (lastNotAhead < 0) {
    return undefined; // strictly ahead the whole game
  }
  if (lastNotAhead + 1 >= len) {
    return undefined; // never pulled clearly ahead — don't claim a moment
  }
  return lastNotAhead + 2; // +1 for next gen, +1 for 1-based generation
}

// The single most valuable positive card on the table (for the facts strip).
function findBestCard(players: ReadonlyArray<EndgamePlayerScore>): EndgameBestCard | undefined {
  let best: EndgameBestCard | undefined;
  for (const p of players) {
    for (const c of p.topCards) {
      if (best === undefined || c.victoryPoint > best.victoryPoint) {
        best = {color: p.color, owner: p.name, cardName: c.cardName, victoryPoint: c.victoryPoint};
      }
    }
  }
  return best;
}

export function buildEndgameModel(inputs: ReadonlyArray<EndgamePlayerInput>, opts: EndgameModelOptions): EndgameModel {
  const ranked = [...inputs].sort(compareScores);
  // MarsBot clock win: the bot leads the standings regardless of totals —
  // reaching the final generation IS the victory condition (Automa rules).
  if (opts.automaClockWinner !== undefined) {
    ranked.sort((a, b) => {
      if (a.color === opts.automaClockWinner) {
        return -1;
      }
      if (b.color === opts.automaClockWinner) {
        return 1;
      }
      return compareScores(a, b);
    });
  }
  const mode: EndgameMode = ranked.length <= 1 ? 'solo' : (ranked.length === 2 ? 'duel' : 'standings');

  // Which VP categories are present at all (any player scored non-zero, gated
  // by the active expansions) — drives the "who won what" set + score bars.
  const presentCategories: Array<EndgameCategoryKey> = [];
  const allCategoryKeys: Array<EndgameCategoryKey> = ['tr', 'cards', 'board', 'mca'];
  if (opts.hasMoon) {
    allCategoryKeys.push('moon');
  }
  if (opts.hasPathfinders) {
    allCategoryKeys.push('tracks');
  }
  for (const key of allCategoryKeys) {
    const anyNonZero = ranked.some((p) => categoryValue(p.breakdown, key) !== 0);
    if (anyNonZero || key === 'tr' || key === 'cards' || key === 'board' || key === 'mca') {
      presentCategories.push(key);
    }
  }

  const topVal = ranked.length > 0 ? ranked[0].breakdown.total : 0;
  const topMc = ranked.length > 0 ? ranked[0].megacredits : 0;

  const players: Array<EndgamePlayerScore> = ranked.map((p, i) => {
    const isWinner = opts.automaClockWinner !== undefined ?
      p.color === opts.automaClockWinner :
      (mode === 'solo' ? (opts.soloWin === true) : (p.breakdown.total === topVal && p.megacredits === topMc));
    const categories = {} as Record<EndgameCategoryKey, number>;
    for (const key of allCategoryKeys) {
      categories[key] = categoryValue(p.breakdown, key);
    }
    const {top, penalties} = topCardsOf(p.breakdown.detailsCards);
    let parametersTotal = 0;
    for (const v of Object.values(p.globalSteps)) {
      parametersTotal += v ?? 0;
    }
    return {
      color: p.color,
      name: p.name,
      ...(p.rawName !== undefined ? {rawName: p.rawName} : {}),
      corporations: p.corporations,
      place: i + 1,
      isWinner,
      total: p.breakdown.total,
      megacredits: p.megacredits,
      breakdown: p.breakdown,
      vpByGeneration: p.vpByGeneration,
      categories,
      topCards: top,
      penaltyCards: penalties,
      globalSteps: p.globalSteps,
      parametersTotal,
      strongestCategory: strongestCategoryOf(categories, presentCategories),
      leftover: p.leftover,
      production: p.production,
      strategyInput: p.strategyInput,
    };
  });

  // Collapse tied places to the lower place number (1,1,3 …).
  for (let i = 1; i < players.length; i++) {
    const prev = players[i - 1];
    const cur = players[i];
    if (cur.total === prev.total && cur.megacredits === prev.megacredits) {
      cur.place = prev.place;
    }
  }

  const categories: Array<EndgameCategory> = presentCategories.map((key) => {
    const values: Record<string, number> = {};
    for (const p of ranked) {
      values[p.color] = categoryValue(p.breakdown, key);
    }
    const {max, leaders} = leadersOf(values);
    return {key, label: CATEGORY_LABEL[key], accent: CATEGORY_ACCENT[key], values, max, leaders};
  });

  const parameters: Array<EndgameParameter> = PARAMETER_META
    .filter((meta) => {
      if (meta.key === GlobalParameter.VENUS) {
        return opts.hasVenus;
      }
      if (meta.key === GlobalParameter.MOON_HABITAT_RATE || meta.key === GlobalParameter.MOON_MINING_RATE || meta.key === GlobalParameter.MOON_LOGISTIC_RATE) {
        return opts.hasMoon;
      }
      return true;
    })
    .map((meta) => {
      const values: Record<string, number> = {};
      for (const p of ranked) {
        values[p.color] = p.globalSteps[meta.key] ?? 0;
      }
      const {max, leaders} = leadersOf(values);
      return {key: meta.key, label: meta.label, accent: meta.accent, values, max, leaders};
    })
    // Drop a parameter nobody touched (keeps the contribution view tight).
    .filter((param) => param.max > 0);

  const winner = players.find((p) => p.isWinner) ?? players[0];
  const runnerUp = players.find((p) => !p.isWinner && p.place > (winner?.place ?? 0));
  const margin = winner !== undefined && runnerUp !== undefined ? winner.total - runnerUp.total : 0;

  let winnerTookLeadGen: number | undefined;
  if (mode !== 'solo' && winner !== undefined) {
    const winnerInput = ranked.find((p) => p.color === winner.color);
    const others = ranked.filter((p) => p.color !== winner.color);
    if (winnerInput !== undefined) {
      winnerTookLeadGen = computeWinnerTookLeadGen(winnerInput, others, opts.generation);
    }
  }

  // ── The analytical layer: timeline shape, victory profile, insights. ──
  const timeline = winner !== undefined ?
    computeTimelineStats(players, winner, opts.generation, winnerTookLeadGen) : undefined;
  const profile = winner !== undefined ? buildVictoryProfile(winner) : undefined;
  const bestCard = findBestCard(players);
  let composed: {dna: GameStoryDNA | undefined; insights: Array<EndgameInsightView>} = {dna: undefined, insights: []};
  let keyEpisodes: ReadonlyArray<KeyEpisode> = [];
  let story: ReadonlyArray<StorySentence> = [];
  let heroThesis: StorySentence | undefined;
  let finishVerdict: FinishVerdict | undefined;
  let whatDefined: ReadonlyArray<WhatDefinedRow> = [];
  let storyQuality: StoryQuality | undefined;
  let additionalInsights: ReadonlyArray<EndgameInsightView> = [];
  let corporationImpacts: ReadonlyArray<CorporationImpact> = [];
  if (winner !== undefined) {
    const ctx: InsightContext = {
      mode,
      generation: opts.generation,
      players,
      winner,
      runnerUp,
      margin,
      categories,
      parameters,
      timeline,
      profile,
      seed: gameSeed(players, opts.generation),
      facts: opts.facts,
      playerCards: opts.playerCards,
      cardResources: opts.cardResources,
    };
    // Detect each player's strategy archetype profile and attach it to the player object
    // (same reference the analyzers read via ctx.players) BEFORE composing the story.
    const profiles = buildStrategyProfiles(ctx);
    for (const p of players) {
      p.strategyProfile = profiles[p.color];
    }
    // Iteration 17 — the per-corporation impact (reads the corp fact + the now-attached
    // strategy profiles + scoring categories). Computed ONCE here so the analyzers, the
    // player arcs (gameStoryDna) and the corp episode (keyEpisodeEngine) all read one truth.
    ctx.corporationImpacts = buildCorporationImpacts(ctx);
    corporationImpacts = ctx.corporationImpacts;
    composed = composeStory(ctx);
    // Iteration 15 — the directed story layer (episodes → narrative → hero thesis).
    keyEpisodes = buildKeyEpisodes(ctx);
    story = buildGameStory(ctx, keyEpisodes);
    heroThesis = buildHeroThesis(ctx, keyEpisodes);
    finishVerdict = buildFinishVerdict(ctx);
    whatDefined = buildWhatDefined(ctx, keyEpisodes);
    storyQuality = buildStoryQuality(ctx, keyEpisodes, story, heroThesis);
    // Iteration 16 §8/§21 — the residual analysis: every insight whose semantic cluster is
    // NOT already told as an episode, deduped to one per cluster, capped.
    const covered = coveredInsightClusters(keyEpisodes);
    const seenCluster = new Set<string>();
    additionalInsights = composed.insights.filter((i) => {
      const cl = i.storyCluster ?? i.family ?? i.group;
      if (covered.has(cl) || seenCluster.has(cl)) {
        return false;
      }
      seenCluster.add(cl);
      return true;
    }).slice(0, 8);
  }

  return {
    mode,
    players,
    winner,
    runnerUp,
    margin,
    categories,
    parameters,
    insights: composed.insights,
    storyDna: composed.dna,
    corporationImpacts,
    keyEpisodes,
    story,
    heroThesis,
    finishVerdict,
    whatDefined,
    storyQuality,
    additionalInsights,
    timeline,
    profile,
    bestCard,
    generation: opts.generation,
    soloWin: opts.soloWin === true,
    winnerTookLeadGen,
    automaClockWin: opts.automaClockWinner !== undefined,
  };
}

// Shared label/accent lookups so components and tests don't re-declare them.
export const ENDGAME_CATEGORY_LABEL = CATEGORY_LABEL;
export const ENDGAME_CATEGORY_ACCENT = CATEGORY_ACCENT;
