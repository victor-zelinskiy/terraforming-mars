/*
 * THE SCENES A VIEW'S COMMIT WAITS FOR — one list, by name.
 *
 * The root refuses to commit a fetched view over a live scene of the viewer's (`App.update`: swapping `playerView`
 * mid-cinematic pops panels to their final values and opens the next phase's surfaces over a running scene) and parks
 * the refresh instead (`deferredViewRefresh.ts`). WHICH scenes — these nine — was a list inside `update()`; it is a
 * module so that the two readers of the same fact read the same list: the root (what to park behind) and the
 * arbiter's delivery judge (`console/transport/viewDelivery.ts` — who holds a view the server already speaks of).
 *
 * A scene is named by a stable word: the parked refresh's overdue line and the stall's holder carry it into the
 * cause class (`common/diagnostics/shapes.ts`).
 */
import {isEnergyConversionActive} from '@/client/components/feedback/energyConversionTransition';
import {isHazardCleanupActive} from '@/client/components/feedback/hazardCleanupTransition';
import {isCardDiscardActive} from '@/client/console/cardDiscard/consoleCardDiscard';
import {isTradeFleetActive} from '@/client/console/colonyFleet/consoleTradeFleet';
import {isHydroMarkerActive} from '@/client/console/hydroMarker/consoleHydroMarker';
import {isNomadMoveActive} from '@/client/console/nomads/consoleNomadMove';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {isPlayedHeroActive} from '@/client/console/played/consolePlayedHero';
import {isTilePlacementActive} from '@/client/console/tilePlacement/consoleTilePlacement';

const VIEW_SCENES: ReadonlyArray<readonly [string, () => boolean]> = [
  ['energy-conversion', isEnergyConversionActive],
  ['hazard-cleanup', isHazardCleanupActive],
  ['trade-fleet', isTradeFleetActive],
  ['hydro-marker', isHydroMarkerActive],
  ['played-hero', isPlayedHeroActive],
  ['patent-sale', isPatentSaleActive],
  ['card-discard', isCardDiscardActive],
  ['tile-placement', isTilePlacementActive],
  ['nomad-move', isNomadMoveActive],
];

/** The scenes whose flag is raised right now, by name (a predicate that throws is a scene that does not hold). */
export function liveViewScenes(): Array<string> {
  const live: Array<string> = [];
  for (const [name, active] of VIEW_SCENES) {
    try {
      if (active()) {
        live.push(name);
      }
    } catch {
      // A scene module that cannot answer holds nothing.
    }
  }
  return live;
}
