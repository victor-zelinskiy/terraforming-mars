/*
 * A SURFACE HOOK'S NET CATCHES A STALL, NEVER A SLOW MOTION (FLAKE ZERO · class N — `promptHandoffMotion.episodeNet`,
 * used by `surfaceMotionDirector.guarded` and `promptHandoffMotion.guardedSwap`).
 *
 * The enter / leave hooks guarantee Vue its `done()` with a wall-clock safety sized from the tween's own length. GSAP's
 * clock is not the wall's (`lagSmoothing` books a long task — the board re-shown at 4K — as 33 ms), so on a starved
 * frame that safety fired mid-fade and Vue took a leaving surface away at half its opacity. The net now looks at its
 * budget: an episode still being DRIVEN (GSAP ticking) gets more time; one whose clock stopped is CAUGHT UP
 * (`progress(1)` — its last frame) and ended; the hard ceiling bounds both.
 *
 * GSAP's frames are given by hand (`gsap.ticker.sleep()` + `tick()`) and its timeline crawls (`timeScale`): a tick
 * advances the fade by next to nothing — exactly a renderer whose frames come while the animation clock lags the wall.
 */
import {expect} from 'chai';
import {gsap} from 'gsap';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {surfaceLeaveHook} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {EPISODE_NET_CEILING_MS, promptSwapLeaveHook} from '@/client/console/surfaceMotion/promptHandoffMotion';

describe('surface motion · a hook\'s net catches a STALL, never a slow motion', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    // The animation clock CRAWLS (whatever real time this spec takes): GSAP is driven, and far behind the wall's.
    gsap.globalTimeline.timeScale(0.0001);
  });
  afterEach(() => {
    gsap.globalTimeline.timeScale(1);
    gsap.ticker.wake();
    setFlowClock(undefined);
    document.body.innerHTML = '';
  });

  function bandSurface(): {el: HTMLElement, panel: HTMLElement} {
    const el = document.createElement('div');
    el.dataset.motionSurface = 'sheet';
    const panel = document.createElement('div');
    panel.dataset.motionPanel = '';
    el.appendChild(panel);
    document.body.appendChild(el);
    return {el, panel};
  }

  function promptPlate(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'con-prompt';
    document.body.appendChild(el);
    return el;
  }

  /** The wall clock runs `ms` while GSAP keeps ticking (a frame per 300 ms) and hardly advances. */
  function slowFrames(ms: number): void {
    for (let t = 0; t < ms; t += 300) {
      clock.advance(300);
      gsap.ticker.tick();
    }
  }

  it('a band surface\'s LEAVE: the fade still being driven is never cut — done() waits for it', () => {
    const {el} = bandSurface();
    let done = 0;
    surfaceLeaveHook(el, () => done++);
    gsap.ticker.sleep();
    slowFrames(2400);
    expect(done, 'Vue keeps the leaving surface while its fade is driven').to.eq(0);
  });

  it('…a clock that STOPPED (no frame between two looks) is caught up — the surface at its end pose, then done()', () => {
    const {el, panel} = bandSurface();
    let done = 0;
    surfaceLeaveHook(el, () => done++);
    gsap.ticker.sleep();
    slowFrames(900);
    expect(done).to.eq(0);
    clock.advance(2000); // no frame at all
    expect(done, 'ended').to.eq(1);
    expect(panel.style.opacity, 'caught up to its end — never resolved half-faded').to.eq('0');
  });

  it('THE LEAVE\'S MARK LIVES EXACTLY AS LONG AS THE LEAVE — a surface that leaves by `v-show` stays in the tree, and is no leaver once its leave ended', () => {
    // (CI finding #80: `section.con-parl` stood hidden — then shown again — with `data-motion-leaving` for good; every
    // foreign landing after it waited its whole ceiling for a surface that had left long ago.)
    const {el} = bandSurface();
    let done = 0;
    surfaceLeaveHook(el, () => done++);
    expect(el.dataset.motionLeaving, 'marked for the whole leave').to.eq('1');
    gsap.ticker.sleep();
    slowFrames(900);
    expect(el.dataset.motionLeaving, 'still leaving').to.eq('1');
    clock.advance(2000);
    expect(done).to.eq(1);
    // The node is still in the document (a `v-show` leaver is hidden, never removed) — and it is no leaver.
    expect(el.isConnected).to.eq(true);
    expect(el.dataset.motionLeaving, 'the mark went with the leave').to.eq(undefined);
    expect(document.querySelector('[data-motion-leaving]')).to.eq(null);
  });

  it('…and the hard ceiling bounds an episode that is driven for ever', () => {
    const {el} = bandSurface();
    let done = 0;
    surfaceLeaveHook(el, () => done++);
    gsap.ticker.sleep();
    slowFrames(EPISODE_NET_CEILING_MS + 1200);
    expect(done).to.eq(1);
  });

  it('a keyed PROMPT swap\'s leave: the same net', () => {
    const el = promptPlate();
    let done = 0;
    promptSwapLeaveHook(el, () => done++);
    gsap.ticker.sleep();
    slowFrames(2400);
    expect(done, 'the release still being driven').to.eq(0);
    clock.advance(2000);
    expect(done).to.eq(1);
  });
});
