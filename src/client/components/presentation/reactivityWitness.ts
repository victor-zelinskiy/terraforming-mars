/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 */
/*
 * REACTIVITY WITNESS — the ONE answer to «a module predicate that a CACHE reads changed without telling the cache».
 *
 * THE CLASS. This console is built on module-level flow state read through caches it does not own: a Vue `computed`
 * in the shell (the prompt admission signals), the animation-hold registry's `counts` and its per-supplier `watch`.
 * A cache re-evaluates only when a REACTIVE dependency moves, so a predicate that reads one plain `let` / array / Map
 * beside its reactive terms is a LATCH: when that term alone changes, every cache keeps its last answer for good.
 *  · the dead board of 2026-10-30 — `remoteLandingOwed()` read the remote stage's plain `draining`; the shell's
 *    `remote-landing` block cached `true` and held every placement of the game with NO grid until a reload;
 *  · the dead game of `hand-delivery`'s `activeRuns` (a supplier pinned true for a session);
 *  · the 35 s «force-released» alarm over an idle `tile-placement-remote` (a missed FALLING edge).
 * The rule «a predicate reads reactive state only» was a convention, and a convention is broken by the next author.
 *
 * THE CONTRACT, MADE CHECKABLE: «the predicate's value changes ONLY at a reactive edge». `reactivePredicate(label,
 * read)` declares such a predicate where it is DEFINED (never at its call sites) and returns the function to export.
 * Beside it the witness runs a SYNCHRONOUS watcher over the same `read`: it re-reads the predicate at every reactive
 * edge of its dependencies and remembers the value it had there (`atLastEdge`). `auditReactivity()` compares that
 * with a fresh read — and the two can differ ONLY when the value moved with no reactive edge, which is exactly the
 * condition under which a cache, evaluated at any moment after that edge, can hold a stale answer. The check does not
 * depend on WHEN the consumers evaluated (a lazy witness cache re-reads at the audit and misses the latch — the first
 * cut of this module did; `tests/client/console/reactivityWitness.spec.ts` § the latch window pins the difference).
 * On a difference:
 *  1. it NAMES the latch — `[reactivity] «label» changed without a reactive edge (at the last edge → now)` — once per
 *     label, so a field log says which predicate lied (the dead board's log said nothing at all);
 *  2. it HEALS — every read of the exported predicate subscribes to that predicate's own epoch, so bumping it
 *     re-evaluates exactly the caches that read THIS predicate (never a global invalidation);
 *  3. the bump is itself an edge: the watcher re-reads and the witness stands at the fresh value.
 * A predicate that legitimately reads a non-reactive source (a clock, the DOM) declares it — `{polled: '<why>'}` — and
 * is healed every audit without being reported: the poll is then a stated property, not an accident.
 *
 * WHO RUNS THE AUDIT. The console's 1 s tick (`runForegroundWatchdog`) — so in the field a latch costs ≤ 1 s and
 * names itself; the client unit suite after EVERY test (`tests/client/components/bundleSetup.ts` — a latch fails the
 * run with the test that produced it: 7900 specs become the scanner); the e2e harness reds the warn on every spec.
 * The animation-hold registry declares every supplier through here, so all of them are witnessed by construction.
 *
 * COST: one extra read of a declared predicate per reactive edge of its dependencies (the sync watcher) — the
 * predicates are cheap boolean reads by contract, the same reads every consumer already makes.
 */
import {shallowRef, ShallowRef, watch, WatchStopHandle} from 'vue';

export type ReactivePredicateOptions<T> = {
  /**
   * The predicate reads a source no cache can subscribe to (a clock, layout) BY DESIGN — say why. It is then healed
   * on every audit (its consumers re-read it at the tick) and never reported as a contract violation.
   */
  polled?: string,
  /** Value equality for a non-primitive answer (default `Object.is`). */
  equals?: (a: T, b: T) => boolean,
};

/** The exported predicate: call it like the plain function it replaces. */
export type ReactivePredicate<T> = (() => T) & {
  readonly label: string,
  /** Remove it from the audit (a per-instance predicate's owner going away; a re-registration). */
  dispose(): void,
};

export type ReactivityLatch = {
  label: string,
  /** What the predicate answered at its last reactive edge — what every cache evaluated since may still hold. */
  cached: unknown,
  /** What the predicate answers now. */
  now: unknown,
  at: number,
};

type Entry = {
  label: string,
  read: () => unknown,
  equals: (a: unknown, b: unknown) => boolean,
  polled: string | undefined,
  /** Read by every consumer through the exported predicate — the heal bumps it. */
  epoch: ShallowRef<number>,
  /** The sync watcher over `read` — undefined until the first audit arms it (module state may not exist yet). */
  stop: WatchStopHandle | undefined,
  /** The value at the last reactive edge (the watcher's last read). */
  atLastEdge: unknown,
};

const entries = new Map<string, Entry>();
const warned = new Set<string>();
const recent: Array<ReactivityLatch> = [];
const RECENT_MAX = 20;
/** No value read yet (a throwing read) — never equal to anything. */
const UNREAD = Symbol('unread');

/** Diagnostics (the `__foregroundDiag` idiom). */
export const reactivityWitnessStats = {
  audits: 0,
  /** Contract violations found (non-`polled`). */
  latches: 0,
  /** Every heal, `polled` ones included. */
  heals: 0,
};

function guardedRead(entry: Entry): unknown {
  try {
    return entry.read();
  } catch {
    return UNREAD;
  }
}

/** Start the sync watcher (idempotent). It reads the epoch too, so a heal is an edge the watcher sees. */
function arm(entry: Entry): void {
  if (entry.stop !== undefined) {
    return;
  }
  entry.stop = watch(() => {
    void entry.epoch.value;
    return guardedRead(entry);
  }, (value) => {
    entry.atLastEdge = value;
  }, {flush: 'sync', immediate: true});
}

/**
 * Declare a module predicate that caches read. Use the RETURNED function in place of the plain one — every read
 * subscribes to the predicate's own heal epoch. Re-declaring a label replaces the previous entry (HMR, specs).
 */
export function reactivePredicate<T>(label: string, read: () => T, options?: ReactivePredicateOptions<T>): ReactivePredicate<T> {
  entries.get(label)?.stop?.();
  const entry: Entry = {
    label,
    read,
    equals: (options?.equals as ((a: unknown, b: unknown) => boolean) | undefined) ?? Object.is,
    polled: options?.polled,
    epoch: shallowRef(0),
    stop: undefined,
    atLastEdge: UNREAD,
  };
  entries.set(label, entry);
  const predicate = (() => {
    void entry.epoch.value;
    return read();
  }) as ReactivePredicate<T>;
  Object.defineProperty(predicate, 'label', {value: label});
  predicate.dispose = () => {
    if (entries.get(label) === entry) {
      entry.stop?.();
      entries.delete(label);
    }
  };
  return predicate;
}

/**
 * ONE PASS: compare every predicate's value at its last reactive edge with a fresh read; heal and name every latch.
 * Returns the contract violations found in this pass (never the `polled` heals). Cheap — one read per predicate.
 */
export function auditReactivity(): ReadonlyArray<ReactivityLatch> {
  reactivityWitnessStats.audits++;
  const found: Array<ReactivityLatch> = [];
  for (const entry of entries.values()) {
    if (entry.stop === undefined) {
      arm(entry); // the first look arms the watcher at the current value; there is nothing to compare yet
      continue;
    }
    const cached = entry.atLastEdge;
    const fresh = guardedRead(entry);
    if (fresh === UNREAD || cached === UNREAD) {
      entry.atLastEdge = fresh;
      continue;
    }
    if (entry.equals(cached, fresh)) {
      continue;
    }
    // THE HEAL: every cache that read this predicate re-evaluates; the bump is an edge, so the watcher re-reads too.
    entry.epoch.value++;
    entry.atLastEdge = fresh;
    reactivityWitnessStats.heals++;
    if (entry.polled !== undefined) {
      continue;
    }
    const latch: ReactivityLatch = {label: entry.label, cached, now: fresh, at: Date.now()};
    found.push(latch);
    recent.push(latch);
    if (recent.length > RECENT_MAX) {
      recent.shift();
    }
    reactivityWitnessStats.latches++;
    if (!warned.has(entry.label)) {
      warned.add(entry.label);
      console.warn(`[reactivity] «${entry.label}» changed without a reactive edge (at the last edge ${describe(cached)} → now ${describe(fresh)}) — a non-reactive term latched every cache that reads it; healed`);
    }
  }
  return found;
}

function describe(value: unknown): string {
  if (value === undefined || value === null || typeof value !== 'object') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[object]';
  }
}

/** The last latches found (diagnostics surfaces / e2e readers). */
export function recentReactivityLatches(): ReadonlyArray<ReactivityLatch> {
  return [...recent];
}

/** The declared labels (a guard spec reads the inventory). */
export function reactivePredicateLabels(): ReadonlyArray<string> {
  return [...entries.keys()];
}

/** Test-only: forget the warn-once memory and the ring (the entries stay — they are module definitions). */
export function resetReactivityWitnessForTest(): void {
  warned.clear();
  recent.length = 0;
}
