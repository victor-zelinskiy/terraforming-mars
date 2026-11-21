/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A MODULE FLOW'S RUN (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §10 · C4).
 *
 * A flow kept in module state — a ceremony, an armed transport gate, a director's sequence — has ONE run at a time:
 * it begins (the press that arms it, the answer that seeds it), plays, and ends on one of several paths (it landed, it
 * was refused, its safety fired, a net expired it, the game screen left). Written by hand that is a flag (`active`),
 * a handful of timer ids, and a `clearTimeout` in every exit path — and the path that forgets one is a callback firing
 * into the NEXT run, or a flag that stands into the next game.
 *
 * `createFlowRun(label, …)` makes the run a SCOPE of the flow tree:
 *
 *   const run = createFlowRun('colony-build', {orphaned: () => abortColonyBuild()});
 *   …
 *   run.begin();                                              // the press arms the gate
 *   run.after(ARM_SAFETY_MS, 'the arm\'s safety', abort);     // owned: taken back when the run ends
 *   await run.sleep(motionMs(120));                           // false when the run ended first
 *   run.end();                                                // every exit path — idempotent
 *
 *  · the run is `scene:<label>#n` in the session that stands when it begins — the tree names it, with its age and the
 *    timers it waits on;
 *  · everything armed in it ends with it: there is no timer id to keep and none to clear;
 *  · a run begun over a standing one ends the old one first (`cancelled: a new run began`) — two runs of one flow
 *    never share timers;
 *  · when the SESSION ends under it (the game screen left mid-flow) the run is cancelled and `orphaned` is called — the
 *    module's own abort. That is the `reset…()` row of the shell's teardown, owned by the flow instead of by a list.
 *
 * `live()` is reactive: a computed / a hold supplier may read «the flow is running» off the run itself.
 */
import {effectScope, shallowRef, watch} from 'vue';
import {FlowKind} from '@/client/console/kernel/flowKinds';
import {FlowScope, ScopeEnd} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

export type FlowRunOptions = {
  /**
   * The run was ended by its OWNER's end, not by the flow: the session it stood in is gone. Bring the module's state
   * to rest (its abort — final poses, holds released, flags lowered). Called once, after the run's scope has ended.
   */
  orphaned?: () => void,
  /**
   * What the run IS in the tree (default `scene` — a flow that plays). `surface` for a run that stands for the PLAYER
   * (a pick, a step's entry: it does not play, it waits to be answered); `story` for one the board owes; `step` for a
   * step a frame owes.
   */
  kind?: Extract<FlowKind, 'scene' | 'surface' | 'story' | 'step'>,
  /**
   * Whose the run is (default: the session that stands when it begins — `consoleSessionScope()`). A flow that lives
   * across game screens (the scene transition itself) names the page: `() => consoleAppScope()`.
   */
  owner?: () => FlowScope,
  /**
   * THE FLOW'S FLAG IS THE RUN'S LIFE (FREEZE ZERO, stage 3 — PLAN § 8: «a flag IS a scope's life»). Called with `true`
   * when the run begins and with `false` when its scope ENDS — by any path there is: the flow's own `end`, a new run
   * beginning over it, the session leaving under it, its ceiling (then AFTER `orphaned`, which reads it). The module
   * writes its «I am playing» NOWHERE else.
   *
   * What it replaces: `state.active = true` after `run.begin()` and `state.active = false` in every exit path — where
   * the path that throws before its lowering line (an end skipped by an exception, a recovery that threw first) leaves
   * the flag up for good. A raised scene flag parks the view's commit, holds the foreground and locks the pad; the
   * audit of 2026-11-15 found that every one of the nine view scenes could stick that way.
   */
  flag?: (up: boolean) => void,
  /**
   * THE RUN'S LAST BOUND. A run still standing `ceilingMs` after it began is ended `expired` by the KERNEL's own timer
   * — nothing of the module's has to run for that — its flag falls with it, and `orphaned` brings the module to rest
   * (the same honest ending as a session that left under it). It is said (`[flow] bound … — the run did not end …`).
   * Set it PAST every lawful life of the scene (its hold's own ceiling ends a healthy wedge long before): this is the
   * bound of «the module's own ending did not happen».
   */
  ceilingMs?: number,
};

/**
 * The default last bound of a scene's run: twice the hold registry's ceiling (`animationHold.DEFAULT_MAX_HOLD_MS`,
 * 35 s — «no scene lawfully outlives it»): by then the hold's own `expire` has run and failed to end the scene.
 */
export const SCENE_RUN_CEILING_MS = 70_000;

export type FlowRun = {
  /** Open the run (a run still standing ends first). Returns its scope. */
  begin(detail?: string): FlowScope<'scene'>,
  /** The run that stands — `undefined` at rest. Plain read. */
  readonly scope: FlowScope<'scene'> | undefined,
  /** REACTIVE: does a run stand? */
  live(): boolean,
  /** The run is over (idempotent — every exit path calls it). */
  end(end?: ScopeEnd): void,
  /** A callback `ms` from now, owned by the standing run (nothing at rest). Returns the cancel. */
  after(ms: number, what: string, fn: () => void): () => void,
  /** A callback `count` frames from now, owned by the standing run (nothing at rest). Returns the cancel. */
  afterFrame(what: string, fn: () => void, count?: number): () => void,
  /** A tick of the standing run every `ms` (`tick` returns `false` to stop) — nothing at rest. Returns the stop. */
  every(ms: number, what: string, tick: () => boolean | void): () => void,
  /** A frame loop of the standing run (`tick` returns `false` to stop) — nothing at rest. Returns the stop. */
  everyFrame(what: string, tick: () => boolean | void): () => void,
  /** A span of the standing run: `true` when it passed, `false` when the run ended first (or none stands). */
  sleep(ms: number): Promise<boolean>,
  /**
   * A GUARANTEED release of the standing run: called once, at `ms` or when the run ends, unless disarmed first. With no
   * run standing it comes due AT ONCE (a microtask later — never inside this call): a release is never parked on
   * nothing. Returns the disarm.
   */
  guarantee(ms: number, what: string, release: () => void): () => void,
};

export function createFlowRun(label: string, options: FlowRunOptions = {}): FlowRun {
  const current = shallowRef<FlowScope<'scene'> | undefined>(undefined);
  const lower = (who: string): void => {
    if (options.flag === undefined) {
      return;
    }
    try {
      options.flag(false);
    } catch (error) {
      console.warn(`[flow] ${who} — its flag's lowering threw`, error);
    }
  };
  const end = (how: ScopeEnd = {how: 'done'}): void => {
    const scope = current.value;
    if (scope !== undefined) {
      current.value = undefined; // first: the scope's end listener then knows the flow ended it itself
      scope.end(how);
    }
    // (…and with NO run standing the flow's end still says «I am not playing»: a flag that somebody raised past the run
    // — a spec arranging a state by hand — does not outlive the module's own ending.)
    if (scope === undefined) {
      lower(`scene:${label}`);
    }
  };
  return {
    begin: (detail) => {
      end({how: 'cancelled', reason: 'a new run began'});
      const scope = (options.owner?.() ?? consoleSessionScope()).open(options.kind ?? 'scene', label) as FlowScope<'scene'>;
      if (detail !== undefined) {
        scope.detail = detail;
      }
      current.value = scope;
      if (options.ceilingMs !== undefined) {
        const ms = options.ceilingMs;
        // (An owned timer of the run: taken back by its end — it fires only over a run that outlived every other bound.
        // Ended through the SCOPE, never `end()`: the end listener below then reads «the flow did not end it» and runs
        // the module's own recovery.)
        scope.after(ms, 'the run\'s ceiling', () => {
          console.warn(`[flow] bound ${scope.id} — the run did not end in ${ms} ms; ended on its ceiling`);
          scope.end({how: 'expired', bound: `${label} ${ms}ms`});
        });
      }
      scope.onEnd(() => {
        // (`current` is this scope only when the flow did NOT end it itself — the session left, its ceiling came.)
        if (current.value === scope) {
          current.value = undefined;
          try {
            options.orphaned?.();
          } catch (error) {
            console.warn(`[flow] ${scope.id} — its «orphaned» recovery threw`, error);
          }
        }
        // THE FLAG FALLS WITH THE SCOPE — LAST, and whatever happened above: the module's recovery reads «I am playing»
        // to know there is something to bring to rest (every abort begins `if (!state.active …) return`), so it runs
        // first; a recovery that threw, or one that never reached its own lowering line, leaves no flag behind.
        lower(scope.id);
      });
      // (Raised once the end listener stands: no path can end the run above a raised flag.)
      options.flag?.(true);
      return scope;
    },
    get scope() {
      return current.value;
    },
    live: () => current.value !== undefined,
    end,
    after: (ms, what, fn) => current.value?.after(ms, what, fn) ?? (() => {}),
    afterFrame: (what, fn, count) => current.value?.afterFrame(what, fn, count) ?? (() => {}),
    every: (ms, what, tick) => current.value?.every(ms, what, tick) ?? (() => {}),
    everyFrame: (what, tick) => current.value?.everyFrame(what, tick) ?? (() => {}),
    sleep: (ms) => current.value?.sleep(ms) ?? Promise.resolve(false),
    guarantee: (ms, what, release) => {
      const scope = current.value;
      if (scope === undefined) {
        // No run stands: the release is not parked on nothing — it happens, a microtask later (never inside this call).
        let owed = true;
        void Promise.resolve().then(() => {
          if (owed) {
            owed = false;
            release();
          }
        });
        return () => {
          owed = false;
        };
      }
      return scope.guarantee(ms, what, release);
    },
  };
}

/**
 * A RUN DERIVED FROM STATE — for a flow kept as a reactive RECORD that several writers move (a module seeds it, a
 * section component plays it, a reset `Object.assign`s it away): there is no one `begin` and no one `end` to hook, and
 * a pair written beside every writer is exactly the bookkeeping that diverges. The run instead STANDS WHILE the
 * record says the flow does: `standing()` is a reactive predicate over the record («something is promised, owed or
 * playing»); the run opens on its rising edge and ends on its falling one — whoever wrote the state. Derived cannot
 * diverge (the lesson of the hold suppliers).
 *
 * The watcher is synchronous and only RECORDS (it opens / ends a scope, it decides nothing), so the tree is exact at
 * every instant. When the session ends under a standing run, `orphaned` brings the module to rest (its reset) — the
 * predicate then falls by itself.
 */
export function deriveFlowRun(label: string, standing: () => boolean, options: FlowRunOptions & {detail?: () => string} = {}): {
  /** The run that stands — `undefined` at rest. */
  readonly scope: FlowScope<'scene'> | undefined,
  /** Stop deriving (a test's teardown; a module is never unloaded). */
  stop(): void,
} {
  const run = createFlowRun(label, options);
  const read = (): boolean => {
    try {
      return standing() === true;
    } catch {
      return false; // a predicate that throws reads as «at rest» — a diagnosis must never break the flow it describes
    }
  };
  // Detached: the watcher is the module's, not a component's that happened to import it first.
  const es = effectScope(true);
  es.run(() => {
    watch(read, (on) => {
      if (on) {
        if (!run.live()) {
          run.begin(options.detail?.());
        }
      } else {
        run.end();
      }
    }, {immediate: true, flush: 'sync'});
  });
  return {
    get scope() {
      return run.scope;
    },
    stop: () => es.stop(),
  };
}

