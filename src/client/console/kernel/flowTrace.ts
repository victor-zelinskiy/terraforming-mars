/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * THE KERNEL'S TRACE — what stood where, and how it ended.
 *
 * Every scope's open and end (with the reason), every wait (begun · met · bound · cycle · cancelled) and every machine
 * transition is one compact record in a ring. The field recorder's heartbeat, the console export and the main
 * process's hang watch read it; an e2e harvest reads the ANOMALIES (a failed task, a cleanup that threw, a refused
 * cycle, a bound that ended a wait) which are also said once on the console — `[flow] …`.
 *
 * No Vue, no DOM: the ring is plain data, a listener is a plain function.
 */

export type FlowTraceKind =
  | 'open' // a scope opened
  | 'end' // a scope ended (detail = how)
  | 'wait' // a wait began
  | 'met' // the awaited thing came
  | 'bound' // the bound ended the wait / the run
  | 'cycle' // a wait was refused: its edge would have closed a cycle
  | 'cancel' // a wait ended because its owner (or what accepted it) ended
  | 'state' // a machine moved
  | 'anomaly'; // a failed task, a throwing cleanup, a law violation at run time

export type FlowTraceRecord = {
  at: number,
  kind: FlowTraceKind,
  /** The scope the record is about (`frame:hand#12`). */
  scope: string,
  /** What happened, in a few words. */
  detail: string,
};

const RING = 400;
const ring: Array<FlowTraceRecord> = [];
const listeners = new Set<(record: FlowTraceRecord) => void>();

/** Counted evidence (`__conFlow().stats`): how often each thing happened since the page loaded. */
export const flowTraceStats: Record<FlowTraceKind, number> = {
  open: 0, end: 0, wait: 0, met: 0, bound: 0, cycle: 0, cancel: 0, state: 0, anomaly: 0,
};

export function traceFlow(at: number, kind: FlowTraceKind, scope: string, detail: string): void {
  const record = {at, kind, scope, detail};
  flowTraceStats[kind]++;
  ring.push(record);
  if (ring.length > RING) {
    ring.shift();
  }
  for (const listener of listeners) {
    try {
      listener(record);
    } catch {
      // A diagnostic listener never breaks the flow it observes.
    }
  }
}

/**
 * An ANOMALY — said once on the console as well as traced. Every line names the scope and its ancestry, so a field
 * export reads «what, inside what» without a debugger. The e2e harness harvests `[flow]` lines per test.
 */
export function flowAnomaly(at: number, scope: string, detail: string, cause?: unknown): void {
  traceFlow(at, 'anomaly', scope, detail);
  if (cause !== undefined) {
    console.warn(`[flow] ${scope} — ${detail}`, cause);
  } else {
    console.warn(`[flow] ${scope} — ${detail}`);
  }
}

/** The ring, oldest first (a copy). */
export function flowTrace(): Array<FlowTraceRecord> {
  return [...ring];
}

/** The last `count` records as compact lines (`+12.3s end frame:hand#4 done`), newest last. */
export function flowTraceLines(count = 60, now?: number): Array<string> {
  const tail = ring.slice(-count);
  const base = now ?? (tail.length > 0 ? tail[tail.length - 1].at : 0);
  return tail.map((r) => `${((r.at - base) / 1000).toFixed(1)}s ${r.kind} ${r.scope}${r.detail === '' ? '' : ' ' + r.detail}`);
}

/** Subscribe to the trace (the field recorder). Returns the unsubscribe. */
export function onFlowTrace(listener: (record: FlowTraceRecord) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam. */
export function resetFlowTrace(): void {
  ring.splice(0);
  for (const key of Object.keys(flowTraceStats) as Array<FlowTraceKind>) {
    flowTraceStats[key] = 0;
  }
}
