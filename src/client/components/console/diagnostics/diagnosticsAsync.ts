/*
 * THE DIAGNOSTICS SURFACE IS LOADED ON FIRST USE — a player who never opens it (nearly every session) pays nothing
 * for it at boot: neither the surface nor its steps are in the main chunk. The wrappers are module state, created
 * once (`components/lazyComponent.ts`).
 *
 * Typed `Component` on purpose: a type that reached through the `import()` would pull the surface's whole graph into
 * every file that names the binding.
 */
import type {Component} from 'vue';
import {lazyComponent} from '@/client/components/lazyComponent';

/** The surface itself (the journal, a record, the report, the connection check) — a member of the system overlay. */
export const ConsoleDiagnostics: Component = lazyComponent(() => import('@/client/components/console/diagnostics/ConsoleDiagnostics.vue'));

/**
 * Fetch the surface's chunk ahead of its first use — asked once the app has settled and whenever the system menu
 * opens. Never on the boot's critical path; with the chunk in hand the surface stands in the very frame it is asked
 * for (a wrapper whose chunk is still loading renders nothing, and the overlay would stand empty for that moment).
 */
export function warmDiagnosticsSurface(): void {
  void import('@/client/components/console/diagnostics/ConsoleDiagnostics.vue').catch(() => undefined);
}

/** The developer's notice — mounted only while «Уведомления разработчика» is on. */
export const ConsoleDevNotice: Component = lazyComponent(() => import('@/client/components/console/diagnostics/ConsoleDevNotice.vue'));
