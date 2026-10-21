/**
 * WHERE THE SECONDS GO — the per-test timing ledger of the e2e driver (the e2e speed iteration, phase 0,
 * `docs/claude/e2e-speed-iteration.md`).
 *
 * Every driver primitive that WAITS books its wall time into a named bucket, and the harness fixture
 * (`consoleTest.ts` `timingLedger`) resets the ledger per test, books the spec's own raw
 * `page.waitForTimeout` sleeps, and writes the result as a `timing` annotation + one JSON line per test
 * (`TM_E2E_TIMINGS=<file>`) for `scripts/e2e-timings-report.mjs`.
 *
 * Buckets are LEAVES (they never nest into each other's totals): `boot` (openConsole), `reload`,
 * `fixture` (the load-game POST), `press` (the whole press: echo wait + its fixed settle, the settle
 * counted again in `pressSleep`), `settle`, `beat` (cinematicBeat), `sleep` (a spec's bare
 * waitForTimeout). `home` (waitForBoardHome) is WALL time that includes its own presses — reported
 * beside the leaves, never summed with them. What no bucket claims is the product + the assertions.
 *
 * A sleep taken INSIDE a timed primitive is the primitive's (the bucket stack), so the spec's `sleep`
 * bucket counts only what the spec itself wrote.
 */
export type TimingBucket = 'boot' | 'bootShell' | 'bootLoad' | 'bootVeil' | 'reload' | 'fixture' | 'home' | 'press' | 'pressSleep' | 'settle' | 'beat' | 'sleep';

type Cell = {ms: number, n: number};

const ledger = new Map<TimingBucket, Cell>();
const stack: Array<TimingBucket> = [];
let testStartedAt = 0;

export function resetTiming(): void {
  ledger.clear();
  stack.length = 0;
  testStartedAt = Date.now();
}

export function noteTiming(bucket: TimingBucket, ms: number): void {
  const cell = ledger.get(bucket) ?? {ms: 0, n: 0};
  cell.ms += ms;
  cell.n += 1;
  ledger.set(bucket, cell);
}

/** The bucket a nested sleep belongs to (undefined = the spec's own). */
export function currentTimingBucket(): TimingBucket | undefined {
  return stack[stack.length - 1];
}

/** Book `fn`'s wall time into `bucket`; sleeps inside it belong to the bucket too. */
export async function timed<T>(bucket: TimingBucket, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  stack.push(bucket);
  try {
    return await fn();
  } finally {
    stack.pop();
    noteTiming(bucket, Date.now() - t0);
  }
}

export type TimingSnapshot = {
  totalMs: number,
  buckets: Partial<Record<TimingBucket, Cell>>,
  /** total − every LEAF bucket (home excluded — it contains presses). */
  restMs: number,
};

const LEAVES: ReadonlyArray<TimingBucket> = ['boot', 'reload', 'fixture', 'press', 'settle', 'beat', 'sleep'];

export function snapshotTiming(): TimingSnapshot {
  const totalMs = Date.now() - testStartedAt;
  const buckets: Partial<Record<TimingBucket, Cell>> = {};
  let leaves = 0;
  for (const [k, v] of ledger) {
    buckets[k] = {...v};
    if (LEAVES.includes(k)) {
      leaves += v.ms;
    }
  }
  return {totalMs, buckets, restMs: Math.max(0, totalMs - leaves)};
}

const s = (ms: number) => (ms / 1000).toFixed(1);

/** One line for the annotation: `total 16.6s · boot 3.1 · press 5.6 (8×, sleep 5.6) · …· rest 4.1`. */
export function formatTiming(t: TimingSnapshot): string {
  const b = t.buckets;
  const cell = (k: TimingBucket, label = k) => b[k] === undefined ? undefined : `${label} ${s(b[k]!.ms)} (${b[k]!.n}×)`;
  const parts = [
    `total ${s(t.totalMs)}s`,
    // boot's three legs: the shell painted (goto + bundle), `.con-load` gone, the GPU warm-up veil gone
    b.boot === undefined ? undefined : `boot ${s(b.boot.ms)} (${b.boot.n}×: shell ${s(b.bootShell?.ms ?? 0)} · load ${s(b.bootLoad?.ms ?? 0)} · veil ${s(b.bootVeil?.ms ?? 0)})`,
    cell('reload'),
    cell('fixture'),
    b.home === undefined ? undefined : `home ${s(b.home.ms)} (wall)`,
    b.press === undefined ? undefined : `press ${s(b.press.ms)} (${b.press.n}×, sleep ${s(b.pressSleep?.ms ?? 0)})`,
    cell('settle'),
    cell('beat'),
    cell('sleep'),
    `rest ${s(t.restMs)}`,
  ];
  return parts.filter((p): p is string => p !== undefined).join(' · ');
}
