/*
 * THE GAME SERVER'S DIAGNOSTICS FACADE — one door for «something failed on the server», whoever carries it further.
 *
 * The server does not know where its signals go, and must not: today it runs EMBEDDED in the desktop app (a
 * utilityProcess — `embedded/embeddedServerMain.ts` installs a sink that posts each signal to the main process, where
 * the diagnostics hub mirrors, scrubs and sends it); a HOSTED server will install a sink that hands the same signal to
 * a hub of its own. With no sink (a development server, a unit test) the facade does nothing — the console line the
 * caller already printed is the whole story.
 *
 * What goes through it:
 *  · an uncaught exception / an unhandled rejection of the process (`installServerDiagnostics`);
 *  · a request that ended in «Internal server error» with an exception behind it (`responses.internalServerError`);
 *  · «Проверка связи» — the test error the app asks for (`serverSelfTest`).
 *
 * A signal is the console LINE a developer would have read (`[server-error] …`) with the error's stack and the debug
 * ids of this process's scripts — exactly what the hub's `note('server', …)` takes.
 */

import {debugIdsOf} from '@/common/diagnostics/debugIds';

export type ServerDiagSignal = {
  level: 'warn' | 'error';
  /** The full line: `[server-error] <what>: <Name: message>` and the stack under it. */
  text: string;
  stack?: string;
  debugIds: Record<string, string>;
};

export type ServerDiagSink = (signal: ServerDiagSignal) => void;

let sink: ServerDiagSink | undefined;

/** Who carries the server's signals (undefined = nobody: the facade is silent). */
export function setServerDiagnosticsSink(next: ServerDiagSink | undefined): void {
  sink = next;
}

function errorStack(err: unknown): string | undefined {
  if (!(err instanceof Error)) {
    return undefined;
  }
  const head = `${err.name}: ${err.message}`;
  if (typeof err.stack !== 'string' || err.stack === '') {
    return head;
  }
  return err.stack.startsWith(err.name) ? err.stack : `${head}\n${err.stack}`;
}

/** The signal for an error — pure (the debug ids are read off the given global). */
export function serverErrorSignal(tag: string, what: string, err: unknown, globalObject: unknown = globalThis): ServerDiagSignal {
  const stack = errorStack(err);
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const line = `[${tag}] ${what}: ${message}`;
  return {
    level: 'error',
    text: stack === undefined ? line : `${line}\n${stack}`,
    ...(stack !== undefined ? {stack} : {}),
    debugIds: debugIdsOf(globalObject),
  };
}

/** A failure of the server, said once to whoever listens. Never throws. */
export function reportServerError(what: string, err: unknown): void {
  if (sink === undefined) {
    return;
  }
  try {
    sink(serverErrorSignal('server-error', what, err));
  } catch {
    // The server never fails because its diagnostics could not be carried.
  }
}

/** «Проверка связи»: an error thrown and caught here, so its stack is this process's own. */
export function serverSelfTest(): void {
  if (sink === undefined) {
    return;
  }
  try {
    throw new Error('the connection check — a test error of the game server (not a defect)');
  } catch (err) {
    sink(serverErrorSignal('selftest', 'server — the connection check', err));
  }
}

/** The process's last-resort handlers. Idempotent per process; the caller keeps its own console line. */
let installed = false;
export function installServerDiagnostics(): void {
  if (installed) {
    return;
  }
  installed = true;
  process.on('uncaughtException', (err: unknown) => reportServerError('uncaught exception', err));
  process.on('unhandledRejection', (reason: unknown) => reportServerError('unhandled rejection', reason));
}
