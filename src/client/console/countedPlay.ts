/*
 * THE COUNTED PLAY — «how many, and why» before the press (Turmoil Redux TR45
 * Composting Initiative: «1 microbe for each tile on Mars»; the class every
 * play counted off the table belongs to — TR23's colonies in play, TR43's
 * oceans, Insects, Satellites, …). Pure: the server counted everything
 * (`CardModel.countedPlay` ← `countedPlayEffects`, the play preview's own
 * chips; the census's composition in `ActionEffectBasis.parts`), this module
 * only decides how the three surfaces READ it:
 *   · the hand tile's forecast PLATE — one grammar with the Agenda walk's
 *     plate (TR42 К-H1): `handForecastPlate`, two readers;
 *   · the composer's «ПОЧЕМУ» block — `countedWhyOf`, the second reader of
 *     the block PL-156 built for the walk;
 *   · the inspector's «ДЛЯ ВАС» — `countedWhyRow`, the same reading as text.
 * Nothing here adds, divides or partitions: a number on screen is a number
 * the server sent.
 */
import {ActionEffect, ActionEffectBasis, ActionEffectBasisPartKind} from '@/common/models/ActionPreviewModel';
import {CardModel} from '@/common/models/CardModel';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {AltSecondaryTag} from '@/common/cards/render/AltSecondaryTag';
import {Tag} from '@/common/cards/Tag';
import {tagNameKey} from '@/common/cards/tagNames';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import type {ICardRenderItem} from '@/common/cards/render/Types';
import type {SpaceId} from '@/common/Types';

// ── THE HAND'S FORECAST PLATE ────────────────────────────────────────────────

/** One unit of the plate: an icon (on the production plate when it is a production step) and its number. */
export type HandPlateItem = {iconClass: string, production: boolean, amount: number, signed: boolean, upTo?: boolean, struck?: boolean};

/**
 * THE PLATE — «[★] 2» for a walk (TR42), «[microbe] +14» for a counted play.
 * `value` is the e2e hook's number (`data-hand-walk` / `data-hand-count`);
 * `zero` mutes the plate (a zero is a reading, never hidden); `more` counts
 * the counted goods past `HAND_PLATE_MAX_ITEMS` — named «ещё N», never dropped
 * (Productive Outpost's colony bonuses can be three goods and more).
 */
export type HandForecastPlate = {
  kind: 'walk' | 'count',
  items: ReadonlyArray<HandPlateItem>,
  value: number,
  zero: boolean,
  more: number,
  /**
   * THE RATING THE LAW WOULD REFUSE (RX42 UNMI Veto — `CardModel.ratingVetoed`): the steps the play promises and the
   * seat, first by rating, will not gain — the plate's LAST item, the rating struck. The number is the server's.
   */
  veto?: number,
};

/** At most this many counted units on one plate — a tile is a card, not a ledger (the composer holds the rest). */
export const HAND_PLATE_MAX_ITEMS = 2;

/**
 * The plate a hand card wears, or none. The WALK reader first (a card that
 * walks the Agenda says how far — its accepted plate, unchanged), then the
 * COUNTED reader: the first counted chips, each its icon and its signed number.
 */
export function handForecastPlate(card: CardModel): HandForecastPlate | undefined {
  const base = handForecastPlateOf(card);
  const veto = card.ratingVetoed?.steps;
  if (veto === undefined || veto <= 0) {
    return base;
  }
  // THE RATING THE LAW REFUSES (RX42): the plate's last item, struck — beside the count or alone.
  const struck: HandPlateItem = {iconClass: iconClassFor('tr'), production: false, amount: veto, signed: true, struck: true};
  if (base === undefined) {
    return {kind: 'count', items: [struck], value: veto, zero: false, more: 0, veto};
  }
  return {...base, items: [...base.items, struck], zero: false, veto};
}

function handForecastPlateOf(card: CardModel): HandForecastPlate | undefined {
  const walk = card.agendaWalk;
  if (walk !== undefined) {
    return {
      kind: 'walk',
      items: [{iconClass: 'resource_icon resource_icon--agenda-step', production: false, amount: walk.walked, signed: false}],
      value: walk.walked,
      zero: walk.walked === 0,
      more: 0,
    };
  }
  // A count the player CHOOSES (TR54): the ceiling on the printed «?» — «[?] up to +N», never six gains at once.
  const choice = card.countedChoice;
  if (choice !== undefined) {
    return {
      kind: 'count',
      items: [{iconClass: iconClassFor('wild'), production: false, amount: choice.max, signed: true, upTo: true}],
      value: choice.max,
      zero: choice.max === 0,
      more: 0,
    };
  }
  const counted = card.countedPlay;
  if (counted === undefined || counted.length === 0) {
    return undefined;
  }
  return {
    kind: 'count',
    items: counted.slice(0, HAND_PLATE_MAX_ITEMS).map((e) => ({
      iconClass: iconClassFor(e.icon),
      production: e.note === 'production',
      amount: e.direction === 'cost' ? -e.amount : e.amount,
      signed: true,
    })),
    value: counted[0].direction === 'cost' ? -counted[0].amount : counted[0].amount,
    zero: counted.every((e) => e.amount === 0),
    more: Math.max(0, counted.length - HAND_PLATE_MAX_ITEMS),
  };
}

/** «+14» / «−2» / «0» — a signed reading never prints «+0». */
export function signedAmount(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

// ── THE «ПОЧЕМУ» OF A COUNTED PLAY ───────────────────────────────────────────

/**
 * The printed GLYPH of a counted share and of the count itself — the SAME
 * render item the card face draws (`PremiumMechNode`), so «why» begins with
 * the icon the player read on the card. A kind with no glyph reads as words.
 */
export type CountedGlyph = ICardRenderItem;

/** One printed item, as the DSL would emit it (`amount: 1` — a single icon). */
function glyph(type: CardRenderItemType, extra: Partial<ICardRenderItem> = {}): CountedGlyph {
  return {is: 'item', type, amount: 1, ...extra} as CountedGlyph;
}

/** What each share of the census is drawn as — the board's own tile art (premium icons). */
export const PART_GLYPH: Readonly<Partial<Record<ActionEffectBasisPartKind, CountedGlyph>>> = {
  'city': glyph(CardRenderItemType.CITY),
  'greenery': glyph(CardRenderItemType.GREENERY),
  'ocean': glyph(CardRenderItemType.OCEANS),
  'special': glyph(CardRenderItemType.EMPTY_TILE_SPECIAL),
};

/** The share's WORD (its plural agrees with the count before it — `{a|b|c}` groups). */
export const PART_LABEL: Readonly<Record<ActionEffectBasisPartKind, string>> = {
  'city': '${0} {city|cities}',
  'greenery': '${0} {greenery|greeneries}',
  'ocean': '${0} {ocean|oceans}',
  'special': '${0} {special tile|special tiles}',
  'off-mars': '${0} off Mars',
  'hazard': '${0} {hazard|hazards}',
  'cube': '${0} {neutral cube|neutral cubes}',
};

/**
 * The glyph of the counted entity ITSELF — the card's printed «per X». The
 * census prints «a tile on Mars of ANY player»: the empty hex in the
 * «any player» frame with the «on Mars» corner (TR45's face, TR14's corner);
 * the player's own tiles drop the frame. A single-term count (PL-196) wears
 * the face's own item for its entity — the colony (TR23 «per colony in
 * play», framed: every player's), the ocean (TR43), the city, the greenery,
 * the tag the rule counts. The label is the server's `countableBasis` key — a
 * plain string, never a translated `Message`. A term with no printed item
 * (floaters, «resources on this card») reads as words; an OR of tags is a ROW
 * of glyphs (`countGlyphsOf`), never one.
 */
export function countGlyphOf(term: ActionEffectBasis): CountedGlyph | undefined {
  switch (term.label) {
  case 'Tiles on Mars':
    return glyph(CardRenderItemType.EMPTY_TILE, {anyPlayer: true, secondaryTag: AltSecondaryTag.MARS_TILE});
  case 'Your tiles on Mars':
    return glyph(CardRenderItemType.EMPTY_TILE, {secondaryTag: AltSecondaryTag.MARS_TILE});
  case 'Colonies in play':
    return glyph(CardRenderItemType.COLONIES, {anyPlayer: true});
  case 'Your colonies':
    return glyph(CardRenderItemType.COLONIES);
  case 'Oceans':
    return glyph(CardRenderItemType.OCEANS);
  case 'Cities':
  case 'Cities on Mars':
    return glyph(CardRenderItemType.CITY, {anyPlayer: true});
  case 'Your cities':
  case 'Your cities on Mars':
    return glyph(CardRenderItemType.CITY);
  case 'Greeneries':
    return glyph(CardRenderItemType.GREENERY, {anyPlayer: true});
  case 'Your greeneries':
    return glyph(CardRenderItemType.GREENERY);
  case 'Your tags':
  case 'Tags in play':
  case 'Opponent tags':
    return term.tag === undefined ? undefined : glyph(CardRenderItemType.TAG, {tag: term.tag, anyPlayer: term.label !== 'Your tags'});
  // The bespoke counted plays (`ICard.countedPlayForecast`) — each the glyph its card prints after the «/».
  case 'Your different tags':
    return glyph(CardRenderItemType.DIVERSE_TAG);
  case 'Cards with no tags':
    return glyph(CardRenderItemType.NO_TAGS, {amount: -1});
  case 'Events played by all players':
    return glyph(CardRenderItemType.TAG, {tag: Tag.EVENT, anyPlayer: true});
  case 'Empty areas next to your tiles':
    return glyph(CardRenderItemType.EMPTY_TILE);
  case 'Cards in hand':
    return glyph(CardRenderItemType.CARDS);
  }
  return undefined;
}

/**
 * The term's glyphs as the strip draws them — the ONE glyph of `countGlyphOf`, or, for an OR of tags (P85 — «per
 * planet tag»: the server's `tags`), the ROW of the tags it counts, in the card's order. Empty → the term reads as words.
 */
export function countGlyphsOf(term: ActionEffectBasis): ReadonlyArray<CountedGlyph> {
  if (term.tags !== undefined && term.tags.length > 0) {
    const anyPlayer = term.label !== 'Your tags';
    return term.tags.map((tag) => glyph(CardRenderItemType.TAG, {tag, anyPlayer}));
  }
  const one = countGlyphOf(term);
  return one === undefined ? [] : [one];
}

/** The WILD tag a count of the player's own tags includes (`ActionEffectBasis.wild`) — drawn as the face draws it. */
export const WILD_GLYPH: CountedGlyph = glyph(CardRenderItemType.TAG, {tag: Tag.WILD});

/** One term of a SUMMED reading (P85 — «3 planet tags + 2 colonies»): the server's term and its glyphs. */
export type CountedTerm = {term: ActionEffectBasis, glyphs: ReadonlyArray<CountedGlyph>};

/** The composer's «ПОЧЕМУ» of a counted play: the gain, the term it counts, its composition and what it names. */
export type CountedWhy = {
  /** The play's chip — its icon, its amount (the result side of the reading). */
  chip: ActionEffect,
  /** The counted term — its count and label (and, for the census, its glyph). */
  term: ActionEffectBasis,
  glyph: CountedGlyph | undefined,
  /** The term's glyphs as drawn (`countGlyphsOf` — the row of an OR of tags); empty → the label in words. */
  glyphs: ReadonlyArray<CountedGlyph>,
  /**
   * THE TERMS OF A SUMMED BASIS (P85 Summit Logistics — «1 M€ per planet tag AND per colony»): two or more plain
   * terms, each counted on its own by the server, read as «[J][E][V][M] 3 + [colony] 2 → +5». Empty for a single term
   * and for the census; when present, `term` is the FIRST of them and the reading never prints `term` alone.
   */
  terms: ReadonlyArray<CountedTerm>,
  parts: ReadonlyArray<{kind: ActionEffectBasisPartKind, count: number, spaces: ReadonlyArray<SpaceId>, glyph: CountedGlyph | undefined}>,
  excluded: ReadonlyArray<{kind: ActionEffectBasisPartKind, count: number, spaces: ReadonlyArray<SpaceId>}>,
  /**
   * The cells of a SINGLE-TERM count that lives on the board (T12 — «per empty area adjacent to your tiles»): the
   * board peek's one group. Empty for a composed count (its cells ride its parts) and for a term with no cells.
   */
  spaces: ReadonlyArray<SpaceId>,
  /** The term's honest zero in words (an i18n key), when the server named it — read instead of a bare «0». */
  zeroLabel: string | undefined,
  /**
   * The term carries a COMPOSITION (the census — TR45): the reading prints
   * «= shares» and names its zero in words. A single-term count (PL-196 —
   * TR23's colonies, TR43's oceans) is its glyph and its number alone.
   */
  composed: boolean,
  /** Nothing counted — the reading names the zero instead of a sum. */
  zero: boolean,
};

/**
 * The term a chip's «why» reads: the one carrying a COMPOSITION (the census),
 * else the basis's ONLY term (PL-196 — «Colonies in play: 5»). A basis of two
 * or more plain terms is a SUMMED reading (`summedTermsOf`), not one term.
 */
function whyTermOf(chip: ActionEffect): ActionEffectBasis | undefined {
  const basis = chip.basis;
  if (basis === undefined || basis.length === 0) {
    return undefined;
  }
  return basis.find((b) => b.parts !== undefined) ?? (basis.length === 1 ? basis[0] : undefined);
}

/**
 * A basis of two or more PLAIN terms (P85 — planet tags + colonies; Molecular
 * Printing — cities + colonies): every term, in the server's order. Empty when
 * the basis is one term or carries a composition.
 */
function summedTermsOf(chip: ActionEffect): ReadonlyArray<CountedTerm> {
  const basis = chip.basis ?? [];
  if (basis.length < 2 || basis.some((b) => b.parts !== undefined)) {
    return [];
  }
  return basis.map((term) => ({term, glyphs: countGlyphsOf(term)}));
}

/**
 * The «why» of a counted play, read off the play's own chips: the first gain
 * whose basis names its reason — a COMPOSITION (the census — TR45), a single
 * counted term (PL-196) or the SUM of its terms (P85). `undefined` for a play
 * with no counted gain.
 */
export function countedWhyOf(effects: ReadonlyArray<ActionEffect> | undefined): CountedWhy | undefined {
  for (const chip of effects ?? []) {
    if (chip.direction !== 'gain') {
      continue;
    }
    const terms = summedTermsOf(chip);
    const term = terms.length > 0 ? terms[0].term : whyTermOf(chip);
    if (term === undefined) {
      continue;
    }
    return {
      chip,
      term,
      glyph: countGlyphOf(term),
      glyphs: countGlyphsOf(term),
      terms,
      parts: (term.parts ?? []).map((p) => ({kind: p.kind, count: p.count, spaces: p.spaces, glyph: PART_GLYPH[p.kind]})),
      excluded: (term.excluded ?? []).map((p) => ({kind: p.kind, count: p.count, spaces: p.spaces})),
      spaces: term.parts === undefined && terms.length === 0 ? (term.spaces ?? []) : [],
      zeroLabel: terms.length === 0 ? term.zero : undefined,
      composed: term.parts !== undefined,
      zero: terms.length > 0 ? terms.every((t) => t.term.count === 0) : term.count === 0,
    };
  }
  return undefined;
}

/** The translator a host hands the pure readers. */
export type CountedTranslator = {text: (key: string) => string, params: (key: string, params: Array<string>) => string};

/** «не считаются: 1 вне Марса · 2 опасности» — `undefined` when nothing is excluded. */
export function excludedTail(why: CountedWhy, t: CountedTranslator): string | undefined {
  if (why.excluded.length === 0) {
    return undefined;
  }
  const items = why.excluded.map((e) => t.params(PART_LABEL[e.kind], [String(e.count)]));
  return `${t.text('not counted:')} ${items.join(' · ')}`;
}

/**
 * THE SAME READING AS ONE LINE (the inspector's «ДЛЯ ВАС»): «Тайлы на Марсе 14
 * = 4 города + 5 озеленений + 4 океана + 1 спецтайл → +14 микробов на эту
 * карту · не считаются: 1 вне Марса», or the named zero «На Марсе пока нет
 * тайлов → +0». Every number is the server's.
 */
export function countedWhyRow(why: CountedWhy, t: CountedTranslator): string {
  // The result as the chip states it: the signed number and where it lands («на эту карту», «производство»).
  const result = why.chip.note === undefined ? signedAmount(why.chip.amount) : `${signedAmount(why.chip.amount)} ${t.text(why.chip.note)}`;
  if (why.terms.length > 0) {
    // A SUMMED basis (P85): «Ваши метки (Юпитер, Земля, Венера, Марс) 3 + Ваши колонии 2 → +5» — every term with its
    // own number, a zero included (each entity named with its 0: the reading says what WOULD have counted).
    return `${why.terms.map((c) => termReading(c.term, t)).join(' + ')} → ${result}`;
  }
  if (!why.composed) {
    // A single term (PL-196): «Колонии в игре 5 → +5 на эту карту» — a zero reads as its own «0 → 0», or in the words
    // the server named it with (T12 — «Рядом с вашими тайлами нет пустых клеток → 0»).
    if (why.zero && why.zeroLabel !== undefined) {
      return `${t.text(why.zeroLabel)} → ${result}`;
    }
    return `${termReading(why.term, t)} → ${result}`;
  }
  if (why.zero) {
    return `${t.text('No tiles on Mars yet')} → ${result}`;
  }
  const parts = why.parts.map((p) => t.params(PART_LABEL[p.kind], [String(p.count)])).join(' + ');
  const head = `${t.text(why.term.label)} ${why.term.count} = ${parts} → ${result}`;
  const tail = excludedTail(why, t);
  return tail === undefined ? head : `${head} · ${tail}`;
}

/** A term in words — its label, and for an OR of tags the tags it counts: «Ваши метки (Юпитер, Земля, Венера, Марс)». */
function termWords(term: ActionEffectBasis, t: CountedTranslator): string {
  const names = (term.tags ?? []).map((tag) => tagNameKey(tag)).filter((k): k is string => k !== undefined).map((k) => t.text(k));
  return names.length === 0 ? t.text(term.label) : `${t.text(term.label)} (${names.join(', ')})`;
}

/** A term with its number — and the WILD share it includes, named: «… 5 (в т.ч. любых: 1)». */
function termReading(term: ActionEffectBasis, t: CountedTranslator): string {
  const head = `${termWords(term, t)} ${term.count}`;
  return term.wild === undefined ? head : `${head} (${t.params('incl. ${0} wild', [String(term.wild)])})`;
}
