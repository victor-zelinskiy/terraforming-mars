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
import {spawn} from 'child_process';
import * as fs from 'fs';

export interface ShutdownHost {
  /** Stage 0 — hand the guarantee to a process that outlives us (Linux; see armWatchdog). */
  armWatchdog?(): void;
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
      // FIRST, before anything can stall: hand the guarantee to a process that outlives us.
      // The in-process stages below are a courtesy; this is the one that always lands.
      host.armWatchdog?.();
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

/**
 * How long the EXTERNAL watchdog gives us to die before it pulls the trigger. A healthy quit
 * takes about a second, so this is pure slack — but it must stay well under Velopack's 60 s
 * parent-exit wait, or a stalled shutdown burns that whole minute before the update applies
 * (observed: "Failed to wait for process (6660) to exit (Parent process timed out)").
 */
export const WATCHDOG_DELAY_SECONDS = 10;

/**
 * The external watchdog's shell program (PURE — unit-tested).
 *
 * Why a separate PROCESS and not a timer: by the time Electron reaches `will-quit` the Node
 * environment is being torn down, so `setTimeout` callbacks never run again. A shutdown that
 * stalls in Chromium's NATIVE teardown — which is exactly what the Steam Machine log shows,
 * `[shutdown] will-quit` followed by silence, no exit for the full 60 s Velopack waited — is
 * therefore invisible and unstoppable from inside. Only something outside the process can end
 * it, and until now that something was the player holding B.
 *
 * Identity is checked before killing: `/proc/<pid>/stat` field 22 is the process START TIME, so
 * a pid that was recycled between our exit and the trigger can never be mistaken for us (the
 * relaunched game is the obvious candidate). Everything after `)` is taken first because a
 * process name may itself contain spaces or parentheses, which would shift field numbering.
 */
export function buildWatchdogScript(input: {
  pid: number;
  startTime: string;
  delaySeconds: number;
  logFile?: string;
}): string {
  const {pid, startTime, delaySeconds} = input;
  const note = `=== shutdown watchdog: pid ${pid} still alive ${delaySeconds}s after quit — SIGKILL ===`;
  const lines = [
    `sleep ${delaySeconds}`,
    `now=$(sed 's/.*) //' /proc/${pid}/stat 2>/dev/null | cut -d' ' -f20)`,
    `[ "$now" = "${startTime}" ] || exit 0`,
  ];
  if (input.logFile !== undefined && input.logFile !== '') {
    // Single-quoted so a path with spaces survives; ' is closed/escaped/reopened.
    lines.push(`echo '${note}' >> '${input.logFile.replace(/'/g, `'\\''`)}'`);
  }
  lines.push(`kill -9 ${pid}`);
  return lines.join('\n');
}

/** Our own start time from /proc (Linux) — the watchdog's proof of identity. */
function processStartTime(pid: number | 'self'): string | undefined {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    // Fields after the comm's closing ')' start at #3, so starttime (#22) is index 19.
    return stat.slice(stat.lastIndexOf(') ') + 2).split(' ')[19];
  } catch {
    return undefined;
  }
}

/**
 * Spawn the external watchdog. Linux only — that is where the native-teardown stall lives, and
 * where /proc gives a cheap exact identity check. Detached + unref'd so it survives us: a child
 * that died with the parent would be no watchdog at all.
 */
function armExternalWatchdog(): void {
  if (process.platform !== 'linux') {
    return;
  }
  const startTime = processStartTime('self');
  if (startTime === undefined) {
    // eslint-disable-next-line no-console
    console.log('[shutdown] no /proc — external watchdog unavailable, relying on the in-process stages');
    return;
  }
  try {
    const script = buildWatchdogScript({
      pid: process.pid,
      startTime,
      delaySeconds: WATCHDOG_DELAY_SECONDS,
      // The wrapper's log, so the kill is visible in the same timeline as everything else.
      logFile: (process.env.TM_LOG_FILE ?? '').trim() || undefined,
    });
    // /bin/sh from the SYSTEM, never the AppImage's own — a watchdog holding our squashfs
    // mount busy would be working against the very shutdown it is guarding.
    const child = spawn('/bin/sh', ['-c', script], {detached: true, stdio: 'ignore'});
    child.unref();
    // eslint-disable-next-line no-console
    console.log(`[shutdown] external watchdog armed — SIGKILL in ${WATCHDOG_DELAY_SECONDS}s if pid ${process.pid} is still alive`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[shutdown] could not arm the external watchdog — ${String(err)}`);
  }
}

/** The one controller the app uses — every quit path routes through it. */
const controller = createShutdownController({
  armWatchdog: armExternalWatchdog,
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
