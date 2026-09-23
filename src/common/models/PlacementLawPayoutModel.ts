import {SpaceId} from '../Types';
import {ResolutionId} from '../parliament/ParliamentTypes';
import {OceanAdjacencyBonusModel} from './OceanAdjacencyBonusModel';
import {GreeneryAdjacencyBonusModel} from './GreeneryAdjacencyBonusModel';

/**
 * Transient, self-only snapshot of WHAT THE ENACTED LAW PAID on one placement,
 * over and above what the engine itself paid for it.
 *
 * Two shapes live here and they are deliberately ONE channel:
 *  · a law that REPEATS what the engine already paid («Development Craze»:
 *    double all placement and adjacency bonuses on Mars) — `printed` / `ocean`;
 *  · a law that INTRODUCES an adjacency the engine has no notion of
 *    («Forestry Support»: greeneries pay their neighbours) — `greeneries`.
 * A third law adds a MEMBER here, never a second player field: the placement
 * scene plays ONE extra wave after the engine's own, and «which wave» is a
 * question about this record, not about how many channels exist.
 *
 * WHY THE SERVER HAS TO SAY THIS. The payout is server-authoritative and
 * already applied. The premium console placement scene must show it as its own
 * wave from the same cell (never as numbers that silently grew), and it must
 * not re-derive which bonuses a law repeated or which neighbours a law made
 * pay. So the passive that paid publishes what it did. Purely presentational:
 * nothing reads it back, no money moves because of it.
 *
 * Lifecycle mirrors `lastOceanBonus`: set inside the input that placed the
 * tile, serialized self-only in `PlayerViewModel`, cleared at the start of the
 * player's next input (`Player.process`). Never serialized into the saved
 * game. The client matches `spaceId` against the placement it armed.
 */
export type PlacementLawPayoutModel = {
  /** The space the player just placed a tile on (the cause of the payout). */
  readonly spaceId: SpaceId;
  /** The enacted resolution whose passive paid. */
  readonly resolution: ResolutionId;
  /**
   * The cell's PRINTED bonuses were paid AGAIN (false when the tile covered an
   * existing tile — the engine paid none the first time, so none the second).
   * Absent for a law that repeats nothing.
   */
  readonly printed?: boolean;
  /** The ocean adjacency paid AGAIN — the same breakdown shape the first wave rides. */
  readonly ocean?: OceanAdjacencyBonusModel;
  /** A NEW adjacency the law introduced: every neighbouring greenery paid. */
  readonly greeneries?: GreeneryAdjacencyBonusModel;
};
