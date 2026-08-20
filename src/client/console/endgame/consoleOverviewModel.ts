/*
 * CONSOLE ENDGAME OVERVIEW — the pure view-model of «Обзор партии»
 * (the console-native post-game analytics scene inside the endgame workspace).
 *
 * A RE-PROJECTION of the layers every endgame surface already shares —
 * `EndgameModel` (ranked standings, key episodes, story, insights, finish
 * verdict) and `ConsoleEndgameVm` (the ceremony's category numbers) — never a
 * second source of truth. What this layer adds is the CONSOLE information
 * architecture:
 *
 *  · a PRIORITISED, DEDUPED headline layer («что решило партию») — the digest
 *    shows 3–4 strong facts, one per story angle, never five restatements of
 *    «победитель набрал больше всех»;
 *  · per-tab presentation models (score / timeline / cards / parameters /
 *    players), each pre-shaped for a TV viewport: shared scales, capped and
 *    ordered sets, expansion-gated sections, explicit empty states;
 *  · the factual/estimated split is preserved — every sentence and number
 *    comes from the engines, nothing is re-derived or invented here.
 *
 * NO Vue / DOM / i18n — labels are English i18n KEYS; sentence templates ride
 * with their typed `InsightParam`s and are rendered by the console rich-text
 * renderer. Spec: tests/client/components/console/consoleOverviewModel.spec.ts
 */
import {Color} from '@/common/Color';
import {GlobalParameter} from '@/common/GlobalParameter';
import {Tag} from '@/common/cards/Tag';
import type {MADetail, CardVictoryPointsKind} from '@/common/game/VictoryPointsBreakdown';
import type {ViewModel} from '@/common/models/PlayerModel';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import type {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import type {InsightParam, EvidenceChip} from '@/client/components/endgame/insightEngine';
import type {KeyEpisode, EpisodeRole, EpisodePhase} from '@/client/components/endgame/keyEpisodeEngine';
import type {ConsoleEndgameVm, ConsoleEndgameCategoryKey} from '@/client/console/endgame/consoleEndgameModel';
import type {RevealTieBreak} from '@/client/components/endgame/finalScoringRevealModel';

// ── Tabs ────────────────────────────────────────────────────────────────────

/** Console tab ring, in post-game exploration order. LB/RB walk it. */
export type OverviewTabKey = 'digest' | 'score' | 'timeline' | 'cards' | 'parameters' | 'players';

export const OVERVIEW_TAB_ORDER: ReadonlyArray<OverviewTabKey> =
  ['digest', 'score', 'timeline', 'cards', 'parameters', 'players'];

/** Tab labels — one short word each (console rail voice). i18n KEYS.
 *  ⚠ 'Chronology' is deliberately NOT the desktop 'Timeline' key — that one
 *  is already translated «Графики» for the desktop tab, and this fork never
 *  rewrites a translation it didn't introduce. */
export const OVERVIEW_TAB_LABEL: Readonly<Record<OverviewTabKey, string>> = {
  digest: 'Overview',
  score: 'Score',
  timeline: 'Chronology',
  cards: 'Cards',
  parameters: 'Parameters',
  players: 'Players',
};

// ── Shared shapes ───────────────────────────────────────────────────────────

/** A renderable sentence: an English template KEY + its typed params. */
export type OvSentence = {key: string; params: ReadonlyArray<InsightParam>};

/** One drawable chart series (pure — the chart .vue must not export types:
 *  a type import from a .vue file breaks the mochapack test bundle). */
export type OvChartSeries = {
  key: string;
  hex: string;
  data: ReadonlyArray<number>;
  /** The focused series — full ink + endpoint marker. */
  emphasis?: boolean;
  /** Context series — same hue, quiet opacity (identity keeps its colour). */
  dim?: boolean;
};

/** One Players-tab metric group of ONE participant — the panes render what a
 *  participant honestly HAS (a bot never wears human economy groups), and
 *  `comparable` gates «A Подробнее» (a cross-player grid needs ≥2 sides). */
export type PlayerMetricGroup = {key: string; label: string; comparable: boolean};

export type OvRankRow = {
  color: Color;
  name: string;
  /** Corporation name (the bot's own corp when the save carries one). '' when unknown. */
  corporation: string;
  /** The bot's difficulty LABEL (i18n key) — SECONDARY beside the corporation
   *  when the bot has one; the whole identity line on corpless saves. */
  difficulty?: string;
  place: number;
  total: number;
  /** VP behind the winner (0 for the winner). */
  gapToWinner: number;
  megacredits: number;
  isBot: boolean;
  isWinner: boolean;
};

// ── Digest (the landing tab) ────────────────────────────────────────────────

export type OvVerdict = {
  titleKey: string;
  glyph: string;
  line: OvSentence | undefined;
  chips: ReadonlyArray<EvidenceChip>;
};

export type OvFactCard = {
  id: string;
  role: EpisodeRole;
  badge: string; // i18n KEY
  sentence: OvSentence;
  color: Color | undefined;
  chips: ReadonlyArray<EvidenceChip>;
  generation: number | undefined;
  phase: EpisodePhase;
};

export type OvObservation = {
  id: string;
  badge: string; // i18n KEY
  sentence: OvSentence;
  color: Color | undefined;
};

export type OvDigest = {
  verdict: OvVerdict | undefined;
  /** Story paragraph 1 — the composed editorial conclusion (≤ 3 sentences). */
  lead: ReadonlyArray<OvSentence>;
  /** 2–4 strong, deduped fact cards — one per story angle. */
  headline: ReadonlyArray<OvFactCard>;
  /** Up to 4 quiet secondary observations (the deduped residual layer). */
  observations: ReadonlyArray<OvObservation>;
  ranking: ReadonlyArray<OvRankRow>;
};

// ── Score tab ───────────────────────────────────────────────────────────────

export type OvScoreSub = {key: string; label: string; values: Record<string, number>};

export type OvScoreCategory = {
  key: ConsoleEndgameCategoryKey;
  label: string; // i18n KEY
  accent: ConsoleEndgameCategoryKey;
  penalty: boolean;
  values: Record<string, number>;
  /** Who holds the (positive) category max — empty when all zero. */
  leaders: ReadonlyArray<Color>;
  /** The two-level breakdown (TR sources / card families) — [] for one-beat. */
  subs: ReadonlyArray<OvScoreSub>;
};

export type OvDecisiveCategory = {
  key: ConsoleEndgameCategoryKey;
  label: string;
  accent: ConsoleEndgameCategoryKey;
  /** Winner's edge over the runner-up in this category (VP, > 0). */
  delta: number;
};

export type OvScore = {
  ranking: ReadonlyArray<OvRankRow>;
  categories: ReadonlyArray<OvScoreCategory>;
  /** Shared bar denominator across every category × player (≥ 1). */
  maxCategoryValue: number;
  /** The category where the winner out-scored the runner-up the most. */
  decisive: OvDecisiveCategory | undefined;
  tieBreak: RevealTieBreak | undefined;
};

// ── Timeline tab ────────────────────────────────────────────────────────────

export type OvSeries = {
  color: Color;
  name: string;
  isBot: boolean;
  data: ReadonlyArray<number>;
  final: number;
};

export type OvEpisode = {
  id: string;
  role: EpisodeRole;
  badge: string;
  sentence: OvSentence;
  color: Color | undefined;
  generation: number | undefined;
  phase: EpisodePhase;
  /** Visually loud on the strip (a decisive/turning beat). */
  major: boolean;
  chips: ReadonlyArray<EvidenceChip>;
};

export type OvTimeline = {
  /** Comparable generation columns (≥ 2 for a drawable chart). */
  gens: number;
  series: ReadonlyArray<OvSeries>;
  episodes: ReadonlyArray<OvEpisode>;
  maxVp: number;
  stats: {
    generations: number;
    leadChanges: number | undefined;
    tookLeadGen: number | undefined;
    wireToWire: boolean;
    finalSurge: {color: Color; name: string; gain: number} | undefined;
  };
};

// ── Cards tab ───────────────────────────────────────────────────────────────

/**
 * The MECHANIC behind a MarsBot card-scoring source — the honest detail the
 * tab shows instead of pretending an aggregated source is a physical card.
 * Every number is the SERVER's own (AutomaVictoryPoints); nothing re-derived.
 */
export type OvBotCardSource =
  /** Remaining M€ exchanged for VP by the final-generation rate. */
  | {kind: 'mc'; stock: number; rate: number}
  /** Neural Instance: +1 VP per adjacent space free of the human. */
  | {kind: 'neural'; count: number}
  /** Hard/Brutal: +1 VP per played card with a non-negative VP icon. */
  | {kind: 'icons'; count: number; difficulty: string /* label key */}
  /** The bot's own CORPORATION scored at the end (C25 Viron). */
  | {kind: 'corp'; count: number; corporation: string};

export type OvCardRow = {
  id: string;
  owner: Color;
  ownerName: string;
  /** A CardName for a physical card; an i18n KEY for a bot/effect source. */
  cardName: string;
  vp: number;
  kind: CardVictoryPointsKind;
  /** Present ⇔ this row is an aggregated MarsBot source, not a physical card. */
  bot?: OvBotCardSource;
};

export type OvCardsPlayerSummary = {
  color: Color;
  name: string;
  isBot: boolean;
  /** The CANONICAL «Карты» category value — the same number the ceremony and
   *  the Score tab show (positives + the bot's normalised parts). */
  cardsVp: number;
  count: number;
  kinds: Record<CardVictoryPointsKind, number>;
};

export type OvCards = {
  /** Positives by impact desc, then penalties (most negative first). */
  rows: ReadonlyArray<OvCardRow>;
  byPlayer: ReadonlyArray<OvCardsPlayerSummary>;
};

// ── Parameters tab ──────────────────────────────────────────────────────────

export type OvParameter = {
  key: GlobalParameter;
  label: string; // i18n KEY
  accent: string; // console parameter colour family
  unit: '' | '%' | '°C';
  min: number;
  max: number;
  /** Raw value per generation column (empty when the game predates the feed). */
  series: ReadonlyArray<number>;
  /** 0..100 completion per generation column (same columns as `series`). */
  pct: ReadonlyArray<number>;
  finalValue: number;
  finalPct: number;
  completed: boolean;
  contributions: {values: Record<string, number>; leaders: ReadonlyArray<Color>; max: number} | undefined;
};

export type OvParams = {
  parameters: ReadonlyArray<OvParameter>;
  /** Generation columns in the series (0 → no progression data, empty state). */
  gens: number;
};

// ── Players tab ─────────────────────────────────────────────────────────────

export type OvMetric = {key: string; label: string; value: number};

export type OvPlayerCard = {
  color: Color;
  name: string;
  /** Corporation name (the bot's own corp when the save carries one). */
  corporation: string;
  /** The bot's difficulty LABEL (i18n key) — part of its identity line
   *  (secondary beside the corporation when the bot has one). */
  difficulty?: string;
  place: number;
  total: number;
  isBot: boolean;
  isWinner: boolean;
  /** Human economy groups — EMPTY for the bot (its rules keep no production
   *  or resource stock; faking zeros would be a lie in bar form). */
  production: ReadonlyArray<OvMetric>;
  stock: ReadonlyArray<OvMetric>;
  stats: ReadonlyArray<OvMetric>;
  /** Top played tags (count > 0), capped. Empty for the bot (its «tags» are
   *  board tracks — see `botTracks`). */
  tags: ReadonlyArray<{tag: Tag; count: number}>;
  /** Raw milestone/award rows — the component translates the messages. */
  milestones: ReadonlyArray<MADetail>;
  awards: ReadonlyArray<MADetail>;
  /** Per-category VP (the ceremony's own numbers). */
  categories: ReadonlyArray<{key: ConsoleEndgameCategoryKey; label: string; accent: ConsoleEndgameCategoryKey; value: number}>;
  /** BOT ONLY — the honest replacement for the human economy groups. */
  botEconomy?: {
    /** M€ left at scoring, the conversion rate and the VP it produced. */
    stock: number; rate: number; vp: number;
    /** Played project cards in the bot's pile. */
    playedCount: number;
  };
  /** BOT ONLY — the six board tracks (the bot's «tags»): tag + position/max. */
  botTracks?: ReadonlyArray<{tag: Tag; position: number; max: number}>;
  /** THIS participant's metric groups, in display order (↑/↓ walks them). */
  groups: ReadonlyArray<PlayerMetricGroup>;
};

export type OvPlayers = {
  players: ReadonlyArray<OvPlayerCard>;
  /** Cross-player maxima per metric key — the comparison scales. */
  maxima: Record<string, number>;
  /**
   * How many participants a metric key actually APPLIES to. A bar encodes a
   * comparison — with fewer than two comparable participants the tab renders
   * a plain value cell instead (a full-width bar against nobody is a lie).
   */
  comparable: Record<string, number>;
  /** RAW server name → display name (award funder chips: «MarsBot» → «Бот»). */
  displayNames: Record<string, string>;
};

// ── The VM ──────────────────────────────────────────────────────────────────

export type ConsoleOverviewVm = {
  generation: number;
  winner: {color: Color; name: string; total: number} | undefined;
  sharedWin: boolean;
  digest: OvDigest;
  score: OvScore;
  timeline: OvTimeline;
  cards: OvCards;
  parameters: OvParams;
  players: OvPlayers;
};

/** What the builder needs from the live view — a thin pure projection
 *  (the component maps it via `consoleOverviewExtrasFromView`). */
export type ConsoleOverviewExtras = {
  expansions: {venus: boolean; moon: boolean; colonies: boolean};
  globalsPerGeneration: ReadonlyArray<Partial<Record<GlobalParameter, number>>>;
  playersRaw: ReadonlyArray<{
    color: Color;
    tags: Partial<Record<Tag, number>>;
    actionsTakenThisGame: number;
    citiesCount: number;
    coloniesCount: number;
    terraformRating: number;
  }>;
  /** The MarsBot table state (absent in human-only games): the tracks are the
   *  bot's «tags», the played pile size its card footprint. */
  automa?: {
    tracks: ReadonlyArray<{tag: Tag; position: number; max: number}>;
    playedCount: number;
  };
};

/** The client-side adapter (kept beside the builder; reads only pure fields). */
export function consoleOverviewExtrasFromView(view: ViewModel): ConsoleOverviewExtras {
  const automa = view.game.automa;
  return {
    expansions: {
      venus: view.game.gameOptions.expansions.venus === true,
      moon: view.game.gameOptions.expansions.moon === true,
      colonies: view.game.gameOptions.expansions.colonies === true,
    },
    globalsPerGeneration: view.game.globalsPerGeneration ?? [],
    playersRaw: view.players.map((p) => ({
      color: p.color,
      tags: p.tags ?? {},
      actionsTakenThisGame: p.actionsTakenThisGame,
      citiesCount: p.citiesCount,
      coloniesCount: p.coloniesCount,
      terraformRating: p.terraformRating,
    })),
    ...(automa !== undefined ? {
      automa: {
        tracks: automa.tracks.map((t) => ({tag: t.tags[0], position: t.position, max: t.maxPosition})),
        playedCount: automa.playedPile.length,
      },
    } : {}),
  };
}

// ── Headline selection (the dedup heart) ────────────────────────────────────

/** Story-angle priority: cause → swing → the unusual → the near thing → colour. */
const ROLE_PRIORITY: Readonly<Record<EpisodeRole, number>> = {
  decisive_driver: 0,
  turning_point: 1,
  ironic_twist: 2,
  near_miss: 3,
  signature_moment: 4,
  tempo_shift: 5,
  engine_online: 6,
  late_scoring: 7,
  missed_conversion: 8,
  structural_contrast: 9,
  flavor_only: 10,
  // The finish itself is the VERDICT banner's story — a headline card
  // restating it is exactly the duplication this layer exists to remove.
  final_scoring: 99,
};

export const HEADLINE_MAX = 4;
const OBSERVATIONS_MAX = 4;
const LEAD_SENTENCES_MAX = 3;
const TAGS_MAX = 6;

function episodeCard(ep: KeyEpisode): OvFactCard {
  return {
    id: ep.id,
    role: ep.role,
    badge: ep.badge,
    sentence: {key: ep.textKey, params: ep.params},
    color: ep.color,
    chips: ep.evidenceChips,
    generation: ep.generation,
    phase: ep.phase,
  };
}

/**
 * Pick ≤ HEADLINE_MAX strong cards, one thought each:
 *  · roles ranked by how much they explain (decisive → turning → unusual…);
 *  · `dedupeKey ?? id` collapses same-thought episodes;
 *  · at most TWO cards of one role (two decisive drivers can both be true);
 *  · `final_scoring` never appears (the verdict banner owns the finish).
 */
export function selectHeadline(episodes: ReadonlyArray<KeyEpisode>): Array<OvFactCard> {
  const ranked = [...episodes].sort((a, b) =>
    (ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role]) || (b.impact - a.impact));
  const seen = new Set<string>();
  const perRole: Partial<Record<EpisodeRole, number>> = {};
  const out: Array<OvFactCard> = [];
  for (const ep of ranked) {
    if (ep.role === 'final_scoring' || ep.role === 'flavor_only') {
      continue;
    }
    const key = ep.dedupeKey ?? ep.id;
    if (seen.has(key)) {
      continue;
    }
    if ((perRole[ep.role] ?? 0) >= 2) {
      continue;
    }
    seen.add(key);
    perRole[ep.role] = (perRole[ep.role] ?? 0) + 1;
    out.push(episodeCard(ep));
    if (out.length >= HEADLINE_MAX) {
      break;
    }
  }
  return out;
}

function buildDigest(model: EndgameModel, ranking: ReadonlyArray<OvRankRow>): OvDigest {
  const verdict: OvVerdict | undefined = model.finishVerdict !== undefined ? {
    titleKey: model.finishVerdict.titleKey,
    glyph: model.finishVerdict.glyph,
    line: model.finishVerdict.line !== undefined ?
      {key: model.finishVerdict.line.key, params: model.finishVerdict.line.params} : undefined,
    chips: model.finishVerdict.chips,
  } : undefined;

  const headline = selectHeadline(model.keyEpisodes);
  const usedIds = new Set(headline.map((h) => h.id));

  // The composed conclusion paragraph (para 1) — already deduped upstream.
  const lead: Array<OvSentence> = model.story
    .filter((s) => s.para === 1)
    .slice(0, LEAD_SENTENCES_MAX)
    .map((s) => ({key: s.key, params: s.params}));

  // Secondary observations: the residual insight layer (already one per
  // cluster and episode-free upstream) — quiet, capped, never a repeat of a
  // headline card's episode.
  const observations: Array<OvObservation> = model.additionalInsights
    .filter((i) => !usedIds.has(i.id))
    .slice(0, OBSERVATIONS_MAX)
    .map((i) => ({
      id: i.id,
      badge: i.badge,
      sentence: {key: i.textKey, params: i.params},
      color: i.color,
    }));

  return {verdict, lead, headline, observations, ranking};
}

// ── Score ───────────────────────────────────────────────────────────────────

function leadersOf(values: Record<string, number>): Array<Color> {
  let max = 0;
  for (const v of Object.values(values)) {
    if (v > max) {
      max = v;
    }
  }
  if (max <= 0) {
    return [];
  }
  return Object.entries(values).filter(([, v]) => v === max).map(([c]) => c as Color);
}

function buildScore(model: EndgameModel, egVm: ConsoleEndgameVm, ranking: ReadonlyArray<OvRankRow>): OvScore {
  const categories: Array<OvScoreCategory> = egVm.categories.map((cat) => ({
    key: cat.key,
    label: cat.label,
    accent: cat.accent,
    penalty: cat.penalty,
    values: cat.values,
    leaders: cat.penalty ? [] : leadersOf(cat.values),
    subs: cat.subs.map((s) => ({key: s.key, label: s.label, values: s.values})),
  }));

  let maxCategoryValue = 1;
  for (const cat of categories) {
    for (const v of Object.values(cat.values)) {
      maxCategoryValue = Math.max(maxCategoryValue, Math.abs(v));
    }
  }

  // The winner's biggest category edge over the runner-up — «где решилось».
  let decisive: OvDecisiveCategory | undefined;
  if (model.winner !== undefined && model.runnerUp !== undefined) {
    const w = model.winner.color;
    const r = model.runnerUp.color;
    for (const cat of categories) {
      const delta = (cat.values[w] ?? 0) - (cat.values[r] ?? 0);
      if (delta > 0 && (decisive === undefined || delta > decisive.delta)) {
        decisive = {key: cat.key, label: cat.label, accent: cat.accent, delta};
      }
    }
  }

  return {ranking, categories, maxCategoryValue, decisive, tieBreak: egVm.tieBreak};
}

// ── Timeline ────────────────────────────────────────────────────────────────

function buildTimeline(model: EndgameModel, egVm: ConsoleEndgameVm): OvTimeline {
  const bots = new Set(egVm.rows.filter((r) => r.isBot).map((r) => r.color));
  // The comparable window: generations EVERY player has data for.
  let gens = model.players.reduce(
    (m, p) => Math.min(m, p.vpByGeneration.length), Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(gens) || gens === Number.MAX_SAFE_INTEGER) {
    gens = 0;
  }
  gens = Math.min(gens, model.generation);

  const series: Array<OvSeries> = model.players.map((p) => {
    const data = p.vpByGeneration.slice(0, gens);
    return {
      color: p.color,
      name: p.name,
      isBot: bots.has(p.color),
      data,
      final: data.length > 0 ? data[data.length - 1] : p.total,
    };
  });

  let maxVp = 1;
  for (const s of series) {
    for (const v of s.data) {
      maxVp = Math.max(maxVp, v);
    }
  }

  const episodes: Array<OvEpisode> = model.keyEpisodes
    .filter((ep) => ep.role !== 'flavor_only')
    .map((ep) => ({
      id: ep.id,
      role: ep.role,
      badge: ep.badge,
      sentence: {key: ep.textKey, params: ep.params},
      color: ep.color,
      generation: ep.generation,
      phase: ep.phase,
      major: ep.role === 'decisive_driver' || ep.role === 'turning_point' || ep.impact >= 0.5,
      chips: ep.evidenceChips,
    }));

  const surge = model.timeline?.finalSurge;
  const surgePlayer = surge !== undefined ? model.players.find((p) => p.color === surge.color) : undefined;
  return {
    gens,
    series,
    episodes,
    maxVp,
    stats: {
      generations: model.generation,
      leadChanges: model.timeline?.leadChanges,
      tookLeadGen: model.winnerTookLeadGen,
      wireToWire: model.timeline?.wireToWire === true,
      finalSurge: surge !== undefined && surgePlayer !== undefined && surge.gain >= 8 ?
        {color: surge.color, name: surgePlayer.name, gain: surge.gain} : undefined,
    },
  };
}

// ── Cards ───────────────────────────────────────────────────────────────────

/** The bot's normalised card sources — SAME labels as the ceremony's automa
 *  sub-segments (finalScoringRevealModel), so one vocabulary tells one story. */
function botCardRows(p: EndgamePlayerScore): Array<OvCardRow> {
  const a = p.breakdown.automa;
  if (a === undefined) {
    return [];
  }
  const out: Array<OvCardRow> = [];
  if (a.mcToVp > 0) {
    out.push({
      id: `${p.color}:bot:mc`, owner: p.color, ownerName: p.name,
      cardName: 'M€ converted to VP', vp: a.mcToVp, kind: 'resource',
      bot: {kind: 'mc', stock: p.megacredits, rate: a.mcPerVp},
    });
  }
  if (a.neuralInstance > 0) {
    out.push({
      id: `${p.color}:bot:neural`, owner: p.color, ownerName: p.name,
      cardName: 'Neural Instance', vp: a.neuralInstance, kind: 'conditional',
      bot: {kind: 'neural', count: a.neuralInstance},
    });
  }
  if (a.cardVp > 0) {
    out.push({
      id: `${p.color}:bot:icons`, owner: p.color, ownerName: p.name,
      cardName: 'Played card icons', vp: a.cardVp, kind: 'fixed',
      bot: {kind: 'icons', count: a.cardVp, difficulty: DIFFICULTY_LABEL[p.botDifficulty ?? 'hard']},
    });
  }
  if (a.corpVp > 0) {
    // The row names the CORPORATION and its points, and stops there: which
    // rule earned them is that card's own text, and this model must not
    // restate a rule it cannot see.
    out.push({
      id: `${p.color}:bot:corp`, owner: p.color, ownerName: p.name,
      cardName: p.botCorporation?.name ?? 'Bot corporation', vp: a.corpVp, kind: 'fixed',
      bot: {kind: 'corp', count: a.corpVp, corporation: p.botCorporation?.name ?? 'Bot corporation'},
    });
  }
  return out;
}

function buildCards(model: EndgameModel, egVm: ConsoleEndgameVm): OvCards {
  const bots = new Set(egVm.rows.filter((r) => r.isBot).map((r) => r.color));
  // The CANONICAL «Карты» per player — the ceremony's own category values
  // (positives + automa), so the filter chips can never disagree with the
  // Score tab by construction.
  const cardsCategory = egVm.categories.find((c) => c.key === 'cards');
  const positives: Array<OvCardRow> = [];
  const penalties: Array<OvCardRow> = [];
  const byPlayer: Array<OvCardsPlayerSummary> = [];

  for (const p of model.players) {
    const kinds: Record<CardVictoryPointsKind, number> = {resource: 0, conditional: 0, fixed: 0, penalty: 0};
    const push = (row: OvCardRow) => {
      (row.vp < 0 ? penalties : positives).push(row);
      kinds[row.kind] += row.vp;
    };
    p.topCards.forEach((c, i) => push({
      id: `${p.color}:${c.cardName}:${i}`, owner: p.color, ownerName: p.name,
      cardName: c.cardName, vp: c.victoryPoint, kind: c.kind,
    }));
    p.penaltyCards.forEach((c, i) => push({
      id: `${p.color}:${c.cardName}:p${i}`, owner: p.color, ownerName: p.name,
      cardName: c.cardName, vp: c.victoryPoint, kind: c.kind,
    }));
    const botRows = botCardRows(p);
    botRows.forEach(push);
    byPlayer.push({
      color: p.color,
      name: p.name,
      isBot: bots.has(p.color),
      cardsVp: cardsCategory?.values[p.color] ?? 0,
      count: p.topCards.length + p.penaltyCards.length + botRows.length,
      kinds,
    });
  }

  // One shared ranking: a bot source competes on its actual VP contribution;
  // ties break on the stable row id (deterministic across reloads).
  positives.sort((a, b) => b.vp - a.vp || a.id.localeCompare(b.id));
  penalties.sort((a, b) => a.vp - b.vp || a.id.localeCompare(b.id));
  return {rows: [...positives, ...penalties], byPlayer};
}

// ── Parameters ──────────────────────────────────────────────────────────────

type ParamMeta = {
  key: GlobalParameter;
  label: string;
  accent: string;
  unit: '' | '%' | '°C';
  min: number;
  max: number;
};

/** Display metadata per parameter — completion ranges match the game rules
 *  (and the legacy chart), colours are the console parameter families. */
const PARAM_META: ReadonlyArray<ParamMeta> = [
  {key: GlobalParameter.TEMPERATURE, label: 'Temperature', accent: 'temperature', unit: '°C', min: -30, max: 8},
  {key: GlobalParameter.OXYGEN, label: 'Oxygen', accent: 'oxygen', unit: '%', min: 0, max: 14},
  {key: GlobalParameter.OCEANS, label: 'Oceans', accent: 'oceans', unit: '', min: 0, max: 9},
  {key: GlobalParameter.VENUS, label: 'Venus', accent: 'venus', unit: '%', min: 0, max: 30},
  {key: GlobalParameter.MOON_HABITAT_RATE, label: 'L. Habitat', accent: 'moon', unit: '', min: 0, max: 8},
  {key: GlobalParameter.MOON_MINING_RATE, label: 'L. Mining', accent: 'moon', unit: '', min: 0, max: 8},
  {key: GlobalParameter.MOON_LOGISTIC_RATE, label: 'L. Logistic', accent: 'moon', unit: '', min: 0, max: 8},
];

function paramEnabled(key: GlobalParameter, extras: ConsoleOverviewExtras): boolean {
  switch (key) {
  case GlobalParameter.VENUS:
    return extras.expansions.venus;
  case GlobalParameter.MOON_HABITAT_RATE:
  case GlobalParameter.MOON_MINING_RATE:
  case GlobalParameter.MOON_LOGISTIC_RATE:
    return extras.expansions.moon;
  default:
    return true;
  }
}

function buildParameters(model: EndgameModel, extras: ConsoleOverviewExtras): OvParams {
  const gpg = extras.globalsPerGeneration;
  const gens = gpg.length;
  const parameters: Array<OvParameter> = [];
  for (const meta of PARAM_META) {
    if (!paramEnabled(meta.key, extras)) {
      continue;
    }
    const series = gpg.map((entry) => entry[meta.key] ?? meta.min);
    const pct = series.map((v) =>
      Math.round((100 * (Math.min(Math.max(v, meta.min), meta.max) - meta.min)) / (meta.max - meta.min)));
    const finalValue = series.length > 0 ? series[series.length - 1] : meta.min;
    const finalPct = pct.length > 0 ? pct[pct.length - 1] : 0;
    const contribution = model.parameters.find((p) => p.key === meta.key);
    const contributions = contribution !== undefined ?
      {values: contribution.values, leaders: contribution.leaders, max: contribution.max} : undefined;
    // A parameter that never moved AND has no per-player steps is noise —
    // except the core three, which always exist as tracks of the game.
    const core = meta.key === GlobalParameter.TEMPERATURE ||
      meta.key === GlobalParameter.OXYGEN || meta.key === GlobalParameter.OCEANS;
    const moved = series.some((v) => v !== meta.min) || contributions !== undefined;
    if (!core && !moved) {
      continue;
    }
    parameters.push({
      key: meta.key,
      label: meta.label,
      accent: meta.accent,
      unit: meta.unit,
      min: meta.min,
      max: meta.max,
      series,
      pct,
      finalValue,
      finalPct,
      completed: finalValue >= meta.max,
      contributions,
    });
  }
  return {parameters, gens};
}

// ── Players ─────────────────────────────────────────────────────────────────

const PRODUCTION_META: ReadonlyArray<{key: string; label: string}> = [
  {key: 'megacredits', label: 'Megacredits'},
  {key: 'steel', label: 'Steel'},
  {key: 'titanium', label: 'Titanium'},
  {key: 'plants', label: 'Plants'},
  {key: 'energy', label: 'Energy'},
  {key: 'heat', label: 'Heat'},
];

function buildPlayers(model: EndgameModel, egVm: ConsoleEndgameVm, extras: ConsoleOverviewExtras): OvPlayers {
  const bots = new Set(egVm.rows.filter((r) => r.isBot).map((r) => r.color));
  const rawBy = new Map(extras.playersRaw.map((p) => [p.color, p]));
  const maxima: Record<string, number> = {};
  const comparable: Record<string, number> = {};
  const bump = (key: string, v: number) => {
    maxima[key] = Math.max(maxima[key] ?? 1, v);
    comparable[key] = (comparable[key] ?? 0) + 1;
  };
  // RAW server name → display name: the award-funder chips must never print
  // «MarsBot» in a localized UI (the server template carries the raw name).
  const displayNames: Record<string, string> = {};
  for (const p of model.players) {
    displayNames[p.rawName ?? p.name] = p.name;
  }

  const players: Array<OvPlayerCard> = model.players.map((p: EndgamePlayerScore) => {
    const raw = rawBy.get(p.color);
    const isBot = bots.has(p.color);
    // The human economy groups are HUMAN-ONLY: the bot's rules keep no
    // production and no resource stock (its M€ live in `botEconomy`), so a
    // bot never contributes zeros to these bars — and never wears them.
    const production: Array<OvMetric> = isBot ? [] : PRODUCTION_META.map((m) => ({
      key: 'prod:' + m.key,
      label: m.label,
      value: (p.production as Record<string, number> | undefined)?.[m.key] ?? 0,
    }));
    const stock: Array<OvMetric> = isBot ? [] : PRODUCTION_META.map((m) => ({
      key: 'stock:' + m.key,
      label: m.label,
      value: m.key === 'megacredits' ? p.megacredits :
        ((p.leftover as Record<string, number> | undefined)?.[m.key] ?? 0),
    }));
    const stats: Array<OvMetric> = [
      {key: 'stat:tr', label: 'TR', value: raw?.terraformRating ?? p.breakdown.terraformRating},
      {key: 'stat:cities', label: 'Cities', value: raw?.citiesCount ?? 0},
      ...(extras.expansions.colonies ? [{key: 'stat:colonies', label: 'Colonies', value: raw?.coloniesCount ?? 0}] : []),
      // The bot takes TURNS, not the human action count — a 0 in this bar
      // would read as «did nothing», so the metric stays human-only.
      ...(isBot ? [] : [{key: 'stat:actions', label: 'Actions', value: raw?.actionsTakenThisGame ?? 0}]),
      {key: 'stat:steps', label: 'Parameter steps', value: p.parametersTotal},
    ];
    for (const m of [...production, ...stock, ...stats]) {
      bump(m.key, m.value);
    }
    const tags = isBot ? [] : Object.entries(raw?.tags ?? {})
      .map(([tag, count]) => ({tag: tag as Tag, count: count ?? 0}))
      .filter((t) => t.count > 0 && t.tag !== Tag.EVENT)
      .sort((a, b) => b.count - a.count)
      .slice(0, TAGS_MAX);
    const categories = egVm.categories
      .map((cat) => ({key: cat.key, label: cat.label, accent: cat.accent, value: cat.values[p.color] ?? 0}))
      .filter((c) => c.value !== 0);
    const automaParts = p.breakdown.automa;
    const humanCount = model.players.length - bots.size;
    const groups: Array<PlayerMetricGroup> = isBot ? [
      {key: 'boteco', label: 'Bot economy', comparable: false},
      {key: 'stats', label: 'Match statistics', comparable: model.players.length >= 2},
      {key: 'bottracks', label: 'Bot tracks', comparable: false},
      {key: 'ma', label: 'Milestones & awards', comparable: false},
      {key: 'categories', label: 'Score sources', comparable: false},
    ] : [
      {key: 'production', label: 'Production', comparable: humanCount >= 2},
      {key: 'stock', label: 'Resources at the end', comparable: humanCount >= 2},
      {key: 'stats', label: 'Match statistics', comparable: model.players.length >= 2},
      {key: 'tags', label: 'Tags', comparable: false},
      {key: 'ma', label: 'Milestones & awards', comparable: false},
      {key: 'categories', label: 'Score sources', comparable: false},
    ];
    return {
      color: p.color,
      name: p.name,
      // The bot's corp identity rides `botCorporation` (its `corporations`
      // array stays empty — that one feeds the human impact engine).
      corporation: p.corporations.length > 0 ? p.corporations.join(' / ') : (p.botCorporation?.name ?? ''),
      ...(p.botDifficulty !== undefined ? {difficulty: DIFFICULTY_LABEL[p.botDifficulty]} : {}),
      place: p.place,
      total: p.total,
      isBot,
      isWinner: p.isWinner,
      production,
      stock,
      stats,
      tags,
      milestones: p.breakdown.detailsMilestones,
      awards: p.breakdown.detailsAwards,
      categories,
      ...(isBot && automaParts !== undefined ? {
        botEconomy: {
          stock: p.megacredits,
          rate: automaParts.mcPerVp,
          vp: automaParts.mcToVp,
          playedCount: extras.automa?.playedCount ?? 0,
        },
      } : {}),
      ...(isBot && extras.automa !== undefined ? {botTracks: extras.automa.tracks} : {}),
      groups,
    };
  });

  return {players, maxima, comparable, displayNames};
}

// ── The builder ─────────────────────────────────────────────────────────────

export function buildConsoleOverviewVm(
  model: EndgameModel,
  egVm: ConsoleEndgameVm,
  extras: ConsoleOverviewExtras,
): ConsoleOverviewVm {
  const winnerTotal = model.winner?.total ?? 0;
  const rowBy = new Map(egVm.rows.map((r) => [r.color, r]));
  const ranking: Array<OvRankRow> = model.players.map((p) => ({
    color: p.color,
    name: p.name,
    corporation: rowBy.get(p.color)?.corporation ?? (p.corporations.length > 0 ? p.corporations.join(' / ') : (p.botCorporation?.name ?? '')),
    ...(p.botDifficulty !== undefined ? {difficulty: DIFFICULTY_LABEL[p.botDifficulty]} : {}),
    place: p.place,
    total: p.total,
    gapToWinner: Math.max(0, winnerTotal - p.total),
    megacredits: p.megacredits,
    isBot: rowBy.get(p.color)?.isBot ?? false,
    isWinner: p.isWinner,
  }));

  return {
    generation: model.generation,
    winner: model.winner !== undefined ?
      {color: model.winner.color, name: model.winner.name, total: model.winner.total} : undefined,
    sharedWin: egVm.winners.length > 1,
    digest: buildDigest(model, ranking),
    score: buildScore(model, egVm, ranking),
    timeline: buildTimeline(model, egVm),
    cards: buildCards(model, egVm),
    parameters: buildParameters(model, extras),
    players: buildPlayers(model, egVm, extras),
  };
}
