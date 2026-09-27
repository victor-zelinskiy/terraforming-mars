import type {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';

/**
 * THE POINTS A PLAYER'S BOARD MADE — the reading every strategy layer asks
 * (the city-greenery archetype, Ecoline's and Tharsis's story, the Vermin
 * pressure, a plant attack's «hard counter»).
 *
 * It is the `board` category (city adjacency + a greenery's own VP) PLUS the
 * terraform rating the greenery TILES themselves paid: under Turmoil Redux a
 * greenery pays 1 TR at placement instead of scoring 1 VP at the end, so a
 * pure greenery engine would read as a ~0 board while the same tiles filled
 * the rating. One number in both rulesets — without the parliament the TR
 * part is 0 and this IS the category. NOT a category of the partition (the TR
 * half already counts in `tr`), so it is never summed against the total.
 *
 * Two doors to the same arithmetic: a reader holding the PLAYER adds the
 * category on its score (`boardPointsOf`); a reader holding the CONTEXT's
 * category list adds the tiles' half to that value (`greeneryTilesTrOf`) —
 * the two lists carry the same category by construction (`endgameModel`
 * fills both from `categoryValue`).
 *
 * A leaf module on purpose: `endgameModel`, the archetypes, the corporation
 * engine and the stories all read it, and none of them may import another.
 */
export type BoardPointsInput = {
  categories: {board?: number};
  breakdown: Pick<VictoryPointsBreakdown, 'terraformRatingBreakdown'>;
};

/** The TR the greenery tiles themselves paid (Turmoil Redux); 0 without the parliament or on a spec's minimal breakdown. */
export function greeneryTilesTrOf(b: Pick<VictoryPointsBreakdown, 'terraformRatingBreakdown'> | undefined): number {
  return b?.terraformRatingBreakdown?.greeneries ?? 0;
}

export function boardPointsOf(p: BoardPointsInput): number {
  // A spec's minimal player fakes both fields — read them defensively.
  return (p.categories?.board ?? 0) + greeneryTilesTrOf(p.breakdown);
}
