import {CardName} from '../cards/CardName';

/**
 * What FORCES a "decrease your production" prompt — so the player always sees WHY
 * they must lose production (the same idea as {@link CardDrawRevealSource} for the
 * drawn-cards modal). A `card` source renders as a HOVERABLE chip (mini-card
 * popover + click-to-fullscreen); `hazard` is the Ares "you placed a tile next to
 * a hazard zone" penalty (a premium tooltip explains the rule). Omitted when the
 * cause isn't cheaply known → no source chip (never a misleading one).
 */
export type ProductionLossSource =
  | {type: 'card', card: CardName}
  | {type: 'hazard'}
  | {type: 'other'};
