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
 * Attribution of the terraform-rating VP by the reason the rating rose.
 *
 * `base` is the reconciling remainder (the starting rating, usually 20, plus
 * any untracked drift), computed as `terraformRating − temperature − oxygen −
 * oceans − venus − cards`, so the six fields ALWAYS sum to `terraformRating`.
 * The four parameter fields come from the player's `globalParameterSteps`
 * (each step is worth 1 TR); `cards` is the player's direct card / effect TR.
 */
export type TerraformRatingBreakdown = {
  base: number;
  temperature: number;
  oxygen: number;
  oceans: number;
  venus: number;
  cards: number;
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
  victoryPoints: number;
  total: number;
  detailsCards: ReadonlyArray<CardVictoryPointsDetail>;
  detailsMilestones: ReadonlyArray<MADetail>;
  detailsAwards: ReadonlyArray<MADetail>;
  detailsPlanetaryTracks: ReadonlyArray<{tag: Tag, points: number}>;
  // Total VP less than 0. For Underworld
  negativeVP: number;
}
