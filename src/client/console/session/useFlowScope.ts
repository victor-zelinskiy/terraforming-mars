/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A COMPONENT'S OWN SCOPE (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §10 · C1).
 *
 * A console component that waits — a beat's timer, a tween it awaits, «the next frame» — waits IN A SCOPE THAT ENDS
 * WITH IT. `useFlowScope('deck-draw-layer')` (in `setup()`) opens a `surface` scope in the session that stands and
 * ends it when the component is unmounted; everything the component arms in it (`flow.after(…)`, `flow.sleep(…)`,
 * `flow.wait(…)`, `flow.run(…)`) is taken back at that moment. There is no `beforeUnmount` list of `clearTimeout`s to
 * keep, and no timer that fires on an instance that has left — the callback that «just» lowered a flag of the NEXT
 * surface to mount there.
 *
 *   setup() {
 *     return {flow: useFlowScope('deck-draw-layer')};
 *   },
 *   …
 *   this.flow.after(motionMs(240), 'the fan settles', () => this.settle());
 *
 * ⚠ A RELEASE NEVER RIDES A TIMER OF THE COMPONENT. What must happen even if the component leaves first (a hold let
 * go, a module flag lowered, a promise resolved) is a CLEANUP of the scope — `flow.defer(() => hold.release())` — or
 * lives in the scope of the thing it releases (`hold.scope.after(…)`). A timer is for what should NOT happen once the
 * component is gone.
 */
import {markRaw, onUnmounted} from 'vue';
import {FlowKind} from '@/client/console/kernel/flowKinds';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

export function useFlowScope(label: string): FlowScope<'surface'>;
export function useFlowScope<K extends FlowKind>(label: string, kind: K): FlowScope<K>;
export function useFlowScope(label: string, kind: FlowKind = 'surface'): FlowScope {
  // Raw: a scope is an owner, not state — it must never be walked by a reactive proxy if it lands in `data()`.
  const scope = markRaw(consoleSessionScope().open(kind, label));
  onUnmounted(() => scope.end({how: 'cancelled', reason: 'its component was unmounted'}));
  return scope;
}
