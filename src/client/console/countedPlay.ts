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
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import type {ICardRenderItem} from '@/common/cards/render/Types';
import type {SpaceId} from '@/common/Types';

// ── THE HAND'S FORECAST PLATE ────────────────────────────────────────────────

/** One unit of the plate: an icon (on the production plate when it is a production step) and its number. */
export type HandPlateItem = {iconClass: string, production: boolean, amount: number, signed: boolean};

/**
 * THE PLATE — «[★] 2» for a walk (TR42), «[microbe] +14» for a counted play.
 * `value` is the e2e hook's number (`data-hand-walk` / `data-hand-count`);
 * `zero` mutes the plate (a zero is a reading, never hidden).
 */
export type HandForecastPlate = {kind: 'walk' | 'count', items: ReadonlyArray<HandPlateItem>, value: number, zero: boolean};

/** At most this many counted units on one plate — a tile is a card, not a ledger (the composer holds the rest). */
export const HAND_PLATE_MAX_ITEMS = 2;

/**
 * The plate a hand card wears, or none. The WALK reader first (a card that
 * walks the Agenda says how far — its accepted plate, unchanged), then the
 * COUNTED reader: the first counted chips, each its icon and its signed number.
 */
export function handForecastPlate(card: CardModel): HandForecastPlate | undefined {
  const walk = card.agendaWalk;
  if (walk !== undefined) {
    return {
      kind: 'walk',
      items: [{iconClass: 'resource_icon resource_icon--agenda-step', production: false, amount: walk.walked, signed: false}],
      value: walk.walked,
      zero: walk.walked === 0,
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
 * the player's own tiles drop the frame.
 */
export function countGlyphOf(term: ActionEffectBasis): CountedGlyph | undefined {
  if (term.label === 'Tiles on Mars') {
    return glyph(CardRenderItemType.EMPTY_TILE, {anyPlayer: true, secondaryTag: AltSecondaryTag.MARS_TILE});
  }
  if (term.label === 'Your tiles on Mars') {
    return glyph(CardRenderItemType.EMPTY_TILE, {secondaryTag: AltSecondaryTag.MARS_TILE});
  }
  return undefined;
}

/** The composer's «ПОЧЕМУ» of a counted play: the gain, the term it counts, its composition and what it names. */
export type CountedWhy = {
  /** The play's chip — its icon, its amount (the result side of the reading). */
  chip: ActionEffect,
  /** The counted term — its count and label (and, for the census, its glyph). */
  term: ActionEffectBasis,
  glyph: CountedGlyph | undefined,
  parts: ReadonlyArray<{kind: ActionEffectBasisPartKind, count: number, spaces: ReadonlyArray<SpaceId>, glyph: CountedGlyph | undefined}>,
  excluded: ReadonlyArray<{kind: ActionEffectBasisPartKind, count: number, spaces: ReadonlyArray<SpaceId>}>,
  /** Nothing counted — the reading names the zero instead of a sum. */
  zero: boolean,
};

/**
 * The «why» of a counted play, read off the play's own chips: the first gain
 * whose basis carries a COMPOSITION (the census — TR45). `undefined` for a
 * play with no composed count (a single-term basis keeps its chip's pill).
 */
export function countedWhyOf(effects: ReadonlyArray<ActionEffect> | undefined): CountedWhy | undefined {
  for (const chip of effects ?? []) {
    const term = chip.basis?.find((b) => b.parts !== undefined);
    if (term === undefined || chip.direction !== 'gain') {
      continue;
    }
    return {
      chip,
      term,
      glyph: countGlyphOf(term),
      parts: (term.parts ?? []).map((p) => ({kind: p.kind, count: p.count, spaces: p.spaces, glyph: PART_GLYPH[p.kind]})),
      excluded: (term.excluded ?? []).map((p) => ({kind: p.kind, count: p.count, spaces: p.spaces})),
      zero: term.count === 0,
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
  if (why.zero) {
    return `${t.text('No tiles on Mars yet')} → ${result}`;
  }
  const parts = why.parts.map((p) => t.params(PART_LABEL[p.kind], [String(p.count)])).join(' + ');
  const head = `${t.text(why.term.label)} ${why.term.count} = ${parts} → ${result}`;
  const tail = excludedTail(why, t);
  return tail === undefined ? head : `${head} · ${tail}`;
}
