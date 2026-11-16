import {expect} from 'chai';
import {flushPromises} from '@vue/test-utils';
import {awaitArrivingFace} from '@/client/console/cardReaction/cardReactionDirector';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/**
 * A REACTOR'S FACE THAT IS ARRIVING (PL-1098) is waited for while its arrival is LIVE — a deal still carrying it in, an
 * entrance still running — never for a budget counted from the question (FLAKE ZERO Ф4, class N). Counted from the
 * question, 2.4 s ran out under a deal a slow frame had stretched: the reactor rose at the stage beside the card about
 * to stand in its place (the chain's own place wait), or found no face and its answer came out of nowhere (the start's
 * corporation face). Both stand on `awaitArrivingFace`; the kernel's clock is the spec's.
 */
describe('awaitArrivingFace — the budget counts from the last moment the arrival was live', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });
  const step = async (ms: number) => {
    for (let left = ms; left > 0; left -= 50) {
      clock.advance(Math.min(50, left));
      await flushPromises();
    }
  };
  type Result = {face: string | undefined, waited: boolean, late: boolean};
  const NODE = {id: 'spec:arriving-face', owner: 'arrivingFaceClock.spec', what: 'a face arriving'};

  it('a face whose deal is still carrying it in is waited for past the old 2.4 s — and found where it lands', async () => {
    let dealing = true;
    let face: string | undefined = undefined;
    let result: Result | undefined;
    void awaitArrivingFace({
      find: () => face, live: () => dealing, over: () => false, budgetMs: 2_400, ceilingMs: 8_000, node: NODE,
    }).then((r) => {
      result = r;
    });
    await step(4_000);
    expect(result, 'the deal is still live — no second instance at the stage').to.eq(undefined);
    dealing = false;
    face = 'the seat';
    await step(100);
    expect(result).to.deep.eq({face: 'the seat', waited: true, late: false});
  });

  it('once the arrival stops being live the budget runs from THAT moment', async () => {
    let dealing = true;
    let result: Result | undefined;
    void awaitArrivingFace({
      find: () => undefined, live: () => dealing, over: () => false, budgetMs: 2_400, ceilingMs: 8_000, node: NODE,
    }).then((r) => {
      result = r;
    });
    await step(3_000);
    dealing = false; // the hold let go — and the face never stood
    await step(2_200);
    expect(result, 'still inside the budget counted from the last live moment').to.eq(undefined);
    await step(400);
    expect(result).to.deep.eq({face: undefined, waited: true, late: true});
  });

  it('nothing arriving: the plain budget, as before', async () => {
    let result: Result | undefined;
    void awaitArrivingFace({
      find: () => undefined, live: () => false, over: () => false, budgetMs: 2_400, ceilingMs: 8_000, node: NODE,
    }).then((r) => {
      result = r;
    });
    await step(2_300);
    expect(result).to.eq(undefined);
    await step(200);
    expect(result?.late).to.eq(true);
  });

  it('an arrival that never ends is bounded by the ceiling', async () => {
    let result: Result | undefined;
    void awaitArrivingFace({
      find: () => undefined, live: () => true, over: () => false, budgetMs: 2_400, ceilingMs: 8_000, node: NODE,
    }).then((r) => {
      result = r;
    });
    await step(7_900);
    expect(result).to.eq(undefined);
    await step(200);
    expect(result?.late, 'a hold nobody lets go never keeps the reactor waiting for ever').to.eq(true);
  });

  it('`over` ends it at once, with no face and no lateness (the chain moved on / nothing arrives any more)', async () => {
    let gone = false;
    let result: Result | undefined;
    void awaitArrivingFace({
      find: () => undefined, live: () => true, over: () => gone, budgetMs: 2_400, ceilingMs: 8_000, node: NODE,
    }).then((r) => {
      result = r;
    });
    await step(500);
    gone = true;
    await step(100);
    expect(result).to.deep.eq({face: undefined, waited: true, late: false});
  });
});
