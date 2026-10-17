/*
 * The milestone / award ART identity — ONE formula for every console surface that draws an MA emblem (the MA
 * workspace, the score explorer, the dossier's medallions, the finale's overview — TR69). Pure.
 */

/** The MA art slug — `assets/ma/<slug>.png` (transparent 512 × 512). */
export function maArtSlug(name: string): string {
  return name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
}

/** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
export function maShortName(name: string): string {
  return name.replace(/[0-9]+$/, '');
}
