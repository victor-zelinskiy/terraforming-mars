import {expect} from 'chai';
import {
  DEFERRED_REFRESH_CHECK_MS,
  DEFERRED_REFRESH_MAX_MS,
  VIEW_SCENE_HOLD_MAX_MS,
  __ageDeferredViewRefreshForTesting,
  armDeferredViewRefresh,
  deferredViewRefreshArmed,
  deferredViewRefreshParked,
  deferredViewRefreshStats,
  disarmDeferredViewRefresh,
  noteViewCommitted,
  parkStep,
  resetDeferredViewRefreshForTesting,
  scenesHoldingView,
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

  it('a park SAYS WHAT HOLDS IT — the scenes its refuser named, for as long as it stands', async () => {
    let blocked = true;
    expect(deferredViewRefreshParked(), 'nothing parked').to.equal(undefined);
    armDeferredViewRefresh(() => blocked, () => undefined, () => 'played-hero+tile-placement');
    expect(deferredViewRefreshParked()?.why).to.equal('played-hero+tile-placement');
    // A park armed without the words still stands — and a supplier that throws never breaks the tick.
    armDeferredViewRefresh(() => blocked, () => undefined, () => {
      throw new Error('a scene module that is gone');
    });
    expect(deferredViewRefreshParked()?.why).to.equal('');
    blocked = false;
    await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
    expect(deferredViewRefreshParked(), 'released: no park, no words').to.equal(undefined);
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

  /*
   * A SCENE MAY HOLD THE VIEW ONLY WITHIN A SCENE'S OWN LEGAL LIFE (docs/claude/console/freeze-zero/PLAN.md §4).
   * The overdue refresh «fires anyway» — and its own guard parks it again behind the same flag: a flag that never
   * releases parked the view for ever. The debt has a bound now, and past it the flag is overruled.
   */
  describe('a scene may hold the view only within its own legal life', () => {
    it('the step, pure: the release edge · the bound of the debt · the window of the park', () => {
      const at = {now: 100_000, armedAt: 100_000, debtSince: 100_000};
      expect(parkStep({...at, blocked: false})).eq('release');
      expect(parkStep({...at, blocked: true})).eq('wait');
      expect(parkStep({...at, now: 100_000 + DEFERRED_REFRESH_MAX_MS, blocked: true}), 'AT the window is not past it').eq('wait');
      expect(parkStep({...at, now: 100_001 + DEFERRED_REFRESH_MAX_MS, blocked: true})).eq('overdue');
      // The debt is older than the park (an overdue re-run parked again): its bound comes first.
      expect(parkStep({now: 100_000 + VIEW_SCENE_HOLD_MAX_MS, armedAt: 130_100, debtSince: 100_000, blocked: true})).eq('overrule');
      expect(parkStep({now: 99_999 + VIEW_SCENE_HOLD_MAX_MS, armedAt: 130_100, debtSince: 100_000, blocked: true})).eq('wait');
      // …and a release is a release however old the debt.
      expect(parkStep({now: 900_000, armedAt: 100_000, debtSince: 100_000, blocked: false})).eq('release');
    });

    it('a flag that NEVER releases: an overdue re-run parks again under the SAME debt — and at the bound of that debt the view is committed over it', async () => {
      const warned: Array<string> = [];
      const warn = console.warn;
      console.warn = (...args: Array<unknown>) => {
        warned.push(String(args[0]));
      };
      try {
        const stuck = ['played-hero'];
        let refreshes = 0;
        const blocked = () => scenesHoldingView(stuck).length > 0;
        const refresh = () => {
          refreshes++;
          // The root's own guard: the re-run parks again while a scene still holds the view.
          if (blocked()) {
            armDeferredViewRefresh(blocked, refresh, () => scenesHoldingView(stuck).join('+'));
          }
        };
        armDeferredViewRefresh(blocked, refresh, () => scenesHoldingView(stuck).join('+'));
        // Past the park's window: «refreshing anyway» — and parked again, the debt still the first one's.
        __ageDeferredViewRefreshForTesting(DEFERRED_REFRESH_MAX_MS + 1);
        await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
        expect(refreshes).eq(1);
        expect(deferredViewRefreshArmed(), 'parked again behind the same flag').eq(true);
        expect(warned.filter((line) => line.includes('refreshing anyway — held by played-hero'))).to.have.length(1);
        // The debt reaches a scene's whole legal life: the flag is overruled — the re-run is not parked behind it.
        __ageDeferredViewRefreshForTesting(VIEW_SCENE_HOLD_MAX_MS - DEFERRED_REFRESH_MAX_MS);
        await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
        expect(refreshes, 'the view is committed over the stuck flag').eq(2);
        expect(deferredViewRefreshArmed(), 'and nothing is parked behind it any more').eq(false);
        expect(warned.filter((line) => line === `[deferred-refresh] «played-hero» held the view for over ${VIEW_SCENE_HOLD_MAX_MS}ms — the view is committed over it`)).to.have.length(1);
        expect(deferredViewRefreshStats.overruled).eq(1);
        // The flag still stands — and no longer holds the view: the next refresh commits at once.
        expect(scenesHoldingView(stuck)).deep.eq([]);
        // SEEN RELEASED, it is forgiven: its next raise is a new scene with a whole life of its own.
        expect(scenesHoldingView([])).deep.eq([]);
        expect(scenesHoldingView(stuck)).deep.eq(['played-hero']);
      } finally {
        console.warn = warn;
      }
    });

    it('only the scenes that held it are overruled — another scene holds the view as ever', async () => {
      const warn = console.warn;
      console.warn = () => {};
      try {
        const live = ['trade-fleet'];
        const blocked = () => scenesHoldingView(live).length > 0;
        armDeferredViewRefresh(blocked, () => undefined, () => scenesHoldingView(live).join('+'));
        __ageDeferredViewRefreshForTesting(VIEW_SCENE_HOLD_MAX_MS);
        await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
        expect(scenesHoldingView(['trade-fleet', 'tile-placement'])).deep.eq(['tile-placement']);
      } finally {
        console.warn = warn;
      }
    });

    it('a view committed by ANOTHER road (the answer of a submit) restarts the debt of a park still standing — a chain of scenes the player starts is never one debt', async () => {
      let fired = 0;
      const warn = console.warn;
      console.warn = () => {};
      try {
        armDeferredViewRefresh(() => true, () => fired++, () => 'tile-placement');
        __ageDeferredViewRefreshForTesting(VIEW_SCENE_HOLD_MAX_MS - 1_000);
        noteViewCommitted();
        // One second later the OLD debt would have been due; the park's own window (15 s, aged past) fires it instead.
        await tick(DEFERRED_REFRESH_CHECK_MS * 2.5);
        expect(fired, 'the window of the park still runs').eq(1);
        expect(deferredViewRefreshStats.overruled, 'but nobody was overruled').eq(0);
        expect(deferredViewRefreshStats.overdue).eq(1);
      } finally {
        console.warn = warn;
      }
    });
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
