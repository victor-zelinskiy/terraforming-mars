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
 * Module state that is not a flow yet hangs its reset on the session with `onConsoleSessionEnd` — the same guarantee
 * for the modules still on the list, adopted as each one is touched.
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
import {onUnmounted} from 'vue';
import {FlowKind} from '@/client/console/kernel/flowKinds';
import {dumpFlowTree, FlowScope, liveScopeCount, openFlowRoot, waitTable} from '@/client/console/kernel/flowScope';
import {flowTraceLines, flowTraceStats} from '@/client/console/kernel/flowTrace';

let game: FlowScope<'session'> | undefined;
let lobby: FlowScope<'session'> | undefined;

/** The scope a flow opened NOW belongs to: the game session while one stands, the lobby otherwise. */
export function consoleSessionScope(): FlowScope<'session'> {
  if (game !== undefined && game.ended === undefined) {
    return game;
  }
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
  onUnmounted(() => endConsoleSession('the game screen left', scope));
  return scope;
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
