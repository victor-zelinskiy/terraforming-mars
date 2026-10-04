import {GlobalParameter} from '../../common/GlobalParameter';
import type {IPlayer} from '../IPlayer';

/**
 * ONE RAISE OF A GLOBAL PARAMETER SCALE — what `ICard.onGlobalParameterRaised`
 * is told (Turmoil Redux TR24 Venusian Census; Aphrodite since the same card;
 * docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md).
 *
 * Dispatched by ONE function, `Game.globalParameterRaised`, from the three
 * scale functions (oxygen, temperature, Venus) at Aphrodite's historical
 * position: AFTER the rewarded branch and OUTSIDE its guard, so a raise
 * credited to nobody — the World Government's phase, an enacted resolution's
 * world move (`ParameterMoveOptions.unrewarded`, RX12 Gas Export) — still
 * reaches every reactor. A lowering is never a raise; an ocean is not a scale
 * step (the oceans count their own tiles).
 */
export type GlobalParameterRaise = {
  parameter: GlobalParameter;
  /** The scale STEPS actually made (a Venus step is 2 %, a temperature step 2 °C) — after the ceiling's cut, always > 0. */
  steps: number;
  /**
   * The player the raise is CREDITED to — the same author
   * `recordGlobalParameterChange` writes (`rewarded ? player : undefined`):
   * the raising player or MarsBot; `undefined` for the World Government and a
   * resolution's world move.
   */
  by: IPlayer | undefined;
  /** The scale's value before the raise, in its own units (%, °C). */
  before: number;
  /** The scale's value after the raise (`before + steps × step`). */
  after: number;
};
