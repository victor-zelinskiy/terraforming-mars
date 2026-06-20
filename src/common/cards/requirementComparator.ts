/**
 * The comparison a requirement expresses against its numeric value.
 *
 * The card data model only carries `max` today (so cards render `min`/`max`
 * exclusively), but the strict / equality kinds are part of the vocabulary so
 * any future requirement shape — and the unit tests — map cleanly.
 */
export type ComparatorKind = 'min' | 'max' | 'gt' | 'lt' | 'eq';

const COMPARATOR_SYMBOLS: Readonly<Record<ComparatorKind, string>> = {
  min: '≥', // ≥
  max: '≤', // ≤
  gt: '>',
  lt: '<',
  eq: '=',
};

// Russian renders every requirement comparison as a short word. Inclusive
// thresholds are uniform — «от» for "≥ N" and «до» for "≤ N" — regardless of
// whether the requirement is a global parameter or an object count (the earlier
// «минимум / максимум» split for counts was dropped: «от / до» is shorter and
// reads consistently everywhere). Strict comparisons keep «больше / меньше» and
// equality keeps «ровно».
const RU_COMPARATOR_WORDS: Readonly<Record<ComparatorKind, string>> = {
  min: 'от',
  max: 'до',
  gt: 'больше',
  lt: 'меньше',
  eq: 'ровно',
};

/**
 * Whether a comparator renders as a short inclusive word («от» / «до»).
 *
 * Only meaningful for the RU locale; drives the larger, prominent type size on
 * the requirement plate (the strict / equality words stay compact).
 */
export function isInclusiveComparator(kind: ComparatorKind): boolean {
  return kind === 'min' || kind === 'max';
}

/**
 * Render-layer label for a requirement's comparison.
 *
 * Russian replaces the math glyphs with short words («от» = ≥, «до» = ≤,
 * «больше» = >, «меньше» = <, «ровно» = =) so the requirement reads as plain
 * language; every other locale keeps the compact ≥/≤/>/</= glyphs.
 * DISPLAY-ONLY — this never affects the numeric value, the requirement model,
 * or playability logic.
 */
export function comparatorLabel(kind: ComparatorKind, lang: string): string {
  if (lang === 'ru') {
    return RU_COMPARATOR_WORDS[kind];
  }
  return COMPARATOR_SYMBOLS[kind];
}
