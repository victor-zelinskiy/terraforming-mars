/*
 * THE PLAYGROUND HUB'S FIVE SHOWCASES — lazy, and as IMPORTS (docs/claude/vapor/RECIPES.md § R25; the model is
 * `components/asyncComponents.ts`).
 *
 * Every showcase pulls its own catalog machinery — the menu must not pay that weight until an admin actually opens
 * the stand. So each is a `lazyComponent` wrapper (the Vapor async one), and a wrapper is IDENTITY-BEARING MODULE STATE: it keeps the
 * component it resolved. Inside `ConsolePlaygroundHub.vue`'s `<script setup>` every top-level statement is SETUP code
 * — it runs once per INSTANCE of the hub — so the five wrappers declared there would be created anew, unresolved, with
 * every mount: each re-open of the hub would re-await a chunk that is already loaded and paint its showcase a tick
 * late. Here they are created ONCE per module, as they were while the hub was an Options component, and the hub
 * imports them under the names its template uses.
 *
 * They stay lazy — the dynamic `import()`s and their chunks are unchanged — and each is typed as a plain `Component`,
 * deliberately: an inferred type would reach through the `import()` into the showcase's own type graph. (A tag's props
 * are therefore not checked in the hub's template.)
 *
 * In a unit spec an imported lazy binding answers to the stub key `AsyncComponentWrapper` (RECIPES § 3).
 */
import {lazyComponent} from '@/client/components/lazyComponent';
import type {Component} from 'vue';

/** The premium-card showcase («Premium cards showcase»). */
export const PremiumCardsPlayground: Component = lazyComponent(() => import('@/client/components/premiumCard/PremiumCardsPlayground.vue'));

/** The player-cube showcase («Player cubes showcase»). */
export const PlayerCubePlayground: Component = lazyComponent(() => import('@/client/components/PlayerCubePlayground.vue'));

/** The card-lore showcase («Card lore showcase»). */
export const CardLorePlayground: Component = lazyComponent(() => import('@/client/components/card/CardLorePlayground.vue'));

/** The Turmoil Redux resolutions showcase («Redux resolutions showcase») — an INTERACTIVE one: the hub holds a ref to it. */
export const ConsoleResolutionsPlayground: Component = lazyComponent(() => import('@/client/components/console/parliament/ConsoleResolutionsPlayground.vue'));

/** The campaign tenders showcase («Tenders showcase») — interactive too. */
export const ConsoleTendersPlayground: Component = lazyComponent(() => import('@/client/components/console/campaign/ConsoleTendersPlayground.vue'));
