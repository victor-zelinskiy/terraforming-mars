/**
 * Milestone / Award ART helpers — the ONE place the `assets/ma/<slug>.png`
 * path convention lives for the premium confirm + ceremony surfaces.
 *
 * The asset set is being migrated to the transparent 512×512 premium icon
 * format; the slug convention is shared with the desktop overlays
 * (`MilestonesOverlay.assetName`) and the console dashboard
 * (`ConsoleMaScreen.artSlug`): lowercase, spaces → dashes, dots removed.
 * Legacy 140×83 assets letterbox gracefully inside a `contain` stage; a
 * MISSING asset is handled by `MaHeroArt.vue`'s @error fallback (a calm
 * trophy / medal emblem — never a broken image).
 */
export type MaKind = 'milestone' | 'award';

export function maArtSlug(name: string): string {
  return name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
}

export function maArtUrl(name: string): string {
  return `assets/ma/${maArtSlug(name)}.png`;
}

/** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
export function maDisplayName(name: string): string {
  return name.replace(/[0-9]+$/, '');
}
