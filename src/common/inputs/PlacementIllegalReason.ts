/**
 * Why a board cell is NOT a legal placement target in the current
 * SelectSpace prompt. Extensible: add new values + a label below and the
 * client auto-picks up the new reason via the existing tooltip lookup.
 *
 * Server fills these for cells outside the legal `spaces` list so the
 * client can show a native browser tooltip (`title=` attribute) plus a
 * `cursor: not-allowed` cue on hover. Reason derivation lives in
 * `MarsBoard.computeIllegalReasons()`; card-specific reasons are produced
 * by passing a `customReasoner` callback through `createMarsSelectSpace()`.
 *
 * Priority order during derivation (most specific first): a custom
 * reasoner runs first per cell; if it returns undefined, the generic
 * pipeline applies — occupied → nomad-occupies → protected-hazard →
 * reserved-noctis → reserved-colony → owned-by-other → wrong-terrain →
 * not-volcanic / not-isolated → not-adjacent-to-yours / adjacent-to-city
 * / adjacent-to-red-city / no-energy-coverage → cannot-afford →
 * cannot-afford-bonus → unavailable.
 */
export type PlacementIllegalReason =
  // ── Generic (derivable from space + board state alone) ──────────────
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
  | 'cannot-afford-bonus'
  // ── Card-specific (require card context — produced via customReasoner) ──
  | 'already-marked'
  | 'already-excavated'
  | 'already-identified'
  | 'too-many-adjacent-cities'
  | 'not-identified'
  | 'wrong-bonus-type'
  | 'not-your-greenery'
  | 'not-adjacent-to-nomads'
  | 'already-visited'
  | 'not-closest'
  | 'no-paired-greenery-neighbor'
  | 'not-adjacent-to-new-ocean'
  | 'has-hazard'
  | 'not-a-city'
  | 'already-has-cathedral'
  | 'no-triangle-with-this-space'
  | 'breaks-current-triangle'
  | 'not-enough-adjacent-oceans'
  // ── Fallback ─────────────────────────────────────────────────────────
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
  'cannot-afford-bonus': 'You cannot afford the placement bonus',
  // Card-specific
  'already-marked': 'This area is already a community',
  'already-excavated': 'Already excavated',
  'already-identified': 'Underground resource already identified',
  'too-many-adjacent-cities': 'Adjacent to more than one city',
  'not-identified': 'No identified underground resource',
  'wrong-bonus-type': 'Bonus is not steel or titanium',
  'not-your-greenery': 'Not your greenery tile',
  'not-adjacent-to-nomads': 'Not adjacent to Mars Nomads',
  'already-visited': 'Base already visited this space',
  'not-closest': 'Not among the nearest empty areas',
  'no-paired-greenery-neighbor': 'No adjacent land for the paired greenery',
  'not-adjacent-to-new-ocean': 'Not adjacent to the placed ocean',
  'has-hazard': 'Hazard tile blocks placement',
  'not-a-city': 'Not a city tile',
  'already-has-cathedral': 'Already has a cathedral',
  'no-triangle-with-this-space': 'Not part of any valid triangle',
  'breaks-current-triangle': 'Not in a triangle with your prior picks',
  'not-enough-adjacent-oceans': 'Needs at least 2 adjacent ocean tiles',
  // Fallback
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
