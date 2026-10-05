import {MAX_COLONIES_PER_TILE} from '../constants';
import {ColonyMetadata, trackTop} from './ColonyMetadata';

/**
 * THE BERTHS OF A COLONY TILE — where a colony's cube stands, and which of
 * those places lie BEYOND THE PRINTED LIMIT.
 *
 * The tabletop tile prints its build bonus in the first three cells of the
 * track and the cubes stand ON those cells (the marker may never sit below
 * them). «Three colonies per tile» is therefore a rule of the ORDINARY DOORS
 * of a build (`Colonies.buildBlockedReason`), never a property of the cube
 * array: a card may lift it for one build (Turmoil Redux TR25 Exclusive
 * Colony — «this ignores the 3-colony limit»), and that cube stands where it
 * would on the table — on the fourth cell.
 *
 * So «is this place beyond the limit» is ARITHMETIC over the count, asked of
 * these functions by the server and the client alike. No flag, no serialized
 * field: a tile with four cubes says so by having four. The number three is
 * compared with a cube count HERE and at the door — nowhere else
 * (`Colony.isFull` is the door's own gate).
 */

/** How many berths a tile PRINTS — the limit of the ordinary doors. */
export function printedBerths(): number {
  return MAX_COLONIES_PER_TILE;
}

/** Does the 0-based berth `slot` lie beyond the printed ones? */
export function berthIsOverLimit(slot: number): boolean {
  return slot >= printedBerths();
}

/**
 * How many berths a tile SHOWS: the printed ones, every cube that stands
 * (a fourth cube is a fourth berth), and the place a door projects a cube
 * into (`projectedSlot`, 0-based) before it is built.
 */
export function berthCount(built: number, projectedSlot?: number): number {
  return Math.max(printedBerths(), built, projectedSlot === undefined ? 0 : projectedSlot + 1);
}

/**
 * THE PHYSICAL LIMIT — the one no card lifts: a cube needs a cell of the
 * track, and the marker must keep a cell of its own to the right of the
 * cubes. A tile with `built` cubes has room for one more while `built` is
 * below the track's top cell. Read by the one writer of the cube array
 * (`Colony.placeCube`), by every door (its named reason) and by the build
 * preview.
 */
export function hasFreeTrackCell(metadata: Pick<ColonyMetadata, 'trade'>, built: number): boolean {
  return built < trackTop(metadata);
}
