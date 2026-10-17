/*
 * THE CELL DOSSIER — the pure view-model of the console's board column when it
 * reads a CELL (Turmoil Redux TR67 «КЛЕТКА — ОДНО ДОСЬЕ»).
 *
 * The column used to speak two languages: a placement was a rem-native dossier
 * of sections and rows (`placementDossier.ts`), an inspection (L3) a desktop
 * fact list scaled up by `zoom`. One component, four modes, two rhythms, two
 * kinds of «+2» chip. This module puts the inspection on the placement's
 * chassis — the SAME `DossierSection` / `DossierRow` shapes, built by the SAME
 * `buildDossierRows`, sectioned by INTENT — and gives the cell a FACE:
 *
 *   1. IDENTITY — the OBJECT the cell holds (the tile's own name, a special
 *      tile by name, an empty square by its kind), never a sentence.
 *   2. PORTRAIT — the square as the server models it (`BoardCellInfo.portrait`:
 *      its printed bonus as data, the piece on top, the owner, the card that
 *      put it there) and its SIX NEIGHBOURS in the engine's own geometry, each
 *      lit by the same relation tones the board draws (`relationToneOf` over
 *      the facts' `spaces`) with what ONE neighbour means for this cell (the
 *      fact's `each`, or the fact itself when it names one cell).
 *   3. SECTIONS — the hover's facts regrouped by intent, in the placement's
 *      decision order: the cell's own toll (a hazard) → what a tile placed
 *      HERE receives → what lies UNDER the tile → what a tile placed BESIDE
 *      this one receives (the cell's standing mechanic) → the endgame, by
 *      recipient → the field rules.
 *
 * Nothing is computed that the server did not state: no adjacency, no rule,
 * no score (invariant 7). No Vue / DOM.
 */

import {
  BoardCellInfo, BoardFact, BoardFactDelta, BoardFactTiming, CellPortrait, CellPortraitPiece, groupFactsByRecipient,
} from '@/common/boards/BoardInformationFacts';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {Message} from '@/common/logs/Message';
import {
  DossierRecipientGroup, DossierSection, DossierSectionKey, DossierTranslator, PlacementTitleTier, buildDossierRows, placementTitleTier,
} from '@/client/console/placementDossier';
import {PlacementRelationTone, TONE_RANK, relationToneOf} from '@/client/console/placementRelations';

// ── identity ─────────────────────────────────────────────────────────

export type CellIdentity = {
  /** The translated OBJECT name — the column's big title. */
  title: string;
  tier: PlacementTitleTier;
  /** A named special tile — the quiet «особый тайл» qualifier. */
  special: boolean;
  /** The quiet one-line passive description (the server's), '' when none. */
  line: string;
};

function text(v: string | Message | undefined, translate: DossierTranslator, translateMessage: (m: Message) => string): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translate(v) : translateMessage(v);
}

/**
 * The cell's OBJECT: a special tile by its own name (Capital, Mohole Area), an
 * ordinary tile by its kind (the server's header — «Озеленение», «Город»,
 * «Стопка городов»), an empty square by its kind («Суша с бонусом»).
 */
export function cellIdentity(info: BoardCellInfo, translate: DossierTranslator, translateMessage: (m: Message) => string): CellIdentity {
  const status = info.status;
  const named = status.special === true ? text(status.tileLabel, translate, translateMessage) : '';
  const title = named !== '' ? named : text(status.header, translate, translateMessage) || translate('Board cell');
  return {
    title,
    tier: placementTitleTier(title),
    special: status.special === true,
    line: text(info.description, translate, translateMessage),
  };
}

// ── sections ─────────────────────────────────────────────────────────

/** The cell's own TOLL — the hazard standing on it (its identity, what it charges). */
const EFFECT_IDS: ReadonlyArray<string> = ['hazard-identity'];
/** What a tile placed BESIDE this one receives — the cell's standing mechanic for its neighbours. */
const STANDING_IDS: ReadonlyArray<string> = ['hazard-adjacency', 'ocean-neighbour-rule'];

function sectionOf(fact: BoardFact): DossierSectionKey {
  if (EFFECT_IDS.includes(fact.id)) {
    return 'effect';
  }
  if (STANDING_IDS.includes(fact.id) || fact.category === 'ares-adjacency-bonus' || fact.category === 'tile-owner-benefit') {
    return 'tile';
  }
  if (fact.category === 'uncovered-bonus') {
    return 'uncovers';
  }
  if (fact.category === 'printed-placement-bonus' || fact.category === 'hazard-cleanup' ||
      (fact.category === 'ocean-adjacency-bonus' && fact.timing !== 'rule')) {
    return 'gain';
  }
  if (fact.vp !== undefined || fact.category === 'city-greenery-scoring' || fact.category === 'future-scoring') {
    return 'endgame';
  }
  return 'rules';
}

/** The inspection's sections in the placement's decision order. */
const ORDER: ReadonlyArray<{key: DossierSectionKey, titleKey: string, stated: ReadonlyArray<BoardFactTiming>}> = [
  {key: 'effect', titleKey: 'Cell effect', stated: ['rule', 'cost', 'warning']},
  {key: 'gain', titleKey: 'When placing here', stated: ['immediate', 'on-confirm', 'rule']},
  {key: 'uncovers', titleKey: 'Under the tile', stated: ['rule', 'future']},
  {key: 'tile', titleKey: 'When placed adjacent', stated: ['rule']},
  {key: 'endgame', titleKey: 'At game end', stated: ['endgame']},
  {key: 'rules', titleKey: 'Field rules', stated: ['rule']},
];

/**
 * A covered bonus row is titled by its SECTION («Под тайлом») — the row says
 * WHAT lies there instead («Бонус клетки»), never the section's words twice.
 */
function relabel(fact: BoardFact): BoardFact {
  return fact.category === 'uncovered-bonus' && fact.title === 'Under the tile' ? {...fact, title: 'Cell bonus'} : fact;
}

/**
 * A reserved / restricted / volcanic square's rule (the engine's own fact ids) keeps its TITLE when the cell carries curated LORE: the lore at the foot is that
 * very explanation in full, and the rule's own sentence beside it said it a second time (the Noctis square scrolled on 4K).
 */
const LORE_EXPLAINS: ReadonlyArray<string> = ['reserved-noctis', 'reserved-colony', 'restricted', 'volcanic'];
function quieted(fact: BoardFact, lore: boolean): BoardFact {
  if (!lore || !LORE_EXPLAINS.includes(fact.id) || fact.description === undefined) {
    return fact;
  }
  const {description: _dropped, ...rest} = fact;
  return rest;
}

/**
 * THE INSPECTION'S BODY — the hover's facts on the placement's chassis. The
 * endgame block is grouped by RECIPIENT (the city's owner scores the greenery
 * beside it — perhaps a rival), the same `groups` the placement's «others»
 * block renders; every other block is plain rows.
 */
export function cellDossierSections(info: BoardCellInfo, viewerColor?: Color, opts: {lore?: boolean} = {}): Array<DossierSection> {
  const buckets = new Map<DossierSectionKey, Array<BoardFact>>();
  for (const fact of info.facts) {
    const key = sectionOf(fact);
    const list = buckets.get(key) ?? [];
    list.push(quieted(relabel(fact), opts.lore === true));
    buckets.set(key, list);
  }
  const out: Array<DossierSection> = [];
  for (const {key, titleKey, stated} of ORDER) {
    const facts = buckets.get(key);
    if (facts === undefined || facts.length === 0) {
      continue;
    }
    if (key === 'endgame') {
      const groups: Array<DossierRecipientGroup> = groupFactsByRecipient(facts, viewerColor)
        .map((g) => ({key: g.key, recipient: g.recipient, rows: buildDossierRows(g.facts, stated)}));
      out.push({key, titleKey, rows: groups.flatMap((g) => g.rows), groups, stated});
      continue;
    }
    out.push({key, titleKey, rows: buildDossierRows(facts, stated), stated});
  }
  return out;
}

// ── the portrait's own marks ─────────────────────────────────────────

/**
 * What the PORTRAIT states about the square besides its art — a few tracked
 * words on the hex, never rows: why it takes no ordinary tile, the water
 * under the city, the stack's height, a special tile, a square off the grid.
 */
export type CellMark = {key: string, params?: ReadonlyArray<string>};

export function cellMarks(info: BoardCellInfo): Array<CellMark> {
  const p = info.portrait;
  const out: Array<CellMark> = [];
  // A reserved square is NOT marked here: its field rule already states it as a row (with why), and the lore beside it
  // a third time — three voices for one fact made the Noctis square scroll on 4K. The hatched ground is its mark.
  if (info.status.external === true) {
    out.push({key: 'External area'});
  }
  if (p?.under !== undefined) {
    out.push({key: 'Ocean under the city'});
  }
  if (p?.stackHeight !== undefined) {
    out.push({key: 'Stack of ${0}', params: [String(p.stackHeight)]});
  }
  return out;
}

/**
 * The tile's OWN score at the end, for its owner — what the city / the
 * Capital / the greenery itself scores (the engine's `score-*` facts about
 * THIS tile), never what it gives a neighbour (`score-greenery-city-*` is the
 * neighbouring city's point). `undefined` when the tile scores nothing.
 */
export function cellOwnVp(info: BoardCellInfo): number | undefined {
  const own = info.facts.filter((f) => f.vp !== undefined && f.id.startsWith('score-') && !f.id.startsWith('score-greenery-city-'));
  if (own.length === 0) {
    return undefined;
  }
  return own.reduce((acc, f) => acc + ((f.vp?.to ?? 0) - (f.vp?.from ?? 0)), 0);
}

// ── the neighbour ring ───────────────────────────────────────────────

/** What ONE neighbour means for this cell — a resource chip, or points (and for whom, when not the viewer). */
export type CellRingChip = {delta?: BoardFactDelta, vp?: number, for?: Color};

export type CellRingSlot = {
  /** Clockwise from the top-left: 0 top-left · 1 top-right · 2 right · 3 bottom-right · 4 bottom-left · 5 left. */
  dir: number;
  /** The neighbour's piece; `undefined` = the board's edge (no hex is drawn). */
  piece?: CellPortraitPiece;
  /** The relation tone the board lights it with — the SAME classifier (`relationToneOf`). */
  tone?: PlacementRelationTone;
  chip?: CellRingChip;
};

function chipOf(fact: BoardFact, viewerColor: Color | undefined): CellRingChip | undefined {
  const r = fact.recipient;
  const forColor = (r.kind === 'player' || r.kind === 'tile-owner') && r.color !== viewerColor ? r.color : undefined;
  const one = (fact.spaces?.length ?? 0) === 1;
  if (fact.each?.delta !== undefined) {
    return {delta: fact.each.delta};
  }
  if (fact.each?.vp !== undefined) {
    return {vp: fact.each.vp, ...(forColor !== undefined ? {for: forColor} : {})};
  }
  if (one && fact.delta !== undefined) {
    return {delta: fact.delta};
  }
  if (one && fact.vp !== undefined && fact.vp.to !== fact.vp.from) {
    return {vp: fact.vp.to - fact.vp.from, ...(forColor !== undefined ? {for: forColor} : {})};
  }
  return undefined;
}

/**
 * The six neighbours as the ring draws them, each lit by the facts that name
 * it: the strongest tone wins (a cost is never masked — the board's rank), and
 * the chip is that fact's own statement about ONE cell. `[]` when the cell has
 * no neighbours (an off-Mars slot) or the payload predates the portrait.
 */
export function cellRing(portrait: CellPortrait | undefined, facts: ReadonlyArray<BoardFact>, viewerColor?: Color): Array<CellRingSlot> {
  if (portrait === undefined || portrait.neighbours.length === 0) {
    return [];
  }
  return portrait.neighbours.map((piece, dir): CellRingSlot => {
    if (piece === null) {
      return {dir};
    }
    let best: BoardFact | undefined;
    let bestTone: PlacementRelationTone | undefined;
    for (const fact of facts) {
      if (fact.spaces?.includes(piece.space) !== true) {
        continue;
      }
      const tone = relationToneOf(fact);
      if (bestTone === undefined || TONE_RANK[tone] < TONE_RANK[bestTone]) {
        best = fact;
        bestTone = tone;
      }
    }
    if (best === undefined || bestTone === undefined) {
      return {dir, piece};
    }
    const chip = chipOf(best, viewerColor);
    return {dir, piece, tone: bestTone, ...(chip !== undefined ? {chip} : {})};
  });
}

/** The set of neighbours the ring LIGHTS — the e2e's «field ≡ column» witness reads the same set off the board. */
export function litNeighbours(ring: ReadonlyArray<CellRingSlot>): Array<SpaceId> {
  return ring.filter((s) => s.piece !== undefined && s.tone !== undefined).map((s) => (s.piece as CellPortraitPiece).space);
}
