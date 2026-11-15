/*
 * THE APP ROOT'S LAZY SCREENS AND LAYERS — as IMPORTS (docs/claude/vapor/RECIPES.md § R25; the model is
 * `components/asyncComponents.ts`).
 *
 * Everything the root does not need for its first frame is a chunk of its own: the pre-game screens, the game shell,
 * the endgame, the dev stands. Each is a `lazyComponent` wrapper (the Vapor async one), and a wrapper is IDENTITY-BEARING MODULE
 * STATE: it keeps the component it resolved. Inside `App.vue`'s `<script setup>` every top-level statement is SETUP
 * code — it runs once per INSTANCE — so the wrappers declared there would be created anew, unresolved, with every
 * mount of the root. Here they are created ONCE per module, as they were while `App` was an Options component, and
 * `App.vue` imports them under the names its template uses (`<console-main-menu>` resolves to `ConsoleMainMenu`).
 *
 * They stay lazy — each dynamic `import()` is a chunk of its own, named after the module it opens (`chunks/console-shell.js`
 * — vite.config.mts; the webpack-era `webpackChunkName` comments are gone) — and each is
 * typed as a plain `Component`, as the model's are: plain tsc and vue-tsc then read the same type off this `.ts`
 * module (plain tsc sees a `.vue` only through the shim). (A tag's props are therefore not checked in the root's
 * template.)
 *
 * In a unit spec an imported lazy binding answers to the stub key `AsyncComponentWrapper` (RECIPES § 3).
 */
import {lazyComponent} from '@/client/components/lazyComponent';
import type {Component} from 'vue';

export const AdminHome: Component = lazyComponent(() => import('@/client/components/admin/AdminHome.vue'));
export const CardList: Component = lazyComponent(() => import('@/client/components/cardlist/CardList.vue'));
export const GameEnd: Component = lazyComponent(() => import('@/client/components/GameEnd.vue'));
export const GameHome: Component = lazyComponent(() => import('@/client/components/GameHome.vue'));
export const GamesOverview: Component = lazyComponent(() => import('@/client/components/GamesOverview.vue'));
export const Help: Component = lazyComponent(() => import('@/client/components/help/Help.vue'));
export const LoginHome: Component = lazyComponent(() => import('@/client/components/auth/LoginHome.vue'));
export const LoadGameForm: Component = lazyComponent(() => import('@/client/components/LoadGameForm.vue'));
export const StartScreen: Component = lazyComponent(() => import('@/client/components/StartScreen.vue'));
// Console-native pre-game shells (state-based pad navigation, no DOM focus) —
// the ONLY menu / create screens since desktop-removal wave 3.
export const ConsoleMainMenu: Component = lazyComponent(() => import('@/client/components/console/menu/ConsoleMainMenu.vue'));
export const ConsoleCreateGame: Component = lazyComponent(() => import('@/client/components/console/menu/ConsoleCreateGame.vue'));
export const ConsoleCampaignMap: Component = lazyComponent(() => import('@/client/components/console/campaign/ConsoleCampaignMap.vue'));
export const ConsoleMenuZoomHost: Component = lazyComponent(() => import('@/client/components/console/menu/ConsoleMenuZoomHost.vue'));
// Premium end-of-game experience (winner reveal + full-screen results). Async
// so its charts / tabs only download once a game actually ends.
export const EndgameExperience: Component = lazyComponent(() => import('@/client/components/endgame/EndgameExperience.vue'));
export const PlayerCubePlayground: Component = lazyComponent(() => import('@/client/components/PlayerCubePlayground.vue'));
export const ConsoleResolutionsPlayground: Component = lazyComponent(() => import('@/client/components/console/parliament/ConsoleResolutionsPlayground.vue'));
export const ConsoleTendersPlayground: Component = lazyComponent(() => import('@/client/components/console/campaign/ConsoleTendersPlayground.vue'));
export const PremiumCardsPlayground: Component = lazyComponent(() => import('@/client/components/premiumCard/PremiumCardsPlayground.vue'));
export const CardLorePlayground: Component = lazyComponent(() => import('@/client/components/card/CardLorePlayground.vue'));
// The console-native stand chassis the deep-linked showcases render inside.
// Async with the console-menu chunk weight class: only dev URLs ever mount it.
export const ConsolePlaygroundStand: Component = lazyComponent(() => import('@/client/components/console/menu/ConsolePlaygroundStand.vue'));
export const ConsoleShell: Component = lazyComponent(() => import('@/client/components/console/ConsoleShell.vue'));
