/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE THREE COMPONENTS THAT ARE ASYNC ON PURPOSE — as IMPORTS (the road to `createVaporApp(App)` —
 * docs/claude/vapor/RECIPES.md § R1).
 *
 * `action-target-card`, `premium-card-face` and `console-source-dock` were reached by NAME — registered on the app in
 * `main.ts` — because a static import of each closes something that must stay open:
 *
 *  · `PremiumCardFace` — the premium face inside the zoom chain. A static import of `PremiumCard.vue` there closes the
 *    TYPE cycle PremiumCard → CardZoomModal → CardZoomCard → PremiumCard, and a cycle collapses vue-tsc's inference of
 *    every component on it to `{}`;
 *  · `ActionTargetCard` and `ConsoleSourceDock` — each renders the real card face, whose import chain is heavy enough
 *    that a surface adopting it by a static import loses its own unit spec's isolation (and its chunk).
 *
 * A `<script setup>` component cannot lean on a global registration (a Vapor component has none; the readiness
 * ledger's `global-in-setup` row). So the SAME async wrappers are exported here: a component imports the binding and
 * its template keeps the tag (`<premium-card-face …>` resolves to `PremiumCardFace`). They stay lazy — the dynamic
 * `import()` and its chunk are unchanged — and each is typed as a plain `Component`, deliberately: an inferred type
 * would reach through the `import()` and close the very cycle the laziness opens. (The tag's props are therefore not
 * checked in a template — exactly as when it was resolved by name.)
 *
 * `main.ts` still registers the three by name for the Options-API components that use them; that registration leaves
 * with the last one.
 */
import {defineAsyncComponent} from 'vue';
import type {Component} from 'vue';

/** The card-target picker (`<action-target-card>`). */
export const ActionTargetCard: Component = defineAsyncComponent(() => import(/* webpackChunkName: "player-input" */ '@/client/components/actions/ActionTargetCard.vue'));

/** The premium card face (`<premium-card-face>`) — lazy, so the zoom chain has no type cycle. */
export const PremiumCardFace: Component = defineAsyncComponent(() => import('@/client/components/premiumCard/PremiumCard.vue'));

/** The console's source dock (`<console-source-dock>` — «who asked for this decision?»). */
export const ConsoleSourceDock: Component = defineAsyncComponent(() => import(/* webpackChunkName: "console-shell" */ '@/client/components/console/ConsoleSourceDock.vue'));
