/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * THE KERNEL'S STATE SPACE, WALKED — what a session actually exercised, as a set of keys.
 *
 * The monkey was a blind walk: it could not say how much of the console's behaviour it had been through, so «zero
 * freezes found» proved nothing about what it never reached. The kernel already names the space — every lifetime is a
 * scope with a kind and a label, every wait is a row, every lifecycle with a protocol in time is a machine — and its
 * trace says each step. This module turns the trace into COVERAGE KEYS:
 *
 *   open  <kind:label>                  a flow of that name ran
 *   end   <kind:label> <how>            …and ended that way (done · cancelled · failed · expired)
 *   state <kind:label> <from> → <to>    a machine's transition (a frame's label is its workspace: kind × phase for free)
 *   wait  <kind:label> <family>         it waited on that family (a scope's end, a condition, a motion, the server…)
 *   bound <kind:label>                  a bound ended one of its waits / its run
 *   cycle <kind:label>                  one of its waits was refused as a cycle
 *
 * with what varies between two runs of one flow taken out of the name (the run's number, a prompt's id, the card a
 * claim was placed for). The monkey reads the set per walk (`window.__conCoverage()` — `console/flowCoverageProbe.ts`),
 * the report unions it over a run and sets it against the UNIVERSE (what the sources declare, what the machines can
 * do) — «N % walked», and the list of what was never reached, which the next run steers at
 * (docs/claude/console/freeze-zero/PLAN.md §3.1).
 *
 * OFF unless asked (`installFlowCoverage()`): with no listener the trace costs what it always cost, and nothing here
 * runs in a player's game.
 */
import {FlowTraceRecord, onFlowTrace} from '@/client/console/kernel/flowTrace';

const covered = new Set<string>();
let stop: (() => void) | undefined;

/**
 * A scope's id without what varies between two runs of ONE flow: `frame:hand#3` → `frame:hand`, `question:card#12` →
 * `question:card`, `claim:hand/Ganymede Colony#7` → `claim:hand` (a claim is its host's — the card is the table's).
 */
export function coverageScope(id: string): string {
  const plain = id.replace(/#[0-9a-z]*/gi, '').replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim();
  return plain.startsWith('claim:') ? plain.split('/')[0] : plain;
}

/** The key one trace record marks — `undefined` for a record that adds nothing a key of its scope does not say. */
export function coverageKeyOf(record: Pick<FlowTraceRecord, 'kind' | 'scope' | 'detail'>): string | undefined {
  const scope = coverageScope(record.scope);
  switch (record.kind) {
  case 'open':
    return `open ${scope}`;
  case 'end':
    // `done` · `cancelled (reason)` · `failed (error)` · `expired (bound)` — how, never why.
    return `end ${scope} ${record.detail.split(/[ (]/)[0]}`;
  case 'state':
    return `state ${scope} ${record.detail.replace(/\d+/g, 'N')}`;
  case 'wait':
    // `<family> «what» ≤Nms` — the family is the wait's kind; «what» is prose.
    return `wait ${scope} ${record.detail.split(' ')[0]}`;
  case 'bound':
    return `bound ${scope}`;
  case 'cycle':
    return `cycle ${scope}`;
  default:
    // `met` / `cancel` end a wait already counted; an `anomaly` is a finding of its own (a `[flow]` line).
    return undefined;
  }
}

/** Start marking (idempotent). Returns the stop. */
export function installFlowCoverage(): () => void {
  stop ??= onFlowTrace((record) => {
    const key = coverageKeyOf(record);
    if (key !== undefined) {
      covered.add(key);
    }
  });
  return () => {
    stop?.();
    stop = undefined;
  };
}

/** Keys an earlier page of the same walk marked (a reload keeps the walk's coverage whole). */
export function seedFlowCoverage(keys: ReadonlyArray<string>): void {
  for (const key of keys) {
    covered.add(key);
  }
}

/** The keys marked so far (sorted — two walks compare as sets). */
export function flowCoverage(): Array<string> {
  return [...covered].sort();
}

/** Test seam. */
export function resetFlowCoverage(): void {
  stop?.();
  stop = undefined;
  covered.clear();
}
