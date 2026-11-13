/*
 * THE APP ROOT'S PORT — what a component may ask of the application's root.
 *
 * Nine components used to reach the root through their own instance (`this.$root`, behind a helper that took `this` —
 * it left with its last caller): the busy flag of the server request, the game the lobby just loaded, the screen
 * switch, in-app navigation, the panels' visibility memory. `<script setup>` has no instance to start from, and a
 * Vapor component has none at all (`getCurrentInstance()` is `null` there) — so the root comes DOWN: `App` provides
 * this port, a component takes it with `useAppRoot()` (docs/claude/vapor/RECIPES.md § R26).
 *
 * The port is an INTERFACE, never the App component's type. Today `App` (Options API) provides its own public
 * instance, which satisfies it structurally; when `App` itself is rewritten it provides an object composed of its refs
 * and functions — and no consumer changes. A member is added here when a component needs it, typed as narrowly as the
 * need: the port is the list of what the tree may ask of its root, and it should stay short enough to read.
 *
 * `undefined` OUTSIDE the application — a unit mount, a playground, a stand: the component says what it does with no
 * root above it (a button is simply not busy), where `$root` of a bare mount used to answer `undefined` field by field.
 */
import {inject, InjectionKey} from 'vue';
import type {SimpleGameModel} from '@/common/models/SimpleGameModel';
import type {PlayerViewModel} from '@/common/models/PlayerModel';
import type {TransportRoot} from '@/client/console/transport/gameTransport';

/** The screens the root switches between (`App.vue` renders one per value). */
export type AppScreen = 'admin' |
  'campaign' |
  'cards' |
  'empty' |
  'game-home' |
  'games-overview' |
  'help' |
  'load' |
  'login-home' |
  'main-menu' |
  'premium-create-game' |
  'player-home' |
  'start-screen' |
  'the-end';

export interface AppRoot {
  /** The screen on stage — WRITTEN by a flow that lands on another one (the lobby's «load a game»). */
  screen: AppScreen;
  /** The game the lobby opened — WRITTEN by the same flow. */
  game: SimpleGameModel | undefined;
  /** The applied view of the running game (absent outside one). */
  readonly playerView?: PlayerViewModel;
  /** A request to the server is in flight — the transport's mirror (never written by a component). */
  readonly isServerSideRequestInProgress: boolean;
  /** In-app navigation: the URL, the history entry and the screen in one step. */
  navigateInApp(path: string): void;
  /** The per-panel «is it open» memory the root keeps across screens. */
  setVisibilityState(targetVar: string, isVisible: boolean): void;
  getVisibilityState(targetVar: string): boolean;
}

export const APP_ROOT: InjectionKey<AppRoot> = Symbol('app-root');

/** The app root's port, or `undefined` when the component stands outside the application. */
export function useAppRoot(): AppRoot | undefined {
  return inject(APP_ROOT, undefined);
}

/**
 * The root AS THE GAME TRANSPORT DRIVES IT — the narrow contract the transport declares for itself (`TransportRoot`:
 * the applied view, the reset epoch, who the server waits for, the busy mirror, `updatePlayer`, `showAlert`). It is
 * the same object the port above is, read through the transport's own contract; the one consumer is the transport's
 * lifecycle owner (`console/ConsoleBoardBinder.vue`), which hands it to `startGameTransport`.
 *
 * The cast lives HERE, once, with its reason: the transport's contract names `playerView` as a view that IS there (it
 * runs only while a game is on screen), the root's own field is optional (no game — no view) — so the root satisfies
 * the contract by lifetime, not by type. `undefined` outside the application: nothing to drive, no transport to start.
 */
export function useTransportRoot(): TransportRoot | undefined {
  return inject(APP_ROOT, undefined) as unknown as TransportRoot | undefined;
}
