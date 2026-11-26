import {expect} from 'chai';
import {
  afterCommitImpulse, armCommitImpulse, commitImpulseLive, landCommitImpulse, resetActionCommit,
} from '../../src/client/console/consoleActionCommit';
import {createManualClock, setFlowClock} from '../../src/client/console/kernel/flowClock';

/**
 * THE IMPULSE LATCH (PL-103, the TR35 walk) — a beat that is the ACTION
 * COMMIT's consequence but is driven by the SERVER's answer (the staged vote's
 * price token, PL-100: «impulse → price → cube») runs only once the impulse has
 * LANDED. The motion arms the latch at its episode's start and lands it at the
 * handoff — or at any other ending — so the order the player reads no longer
 * depends on how fast the answer came back, and no waiter can be stranded.
 */
describe('the commit impulse latch (PL-103)', () => {
  afterEach(() => resetActionCommit());

  it('no impulse in flight: a waiter runs at once (a play\'s M€ door, a live grant, reduced motion done)', () => {
    let ran = 0;
    afterCommitImpulse(() => ran++);
    expect(ran).eq(1);
    expect(commitImpulseLive()).is.false;
  });

  it('an impulse in flight: the waiter waits for the LANDING, then runs exactly once', () => {
    const order: Array<string> = [];
    armCommitImpulse();
    expect(commitImpulseLive()).is.true;
    afterCommitImpulse(() => order.push('price'));
    order.push('answer applied');
    expect(order, 'a fast server\'s answer does not start the price').deep.eq(['answer applied']);
    landCommitImpulse();
    order.push('after landing');
    landCommitImpulse();
    expect(order, 'the price follows the impulse, once').deep.eq(['answer applied', 'price', 'after landing']);
  });

  it('several waiters run in arrival order', () => {
    const order: Array<number> = [];
    armCommitImpulse();
    afterCommitImpulse(() => order.push(1));
    afterCommitImpulse(() => order.push(2));
    landCommitImpulse();
    expect(order).deep.eq([1, 2]);
  });

  it('a NEW episode lands the previous one first — a killed impulse never strands its waiter', () => {
    let ran = 0;
    armCommitImpulse();
    afterCommitImpulse(() => ran++);
    armCommitImpulse();
    expect(ran, 'the old episode\'s waiter ran when the new one armed').eq(1);
    expect(commitImpulseLive(), 'the new one is in flight').is.true;
  });

  it('a reset (game switch) releases every waiter', () => {
    let ran = 0;
    armCommitImpulse();
    afterCommitImpulse(() => ran++);
    resetActionCommit();
    expect(ran).eq(1);
    expect(commitImpulseLive()).is.false;
  });

  // A STALLED TIMELINE is one whose motion clock does not move — so its bound is the latch's WALL ceiling, read on the
  // kernel's own clock and advanced by hand. (This row slept 1.5 s of real time against the motion's 1.4 s timer and
  // went red one run in three on a loaded laptop: the motion ticker lags a starved page by design — the race was the
  // spec's, never the latch's.)
  it('a stalled timeline is bounded: the latch\'s own ceiling lands it, on the wall clock', () => {
    const clock = createManualClock(Date.now());
    setFlowClock(clock);
    try {
      let ran = 0;
      armCommitImpulse();
      afterCommitImpulse(() => ran++);
      clock.advance(1_000);
      expect(ran, 'the motion is still owed its landing').eq(0);
      expect(commitImpulseLive()).is.true;
      clock.advance(10_000);
      expect(ran, 'the ceiling landed it').eq(1);
      expect(commitImpulseLive()).is.false;
    } finally {
      resetActionCommit();
      setFlowClock(undefined);
    }
  });
});
