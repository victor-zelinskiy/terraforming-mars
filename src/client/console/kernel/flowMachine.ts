/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * A MACHINE IN A SCOPE — how a lifecycle with a protocol in time (the submit funnel, a frame's phase, a claim, the
 * announce plate) lives on the kernel.
 *
 *  · The actor runs on the kernel's clock, so every `after` (a state's BOUND) is a unit test with a manual clock.
 *  · It stops with its scope: a machine cannot outlive the run it describes, and its timers go with it.
 *  · Its snapshot is a `shallowRef` written by ONE writer (the actor's own subscription), synchronously with the send
 *    that caused it — reactive by construction: a computed, a template, a `watch` may read it, and there is no plain
 *    `let` for a cache to latch on (CLAUDE.md invariant 17 holds without a witness for state kept here).
 *  · Every transition is a trace record, and the scope's `detail` carries the current state — the tree dump reads
 *    «what stood where» off the structure.
 *
 * The machines themselves are plain XState v5 definitions and must pass the LAW (`flowLaw.ts`): every state is `rest`,
 * `player` or `beat`; a beat has its bound; no state is a trap.
 */
import {ShallowRef, shallowRef} from 'vue';
import {Actor, AnyActorLogic, createActor, EventFromLogic, InputFrom, SnapshotFrom} from 'xstate';
import {flowClock} from '@/client/console/kernel/flowClock';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {flowAnomaly, traceFlow} from '@/client/console/kernel/flowTrace';

export type FlowActor<L extends AnyActorLogic> = {
  readonly actor: Actor<L>,
  /** REACTIVE — the one mirror of the machine's state. */
  readonly snapshot: Readonly<ShallowRef<SnapshotFrom<L>>>,
  send(event: EventFromLogic<L>): void,
};

export type FlowActorOptions<L extends AnyActorLogic> = {
  input?: InputFrom<L>,
  /** End the scope `done` when the machine reaches a final state (default true): the run is over when its machine is. */
  endScopeOnDone?: boolean,
};

function stateOf(snapshot: unknown): string {
  const value = (snapshot as {value?: unknown}).value;
  return value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
}

/** Start `logic` as the machine of `scope`. Stops with the scope; ends the scope when it is done (unless told not to). */
export function startFlowActor<L extends AnyActorLogic>(scope: FlowScope, logic: L, options?: FlowActorOptions<L>): FlowActor<L> {
  const clock = flowClock();
  const actor = createActor(logic, {
    ...(options?.input !== undefined ? {input: options.input} : {}),
    clock: {
      setTimeout: (fn: () => void, ms: number) => clock.setTimeout(fn, ms),
      clearTimeout: (id: unknown) => clock.clearTimeout(id),
    },
    id: scope.id,
  } as Parameters<typeof createActor<L>>[1]);
  const snapshot = shallowRef(actor.getSnapshot()) as ShallowRef<SnapshotFrom<L>>;
  let last = stateOf(snapshot.value);
  scope.detail = last;
  actor.subscribe({
    next: (next) => {
      snapshot.value = next as SnapshotFrom<L>;
      const state = stateOf(next);
      if (state !== last) {
        traceFlow(flowClock().now(), 'state', scope.id, `${last} → ${state}`);
        last = state;
        scope.detail = state;
      }
      if ((next as {status?: string}).status === 'done' && options?.endScopeOnDone !== false) {
        scope.end({how: 'done'});
      }
    },
    error: (error) => {
      flowAnomaly(flowClock().now(), scope.id, 'its machine threw — the scope ends failed', error);
      scope.end({how: 'failed', error});
    },
  });
  scope.defer(() => actor.stop());
  if (scope.ended === undefined) {
    actor.start();
    // A machine may be done the moment it starts (its input already says so).
    snapshot.value = actor.getSnapshot() as SnapshotFrom<L>;
  }
  return {
    actor,
    snapshot,
    send: (event) => {
      if (scope.ended === undefined) {
        actor.send(event);
      }
    },
  };
}
