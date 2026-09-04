import {expect} from 'chai';
import {
  ARM_WATCHDOG_MS,
  BOOT_STALL_MS,
  DEFAULT_HOLD_MAX_MS,
  REVEAL_MS,
  TEXT_APPEAR_MS,
  TEXT_MIN_DWELL_MS,
  armSceneDestination,
  beginLoading,
  deferSceneReveal,
  endLoading,
  failLoading,
  loadingScreenState,
  noteScreenResolved,
  onSceneRevealed,
  resetSceneTransitionForTest,
  sceneTransitionInputLocked,
  setSceneTransitionSchedulerForTest,
} from '@/client/console/loadingScreenState';

/**
 * SCENE TRANSITION DIRECTOR — the readiness-gated state machine of every
 * screen boundary (menu ⇄ game ⇄ campaign). These specs drive it with a
 * MANUAL scheduler, so every race (fast load, slow load, bounded hold, stale
 * release, a hold registered mid-settle) is deterministic — none of them
 * passes because of a real timeout.
 */

type Timer = {id: number, at: number, fn: () => void};

class ManualScheduler {
  time = 0;
  private seq = 1;
  private timers: Array<Timer> = [];
  private settleQueue: Array<() => void> = [];

  now(): number {
    return this.time;
  }
  setTimeout(fn: () => void, ms: number): number {
    const id = this.seq++;
    this.timers.push({id, at: this.time + ms, fn});
    return id;
  }
  clearTimeout(id: number): void {
    this.timers = this.timers.filter((t) => t.id !== id);
  }
  settle(fn: () => void): void {
    this.settleQueue.push(fn);
  }
  /** Advance the clock, firing due timers in order. */
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (due === undefined) {
        break;
      }
      this.time = due.at;
      this.timers = this.timers.filter((t) => t.id !== due.id);
      due.fn();
    }
    this.time = target;
  }
  /** Drain the settle queue, including entries queued by the drained ones. */
  flushSettle(): void {
    for (let guard = 0; this.settleQueue.length > 0 && guard < 20; guard++) {
      const batch = this.settleQueue;
      this.settleQueue = [];
      for (const fn of batch) {
        fn();
      }
    }
  }
  get pendingSettles(): number {
    return this.settleQueue.length;
  }
}

describe('sceneTransition (the director state machine)', () => {
  let sched: ManualScheduler;
  let restore: () => void;

  beforeEach(() => {
    resetSceneTransitionForTest();
    sched = new ManualScheduler();
    restore = setSceneTransitionSchedulerForTest(sched);
  });

  afterEach(() => {
    restore();
    resetSceneTransitionForTest();
  });

  /** Run the settle window + the reveal dissolve to completion. */
  function finishReveal(): void {
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('revealing');
    sched.advance(REVEAL_MS + 1);
    expect(loadingScreenState.phase).to.eq('idle');
    expect(loadingScreenState.active).to.eq(false);
  }

  it('fast path: an unaware screen reveals after a settled frame, with no text ever shown', () => {
    beginLoading('sync');
    expect(loadingScreenState.phase).to.eq('covering');
    expect(sceneTransitionInputLocked()).to.eq(true);
    noteScreenResolved('cards');
    expect(loadingScreenState.phase).to.eq('covering'); // still settling
    finishReveal();
    expect(loadingScreenState.textShown).to.eq(false);
    // The text timer must be dead: advancing past TEXT_APPEAR_MS after the
    // reveal may not resurrect the status line (epoch guard).
    sched.advance(TEXT_APPEAR_MS * 2);
    expect(loadingScreenState.textShown).to.eq(false);
    expect(sceneTransitionInputLocked()).to.eq(false);
  });

  it('an aware screen holds the curtain until the destination arms and every hold releases', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('covering'); // not armed yet

    const release = deferSceneReveal('board-fit');
    armSceneDestination();
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('covering'); // hold outstanding

    release();
    finishReveal();
  });

  it('a hold registered DURING the settle window postpones the reveal', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    armSceneDestination();
    expect(sched.pendingSettles).to.be.greaterThan(0);
    // A surface mounts late and registers its hold mid-settle.
    const release = deferSceneReveal('late-surface');
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('covering');
    release();
    finishReveal();
  });

  it('text policy: a wait past TEXT_APPEAR_MS shows the status block and holds it readable', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    const release = deferSceneReveal('slow-data');
    armSceneDestination();
    sched.advance(TEXT_APPEAR_MS + 10);
    expect(loadingScreenState.textShown).to.eq(true);
    // The data lands right after the text appeared — the reveal must wait
    // out the dwell, not flash the line.
    release();
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('covering');
    sched.advance(TEXT_MIN_DWELL_MS + 10);
    finishReveal();
  });

  it('long wait flips the long-wait phrasing', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    armSceneDestination();
    deferSceneReveal('very-slow', 20000);
    sched.advance(9500);
    expect(loadingScreenState.longWait).to.eq(true);
  });

  it('every hold is BOUNDED: an unreleased hold force-releases at its max', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    armSceneDestination();
    deferSceneReveal('stuck');
    sched.advance(DEFAULT_HOLD_MAX_MS + TEXT_MIN_DWELL_MS + TEXT_APPEAR_MS + 10);
    finishReveal();
  });

  it('arm watchdog: an aware screen whose destination never arms reveals anyway', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    sched.advance(ARM_WATCHDOG_MS + TEXT_MIN_DWELL_MS + TEXT_APPEAR_MS + 10);
    finishReveal();
  });

  it('boot stall: covering with no route resolution becomes the error state', () => {
    beginLoading('sync');
    sched.advance(BOOT_STALL_MS + 10);
    expect(loadingScreenState.error).to.not.eq('');
    expect(loadingScreenState.active).to.eq(true);
    expect(loadingScreenState.textShown).to.eq(true);
    // The error state keeps the curtain's own buttons interactive.
    expect(sceneTransitionInputLocked()).to.eq(false);
  });

  it('a stale release after the transition ended is a no-op', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    const release = deferSceneReveal('old');
    armSceneDestination();
    endLoading();
    expect(loadingScreenState.phase).to.eq('idle');
    release(); // must not throw, must not resurrect anything
    sched.advance(60000);
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('idle');
    expect(loadingScreenState.active).to.eq(false);
  });

  it('a stale async completion from a PREVIOUS transition cannot touch the next one', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    const staleRelease = deferSceneReveal('previous-attempt');
    armSceneDestination();
    // A newer command supersedes the whole attempt.
    beginLoading('expedition');
    noteScreenResolved('player-home');
    const release = deferSceneReveal('current');
    armSceneDestination();
    staleRelease(); // the old attempt's completion lands late — ignored
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('covering');
    release();
    finishReveal();
  });

  it('failLoading during covering becomes the readable error state; resolution is ignored', () => {
    beginLoading('sync');
    failLoading('Error getting game data');
    expect(loadingScreenState.error).to.eq('Error getting game data');
    expect(loadingScreenState.textShown).to.eq(true);
    noteScreenResolved('player-home');
    armSceneDestination();
    sched.flushSettle();
    sched.advance(60000);
    expect(loadingScreenState.active).to.eq(true);
    expect(loadingScreenState.error).to.eq('Error getting game data');
  });

  it('onSceneRevealed fires at the reveal, and immediately when nothing covers', () => {
    let calls = 0;
    onSceneRevealed(() => calls++);
    expect(calls).to.eq(1); // idle → immediate

    beginLoading('sync');
    onSceneRevealed(() => calls++);
    noteScreenResolved('cards');
    expect(calls).to.eq(1); // still covering
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('revealing');
    expect(calls).to.eq(2); // fired at the reveal
    sched.advance(REVEAL_MS + 1);
    expect(loadingScreenState.phase).to.eq('idle');
  });

  it('default contexts follow the legacy stage vocabulary', () => {
    beginLoading('expedition');
    expect(loadingScreenState.context?.kind).to.eq('new-game');
    beginLoading('interface');
    expect(loadingScreenState.context?.kind).to.eq('main-menu');
    beginLoading('sync');
    expect(loadingScreenState.context?.kind).to.eq('resume-game');
    beginLoading('sync', {kind: 'campaign-mission', mission: 2, missionCount: 4, resume: true});
    expect(loadingScreenState.context).to.deep.eq({kind: 'campaign-mission', mission: 2, missionCount: 4, resume: true});
  });

  it('duplicate hold names stay independent', () => {
    beginLoading('sync');
    noteScreenResolved('player-home');
    const a = deferSceneReveal('fonts');
    const b = deferSceneReveal('fonts');
    armSceneDestination();
    a();
    sched.flushSettle();
    expect(loadingScreenState.phase).to.eq('covering');
    b();
    finishReveal();
  });
});
