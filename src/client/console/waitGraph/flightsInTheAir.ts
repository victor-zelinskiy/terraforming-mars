/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHAT IS IN FLIGHT, AS THE WAIT GRAPH KNOWS IT (FREEZE ZERO, stage 2 — the level doors' «nothing is in flight»).
 *
 * Every wait that stands for a MOTION or for the SERVER (a wait for the player is the player's time, never a flight) —
 * plus the wire itself. Never a list kept by hand: the graph is complete by law (stage 3 — every wait bounded and
 * owned), so «quiet» here means nothing will end by itself. ONE reader for every level door and its measure: the
 * opening's (`startController`) and the conclusion's (`outcomeController`).
 *
 * …AND THE KERNEL's OWN MOTION WAITS — a director's beat of stillness (`span` → `delay`), the frames of a paint
 * (`whenPainted` → `frames`): rows of the kernel's wait table, family `motion`, that the legacy graph holds no node
 * for. The first whole-suite reading of both doors (CI, 2026-11-22 — run 45060179915) named them: the start door's
 * one shut state stood «QUIET» with `beats[task:conclusion owed:…ms]` under it, and a conclusion's candidate with a
 * `dismiss` verdict stood «QUIET» for up to 1.27 s — the colony step's «one read of the cube», a pause somebody
 * wrote on purpose. A door that opens on quiet must not open inside a beat; a beat is a flight.
 */
import {waitTable} from '@/client/console/kernel/flowScope';
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
  for (const row of waitTable()) {
    if (row.family === 'motion') {
      // (The owner's kind and name — `kernel:task:conclusion owed`, `kernel:session:game` — never the span's length.)
      names.push(`kernel:${row.owner.replace(/#[0-9]+/g, '')}`);
    }
  }
  return [...new Set(names)].sort().slice(0, 5).join('+');
}
