import {expect} from 'chai';
import {
  DEFERRED_REFRESH_CHECK_MS,
  armDeferredViewRefresh,
  deferredViewRefreshArmed,
  deferredViewRefreshStats,
  disarmDeferredViewRefresh,
  resetDeferredViewRefreshForTesting,
} from '../../src/client/components/deferredViewRefresh';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The poll path's «refused refresh is a DEBT» waiter. The defect it removes:
 * `App.update` dropped a polled view outright while a scene was animating, and
 * with a healthy WebSocket the next fallback poll was ~20 s away — measured
 * 21.4 s from «screen free» to «control back» after a turn-ending card play.
 */
describe('deferredViewRefresh', () => {
  beforeEach(() => resetDeferredViewRefreshForTesting());
  after(() => resetDeferredViewRefreshForTesting());

  it('fires the refresh on the RELEASE EDGE of the blocking predicate', async () => {
    let blocked = true;
    let fired = 0;
    armDeferredViewRefresh(() => blocked, () => fired++);
    expect(deferredViewRefreshArmed()).eq(true);
    await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
    expect(fired, 'must not fire while blocked').eq(0);
    blocked = false;
    await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
    expect(fired).eq(1);
    expect(deferredViewRefreshArmed(), 'one-shot — disarmed after firing').eq(false);
    expect(deferredViewRefreshStats.fired).eq(1);
  });

  it('the LATEST arm wins — a newer poll supersedes the parked closure', async () => {
    const runs: Array<string> = [];
    let blocked = true;
    armDeferredViewRefresh(() => blocked, () => runs.push('old'));
    armDeferredViewRefresh(() => blocked, () => runs.push('new'));
    blocked = false;
    await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
    expect(runs).deep.eq(['new']);
  });

  it('a NORMAL commit disarms the parked retry (the debt is paid by a fresher view)', async () => {
    let fired = 0;
    armDeferredViewRefresh(() => true, () => fired++);
    disarmDeferredViewRefresh();
    expect(deferredViewRefreshArmed()).eq(false);
    await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
    expect(fired).eq(0);
  });
});
