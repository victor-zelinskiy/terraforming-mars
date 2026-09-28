import {ColonyName} from '../colonies/ColonyName';
import {Color} from '../Color';

export type ColonyModel = {
  colonies: Array<Color>;
  isActive: boolean;
  name: ColonyName;
  trackPosition: number;
  visitor: Color | undefined;
}

export function simpleColonyModel(name: ColonyName): ColonyModel {
  return {
    colonies: [],
    isActive: false,
    name: name,
    trackPosition: 0,
    visitor: undefined,
  };
}

/**
 * A colony that REFUSES one player its trade right now, with the reason —
 * a rule of the COLONY about THIS player (the Turmoil Redux Pluto: «no card
 * of yours can hold the data this trade pays»), true whatever the turn or
 * the fleet count. Published per seat on `PublicPlayerModel.colonyTradeBlocks`
 * so every surface reads the server's verdict instead of guessing one; the
 * open trade prompt carries the same refusal as its `disabledColonies`.
 */
export type ColonyTradeBlockModel = {
  colony: ColonyName;
  /** English i18n key. */
  reason: string;
};
