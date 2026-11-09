import {expect} from 'chai';
import {MotionSources, STILL_HOLD_SHADOW_MS, StillHoldState, motionWitnessed, observeStillHold, witnessMotion} from '@/client/console/waitGraph/motionWitness';

/**
 * THE MOTION WITNESS — a blocking hold claims a story is playing; the witness asks the page whether anything moves.
 * Ambient loops prove nothing; a paused or finished tween is no motion.
 */
describe('motionWitness', () => {
  const tween = (over: {paused?: boolean, progress?: number, repeat?: number} = {}) =>
    ({paused: () => over.paused ?? false, progress: () => over.progress ?? 0.5, repeat: () => over.repeat ?? 0});
  const anim = (playState: string, iterations = 1) => ({playState, effect: {getTiming: () => ({iterations})}});
  const sources = (tweens: ReturnType<typeof tween>[], animations: ReturnType<typeof anim>[]): MotionSources =>
    ({tweens: () => tweens, animations: () => animations});

  it('counts finite motion only — a running tween or animation, never an ambient loop, a paused or a finished one', () => {
    const w = witnessMotion(sources(
      [tween(), tween({paused: true}), tween({progress: 1}), tween({repeat: -1}), tween({progress: 0})],
      [anim('running'), anim('running', Infinity), anim('finished'), anim('paused')]));
    expect(w).to.deep.equal({gsap: 2, css: 1});
    expect(motionWitnessed(w)).is.true;
    expect(motionWitnessed(witnessMotion(sources([tween({repeat: -1})], [anim('running', Infinity)])))).is.false;
  });

  it('a blocking hold standing STILL is named once per still spell; motion or no hold restarts the clock', () => {
    let state: StillHoldState = {since: 0, named: false};
    const crosses: Array<number> = [];
    for (let t = 1000; t <= 1000 + STILL_HOLD_SHADOW_MS + 3000; t += 1000) {
      const r = observeStillHold(state, t, true, false);
      state = r.state;
      if (r.cross) {
        crosses.push(r.stillMs);
      }
    }
    expect(crosses).to.deep.equal([STILL_HOLD_SHADOW_MS]);
    // Something moved: the spell is over — the next still spell is named again.
    state = observeStillHold(state, 20_000, true, true).state;
    expect(state).to.deep.equal({since: 0, named: false});
    // No blocking hold: nothing to judge.
    expect(observeStillHold({since: 5, named: true}, 30_000, false, false).state).to.deep.equal({since: 0, named: false});
  });
});
