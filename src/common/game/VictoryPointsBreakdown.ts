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

/** What a card's per-unit scoring formula counts. */
export type CardVpUnit =
  | 'resources' | 'tags' | 'cities' | 'oceans'
  | 'moon-mine' | 'moon-road' | 'colonies' | 'other';

/**
 * The card's scoring FORMULA plus its live operand, captured by the server at
 * the same moment it computed `victoryPoint` — so the client can explain the
 * number («7 микробов / 2 = 3 ПО») without re-implementing a single counting
 * rule (wild tags, MarsBot track tags, adjacency all stay server truth).
 *
 * Shapes:
 *   • fixed   — a printed number; no operands.
 *   • per     — `each` VP per `per` counted units; `counted` is the SAME
 *               Counter run the score used, with the rate stripped, so
 *               `floor(counted × each / per) === victoryPoint` by construction.
 *   • special — a bespoke `getVictoryPoints`; no universal formula. When the
 *               card stores a resource, `counted`/`resourceType` still carry
 *               the honest stored amount (Search For Life, …).
 */
export type CardVpMechanics = {
  shape: 'fixed' | 'per' | 'special';
  /** VP granted per `per` units (printed rate; 'per' shape only). */
  each?: number;
  /** Units required per `each` VP (printed rate; 'per' shape only). */
  per?: number;
  /** The live operand — the server Counter's own pre-rate count. */
  counted?: number;
  unit?: CardVpUnit;
  /** The tag being counted, when unit === 'tags'. */
  tag?: Tag;
  /** The card's stored resource type (CardResource), when it stores one. */
  resourceType?: string;
  /** Only units adjacent to this card's own tile are counted. */
  adjacent?: true;
  /** Every player's units count, not only the owner's. */
  all?: true;
};

export type CardVictoryPointsDetail = {
  cardName: string,
  victoryPoint: number,
  kind: CardVictoryPointsKind,
  /** The formula + live operands behind `victoryPoint` (score explorer).
   *  Absent for pseudo-rows (Turmoil / Colony VP / bribes) and old models. */
  mechanics?: CardVpMechanics,
};

/** One city's own contribution to the `city` category (1 VP per adjacent
 *  greenery, any owner) — `points` may honestly be 0. */
export type CityVpDetail = {spaceId: string, points: number};

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

/**
 * MarsBot (Automa) scoring exceptions: remaining M€ → VP by final generation,
 * Neural Instance adjacency VP, and the Hard-difficulty +1 VP per non-negative
 * VP-icon card in the played pile. Present only on the bot's breakdown; every
 * field feeds `total`.
 */
export type AutomaVictoryPoints = {
  mcToVp: number;
  /** The conversion rate used (display: "1 VP / N M€"). */
  mcPerVp: number;
  neuralInstance: number;
  cardVp: number;
  /**
   * VP the bot's own CORPORATION scores at the end (C25 Viron: 1 per blue card
   * with a red arrow in its played pile). 0 for every corporation that prints
   * no endgame clause — which is all of them but one so far.
   */
  corpVp: number;
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
  /** MarsBot-only scoring parts. Absent for human players and ordinary games. */
  automa?: AutomaVictoryPoints;
  total: number;
  detailsCards: ReadonlyArray<CardVictoryPointsDetail>;
  detailsMilestones: ReadonlyArray<MADetail>;
  detailsAwards: ReadonlyArray<MADetail>;
  detailsPlanetaryTracks: ReadonlyArray<{tag: Tag, points: number}>;
  /** Per-city contribution behind the `city` total (score explorer).
   *  Optional so older serialized models / test fixtures stay valid. */
  detailsCities?: ReadonlyArray<CityVpDetail>;
  // Total VP less than 0. For Underworld
  negativeVP: number;
}
