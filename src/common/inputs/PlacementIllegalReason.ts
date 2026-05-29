/**
 * Why a board cell is NOT a legal placement target in the current
 * SelectSpace prompt. Extensible: add new values + a label below and the
 * client auto-picks up the new reason via the existing tooltip lookup.
 *
 * Server fills these for cells outside the legal `spaces` list so the
 * client can show a native browser tooltip (`title=` attribute) plus a
 * `cursor: not-allowed` cue on hover. Reason derivation lives in
 * `MarsBoard.computeIllegalReasons()`.
 *
 * Priority order during derivation (most specific first): occupied →
 * nomad-occupies → protected-hazard → reserved-noctis → reserved-colony
 * → owned-by-other → wrong-terrain → not-volcanic / not-isolated →
 * not-adjacent-to-yours / adjacent-to-city / adjacent-to-red-city /
 * no-energy-coverage → cannot-afford → unavailable.
 */
export type PlacementIllegalReason =
  | 'occupied'
  | 'reserved-noctis'
  | 'reserved-colony'
  | 'owned-by-other'
  | 'nomad-occupies'
  | 'protected-hazard'
  | 'wrong-terrain'
  | 'not-ocean-reserve'
  | 'not-volcanic'
  | 'not-isolated'
  | 'adjacent-to-city'
  | 'not-adjacent-to-yours'
  | 'adjacent-to-red-city'
  | 'no-energy-coverage'
  | 'cannot-afford'
  | 'unavailable';

/**
 * English-source label for each reason. Used as the i18n key — Russian
 * (and any future) translations live in `src/locales/<lang>/ui.json`,
 * keyed by the exact strings below.
 *
 * Phrasing is "why the cell is not available", short, neutral.
 */
export const PLACEMENT_REASON_LABEL: Readonly<Record<PlacementIllegalReason, string>> = {
  'occupied': 'Already has a tile',
  'reserved-noctis': 'Reserved for Noctis City',
  'reserved-colony': 'Reserved colony space',
  'owned-by-other': 'Owned by another player',
  'nomad-occupies': 'Mars Nomads is here',
  'protected-hazard': 'Protected hazard',
  'wrong-terrain': 'Wrong terrain type',
  'not-ocean-reserve': 'Not an ocean reserve',
  'not-volcanic': 'Not a volcanic space',
  'not-isolated': 'Not isolated from other tiles',
  'adjacent-to-city': 'Cannot be adjacent to a city',
  'not-adjacent-to-yours': 'Must be adjacent to your tile',
  'adjacent-to-red-city': 'Cannot be adjacent to Red City',
  'no-energy-coverage': 'No energy production available',
  'cannot-afford': 'You cannot afford the cost',
  'unavailable': 'Not available for this placement',
};

/**
 * Per-cell illegal-state payload returned by the server alongside the
 * legal `spaces` list.
 */
export type PlacementIllegalSpace = {
  spaceId: import('../Types').SpaceId;
  reason: PlacementIllegalReason;
};
