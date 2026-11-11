/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * FLOW SCOPE — the ONE ownership tree of the console, and the only way its code waits.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Every freeze the field reported was a lifetime nobody owned or a wait nobody bounded: a claim that outlived the frame
 * that hosted it, a hold raised at a scene's start and lowered by a callback that never fired, two flows each waiting
 * for a flag the other one lowers. The nets under them (the liveness ladder, the wait graph, the reapers) observe those
 * shapes after they have formed. This module removes the shapes:
 *
 *  ▸ A SCOPE is one run of something that has a lifetime — a submit, a frame, a claim, a scene's beat. It has an
 *    identity (`kind:label#seq`, never a flag), a parent, and it ENDS EXACTLY ONCE: `done`, `cancelled`, `failed` or
 *    `expired`. Ending it ends its children first, then runs everything registered in it (`defer`), then tells whoever
 *    waits for it. A thing opened in a scope cannot outlive it — there is no second call to forget.
 *
 *  ▸ A WAIT is an object with an owner, a target and a BOUND (required by the type). Its result is a discriminated
 *    union — `met | bound | cancelled | cycle` — so a caller cannot compile without saying what happens when the awaited
 *    thing does not come. Every standing wait is a row of the WAIT TABLE; the table is the wait graph, exact at every
 *    instant.
 *
 *  ▸ A wait for ANOTHER FLOW's end is checked twice before it is allowed to stand: against the kind table
 *    (`flowKinds.WAITS_ON` — a DAG, proven by a spec) and against the wait table itself — an edge that would close a
 *    cycle is REFUSED the moment it is asked for, and the asker takes its bound path at once. A mutual wait never
 *    stands, not even for a frame.
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────────────────────────────────────────────
 * Not a scheduler and not a state store. State with a protocol lives in a machine bound to a scope (`flowMachine.ts`);
 * derived facts stay Vue computeds. This module owns lifetimes and waits, nothing else.
 */
import {effectScope, shallowRef, watch} from 'vue';
import {flowClock} from '@/client/console/kernel/flowClock';
import {FlowKind, mayWaitOn, WaitsOn} from '@/client/console/kernel/flowKinds';
import {flowAnomaly, traceFlow} from '@/client/console/kernel/flowTrace';

// ── how a scope ends ────────────────────────────────────────────────────────────────────────────────────────────────

export type ScopeEnd =
  /** Its work is complete. */
  | {how: 'done'}
  /** Somebody ended it: its parent ended, the player backed out, the server moved on. */
  | {how: 'cancelled', reason: string}
  /** Its task threw. */
  | {how: 'failed', error: unknown}
  /** Its bound ended it. */
  | {how: 'expired', bound: string};

export function describeEnd(end: ScopeEnd): string {
  switch (end.how) {
  case 'done': return 'done';
  case 'cancelled': return `cancelled (${end.reason})`;
  case 'failed': return `failed (${String(end.error).slice(0, 160)})`;
  case 'expired': return `expired (${end.bound})`;
  }
}

// ── waits ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** How long a wait may stand. `quiet` — the bound is an honest schedule (say why); otherwise a bound that ends a wait
 *  is said once, `[flow] bound …`: a safety that fired is a lost signal or a hidden mutual wait upstream. */
export type Bound = {ms: number, quiet?: string};

export type WaitOptions<T = unknown> = (
  | {bound: Bound}
  /**
   * The PLAYER may take as long as they like — but only while something ACCEPTS the press: `accepts` is the scope of
   * the surface that takes it, and the wait is cancelled when that surface ends. «Waiting for a press nobody accepts»
   * is not a state.
   */
  | {bound: 'player', accepts: FlowScope}
) & {
  /**
   * Told SYNCHRONOUSLY, in the very call that settles the wait — before the promise's continuation (a microtask
   * later). For a reaction that must not lose a race with a timer armed for the same moment (a claim re-binding to its
   * host before its orphan bound fires).
   */
  onSettle?: (result: WaitResult<T>) => void,
};

export type WaitResult<T> =
  | {status: 'met', value: T}
  | {status: 'bound', afterMs: number}
  | {status: 'cancelled', reason: string}
  /** The wait was never allowed to stand: its edge would close a cycle (or the kind table forbids the pair). */
  | {status: 'cycle', path: ReadonlyArray<string>};

/** What a row of the wait table waits for — also what the legacy wait graph's adapter maps to its target kinds. */
export type WaitFamily = 'scope' | 'condition' | 'promise' | 'motion' | 'signal' | 'server' | 'player' | 'timer';

/**
 * Something that can be waited for. `K` is a PHANTOM: the kind of the foreign scope whose end is awaited (`never` for
 * every target that is not another flow), which is what lets `scope.wait` refuse a pair the kind table does not list.
 */
export type WaitTarget<T, K extends FlowKind = never> = {
  readonly family: WaitFamily,
  /** Names the awaited thing — the bound line says it when it never came. */
  readonly what: string,
  /** The scope whose end is awaited (`family: 'scope'`). */
  readonly on?: FlowScope,
  /** `true` — the awaited scope must be the waiter's own descendant (a parent joining what it started). */
  readonly join?: boolean,
  /** The phantom (never read). */
  readonly onKind?: K,
  /** Start listening; call `met` when it came (synchronously if it already has). Returns the stop. */
  arm(met: (value: T) => void): () => void,
};

export type RunOutcome<T> =
  | {status: 'done', value: T}
  | {status: 'failed', error: unknown}
  | {status: 'cancelled', reason: string}
  | {status: 'expired', bound: string};

export type RunOptions = {
  /** The run's own bound: past it the run's scope is `expired` (its cleanups run, its waits are cancelled). */
  bound?: Bound,
  /** The child scope's kind (default `task` — which waits by its parent's row of the kind table). */
  kind?: FlowKind,
};

// ── the scope ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FlowScope<K extends FlowKind = FlowKind> extends Disposable {
  /** The run's identity — `kind:label#seq`. */
  readonly id: string;
  readonly kind: K;
  readonly label: string;
  readonly parent: FlowScope | undefined;
  readonly openedAt: number;
  /** Aborted when the scope ends — hand it to `fetch`, to a listener's options, to anything that takes one. */
  readonly signal: AbortSignal;
  /** How it ended (`undefined` while it lives). Plain read. */
  readonly ended: ScopeEnd | undefined;
  /** REACTIVE: does it live? A computed / a template may read it. */
  isLive(): boolean;
  /** The scopes opened in this one that still live, in opening order. */
  readonly children: ReadonlyArray<FlowScope>;
  /** A free-form fact for the trace and the tree dump (a machine's state, a stage's name). */
  detail: string;

  /** Open a child. It ends with this scope, whatever else happens. */
  open<C extends FlowKind>(kind: C, label?: string): FlowScope<C>;
  /** Register a cleanup: run when the scope ends (LIFO), exactly once. Returns the unregister. */
  defer(cleanup: () => void): () => void;
  /** Be told when it has ended (after its cleanups). Called at once if it already has. Returns the unsubscribe. */
  onEnd(listener: (end: ScopeEnd) => void): () => void;
  /** End it (idempotent — the first end wins). */
  end(end?: ScopeEnd): void;
  /**
   * Run an async beat as a CHILD: its scope ends `done` when the task returns, `failed` when it throws (said once —
   * never a half-set flow), `expired` at its bound, `cancelled` with this scope. Never rejects.
   */
  run<T>(label: string, task: (scope: FlowScope<K>) => Promise<T> | T, options?: RunOptions): Promise<RunOutcome<T>>;
  /** Wait — bounded, declared, refused if it would close a cycle. Never rejects. */
  wait<T>(target: WaitTarget<T, WaitsOn<K>>, options: WaitOptions<T>): Promise<WaitResult<T>>;
  /** Sleep on the kernel's clock; `false` if the scope ended first. */
  sleep(ms: number): Promise<boolean>;
  /**
   * A CALLBACK on the kernel's clock, OWNED by this scope: it runs once, `ms` from now, in the timer's own task — and
   * NEVER after the scope has ended (the end takes it back). A row of the wait table for as long as it is pending, so a
   * dump names every timer that stands and whose it is. Returns the cancel (idempotent). What a raw `setTimeout` in a
   * flow becomes: a timer nobody owns fires into whatever stands there by then — the next game, a surface that left.
   */
  after(ms: number, what: string, run: () => void): () => void;
  /**
   * The same, on the page's FRAMES: `run` is called `count` animation frames from now (default the next one) — and
   * never after the scope has ended. What a raw `requestAnimationFrame` in a flow becomes («measure after the patch
   * has painted», «two frames for the fit to land»).
   */
  afterFrame(what: string, run: () => void, count?: number): () => void;
  /**
   * A frame LOOP owned by the scope: `tick` is called on every animation frame until it returns `false`, the returned
   * `stop` is called, or the scope ends — ONE row of the wait table for the loop's whole life. What a self-re-arming
   * `requestAnimationFrame` loop becomes (a counter's interpolation, a driver): it cannot go on painting a flow that
   * is gone. A window that does not paint calls no `tick` — what must happen anyway is a `guarantee` beside it.
   */
  everyFrame(what: string, tick: () => boolean | void): () => void;
  /**
   * A RELEASE that is GUARANTEED: `release` is called exactly once — when `ms` have passed, OR when the scope ends,
   * whichever comes first — unless the returned `disarm` is called before either (the thing it backs came by itself).
   * The opposite of `after`, and the two must not be confused: `after` is for what must NOT happen once the owner is
   * gone (the next step, an abort); `guarantee` is for what MUST happen even then (a promise somebody awaits, a gate, a
   * mark taken down). What the safety of a tween's promise becomes — `const safety = setTimeout(finish, budget)` …
   * `clearTimeout(safety)` is `const disarm = scope.guarantee(budget, what, finish)` … `disarm()`. `release` is never
   * called inside the `guarantee()` call itself (an owner already gone releases a microtask later).
   */
  guarantee(ms: number, what: string, release: () => void): () => void;
}

type WaitRow = {
  id: number,
  owner: ScopeImpl,
  family: WaitFamily,
  what: string,
  on: ScopeImpl | undefined,
  since: number,
  boundMs: number | undefined,
};

const table = new Map<number, WaitRow>();
/**
 * The rows that are EDGES — a wait for another scope's end. The cycle walk reads only these: timers, frames, conditions
 * and guaranteed releases (the bulk of the table once every hold and every director's safety stands in it) are not
 * edges, and a walk must not pay for them.
 */
const edges = new Set<WaitRow>();
const roots = new Set<ScopeImpl>();
const sequences = new Map<string, number>();
let nextWaitId = 1;

function nextSeq(kind: string): number {
  const n = (sequences.get(kind) ?? 0) + 1;
  sequences.set(kind, n);
  return n;
}

function isWithin(scope: ScopeImpl | undefined, ancestor: ScopeImpl): boolean {
  for (let s = scope; s !== undefined; s = s.parentImpl) {
    if (s === ancestor) {
      return true;
    }
  }
  return false;
}

/**
 * WOULD `owner → target` CLOSE A CYCLE? A scope cannot move on while anything inside it waits, so a node's out-edges
 * are the rows owned ANYWHERE IN ITS SUBTREE; the new edge closes a cycle when, following those edges from `target`,
 * the walk reaches `owner` or one of its ancestors (the new row lies in every ancestor's subtree). Returns the path of
 * scope ids, `[]` when the edge is safe.
 */
function waitCyclePath(owner: ScopeImpl, target: ScopeImpl): ReadonlyArray<string> {
  const seen = new Set<ScopeImpl>();
  const walk = (node: ScopeImpl, path: Array<string>): ReadonlyArray<string> => {
    if (isWithin(owner, node)) {
      return [...path, node.id];
    }
    if (seen.has(node)) {
      return [];
    }
    seen.add(node);
    for (const row of edges) {
      if (row.on !== undefined && isWithin(row.owner, node)) {
        const found = walk(row.on, [...path, node.id]);
        if (found.length > 0) {
          return found;
        }
      }
    }
    return [];
  };
  return walk(target, [owner.id]);
}

class ScopeImpl implements FlowScope {
  public readonly id: string;
  public readonly openedAt: number;
  public detail = '';
  private readonly controller = new AbortController();
  private readonly live = shallowRef(true);
  private readonly kids: Array<ScopeImpl> = [];
  private readonly cleanups: Array<() => void> = [];
  private readonly listeners: Array<(end: ScopeEnd) => void> = [];
  /** Standing waits owned by this scope — cancelled first when it ends. */
  public readonly cancels = new Set<(reason: string) => void>();
  private result: ScopeEnd | undefined;

  constructor(
    public readonly kind: FlowKind,
    public readonly label: string,
    public readonly parentImpl: ScopeImpl | undefined,
  ) {
    this.id = `${kind}${label === '' ? '' : ':' + label}#${nextSeq(kind)}`;
    this.openedAt = flowClock().now();
    traceFlow(this.openedAt, 'open', this.id, parentImpl === undefined ? '' : `in ${parentImpl.id}`);
  }

  get parent(): FlowScope | undefined {
    return this.parentImpl;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get ended(): ScopeEnd | undefined {
    return this.result;
  }

  get children(): ReadonlyArray<FlowScope> {
    return this.kids;
  }

  /** The kind whose row of the kind table this scope waits by: a `task` waits as the flow it is a beat of. */
  get effectiveKind(): FlowKind {
    for (let s: ScopeImpl | undefined = this; s !== undefined; s = s.parentImpl) {
      if (s.kind !== 'task') {
        return s.kind;
      }
    }
    return 'task';
  }

  isLive(): boolean {
    return this.live.value;
  }

  open<C extends FlowKind>(kind: C, label = ''): FlowScope<C> {
    const child = new ScopeImpl(kind, label, this);
    if (this.result !== undefined) {
      // Opened in a scope that has already ended: it is born ended — nothing can be parked under a dead owner.
      child.end({how: 'cancelled', reason: `opened in ended ${this.id}`});
    } else {
      this.kids.push(child);
    }
    return child as unknown as FlowScope<C>;
  }

  defer(cleanup: () => void): () => void {
    if (this.result !== undefined) {
      // The owner is already gone: the resource is released at once rather than leaked.
      this.runGuarded(cleanup, 'a cleanup registered after the end threw');
      return () => {};
    }
    this.cleanups.push(cleanup);
    return () => {
      const i = this.cleanups.indexOf(cleanup);
      if (i !== -1) {
        this.cleanups.splice(i, 1);
      }
    };
  }

  onEnd(listener: (end: ScopeEnd) => void): () => void {
    if (this.result !== undefined) {
      listener(this.result);
      return () => {};
    }
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i !== -1) {
        this.listeners.splice(i, 1);
      }
    };
  }

  end(end: ScopeEnd = {how: 'done'}): void {
    if (this.result !== undefined) {
      return;
    }
    this.result = end;
    const how = describeEnd(end);
    this.controller.abort(how);
    // 1. Its own standing waits let go — whoever awaited them reads `cancelled`.
    for (const cancel of [...this.cancels]) {
      cancel(how);
    }
    // 2. Its children end, youngest first — nothing inside outlives it.
    for (const child of [...this.kids].reverse()) {
      child.end({how: 'cancelled', reason: `${this.id} ${how}`});
    }
    // 3. Everything it acquired is released, LIFO.
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      this.runGuarded(cleanup, 'a cleanup threw');
    }
    // 4. It leaves the tree.
    if (this.parentImpl !== undefined) {
      const i = this.parentImpl.kids.indexOf(this);
      if (i !== -1) {
        this.parentImpl.kids.splice(i, 1);
      }
    } else {
      roots.delete(this);
    }
    this.live.value = false;
    traceFlow(flowClock().now(), 'end', this.id, how);
    // 5. Whoever waited for its end is told.
    for (const listener of this.listeners.splice(0)) {
      this.runGuarded(() => listener(end), 'an end listener threw');
    }
  }

  [Symbol.dispose](): void {
    this.end();
  }

  run<T>(label: string, task: (scope: FlowScope) => Promise<T> | T, options?: RunOptions): Promise<RunOutcome<T>> {
    const child = this.open(options?.kind ?? 'task', label) as unknown as ScopeImpl;
    return new Promise<RunOutcome<T>>((resolve) => {
      let value: T | undefined;
      let timer: unknown;
      child.onEnd((end) => {
        flowClock().clearTimeout(timer);
        switch (end.how) {
        case 'done': resolve({status: 'done', value: value as T}); break;
        case 'failed': resolve({status: 'failed', error: end.error}); break;
        case 'cancelled': resolve({status: 'cancelled', reason: end.reason}); break;
        case 'expired': resolve({status: 'expired', bound: end.bound}); break;
        }
      });
      if (child.ended !== undefined) {
        return;
      }
      const bound = options?.bound;
      if (bound !== undefined) {
        timer = flowClock().setTimeout(() => {
          if (child.ended !== undefined) {
            return;
          }
          if (bound.quiet === undefined) {
            console.warn(`[flow] bound ${child.id} — the run did not end in ${bound.ms} ms; ended on its bound`);
          }
          traceFlow(flowClock().now(), 'bound', child.id, `run ${bound.ms}ms`);
          child.end({how: 'expired', bound: `${label} ${bound.ms}ms`});
        }, bound.ms);
      }
      let work: Promise<T>;
      try {
        work = Promise.resolve(task(child));
      } catch (error) {
        work = Promise.reject(error);
      }
      work.then((v) => {
        value = v;
        child.end({how: 'done'});
      }, (error) => {
        if (child.ended === undefined) {
          flowAnomaly(flowClock().now(), child.id, 'the task threw — its scope ends failed', error);
        }
        child.end({how: 'failed', error});
      });
    });
  }

  wait<T>(target: WaitTarget<T, FlowKind>, options: WaitOptions<T>): Promise<WaitResult<T>> {
    const clock = flowClock();
    const since = clock.now();
    const told = (result: WaitResult<T>): WaitResult<T> => {
      if (options.onSettle !== undefined) {
        try {
          options.onSettle(result);
        } catch (error) {
          flowAnomaly(clock.now(), this.id, `the wait's onSettle threw («${target.what}»)`, error);
        }
      }
      return result;
    };
    if (this.result !== undefined) {
      return Promise.resolve(told({status: 'cancelled', reason: `${this.id} had ended`}));
    }
    const on = target.on as ScopeImpl | undefined;
    if (on !== undefined && on.ended === undefined) {
      const refused = this.refusal(target, on);
      if (refused !== undefined) {
        return Promise.resolve(told(refused));
      }
    }
    const boundMs = options.bound === 'player' ? undefined : options.bound.ms;
    const row: WaitRow = {id: nextWaitId++, owner: this, family: target.family, what: target.what, on, since, boundMs};
    table.set(row.id, row);
    if (on !== undefined) {
      edges.add(row);
    }
    traceFlow(since, 'wait', this.id, `${target.family} «${target.what}»${boundMs === undefined ? '' : ` ≤${boundMs}ms`}`);
    return new Promise<WaitResult<T>>((resolve) => {
      let settled = false;
      let stopArm: (() => void) | undefined;
      let timer: unknown;
      let offAccepts: (() => void) | undefined;
      const settle = (result: WaitResult<T>): void => {
        if (settled) {
          return;
        }
        settled = true;
        table.delete(row.id);
        edges.delete(row);
        this.cancels.delete(cancel);
        clock.clearTimeout(timer);
        offAccepts?.();
        stopArm?.();
        const now = clock.now();
        if (result.status === 'met') {
          traceFlow(now, 'met', this.id, `«${target.what}» after ${now - since}ms`);
        } else if (result.status === 'bound') {
          traceFlow(now, 'bound', this.id, `«${target.what}» ${result.afterMs}ms`);
          if (options.bound !== 'player' && options.bound.quiet === undefined) {
            console.warn(`[flow] bound ${this.id} — «${target.what}» did not come in ${result.afterMs} ms; the wait ended on its bound`);
          }
        } else if (result.status === 'cancelled') {
          traceFlow(now, 'cancel', this.id, `«${target.what}» — ${result.reason}`);
        }
        resolve(told(result));
      };
      const cancel = (reason: string): void => settle({status: 'cancelled', reason});
      this.cancels.add(cancel);
      if (options.bound === 'player') {
        offAccepts = options.accepts.onEnd((end) => cancel(`nothing accepts the press any more — ${options.accepts.id} ${describeEnd(end)}`));
      } else {
        timer = clock.setTimeout(() => settle({status: 'bound', afterMs: clock.now() - since}), options.bound.ms);
      }
      if (settled) {
        return;
      }
      let stop: (() => void) | undefined;
      try {
        stop = target.arm((value) => settle({status: 'met', value}));
      } catch (error) {
        flowAnomaly(clock.now(), this.id, `the wait for «${target.what}» could not be armed`, error);
        cancel('its target threw while arming');
      }
      if (settled) {
        stop?.();
      } else {
        stopArm = stop;
      }
    });
  }

  sleep(ms: number): Promise<boolean> {
    return this.wait(delay(ms), {bound: {ms: ms + 60_000, quiet: 'a sleep ends on its own timer'}})
      .then((result) => result.status === 'met');
  }

  after(ms: number, what: string, run: () => void): () => void {
    if (this.result !== undefined) {
      return () => {};
    }
    const clock = flowClock();
    const row: WaitRow = {id: nextWaitId++, owner: this, family: 'timer', what, on: undefined, since: clock.now(), boundMs: ms};
    table.set(row.id, row);
    let timer: unknown = undefined;
    const take = (): void => {
      table.delete(row.id);
      this.cancels.delete(take);
      clock.clearTimeout(timer);
    };
    this.cancels.add(take);
    timer = clock.setTimeout(() => {
      take();
      this.runGuarded(run, `the timer «${what}» threw`);
    }, ms);
    return take;
  }

  guarantee(ms: number, what: string, release: () => void): () => void {
    let owed = true;
    let cancelTimer: () => void = () => {};
    let offEnd: () => void = () => {};
    const fire = (): void => {
      if (!owed) {
        return;
      }
      owed = false;
      cancelTimer();
      offEnd();
      this.runGuarded(release, `the guaranteed release «${what}» threw`);
    };
    if (this.result !== undefined) {
      // Asked of an owner that is gone: the release is not parked, it happens — in a task of its own, never inside this
      // call (the caller's `const disarm = scope.guarantee(…)` is not assigned yet, and its release may use it).
      void Promise.resolve().then(fire);
      return () => {
        owed = false;
      };
    }
    cancelTimer = this.after(ms, what, fire);
    // …and the owner ending first is the other way it comes due (told after the timer has been taken back).
    offEnd = this.onEnd(fire);
    return () => {
      owed = false;
      cancelTimer();
      offEnd();
    };
  }

  afterFrame(what: string, run: () => void, count = 1): () => void {
    if (this.result !== undefined) {
      return () => {};
    }
    const clock = flowClock();
    const row: WaitRow = {id: nextWaitId++, owner: this, family: 'timer', what, on: undefined, since: clock.now(), boundMs: undefined};
    table.set(row.id, row);
    let left = Math.max(1, count);
    let cancelFrame: () => void = () => {};
    const take = (): void => {
      table.delete(row.id);
      this.cancels.delete(take);
      cancelFrame();
    };
    const step = (): void => {
      if (--left > 0) {
        cancelFrame = clock.nextFrame(step);
        return;
      }
      take();
      this.runGuarded(run, `the frame callback «${what}» threw`);
    };
    this.cancels.add(take);
    cancelFrame = clock.nextFrame(step);
    return take;
  }

  everyFrame(what: string, tick: () => boolean | void): () => void {
    if (this.result !== undefined) {
      return () => {};
    }
    const clock = flowClock();
    const row: WaitRow = {id: nextWaitId++, owner: this, family: 'timer', what, on: undefined, since: clock.now(), boundMs: undefined};
    table.set(row.id, row);
    let stopped = false;
    let cancelFrame: () => void = () => {};
    const stop = (): void => {
      if (stopped) {
        return;
      }
      stopped = true;
      table.delete(row.id);
      this.cancels.delete(stop);
      cancelFrame();
    };
    const step = (): void => {
      if (stopped) {
        return;
      }
      let more: boolean | void = false;
      try {
        more = tick();
      } catch (error) {
        flowAnomaly(clock.now(), this.id, `the frame loop «${what}» threw — stopped`, error);
      }
      if (more === false || stopped) {
        stop();
        return;
      }
      cancelFrame = clock.nextFrame(step);
    };
    this.cancels.add(stop);
    cancelFrame = clock.nextFrame(step);
    return stop;
  }

  /** The two laws of a wait for another flow's end — the kind table, then the wait table. */
  private refusal<T>(target: WaitTarget<T, FlowKind>, on: ScopeImpl): WaitResult<T> | undefined {
    const now = flowClock().now();
    if (target.join === true) {
      if (!isWithin(on, this) || on === this) {
        flowAnomaly(now, this.id, `LAW — joined(${on.id}) is not its own descendant; the wait is refused`);
        return {status: 'cycle', path: [this.id, on.id]};
      }
      return undefined;
    }
    if (isWithin(this, on)) {
      flowAnomaly(now, this.id, `LAW — it waits for the end of its own ancestor ${on.id} (that end cancels it); the wait is refused`);
      return {status: 'cycle', path: [this.id, on.id, this.id]};
    }
    if (!isWithin(on, this) && !mayWaitOn(this.effectiveKind, on.effectiveKind)) {
      flowAnomaly(now, this.id, `LAW — «${this.effectiveKind}» may not wait for the end of «${on.effectiveKind}» (${on.id}): the pair is not in WAITS_ON; the wait is refused`);
      return {status: 'cycle', path: [this.id, on.id]};
    }
    const path = waitCyclePath(this, on);
    if (path.length > 0) {
      traceFlow(now, 'cycle', this.id, path.join(' → '));
      console.warn(`[flow] cycle refused ${path.join(' → ')} — «${target.what}» is not waited for; the asker takes its bound path now`);
      return {status: 'cycle', path};
    }
    return undefined;
  }

  private runGuarded(fn: () => void, what: string): void {
    try {
      fn();
    } catch (error) {
      flowAnomaly(flowClock().now(), this.id, what, error);
    }
  }
}

// ── roots ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Open a ROOT scope (the session; a spec). Everything else is opened inside one. */
export function openFlowRoot<K extends FlowKind>(kind: K, label = ''): FlowScope<K> {
  const root = new ScopeImpl(kind, label, undefined);
  roots.add(root);
  return root as unknown as FlowScope<K>;
}

// ── targets ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The end of ANOTHER flow. The pair must be in the kind table; the edge must not close a cycle. */
export function ended<K extends FlowKind>(scope: FlowScope<K>, what?: string): WaitTarget<ScopeEnd, K> {
  return {
    family: 'scope',
    what: what ?? `${scope.id} ends`,
    on: scope,
    arm: (met) => scope.onEnd(met),
  };
}

/** The end of the waiter's OWN descendant — a parent joining what it started (always allowed, never a cycle). */
export function joined(child: FlowScope, what?: string): WaitTarget<ScopeEnd> {
  return {
    family: 'scope',
    what: what ?? `${child.id} ends`,
    on: child,
    join: true,
    arm: (met) => child.onEnd(met),
  };
}

/**
 * A REACTIVE condition — LEVEL-triggered: true now resolves now, so there is no edge to miss. `read` returns the value
 * to resolve with (anything falsy = not yet). It must read reactive state; a source that cannot be (layout, a foreign
 * clock) says so with `polledMs` and is re-read on that period as well.
 */
export function until<T>(what: string, read: () => T | undefined | null | false | 0 | '', options?: {polledMs?: number}): WaitTarget<T> {
  return {
    family: 'condition',
    what,
    arm: (met) => {
      let stopped = false;
      const check = (): T | undefined => {
        try {
          const value = read();
          return value === undefined || value === null || value === false || value === 0 || value === '' ? undefined : value as T;
        } catch (error) {
          flowAnomaly(flowClock().now(), 'wait', `the condition «${what}» threw — read as not yet`, error);
          return undefined;
        }
      };
      // Detached: a wait armed inside a component's setup must not die with that component's effect scope.
      const es = effectScope(true);
      es.run(() => {
        watch(check, (value) => {
          if (value !== undefined && !stopped) {
            met(value);
          }
        }, {immediate: true, flush: 'sync'});
      });
      let poll: unknown;
      const rearm = (): void => {
        poll = flowClock().setTimeout(() => {
          if (stopped) {
            return;
          }
          const value = check();
          if (value !== undefined) {
            met(value);
          } else {
            rearm();
          }
        }, options?.polledMs ?? 0);
      };
      if (options?.polledMs !== undefined) {
        rearm();
      }
      return () => {
        stopped = true;
        es.stop();
        flowClock().clearTimeout(poll);
      };
    },
  };
}

/**
 * A condition RE-READ ON THE CLOCK, every `everyMs` — and only there (true now resolves now). Two cases call for it
 * rather than `until`: a source that is not reactive at all (layout, a foreign module's plain state), and a condition
 * whose CONSEQUENCE must run in a task of its own — `until` wakes inside the very stretch that made the condition true,
 * before that stretch has finished saying what else changed («a decision that ACTS has a place in the tick»).
 */
export function polled<T>(what: string, read: () => T | undefined | null | false | 0 | '', everyMs: number): WaitTarget<T> {
  return {
    family: 'condition',
    what,
    arm: (met) => {
      let stopped = false;
      let timer: unknown;
      const check = (): boolean => {
        let value: T | undefined | null | false | 0 | '';
        try {
          value = read();
        } catch (error) {
          flowAnomaly(flowClock().now(), 'wait', `the condition «${what}» threw — read as not yet`, error);
          value = undefined;
        }
        if (value === undefined || value === null || value === false || value === 0 || value === '') {
          return false;
        }
        met(value as T);
        return true;
      };
      const rearm = (): void => {
        timer = flowClock().setTimeout(() => {
          if (!stopped && !check()) {
            rearm();
          }
        }, Math.max(1, everyMs));
      };
      if (!check()) {
        rearm();
      }
      return () => {
        stopped = true;
        flowClock().clearTimeout(timer);
      };
    },
  };
}

/** Any promise. A rejection is a value here (`ok: false`) — a wait never throws. */
export function settled<T>(what: string, promise: PromiseLike<T>, family: WaitFamily = 'promise'): WaitTarget<{ok: true, value: T} | {ok: false, error: unknown}> {
  return {
    family,
    what,
    arm: (met) => {
      let stopped = false;
      promise.then((value) => {
        if (!stopped) {
          met({ok: true, value});
        }
      }, (error) => {
        if (!stopped) {
          met({ok: false, error});
        }
      });
      return () => {
        stopped = true;
      };
    },
  };
}

/** The minimal surface of a GSAP tween / timeline (typed structurally — the kernel does not depend on gsap). */
export type GsapLike = {
  then(onFulfilled?: (value: unknown) => unknown): PromiseLike<unknown>,
  eventCallback(type: string, callback?: ((...args: Array<unknown>) => void) | null): unknown,
};

/** The minimal surface of a Web Animation. */
export type WaapiLike = {finished: PromiseLike<unknown>};

/**
 * A MOTION — resolved when it completes AND when it is interrupted (a killed tween never fires `onComplete`; a
 * cancelled Web Animation rejects `finished`): `completed` says which. The hang this target exists to remove is the
 * `await` around a tween that was killed.
 */
export function motion(what: string, animation: GsapLike | WaapiLike): WaitTarget<{completed: boolean}> {
  return {
    family: 'motion',
    what,
    arm: (met) => {
      let stopped = false;
      const finish = (completed: boolean): void => {
        if (!stopped) {
          stopped = true;
          met({completed});
        }
      };
      if ('finished' in animation) {
        animation.finished.then(() => finish(true), () => finish(false));
      } else {
        void animation.then(() => finish(true));
        const previous = animation.eventCallback('onInterrupt');
        animation.eventCallback('onInterrupt', function(this: unknown, ...args: Array<unknown>) {
          if (typeof previous === 'function') {
            (previous as (...a: Array<unknown>) => void).apply(this, args);
          }
          finish(false);
        });
      }
      return () => {
        stopped = true;
      };
    },
  };
}

/** A span of the kernel's clock. Always met (never needs its bound). */
export function delay(ms: number): WaitTarget<true> {
  return {
    family: 'motion',
    what: `${ms}ms`,
    arm: (met) => {
      const timer = flowClock().setTimeout(() => met(true), ms);
      return () => flowClock().clearTimeout(timer);
    },
  };
}

/**
 * `count` animation FRAMES from now (the page has painted that many times). BOUND IT with a real span: a hidden tab
 * paints nothing, and a wait for a frame that never comes is the await the bound exists for.
 */
export function frames(count = 1): WaitTarget<true> {
  return {
    family: 'motion',
    what: count === 1 ? 'the next frame' : `${count} frames`,
    arm: (met) => {
      let left = Math.max(1, count);
      let stopped = false;
      let cancelFrame: () => void = () => {};
      const step = (): void => {
        if (stopped) {
          return;
        }
        if (--left > 0) {
          cancelFrame = flowClock().nextFrame(step);
        } else {
          met(true);
        }
      };
      cancelFrame = flowClock().nextFrame(step);
      return () => {
        stopped = true;
        cancelFrame();
      };
    },
  };
}

/** A one-shot event source: `emit` wakes everybody waiting on it NOW; a later waiter waits for the next emit. */
export type FlowSignal<T> = {
  emit(value: T): void,
  /** Be told at the next emit (once). Returns the unsubscribe. */
  once(listener: (value: T) => void): () => void,
};

export function createFlowSignal<T = void>(): FlowSignal<T> {
  const waiting = new Set<(value: T) => void>();
  return {
    emit: (value) => {
      for (const listener of [...waiting]) {
        waiting.delete(listener);
        listener(value);
      }
    },
    once: (listener) => {
      waiting.add(listener);
      return () => waiting.delete(listener);
    },
  };
}

/** The next emit of a signal — `family` says who answers (the player's press, the server, a motion's event). */
export function signalled<T>(what: string, source: FlowSignal<T>, family: WaitFamily = 'signal'): WaitTarget<T> {
  return {family, what, arm: (met) => source.once(met)};
}

// ── reading the structure (diagnosis, the supervisor, the legacy wait graph's adapter) ──────────────────────────────

export type WaitTableRow = {
  /** The waiting scope. */
  owner: string,
  ownerKind: FlowKind,
  family: WaitFamily,
  what: string,
  /** The awaited scope, for a wait on another flow's end. */
  on?: string,
  since: number,
  boundMs?: number,
};

/** Every wait standing now — the wait graph, exact. */
export function waitTable(): Array<WaitTableRow> {
  return [...table.values()].map((row) => ({
    owner: row.owner.id,
    ownerKind: row.owner.effectiveKind,
    family: row.family,
    what: row.what,
    ...(row.on !== undefined ? {on: row.on.id} : {}),
    since: row.since,
    ...(row.boundMs !== undefined ? {boundMs: row.boundMs} : {}),
  }));
}

/** The live tree as lines — `frame:hand#3 4.2s committed  ⟵ waits «submit#31 ends» 1.1s/60s`. */
export function dumpFlowTree(now: number = flowClock().now()): Array<string> {
  const lines: Array<string> = [];
  const visit = (scope: ScopeImpl, depth: number): void => {
    const waits = [...table.values()].filter((row) => row.owner === scope)
      .map((row) => `«${row.what}» ${((now - row.since) / 1000).toFixed(1)}s${row.boundMs === undefined ? '' : '/' + (row.boundMs / 1000).toFixed(0) + 's'}`);
    lines.push(`${'  '.repeat(depth)}${scope.id} ${((now - scope.openedAt) / 1000).toFixed(1)}s` +
      `${scope.detail === '' ? '' : ' ' + scope.detail}${waits.length === 0 ? '' : '  ⟵ waits ' + waits.join(', ')}`);
    for (const child of scope.children as ReadonlyArray<ScopeImpl>) {
      visit(child, depth + 1);
    }
  };
  for (const root of roots) {
    visit(root, 0);
  }
  return lines;
}

/**
 * The live tree as ONE line for a field heartbeat — every scope below the roots, oldest first, bounded:
 * `frame:hand#3 committed⟵submit#31 ends | scene:played-hero#12`. Built only when asked (a standing second, a stall).
 */
export function flowTreeDigest(limit = 14): string {
  const parts: Array<string> = [];
  const visit = (scope: ScopeImpl, depth: number): void => {
    if (depth > 0) {
      const waits = [...table.values()].filter((row) => row.owner === scope && row.family !== 'timer').map((row) => row.what);
      parts.push(`${scope.id}${scope.detail === '' ? '' : ' ' + scope.detail}${waits.length === 0 ? '' : '⟵' + waits.join('+')}`);
    }
    for (const child of scope.children as ReadonlyArray<ScopeImpl>) {
      visit(child, depth + 1);
    }
  };
  for (const root of roots) {
    visit(root, 0);
  }
  return parts.length <= limit ? parts.join(' | ') : `${parts.slice(0, limit).join(' | ')} | +${parts.length - limit}`;
}

/** How many scopes live (a leak check for specs; the supervisor's sanity read). */
export function liveScopeCount(): number {
  let n = 0;
  const visit = (scope: ScopeImpl): void => {
    n++;
    for (const child of scope.children as ReadonlyArray<ScopeImpl>) {
      visit(child);
    }
  };
  for (const root of roots) {
    visit(root);
  }
  return n;
}

/** Test seam: end every root, forget the sequences. */
export function resetFlowKernel(): void {
  for (const root of [...roots]) {
    root.end({how: 'cancelled', reason: 'kernel reset'});
  }
  table.clear();
  edges.clear();
  sequences.clear();
  nextWaitId = 1;
}
