import {ColonyName} from './ColonyName';

export const OFFICIAL_COLONY_NAMES = [
  ColonyName.CALLISTO,
  ColonyName.CERES,
  ColonyName.ENCELADUS,
  ColonyName.EUROPA,
  ColonyName.GANYMEDE,
  ColonyName.IO,
  ColonyName.LUNA,
  ColonyName.MIRANDA,
  ColonyName.PLUTO,
  ColonyName.TITAN,
  ColonyName.TRITON,
];

export const COMMUNITY_COLONY_NAMES = [
  ColonyName.IAPETUS,
  ColonyName.MERCURY,
  ColonyName.HYGIEA,
  ColonyName.TITANIA,
  ColonyName.LEAVITT,
  ColonyName.PALLAS,
  ColonyName.DEIMOS,
  ColonyName.TERRA,
  ColonyName.KUIPER,
];

export const PATHFINDERS_COLONY_NAMES = [
  // ColonyName.LEAVITT_II,
  ColonyName.IAPETUS_II,
];

/**
 * Turmoil Redux tiles — two kinds under one module:
 *  · a REPLACEMENT stands in for the base tile of the same name when the
 *    expansion is on (see `ColonyDealer`), never beside it (Pluto);
 *  · an ADDITION has no base twin and simply joins the pool with the
 *    expansion (Venus — the retired community tile of that name is gone).
 * `TURMOIL_REDUX_REPLACEMENTS` tells the two apart; everything not in that
 * map's values is an addition (`isTurmoilReduxAddition`).
 */
export const TURMOIL_REDUX_COLONY_NAMES = [
  ColonyName.PLUTO_REDUX,
  ColonyName.VENUS_REDUX,
];

/** base tile → the Redux tile that REPLACES it when Turmoil Redux is on. */
export const TURMOIL_REDUX_REPLACEMENTS: Readonly<Partial<Record<ColonyName, ColonyName>>> = {
  [ColonyName.PLUTO]: ColonyName.PLUTO_REDUX,
};

/** A Redux tile that replaces nothing — dealt with the expansion, dropped without it. */
export function isTurmoilReduxAddition(name: ColonyName): boolean {
  return TURMOIL_REDUX_COLONY_NAMES.includes(name) &&
    !Object.values(TURMOIL_REDUX_REPLACEMENTS).includes(name);
}
