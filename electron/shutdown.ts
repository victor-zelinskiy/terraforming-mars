// Electron — GUARANTEED process shutdown (main process).
//
// On a desktop OS a quit that stalls is merely untidy: the window is gone, the taskbar
// button lingers, the player shrugs. Under gamescope (Steam Deck / Steam Machine) the same
// stall is fatal and INVISIBLE — the compositor has no window left to show, so the screen
// goes BLACK, and Steam still tracks the launcher, so the only way out is the "hold B —
// close app" prompt. It reads exactly like a crash.
//
// It also breaks the updater outright. The restart-loop wrapper waits on the app PROCESS:
// no exit → no apply-wait, no relaunch, no update. The next launch finds itself still
// outdated and installs the very same update again — the "update re-installs forever, then
// hangs on black" loop reported from both machines.
//
// So NO quit path may end at `app.quit()`. Every one of them arms this escalation:
//
//   1. quit()   — graceful: before-quit / will-quit hooks, embedded-server stop, window close
//   2. exit(0)  — Electron's force-quit, skipping whatever teardown step stalled
//   3. SIGKILL  — to our own pid; nothing in userspace can refuse it
//
// Each stage only ever runs because the previous one did NOT end the process, so a healthy
// quit never reaches stage 2 — the timers die with the process. Each stage LOGS, and the
// wrapper tees stdout into ~/Applications/terraforming-mars-steam.log, so a support log
// says precisely how far the shutdown got and what was still alive when it stuck.
//
// The controller is host-injected and pure of Electron, so the escalation is unit-tested
// against a fake clock (tests/electron/shutdown.spec.ts) rather than trusted by eye.

import {app, BrowserWindow} from 'electron';

export interface ShutdownHost {
  /** Graceful stage — Electron's `app.quit()`. */
  quit(): void;
  /** Force stage — Electron's `app.exit(code)`. */
  exit(code: number): void;
  /** Last resort — an unblockable signal to our own process. */
  hardKill(): void;
  log(message: string): void;
  setTimer(handler: () => void, ms: number): void;
  /** Optional live diagnostics appended to each escalation line (open windows, …). */
  describeState?(): string;
}

/**
 * Graceful → force. Long enough for a real teardown (embedded-server stop posts a shutdown
 * message and hard-kills its child at 1.5s), short enough that the player reads it as
 * "quitting", not "hung".
 */
export const FORCE_EXIT_DELAY_MS = 2_500;

/**
 * Force → SIGKILL. Measured from the SAME start, not from the force stage, so a stall in
 * `app.exit()` itself can't push the backstop out indefinitely.
 */
export const HARD_KILL_DELAY_MS = 5_000;

export interface ShutdownController {
  /** Start (or re-log) the shutdown. Idempotent — the first reason owns the escalation. */
  begin(reason: string): void;
  /** True once a shutdown has started — the fullscreen re-enforcement reads this. */
  isShuttingDown(): boolean;
}

export function createShutdownController(host: ShutdownHost): ShutdownController {
  let started = false;
  const state = (): string => {
    const extra = host.describeState?.() ?? '';
    return extra !== '' ? ` — ${extra}` : '';
  };
  return {
    isShuttingDown: () => started,
    begin(reason: string): void {
      if (started) {
        // Not an escalation: `window-all-closed` legitimately follows `desktop:quitApp`
        // milliseconds later, and treating that as "the player insisted" would skip the
        // graceful teardown on EVERY ordinary quit.
        host.log(`[shutdown] already in progress (${reason})`);
        return;
      }
      started = true;
      host.log(`[shutdown] ${reason} — quitting${state()}`);
      host.quit();
      host.setTimer(() => {
        host.log(`[shutdown] still alive ${FORCE_EXIT_DELAY_MS}ms after quit() — forcing exit${state()}`);
        host.exit(0);
      }, FORCE_EXIT_DELAY_MS);
      host.setTimer(() => {
        host.log(`[shutdown] still alive ${HARD_KILL_DELAY_MS}ms after quit() — SIGKILL${state()}`);
        host.hardKill();
      }, HARD_KILL_DELAY_MS);
    },
  };
}

/** The one controller the app uses — every quit path routes through it. */
const controller = createShutdownController({
  quit: () => app.quit(),
  exit: (code) => app.exit(code),
  // SIGKILL to our own pid. Node maps it to TerminateProcess on Windows, so the backstop is
  // real on both platforms. Wrapped: if even this throws there is nothing further to try,
  // and an exception here must not replace a shutdown with a crash trace.
  hardKill: () => {
    try {
      process.kill(process.pid, 'SIGKILL');
    } catch {
      process.exit(0);
    }
  },
  // eslint-disable-next-line no-console
  log: (message) => console.log(message),
  setTimer: (handler, ms) => {
    setTimeout(handler, ms);
  },
  // What was still standing when the stage fired — the first thing to look at in a support
  // log when a shutdown needed escalating at all.
  describeState: () => {
    try {
      const windows = BrowserWindow.getAllWindows();
      return `windows=${windows.length} alive=${windows.filter((w) => !w.isDestroyed()).length}`;
    } catch {
      return '';
    }
  },
});

/**
 * Quit the app, and MAKE SURE it ends. Use everywhere instead of a bare `app.quit()`:
 * a quit that silently fails to end the process is a black screen under gamescope and a
 * dead updater (see the module header).
 */
export function beginShutdown(reason: string): void {
  controller.begin(reason);
}

/** True once any quit path has started — used to stop re-asserting window state on teardown. */
export function isShuttingDown(): boolean {
  return controller.isShuttingDown();
}
