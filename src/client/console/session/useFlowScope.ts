/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A COMPONENT'S OWN SCOPE (architecture v2 — docs/claude/console/architecture-v2/PLAN.md §10 · C1).
 *
 * A console component that waits — a beat's timer, a tween it awaits, «the next frame» — waits IN A SCOPE THAT ENDS
 * WITH IT. `useFlowScope('deck-draw-layer')` (in `setup()` / `<script setup>`) opens a `surface` scope and ends it when
 * the component is unmounted — in the session of THE SHELL IT IS RENDERED IN, or in the page's scope when it stands
 * outside any shell
 * (a menu, an app-level layer; `componentSessionScope`); everything the component arms in it (`flow.after(…)`, `flow.sleep(…)`,
 * `flow.wait(…)`, `flow.run(…)`) is taken back at that moment. There is no `beforeUnmount` list of `clearTimeout`s to
 * keep, and no timer that fires on an instance that has left — the callback that «just» lowered a flag of the NEXT
 * surface to mount there.
 *
 *   // <script setup lang="ts"> — the form of every NEW component (and of a Vapor one)
 *   const flow = useFlowScope('deck-draw-layer');
 *   flow.after(motionMs(240), 'the fan settles', settle);
 *
 *   // an Options-API component that has not been converted yet
 *   setup() {
 *     return {flow: useFlowScope('deck-draw-layer')};
 *   },
 *   …
 *   this.flow.after(motionMs(240), 'the fan settles', () => this.settle());
 *
 * WHAT IT IS BOUND TO (Vue 3.6 — `docs/claude/vapor/ROADMAP.md` §3): the caller's EFFECT SCOPE and the injection
 * context — never a component INSTANCE (`getCurrentInstance()` is `null` inside a Vapor component). So the same call
 * serves a virtual-DOM component, a Vapor one, and a composable run in a bare `effectScope()` (a controller under a
 * spec, with no mount at all):
 *  · inside a component the scope ends on the component's `unmounted` edge — after its children, after the patch
 *    (the edge every existing release was written against);
 *  · a component the runtime never calls `unmounted` for — a Vapor component removed before it was mounted has its
 *    effect scope stopped and no hook — is ended by its effect scope's disposal, one tick later at most;
 *  · in a bare effect scope it ends when that scope stops, at once.
 *
 * THE SCOPE IS LAZY: it is opened by the first thing the component asks of it. Most instances of a leaf component (a
 * board cell, a card's art, a journal chip — hundreds on one screen) never wait for anything; they open nothing, stand
 * in no dump and write nothing to the flow trace (whose ring is the last 800 records of the FLOWS — a board's mount
 * must not flush it). An instance that arms a timer gets its scope then, in the owner read at `setup()`.
 *
 * ⚠ A RELEASE NEVER RIDES A TIMER OF THE COMPONENT. What must happen even if the component leaves first (a hold let
 * go, a module flag lowered, a promise resolved) is a CLEANUP of the scope — `flow.defer(() => hold.release())` — or
 * lives in the scope of the thing it releases (`hold.scope.after(…)`). A timer is for what should NOT happen once the
 * component is gone.
 */
import {getCurrentScope, hasInjectionContext, markRaw, nextTick, onScopeDispose, onUnmounted} from 'vue';
import {FlowKind} from '@/client/console/kernel/flowKinds';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {componentSessionScope} from '@/client/console/session/consoleSession';

const UNMOUNTED = {how: 'cancelled', reason: 'its component was unmounted'} as const;

export function useFlowScope(label: string): FlowScope<'surface'>;
export function useFlowScope<K extends FlowKind>(label: string, kind: K): FlowScope<K>;
export function useFlowScope(label: string, kind: FlowKind = 'surface'): FlowScope {
  // The owner is read NOW (the component tree is only known inside `setup()`); the scope is opened on first use.
  const owner = componentSessionScope();
  let opened: FlowScope | undefined = undefined;
  let unmounted = false;
  const scope = (): FlowScope => {
    if (opened === undefined) {
      opened = owner.open(kind, label);
      if (unmounted) {
        // Asked after its component left: born ended — a timer armed in it never fires, a release comes due at once.
        opened.end(UNMOUNTED);
      }
    }
    return opened;
  };
  const end = (): void => {
    unmounted = true;
    opened?.end(UNMOUNTED);
  };
  // A component's `setup()` of either runtime (the injection context is what both share — see the header).
  const inComponent = hasInjectionContext();
  if (inComponent) {
    onUnmounted(end);
  }
  if (getCurrentScope() !== undefined) {
    // The net under the hook (a component), the ending itself (a bare effect scope). Ending twice is nothing.
    onScopeDispose(inComponent ? () => void nextTick(end) : end);
  }
  /** Vue's own probes (`__v_isRef`, `__v_skip`, …) and symbols never open the scope. */
  const own = (key: string | symbol): boolean => typeof key === 'symbol' || key.startsWith('__v_');
  // Raw: a scope is an owner, not state — it must never be walked by a reactive proxy if it lands in `data()`.
  return markRaw(new Proxy({} as FlowScope, {
    get(target, key) {
      if (own(key)) {
        return Reflect.get(target, key);
      }
      const real = scope();
      const value: unknown = Reflect.get(real, key);
      return typeof value === 'function' ? value.bind(real) : value;
    },
    set(target, key, value) {
      return own(key) ? Reflect.set(target, key, value) : Reflect.set(scope(), key, value);
    },
    has(target, key) {
      return own(key) ? Reflect.has(target, key) : Reflect.has(scope(), key);
    },
  }));
}
