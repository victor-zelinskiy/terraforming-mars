/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHAT IS IN FLIGHT, AS THE WAIT GRAPH KNOWS IT (FREEZE ZERO, stage 2 — the level doors' «nothing is in flight»).
 *
 * Every wait that stands for a MOTION or for the SERVER (a wait for the player is the player's time, never a flight) —
 * plus the wire itself. Never a list kept by hand: the graph is complete by law (stage 3 — every wait bounded and
 * owned), so «quiet» here means nothing will end by itself. ONE reader for every level door and its measure: the
 * opening's (`startController`) and the conclusion's (`supervisorController`).
 */
import {transportState} from '@/client/console/transport/gameTransport';
import {collectWaitNodes} from '@/client/console/waitGraph/waitGraph';

/** The flights' names, ids folded (`#N`), sorted, bounded — `''` when nothing is in flight. */
export function flightsInTheAir(now: number = Date.now()): string {
  const names = collectWaitNodes(now)
    .filter((node) => node.targets.some((target) => target.kind === 'motion' || target.kind === 'server'))
    .map((node) => `${node.family}:${node.id.replace(/[0-9]+/g, 'N')}`);
  if (transportState.requestInProgress) {
    names.push('transport:request');
  }
  return [...new Set(names)].sort().slice(0, 5).join('+');
}
