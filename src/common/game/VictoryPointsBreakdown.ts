import {Tag} from '../cards/Tag';

export type MADetail = {message: string, messageArgs?: Array<string>, victoryPoint: number};

/**
 * How a card's victory points are produced — used to group the "from cards"
 * breakdown into the four families the score report shows:
 *   • resource    — accumulated card resources (animals / microbes / data / …)
 *   • conditional — depends on game state (a tag count, adjacent tiles, …)
 *   • fixed       — a flat, printed amount
 *   • penalty     — net-negative VP (always wins over the others by sign)
 */
export type CardVictoryPointsKind = 'resource' | 'conditional' | 'fixed' | 'penalty';

export type CardVictoryPointsDetail = {cardName: string, victoryPoint: number, kind: CardVictoryPointsKind};

/**
 * The KIND of source that raised a player's terraform rating directly (i.e. NOT
 * via a global-parameter step, which is attributed to temperature/oxygen/…).
 * `card`/`corporation` carry a `sourceCardId` so the UI can show a card preview;
 * the client refines `card` into prelude/CEO/active by the manifest. `venusTrackBonus`
 * is the Venus 8% threshold TR bonus; `legacyUnknown` is the reconciling residual
 * for games played before per-source TR attribution existed.
 */
export type TRSourceType =
  | 'card' | 'corporation' | 'globalEvent' | 'party'
  | 'venusTrackBonus' | 'legacyUnknown' | 'other'
  // TR from clearing a hazard zone (cleanup-by-building + the planetary
  // dust-storm-removal event) — its OWN diegetic VP segment, never expansion-named.
  | 'ares-hazard';

export type TRSourceEntry = {
  sourceType: TRSourceType;
  sourceName: string; // card name (an i18n key) or a descriptive i18n key
  sourceCardId?: string; // CardName — for the card preview, when source is a card
  amount: number;
  generation?: number;
};

/**
 * Attribution of the terraform-rating VP by the reason the rating rose.
 *
 * `base` (= `baseRating` + `handicap`) is kept for back-compat. The four parameter
 * fields come from `globalParameterSteps` (each step = 1 TR); `cards` is direct
 * card / effect TR, broken down per source in `cardEntries`. `baseRating` is the
 * CLEAN standard starting rating — it is NEVER a fallback for unclassified TR;
 * any residual is surfaced as a `legacyUnknown` entry inside `cardEntries`.
 *
 * `hazards` is TR from clearing hazard zones (Ares) — split OUT of `cards` into
 * its own segment so it reads as a distinct, diegetic source.
 *
 * Invariant: baseRating + handicap + temperature + oxygen + oceans + venus +
 * cards + hazards === terraformRating, and Σ cardEntries.amount === cards.
 */
export type TerraformRatingBreakdown = {
  base: number; // = baseRating + handicap (back-compat)
  // The fields below are written by the server; OPTIONAL so older serialized
  // game models (and the many client test fixtures) stay valid — the client
  // falls back to `base` / 0 / [] when absent.
  baseRating?: number; // the clean standard starting rating (e.g. 20)
  handicap?: number; // explicit starting adjustment (variant / house rule); 0 if none
  temperature: number;
  oxygen: number;
  oceans: number;
  venus: number;
  cards: number; // direct card / effect TR; Σ cardEntries
  cardEntries?: ReadonlyArray<TRSourceEntry>;
  hazards?: number; // Ares — TR from clearing hazard zones (own segment; 0/absent when no Ares)
};

export type VictoryPointsBreakdown = {
  terraformRating: number;
  terraformRatingBreakdown: TerraformRatingBreakdown;
  milestones: number;
  awards: number;
  greenery: number;
  city: number;
  escapeVelocity: number;
  moonHabitats: number;
  moonMines: number;
  moonRoads: number;
  planetaryTracks: number;
  // Delta Project ("Гидросеть") end-game VP (2 for slot 10, 5 for slot 11).
  // Shown under the "Достижения и награды" bar in the premium score report.
  deltaProject: number;
  victoryPoints: number;
  total: number;
  detailsCards: ReadonlyArray<CardVictoryPointsDetail>;
  detailsMilestones: ReadonlyArray<MADetail>;
  detailsAwards: ReadonlyArray<MADetail>;
  detailsPlanetaryTracks: ReadonlyArray<{tag: Tag, points: number}>;
  // Total VP less than 0. For Underworld
  negativeVP: number;
}
