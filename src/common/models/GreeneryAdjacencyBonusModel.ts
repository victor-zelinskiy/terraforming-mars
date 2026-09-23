import {SpaceId} from '../Types';

/**
 * The GREENERY ADJACENCY bonus of one placement — the twin of
 * {@link OceanAdjacencyBonusModel}, for the adjacency an ENACTED RESOLUTION
 * introduces («Forestry Support»: greenery tiles give a 2 M€ and 1 plant
 * adjacency bonus when placing tiles next to them).
 *
 * WHY IT LOOKS EXACTLY LIKE THE OCEAN'S. The two are the same physical
 * statement — «this neighbour paid me for building beside it» — so they share
 * one shape, one scene language and one reading. The only differences are
 * declared as data: WHICH neighbours paid (`greenerySpaceIds`, the board's own
 * clockwise order) and WHAT each one pays (`perGreenery`, the law's constants
 * rather than a player attribute; a greenery pays TWO resources, so the rate
 * carries both).
 *
 * The rule is server-authoritative and already applied when this is published.
 * The client never re-derives adjacency: it stages one coin AND one plant per
 * named neighbour. Purely presentational — nothing reads it back.
 *
 * It rides {@link PlacementLawPayoutModel} (the ONE channel for «what the
 * enacted law paid on this placement»), never a field of its own.
 */
export type GreeneryAdjacencyBonusModel = {
  /** The space the player just placed a tile on (the bonus' cause). */
  readonly spaceId: SpaceId;
  /**
   * The adjacent greenery spaces that paid, in the board's clockwise neighbour
   * order. One entry = one `perGreenery` payment = one coin + one plant in the
   * console scene. Any owner's greenery pays (the ocean rule, generalized).
   */
  readonly greenerySpaceIds: ReadonlyArray<SpaceId>;
  /** What ONE neighbouring greenery pays — the law's printed rate. */
  readonly perGreenery: {readonly megacredits: number, readonly plants: number};
  /** The totals actually granted (`greenerySpaceIds.length × perGreenery`). */
  readonly megacredits: number;
  readonly plants: number;
};
