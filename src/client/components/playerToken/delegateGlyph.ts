/**
 * THE DELEGATE HAS ONE SILHOUETTE — head and shoulders, the figure printed on
 * every Turmoil card. Everything that names a delegate draws THIS path:
 *  - the printed mark, by URL (`assets/misc/delegate.svg` — the player's white
 *    print; `assets/misc/delegate-neutral.svg` — the dark neutral print): the
 *    card face, the requirement plate, the journal / resource chips;
 *  - the PIECE on the table (`PlayerDelegate.vue`): the same silhouette as a
 *    lacquered standee on a disc base, in the player's colour or in steel.
 * The eye recognises on a resolution's ribbon what it read on the card. Two
 * files and one component, ONE drawing — guard
 * `tests/parliament/DelegateGlyphParity.spec.ts`.
 *
 * Proportions 1 : 1.3 (40 × 52 design units), the egg-shaped head tapering to
 * the chin over a rounded shoulder block — the scan's figure.
 */
export const DELEGATE_PATH = 'M20 1.5C27.5 1.5 32.6 6.6 32.6 13C32.6 19.5 25.6 29.6 20 29.6C14.4 29.6 7.4 19.5 7.4 13C7.4 6.6 12.5 1.5 20 1.5ZM.6 38.2A5.2 5.2 0 0 1 5.8 33H34.2A5.2 5.2 0 0 1 39.4 38.2V49.4A2 2 0 0 1 37.4 51.4H2.6A2 2 0 0 1 .6 49.4Z';

/** The silhouette's design box. */
export const DELEGATE_VIEWBOX = '0 0 40 52';
