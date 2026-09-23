import {SpaceId} from '../Types';
import {ResolutionId} from '../parliament/ParliamentTypes';
import {OceanAdjacencyBonusModel} from './OceanAdjacencyBonusModel';

/**
 * Transient, self-only snapshot of a placement whose bonuses were paid a
 * SECOND TIME by the enacted resolution («Development Craze»: double all
 * placement and adjacency bonuses you get for placing tiles on Mars).
 *
 * WHY THE SERVER HAS TO SAY THIS. The doubling is server-authoritative and
 * already applied — the passive re-issued the cell's printed bonuses and the
 * ocean adjacency through the engine's own grant paths. The premium console
 * placement scene must show that second payout as a SECOND WAVE from the same
 * cell (never as numbers that silently grew), and it must not re-derive which
 * bonuses a law doubled. So the passive that paid publishes what it repeated.
 * Purely presentational: nothing reads it back, no money moves because of it.
 *
 * Lifecycle mirrors `lastOceanBonus`: set inside the input that placed the
 * tile, serialized self-only in `PlayerViewModel`, cleared at the start of the
 * player's next input (`Player.process`). Never serialized into the saved
 * game. The client matches `spaceId` against the placement it armed.
 */
export type PlacementBonusEchoModel = {
  /** The space the player just placed a tile on (the cause of the echo). */
  readonly spaceId: SpaceId;
  /** The enacted resolution whose passive paid the bonuses a second time. */
  readonly resolution: ResolutionId;
  /**
   * The cell's PRINTED bonuses were paid again (false when the tile covered an
   * existing tile — the engine paid none the first time, so none the second).
   */
  readonly printed: boolean;
  /** The ocean adjacency M€ paid a second time — the same breakdown shape the first wave rides. */
  readonly ocean?: OceanAdjacencyBonusModel;
};
