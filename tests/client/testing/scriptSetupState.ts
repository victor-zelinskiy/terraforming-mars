/*
 * THE SETUP BINDINGS OF A COMPONENT COMPILED AS IT SHIPS — what `wrapper.vm.<binding>` reads in the unit bundle
 * (docs/claude/stack.md, decision S3).
 *
 * The product compiles every `<script setup>` template INLINE: the render is a closure inside `setup()` and the
 * bindings are its local variables — nothing hands them to the instance (`instance.setupState` stays empty; only a
 * build that compiles the template SEPARATELY returns them, and that is not the build that ships). The unit bundle
 * compiles the same way, so a spec that reads a component's computed or calls its method would meet nothing.
 *
 * So the unit bundle's build adds ONE statement at the end of every `<script setup>` (`scripts/client-tests.mts` §
 * `scriptSetupBindings`): `__tmScriptSetupState({...the bindings})` — what a separately compiled script would return
 * of them: every binding the script declares (a `let` as a getter with its setter, the rest as values) and every
 * component it imports from a `.vue` file (another import is never read off `vm`, and naming a type imported without
 * `type` would turn it into a value import). It is called while the instance is being set up, so it is filed under that instance here, and
 * the layer (`vaporTree.ts`) reads it where a development build's `setupState` used to stand: `wrapper.vm`, and the
 * name a parent's script binds a child under (a stub by its local name).
 *
 * Nothing of the component changes: no expose, no state, no order — one call that records closures, in a test build
 * only. The product never contains it.
 */
import * as vue from 'vue-real';

type Dict = Record<string, unknown>;
export type ScriptSetupState = {
  /** The object as the compiler would return it — own data properties and getters (read by `localNameOf`). */
  raw: Dict,
  /** …with its refs unwrapped, as `instance.setupState` reads (and writes) them. */
  state: Dict,
};

const states = new WeakMap<object, ScriptSetupState>();

/** Called by the instrumented component at the end of its setup (never by hand). */
export function __tmScriptSetupState(raw: Dict): void {
  // `currentInstance` — the generic instance being set up (a Vapor one too); internal to the runtime, so untyped.
  const instance = (vue as unknown as {currentInstance: object | null}).currentInstance;
  if (instance !== null && instance !== undefined) {
    states.set(instance, {raw, state: vue.proxyRefs(raw) as Dict});
  }
}

/** The bindings an instance's setup recorded, if it is a component of this bundle. */
export function scriptSetupStateOf(instance: object | null | undefined): ScriptSetupState | undefined {
  return instance === null || instance === undefined ? undefined : states.get(instance);
}
