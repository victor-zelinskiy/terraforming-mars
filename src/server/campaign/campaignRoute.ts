import {BoardName} from '../../common/boards/BoardName';
import {CAMPAIGN_BOARD_WEIGHTS, CAMPAIGN_FINALE_FAVOURITE} from '../../common/campaign/campaignConfig';
import {SeededRandom} from '../../common/utils/Random';

/**
 * THE ROUTE DRAW — which boards a campaign plays, in which order (the owner, 2026-11-07: «вероятность выпадения
 * Amazonis в кампании должна быть немного выше других карт, и особенно как финальной карты — не гарантировано, но
 * больше дефолтной вероятности»).
 *
 * A WEIGHTED draw without replacement from the canonical pool (every board weighs 1, a board of
 * `CAMPAIGN_BOARD_WEIGHTS` its own weight), then the FINALE FAVOURITE: when the favoured board is on the route, one
 * more seeded roll moves it to the last slot at the configured chance — otherwise it keeps the slot the draw gave it.
 * Pure: the same stream gives the same route (the campaign's `generator.seed` is its provenance — version 2).
 *
 * With thirteen boards and Amazonis Planitia at weight 2 the map is on about half the routes (31 % at weight 1) and
 * the finale of about three in ten (one in thirteen unweighted) — never certain.
 */
export function drawCampaignRoute(pool: ReadonlyArray<BoardName>, count: number, rng: SeededRandom): Array<BoardName> {
  const candidates = [...pool];
  const route: Array<BoardName> = [];
  while (route.length < count && candidates.length > 0) {
    const weights = candidates.map((board) => CAMPAIGN_BOARD_WEIGHTS[board] ?? 1);
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = rng.next() * total;
    let picked = candidates.length - 1;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        picked = i;
        break;
      }
    }
    route.push(candidates[picked]);
    candidates.splice(picked, 1);
  }
  const favourite = CAMPAIGN_FINALE_FAVOURITE;
  const at = route.indexOf(favourite.board);
  // The roll is drawn whenever the favourite is on the route — the stream never depends on WHERE it landed.
  if (at >= 0 && at !== route.length - 1 && rng.next() < favourite.chance) {
    route.splice(at, 1);
    route.push(favourite.board);
  }
  return route;
}
