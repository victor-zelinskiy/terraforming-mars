import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {BatchArrivalHandle, runBatchArrival} from '@/client/console/consoleBatchArrivalMotion';
import {CardArrivalMode} from '@/client/console/consoleCardArrival';

/**
 * A BATCH DEALT ONTO A STAGE THAT CANNOT BE MEASURED (freeze zero — the bottle's gate, `fz5` · `space-lanes-wg`,
 * 2026-11-19: `wait-graph/ceiling/deck-pick:deal`).
 *
 * A landing rect that is a guess is the visible teleport the arrival exists to remove, so an unmeasurable stage is
 * never flown onto: the proxies are hidden and the batch is handed over. «Handed over immediately» was true only of a
 * batch still waiting for its DATA (somebody calls `notifyPayload`); a batch whose payload was already there had
 * nobody left to call it and stood on the nine-second safety — the caller's deal ceiling ended it first: eight
 * seconds of an empty row and a shut pad. With the payload here and no stage to fly on, nothing is owed.
 */
describe('consoleBatchArrivalMotion — a stage that cannot be measured', () => {
  let clock: ManualFlowClock;
  let handle: BatchArrivalHandle | undefined;
  let settled = 0;

  // (jsdom has no layout: every slot measures 0×0 — the unmeasurable stage itself.)
  function deal(mode: CardArrivalMode): BatchArrivalHandle {
    const proxy = document.createElement('div');
    const flip = document.createElement('div');
    proxy.appendChild(flip);
    const slot = document.createElement('div');
    document.body.append(proxy, slot);
    return runBatchArrival({cards: [{proxy, flip}], slots: [slot], mode, onSettled: () => settled++});
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    settled = 0;
  });
  afterEach(() => {
    handle?.kill();
    handle = undefined;
    setFlowClock(undefined);
    document.body.innerHTML = '';
  });

  it('the payload is HERE: the batch is handed over in the next task — never inside the call, never at the safety', () => {
    handle = deal('in-flight-reveal');
    expect(settled, 'the caller holds its handle before anything is said').to.eq(0);
    clock.advance(0);
    expect(settled, 'nothing was owed').to.eq(1);
    expect(clock.pending(), 'and nothing of the beat is left on the clock').to.eq(0);
    clock.advance(20_000);
    expect(settled, 'once').to.eq(1);
  });

  it('the data is still COMING: the batch waits for it — and is handed over the moment it lands', () => {
    handle = deal('awaiting-data');
    clock.advance(5_000);
    expect(settled, 'there is no face to hand over yet').to.eq(0);
    handle.notifyPayload();
    expect(settled).to.eq(1);
    expect(clock.pending()).to.eq(0);
  });

  it('…bounded by the safety when it never lands', () => {
    handle = deal('awaiting-data');
    clock.advance(8_999);
    expect(settled).to.eq(0);
    clock.advance(1);
    expect(settled).to.eq(1);
  });

  it('a batch taken back before its hand-over says nothing', () => {
    handle = deal('in-flight-reveal');
    handle.kill();
    clock.advance(20_000);
    expect(settled).to.eq(0);
    expect(clock.pending()).to.eq(0);
  });
});
