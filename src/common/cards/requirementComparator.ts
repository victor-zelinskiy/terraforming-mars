import {RequirementType} from './RequirementType';

/**
 * The comparison a requirement expresses against its numeric value.
 *
 * The card data model only carries `max` today (so cards render `min`/`max`
 * exclusively), but the strict / equality kinds are part of the vocabulary so
 * any future requirement shape — and the unit tests — map cleanly.
 */
export type ComparatorKind = 'min' | 'max' | 'gt' | 'lt' | 'eq';

/**
 * How a requirement reads in plain Russian:
 * - `global` — a position on a scale / track (Venus, oxygen, temperature,
 *   oceans, TR, Moon rates) → «от / до».
 * - `quantity` — a count of objects you must have (tags, tiles, colonies,
 *   resources, production, …) → «минимум / максимум».
 */
export type RequirementScale = 'global' | 'quantity';

// Global-parameter / track requirements read naturally as "от / до" (a point
// on a scale). Everything else is a count of things and reads as
// "минимум / максимум" (an amount you must have).
const GLOBAL_SCALE_TYPES: ReadonlySet<RequirementType> = new Set([
  RequirementType.OXYGEN,
  RequirementType.TEMPERATURE,
  RequirementType.OCEANS,
  RequirementType.VENUS,
  RequirementType.TR,
  RequirementType.HABITAT_RATE,
  RequirementType.MINING_RATE,
  RequirementType.LOGISTIC_RATE,
]);

export function requirementScale(type: RequirementType): RequirementScale {
  return GLOBAL_SCALE_TYPES.has(type) ? 'global' : 'quantity';
}

const COMPARATOR_SYMBOLS: Readonly<Record<ComparatorKind, string>> = {
  min: '≥', // ≥
  max: '≤', // ≤
  gt: '>',
  lt: '<',
  eq: '=',
};

const RU_COMPARATOR_WORDS: Readonly<Record<RequirementScale, Record<ComparatorKind, string>>> = {
  global: {min: 'от', max: 'до', gt: 'больше', lt: 'меньше', eq: 'ровно'},
  quantity: {min: 'минимум', max: 'максимум', gt: 'больше', lt: 'меньше', eq: 'ровно'},
};

/**
 * Render-layer label for a requirement's comparison.
 *
 * Russian replaces the math glyphs with short words («от / до» for
 * global-parameter scales, «минимум / максимум» for counts) so the requirement
 * reads as plain language; every other locale keeps the compact ≥/≤/>/</=
 * glyphs. DISPLAY-ONLY — this never affects the numeric value, the requirement
 * model, or playability logic.
 */
export function comparatorLabel(kind: ComparatorKind, scale: RequirementScale, lang: string): string {
  if (lang === 'ru') {
    return RU_COMPARATOR_WORDS[scale][kind];
  }
  return COMPARATOR_SYMBOLS[kind];
}
