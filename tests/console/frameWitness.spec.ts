import {expect} from 'chai';
import {createManualClock, FlowClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  __resetFrameWitnessForTesting, LAG_BOOKED_MS, LAG_THRESHOLD_MS, STARVED_MIN_MS, starvedReason, watchFrames,
} from '@/client/console/kernel/frameWitness';
import {beginCeilingWait, resetCeilingStats} from '@/client/console/waitGraph/ceilingWait';
import {resetWaitGraph} from '@/client/console/waitGraph/waitGraph';
import {causeOf} from '@/common/diagnostics/cause';

/**
 * THE FRAME WITNESS (docs/claude/console/freeze-zero/PLAN.md § 8, stage 1 — `src/client/console/kernel/frameWitness.ts`).
 *
 * A motion's bound is kept in wall time; the motion advances on GSAP's clock, which books a frame gap over 500 ms as
 * 33 ms. A page that stalls — behind another window, hidden, starved — gives a flight a fraction of the wall time its
 * bound counts: the ceiling is then the wait's honest end (`planned`), never a defect event. The box monkey's duo
 * pass named eight tables this way — always the page that was not in front (it froze a second out of every two).
 */
describe('frameWitness — a motion\'s bound is judged against the motion time the page gave', () => {
  let clock: ManualFlowClock;
  const warns: Array<string> = [];
  const original = console.warn;

  /**
   * A page whose frames come only when the spec says: time runs, timers fire, and a frame is painted by `paint()`.
   * (`advance` of the manual clock paints every 16 ms — a healthy page; this one is the stalled page.)
   */
  function stalledPage(base: ManualFlowClock): {clock: FlowClock, paint: () => void} {
    let pending: Array<() => void> = [];
    return {
      clock: {...base, nextFrame: (fn) => {
        pending.push(fn);
        return () => {
          pending = pending.filter((f) => f !== fn);
        };
      }},
      paint: () => {
        const due = pending;
        pending = [];
        due.forEach((fn) => fn());
      },
    };
  }

  beforeEach(() => {
    __resetFrameWitnessForTesting();
    resetWaitGraph();
    resetCeilingStats();
    clock = createManualClock(1_000);
    setFlowClock(clock);
    warns.splice(0);
    console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
  });
  afterEach(() => {
    console.warn = original;
    __resetFrameWitnessForTesting();
    setFlowClock(undefined);
    resetWaitGraph();
    resetCeilingStats();
  });

  it('the reason, pure: starved is LITTLE MOTION TIME OVER LONG ENOUGH — a short watch says nothing, a painting page is never starved', () => {
    expect(starvedReason(0, STARVED_MIN_MS - 1, 0), 'too short to say').to.eq(undefined);
    expect(starvedReason(33, 1_780, 1)).to.eq('the page gave the motion 33 of 1780 ms, 1 frame gap over 500 ms — a motion cannot keep its bound on a page that does not paint');
    expect(starvedReason(2_066, 4_000, 2), 'half the time frozen').to.match(/^the page gave the motion 2066 of 4000 ms, 2 frame gaps over 500 ms/);
    expect(starvedReason(3_400, 4_000, 1), 'one hiccup in four seconds is not a starved page').to.eq(undefined);
    expect(starvedReason(1_780, 1_780, 0)).to.eq(undefined);
    expect(starvedReason(33, 1_780, 1), 'no parenthesis: the reason is printed inside the line\'s own (planned: …)').not.to.match(/[()]/);
  });

  it('a HEALTHY page gives a motion all of its time — whatever the frame rate, as long as no gap passes GSAP\'s threshold', () => {
    const watch = watchFrames();
    clock.advance(1_600);
    expect(watch.motionMs()).to.eq(1_600);
    expect(watch.stalls()).to.eq(0);
    expect(watch.starved()).to.eq(undefined);
    watch.stop();
    watch.stop();
    expect(clock.pending(), 'nobody watches: nothing is left armed').to.eq(0);
    // A renderer throttled to 4 fps: gaps of 250 ms are booked in full — GSAP animates such a page in real time.
    const page = stalledPage(clock);
    setFlowClock(page.clock);
    const slow = watchFrames();
    for (let i = 0; i < 8; i++) {
      clock.advance(250);
      page.paint();
    }
    expect(slow.motionMs()).to.eq(2_000);
    expect(slow.starved()).to.eq(undefined);
    slow.stop();
  });

  it('a page that FREEZES A SECOND OUT OF EVERY TWO (the tab that is not in front): each long gap is booked as GSAP books it', () => {
    const page = stalledPage(clock);
    setFlowClock(page.clock);
    const watch = watchFrames();
    for (let second = 0; second < 2; second++) {
      // …a second of healthy frames…
      for (let i = 0; i < 50; i++) {
        clock.advance(20);
        page.paint();
      }
      // …and a second with none.
      clock.advance(1_000);
      page.paint();
    }
    expect(watch.elapsedMs()).to.eq(4_000);
    expect(watch.stalls()).to.eq(2);
    expect(watch.motionMs()).to.eq(2 * 1_000 + 2 * LAG_BOOKED_MS);
    expect(watch.starved()).to.eq('the page gave the motion 2066 of 4000 ms, 2 frame gaps over 500 ms — a motion cannot keep its bound on a page that does not paint');
    // …and a page that never paints again is ONE long stall, booked while it is still open.
    const hidden = watchFrames();
    clock.advance(LAG_THRESHOLD_MS + 1_300);
    expect(hidden.stalls()).to.eq(1);
    expect(hidden.motionMs()).to.eq(LAG_BOOKED_MS);
    watch.stop();
    hidden.stop();
  });

  it('A MOTION\'S CEILING ON A PAGE THAT PAINTED: the defect it always was', () => {
    const wait = beginCeilingWait({id: 'hand:landing', owner: 'handDock', what: 'the landing of a card', maxMs: 1_780});
    clock.advance(1_780);
    wait.ceiling();
    expect(warns).to.have.length(1);
    expect(warns[0]).to.match(/did not come in 1780 ms — the wait ended on its ceiling$/);
    expect(causeOf(warns[0], 'warn')).to.deep.include({cls: 'wait-graph/ceiling/hand:landing', tier: 'defect'});
    expect(clock.pending(), 'the watch ended with the wait').to.eq(0);
  });

  it('…ON A PAGE THAT DID NOT PAINT: the wait\'s honest end — said with its reason, counted, never an event', () => {
    setFlowClock(stalledPage(clock).clock);
    const wait = beginCeilingWait({id: 'hand:landing', owner: 'handDock', what: 'the landing of a card', maxMs: 1_780});
    clock.advance(1_780);
    wait.ceiling();
    expect(warns[0]).to.match(/the wait ended on its ceiling \(planned: the page gave the motion 33 of 1780 ms, 1 frame gap over 500 ms — a motion cannot keep its bound on a page that does not paint\)$/);
    expect(causeOf(warns[0], 'warn')).to.deep.include({cls: 'wait-graph/ceiling/hand:landing', tier: 'planned'});
  });

  it('only a MOTION is excused by frames — a wait for the SERVER on a stalled page is still a defect; and a wait\'s own reason comes first', () => {
    setFlowClock(stalledPage(clock).clock);
    const server = beginCeilingWait({id: 'played-hero:payback', owner: 'playedHero', what: 'the play answer', maxMs: 8_000, target: 'server'});
    clock.advance(8_000);
    server.ceiling();
    expect(warns[0], 'the server does not paint').to.match(/the wait ended on its ceiling$/);
    const own = beginCeilingWait({id: 'scale-step-rating:stage', owner: 'rating', what: 'the stage of the rating', maxMs: 2_000});
    clock.advance(2_000);
    own.ceiling('the stage is covered');
    expect(warns[1]).to.match(/\(planned: the stage is covered\)$/);
  });

  it('a HOLD\'s ceiling line reads the same way: «(leaked hold?)» on a painting page is a defect, «(planned: …)» is not', () => {
    const leaked = '[animation-hold] "parliament-vote-landing" held for over 4000ms — force-released by the safety ceiling (leaked hold?)';
    const starved = '[animation-hold] "parliament-vote-landing" held for over 4000ms — force-released by the safety ceiling ' +
      '(planned: the page gave the motion 2066 of 4000 ms, 2 frame gaps over 500 ms — a motion cannot keep its bound on a page that does not paint)';
    expect(causeOf(leaked, 'warn')).to.deep.include({cls: 'animation-hold/ceiling/parliament-vote-landing', tier: 'defect'});
    expect(causeOf(starved, 'warn')).to.deep.include({cls: 'animation-hold/ceiling/parliament-vote-landing', tier: 'planned'});
  });
});
