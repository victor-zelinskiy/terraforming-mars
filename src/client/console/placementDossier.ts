/*
 * PLACEMENT DOSSIER — the pure view-model of the console board-placement panel
 * (`ConsoleContextPanel`, placement mode).
 *
 * The panel is a TACTICAL READ of one cell, and this module owns its
 * information architecture so the component contains no copy decisions:
 *
 *   1. IDENTITY — what lands. The big title is the OBJECT (`Озеленение` /
 *      `Город` / a special tile's own name / `Маркер`), never the server's
 *      full sentence; the sentence survives only as a quiet action line, and
 *      only when it says something the identity block doesn't already
 *      (a real constraint like «рядом с вашим тайлом»). The identity comes
 *      from the TILE (`tileType` → the same tables the board and the journal
 *      read), then the placement KIND, never from the source card — Flooding
 *      places an OCEAN (see consolePlacementNextStep, same law).
 *   2. SECTIONS — the same server facts (`BoardPlacementPreview`), regrouped
 *      by INTENT: the cell's own toll (costs + risks) / what you receive /
 *      what other players receive / milestone-award progress / endgame VP /
 *      standing field rules. Pure re-grouping — no fact is invented here and
 *      none is re-derived (cross-cutting invariant: read-only projections).
 *
 * No Vue / DOM. The translator is injected (the component passes the app's
 * `translateText` family; specs pass a dictionary) so RU output is assertable.
 */

import {BoardFact, BoardFactDelta, BoardFactGroup, BoardFactSeverity, BoardFactTiming,
  BoardPlacementKind, BoardPlacementPreview, groupFactsByRecipient} from '@/common/boards/BoardInformationFacts';
import {Message} from '@/common/logs/Message';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlacementEffect} from '@/common/models/PlayerInputModel';
import {TileType, isSpecialTile} from '@/common/TileType';
import {canonicalTileName} from '@/client/console/consolePlacementNextStep';

/** Translate an English key, interpolating `${0}`/`${1}` from `params`. */
export type DossierTranslator = (key: string, params?: ReadonlyArray<string>) => string;

/**
 * The prompt's SHAPE — what lands and who drives it (the `SelectSpaceModel`
 * bits the identity reads). Lives here (pure TS) so the shell and the panel
 * share it without a type import from a .vue file (the mochapack trap).
 */
export type PlacementShape = {
  tileType?: TileType;
  placementType?: BoardPlacementKind;
  placementEffect?: PlacementEffect;
  sourceCard?: CardName;
};

/**
 * A structurally-known exchange behind this placement (convert plants — the
 * one placement whose price is an action cost, not a cell fact). Rendered as
 * the compact `N [icon] → [tile]` formula instead of the sentence title.
 */
export type PlacementConversion = {
  /** How many units are spent (the live, discount-adjusted price). */
  amount: number;
  /** Resource icon key of the spent side (`'plants'`). */
  icon: string;
};

/**
 * The identity line's SIZE TIER, chosen by length. Three steps, calibrated
 * against the whole tile-name corpus in the real font at the real column
 * width (`tests/e2e/console-placement-title-measure.spec.ts`) — never by eye
 * on a convenient sample: at 4K TV «Генераторы магнитного поля» took three
 * lines in the two-step ladder while «ОЗЕЛЕНЕНИЕ» looked perfect.
 */
export type PlacementTitleTier = 'base' | 'long' | 'dense';

export function placementTitleTier(title: string): PlacementTitleTier {
  // MEASURED at 4K TV against a 666 px title column (the probe prints the
  // table): base holds 15 characters on one line, long 22 — beyond that only
  // dense does. Cyrillic sets wider than Latin, so the thresholds are read
  // off the RU corpus and the Latin names simply get a quieter tier than they
  // strictly need.
  if (title.length > 22) {
    return 'dense';
  }
  return title.length > 15 ? 'long' : 'base';
}

export type PlacementIdentity = {
  /** The translated OBJECT name — the panel's big title. */
  title: string;
  /** The size tier the title renders in (see {@link placementTitleTier}). */
  tier: PlacementTitleTier;
  /** TRUE for a named special tile (drives the quiet «особый тайл» qualifier). */
  special: boolean;
  /** The tile whose art the identity swatch draws. Absent → no swatch (marker). */
  tileType?: TileType;
  /**
   * The server sentence, demoted — or `''` when it would only repeat what the
   * identity block already says (generic «Select space for X tile» titles, and
   * any title while the conversion formula carries the same information).
   */
  actionLine: string;
};

/** The three ordinary tiles name their type; the noun is the whole title. */
const ORDINARY_TITLE: Partial<Record<TileType, string>> = {
  [TileType.GREENERY]: 'Greenery',
  [TileType.CITY]: 'City',
  [TileType.OCEAN]: 'Ocean',
};

const KIND_TITLE: Partial<Record<BoardPlacementKind, string>> = {
  'greenery': 'Greenery',
  'city': 'City',
  'ocean': 'Ocean',
  'upgradeable-ocean': 'Ocean',
  'upgradeable-ocean-new-holland': 'Ocean',
};

/**
 * Generic prompt titles that say nothing beyond «place the tile the panel
 * already names». Compared TRANSLATED against the translated live title —
 * a raw-key comparison would silently die on `Message` titles, whose
 * `.message` i18n mutates in place on first render (invariant 1).
 */
const GENERIC_TITLE_KEYS: ReadonlyArray<string> = [
  'Select space for greenery tile',
  'Select space for city tile',
  'Select space for ocean tile',
  'Select space for city',
  'Select space for special city tile',
  'Select a space for a tile',
];

/** Parameterized generic titles — the param is the card / tile the identity
 *  block (title + source chip) already carries. */
const GENERIC_TITLE_PARAM_KEYS: ReadonlyArray<string> = [
  'Select space for ${0} tile',
  'Select space for ${0}',
];

export function placementIdentity(opts: {
  /** The live prompt title, ALREADY TRANSLATED by the caller (string titles
   *  via translateText, Message titles via translateMessage). */
  translatedTitle: string,
  tileType: TileType | undefined,
  placementType: BoardPlacementKind | undefined,
  placementEffect: PlacementEffect | undefined,
  sourceCard: CardName | undefined,
  /** A conversion formula is shown — the title is its sentence twin. */
  hasConversion: boolean,
  translate: DossierTranslator,
}): PlacementIdentity {
  const {tileType, translate} = opts;
  const special = isSpecialTile(tileType);

  let title: string;
  let swatch: TileType | undefined = tileType;
  if (tileType !== undefined) {
    const ordinary = ORDINARY_TITLE[tileType];
    // `canonicalTileName` covers every NAMED tile (specials, hazards); an
    // unknown enum value off a newer server degrades to the kind fallback.
    const named = ordinary === undefined ? canonicalTileName(tileType) : undefined;
    title = ordinary !== undefined ? translate(ordinary) :
      named !== undefined ? translate(named) :
        translate(KIND_TITLE[opts.placementType ?? 'land'] ?? 'Tile');
  } else if (opts.placementEffect !== undefined && opts.placementEffect !== 'tile') {
    // A claim / a camp move puts a MARKER down — no tile, no swatch.
    title = translate('Marker');
    swatch = undefined;
  } else {
    title = translate(KIND_TITLE[opts.placementType ?? 'land'] ?? 'Tile');
    swatch = swatchForKind(opts.placementType);
  }

  return {
    title,
    tier: placementTitleTier(title),
    special,
    tileType: swatch,
    actionLine: actionLineOf(opts, title),
  };
}

/** A kind-only prompt (no tileType) still knows which ordinary art lands.
 *  Exported: the board reticle projects the SAME resolution (a convert-plants
 *  greenery arrives as `placementType: 'greenery'` with no tileType). */
export function swatchForKind(kind: BoardPlacementKind | undefined): TileType | undefined {
  switch (kind) {
  case 'greenery': return TileType.GREENERY;
  case 'city': return TileType.CITY;
  case 'ocean': return TileType.OCEAN;
  default: return undefined;
  }
}

/**
 * The demoted server sentence — `''` when redundant. Degrades SAFELY: if a
 * candidate rendering doesn't match byte-for-byte (an exotic locale, a
 * mutated Message), the line simply shows — a redundant caption, never a
 * lost constraint.
 */
function actionLineOf(opts: {
  translatedTitle: string,
  tileType: TileType | undefined,
  sourceCard: CardName | undefined,
  hasConversion: boolean,
  translate: DossierTranslator,
}, objectTitle: string): string {
  const t = opts.translatedTitle.trim();
  if (t === '' || opts.hasConversion) {
    return '';
  }
  const {translate} = opts;
  const candidates: Array<string> = GENERIC_TITLE_KEYS.map((k) => translate(k));
  const params: Array<string> = [];
  if (opts.sourceCard !== undefined) {
    params.push(translate(opts.sourceCard));
  }
  const named = canonicalTileName(opts.tileType);
  if (named !== undefined) {
    params.push(translate(named));
  }
  for (const key of GENERIC_TITLE_PARAM_KEYS) {
    for (const p of params) {
      candidates.push(translate(key, [p]));
    }
  }
  // The title that IS the object's name (a bespoke «Озеленение» prompt).
  candidates.push(objectTitle);
  return candidates.some((c) => c.trim() === t) ? '' : t;
}

// ── sections ─────────────────────────────────────────────────────────

export type DossierSectionKey = 'effect' | 'gain' | 'others' | 'tile' | 'progress' | 'endgame' | 'rules';

/** One recipient's block inside «Получат другие игроки». */
export type DossierRecipientGroup = {
  key: string;
  recipient: BoardFactGroup['recipient'];
  rows: ReadonlyArray<DossierRow>;
};

export type DossierSection = {
  key: DossierSectionKey;
  /** English i18n key of the section head. */
  titleKey: string;
  /** The RENDERED lines (aggregated + compacted) — what the panel draws. */
  rows: ReadonlyArray<DossierRow>;
  /** Only the `others` section groups by recipient (player dot + name). */
  groups?: ReadonlyArray<DossierRecipientGroup>;
  /** Timings the section head already states — rows drop the matching tag. */
  stated: ReadonlyArray<BoardFactTiming>;
  /**
   * The section's own TOTAL, rendered beside its head. Today only the endgame
   * block earns one: what the player actually wants from it is «how many VP is
   * THIS cell worth», which is a sum the rows already contain but never state.
   */
  total?: number;
};

/**
 * The viewer's endgame VP from this placement — the sum of the rows in the
 * endgame block, and ONLY honest because the server has already partitioned
 * another player's scoring into `recipientFacts` (`classifyPlacementFacts`
 * tests `isOther` BEFORE the endgame branch). Never a re-derivation: it adds
 * up numbers the panel is showing.
 */
export function endgameVpTotal(facts: ReadonlyArray<BoardFact>): number | undefined {
  const scoring = facts
    .map((f) => f.vp)
    .filter((vp): vp is NonNullable<BoardFact['vp']> => vp !== undefined);
  // A total that repeats the single row above it is noise, not information.
  if (scoring.length < 2) {
    return undefined;
  }
  const sum = scoring.reduce((acc, vp) => acc + (vp.to - vp.from), 0);
  return sum === 0 ? undefined : sum;
}

// ── the compact vocabulary ───────────────────────────────────────────
//
// A placement panel states CONSEQUENCES; the full rule is one press away
// (`L3 Источник`), and the desktop hover popover keeps the server's own long
// wording. So the console shortens a known fact to a label a couch player
// reads in one glance — «Рейтинг терраформирования» → «РТ», «Озеленение
// приносит очки в конце игры» → «Сам тайл».
//
// KEYED ON THE FACT'S ENGLISH TITLE, deliberately. A `BoardFact` arrives as
// plain JSON off `/board-cell-preview` and its `title` is a STRING key — the
// i18n directive translates DOM text nodes, never the object — so unlike a
// `waitingFor` prompt title (a `Message` mutated in place, cross-cutting
// invariant 1) this key is stable for the payload's whole life. A `Message`
// title (a card-driven fact) never matches and keeps the server's text, which
// is also the fallback for anything this table has not met.

/**
 * A POOL's own name («Производство M€», «Растения»). Used for an aggregated
 * row AND as the fallback label of any single fact that moves a known pool:
 * the icon says which pool, the production frame says which of the two, so
 * the label must not repeat either — and must never be a cut-off sentence.
 */
const POOL_LABELS: Readonly<Record<string, string>> = {
  megacredits: 'M€',
  steel: 'Steel',
  titanium: 'Titanium',
  plants: 'Plants',
  energy: 'Energy',
  heat: 'Heat',
  tr: 'TR',
  cards: 'Cards',
  oxygen: 'Oxygen',
  temperature: 'Temperature',
  oceans: 'Oceans',
};

const COMPACT_TITLES: Readonly<Record<string, string>> = {
  // The terraforming rating is the console's most repeated row.
  'Terraform rating': 'TR',
  'Raises oxygen': 'Oxygen',
  'Raises temperature': 'Temperature',
  'Raises the ocean parameter': 'Oceans',
  'Adjacent to ocean': 'Next to an ocean',
  'Clears the hazard': 'Hazard cleared',
  'Build here to clear it': 'Hazard cleared',
  // The placed tile's own standing adjacency interaction (Ares). The section
  // head already says WHEN («ПРИ РАЗМЕЩЕНИИ РЯДОМ»), so the row names only
  // WHAT — the full trigger→outcome sentence is the row's own note.
  'Your tile will grant an adjacency bonus': 'Bonus to the neighbour',
  'Your tile will impose an adjacency cost': 'Adjacency cost',
  // Endgame scoring — the FACT for the chosen cell, not the rule behind it.
  'Greenery scores at game end': 'The tile itself',
  'Adjacent city scores at game end': 'Adjacent cities',
  'City will score for adjacent greeneries': 'Adjacent greeneries',
  'City scores for adjacent greeneries': 'Adjacent greeneries',
  'Capital will score for adjacent oceans': 'Adjacent oceans',
  'Capital scores for adjacent oceans': 'Adjacent oceans',
  'Commercial District will score for adjacent cities': 'Adjacent cities',
  'Commercial District scores for adjacent cities': 'Adjacent cities',
};

/** The compact i18n key for a fact's label — the server's own when unknown. */
export function compactTitleKey(fact: BoardFact): string | Message {
  if (typeof fact.title !== 'string') {
    return poolFallback(fact) ?? fact.title;
  }
  return COMPACT_TITLES[fact.title] ?? poolFallback(fact) ?? fact.title;
}

/**
 * A fact the table has not met, whose delta moves a KNOWN POOL from a known
 * value, is named by the POOL — «Производство M€ 47 → 48», not «Производство
 * M€ за стандартный проект „Город"» cut off mid-word. Nothing is lost: the
 * icon (and the production frame) says which pool, the row's source chip or
 * the panel's own «ИСТОЧНИК» line says whose rule it is, and the full
 * sentence is one press away on L3.
 *
 * A pool-LESS delta (a card resource, a one-off cell bonus) keeps its title:
 * there the title is the only thing naming what happens.
 */
function poolFallback(fact: BoardFact): string | undefined {
  const d = fact.delta;
  if (d === undefined || d.current === undefined) {
    return undefined;
  }
  return POOL_LABELS[d.icon];
}

// ── rows ─────────────────────────────────────────────────────────────

/** One reason behind an aggregated value — «Город иммигрантов +1». */
export type DossierReason = {
  key: string;
  /** i18n key (or a Message) naming the source / the effect. */
  label: string | Message;
  /** The signed contribution, already formatted («+1», «−2»). */
  amount: string;
};

/**
 * ONE rendered line of the dossier. The component makes no decisions: label
 * left, value right, an optional compact breakdown under it.
 */
export type DossierRow = {
  key: string;
  label: string | Message;
  /** i18n params for the label (a server title may carry `${0}`). */
  params?: ReadonlyArray<string>;
  severity: BoardFactSeverity;
  /** How many facts this row stands for — rendered as «×N» past 1. */
  count: number;
  delta?: BoardFactDelta;
  vp?: number;
  progress?: {from: number, to: number, target?: number};
  /** The compact breakdown of an aggregated value. */
  reasons: ReadonlyArray<DossierReason>;
  /** The ONE secondary line (a forced loss explains itself). */
  note?: {text: string | Message, params?: ReadonlyArray<string>};
  /** A source chip, when it adds information the label does not carry. */
  source?: string;
  timingKey?: string;
};

function signed(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

/** The signed contribution of a delta (a `cost` counts against the pool). */
function deltaAmount(delta: BoardFactDelta): number {
  return delta.direction === 'cost' ? -delta.amount : delta.amount;
}

/**
 * The aggregation key. Two facts merge only when they move the SAME pool from
 * the SAME starting value in the same direction — then, and only then, is
 * `current + Σ` the number the commit will produce. A row whose `current` the
 * server did not send (a pool-less gain) never merges: there is nothing to add
 * up honestly.
 */
function aggregationKey(fact: BoardFact, labelKey: string): string | undefined {
  const d = fact.delta;
  if (d !== undefined && d.current !== undefined) {
    return `d|${d.icon}|${d.production === true}|${d.direction}|${d.current}|${d.unit ?? ''}`;
  }
  if (fact.vp !== undefined) {
    // Several adjacent cities are ONE statement about this cell: «Соседние
    // города ×2 · +2 ПО», never two identical lines.
    return `v|${labelKey}`;
  }
  return undefined;
}

/** A reason's own name: the SOURCE card when there is one, else its label. */
function reasonLabel(fact: BoardFact): string | Message {
  const label = fact.source?.label;
  if (label !== undefined && fact.source?.type !== 'board-cell' && fact.source?.type !== 'map-rule') {
    return label;
  }
  return compactTitleKey(fact);
}

/**
 * The section's facts as RENDERED ROWS: identical parameters collapse into one
 * change-vector with a compact breakdown, repeated statements collapse into a
 * counted one, and every label passes through the compact vocabulary.
 *
 * The panel used to print «Производство M€ за стандартный проект „Город"
 * 47 → 48» and «Город размещён где угодно 47 → 48» — two four-line rows for
 * one parameter, and BOTH readings were wrong, because the commit lands on 49.
 */
export function buildDossierRows(facts: ReadonlyArray<BoardFact>,
  stated: ReadonlyArray<BoardFactTiming> = []): Array<DossierRow> {
  const order: Array<string> = [];
  const groups = new Map<string, Array<BoardFact>>();
  facts.forEach((fact, i) => {
    const labelKey = typeof compactTitleKey(fact) === 'string' ? String(compactTitleKey(fact)) : `m${i}`;
    const key = aggregationKey(fact, labelKey) ?? `s|${i}`;
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [fact]);
      order.push(key);
    } else {
      bucket.push(fact);
    }
  });

  return order.map((key) => {
    const members = groups.get(key) ?? [];
    const head = members[0];
    return members.length > 1 ? mergedRow(key, members, stated) : singleRow(head, stated);
  });
}

/**
 * A CARD/CORP trigger that will NOT fire on this cell (`noEffectHere` —
 * Mining Guild off ore, Solar Farm off plants). The fork's «no silent loss»
 * rule keeps the STATEMENT: the title names exactly what does not happen and
 * the source chip names whose rule it is. What the console drops is the
 * DESCRIPTION — a restatement of the card's general rule («Эта корпорация
 * повышает производство стали только за…»), which is the «повтор полного
 * текста карты» a decision panel does not owe. Structural: the trigger
 * categories + no value of any kind.
 */
function isSkippedTriggerNote(fact: BoardFact): boolean {
  return (fact.category === 'card-trigger' || fact.category === 'corporation-trigger') &&
    fact.timing === 'rule' &&
    fact.delta === undefined && fact.vp === undefined && fact.progress === undefined;
}

function singleRow(fact: BoardFact, stated: ReadonlyArray<BoardFactTiming>): DossierRow {
  if (isSkippedTriggerNote(fact)) {
    return {
      key: fact.id,
      label: fact.title,
      params: fact.params,
      severity: fact.severity,
      count: 1,
      reasons: [],
      source: rowSourceLabel(fact),
      timingKey: rowTimingKey(fact, stated),
    };
  }
  return {
    key: fact.id,
    label: compactTitleKey(fact),
    params: fact.params,
    severity: fact.severity,
    count: 1,
    delta: fact.delta,
    vp: fact.vp !== undefined ? fact.vp.to - fact.vp.from : undefined,
    progress: fact.progress,
    reasons: [],
    note: fact.description !== undefined ? {text: fact.description, params: fact.params} : undefined,
    source: rowSourceLabel(fact),
    timingKey: rowTimingKey(fact, stated),
  };
}

function mergedRow(key: string, members: ReadonlyArray<BoardFact>, stated: ReadonlyArray<BoardFactTiming>): DossierRow {
  const head = members[0];
  const worst = members.find((f) => f.severity === 'danger') ??
    members.find((f) => f.severity === 'warning') ?? head;
  const reasons: Array<DossierReason> = members.map((f, i) => ({
    key: `${f.id}:${i}`,
    label: reasonLabel(f),
    amount: signed(f.delta !== undefined ? deltaAmount(f.delta) : (f.vp !== undefined ? f.vp.to - f.vp.from : 0)),
  }));

  if (key.startsWith('v|')) {
    // A repeated STATEMENT: one line, a count, and the summed points.
    return {
      key: `agg:${key}`,
      label: compactTitleKey(head),
      severity: head.severity,
      count: members.length,
      vp: members.reduce((acc, f) => acc + ((f.vp?.to ?? 0) - (f.vp?.from ?? 0)), 0),
      reasons: [],
      timingKey: rowTimingKey(head, stated),
    };
  }

  // A shared POOL: one honest change-vector plus what makes it up.
  const d = head.delta as BoardFactDelta;
  const total = members.reduce((acc, f) => acc + (f.delta !== undefined ? deltaAmount(f.delta) : 0), 0);
  const current = d.current ?? 0;
  return {
    key: `agg:${key}`,
    label: POOL_LABELS[d.icon] ?? compactTitleKey(head),
    severity: worst.severity,
    count: 1,
    delta: {
      icon: d.icon,
      amount: Math.abs(total),
      direction: total < 0 ? 'cost' : 'gain',
      current,
      resulting: current + total,
      unit: d.unit,
      production: d.production,
    },
    reasons,
  };
}

/**
 * The categories of `ruleFacts` that describe the PLACED TILE's own standing
 * interaction with future neighbours — the Ares adjacency grant/toll, and the
 * owner-benefit family should it ever reach a placement payload. STRUCTURAL
 * (the engine's own category), never a title match. Everything else in
 * `ruleFacts` stays a field rule: what the SQUARE is (external area, a
 * deflection-zone note, «no printed bonus when covering»).
 */
const TILE_STANDING_CATEGORIES: ReadonlyArray<BoardFact['category']> =
  ['ares-adjacency-bonus', 'tile-owner-benefit'];

/**
 * The panel's reading order. THE CELL'S OWN TOLL comes first (a forced loss
 * must never sit below the fold), then the player's result, others' cuts, the
 * placed tile's standing adjacency interaction, standing progress, endgame VP
 * and the remaining field rules last.
 */
export function dossierSections(
  preview: BoardPlacementPreview,
  viewerColor?: Color): Array<DossierSection> {
  const out: Array<DossierSection> = [];
  const section = (key: DossierSectionKey, titleKey: string,
    facts: ReadonlyArray<BoardFact>, stated: ReadonlyArray<BoardFactTiming>): DossierSection =>
    ({key, titleKey, rows: buildDossierRows(facts, stated), stated});

  const effect = [...preview.costFacts, ...preview.warningFacts];
  if (effect.length > 0) {
    out.push(section('effect', 'Cell effect', effect, ['cost', 'warning']));
  }
  if (preview.immediateFacts.length > 0) {
    out.push(section('gain', 'You receive', preview.immediateFacts, ['immediate', 'on-confirm']));
  }
  if (preview.recipientFacts.length > 0) {
    // Aggregation is PER RECIPIENT: two players' identical gains are two
    // different statements and may never be summed into one.
    const groups = groupFactsByRecipient(preview.recipientFacts, viewerColor)
      .map((g) => ({key: g.key, recipient: g.recipient, rows: buildDossierRows(g.facts, [])}));
    out.push({
      key: 'others', titleKey: 'Other players receive',
      rows: groups.flatMap((g) => g.rows), groups, stated: [],
    });
  }
  // «ПРАВИЛА ПОЛЯ» used to be one bag: the tile's own future-adjacency
  // mechanic (a TRIGGER → OUTCOME the player is buying) sat in it beside
  // passive square notes, under one generic head — which is how the Natural
  // Preserve's whole point ended up an ellipsis. The split is by CATEGORY.
  const standing = preview.ruleFacts.filter((f) => TILE_STANDING_CATEGORIES.includes(f.category));
  const fieldRules = preview.ruleFacts.filter((f) => !TILE_STANDING_CATEGORIES.includes(f.category));
  if (standing.length > 0) {
    out.push(section('tile', 'When placed adjacent', standing, ['rule']));
  }
  const progress = preview.progressFacts ?? [];
  if (progress.length > 0) {
    out.push(section('progress', 'Milestones and awards', progress, []));
  }
  if (preview.futureScoringFacts.length > 0) {
    out.push({
      ...section('endgame', 'At game end', preview.futureScoringFacts, ['endgame']),
      total: endgameVpTotal(preview.futureScoringFacts),
    });
  }
  if (fieldRules.length > 0) {
    out.push(section('rules', 'Field rules', fieldRules, ['rule']));
  }
  return out;
}

/** Nothing beyond the placement itself — the honest one-liner's key. */
export function dossierEmptyKey(preview: BoardPlacementPreview): string | undefined {
  if (dossierSections(preview).length > 0) {
    return undefined;
  }
  return preview.placesTile === false ?
    'Nothing happens beyond placing the marker.' :
    'Nothing happens beyond placing the tile.';
}

// ── rows ─────────────────────────────────────────────────────────────

/**
 * The micro progress track for a milestone standing (`1 → 2 / 3`): one cell
 * per point up to the claim threshold. `undefined` when there is no threshold
 * (an award standing — a plain counter) or when it would not read as a track
 * (a long threshold, or a standing already past it).
 */
export function progressTrack(
  progress: {from: number, to: number, target?: number} | undefined,
): Array<'filled' | 'gained' | 'empty'> | undefined {
  if (progress === undefined || progress.target === undefined) {
    return undefined;
  }
  const {from, to, target} = progress;
  if (target < 2 || target > 8 || from < 0 || to < from || to > target) {
    return undefined;
  }
  const cells: Array<'filled' | 'gained' | 'empty'> = [];
  for (let i = 0; i < target; i++) {
    cells.push(i < from ? 'filled' : i < to ? 'gained' : 'empty');
  }
  return cells;
}

/**
 * The small timing tag beside a row's value — only when the row's timing says
 * something its section head does not (a `future` fact inside «В КОНЦЕ ИГРЫ»,
 * an endgame VP inside an opponent's group). Mirrors the desktop fact row.
 */
export function rowTimingKey(fact: BoardFact, stated: ReadonlyArray<BoardFactTiming>): string | undefined {
  if (fact.progress !== undefined || stated.includes(fact.timing)) {
    return undefined;
  }
  switch (fact.timing) {
  case 'endgame': return 'At game end';
  case 'future': return 'Later';
  case 'warning': return 'Warning';
  default: return undefined;
  }
}

/**
 * The source chip under a row — only when it ADDS information (a card /
 * corporation the row's own text doesn't name; a board-cell or map-rule
 * source repeats the section it sits in). Mirrors the desktop fact row.
 */
export function rowSourceLabel(fact: BoardFact): string | undefined {
  const source = fact.source;
  if (source === undefined || source.label === undefined) {
    return undefined;
  }
  if (source.type === 'board-cell' || source.type === 'map-rule') {
    return undefined;
  }
  return typeof source.label === 'string' ? source.label : undefined;
}
