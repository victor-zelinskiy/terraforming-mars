import {SpaceId} from '../Types';

/**
 * Transient, self-only snapshot of the OCEAN ADJACENCY bonus the player just
 * earned by placing a tile next to one or more oceans ("gain N M€ per adjacent
 * ocean", `MarsBoard.oceanAdjacencyBonus` → `Game.grantPlacementBonuses`).
 *
 * WHY THE SERVER HAS TO SAY THIS. The rule itself is server-authoritative and
 * already applied — the client is NOT allowed to re-derive it (that would be a
 * second, drift-prone implementation of a game rule). But the premium console
 * placement scene has to show WHICH neighbours paid: one materializing M€ coin
 * per triggered ocean, born at that ocean's own edge. The count alone can't do
 * that, and the board adjacency graph (`Board.getAdjacentSpaces`) lives only on
 * the server. So the grant path — the one place that already knows both the
 * exact neighbours and the exact M€ — publishes them here. Purely presentational
 * metadata: nothing reads it back, and no money moves because of it.
 *
 * Lifecycle mirrors `lastReveal` / `energyHeatConversion`: set during the input
 * that placed the tile, serialized self-only in `PlayerViewModel`, cleared at the
 * start of the player's next input (`Player.process`). Never serialized into the
 * saved game. Only ever SET (never cleared by a subsequent bonus-less placement),
 * so a card that places two tiles in one input still reports the paying one; the
 * client matches `spaceId` against the placement it armed and ignores everything
 * else.
 */
export type OceanAdjacencyBonusModel = {
  /** The space the player just placed a tile on (the bonus' cause). */
  readonly spaceId: SpaceId;
  /**
   * The adjacent ocean spaces that paid, in the board's clockwise neighbour
   * order. One entry = one `perOcean` payment = one coin in the console scene.
   */
  readonly oceanSpaceIds: ReadonlyArray<SpaceId>;
  /** M€ per ocean at grant time (`player.oceanBonus` — 2, or 3 with Lakefront Resorts). */
  readonly perOcean: number;
  /** The total M€ actually granted (`oceanSpaceIds.length * perOcean`). */
  readonly megacredits: number;
};
