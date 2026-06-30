import {Expansion, MODULE_NAMES} from '@/common/cards/GameModule';

/**
 * Maps an expansion key to its shipped icon file (the file stems don't all match
 * the enum key — e.g. `moon` → `themoon`, `corpera` → `corporateEra`). Reuses
 * the existing `assets/expansion_icons/*` artwork the create-game form uses.
 */
const ICON_STEM: Record<Expansion, string> = {
  corpera: 'corporateEra',
  promo: 'promo',
  venus: 'venus',
  colonies: 'colonies',
  prelude: 'prelude',
  prelude2: 'prelude2',
  turmoil: 'turmoil',
  community: 'community',
  ares: 'ares',
  moon: 'themoon',
  pathfinders: 'pathfinders',
  ceo: 'ceo',
  starwars: 'starwars',
  underworld: 'underworld',
  deltaProject: 'deltaProject',
};

export function expansionIconUrl(e: Expansion): string {
  return `assets/expansion_icons/expansion_icon_${ICON_STEM[e]}.png`;
}

/** English display name (an i18n source key — translate with $t at the call site). */
export function expansionLabel(e: Expansion): string {
  return MODULE_NAMES[e];
}
