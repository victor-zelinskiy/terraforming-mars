/*
 * A COMPONENT LOADED ON FIRST USE — the ONE way the client makes a lazy component (docs/claude/vapor/ROADMAP.md
 * § 4a · B4; the three modules that use it: `asyncComponents.ts`, `appAsync.ts`, `consolePlaygroundHubAsync.ts`).
 *
 * `defineAsyncComponent` makes a VIRTUAL-DOM wrapper: the app is `createVaporApp(App)` with no virtual-DOM renderer
 * behind it (no `vaporInteropPlugin`), so such a wrapper would have nothing to render it. `defineVaporAsyncComponent`
 * is the same wrapper as a Vapor component — the same contract: the loader runs on the first render, the resolved
 * component is kept by the wrapper (so a wrapper is module state, created once), nothing stands in its place while
 * the chunk loads. Its name is `VaporAsyncComponentWrapper` — the name a unit spec stubs it by.
 *
 * The binding is typed `Component` on purpose (each lazy module says why: a type that reached through the `import()`
 * would close the cycle the laziness opens), and the plain compiler's `*.vue` shim types the loaded module as a
 * virtual-DOM one — so the loader is handed over untyped. A raw `defineAsyncComponent` in `src/client` fails the
 * readiness guard (`tests/console/vaporReadiness.spec.ts`).
 */
import {defineVaporAsyncComponent} from 'vue';
import type {Component} from 'vue';

export function lazyComponent(load: () => Promise<unknown>): Component {
  return defineVaporAsyncComponent(load as never) as unknown as Component;
}
