import {Resource} from '../../common/Resource';

/**
 * The lowest a production may go: M€ production runs down to −5, every other
 * production stops at 0. ONE source — `Production.add` (the write) and the
 * preview chips (`actionPreviews.productionChange`) both read it. A leaf
 * module on purpose: the preview builders must not import the stock class.
 */
export function productionFloor(resource: Resource): number {
  return resource === Resource.MEGACREDITS ? -5 : 0;
}
