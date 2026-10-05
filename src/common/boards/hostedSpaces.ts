import {SpaceId} from '../Types';
import {SpaceName} from './SpaceName';

/**
 * HOSTED CELLS — cells of the board's list whose PLACE IS NOT THE BOARD.
 *
 * Every city off Mars is a cell the board builder creates
 * (`expansionSpaceColonies`), and until Turmoil Redux TR22 every one of them
 * was also DRAWN beside the planet, by name (`Board.vue`). A hosted cell is
 * the first that is not: its tile lies ON ANOTHER OBJECT of the table — Nova
 * City on a colony tile (`IColony.tiles` names which one) — and that object's
 * own surface draws it. The engine does not care (the cell is a
 * `SpaceType.COLONY` cell like Ganymede's: `addTile`, the city counters, the
 * quest and every hook read it through `board.spaces`).
 *
 * WHO READS THIS TABLE: the CLIENT's walks over `game.spaces` that give birth
 * to something ON THE BOARD — a landing flight, a cube drop, a board hold, a
 * «show on map» locator. They skip a hosted cell, because the board has no
 * place to aim at; the host's own scene plays the arrival. The SERVER decides
 * nothing by it.
 *
 * A TABLE, NOT A GUESS: «x === −1» is every space colony (Ganymede has a
 * place on the board), and «not drawn by Board.vue» is a fact about a
 * template. A cell is hosted only when its tile lies ON ANOTHER OBJECT;
 * TR27 Aurora Station's city («next to the Venus track») is NOT one — on the
 * printed board the Venus cities stand beside the track, so its cell is the
 * fifth of the board's Venus flank, drawn by `Board.vue` like its four
 * neighbours (owner's decision, 2026-10-05).
 */
export const HOSTED_SPACES: ReadonlySet<SpaceId> = new Set<SpaceId>([
  SpaceName.NOVA_CITY,
]);

/** Is this cell's place somewhere other than the board? See {@link HOSTED_SPACES}. */
export function isHostedSpace(spaceId: SpaceId | undefined): boolean {
  return spaceId !== undefined && HOSTED_SPACES.has(spaceId);
}
