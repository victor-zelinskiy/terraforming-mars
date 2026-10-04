import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Color} from '../Color';
import {GlobalParameter} from '../GlobalParameter';
import {Resource} from '../Resource';

/**
 * WHAT ONE SCALE STEP PAID — a card that answers «each time the scale is
 * terraformed» (Turmoil Redux TR24 Venusian Census: +2 data per Venus step;
 * Aphrodite: +2 M€) published the payout for the board's scene: the tokens
 * are born at the scale's MARKER, after it has arrived at `after`, and land
 * where the owner's resource lives. docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md.
 */
export type ScaleStepRewardGain =
  | {kind: 'cardResource', resource: CardResource, amount: number}
  | {kind: 'stock', resource: Resource, amount: number};

/**
 * ONE PAYOUT (`GameModel.scaleStepRewards`): a bounded ring, never serialized,
 * each client consuming a record once by `seq` — the owner's own scene and
 * every other viewer's read the SAME record, so nobody infers «this was the
 * census» from a counter's delta. A restart loses the animation, never the
 * rule (the journal keeps the line). The `cardAdjacencyPayouts` precedent.
 */
export type ScaleStepRewardModel = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  seq: number;
  parameter: GlobalParameter;
  /** The scale steps the raise made (after the ceiling's cut). */
  steps: number;
  /** The scale's value before / after this raise, in its own units — the marker's glide. */
  before: number;
  after: number;
  /** The paid seat — the card's owner. */
  owner: Color;
  /** The card whose printed effect paid. */
  card: CardName;
  gain: ScaleStepRewardGain;
  /** The seat the raise was credited to; absent for the World Government and a resolution's world move. */
  by?: Color;
};
