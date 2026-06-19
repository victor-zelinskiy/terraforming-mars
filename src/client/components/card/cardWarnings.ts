import {Warning} from '@/common/cards/Warning';

/**
 * Shared card-warning vocabulary — the single source of truth for the English
 * i18n KEY and the premium NOTICE LEVEL of every `Warning`. Used by both the
 * legacy `WarningsComponent` (text only) and the premium `PremiumCardWarnings`
 * (level-styled notice) so the two never drift.
 *
 * A warning is a NON-blocking note shown while the player is constructing a play
 * / action (the card is still playable — see UnplayableReason for the blocking
 * "why can't I play" reasons). Three premium levels:
 *   - `noEffect` — a part of the effect is WASTED (a global parameter is maxed, no
 *     matching card, the deck is short). Calm amber, ⊘ glyph: "this part won't apply".
 *   - `warning`  — a real DOWNSIDE the player should weigh (self-harm, an extra
 *     cost, a discard). Orange, ⚠ glyph.
 *   - `info`     — a neutral heads-up (build constraint, prelude fizzle). Cyan, ℹ.
 */
export type WarningLevel = 'info' | 'warning' | 'noEffect';

export const WARNING_TEXT: Record<Warning, string> = {
  'pass': 'You will not take any more actions this generation.',
  'undoBestEffort': 'Undo is best effort only. Please do not report any bugs if it is broken.',
  'maxtemp': 'Note: the temperature is already at its goal.',
  'maxoxygen': 'Note: the oxygen level is already at its goal.',
  'maxoxygen-reduce': 'Note: the oxygen level cannot be reduced once it\'s already at its goal.',
  'maxoceans': 'Note: all oceans are already on the board.',
  'maxvenus': 'Note: Venus scale is already at its goal.',
  'maxHabitatRate': 'Note: Moon habitat rate is already at its goal.',
  'maxMiningRate': 'Note: Moon mining rate is already at its goal.',
  'maxLogisticRate': 'Note: Moon logistic rate is already at its goal.',
  'decreaseOwnProduction': 'Warning: you are the only player that can lose production.',
  'removeOwnPlants': 'Warning: this will remove your own plants',
  'buildOnLuna': 'You will only be able to build the colony on Luna.',
  'preludeFizzle': 'This prelude is not playable, so you will discard it and gain 15 M€.',
  'deckTooSmall': 'There are not enough cards to complete this action. You will draw fewer cards than expected.',
  'cannotAffordBoardOfDirectors': 'Warning: you do not have the 12 M€ required to act on a prelude.',
  'marsIsTerraformed': 'Note: all global parameters are at their goals.',
  'ineffectiveDoubleDown': 'Behavior in this card will apply to Double Down, and so have no effect.',
  'unusableEventsForAstraMechanica': 'Astra Mechanica does not apply to events that return cards to a player\'s hand.',
  'noMatchingCards': 'No cards gain the reward of this action.',
  'noEffect': 'This action will have no effect.',
  'selfTarget': 'Note: This action will target you.',
  'pharmacyUnion': 'Note: playing a card with a microbe tag will cause you to lose 4 M€ (or as much as possible).',
  'kaguyaTech': 'Warning: Your only greeneries are special tiles.',
  'underworldtokendiscard': 'Warning: You will have to discard an underworld resource token you rely on.',
};

const WARNING_LEVEL: Partial<Record<Warning, WarningLevel>> = {
  // A part of the effect is wasted — calm "won't apply" notice.
  'maxtemp': 'noEffect',
  'maxoxygen': 'noEffect',
  'maxoxygen-reduce': 'noEffect',
  'maxoceans': 'noEffect',
  'maxvenus': 'noEffect',
  'maxHabitatRate': 'noEffect',
  'maxMiningRate': 'noEffect',
  'maxLogisticRate': 'noEffect',
  'marsIsTerraformed': 'noEffect',
  'noEffect': 'noEffect',
  'noMatchingCards': 'noEffect',
  'ineffectiveDoubleDown': 'noEffect',
  'unusableEventsForAstraMechanica': 'noEffect',
  'deckTooSmall': 'noEffect',
  // A real downside to weigh.
  'decreaseOwnProduction': 'warning',
  'removeOwnPlants': 'warning',
  'selfTarget': 'warning',
  'pharmacyUnion': 'warning',
  'kaguyaTech': 'warning',
  'underworldtokendiscard': 'warning',
  'cannotAffordBoardOfDirectors': 'warning',
  // Neutral heads-up.
  'buildOnLuna': 'info',
  'preludeFizzle': 'info',
  'pass': 'info',
  'undoBestEffort': 'info',
};

export function warningLevel(warning: Warning): WarningLevel {
  return WARNING_LEVEL[warning] ?? 'warning';
}

export function warningText(warning: Warning): string {
  return WARNING_TEXT[warning] ?? String(warning);
}
