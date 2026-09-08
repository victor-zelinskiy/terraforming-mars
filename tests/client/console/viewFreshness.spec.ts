/*
 * VIEW FRESHNESS (src/client/components/realtime/viewFreshness.ts) — the
 * local «is the applied view behind the server?» witness over the WS
 * invalidation cursor (presentation-reconciliation, mechanism A).
 */
import {expect} from 'chai';
import {serverAheadOfView, midPromptRefreshEnabled} from '@/client/components/realtime/viewFreshness';
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
