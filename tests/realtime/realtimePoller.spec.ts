import {expect} from 'chai';
import {startRealtimePoller} from '../../src/client/components/realtime/realtimePoller';
import {__resetRealtimeSyncForTesting, wakeNow} from '../../src/client/components/realtime/realtimeSync';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('realtime/realtimePoller', () => {
  beforeEach(() => __resetRealtimeSyncForTesting());
  afterEach(() => __resetRealtimeSyncForTesting());

  it('fetches on the fallback timer at the provided interval', async () => {
    let calls = 0;
    const stop = startRealtimePoller(() => {
      calls += 1;
    }, 30, () => 30);
    await delay(80); // ~2 fallback ticks
    stop();
    expect(calls).to.be.greaterThan(0);
    const after = calls;
    await delay(80);
    expect(calls).to.eq(after); // stopped — no more fallback fetches
  });

  it('fetches immediately on a realtime wake and resets the fallback', async () => {
    let calls = 0;
    const stop = startRealtimePoller(() => {
      calls += 1;
    }, 10_000, () => 10_000); // long fallback so only a wake can fetch soon
    await delay(20);
    expect(calls).to.eq(0);
    wakeNow();
    await delay(20);
    expect(calls).to.eq(1);
    stop();
  });

  it('ignores wakes after stop()', async () => {
    let calls = 0;
    const stop = startRealtimePoller(() => {
      calls += 1;
    }, 10_000, () => 10_000);
    stop();
    wakeNow();
    await delay(20);
    expect(calls).to.eq(0);
  });
});
