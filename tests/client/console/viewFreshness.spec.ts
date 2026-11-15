/*
 * VIEW FRESHNESS (src/client/components/realtime/viewFreshness.ts) — the
 * local «is the applied view behind the server?» witness over the WS
 * invalidation cursor (presentation-reconciliation, mechanism A).
 */
import {expect} from 'chai';
import {serverAheadOfView, midPromptRefreshEnabled, viewLagIsALie, viewLagOf} from '@/client/components/realtime/viewFreshness';
import {realtimeState} from '@/client/components/realtime/realtimeService';

describe('viewFreshness', () => {
  let savedAge: number | undefined;
  let savedUndo: number | undefined;

  beforeEach(() => {
    savedAge = realtimeState.lastInvalidationGameAge;
    savedUndo = realtimeState.lastInvalidationUndoCount;
  });

  afterEach(() => {
    realtimeState.lastInvalidationGameAge = savedAge;
    realtimeState.lastInvalidationUndoCount = savedUndo;
  });

  /*
   * A DEBT WITH AN OWNER IS NOT A LIE (FREEZE ZERO — the field corpus: `presentation-ledger/witness-heal/
   * view-freshness`, 51 lines in 14 of the owner's 47 exports). The witness healed a view that was behind because the
   * root had PARKED its refresh behind a live scene — an honest wait with an owner and a bound of its own.
   */
  it('viewLagIsALie — only a lag NOBODY holds: no request on the wire, no refresh parked', () => {
    expect(viewLagIsALie({ahead: true, requestInProgress: false, refreshParked: false}), 'a consumed wake, a dropped model').to.equal(true);
    expect(viewLagIsALie({ahead: true, requestInProgress: false, refreshParked: true}), 'parked behind a scene: the park re-runs it').to.equal(false);
    expect(viewLagIsALie({ahead: true, requestInProgress: true, refreshParked: false}), 'the answer is on its way').to.equal(false);
    expect(viewLagIsALie({ahead: false, requestInProgress: false, refreshParked: false})).to.equal(false);
  });

  it('viewLagOf — what the view is behind by, for the heal\'s line', () => {
    realtimeState.lastInvalidationGameAge = 8;
    realtimeState.lastInvalidationUndoCount = 1;
    expect(viewLagOf({gameAge: 5, undoCount: 1})).to.equal('age +3 (undo +0)');
    expect(viewLagOf(undefined)).to.equal('no view');
  });

  it('answers false with no invalidation cursor (WS off / fresh connection)', () => {
    realtimeState.lastInvalidationGameAge = undefined;
    realtimeState.lastInvalidationUndoCount = undefined;
    expect(serverAheadOfView({gameAge: 3, undoCount: 0})).to.equal(false);
    expect(serverAheadOfView(undefined)).to.equal(false);
  });

  it('answers true exactly when the advertised cursor is past the view', () => {
    realtimeState.lastInvalidationGameAge = 5;
    realtimeState.lastInvalidationUndoCount = 0;
    expect(serverAheadOfView({gameAge: 3, undoCount: 0})).to.equal(true);
    expect(serverAheadOfView({gameAge: 5, undoCount: 0})).to.equal(false);
    expect(serverAheadOfView({gameAge: 7, undoCount: 0})).to.equal(false);
    // The undo axis counts on its own.
    realtimeState.lastInvalidationUndoCount = 2;
    expect(serverAheadOfView({gameAge: 7, undoCount: 1})).to.equal(true);
    expect(serverAheadOfView({gameAge: 7, undoCount: 2})).to.equal(false);
  });

  it('mid-prompt refresh defaults ON', () => {
    // jsdom carries no `?midpromptrefresh` param and an opaque-origin
    // localStorage (reads throw and are swallowed) — the default must hold.
    expect(midPromptRefreshEnabled()).to.equal(true);
  });
});
