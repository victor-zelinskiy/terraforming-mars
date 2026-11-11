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
import {shallowRef} from 'vue';
import {FlowScope, ScopeEnd} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

export type FlowRunOptions = {
  /**
   * The run was ended by its OWNER's end, not by the flow: the session it stood in is gone. Bring the module's state
   * to rest (its abort — final poses, holds released, flags lowered). Called once, after the run's scope has ended.
   */
  orphaned?: () => void,
};

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
  const end = (how: ScopeEnd = {how: 'done'}): void => {
    const scope = current.value;
    if (scope !== undefined) {
      current.value = undefined; // first: the scope's end listener then knows the flow ended it itself
      scope.end(how);
    }
  };
  return {
    begin: (detail) => {
      end({how: 'cancelled', reason: 'a new run began'});
      const scope = consoleSessionScope().open('scene', label);
      if (detail !== undefined) {
        scope.detail = detail;
      }
      current.value = scope;
      scope.onEnd(() => {
        if (current.value !== scope) {
          return; // the flow ended it (or began another)
        }
        current.value = undefined;
        try {
          options.orphaned?.();
        } catch (error) {
          console.warn(`[flow] ${scope.id} — its «orphaned» recovery threw`, error);
        }
      });
      return scope;
    },
    get scope() {
      return current.value;
    },
    live: () => current.value !== undefined,
    end,
    after: (ms, what, fn) => current.value?.after(ms, what, fn) ?? (() => {}),
    afterFrame: (what, fn, count) => current.value?.afterFrame(what, fn, count) ?? (() => {}),
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
