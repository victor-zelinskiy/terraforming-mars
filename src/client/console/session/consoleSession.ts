/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CONSOLE SESSION — the ONE root of the flow tree (architecture v2 — docs/claude/console/architecture-v2/PLAN.md
 * §2.3 · S1, §10 · C0).
 *
 * A session is one life of the game screen: it begins when the console shell is set up and ends when the shell is
 * gone. Every flow of the console — the submit transport, the workspace frames, the outcome claims, the announce
 * plates, every scene that holds the foreground, and whatever a later slice puts on the kernel — is opened INSIDE it
 * (`consoleSessionScope().open(…)`), so «the game screen left» is ONE event for all of them: the scope ends, its
 * children end first, their cleanups run.
 *
 * What that replaces is the list. A dead shell used to be cleaned by ~120 hand-written `reset…()` rows in its
 * `beforeUnmount`; a module that was not on the list leaked its state into the next game («иногда зависает» after a
 * rematch — the session-leak class). A flow opened in the session cannot be forgotten: there is nothing to list.
 * Module state that is not a flow DECLARES itself beside its own definition — `sessionState(label, reset, at)` — and
 * the leaving shell says ONE thing, `leaveConsoleSession()`: every declared state is taken down in one ordered pass
 * (PLAN §10 · C5). The shell holds no list of modules any more; a module that has state of the game says so itself.
 *
 * TWO ROOTS, NEVER MIXED:
 *  · the GAME session (`session:game#n`) — opened by the shell's `setup()`, ended by THAT shell's unmount. A session
 *    has an identity: a shell ends the session it opened, never «the current one» (a new shell's `setup()` runs before
 *    the old shell's `unmounted` — the old one used to end the root the new shell had just started to use);
 *  · the LOBBY (`session:lobby#n`) — what stands when no game screen does: the menus, the campaign, a spec. It is
 *    opened lazily and lives until the page does. A scene raised before the shell exists (the curtain into the game)
 *    belongs to it and is NOT ended by a game that comes and goes.
 *
 * `consoleSessionScope()` answers «whose is a flow opened right now»: the game session while one stands, the lobby
 * otherwise. A module asks it every time it opens a flow and never caches the answer; a module that keeps a ROOT of
 * its own under it (the transport, the frame chain) goes through `sessionChild`, which re-homes a root whose session
 * is no longer the one that stands.
 */
import {getCurrentScope, hasInjectionContext, inject, onUnmounted, provide} from 'vue';
import type {EffectScope, InjectionKey} from 'vue';
import {FlowKind} from '@/client/console/kernel/flowKinds';
import {dumpFlowTree, FlowScope, liveScopeCount, openFlowRoot, waitTable} from '@/client/console/kernel/flowScope';
import {flowAnomaly, flowTraceLines, flowTraceStats} from '@/client/console/kernel/flowTrace';
import {flowClock} from '@/client/console/kernel/flowClock';

let game: FlowScope<'session'> | undefined;
let lobby: FlowScope<'session'> | undefined;

/** The scope a flow opened NOW belongs to: the game session while one stands, the lobby otherwise. */
export function consoleSessionScope(): FlowScope<'session'> {
  if (game !== undefined && game.ended === undefined) {
    return game;
  }
  return consoleAppScope();
}

/**
 * THE PAGE's own scope — for what lives as long as the PAGE does, whatever game screen comes and goes: the gamepad's
 * poll, the layout profile, the loading curtain, the campaign's channel, the field recorder, a menu. (It is the lobby's
 * root: «no game screen is up» and «not a game's» are the same owner.) A wait armed here during a game is NOT taken
 * back — or released — when that game's screen leaves; use it only for what is truly not the game's.
 */
export function consoleAppScope(): FlowScope<'session'> {
  if (lobby === undefined || lobby.ended !== undefined) {
    lobby = openFlowRoot('session', 'lobby');
  }
  return lobby;
}

/**
 * A NEW life of the game screen begins (the shell's `setup()`): whatever a previous shell left standing — a session
 * that was never ended, because its shell died without its hooks, or whose shell is still on its way out — ends HERE,
 * said by name, before the new one opens.
 */
export function beginConsoleSession(): FlowScope<'session'> {
  if (game !== undefined && game.ended === undefined) {
    game.end({how: 'cancelled', reason: 'a new session began over it'});
  }
  game = openFlowRoot('session', 'game');
  return game;
}

/**
 * The game screen left: every flow of the session ends, children first. `scope` — the session to end (a shell ends
 * the one IT opened; ending a session that already ended is nothing). Without it: the one that stands.
 */
export function endConsoleSession(reason = 'the game screen left', scope: FlowScope<'session'> | undefined = game): void {
  if (scope !== undefined && scope.ended === undefined) {
    scope.end({how: 'cancelled', reason});
  }
  if (scope === game) {
    game = undefined;
  }
}

/**
 * Run `reset` when the CURRENT session ends (LIFO with the session's other cleanups). For module state that is not a
 * flow yet: the reset can no longer be forgotten by whoever tears the shell down. Returns the un-registration.
 */
export function onConsoleSessionEnd(reset: () => void): () => void {
  return consoleSessionScope().defer(reset);
}

type SessionState = {label: string, reset: () => void, at: number};
const sessionStates: Array<SessionState> = [];

/**
 * MODULE STATE OF THE GAME SCREEN, DECLARED BY ITS MODULE (PLAN §10 · C5). A module that keeps state of the running
 * game outside a scope — a pick's request, a store's cache, a director's ledger, an arm waiting for its answer — says
 * so ONCE, at module scope, beside the reset it already has:
 *
 *   sessionState('hand-pick', resetConsoleHandPick, 150);
 *
 * and `leaveConsoleSession()` (the shell's `beforeUnmount`) takes every declared state down in ONE pass, ordered by
 * `at`. This replaces the hand-written list of `reset…()` rows in the shell: the declaration lives with the state, so
 * a new module cannot be «forgotten by the shell» — and a reset that throws no longer keeps the rest from running.
 *
 * `at` IS THE STATE'S PLACE IN THE PASS (lower first). The teardown is ordered on purpose — a scene's abort recalls
 * the scenes it staged, the stack falls before the picks that pop their frames from it — and the numbers are the order
 * the shell's list had. A new state takes a free number where it belongs (beside its family; before what it must
 * precede). Two states never share one (`kernelCoverage.spec` — the pass is a total order, not a coincidence of
 * import order).
 *
 * A flow whose whole state is its RUN needs no declaration: its run ends with the session (`orphaned`).
 */
export function sessionState(label: string, reset: () => void, at: number): void {
  // A module evaluated again (HMR, a spec's fresh bundle): its newest declaration stands.
  const standing = sessionStates.findIndex((state) => state.label === label);
  if (standing >= 0) {
    sessionStates.splice(standing, 1);
  }
  sessionStates.push({label, reset, at});
  sessionStates.sort((a, b) => a.at - b.at);
}

/**
 * THE GAME SCREEN IS LEAVING (the shell's `beforeUnmount`, after it dropped its own probes and suppliers): every
 * declared module state is reset, in order, each on its own — one that throws is said by name and the pass goes on.
 * Idempotent like the resets it runs; the session's SCOPE ends later (`unmounted` — after the shell's children).
 */
export function leaveConsoleSession(): void {
  for (const state of [...sessionStates]) {
    try {
      state.reset();
    } catch (error) {
      flowAnomaly(flowClock().now(), game?.id ?? 'session', `the session state «${state.label}» threw in its reset`, error);
    }
  }
}

/** The declared session states, in the order of the pass (diagnostics; a spec). */
export function declaredSessionStates(): Array<{label: string, at: number}> {
  return sessionStates.map(({label, at}) => ({label, at}));
}

/** Does a GAME session stand right now (diagnostics; a spec)? */
export function consoleSessionLive(): boolean {
  return game !== undefined && game.ended === undefined;
}

/**
 * A module's OWN ROOT under the session (the transport's flow, the frame chain, the claims): hand in the one the
 * module holds, get back the one to use. It is the same scope while it lives in the session that stands; a root whose
 * session ended, or that was opened before the game session began (in the lobby — a spec, a module touched early), is
 * ended by name and re-opened where flows belong now. A module never holds a root of a session that is not the
 * current one.
 */
export function sessionChild<K extends FlowKind>(held: FlowScope<K> | undefined, kind: K, label?: string): FlowScope<K> {
  const owner = consoleSessionScope();
  if (held !== undefined && held.ended === undefined) {
    if (held.parent === owner) {
      return held;
    }
    held.end({how: 'cancelled', reason: 'its session is not the one that stands'});
  }
  return owner.open(kind, label);
}

/**
 * THE SHELL'S SIDE (called once, in `ConsoleShell.setup()`): a session of its own stands for the shell's life and
 * ends when THIS shell is unmounted — after its children (the transport's binder among them) have gone, so nothing of
 * the tree is ended under a component that still runs.
 */
export function useConsoleSession(): FlowScope<'session'> {
  const scope = beginConsoleSession();
  // THE SESSION IS HANDED DOWN THE COMPONENT TREE: whatever is rendered INSIDE this shell belongs to this session —
  // `componentSessionScope()` reads it — and whatever is rendered outside any shell does not.
  provide(SESSION_OF_THE_SHELL, scope);
  const setup = getCurrentScope();
  if (setup !== undefined) {
    shellSessions.set(setup, scope);
  }
  onUnmounted(() => endConsoleSession('the game screen left', scope));
  return scope;
}

const SESSION_OF_THE_SHELL: InjectionKey<FlowScope<'session'>> = Symbol('the console session of the shell above');
/**
 * The shell's own SETUP SCOPE → its session (`inject` does not see what the same component provided).
 *
 * Keyed by the component's effect scope, never by its instance: `getCurrentInstance()` answers `null` inside a Vapor
 * component (Vue 3.6), while `getCurrentScope()` / `provide` / `inject` are the same in both runtimes — so this module
 * does not care which kind of component the shell (or anything under it) is. `docs/claude/vapor/ROADMAP.md` §3.
 */
const shellSessions = new WeakMap<EffectScope, FlowScope<'session'>>();

/**
 * WHOSE IS A COMPONENT SET UP RIGHT NOW (called in `setup()` / `<script setup>` — `useFlowScope` is its one caller)?
 * Decided by WHERE THE COMPONENT STANDS IN THE TREE, never by «which session happens to stand»:
 *  · inside a console shell (or the shell's own `setup()` — its controllers) → THAT shell's session: the component
 *    dies with that shell, and so does its scope;
 *  · outside any shell — a menu, an app-level layer beside the shell (a zoom host, the curtain, a rematch layer), a
 *    spec's bare mount → the PAGE's scope.
 * «The session that stands» is the wrong owner for a component: an app-level layer set up while a game is on screen
 * would be handed that game's session and lose every timer it arms the moment the game screen leaves — while the
 * layer itself lives on; and a component set up in the patch that swaps two shells would get the dying one's.
 */
export function componentSessionScope(): FlowScope<'session'> {
  const setup = getCurrentScope();
  const own = setup === undefined ? undefined : shellSessions.get(setup);
  // `hasInjectionContext()`: a component's `setup()` of either runtime (or `app.runWithContext`) — the only places
  // `inject` may be asked; anywhere else (a bare effect scope, a module) the answer is the page's scope.
  const scope = own ?? (hasInjectionContext() ? inject(SESSION_OF_THE_SHELL, undefined) : undefined);
  return scope !== undefined && scope.ended === undefined ? scope : consoleAppScope();
}

/**
 * THE TREE, READ FROM THE PAGE (`window.__conFlow()` — the e2e harness, the console export, a developer): every scope
 * that stands with its age, its state and what it waits for; every wait and owned timer; the last records of the
 * trace; the counters. Built only when asked.
 */
export function consoleFlowDiag(): {tree: Array<string>, waits: ReturnType<typeof waitTable>, trace: Array<string>, stats: typeof flowTraceStats, scopes: number} {
  return {tree: dumpFlowTree(), waits: waitTable(), trace: flowTraceLines(120), stats: {...flowTraceStats}, scopes: liveScopeCount()};
}

if (typeof window !== 'undefined') {
  (window as unknown as {__conFlow?: typeof consoleFlowDiag}).__conFlow = consoleFlowDiag;
}

/** Test seam: forget both roots (after `resetFlowKernel()` ended them). */
export function resetConsoleSession(): void {
  endConsoleSession('reset');
  if (lobby !== undefined && lobby.ended === undefined) {
    lobby.end({how: 'cancelled', reason: 'reset'});
  }
  lobby = undefined;
}
