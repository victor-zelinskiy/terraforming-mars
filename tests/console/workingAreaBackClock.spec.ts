import {expect} from 'chai';
import {WORKING_AREA_PENDING_CEILINGS, workingAreaSettled} from '@/client/console/colonyTrade/workingAreaBack';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * THE WORKING AREA'S BOUND COUNTS FROM ITS TRANSITIONS' START (FLAKE ZERO Ф4, class N). The colony stage's working area
 * comes back over a composited transition that stays PENDING until the compositor resolves its start time; counted
 * from the dwell's end, a starved frame spent the bound before the fade had begun, and the trade's track reset glided
 * over a track at a fraction of its opacity. Until every transition has started only the «never started» bound stands.
 */
describe('workingAreaSettled — the bound runs from the transitions\' start', () => {
  const CEILING = 1_200;
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  type FakeTransition = {transitionProperty: string, finished: Promise<unknown>, ready: Promise<unknown>};
  function pendingFade(): {el: Element, start: () => void, finish: () => void} {
    let start: () => void = () => undefined;
    let finish: () => void = () => undefined;
    const fade: FakeTransition = {
      transitionProperty: 'opacity',
      ready: new Promise<void>((resolve) => start = resolve),
      finished: new Promise<void>((resolve) => finish = resolve),
    };
    return {el: {getAnimations: () => [fade]} as unknown as Element, start: () => start(), finish: () => finish()};
  }

  it('a fade still PENDING is waited for past the bound — the bound counts from its start', async () => {
    const fade = pendingFade();
    let back = false;
    void workingAreaSettled(fade.el, CEILING).then(() => back = true);
    clock.advance(CEILING + 600);
    await flush();
    expect(back, 'the fade has not begun — the track is still blank').to.eq(false);
    fade.start(); // the compositor gives it a start time
    await flush();
    clock.advance(CEILING - 100);
    await flush();
    expect(back, 'inside the bound counted from the start').to.eq(false);
    fade.finish();
    await flush();
    expect(back, 'the fade ran out — the working area is back').to.eq(true);
  });

  it('a fade that started and never ends is bounded from its start', async () => {
    const fade = pendingFade();
    let back = false;
    void workingAreaSettled(fade.el, CEILING).then(() => back = true);
    clock.advance(500);
    fade.start();
    await flush();
    clock.advance(CEILING - 100);
    await flush();
    expect(back).to.eq(false);
    clock.advance(200);
    await flush();
    expect(back).to.eq(true);
  });

  it('a fade that never starts ends on the «never started» bound', async () => {
    const fade = pendingFade();
    let back = false;
    void workingAreaSettled(fade.el, CEILING).then(() => back = true);
    clock.advance(CEILING * WORKING_AREA_PENDING_CEILINGS - 100);
    await flush();
    expect(back).to.eq(false);
    clock.advance(200);
    await flush();
    expect(back).to.eq(true);
  });
});
