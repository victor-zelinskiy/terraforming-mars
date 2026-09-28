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
  ColonyName.VENUS,
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
 * Turmoil Redux REPLACEMENT tiles — each stands in for the base tile of the
 * same name when the expansion is on (see `ColonyDealer`), never beside it.
 */
export const TURMOIL_REDUX_COLONY_NAMES = [
  ColonyName.PLUTO_REDUX,
];

/** base tile → the Redux tile that REPLACES it when Turmoil Redux is on. */
export const TURMOIL_REDUX_REPLACEMENTS: Readonly<Partial<Record<ColonyName, ColonyName>>> = {
  [ColonyName.PLUTO]: ColonyName.PLUTO_REDUX,
};
