/*
 * Guards for the delta-chip COALESCING rules (changeFeedbackManager).
 *
 * The manager decides what ONE chip says when several changes land in a
 * burst. Two rules carry the whole behaviour and both shipped as bugs:
 *
 *   1. A gain and a loss are NEVER summed into one number — they are two
 *      events and get two chips. Summing them also used to be able to net
 *      to 0, which made the visible chip vanish with nothing explaining it.
 *   2. The window measures the GAP between changes, not the age of the
 *      burst, so seven cards landing one by one stay ONE accumulation.
 */
import {expect} from 'chai';
import {changeFeedbackManager} from '@/client/components/feedback/changeFeedbackManager';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {__resetMotionTokensForTesting} from '@/client/components/motion/motionTokens';

const SCOPE = 'blue';
const METRIC = 'globals.hand-dock';
/** Comfortably longer than any real chip lifetime — "the burst is still on". */
const WIDE = 60_000;

function report(value: number, windowMs = WIDE) {
  return changeFeedbackManager.report(SCOPE, METRIC, value, windowMs);
}

describe('changeFeedbackManager (delta coalescing)', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    __resetMotionTokensForTesting();
    changeFeedbackManager.reset();
  });

  afterEach(() => {
    __resetMotionTokensForTesting();
    changeFeedbackManager.reset();
    FakeLocalStorage.deregister(localStorage);
  });

  it('the first observation is a baseline, and an unchanged value is not an event', () => {
    expect(report(0)).to.be.null;
    expect(report(0)).to.be.null;
  });

  it('the first change is a fresh event — raw delta, not merged', () => {
    report(0);
    const event = report(3);
    expect(event).to.not.be.null;
    expect(event!.delta).to.eq(3);
    expect(event!.netDelta).to.eq(3);
    expect(event!.merged).to.be.false;
  });

  it('a burst of same-sign changes COALESCES into one running total', () => {
    // Seven cards landing one by one into the hand dock — the case that used
    // to print «+3 +4 +5 +6» across the screen instead of one chip.
    report(0);
    const seen = [];
    for (let value = 1; value <= 7; value++) {
      seen.push(report(value)!);
    }
    expect(seen.map((e) => e.netDelta)).to.deep.eq([1, 2, 3, 4, 5, 6, 7]);
    expect(seen.map((e) => e.merged)).to.deep.eq([false, true, true, true, true, true, true]);
    // Every step is still an honest +1 of its own.
    expect(seen.every((e) => e.delta === 1)).to.be.true;
  });

  it('NEVER sums a loss into a gain — the sign flip starts a separate chip', () => {
    report(0);
    expect(report(3)!.netDelta).to.eq(3);
    const loss = report(2)!;
    expect(loss.delta).to.eq(-1);
    // The killer case: this must NOT be +2.
    expect(loss.netDelta).to.eq(-1);
    expect(loss.merged).to.be.false;
  });

  it('NEVER sums a gain into a loss either, and can never net out to a chip-less 0', () => {
    report(10);
    expect(report(7)!.netDelta).to.eq(-3);
    const gain = report(10)!;
    expect(gain.netDelta).to.eq(3);
    expect(gain.merged).to.be.false;
    expect(gain.netDelta).to.not.eq(0);
  });

  it('after the flip, the NEW direction coalesces on its own', () => {
    report(0);
    report(3);
    expect(report(2)!.netDelta).to.eq(-1);
    const deeper = report(0)!;
    expect(deeper.netDelta).to.eq(-3);
    expect(deeper.merged).to.be.true;
  });

  it('a change outside the merge window is a fresh chip, not a continuation', async () => {
    report(0);
    expect(report(3, 1)!.netDelta).to.eq(3);
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    const later = report(4, 1)!;
    expect(later.netDelta).to.eq(1);
    expect(later.merged).to.be.false;
  });

  it('clearActive ends the accumulation — the chip faded, so the next change is raw', () => {
    report(0);
    expect(report(3)!.netDelta).to.eq(3);
    changeFeedbackManager.clearActive(SCOPE, METRIC);
    const fresh = report(4)!;
    expect(fresh.netDelta).to.eq(1);
    expect(fresh.merged).to.be.false;
  });

  it('setBaseline re-points the value and drops any running accumulation', () => {
    report(0);
    report(3);
    changeFeedbackManager.setBaseline(SCOPE, METRIC, 3);
    const next = report(5)!;
    expect(next.netDelta).to.eq(2);
    expect(next.merged).to.be.false;
  });

  it('scopes accumulate independently', () => {
    changeFeedbackManager.report('blue', METRIC, 0, WIDE);
    changeFeedbackManager.report('red', METRIC, 0, WIDE);
    expect(changeFeedbackManager.report('blue', METRIC, 2, WIDE)!.netDelta).to.eq(2);
    expect(changeFeedbackManager.report('red', METRIC, 1, WIDE)!.netDelta).to.eq(1);
    expect(changeFeedbackManager.report('blue', METRIC, 5, WIDE)!.netDelta).to.eq(5);
  });
});
