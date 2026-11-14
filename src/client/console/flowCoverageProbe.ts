/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE COVERAGE PROBE — the page's side of «how much of the kernel's state space did this walk go through»
 * (docs/claude/console/freeze-zero/PLAN.md §3.1; the keys are `kernel/flowCoverage.ts`'s).
 *
 * Asked for by the e2e harness only (`sessionStorage.tm_coverage = '1'` in its init script, or `?coverage=1`): a
 * player's game never installs it. When it is on:
 *  · every step of the kernel's trace marks its key;
 *  · the set survives a reload of the same tab (written on `pagehide`, read back at install) — a walk that reloads
 *    the page is still ONE walk;
 *  · `window.__conCoverage()` answers `{keys, machines, frames}`: what was walked; what the registered machines CAN
 *    do — every `from → to` their definitions reach with their sample events and their bounds (the universe of the
 *    `state` keys); and every workspace frame there is. (The universe of the other `open` keys is what the sources
 *    declare — `scripts/flow-universe.mjs`, read by `scripts/monkey-report.mjs`.)
 */
import {AnyStateMachine, EventObject, getInitialSnapshot, getNextSnapshot} from 'xstate';
import {coverageScope, flowCoverage, installFlowCoverage, seedFlowCoverage} from '@/client/console/kernel/flowCoverage';
import {delayedEventTypes} from '@/client/console/kernel/flowLaw';
import {FLOW_MACHINES} from '@/client/console/kernel/flowMachines';
import {dumpFlowTree} from '@/client/console/kernel/flowScope';
import {ALL_WORKSPACE_KINDS} from '@/client/console/screenDirector';

const STORAGE_KEY = 'tm_coverage_keys';
const FLAG_KEY = 'tm_coverage';
/** A machine whose context counts without bound must not hang the page. */
const EDGES_MAX_STATES = 2_000;

function valueOf(snapshot: unknown): string {
  const value = (snapshot as {value?: unknown}).value;
  return value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Every `from → to` (by STATE VALUE — the form the trace prints a transition in) a machine reaches from its initial
 * snapshot with its sample events and its delayed transitions. Pure; breadth-first over snapshots, like the law's
 * explorer (`flowLaw.ts` `exploreMachine`) — which judges them, where this only lists the moves.
 */
export function machineEdges(machine: AnyStateMachine, events: ReadonlyArray<EventObject>, input?: unknown,
  key: (snapshot: {value: unknown, context: unknown}) => string = (s) => JSON.stringify([s.value, s.context])): Array<string> {
  type Snap = ReturnType<typeof getInitialSnapshot>;
  const all: Array<EventObject> = [...events, ...delayedEventTypes(machine).map((type) => ({type}))];
  const seen = new Set<string>();
  const edges = new Set<string>();
  const queue: Array<Snap> = [];
  const admit = (snapshot: Snap): void => {
    const k = key(snapshot as unknown as {value: unknown, context: unknown});
    if (!seen.has(k)) {
      seen.add(k);
      queue.push(snapshot);
    }
  };
  admit(getInitialSnapshot(machine, input as never) as Snap);
  while (queue.length > 0 && seen.size <= EDGES_MAX_STATES) {
    const snapshot = queue.shift() as Snap;
    if ((snapshot as unknown as {status?: string}).status === 'done') {
      continue;
    }
    for (const event of all) {
      let next: Snap;
      try {
        next = getNextSnapshot(machine, snapshot as never, event as never) as Snap;
      } catch {
        continue;
      }
      const from = valueOf(snapshot);
      const to = valueOf(next);
      if (from !== to) {
        edges.add(`${from} → ${to}`.replace(/\d+/g, 'N'));
      }
      admit(next);
    }
  }
  return [...edges].sort();
}

/** The scope kind a registered machine runs in — its `state` keys are `state <kind>[:label] …`. */
function kindOfMachine(name: string): string {
  return name.split(' ')[0];
}

/** What the registered machines can do: scope kind → every `from → to` of every machine of that kind. */
export function machineUniverse(): Record<string, Array<string>> {
  const out: Record<string, Set<string>> = {};
  for (const entry of FLOW_MACHINES) {
    const kind = kindOfMachine(entry.name);
    const set = out[kind] ?? (out[kind] = new Set<string>());
    for (const edge of machineEdges(entry.machine, entry.events, entry.input, entry.key)) {
      set.add(edge);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([kind, set]) => [kind, [...set].sort()]));
}

export type FlowCoverageReport = {keys: Array<string>, machines: Record<string, Array<string>>, frames: Array<string>};

let installed = false;

/** Was coverage asked for on this page (the harness's flag, or `?coverage=1`)? */
function asked(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === '1' || new URLSearchParams(window.location.search).get('coverage') === '1';
  } catch {
    return false;
  }
}

/** Idempotent; a no-op unless the harness asked. Called when the game screen is mounted (`wiringController`). */
export function installFlowCoverageProbe(): void {
  if (installed || typeof window === 'undefined' || !asked()) {
    return;
  }
  installed = true;
  try {
    const earlier = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (Array.isArray(earlier)) {
      seedFlowCoverage(earlier.filter((k): k is string => typeof k === 'string'));
    }
  } catch {
    // An unreadable set is an empty one.
  }
  // What already stands (the session, the transport, a frame restored at boot) opened before the probe was asked for.
  seedFlowCoverage(dumpFlowTree().map((line) => `open ${coverageScope(line.trim().split(' ')[0])}`));
  installFlowCoverage();
  window.addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flowCoverage()));
    } catch {
      // Storage full — the next page starts its own set.
    }
  });
  let machines: Record<string, Array<string>> | undefined;
  (window as unknown as {__conCoverage?: () => FlowCoverageReport}).__conCoverage = () => {
    // (The machines' universe is the same for the page's whole life: explored once, when first asked.)
    machines ??= machineUniverse();
    return {keys: flowCoverage(), machines, frames: ALL_WORKSPACE_KINDS.map((kind) => `frame:${kind}`)};
  };
}
