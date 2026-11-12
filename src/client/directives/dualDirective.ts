/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A DIRECTIVE WITH A LIFETIME, AS ONE BINDING FOR BOTH RUNTIMES (the road to `createVaporApp(App)` —
 * docs/claude/vapor/RECIPES.md § R17).
 *
 * The two runtimes call a custom directive differently, and neither takes the other's form:
 *
 *  · the VIRTUAL DOM takes an object of hooks (`{mounted, updated, unmounted}`) — or a function, which it treats as
 *    `mounted` + `updated` and NOTHING else;
 *  · VAPOR takes a function only — `(el, value?, arg?, modifiers?)`, called ONCE when the element is created, `value`
 *    a GETTER — and an object is refused (with a warning) and skipped; what the function RETURNS is called when the
 *    element's block is disposed.
 *
 * So a directive a `<script setup>` component imports — and keeps importing, unchanged, when it gains `vapor` — is a
 * FUNCTION that tells its two callers apart by their second argument (a getter or nothing: Vapor; a binding object:
 * the virtual DOM). `dualDirective` writes that function once for the directive's three moments:
 *
 *   export const vEmbedZone = dualDirective<HTMLElement>({mounted: register, unmounted: unregister});
 *
 *  · `mounted(el, value)` — Vapor: at the call. Virtual DOM: the first time the element is seen.
 *  · `updated(el, value)` — Virtual DOM: every later re-render of the owner (what `updated` always meant). Vapor: when
 *    the VALUE changes (a Vapor block does not re-render; a directive that must follow something ELSE — the element's
 *    text — subscribes to it itself in `mounted` and lets go in `unmounted`).
 *  · `unmounted(el)` — Vapor: the cleanup the call returns. Virtual DOM: see below.
 *
 * THE VIRTUAL DOM'S `unmounted` FOR A FUNCTION DIRECTIVE. `withDirectives` normalises a function to a fresh
 * `{mounted: fn, updated: fn}` per vnode and hands that very object back as `binding.dir` in every call; when the
 * element leaves, the renderer reads `binding.dir.unmounted` off the LAST vnode's binding. So the call sets it there.
 * Every vnode that can be unmounted has been through `mounted` or `updated` first (both run in the flush that created
 * it), so the hook is always in place. This leans on two public fields (`DirectiveBinding.dir`, `ObjectDirective.
 * unmounted`) and on that normalisation — pinned by `tests/client/vapor/vaporCapability.spec.ts` § dual directives, so
 * a Vue bump that changes it fails there, by name, and not in a surface that silently stopped unregistering.
 */
import {watch} from 'vue';
import type {DirectiveBinding, FunctionDirective, ObjectDirective, VaporDirective} from 'vue';

/** One binding, both runtimes. */
export type DualDirective<E extends Element, V> = VaporDirective<E, V> & FunctionDirective<E, V>;

export type DualDirectiveHooks<E extends Element, V> = {
  mounted(el: E, value: V | undefined): void,
  updated?(el: E, value: V | undefined): void,
  unmounted?(el: E): void,
};

/** Is this the virtual DOM calling (a binding object), or Vapor (a getter of the value — or nothing)? */
export function isVdomBinding<V>(second: (() => V) | DirectiveBinding<V> | undefined): second is DirectiveBinding<V> {
  return second !== undefined && typeof second !== 'function';
}

export function dualDirective<E extends Element, V = unknown>(hooks: DualDirectiveHooks<E, V>): DualDirective<E, V> {
  /** The elements the VIRTUAL DOM has mounted this directive on (weak: gone with the element). */
  const standing = new WeakSet<E>();
  return ((el: E, second?: (() => V) | DirectiveBinding<V>) => {
    if (isVdomBinding(second)) {
      if (hooks.unmounted !== undefined) {
        const leave = hooks.unmounted;
        (second.dir as ObjectDirective<E, V>).unmounted = (gone: E): void => {
          standing.delete(gone);
          leave(gone);
        };
      }
      if (standing.has(el)) {
        hooks.updated?.(el, second.value);
      } else {
        standing.add(el);
        hooks.mounted(el, second.value);
      }
      return undefined;
    }
    hooks.mounted(el, second?.());
    if (second !== undefined && hooks.updated !== undefined) {
      const update = hooks.updated;
      // Owned by the block the element was created in — stopped with it.
      watch(second, (value) => update(el, value), {flush: 'post'});
    }
    const leave = hooks.unmounted;
    return leave === undefined ? undefined : (): void => leave(el);
  }) as DualDirective<E, V>;
}
