/*
 * THE SCORE EXPLORER MODEL — pure view-models for the Information workspace's
 * victory-points subtree (`vp` → `vpCategory` → `vpCards`).
 *
 * WHY THIS IS NOT A FOURTH SCORING POLICY. Every number and every category
 * here comes from the ONE console scoring system: `SCORE_CATEGORY_TABLE`
 * (set, order, keys = `.con-eg-cat--<key>` colours — shared with the endgame
 * ceremony), `FINAL_SCORING_SEGMENTS` via `liveScoreModel` (Σ ≡ total by
 * construction) and the server's own `VictoryPointsBreakdown` provenance
 * (`terraformRatingBreakdown.cardEntries`, `detailsCards[].mechanics`,
 * `detailsCities`, `detailsMilestones/Awards`). This module only ARRANGES
 * those facts into explorable levels; it computes no rule of its own — a
 * formula's operand is the server Counter's own count, never a client guess.
 *
 * THE ONE BAR SEMANTIC: every share bar in the explorer means
 * «category value / positive total» (`sharePct`). The old detail screen's
 * max-category normalisation (23/39 drawn as a full bar) is retired — two
 * same-looking bars may never carry different hidden scales.
 *
 * PURE: no Vue / DOM / i18n — labels are English i18n KEYS (card names ARE
 * keys), templates are `${0}`-parameterised keys the component translates.
 */
import {Tag} from '@/common/cards/Tag';
import {
  CardVictoryPointsDetail,
  CardVictoryPointsKind,
  CardVpMechanics,
  CardVpUnit,
  CityVpDetail,
  VictoryPointsBreakdown,
} from '@/common/game/VictoryPointsBreakdown';
import {
  CARD_FAMILY_ORDER,
  ConsoleEndgameCategoryKey,
  SCORE_CATEGORY_TABLE,
} from '@/client/console/endgame/consoleEndgameModel';
import {LiveScoreCategory, LiveScoreModel} from '@/client/console/liveScoreModel';
import type {InfoRouteId} from '@/client/console/infoRoute';

// ── shared shapes ──────────────────────────────────────────────────────────

/** One piece of a source ledger — an i18n template + params, optionally
 *  led by a SIGNED value («+1 Кислород»; the chain's first piece renders
 *  its value bare — the starting term of the arithmetic). */
export type LedgerPiece = {
  key: string;
  label: string; // i18n template or a raw name (card/milestone names ARE keys)
  params?: ReadonlyArray<string | number>;
  value?: number;
};

/**
 * THE SOURCE LEDGER of one overview card — what the subtotal is MADE OF
 * (the top bar already owns «share of the total»; a card never draws that
 * again). Three shapes, one grammar:
 *   · chain      — an arithmetic story («20 старт · +1 фора · +1 кислород»,
 *                  honest `moreCount` when sources were cut);
 *   · medallions — the REAL earned emblems (milestones/awards) + a caption;
 *   · empty      — the quiet zero-state sentence.
 */
export type ScoreLedger =
  | {kind: 'chain', pieces: ReadonlyArray<LedgerPiece>, moreCount: number}
  | {kind: 'medallions', entries: ReadonlyArray<{name: string, slug: string}>, moreCount: number, caption: LedgerPiece}
  | {kind: 'empty', empty: LedgerPiece};

export type ScoreTile = {
  key: ConsoleEndgameCategoryKey;
  label: string; // i18n key
  accent: ConsoleEndgameCategoryKey;
  value: number;
  /** value / positiveTotal, 0..100 — the TOP BAR's semantic. Feeds the
   *  focus↔segment link and the share line; NEVER a per-card track. */
  sharePct: number;
  zero: boolean;
  penalty: boolean;
  ledger: ScoreLedger;
};

/** The MA art slug — the same formula the MA workspace binds
 *  (`assets/ma/<slug>.png`, transparent 512×512). */
export function maArtSlug(name: string): string {
  return name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
}

/** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
export function maShortName(name: string): string {
  return name.replace(/[0-9]+$/, '');
}

export type ScoreOverviewModel = {
  total: number;
  positiveTotal: number;
  penaltyTotal: number;
  /** ONE list in the ceremony's canonical order — zero categories stay IN
   *  the list (compact pose), so an LB/RB seat switch morphs ink, never
   *  layout. */
  tiles: ReadonlyArray<ScoreTile>;
};

/** Extra live inputs the ledgers/details need beyond the breakdown. */
export type ScoreExplorerContext = {
  isBot: boolean;
  /** Delta Project («Гидросеть») track position, when the expansion is on. */
  deltaPosition?: number;
  /** Funded awards — the server's own standings (public model). */
  awards?: ReadonlyArray<{
    name: string;
    funder?: string;
    scores: ReadonlyArray<{playerColor: string, playerScore: number}>;
  }>;
  /** Claimed-milestone context (public model) — threshold/score enrichment. */
  milestones?: ReadonlyArray<{
    name: string;
    threshold?: number;
    description?: string;
    scores: ReadonlyArray<{playerColor: string, playerScore: number}>;
  }>;
  viewedColor?: string;
  /** Resolve a seat color to its display name («Бот» for the MarsBot). */
  resolveName?: (color: string) => string;
  /** Resolve an MA description from the client manifest (fallback). */
  describeMa?: (kind: 'milestone' | 'award', name: string) => string;
};

// ── level 1: the overview ──────────────────────────────────────────────────

/** How many chain pieces an overview card may speak before «ещё N». */
const LEDGER_MAX_PIECES = 3;
/** How many emblem previews an overview card may carry. */
const LEDGER_MAX_MEDALLIONS = 4;

const EMPTY_LEDGER: ScoreLedger = {kind: 'empty', empty: {key: 'zero', label: 'No points yet'}};

function chain(pieces: ReadonlyArray<LedgerPiece>, moreCount = 0): ScoreLedger {
  return pieces.length === 0 ? EMPTY_LEDGER : {kind: 'chain', pieces, moreCount};
}

/** Cut a source list to the ledger budget with an honest «ещё N» tail. */
function chainOf(pieces: ReadonlyArray<LedgerPiece>, max = LEDGER_MAX_PIECES): ScoreLedger {
  if (pieces.length <= max) {
    return chain(pieces);
  }
  return chain(pieces.slice(0, max), pieces.length - max);
}

function medallionLedger(names: ReadonlyArray<string>, caption: LedgerPiece): ScoreLedger {
  if (names.length === 0) {
    return EMPTY_LEDGER;
  }
  const entries = names.slice(0, LEDGER_MAX_MEDALLIONS)
    .map((name) => ({name: maShortName(name), slug: maArtSlug(name)}));
  return {kind: 'medallions', entries, moreCount: Math.max(0, names.length - LEDGER_MAX_MEDALLIONS), caption};
}

/** The TR card's chain: start first (bare), then the LARGEST live sources. */
function trLedger(b: VictoryPointsBreakdown, isBot: boolean): ScoreLedger {
  const provenance = buildTrProvenance(b, isBot);
  const [start, ...rest] = provenance.rows;
  const pieces: Array<LedgerPiece> = [];
  if (start !== undefined) {
    pieces.push({key: start.key, label: 'start', value: start.value});
  }
  const sources = rest.filter((r) => r.value !== 0)
    .sort((a, c) => Math.abs(c.value) - Math.abs(a.value));
  for (const row of sources.slice(0, LEDGER_MAX_PIECES - 1)) {
    pieces.push({key: row.key, label: row.label, value: row.value});
  }
  const cut = Math.max(0, sources.length - (LEDGER_MAX_PIECES - 1));
  return pieces.length === 0 ? EMPTY_LEDGER : chain(pieces, cut);
}

function tileLedger(cat: LiveScoreCategory, b: VictoryPointsBreakdown, ctx: ScoreExplorerContext): ScoreLedger {
  switch (cat.key) {
  case 'tr':
    return trLedger(b, ctx.isBot);
  case 'cards': {
    // The category's own composition — families that actually hold points
    // (a full-composition strip, never a share-of-total track).
    const parts = cat.subs.filter((s) => s.value !== 0)
      .map((s): LedgerPiece => ({key: s.key, label: s.label, value: s.value}));
    return chainOf(parts);
  }
  case 'milestones':
    return medallionLedger(
      b.detailsMilestones.map((d) => d.messageArgs?.[0] ?? d.message),
      {key: 'sum', label: '${0} × 5 VP', params: [b.detailsMilestones.length]});
  case 'awards':
    return medallionLedger(
      b.detailsAwards.map((d) => d.messageArgs?.[1] ?? d.message),
      {key: 'sum', label: 'Award places: ${0}', params: [b.detailsAwards.length]});
  case 'greenery':
    return cat.value > 0 ?
      chain([{key: 'g', label: '${0} tiles × 1 VP', params: [cat.value]}]) : EMPTY_LEDGER;
  case 'city': {
    const cities = b.detailsCities ?? [];
    if (cities.length === 0) {
      return {kind: 'empty', empty: {key: 'zero', label: 'No cities on the board'}};
    }
    const pieces: Array<LedgerPiece> = [{key: 'n', label: 'Cities: ${0}', params: [cities.length]}];
    pieces.push(cat.value > 0 ?
      {key: 'adj', label: 'adjacent greeneries: ${0}', params: [cat.value]} :
      {key: 'adj', label: 'no adjacent greeneries'});
    return chain(pieces);
  }
  case 'delta':
    return cat.value !== 0 && ctx.deltaPosition !== undefined ?
      chain([{key: 'pos', label: 'Position ${0} → ${1} VP', params: [ctx.deltaPosition, cat.value]}]) :
      (ctx.deltaPosition !== undefined && ctx.deltaPosition > 0 ?
        chain([{key: 'pos', label: 'Track position: ${0}', params: [ctx.deltaPosition]}]) : EMPTY_LEDGER);
  case 'moon':
  case 'tracks':
  case 'penalty': {
    const parts = cat.subs.filter((s) => s.value !== 0)
      .map((s): LedgerPiece => ({key: s.key, label: s.label, value: s.value}));
    return chainOf(parts);
  }
  default:
    return EMPTY_LEDGER;
  }
}

/**
 * Level 1 — the scoring overview. One tile per live category, canonical
 * order; Σ sharePct over positive tiles ≡ 100 (spec-guarded). Every tile
 * carries a SOURCE LEDGER — what its subtotal is made of; the share of the
 * total is the TOP BAR's story alone.
 */
export function buildScoreOverview(live: LiveScoreModel, b: VictoryPointsBreakdown, ctx: ScoreExplorerContext): ScoreOverviewModel {
  const positive = live.positiveTotal;
  const tiles = live.categories.map((cat): ScoreTile => ({
    key: cat.key,
    label: cat.label,
    accent: cat.accent,
    value: cat.value,
    sharePct: cat.value > 0 && positive > 0 ? (cat.value / positive) * 100 : 0,
    zero: cat.value === 0,
    penalty: cat.penalty,
    ledger: tileLedger(cat, b, ctx),
  }));
  return {
    total: live.total,
    positiveTotal: positive,
    penaltyTotal: live.penaltyTotal,
    tiles,
  };
}

// ── level 2: the terraform-rating provenance ───────────────────────────────

export type TrRowFlavor = 'base' | 'handicap' | 'param' | 'hazard' | 'source' | 'residual';

export type TrProvenanceRow = {
  key: string;
  /** i18n key for the fixed rows; the SOURCE NAME (a card name IS a key) for
   *  card/effect rows. */
  label: string;
  value: number;
  flavor: TrRowFlavor;
  /** The RUNNING rating after this row lands — the arithmetic story
   *  («20 → 21 → 22 → 23»), spec-guarded to end at the displayed rating. */
  running: number;
  /** CardName — the row can show a card chip / open a preview. */
  cardId?: string;
  generation?: number;
};

export type TrProvenanceModel = {
  rows: ReadonlyArray<TrProvenanceRow>;
  /** Σ rows — MUST equal the displayed terraform rating (spec-guarded). */
  total: number;
};

/**
 * The full honest TR story: starting rating, handicap, the four parameters,
 * hazard cleanup, then every DIRECT source the server attributed (cards,
 * corporations, parties, global events), oldest-generation first inside
 * equal amounts. A `legacyUnknown` residual renders as its own honest row —
 * never reconstructed, never hidden.
 */
export function buildTrProvenance(b: VictoryPointsBreakdown, isBot: boolean): TrProvenanceModel {
  const tr = b.terraformRatingBreakdown;
  const rows: Array<TrProvenanceRow> = [];
  const base = tr.baseRating ?? tr.base;
  rows.push({key: 'base', label: 'Starting rating', value: base, flavor: 'base', running: 0});
  if ((tr.handicap ?? 0) !== 0) {
    rows.push({key: 'handicap', label: 'Handicap', value: tr.handicap ?? 0, flavor: 'handicap', running: 0});
  }
  const params: Array<[string, string, number]> = [
    ['temperature', 'Temperature', tr.temperature],
    ['oxygen', 'Oxygen', tr.oxygen],
    ['oceans', 'Oceans', tr.oceans],
    ['venus', 'Venus', tr.venus],
  ];
  for (const [key, label, value] of params) {
    if (value !== 0) {
      rows.push({key, label, value, flavor: 'param', running: 0});
    }
  }
  if ((tr.hazards ?? 0) !== 0) {
    rows.push({key: 'hazards', label: 'Hazard cleanup', value: tr.hazards ?? 0, flavor: 'hazard', running: 0});
  }
  const entries = tr.cardEntries ?? [];
  for (const e of entries) {
    if (e.sourceType === 'legacyUnknown') {
      rows.push({key: 'residual', label: 'Other / untracked sources', value: e.amount, flavor: 'residual', running: 0});
    } else {
      rows.push({
        key: `src:${e.sourceType}:${e.sourceName}:${e.sourceCardId ?? ''}`,
        label: e.sourceName,
        value: e.amount,
        flavor: 'source',
        running: 0,
        cardId: e.sourceCardId,
        generation: e.generation,
      });
    }
  }
  // Older models have no cardEntries — keep the honest aggregate row so the
  // sum invariant still holds.
  if (entries.length === 0 && tr.cards !== 0) {
    rows.push({
      key: 'cards-aggregate',
      label: isBot ? 'Track actions' : 'Cards & effects',
      value: tr.cards,
      flavor: 'source',
      running: 0,
    });
  }
  // The RUNNING chain — «20 → +1 → 23» must be walkable row by row.
  let running = 0;
  for (const row of rows) {
    running += row.value;
    row.running = running;
  }
  return {rows, total: running};
}

// ── level 2: the cards hub + level 3: the group tables ─────────────────────

export type ScoreCardGroupKey = 'cards-resource' | 'cards-conditional' | 'cards-fixed';

export const CARD_GROUP_KIND: Readonly<Record<ScoreCardGroupKey, CardVictoryPointsKind>> = {
  'cards-resource': 'resource',
  'cards-conditional': 'conditional',
  'cards-fixed': 'fixed',
};

/** The hub's one-line характеристика per family. */
const CARD_GROUP_TRAIT: Readonly<Record<ScoreCardGroupKey, string>> = {
  'cards-resource': 'Score from resources stored on the card',
  'cards-conditional': 'Score depends on the game state',
  'cards-fixed': 'A printed, unchanging amount',
};

export type CardGroupTile = {
  key: ScoreCardGroupKey;
  label: string; // i18n key (the shared family labels)
  value: number;
  /** Row count — undefined for the bot (its families are formula facts). */
  count: number | undefined;
  trait: string; // i18n key
  enterable: boolean;
};

export type CardsHubModel = {
  tiles: ReadonlyArray<CardGroupTile>;
  subtotal: number;
};

/** Rows that are not real cards (engine facts routed через detailsCards). */
const PSEUDO_CARD_ROWS: ReadonlySet<string> = new Set([
  'Turmoil Points', 'Colony VP', 'Underworld Corruption Bribe',
]);

export function isPseudoCardRow(cardName: string): boolean {
  return PSEUDO_CARD_ROWS.has(cardName);
}

/**
 * Level 2 for the cards category — the three family doors. For the bot the
 * values are the ceremony's own normalisation (already inside the live
 * category subs); counts exist only where rows do.
 */
export function buildCardsHub(live: LiveScoreModel, b: VictoryPointsBreakdown, isBot: boolean): CardsHubModel {
  const cat = live.categories.find((c) => c.key === 'cards');
  const familyValue = new Map<string, number>();
  if (cat !== undefined && cat.subs.length > 0) {
    for (const sub of cat.subs) {
      familyValue.set(sub.key, sub.value);
    }
  } else if (cat !== undefined) {
    // A single-source category collapses its subs — rebuild the one family.
    for (const fam of CARD_FAMILY_ORDER) {
      familyValue.set(fam.key, 0);
    }
    for (const d of b.detailsCards) {
      if (d.kind !== 'penalty') {
        const key = `cards-${d.kind}`;
        familyValue.set(key, (familyValue.get(key) ?? 0) + d.victoryPoint);
      }
    }
    if (b.automa !== undefined) {
      familyValue.set('cards-resource', (familyValue.get('cards-resource') ?? 0) + b.automa.mcToVp);
      familyValue.set('cards-conditional', (familyValue.get('cards-conditional') ?? 0) + b.automa.neuralInstance);
      familyValue.set('cards-fixed', (familyValue.get('cards-fixed') ?? 0) + b.automa.cardVp + b.automa.corpVp);
    }
  }
  const tiles = CARD_FAMILY_ORDER.map((fam): CardGroupTile => {
    const key = fam.key as ScoreCardGroupKey;
    const value = familyValue.get(fam.key) ?? 0;
    const count = isBot ? undefined : b.detailsCards.filter((d) => d.kind === CARD_GROUP_KIND[key]).length;
    return {
      key,
      label: fam.label,
      value,
      count,
      trait: CARD_GROUP_TRAIT[key],
      // The door exists when there is anything to show behind it.
      enterable: isBot ? value !== 0 : (count ?? 0) > 0,
    };
  });
  return {tiles, subtotal: cat?.value ?? 0};
}

/** The typed formula behind one table row — the component translates. */
export type ScoreFormula =
  | {kind: 'fixed', vp: number}
  | {
      kind: 'per', vp: number,
      counted: number, each: number, per: number,
      unit: CardVpUnit, tag?: Tag, adjacent?: boolean, all?: boolean,
      /** Units still short of the next VP step (per > 1 only). */
      remainder?: number,
    }
  | {kind: 'special', vp: number, counted?: number}
  | {kind: 'fact', vp: number, label: string, params?: ReadonlyArray<string | number>};

export type ScoreCardRow = {
  cardName: string; // the card name IS the i18n key; pseudo rows keep theirs
  vp: number;
  formula: ScoreFormula;
  /** Live stored resources (the tableau model's own count). */
  resources?: number;
  resourceType?: string;
  /** A real, inspectable card (manifest hit + not a pseudo row). */
  previewable: boolean;
};

export type CardGroupTableModel = {
  group: ScoreCardGroupKey;
  label: string;
  rows: ReadonlyArray<ScoreCardRow>;
  subtotal: number;
};

/** What the table needs to know about a card beyond the breakdown row. */
export type ScoreCardLookup = (name: string) => {exists: boolean, resourceType?: string} | undefined;

function formulaFor(d: CardVictoryPointsDetail): ScoreFormula {
  const m: CardVpMechanics | undefined = d.mechanics;
  if (m === undefined) {
    // An older model without mechanics — state the result, claim no formula.
    return d.kind === 'fixed' ? {kind: 'fixed', vp: d.victoryPoint} : {kind: 'special', vp: d.victoryPoint};
  }
  switch (m.shape) {
  case 'fixed':
    return {kind: 'fixed', vp: d.victoryPoint};
  case 'per': {
    const per = m.per ?? 1;
    const counted = m.counted ?? 0;
    return {
      kind: 'per',
      vp: d.victoryPoint,
      counted,
      each: m.each ?? 1,
      per,
      unit: m.unit ?? 'other',
      tag: m.tag,
      adjacent: m.adjacent,
      all: m.all,
      remainder: per > 1 ? counted % per : undefined,
    };
  }
  case 'special':
    return {kind: 'special', vp: d.victoryPoint, counted: m.counted};
  default:
    return {kind: 'special', vp: d.victoryPoint};
  }
}

/**
 * Level 3 — one family's table. Sorting: current VP desc, then stored
 * resources desc, then name (stable, legible); zero rows land below the
 * scoring ones by construction.
 */
export function buildCardGroupTable(
  b: VictoryPointsBreakdown,
  group: ScoreCardGroupKey,
  resourcesByName: Readonly<Partial<Record<string, number>>>,
  lookup: ScoreCardLookup,
): CardGroupTableModel {
  const kind = CARD_GROUP_KIND[group];
  const label = CARD_FAMILY_ORDER.find((f) => f.key === group)?.label ?? group;
  const rows = b.detailsCards
    .filter((d) => d.kind === kind)
    .map((d): ScoreCardRow => {
      const decl = lookup(d.cardName);
      const resourceType = d.mechanics?.resourceType ?? decl?.resourceType;
      const resources = resourceType !== undefined ? resourcesByName[d.cardName] ?? d.mechanics?.counted : undefined;
      return {
        cardName: d.cardName,
        vp: d.victoryPoint,
        formula: formulaFor(d),
        resources,
        resourceType,
        previewable: decl?.exists === true && !isPseudoCardRow(d.cardName),
      };
    });
  rows.sort((a, c) =>
    c.vp - a.vp ||
    (c.resources ?? -1) - (a.resources ?? -1) ||
    a.cardName.localeCompare(c.cardName));
  return {
    group,
    label,
    rows,
    subtotal: rows.reduce((a, r) => a + r.vp, 0),
  };
}

/** The bot's family «table» — its honest formula facts, same shape. */
export function buildBotGroupFacts(b: VictoryPointsBreakdown, group: ScoreCardGroupKey, botMegaCredits: number): CardGroupTableModel {
  const a = b.automa;
  const label = CARD_FAMILY_ORDER.find((f) => f.key === group)?.label ?? group;
  const rows: Array<ScoreCardRow> = [];
  if (a !== undefined) {
    if (group === 'cards-resource' && (a.mcToVp > 0 || botMegaCredits > 0)) {
      rows.push({
        cardName: 'mc',
        vp: a.mcToVp,
        formula: {kind: 'fact', vp: a.mcToVp, label: '${0} M€ at 1 VP per ${1} M€', params: [botMegaCredits, a.mcPerVp]},
        previewable: false,
      });
    }
    if (group === 'cards-conditional' && a.neuralInstance > 0) {
      rows.push({
        cardName: 'neural',
        vp: a.neuralInstance,
        formula: {kind: 'fact', vp: a.neuralInstance, label: 'Neural Instance'},
        previewable: false,
      });
    }
    if (group === 'cards-fixed') {
      if (a.cardVp > 0) {
        rows.push({cardName: 'icons', vp: a.cardVp, formula: {kind: 'fact', vp: a.cardVp, label: 'Played card icons'}, previewable: false});
      }
      if (a.corpVp > 0) {
        rows.push({cardName: 'corp', vp: a.corpVp, formula: {kind: 'fact', vp: a.corpVp, label: 'Bot corporation'}, previewable: false});
      }
    }
  }
  return {group, label, rows, subtotal: rows.reduce((s, r) => s + r.vp, 0)};
}

// ── level 2: the other categories ──────────────────────────────────────────

export type ScoreFactRow = {
  key: string;
  /** i18n TEMPLATE (`${0}`-parameterised) or a plain key/raw name. */
  label: string;
  params?: ReadonlyArray<string | number>;
  /** Absent = a context row (a track position) — no value cell rendered. */
  value?: number;
  /** Extra quiet line (i18n template + params). */
  note?: {label: string, params?: ReadonlyArray<string | number>};
};

export type CategoryFactsModel = {
  rows: ReadonlyArray<ScoreFactRow>;
  /** i18n key of the honest empty-state sentence (zero categories). */
  emptyKey: string;
};

// ── the MA collections (real earned emblems + the facts behind them) ───────

export type ScoreMaEntry = {
  key: string;
  kind: 'milestone' | 'award';
  /** The full raw name (slug/description resolution). */
  name: string;
  /** The display name (numeric variant suffix stripped; an i18n key). */
  shortName: string;
  /** `assets/ma/<slug>.png`. */
  slug: string;
  vp: number;
  /** The one fact line under the name (place/funder — award; claimed — milestone). */
  fact: LedgerPiece;
  /** The full description (server model first, manifest fallback). */
  description: string;
  /** Milestone: the per-game threshold + the viewed score, when known. */
  threshold?: number;
  myScore?: number;
  /** Award: the RESOLVED standings, best first (ties share a place). */
  standings?: ReadonlyArray<{name: string, score: number, place: number, mine: boolean, scoringPlace: boolean}>;
  /** Award: how many rivals share the viewed participant's score. */
  ties?: number;
};

export type ScoreMaCollection = {
  entries: ReadonlyArray<ScoreMaEntry>;
  emptyKey: string;
};

/** «Достижения» — ONLY the milestones the viewed participant actually
 *  claimed (5 VP each, the printed rule) — real emblems, never placeholders. */
export function buildMilestoneCollection(b: VictoryPointsBreakdown, ctx: ScoreExplorerContext): ScoreMaCollection {
  const entries = b.detailsMilestones.map((d, i): ScoreMaEntry => {
    const name = d.messageArgs?.[0] ?? d.message;
    const model = ctx.milestones?.find((m) => m.name === name);
    const myScore = ctx.viewedColor !== undefined ?
      model?.scores.find((s) => s.playerColor === ctx.viewedColor)?.playerScore : undefined;
    return {
      key: `ms:${i}:${name}`,
      kind: 'milestone',
      name,
      shortName: maShortName(name),
      slug: maArtSlug(name),
      vp: d.victoryPoint,
      fact: myScore !== undefined && model?.threshold !== undefined ?
        {key: 'claimed', label: 'Claimed · ${0}/${1}', params: [myScore, model.threshold]} :
        {key: 'claimed', label: 'Claimed'},
      description: model?.description ?? ctx.describeMa?.('milestone', name) ?? '',
      threshold: model?.threshold,
      myScore,
    };
  });
  return {entries, emptyKey: 'No milestones claimed'};
}

/** Resolve an award's standings: best first; equal scores share a place. */
function awardStandings(
  scores: ReadonlyArray<{playerColor: string, playerScore: number}>,
  viewedColor: string | undefined,
  resolveName: ((color: string) => string) | undefined,
): Array<{name: string, score: number, place: number, mine: boolean, scoringPlace: boolean}> {
  const sorted = [...scores].sort((a, c) => c.playerScore - a.playerScore);
  return sorted.map((s) => {
    const better = sorted.filter((o) => o.playerScore > s.playerScore).length;
    const place = better + 1;
    return {
      name: resolveName?.(s.playerColor) ?? s.playerColor,
      score: s.playerScore,
      place,
      mine: s.playerColor === viewedColor,
      // The printed rule scores two places (5/2) — deeper rows are context.
      scoringPlace: place <= 2,
    };
  });
}

/** «Награды» — ONLY the awards where the viewed participant actually took a
 *  scoring place; the funded-award standings live INSIDE each entry. */
export function buildAwardCollection(b: VictoryPointsBreakdown, ctx: ScoreExplorerContext): ScoreMaCollection {
  const entries = b.detailsAwards.map((d, i): ScoreMaEntry => {
    const place = d.messageArgs?.[0] ?? '';
    const name = d.messageArgs?.[1] ?? d.message;
    const funder = d.messageArgs?.[2] ?? '';
    const standing = ctx.awards?.find((a) => a.name === name);
    const standings = standing !== undefined ?
      awardStandings(standing.scores, ctx.viewedColor, ctx.resolveName) : undefined;
    const mine = standings?.find((s) => s.mine);
    const ties = mine !== undefined ?
      Math.max(0, (standings ?? []).filter((s) => s.score === mine.score).length - 1) : undefined;
    // The server's place argument is a raw '1st'/'2nd' — the fact speaks
    // through LOCALIZED sentences instead of interpolating English words.
    const first = place === '1st';
    return {
      key: `aw:${i}:${name}`,
      kind: 'award',
      name,
      shortName: maShortName(name),
      slug: maArtSlug(name),
      vp: d.victoryPoint,
      fact: ties !== undefined && ties > 0 ?
        {key: 'place', label: first ? 'First place · tied with ${0}' : 'Second place · tied with ${0}', params: [ties]} :
        {key: 'place', label: first ? 'First place · funded by ${0}' : 'Second place · funded by ${0}', params: [funder]},
      description: ctx.describeMa?.('award', name) ?? '',
      standings,
      ties,
      myScore: mine?.score,
    };
  });
  return {entries, emptyKey: 'No award placements'};
}

/** «Города» — every ACTUAL owned city (never a future slot): the tile's own
 *  card names it, contributors first. */
export function buildCityFacts(cities: ReadonlyArray<CityVpDetail> | undefined): CategoryFactsModel {
  const rows = (cities ?? [])
    .slice()
    .sort((a, c) => c.points - a.points)
    .map((c): ScoreFactRow => ({
      key: `city:${c.spaceId}`,
      label: c.cardName ?? 'City',
      value: c.points,
      note: c.points > 0 ?
        {label: '${0} adjacent greeneries × 1 VP', params: [c.points]} :
        {label: 'no adjacent greeneries'},
    }));
  return {rows, emptyKey: 'No cities on the board'};
}

/** «Озеленение» — the count is the score (1 VP each, the printed rule). */
export function buildGreeneryFacts(b: VictoryPointsBreakdown): CategoryFactsModel {
  const rows: Array<ScoreFactRow> = b.greenery > 0 ? [{
    key: 'greenery',
    label: '${0} greenery tiles × 1 VP',
    params: [b.greenery],
    value: b.greenery,
  }] : [];
  return {rows, emptyKey: 'No greenery tiles'};
}

/** «Гидросеть» — the ACTUAL state only: the position, and the one VP slot
 *  that APPLIED (never the future slots as a list of coming entries). */
export function buildHydroFacts(b: VictoryPointsBreakdown, ctx: ScoreExplorerContext): CategoryFactsModel {
  const rows: Array<ScoreFactRow> = [];
  if (ctx.deltaPosition !== undefined && ctx.deltaPosition > 0) {
    rows.push({key: 'pos', label: 'Track position: ${0}', params: [ctx.deltaPosition]});
  }
  if (b.deltaProject !== 0) {
    // The printed zones: slot 10 → 2 VP, slot 11 → 5 VP; only ONE applies.
    const slot = b.deltaProject >= 5 ? 11 : 10;
    rows.push({
      key: 'zone',
      label: 'Reached VP slot ${0}',
      params: [slot],
      value: b.deltaProject,
    });
  }
  return {rows, emptyKey: 'No Hydronetwork VP slots reached'};
}

/** «Луна» / «Планетарные треки» — the breakdown's own sub-splits. */
export function buildSimpleFacts(cat: LiveScoreCategory, b: VictoryPointsBreakdown): CategoryFactsModel {
  if (cat.key === 'tracks' && b.detailsPlanetaryTracks.length > 0) {
    return {
      rows: b.detailsPlanetaryTracks.map((t): ScoreFactRow => ({
        key: `track:${t.tag}`, label: t.tag, value: t.points,
      })),
      emptyKey: 'Nothing scored here yet',
    };
  }
  const source = cat.subs.length > 0 ? cat.subs : (cat.value !== 0 ? [{key: cat.key, label: cat.label, value: cat.value}] : []);
  return {
    rows: source.map((s): ScoreFactRow => ({key: s.key, label: s.label, value: s.value})),
    emptyKey: 'Nothing scored here yet',
  };
}

/** «Штрафы» — every penalty row named (no silent loss, ever). */
export function buildPenaltyFacts(b: VictoryPointsBreakdown): CategoryFactsModel {
  const rows: Array<ScoreFactRow> = b.detailsCards
    .filter((d) => d.kind === 'penalty')
    .sort((a, c) => a.victoryPoint - c.victoryPoint)
    .map((d, i): ScoreFactRow => ({key: `pen:${i}:${d.cardName}`, label: d.cardName, value: d.victoryPoint}));
  if (b.escapeVelocity !== 0) {
    rows.push({key: 'ev', label: 'Escape Velocity', value: b.escapeVelocity});
  }
  return {rows, emptyKey: 'No penalties'};
}

// ── the crumb tail (dynamic stage names) ───────────────────────────────────

/**
 * The stage path for the vp subtree — «ПОБЕДНЫЕ ОЧКИ», then the category,
 * then the family. i18n keys; the component translates and joins with «·»
 * (the workspace's hosted-step phrase grammar).
 */
export function scoreStagePath(route: InfoRouteId, categoryKey: string | undefined, group: string | undefined): ReadonlyArray<string> {
  const path: Array<string> = ['Victory Points'];
  if (route === 'vp') {
    return path;
  }
  const cat = SCORE_CATEGORY_TABLE.find((c) => c.key === categoryKey);
  if (cat !== undefined) {
    path.push(cat.label);
  }
  if (route === 'vpCards') {
    const fam = CARD_FAMILY_ORDER.find((f) => f.key === group);
    if (fam !== undefined) {
      path.push(fam.label);
    }
  }
  return path;
}

// ── the overview focus grid ────────────────────────────────────────────────

/**
 * D-pad navigation over the tile grid (row-major, `cols` per row): left/right
 * walk the reading order, up/down move by a full row; edges clamp (the
 * console's d-pad grammar — never wrap).
 */
export function scoreGridNavigate(count: number, from: number, dir: 'up' | 'down' | 'left' | 'right', cols: number): number {
  if (count <= 0) {
    return 0;
  }
  const clamp = (i: number) => Math.min(Math.max(i, 0), count - 1);
  switch (dir) {
  case 'left': return clamp(from - 1);
  case 'right': return clamp(from + 1);
  case 'up': return from - cols >= 0 ? from - cols : from;
  case 'down': return from + cols <= count - 1 ? from + cols : from;
  default: return clamp(from);
  }
}
