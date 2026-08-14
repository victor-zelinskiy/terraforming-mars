import {expect} from 'chai';
import {createShutdownController, FORCE_EXIT_DELAY_MS, HARD_KILL_DELAY_MS, ShutdownHost} from '../../electron/shutdown';

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
  it('starts with the GRACEFUL quit — a healthy exit never reaches the force stages', () => {
    const {host, calls} = fakeHost();
    createShutdownController(host).begin('renderer quit');
    // Only quit() ran: the escalation timers exist but the process is expected to be gone
    // before they fire, which is exactly why they cost nothing on a healthy quit.
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['quit']);
  });

  it('force-exits when the process is STILL ALIVE after quit()', () => {
    const {host, calls, timers} = fakeHost();
    createShutdownController(host).begin('renderer quit');
    advance(timers, FORCE_EXIT_DELAY_MS);
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['quit', 'exit(0)']);
  });

  it('SIGKILLs when even app.exit() did not end it — the backstop nothing can refuse', () => {
    const {host, calls, timers} = fakeHost();
    createShutdownController(host).begin('update apply');
    advance(timers, HARD_KILL_DELAY_MS);
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['quit', 'exit(0)', 'hardKill']);
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
    expect(calls.filter((c) => !c.startsWith('log:'))).to.deep.equal(['quit']);
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
