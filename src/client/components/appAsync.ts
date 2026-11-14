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
 * They stay lazy — the dynamic `import()`s, their `webpackChunkName`s and their chunks are unchanged — and each is
 * typed as a plain `Component`, as the model's are: plain tsc and vue-tsc then read the same type off this `.ts`
 * module (plain tsc sees a `.vue` only through the shim). (A tag's props are therefore not checked in the root's
 * template.)
 *
 * In a unit spec an imported lazy binding answers to the stub key `AsyncComponentWrapper` (RECIPES § 3).
 */
import {lazyComponent} from '@/client/components/lazyComponent';
import type {Component} from 'vue';

export const AdminHome: Component = lazyComponent(() => import(/* webpackChunkName: "admin" */ '@/client/components/admin/AdminHome.vue'));
export const CardList: Component = lazyComponent(() => import(/* webpackChunkName: "card-list" */ '@/client/components/cardlist/CardList.vue'));
export const GameEnd: Component = lazyComponent(() => import(/* webpackChunkName: "game-end" */ '@/client/components/GameEnd.vue'));
export const GameHome: Component = lazyComponent(() => import(/* webpackChunkName: "game-home" */ '@/client/components/GameHome.vue'));
export const GamesOverview: Component = lazyComponent(() => import(/* webpackChunkName: "games-overview" */ '@/client/components/GamesOverview.vue'));
export const Help: Component = lazyComponent(() => import(/* webpackChunkName: "help" */ '@/client/components/help/Help.vue'));
export const LoginHome: Component = lazyComponent(() => import(/* webpackChunkName: "login" */ '@/client/components/auth/LoginHome.vue'));
export const LoadGameForm: Component = lazyComponent(() => import(/* webpackChunkName: "load-game" */ '@/client/components/LoadGameForm.vue'));
export const StartScreen: Component = lazyComponent(() => import(/* webpackChunkName: "start-screen" */ '@/client/components/StartScreen.vue'));
// Console-native pre-game shells (state-based pad navigation, no DOM focus) —
// the ONLY menu / create screens since desktop-removal wave 3.
export const ConsoleMainMenu: Component = lazyComponent(() => import(/* webpackChunkName: "console-menu" */ '@/client/components/console/menu/ConsoleMainMenu.vue'));
export const ConsoleCreateGame: Component = lazyComponent(() => import(/* webpackChunkName: "console-menu" */ '@/client/components/console/menu/ConsoleCreateGame.vue'));
export const ConsoleCampaignMap: Component = lazyComponent(() => import(/* webpackChunkName: "console-menu" */ '@/client/components/console/campaign/ConsoleCampaignMap.vue'));
export const ConsoleMenuZoomHost: Component = lazyComponent(() => import(/* webpackChunkName: "console-menu" */ '@/client/components/console/menu/ConsoleMenuZoomHost.vue'));
// Premium end-of-game experience (winner reveal + full-screen results). Async
// so its charts / tabs only download once a game actually ends.
export const EndgameExperience: Component = lazyComponent(() => import(/* webpackChunkName: "endgame" */ '@/client/components/endgame/EndgameExperience.vue'));
export const PlayerCubePlayground: Component = lazyComponent(() => import(/* webpackChunkName: "player-cube-playground" */ '@/client/components/PlayerCubePlayground.vue'));
export const ConsoleResolutionsPlayground: Component = lazyComponent(() => import(/* webpackChunkName: "resolutions-playground" */ '@/client/components/console/parliament/ConsoleResolutionsPlayground.vue'));
export const ConsoleTendersPlayground: Component = lazyComponent(() => import(/* webpackChunkName: "tenders-playground" */ '@/client/components/console/campaign/ConsoleTendersPlayground.vue'));
export const PremiumCardsPlayground: Component = lazyComponent(() => import(/* webpackChunkName: "premium-cards-playground" */ '@/client/components/premiumCard/PremiumCardsPlayground.vue'));
export const CardLorePlayground: Component = lazyComponent(() => import(/* webpackChunkName: "card-lore-playground" */ '@/client/components/card/CardLorePlayground.vue'));
// The console-native stand chassis the deep-linked showcases render inside.
// Async with the console-menu chunk weight class: only dev URLs ever mount it.
export const ConsolePlaygroundStand: Component = lazyComponent(() => import(/* webpackChunkName: "playground-stand" */ '@/client/components/console/menu/ConsolePlaygroundStand.vue'));
export const ConsoleShell: Component = lazyComponent(() => import(/* webpackChunkName: "console-shell" */ '@/client/components/console/ConsoleShell.vue'));
