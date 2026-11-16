/*
 * THE PLAY LANDING'S DISSOLVE IS BOUNDED ON ITS OWN CLOCK (FLAKE ZERO · class N — `consolePlayOutcomeClaim.ts`
 * `beginPlayLandingRelease`).
 *
 * When a play's landing scene yields to its outcome it DISSOLVES (a GSAP tween, ≈ 240 ms) and stays mounted for exactly
 * that long (`playLandingReleasing`). Its backstop was 1.2 s of the WALL clock: when GSAP's clock fell behind (the deal
 * it yields to is a long task at 4K, booked as 33 ms by `lagSmoothing`) the flag fell mid-fade and the scene's `v-if`
 * tore it out. The backstop now rides GSAP's clock; a wall-clock ceiling stays for a clock that does not run.
 */
import {expect} from 'chai';
import {gsap} from 'gsap';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {beginPlayLandingRelease, markPlayLandingReleased, playLandingReleasing} from '@/client/console/played/consolePlayOutcomeClaim';

describe('the play landing\'s dissolve · its backstop rides the dissolve\'s clock', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    gsap.globalTimeline.timeScale(0.0001);
  });
  afterEach(() => {
    markPlayLandingReleased();
    gsap.globalTimeline.timeScale(1);
    gsap.ticker.wake();
    setFlowClock(undefined);
  });

  it('the dissolve still fading behind the wall clock keeps the scene mounted — its own onComplete lets it go', () => {
    beginPlayLandingRelease();
    gsap.ticker.sleep();
    for (let t = 0; t < 3000; t += 300) {
      clock.advance(300);
      gsap.ticker.tick();
    }
    expect(playLandingReleasing(), 'the wall is past 1.2 s, the dissolve is not').to.eq(true);
    markPlayLandingReleased();
    expect(playLandingReleasing()).to.eq(false);
  });

  it('…and a clock that never runs is bounded by the wall-clock ceiling', () => {
    beginPlayLandingRelease();
    gsap.ticker.sleep();
    clock.advance(1200 + 4000 - 1);
    expect(playLandingReleasing()).to.eq(true);
    clock.advance(1);
    expect(playLandingReleasing()).to.eq(false);
  });
});
