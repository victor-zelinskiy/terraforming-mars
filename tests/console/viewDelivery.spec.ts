import {expect} from 'chai';
import {
  VIEW_DELIVERY_BOUND_MS, ViewDebt, lookAtViewDebt, noteViewFetch, resetViewDelivery, viewDebtHolder, viewFetchOnWire,
} from '../../src/client/console/transport/viewDelivery';

/**
 * ASKED IS THE SERVER'S WORD (docs/claude/console/freeze-zero/PLAN.md §4 — `src/client/console/transport/viewDelivery.ts`).
 *
 * The arbiter read «the server asks» off the APPLIED view — so a view that never arrived (a commit that threw, a
 * scene flag that never released, a fetch that never came back) left a healthy screen waiting for «the other seat»
 * while the server waited for this player. The debt between the poll's word and the view is judged here.
 */
describe('viewDelivery — the server asks, the view does not know', () => {
  const debt = (over: Partial<ViewDebt> = {}): ViewDebt => ({since: 1_000, fetching: false, scenes: '', botRun: false, ...over});

  afterEach(() => resetViewDelivery());

  it('no debt: nothing is undelivered, nothing is in flight, nobody is named', () => {
    expect(lookAtViewDebt(debt({since: 0, fetching: true, scenes: 'played-hero', botRun: true}), 5_000))
      .to.deep.eq({undelivered: false, inFlight: '', holder: ''});
    expect(viewDebtHolder(debt({since: 0, fetching: true}))).to.eq('');
  });

  it('a debt NOBODY holds is never in flight — the arbiter\'s grace starts at once', () => {
    expect(lookAtViewDebt(debt(), 1_001)).to.deep.eq({undelivered: true, inFlight: '', holder: 'view:nobody'});
  });

  it('the holder is ONE word, by one precedence: the fetch, then the scenes, then the bot\'s run', () => {
    expect(viewDebtHolder(debt({fetching: true, scenes: 'tile-placement', botRun: true}))).to.eq('fetch');
    expect(viewDebtHolder(debt({scenes: 'tile-placement+played-hero', botRun: true}))).to.eq('scene:tile-placement+played-hero');
    expect(viewDebtHolder(debt({botRun: true}))).to.eq('bot-run');
    expect(viewDebtHolder(debt())).to.eq('');
  });

  it('a held debt is in flight — by name — only WITHIN its bound; past it the holder is an excuse no longer', () => {
    const held = debt({scenes: 'played-hero'});
    expect(lookAtViewDebt(held, 1_000 + VIEW_DELIVERY_BOUND_MS - 1))
      .to.deep.eq({undelivered: true, inFlight: 'view:scene:played-hero', holder: 'view:scene:played-hero'});
    // …one millisecond later it is a debt the arbiter judges — and the stall's line still names who held it.
    expect(lookAtViewDebt(held, 1_000 + VIEW_DELIVERY_BOUND_MS))
      .to.deep.eq({undelivered: true, inFlight: '', holder: 'view:scene:played-hero'});
  });

  it('every lawful holder ends below the bound (a scene\'s ceiling is 35 s, a fetch\'s timeout 15 s)', () => {
    expect(VIEW_DELIVERY_BOUND_MS).to.be.greaterThan(35_000);
  });

  it('the root\'s fetches are counted — two on the wire, one answered, is still one on the wire; a stray end never goes negative', () => {
    expect(viewFetchOnWire()).to.eq(false);
    noteViewFetch(true);
    noteViewFetch(true);
    noteViewFetch(false);
    expect(viewFetchOnWire()).to.eq(true);
    noteViewFetch(false);
    expect(viewFetchOnWire()).to.eq(false);
    noteViewFetch(false);
    noteViewFetch(true);
    expect(viewFetchOnWire()).to.eq(true);
  });
});
