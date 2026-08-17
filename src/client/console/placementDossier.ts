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

import {BoardFact, BoardFactGroup, BoardFactTiming, BoardPlacementKind, BoardPlacementPreview,
  groupFactsByRecipient} from '@/common/boards/BoardInformationFacts';
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

/** A kind-only prompt (no tileType) still knows which ordinary art lands. */
function swatchForKind(kind: BoardPlacementKind | undefined): TileType | undefined {
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

export type DossierSectionKey = 'effect' | 'gain' | 'others' | 'progress' | 'endgame' | 'rules';

export type DossierSection = {
  key: DossierSectionKey;
  /** English i18n key of the section head. */
  titleKey: string;
  facts: ReadonlyArray<BoardFact>;
  /** Only the `others` section groups by recipient (player dot + name). */
  groups?: ReadonlyArray<BoardFactGroup>;
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

/**
 * The panel's reading order. THE CELL'S OWN TOLL comes first (a forced loss
 * must never sit below the fold), then the player's result, others' cuts,
 * standing progress, endgame VP and the field rules last.
 */
export function dossierSections(
  preview: BoardPlacementPreview,
  viewerColor?: Color): Array<DossierSection> {
  const out: Array<DossierSection> = [];
  const effect = [...preview.costFacts, ...preview.warningFacts];
  if (effect.length > 0) {
    out.push({key: 'effect', titleKey: 'Cell effect', facts: effect, stated: ['cost', 'warning']});
  }
  if (preview.immediateFacts.length > 0) {
    out.push({key: 'gain', titleKey: 'You receive', facts: preview.immediateFacts, stated: ['immediate', 'on-confirm']});
  }
  if (preview.recipientFacts.length > 0) {
    out.push({
      key: 'others', titleKey: 'Other players receive', facts: preview.recipientFacts,
      groups: groupFactsByRecipient(preview.recipientFacts, viewerColor), stated: [],
    });
  }
  const progress = preview.progressFacts ?? [];
  if (progress.length > 0) {
    out.push({key: 'progress', titleKey: 'Milestones and awards', facts: progress, stated: []});
  }
  if (preview.futureScoringFacts.length > 0) {
    out.push({
      key: 'endgame', titleKey: 'At game end', facts: preview.futureScoringFacts,
      stated: ['endgame'], total: endgameVpTotal(preview.futureScoringFacts),
    });
  }
  if (preview.ruleFacts.length > 0) {
    out.push({key: 'rules', titleKey: 'Field rules', facts: preview.ruleFacts, stated: ['rule']});
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
