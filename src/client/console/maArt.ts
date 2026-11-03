/*
 * The milestone / award ART identity — ONE formula for every console surface that draws an MA emblem (the MA
 * workspace, the score explorer, the dossier's medallions, the finale's overview — TR69). Pure.
 */

/** The MA art slug — `assets/ma/<slug>.png` (transparent 512 × 512). */
export function maArtSlug(name: string): string {
  return name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
}

/**
 * An emblem that carries WORDS has one file per language that spells them differently: the default
 * `<slug>.png` is the ENGLISH one (every language without its own file reads it), and `<slug>-<lang>.png`
 * stands beside it. Urbanist's VP token reads «ПО» in Russian. Guard: `tests/console/maArtLocale.spec.ts`
 * (every listed variant exists on disk).
 */
export const LOCALIZED_MA_ART: Readonly<Record<string, ReadonlyArray<string>>> = {
  'urbanist': ['ru'],
};

/** The art FILE's slug for a language — `<slug>-<lang>` where that variant exists, else the slug. */
export function maArtFileSlug(slug: string, lang: string): string {
  return LOCALIZED_MA_ART[slug]?.includes(lang) === true ? `${slug}-${lang}` : slug;
}

/** The art's path — `assets/ma/<file>.png` for the language. Every surface draws an MA emblem from here. */
export function maArtPath(slug: string, lang: string): string {
  return `assets/ma/${maArtFileSlug(slug, lang)}.png`;
}

/** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
export function maShortName(name: string): string {
  return name.replace(/[0-9]+$/, '');
}
