import {expect} from 'chai';
import {
  __resetRealtimeSyncForTesting,
  getRealtimeSyncStats,
  notifyGameInvalidated,
  onRealtimeWake,
} from '../../src/client/components/realtime/realtimeSync';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('realtime/realtimeSync', () => {
  beforeEach(() => __resetRealtimeSyncForTesting());
  afterEach(() => __resetRealtimeSyncForTesting());

  it('coalesces a synchronous burst into a single pending wake', () => {
    for (let i = 0; i < 5; i++) {
      notifyGameInvalidated();
    }
    const stats = getRealtimeSyncStats();
    expect(stats.invalidationsSeen).to.eq(5);
    expect(stats.wakesCoalesced).to.eq(4); // 1 scheduled, 4 folded in
    expect(stats.wakesDelivered).to.eq(0); // timer still pending
  });

  it('delivers exactly one wake for a burst', async () => {
    let wakes = 0;
    const off = onRealtimeWake(() => {
      wakes += 1;
    });
    for (let i = 0; i < 5; i++) {
      notifyGameInvalidated();
    }
    await delay(140);
    off();
    expect(wakes).to.eq(1);
    expect(getRealtimeSyncStats().wakesDelivered).to.eq(1);
  });

  it('stops waking after the listener unsubscribes', async () => {
    let wakes = 0;
    const off = onRealtimeWake(() => {
      wakes += 1;
    });
    notifyGameInvalidated();
    await delay(140);
    expect(wakes).to.eq(1);

    off();
    notifyGameInvalidated();
    await delay(140);
    expect(wakes).to.eq(1); // no further wake once unsubscribed
  });

  it('delivers a separate wake for a later burst', async () => {
    let wakes = 0;
    const off = onRealtimeWake(() => {
      wakes += 1;
    });
    notifyGameInvalidated();
    await delay(500); // past the min wake interval
    notifyGameInvalidated();
    await delay(500);
    off();
    expect(wakes).to.eq(2);
  });

  it('reset clears a pending wake so it never fires', async () => {
    let wakes = 0;
    const off = onRealtimeWake(() => {
      wakes += 1;
    });
    notifyGameInvalidated();
    __resetRealtimeSyncForTesting();
    await delay(140);
    off();
    expect(wakes).to.eq(0);
  });
});
