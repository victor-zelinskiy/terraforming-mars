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

import maArtFit from './maArtFit.json';

export function maArtSlug(name: string): string {
  return name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
}

export function maArtUrl(name: string): string {
  return `assets/ma/${maArtSlug(name)}.png`;
}

type MaArtFit = {s: number, x: number, y: number, c?: string};

/**
 * OPTICAL-FIT style for a medal art inside a square stage: equalises the
 * VISUAL MASS across assets (the same idea as the tag matrix's per-tag
 * @tag-fill scale) using the measured alpha bounding boxes in maArtFit.json
 * (regenerate: `pwsh scripts/measure-ma-art.ps1`). Premium 512s carry ~10%
 * transparent margin — `contain` alone renders them a class smaller than
 * they are; legacy 140×83 letterbox as before (their upscale is capped at
 * measurement time, so they never blur). Unknown asset → contain fallback.
 */
export function maArtFitStyle(name: string): Record<string, string> {
  const fit = (maArtFit as Record<string, MaArtFit>)[maArtSlug(name)];
  if (fit === undefined) {
    return {backgroundImage: `url(${maArtUrl(name)})`, backgroundSize: 'contain'};
  }
  return {
    backgroundImage: `url(${maArtUrl(name)})`,
    backgroundSize: `${fit.s}%`,
    backgroundPosition: `${fit.x}% ${fit.y}%`,
  };
}

/** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
export function maDisplayName(name: string): string {
  return name.replace(/[0-9]+$/, '');
}
