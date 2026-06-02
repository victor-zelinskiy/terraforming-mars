import {CardName} from '@/common/cards/CardName';

/**
 * Static per-standard-project visual + copy lookup.
 *
 * Maps a standard-project `CardName` to (a) a CSS class that paints the
 * project's "effect" pictogram (the `std-icon std-icon--*` family defined
 * in player_home.less) and (b) an i18n key for a one-line description.
 *
 * Extracted out of `StandardProjectsOverlay.vue` so the journal's compact
 * standard-project preview (`StandardProjectPreviewPopover.vue`) can reuse
 * the exact same iconography + copy without duplicating the table. Keep
 * this as the single source of truth; both consumers import it.
 *
 * The description strings live in `src/locales/<lang>/ui.json` like the
 * rest of UI copy, so the server never has to ship them.
 */
export type StandardProjectVisual = {iconClass: string; description: string};

export const PROJECT_VISUAL: Partial<Record<CardName, StandardProjectVisual>> = {
  [CardName.POWER_PLANT_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--energy',
    description: 'Increase energy production by 1',
  },
  [CardName.ASTEROID_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--temperature',
    description: 'Raise temperature 1 step',
  },
  [CardName.AQUIFER_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--ocean',
    description: 'Place an ocean tile',
  },
  [CardName.GREENERY_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--greenery',
    description: 'Place a greenery tile, raise oxygen',
  },
  [CardName.CITY_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--city',
    description: 'Place a city, +1 M€ production',
  },
  [CardName.AIR_SCRAPPING_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--venus',
    description: 'Raise Venus 1 step',
  },
  [CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT]: {
    iconClass: 'std-icon std-icon--venus',
    description: 'Raise Venus 1 step (variant)',
  },
  [CardName.BUILD_COLONY_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--colony',
    description: 'Place a new colony',
  },
  [CardName.EXCAVATE_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--excavate',
    description: 'Excavate a space',
  },
  [CardName.BUFFER_GAS_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--tr',
    description: 'Gain 1 TR (solo only)',
  },
  [CardName.COLLUSION_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--delegate',
    description: 'Place a delegate in any party',
  },
  // Moon expansion projects — re-use the existing moon icons.
  [CardName.MOON_HABITAT_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--moon-habitat',
    description: 'Place a habitat on the Moon',
  },
  [CardName.MOON_HABITAT_STANDARD_PROJECT_VARIANT_1]: {
    iconClass: 'std-icon std-icon--moon-habitat',
    description: 'Place a habitat on the Moon (variant)',
  },
  [CardName.MOON_HABITAT_STANDARD_PROJECT_VARIANT_2]: {
    iconClass: 'std-icon std-icon--moon-habitat',
    description: 'Place a habitat on the Moon (variant 2)',
  },
  [CardName.MOON_MINE_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--moon-mining',
    description: 'Place a mine on the Moon',
  },
  [CardName.MOON_MINE_STANDARD_PROJECT_VARIANT_1]: {
    iconClass: 'std-icon std-icon--moon-mining',
    description: 'Place a mine on the Moon (variant)',
  },
  [CardName.MOON_MINE_STANDARD_PROJECT_VARIANT_2]: {
    iconClass: 'std-icon std-icon--moon-mining',
    description: 'Place a mine on the Moon (variant 2)',
  },
  [CardName.MOON_ROAD_STANDARD_PROJECT]: {
    iconClass: 'std-icon std-icon--moon-logistics',
    description: 'Place a road on the Moon',
  },
  [CardName.MOON_ROAD_STANDARD_PROJECT_VARIANT_1]: {
    iconClass: 'std-icon std-icon--moon-logistics',
    description: 'Place a road on the Moon (variant)',
  },
  [CardName.MOON_ROAD_STANDARD_PROJECT_VARIANT_2]: {
    iconClass: 'std-icon std-icon--moon-logistics',
    description: 'Place a road on the Moon (variant 2)',
  },
};

export function standardProjectVisual(name: CardName): StandardProjectVisual {
  return PROJECT_VISUAL[name] ?? {iconClass: 'std-icon std-icon--generic', description: ''};
}
