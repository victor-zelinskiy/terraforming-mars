/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A CHOSEN COLONY TRACK'S MOVE, READ BEFORE AND AFTER (Turmoil Redux TR07
 * Colony Sponsors — «move its marker to the highest position»; any future
 * «move the chosen colony's track» pick reads the same).
 *
 * The SERVER says where each candidate's marker lands
 * (`SelectColonyModel.trackMoves`) — this module never computes «the top
 * minus where it stands», it only READS a move the way the surfaces print it:
 * the tile's own 1-based readout («3/7 → 7/7»), the steps («+4»), and what a
 * trade with this tile would pay at each end («торговля здесь: [1 ti] → [4 ti]»
 * — the income is the tile's printed track, read through the ONE reader
 * `tradeBenefitAt`). The owners' bonus does not depend on the track and is
 * never printed here; a tile's FIXED income part (the Redux Venus's step)
 * stands at both ends.
 *
 * Pure — no Vue, no DOM, no i18n: spec'd under the server runner.
 */
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyMetadata, FixedTradeIncome, trackTop, tradeBenefitAt, tradeFixedIncome} from '@/common/colonies/ColonyMetadata';
import {ColonyTrackMove} from '@/common/parliament/colonyTrackAdvance';

/** The shape `BenefitGlyph` draws (the kind, the printed quantities, the resource at that position). */
export type TrackMoveBenefit = {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown};

/** What a trade with the tile pays with the marker on ONE cell. */
export type TrackMoveEnd = {
  /** The 0-based track cell. */
  position: number;
  /** The tile's own readout of it — «3/7». */
  display: string;
  /** The marker's income there: the amount, whether it is a LEVY (the Redux Venus's first cell), the glyph. */
  quantity: number;
  levy: boolean;
  benefit: TrackMoveBenefit;
};

export type ColonyTrackMoveReading = {
  colony: ColonyName;
  before: TrackMoveEnd;
  after: TrackMoveEnd;
  /** The steps the marker makes (0 never reaches a reading: such a tile is not a candidate). */
  steps: number;
  /** The tile's FIXED income part, paid at both ends (undefined for every tile without one). */
  fixed: FixedTradeIncome | undefined;
};

/** ONE cell of the tile, as the move's readings print it. */
function endAt(metadata: ColonyMetadata, position: number): TrackMoveEnd {
  const top = trackTop(metadata);
  const pos = Math.max(0, Math.min(position, top));
  const income = tradeBenefitAt(metadata, pos);
  return {
    position: pos,
    display: `${pos + 1}/${top + 1}`,
    quantity: income.quantity,
    levy: income.type === ColonyBenefit.LOSE_RESOURCES,
    benefit: {type: income.type, quantity: metadata.trade.quantity, resource: income.resource},
  };
}

/** THE READING of one server-projected move — before → after, the steps, the trade income at both ends. */
export function colonyTrackMoveReading(metadata: ColonyMetadata, move: ColonyTrackMove): ColonyTrackMoveReading {
  return {
    colony: move.colony,
    before: endAt(metadata, move.before),
    after: endAt(metadata, move.after),
    steps: Math.max(0, move.after - move.before),
    fixed: tradeFixedIncome(metadata),
  };
}

/** The server's projection for ONE tile of a pick (undefined when the tile is not a candidate, or the pick moves no track). */
export function trackMoveOf(moves: ReadonlyArray<ColonyTrackMove> | undefined, colony: string): ColonyTrackMove | undefined {
  return moves?.find((move) => move.colony === colony);
}
