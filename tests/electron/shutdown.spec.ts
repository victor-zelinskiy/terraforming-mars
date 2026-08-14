import {expect} from 'chai';
import {buildWatchdogScript, createShutdownController, FORCE_EXIT_DELAY_MS, HARD_KILL_DELAY_MS, ShutdownHost, WATCHDOG_DELAY_SECONDS} from '../../electron/shutdown';

/**
 * The escalation exists because a quit that stalls is INVISIBLE on the target hardware:
 * under gamescope the window is already gone, so the player sees a black screen and Steam's
 * "hold B to close" — and the update wrapper, which waits on this very process, never gets
 * its exit. So every stage is asserted, not assumed.
 */
type Fired = {ms: number; run: () => void};

function fakeHost(): {host: ShutdownHost; calls: string[]; timers: Fired[]} {
  const calls: string[] = [];
  const timers: Fired[] = [];
  return {
    calls,
    timers,
    host: {
      armWatchdog: () => calls.push('armWatchdog'),
      quit: () => calls.push('quit'),
      exit: (code) => calls.push(`exit(${code})`),
      hardKill: () => calls.push('hardKill'),
      log: (message) => calls.push(`log:${message}`),
      setTimer: (run, ms) => {
        timers.push({ms, run});
      },
      describeState: () => 'windows=1 alive=1',
    },
  };
}

/** Run every timer due at or before `ms`, as a real clock would. */
function advance(timers: Fired[], ms: number): void {
  timers.filter((t) => t.ms <= ms).forEach((t) => t.run());
}

describe('electron/shutdown escalation', () => {
  it('arms the EXTERNAL watchdog BEFORE quitting — the only stage a native stall cannot swallow', () => {
    // Order matters: the Steam Machine log ends at `will-quit` and the process then outlived
    // Velopack's whole 60s wait. By that point Node's timers are gone, so anything armed after
    // (or by) the quit is already too late. Stage 0 must be handed off first.
    const {host, calls} = fakeHost();
    createShutdownController(host).begin('renderer quit');
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['armWatchdog', 'quit']);
  });

  it('force-exits when the process is STILL ALIVE after quit()', () => {
    const {host, calls, timers} = fakeHost();
    createShutdownController(host).begin('renderer quit');
    advance(timers, FORCE_EXIT_DELAY_MS);
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['armWatchdog', 'quit', 'exit(0)']);
  });

  it('SIGKILLs when even app.exit() did not end it — the backstop nothing can refuse', () => {
    const {host, calls, timers} = fakeHost();
    createShutdownController(host).begin('update apply');
    advance(timers, HARD_KILL_DELAY_MS);
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['armWatchdog', 'quit', 'exit(0)', 'hardKill']);
  });

  it('measures the SIGKILL from the start, not from the force stage (a stalled exit() cannot push it out)', () => {
    const {host, timers} = fakeHost();
    createShutdownController(host).begin('renderer quit');
    expect(timers.map((t) => t.ms)).to.deep.equal([FORCE_EXIT_DELAY_MS, HARD_KILL_DELAY_MS]);
    expect(HARD_KILL_DELAY_MS).to.be.greaterThan(FORCE_EXIT_DELAY_MS);
  });

  it('is IDEMPOTENT — window-all-closed follows desktop:quitApp and must not re-arm or re-quit', () => {
    // Re-entry is the NORMAL path (closing the window is how quit() proceeds), so a second
    // begin() must never double-quit, and must never escalate early: that would skip the
    // graceful embedded-server teardown on every ordinary exit.
    const {host, calls, timers} = fakeHost();
    const controller = createShutdownController(host);
    controller.begin('renderer quit');
    controller.begin('all windows closed');
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['armWatchdog', 'quit']);
    expect(timers).to.have.length(2);
  });

  it('reports shutting-down state — the fullscreen re-enforcement reads it to stand down', () => {
    const {host} = fakeHost();
    const controller = createShutdownController(host);
    expect(controller.isShuttingDown()).to.be.false;
    controller.begin('renderer quit');
    expect(controller.isShuttingDown()).to.be.true;
  });

  it('logs the reason AND the live state at every stage — the support log must say how far it got', () => {
    const {host, calls, timers} = fakeHost();
    createShutdownController(host).begin('update apply (linux, wrapper restart)');
    advance(timers, HARD_KILL_DELAY_MS);
    const logs = calls.filter((c) => c.startsWith('log:'));
    expect(logs).to.have.length(3);
    expect(logs[0]).to.contain('update apply (linux, wrapper restart)');
    logs.forEach((l) => expect(l).to.contain('windows=1 alive=1'));
  });
});

describe('electron/shutdown buildWatchdogScript', () => {
  const script = (over: Partial<Parameters<typeof buildWatchdogScript>[0]> = {}): string =>
    buildWatchdogScript({pid: 6660, startTime: '4242424', delaySeconds: 10, ...over});

  it('waits, then SIGKILLs the pid that would not die', () => {
    const s = script();
    expect(s).to.contain('sleep 10');
    expect(s).to.contain('kill -9 6660');
  });

  it('REFUSES to kill a recycled pid — start time is checked, so the relaunched game is safe', () => {
    // The wrapper relaunches within a second of our exit. Without this the watchdog could fire
    // into whatever now owns the pid, and the likeliest candidate is the fresh game itself.
    const s = script();
    expect(s).to.contain('/proc/6660/stat');
    expect(s).to.contain('[ "$now" = "4242424" ] || exit 0');
    expect(s.indexOf('exit 0')).to.be.lessThan(s.indexOf('kill -9'));
  });

  it('reads the stat fields AFTER the comm — a process name with spaces must not shift them', () => {
    expect(script()).to.contain(`sed 's/.*) //'`);
  });

  it('notes the kill in the wrapper log so the timeline shows who ended the process', () => {
    const s = script({logFile: '/home/deck/Applications/terraforming-mars-steam.log'});
    expect(s).to.contain(`>> '/home/deck/Applications/terraforming-mars-steam.log'`);
    expect(s).to.contain('still alive 10s after quit');
  });

  it('quotes a log path safely and works with no log path at all', () => {
    expect(script({logFile: "/tmp/it's odd/tm.log"})).to.contain(`'/tmp/it'\\''s odd/tm.log'`);
    expect(script({logFile: undefined})).to.not.contain('echo');
  });

  it('fires well inside Velopack\'s 60s parent-exit wait — a stall must not cost that whole minute', () => {
    // Observed on the Steam Machine: "Failed to wait for process (6660) to exit (Parent process
    // timed out.)" — the apply sat idle for 60s because nothing ended the process.
    expect(WATCHDOG_DELAY_SECONDS).to.be.lessThan(60);
    expect(WATCHDOG_DELAY_SECONDS * 1000).to.be.greaterThan(HARD_KILL_DELAY_MS);
  });
});
