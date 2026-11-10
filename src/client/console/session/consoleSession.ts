/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CONSOLE SESSION — the ONE root of the flow tree (architecture v2 — docs/claude/console/architecture-v2/PLAN.md
 * §2.3 · S1).
 *
 * A session is one life of the game screen: it begins when the console shell is set up and ends when the shell is
 * gone. Every flow of the console — the submit transport, the workspace frames, the outcome claims, the announce
 * plates, and whatever a later slice puts on the kernel — is opened INSIDE it (`consoleSessionScope().open(…)`), so
 * «the game screen left» is ONE event for all of them: the scope ends, its children end first, their cleanups run.
 *
 * What that replaces is the list. A dead shell used to be cleaned by ~120 hand-written `reset…()` rows in its
 * `beforeUnmount`; a module that was not on the list leaked its state into the next game («иногда зависает» after a
 * rematch — the session-leak class). A flow opened in the session cannot be forgotten: there is nothing to list.
 * Module state that is not a flow yet hangs its reset on the session with `onConsoleSessionEnd` — the same guarantee
 * for the modules still on the list, adopted as each one is touched.
 *
 * The scope is opened LAZILY (a spec, or a surface mounted before the shell, gets a session of its own) and RE-OPENED
 * after it ended — a module asks `consoleSessionScope()` every time it opens a flow, never caches it.
 */
import {onUnmounted} from 'vue';
import {FlowScope, openFlowRoot} from '@/client/console/kernel/flowScope';

let session: FlowScope<'session'> | undefined;

/** The live session's scope (opened on first use, re-opened after the last one ended). */
export function consoleSessionScope(): FlowScope<'session'> {
  if (session === undefined || session.ended !== undefined) {
    session = openFlowRoot('session');
  }
  return session;
}

/**
 * A NEW life of the game screen begins (the shell's `setup()`): whatever a previous shell left standing — a session
 * that was never ended, because its shell died without its hooks — ends HERE, said by name, before the new one opens.
 */
export function beginConsoleSession(): FlowScope<'session'> {
  if (session !== undefined && session.ended === undefined) {
    session.end({how: 'cancelled', reason: 'a new session began over it'});
  }
  return consoleSessionScope();
}

/** The game screen left (the shell is unmounted): every flow of the session ends, children first. */
export function endConsoleSession(reason = 'the game screen left'): void {
  if (session !== undefined && session.ended === undefined) {
    session.end({how: 'cancelled', reason});
  }
  session = undefined;
}

/**
 * Run `reset` when the CURRENT session ends (LIFO with the session's other cleanups). For module state that is not a
 * flow yet: the reset can no longer be forgotten by whoever tears the shell down. Returns the un-registration.
 */
export function onConsoleSessionEnd(reset: () => void): () => void {
  return consoleSessionScope().defer(reset);
}

/** Is a session standing right now (diagnostics; a spec)? */
export function consoleSessionLive(): boolean {
  return session !== undefined && session.ended === undefined;
}

/**
 * THE SHELL'S SIDE (called once, in `ConsoleShell.setup()`): the session stands for the shell's life and ends when the
 * shell is unmounted — after its children (the transport's binder among them) have gone, so nothing of the tree is
 * ended under a component that still runs.
 */
export function useConsoleSession(): FlowScope<'session'> {
  const scope = consoleSessionScope();
  onUnmounted(() => endConsoleSession());
  return scope;
}
