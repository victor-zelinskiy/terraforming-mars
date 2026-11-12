/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A LATCH IS A SCOPE (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §11 · S6).
 *
 * «Pending», «owed», «armed», «leaving», «in flight» — a piece of state that is RAISED at one moment of a flow and must
 * be LOWERED at another. Written as a bare `ref(false)` it is the oldest freeze of this codebase: every exit path must
 * remember to lower it, nothing says how long it has stood, and one early `return` leaves it raised for the rest of
 * the session (`commitFoldOwed` after a Floodgates blockade, 2026-10-28: every later commit of the game waited out a
 * 6 s ceiling — found only from a field export and a chain of saves).
 *
 * `scopedState(label, rest, owner?)` is a `Ref<T>` — read and written exactly like the `ref` it replaces — whose every
 * RAISED span is a `step` scope of the flow tree:
 *
 *   const commitFoldOwed = scopedState('commit-fold-owed', false);
 *   commitFoldOwed.value = true;      // opens  step:commit-fold-owed#7 — in the owner's scope
 *   commitFoldOwed.value = false;     // ends it
 *
 *  · it has an OWNER (`owner()` — a frame's scope, a run's; the session that stands when nothing is named) and FALLS
 *    BACK TO REST BY ITSELF when that owner ends: a latch cannot outlive what it belongs to;
 *  · it is VISIBLE: the tree dump, the field heartbeat's digest and `window.__conFlow()` name it with its age
 *    (`step:commit-fold-owed#7 41.2s`) — a latch left standing says so itself;
 *  · any value that is not `rest` is «raised» (a pending pick's record, a non-empty latch string), so the same form
 *    serves a flag and a held value.
 *
 * Give it the NARROWEST owner that is true: a latch of a workspace's flow names that frame
 * (`() => workspaceFrameScope('card-actions')`), a latch of a run names the run (`() => run.scope`). The session is the
 * honest default for one whose flow has no scope yet — it still gains the name, the age and the end.
 *
 * It is a `ref` for every reader and writer (the shell's proxy, a port's `UnwrapRef`, a `watch`): an assigned object
 * is made reactive as `ref` does, an unchanged value triggers nothing.
 */
import {customRef, reactive, toRaw} from 'vue';
import type {Ref} from 'vue';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

const isObject = (value: unknown): value is object => value !== null && typeof value === 'object';

export type ScopedStateOptions = {
  /**
   * Asked when the OWNER ends under a raised latch: may it stand on? `true` re-homes it under whatever `owner()`
   * answers NOW — the owner's successor — where it is asked again when that one ends. For a latch of the QUESTION that
   * the question's own answer still needs after the server has moved on (a pick whose receive scene plays that answer,
   * a composer under its landing scene). Never asked when the session itself is ending: nothing outlives that.
   */
  outlives?: () => boolean,
};

export function scopedState<T>(label: string, rest: T, owner: () => FlowScope | undefined = () => undefined, options: ScopedStateOptions = {}): Ref<T> {
  /** The raw value (what `ref` compares by) and what a reader gets (an object is reactive, as under `ref`). */
  let raw: T = toRaw(rest);
  let shown: T = rest;
  let standing: FlowScope<'step'> | undefined = undefined;
  let notify: () => void = () => {};
  const raised = (value: T): boolean => !Object.is(value, toRaw(rest));

  const open = (): void => {
    const session = consoleSessionScope();
    const named = owner();
    const home = named !== undefined && named.ended === undefined ? named : session;
    const scope = home.open('step', label);
    standing = scope;
    // THE OWNER ENDED UNDER A RAISED LATCH: it falls back to rest — nobody had to remember.
    scope.defer(() => {
      if (standing !== scope) {
        return;
      }
      standing = undefined;
      // …unless it says it outlives that owner, and there is a successor to stand under (never past its session).
      if (session.ended === undefined && options.outlives?.() === true) {
        const next = owner();
        if (next !== undefined && next.ended === undefined && next !== home) {
          open();
          return;
        }
      }
      raw = toRaw(rest);
      shown = rest;
      notify();
    });
  };

  return customRef<T>((track, trigger) => {
    notify = trigger;
    return {
      get(): T {
        track();
        return shown;
      },
      set(next: T): void {
        const nextRaw = toRaw(next);
        if (Object.is(nextRaw, raw)) {
          return;
        }
        raw = nextRaw;
        shown = isObject(nextRaw) ? reactive(nextRaw) as T : next;
        if (!raised(nextRaw)) {
          const scope = standing;
          standing = undefined;
          scope?.end();
        } else if (standing === undefined) {
          open();
        }
        trigger();
      },
    };
  });
}
