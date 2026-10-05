import {ColonyName} from './ColonyName';

/**
 * THE PICK BUILDS A COLONY — the marker of a colony pick
 * (`SelectColonyModel.buildSites`) and the SERVER's projection of what the
 * build does on EACH candidate: ONE entry per candidate tile.
 *
 * Its presence makes the act of the pick `build` (the client's
 * `colonyPickIntent`) — the structural replacement of «the button says
 * Build». The client draws the cube's ghost in the berth `slot` names, the
 * limit mark where `overLimit` is true and the calm «second colony» status
 * where `own` is positive, and decides none of it: it never compares a cube
 * count with the printed limit.
 *
 * Published by `BuildColony.prompt()` on EVERY build prompt (the standard
 * project, a card's follow-up, a resolution's free colony, a cell's bonus,
 * the staged door of a card that builds by being played).
 */
export type ColonyBuildSite = {
  /** The candidate tile. */
  colony: ColonyName;
  /** The 0-based berth the cube will take — the number of cubes standing there now. */
  slot: number;
  /**
   * The berth lies beyond the printed limit (`colonyBerths.berthIsOverLimit`)
   * — only a door that lifts the limit offers such a tile (Turmoil Redux TR25
   * Exclusive Colony).
   */
  overLimit: boolean;
  /** How many cubes of the answering player already stand on the tile (a duplicate build when positive). */
  own: number;
};
