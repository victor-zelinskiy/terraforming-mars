import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {SpaceId} from '../Types';
import {TileType} from '../TileType';
import {ParameterMoveId} from '../parliament/parameterMove';

/*
 * A PARAMETER SWING — «UP AND BACK» (Turmoil Redux TR47 Ecological
 * Experiment: «increase each Mars global parameter 1 step … THEN decrease
 * each Mars global parameter that isn't at maximum by 1 step; keep the TR you
 * gained»). The planet goes up for everybody, pays what a raise pays, and
 * comes back down for everybody — and the two halves of that story routinely
 * land in ONE server response (every ocean at its maximum: no removal is
 * asked, the lowering rides the play's own answer), where the DIFF of the two
 * views reads ZERO: the marker would not move, the rating would tick with no
 * cause on screen (the PL-133 class — a fact the client cannot read off the
 * board is a fact the server PUBLISHES).
 *
 * So the swing is a RECORD of the server's (`GameModel.parameterSwings`):
 * per parameter where it stood, where the raise took it and where the fall
 * left it, the rating the raise paid, the thresholds it claimed, the tile the
 * fall removed. The client plays the UP from whatever its view has not shown
 * yet (a leg the diff already glided is not glided twice) and the DOWN always
 * from the record — never from a diff that may be zero.
 *
 * Purely presentational, the `scaleStepRewards` precedent: a bounded ring,
 * never serialized, consumed once by `seq`; the mover's own scene and every
 * other viewer's read the SAME record. A restart loses the animation, never
 * the rule (the journal keeps every line).
 */

/** One parameter the raise MOVED: its value before and after, the rating that step paid, the threshold claims it made. */
export type ParameterSwingUp = {
  parameter: ParameterMoveId;
  before: number;
  after: number;
  /** The rating steps this raise paid the mover (0 for a raise nobody was credited for). */
  tr: number;
  /** The scale-bonus thresholds this raise claimed (`<scale>-<step>` — the engine's own claim keys). */
  claimed: ReadonlyArray<string>;
};

/** One parameter the fall touched: lowered — or left standing at its maximum (named, never silent). */
export type ParameterSwingDown =
  | {parameter: ParameterMoveId; before: number; after: number}
  | {parameter: ParameterMoveId; atMax: true; at: number}
  | {parameter: ParameterMoveId; atMin: true; at: number};

/**
 * ONE SWING, for the board's scene (`GameModel.parameterSwings`). Written by
 * ONE function, `cards/parameterSwing.recordParameterSwing`, once the fall
 * has happened — so `up`, `down` and the removal are the record of what the
 * server actually did, never a plan.
 */
export type ParameterSwingModel = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  seq: number;
  /** The card whose printed effect swung the planet. */
  source: {card: CardName};
  /** The seat that played it — the one the raise was credited to. */
  player: Color;
  /** The parameters the RAISE moved, in the engine's order (empty when the raise left none: everything at its maximum). */
  up: ReadonlyArray<ParameterSwingUp>;
  /** The parameters the FALL touched, in the engine's order — lowered, or named at a limit. */
  down: ReadonlyArray<ParameterSwingDown>;
  /** The ocean the fall took off the board (the oceans' own lowering), when one left. */
  removed?: {space: SpaceId; tile: TileType};
  /** The rating the whole swing left the mover with — measured, never derived (it stays through the fall). */
  rating: number;
};
