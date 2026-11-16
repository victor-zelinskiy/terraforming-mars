/*
 * THE ACTION COMMIT'S BACKSTOPS RUN ON THE MOTION'S OWN CLOCK (FLAKE ZERO · class N — `consoleActionCommit.ts`).
 *
 * The commit's minimum beat (the shell's dismiss gate) and the impulse latch (PL-103 — the vote's price waits for the
 * impulse) each had a 1.4 s WALL-CLOCK backstop counted from the submit, over a ≈0.7 s GSAP episode. When GSAP's clock
 * fell behind the wall's (the answer's long task booked as 33 ms by `lagSmoothing`), the backstop fired mid-sweep: the
 * workspace folded, or the price left, before the impulse had landed. The backstops now ride GSAP's clock; a wall-clock
 * ceiling stays only for a clock that does not run at all.
 *
 * GSAP's frames are given by hand and its timeline crawls (`timeScale`) — frames come while the animation clock lags.
 */
import {expect} from 'chai';
import {gsap} from 'gsap';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  actionCommitHolding, afterCommitImpulse, armActionCommit, armCommitImpulse, markActionCommitSettled, resetActionCommit,
} from '@/client/console/consoleActionCommit';

describe('the action commit · its backstops ride the motion\'s clock', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    gsap.globalTimeline.timeScale(0.0001);
  });
  afterEach(() => {
    resetActionCommit();
    gsap.globalTimeline.timeScale(1);
    gsap.ticker.wake();
    setFlowClock(undefined);
  });

  function slowFrames(ms: number): void {
    for (let t = 0; t < ms; t += 300) {
      clock.advance(300);
      gsap.ticker.tick();
    }
  }

  it('the minimum beat (the dismiss gate) holds while the episode\'s clock lags — its own settle opens it', () => {
    armActionCommit({sourceCard: 'Some Card', kind: 'resources', specs: [], origins: []});
    gsap.ticker.sleep();
    slowFrames(3000);
    expect(actionCommitHolding(), 'the wall clock is past 1.4 s, the motion is not').to.eq(true);
    markActionCommitSettled(); // the episode's own onComplete
    expect(actionCommitHolding()).to.eq(false);
  });

  it('…and a clock that never runs is still bounded by the wall-clock ceiling', () => {
    armActionCommit({sourceCard: 'Some Card', kind: 'resources', specs: [], origins: []});
    gsap.ticker.sleep();
    clock.advance(1400 + 5000 - 1);
    expect(actionCommitHolding()).to.eq(true);
    clock.advance(1);
    expect(actionCommitHolding(), 'the never-happened net').to.eq(false);
  });

  it('the impulse latch: the price waits for the impulse while its clock lags; the ceiling bounds a dead one', () => {
    let ran = 0;
    armCommitImpulse();
    afterCommitImpulse(() => ran++);
    gsap.ticker.sleep();
    slowFrames(3000);
    expect(ran, 'never before the impulse lands').to.eq(0);
    clock.advance(5000);
    expect(ran).to.eq(1);
  });
});
