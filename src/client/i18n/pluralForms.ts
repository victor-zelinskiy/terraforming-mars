/*
 * @console-shared LIVE — the localization pipeline's PLURAL FORMS.
 *
 * A translation may inline its number-dependent word forms as a group:
 *
 *     "Оставьте себе ${0} {карту|карты|карт}"
 *
 * After parameter substitution the pipeline resolves every `{...|...}` group
 * against the nearest NUMBER to its left in the rendered string — so the
 * translator states the forms next to the value they agree with, and no
 * caller ever concatenates «карт(ы)» by hand.
 *
 * Group shapes:
 *   {one|other}       — two forms (enough for English-like languages);
 *   {one|few|many}    — three forms (Russian/Ukrainian nouns).
 *
 * The FORM INDEX is decided by the ACTIVE LANGUAGE's own rules, so the same
 * mechanism serves every locale: a Slavic dictionary writes three forms, any
 * other writes two (or none — a string without groups is untouched).
 *
 * PURE: no DOM, no Vue, no preferences import — the language is an argument,
 * which is what lets the spec run under the fast server runner.
 */

export type PluralForm = 'one' | 'few' | 'many';

/** Slavic-style three-form rule (ru/uk): 1/21/31 · 2–4/22–24 · the rest. */
function slavicForm(n: number): PluralForm {
  const abs = Math.abs(Math.trunc(n));
  const d10 = abs % 10;
  const d100 = abs % 100;
  if (d10 === 1 && d100 !== 11) {
    return 'one';
  }
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) {
    return 'few';
  }
  return 'many';
}

/** The plural form of `n` under the given UI language. */
export function pluralForm(n: number, lang: string): PluralForm {
  if (lang === 'ru' || lang === 'uk') {
    return slavicForm(n);
  }
  // English-like default: exactly one vs everything else (0 included).
  return Math.abs(n) === 1 ? 'one' : 'many';
}

/** Pick a variant out of a 2- or 3-form group for the given form. */
function pickVariant(variants: ReadonlyArray<string>, form: PluralForm): string {
  if (variants.length >= 3) {
    return form === 'one' ? variants[0] : form === 'few' ? variants[1] : variants[2];
  }
  if (variants.length === 2) {
    return form === 'one' ? variants[0] : variants[1];
  }
  return variants[0] ?? '';
}

/** A `{a|b}` / `{a|b|c}` group. Deliberately narrow: at least one `|`, no
 *  nested braces, no `$` (a not-yet-substituted param must never be eaten). */
const GROUP_RE = /\{([^{}|$]*\|[^{}$]*)\}/g;

/** The nearest number LEFT of an index — the value the group agrees with. */
function nearestNumberBefore(text: string, at: number): number | undefined {
  const head = text.slice(0, at);
  const m = head.match(/(\d+)(?!.*\d)/s);
  return m === null ? undefined : Number(m[1]);
}

/**
 * Resolve every plural group in an already-substituted string.
 *
 * A group with NO number anywhere to its left keeps its first variant — the
 * honest degrade (the translator's `one` form), never the raw `{a|b|c}`.
 */
export function resolvePluralGroups(text: string, lang: string): string {
  if (!text.includes('|') || !text.includes('{')) {
    return text;
  }
  return text.replace(GROUP_RE, (_whole, body: string, offset: number) => {
    const n = nearestNumberBefore(text, offset);
    const variants = body.split('|');
    if (n === undefined) {
      return pickVariant(variants, 'one');
    }
    return pickVariant(variants, pluralForm(n, lang));
  });
}
