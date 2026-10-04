import {CardResourceBasis} from '../../common/events/EventImpact';
import {Countable, _Countable} from './Countable';

/**
 * THE REASON OF A COUNTED CARD-RESOURCE GAIN — «+5 data · for 5 colonies in
 * play». A declarative `behavior.addResources` whose amount is COUNTED from
 * the table (Habitat Science: «1 data per colony in play, of any player»)
 * lands as one `card-resource-changed` event, and without its basis the
 * journal shows a bare number nobody can account for. The executor attaches
 * this to the event (`Player.addResourceTo` → `basis`), the same member a
 * bespoke counted payout already writes (TR21 Arboretum's «for 3 adjacent
 * cities»).
 *
 * Stated only where the count IS the amount: exactly ONE counted entity at the
 * bare rate (no `each`, no `per` — a rate would make «for N» a different
 * number from the «+M» beside it), and only for an entity that has a unit key
 * here. Everything else returns `undefined` and the event reads as before —
 * growing the table is one row and its two locale forms, never a card hook.
 */

/** The unit of «colonies in play, of any player» — its plural group agrees with the count. */
export const COLONIES_IN_PLAY_UNIT = '{colony|colonies} in play';

const ENTITY_KEYS: ReadonlyArray<keyof _Countable> = [
  'tag', 'cities', 'greeneries', 'oceans', 'resourcesHere', 'floaters', 'colonies', 'moon', 'underworld',
];

export function countedResourceBasis(countable: Countable, count: number): CardResourceBasis | undefined {
  if (typeof countable === 'number' || count <= 0) {
    return undefined;
  }
  if ((countable.each ?? 1) !== 1 || (countable.per ?? 1) !== 1) {
    return undefined;
  }
  const counted = ENTITY_KEYS.filter((key) => countable[key] !== undefined);
  if (counted.length !== 1) {
    return undefined;
  }
  if (counted[0] === 'colonies' && countable.all === true) {
    return {count, unitKey: COLONIES_IN_PLAY_UNIT};
  }
  return undefined;
}
