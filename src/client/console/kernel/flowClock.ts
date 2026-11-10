/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * THE KERNEL'S CLOCK — one injectable source of «now» and of timers for every bound the kernel keeps (a wait's bound, a
 * bounded run, a machine's `after`). Injectable so that every timer path of every lifecycle is a unit test: a spec
 * installs a manual clock and advances it, never sleeps.
 *
 * The shape is XState's `Clock` (`setTimeout` / `clearTimeout`) plus `now()`, so the same object is handed to
 * `createActor(…, {clock})`.
 */

export type FlowClock = {
  now(): number,
  setTimeout(fn: () => void, ms: number): unknown,
  clearTimeout(handle: unknown): void,
};

const REAL_CLOCK: FlowClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    // Under Node (the spec runners) a standing bound must not keep the process alive after the last test: a frame left
    // in a beat by a spec holds a three-minute timer. A browser's handle is a number — nothing to do.
    (handle as unknown as {unref?: () => void}).unref?.();
    return handle;
  },
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

let current: FlowClock = REAL_CLOCK;

/** The clock every kernel timer reads. */
export function flowClock(): FlowClock {
  return current;
}

/** Install a clock (tests); `undefined` puts the real one back. Returns the previous clock. */
export function setFlowClock(clock: FlowClock | undefined): FlowClock {
  const previous = current;
  current = clock ?? REAL_CLOCK;
  return previous;
}

/**
 * A MANUAL clock for specs and model-based runs: time moves only when `advance` is called, and the timers due inside
 * the advanced span fire in due order (a timer armed by a firing timer fires in the same advance if it is due).
 */
export type ManualFlowClock = FlowClock & {
  advance(ms: number): void,
  /** How many timers stand armed (a leak check for specs). */
  pending(): number,
};

export function createManualClock(start = 0): ManualFlowClock {
  let now = start;
  let nextId = 1;
  const timers = new Map<number, {at: number, fn: () => void, order: number}>();
  return {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, {at: now + Math.max(0, ms), fn, order: id});
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
    advance: (ms) => {
      const until = now + Math.max(0, ms);
      for (;;) {
        let dueId: number | undefined;
        let due: {at: number, fn: () => void, order: number} | undefined;
        for (const [id, t] of timers) {
          if (t.at <= until && (due === undefined || t.at < due.at || (t.at === due.at && t.order < due.order))) {
            due = t;
            dueId = id;
          }
        }
        if (due === undefined || dueId === undefined) {
          break;
        }
        timers.delete(dueId);
        now = Math.max(now, due.at);
        due.fn();
      }
      now = until;
    },
    pending: () => timers.size,
  };
}
