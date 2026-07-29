/*
 * CONSOLE PLACEMENT NEXT-STEP — the PURE presenter for the one-line «ДАЛЕЕ: …»
 * row the play / first-action / blue-action composers show between the RESULT
 * block and ОПЛАТА.
 *
 * It answers ONE question: *which tile am I about to place?* The old copy
 * («После подтверждения разместите тайл на поле») never said, so a card that
 * drops a named special tile read exactly like a plain greenery.
 *
 * The identity comes from the TILE, never from the played card:
 *   - name    = `tileTypeToString[tileType]` (`common/TileType` — the ONE
 *               TileType→name table, the same one the board inspector, the
 *               journal chips and the placement logs read),
 *   - special = `isSpecialTile(tileType)` (also `common/TileType`, shared with
 *               the board engine — the classification is never re-stated here).
 * A card's own name is deliberately NEVER consulted, not even as a fallback:
 * Flooding places an OCEAN and Lava Tube Settlement places a plain CITY, so
 * "the card is the tile" is simply false. A tile with no usable name degrades
 * to the honest unnamed copy — never `undefined`, empty quotes or a raw enum id.
 *
 * WORD ORDER is fixed here, not in the template: the kind («особый тайл») always
 * precedes the name, and the whole sentence is ONE i18n key per case so RU/EN
 * grammar is written by a translator instead of being glued from fragments.
 *
 * No Vue / DOM / manifest — the translator is injected, which is also how the
 * specs assert the real RU and EN output
 * (tests/client/components/console/consolePlacementNextStep.spec.ts).
 */

import {Message} from '@/common/logs/Message';
import {ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {TileType, isSpecialTile, tileTypeToString} from '@/common/TileType';

/** The `boardPlacement` arm of `ActionPreviewStep`, narrowed. */
export type BoardPlacementStep = Extract<ActionPreviewStep, {kind: 'boardPlacement'}>;

/**
 * Translate an English key, interpolating `${0}`/`${1}` from `params`. The
 * component passes the app's `translateTextWithParams`; specs pass a dictionary.
 */
export type PlacementTranslator = (key: string, params?: ReadonlyArray<string>) => string;

export type PlacementNextStep = {
  /** The finished one-line sentence, e.g. «разместите особый тайл «Солнечная электростанция»». */
  label: string;
  /** The English i18n key actually chosen (what the specs pin). */
  key: string;
  /** The tile's own translated name, or `''` when it has none. */
  tileName: string;
  /** TRUE when the copy calls it «особый тайл». */
  special: boolean;
  /** How many identical tiles this row covers (>= 1). */
  count: number;
  /** The tile being placed — the component's icon key. Absent for a colony. */
  tileType?: TileType;
  /** A short muted tail ("next to a city"); the component translates + renders it. */
  constraint?: string | Message;
};

/* ── copy table ──────────────────────────────────────────────────────
 * One whole sentence per case. `${0}` is the count when the row is plural,
 * otherwise the tile name; a plural NAMED row carries both. Splitting these
 * into "verb + noun + name" fragments would produce «разместите тайл город».
 */
const SINGULAR: Readonly<Record<PlacementShape, string>> = {
  generic: 'Place the tile',
  city: 'Place the city tile',
  ocean: 'Place the ocean tile',
  greenery: 'Place the greenery tile',
  special: 'Place the special tile',
  colony: 'Choose where to build a colony',
};
const PLURAL: Readonly<Record<PlacementShape, string>> = {
  generic: 'Place ${0} tiles',
  city: 'Place ${0} city tiles',
  ocean: 'Place ${0} ocean tiles',
  greenery: 'Place ${0} greenery tiles',
  special: 'Place ${0} special tiles',
  colony: 'Choose where to build ${0} colonies',
};
/** A special tile that HAS a name. Each language picks its own word order — EN
 *  reads «Place the Solar Farm special tile», RU «разместите особый тайл «…»» —
 *  which is exactly why this is ONE key and not glued-together fragments. */
const SPECIAL_NAMED = 'Place the ${0} special tile';
/** Defensive only: no card places several copies of one NAMED tile today
 *  (`behavior.tile` carries no count), but the name must survive if one ever does. */
const SPECIAL_NAMED_PLURAL = 'Place the ${0} special tile (×${1})';

type PlacementShape = 'generic' | 'city' | 'ocean' | 'greenery' | 'special' | 'colony';

/** The ordinary tiles that have their own localized noun («тайл океана»). */
const ORDINARY_SHAPE: Partial<Record<TileType, PlacementShape>> = {
  [TileType.CITY]: 'city',
  [TileType.OCEAN]: 'ocean',
  [TileType.GREENERY]: 'greenery',
};

/**
 * The tile's OWN canonical name, or `undefined` when it has none worth showing.
 *
 * `tileTypeToString` is a total record, but a `tileType` can still arrive off
 * the wire from a newer server (an enum member this build doesn't know), so the
 * lookup is treated as partial. The three ordinary tiles are excluded on
 * purpose — their name IS their type, already carried by the `city`/`ocean`/
 * `greenery` sentence, and quoting «тайл «city»» would be nonsense.
 */
export function canonicalTileName(tileType: TileType | undefined): string | undefined {
  if (tileType === undefined || ORDINARY_SHAPE[tileType] !== undefined) {
    return undefined;
  }
  const name: string | undefined = tileTypeToString[tileType];
  return name !== undefined && name.trim() !== '' ? name : undefined;
}

/**
 * The one-line "what you place next" presenter for a `boardPlacement` step.
 * `translate` resolves an English key (and interpolates `${n}`); the tile name
 * is translated through the SAME dictionary, because a tile's canonical name is
 * an ordinary i18n key like any other.
 */
export function describeTilePlacement(step: BoardPlacementStep, translate: PlacementTranslator): PlacementNextStep {
  const count = Math.max(1, Math.round(step.count ?? 1));
  const tileType = step.tileType;
  const special = isSpecialTile(tileType);
  const rawName = special ? canonicalTileName(tileType) : undefined;
  const tileName = rawName !== undefined ? translate(rawName) : '';

  // A NAMED special tile is the whole point of this row: «особый тайл «…»».
  if (special && tileName !== '') {
    const key = count > 1 ? SPECIAL_NAMED_PLURAL : SPECIAL_NAMED;
    const params = count > 1 ? [tileName, String(count)] : [tileName];
    return {label: translate(key, params), key, tileName, special, count, tileType, constraint: step.constraint};
  }

  const shape = shapeOf(step, special);
  const key = count > 1 ? PLURAL[shape] : SINGULAR[shape];
  return {
    label: translate(key, count > 1 ? [String(count)] : undefined),
    key,
    tileName,
    special,
    count,
    tileType,
    constraint: step.constraint,
  };
}

/**
 * ONE row of the composer's «ДАЛЕЕ» block. Deliberately flat and pre-translated:
 * the template renders it without a single copy decision, which is what keeps the
 * word order («особый тайл» before the name) in one place.
 */
export type NextStepRow = {
  /** The primary sentence — never truncated. */
  text: string;
  /** The tile icon key; absent for a colony build or a prose note. */
  tileType?: TileType;
  /** The muted tail ("рядом с городом"); `''` when there is none. It is the ONLY
   *  part allowed to ellipsis, so the tile's name always survives in full. */
  constraint: string;
  /** Sentence + constraint — the accessible full value behind any ellipsis. */
  full: string;
};

/** A plain (non-placement) follow-up row: prose the server already authored. */
export function noteRow(text: string): NextStepRow {
  return {text, constraint: '', full: text};
}

/**
 * The composer row for a `boardPlacement` step. `translate` resolves plain
 * English keys; `translateAny` additionally resolves a `Message` (the component
 * passes its `textOf`), because a card may author its constraint as either.
 */
export function placementRow(
  step: BoardPlacementStep,
  translate: PlacementTranslator,
  translateAny: (text: string | Message) => string,
): NextStepRow {
  const described = describeTilePlacement(step, translate);
  const constraint = described.constraint !== undefined ? translateAny(described.constraint) : '';
  return {
    text: described.label,
    tileType: described.tileType,
    constraint,
    full: constraint !== '' ? `${described.label} — ${constraint}` : described.label,
  };
}

function shapeOf(step: BoardPlacementStep, special: boolean): PlacementShape {
  // A colony is built off-Mars: no tile, so neither a name nor "special".
  if (step.tileType === undefined) {
    return step.placementType === 'colony' ? 'colony' : 'generic';
  }
  if (special) {
    return 'special';
  }
  // A known ordinary tile names its type; anything else (a Moon tile — never
  // emitted as a preview step today) stays the honest generic "place a tile".
  return ORDINARY_SHAPE[step.tileType] ?? 'generic';
}
