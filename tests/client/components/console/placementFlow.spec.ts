import {expect} from 'chai';
import {
  LOCK_COMMIT_DWELL_MS,
  __advancePlacementDwellForTest,
  __resetPlacementFlowForTest,
  beginPlacementCommit,
  enterPlacementFlow,
  lockPlacementCell,
  placementCommitReady,
  placementFlowState,
  placementPressAllowed,
  registerPlacementRearm,
  resetPlacementFlow,
  rollbackPlacementCommit,
  setPlacementTwoStep,
  unlockPlacementCell,
} from '@/client/console/tilePlacement/placementFlow';
import {dispatchConsoleIntent} from '@/client/console/consoleRouter';
import {SpaceId} from '@/common/Types';

/*
 * The two-phase placement confirm state machine (placementFlow.ts).
 *
 * The intent-bus edges are driven through the REAL dispatch
 * (`dispatchConsoleIntent`) — the module subscribes as a non-consuming
 * observer, exactly as in production, so «the press that locks is already
 * reflected in confirmDown when the shell asks» is tested, not assumed.
 */
describe('placementFlow', () => {
  const CELL = 'cell-05' as SpaceId;
  const OTHER = 'cell-11' as SpaceId;

  const pressConfirm = () => dispatchConsoleIntent({kind: 'press', button: 'confirm'});
  const releaseConfirm = () => dispatchConsoleIntent({kind: 'release', button: 'confirm'});

  beforeEach(() => {
    __resetPlacementFlowForTest();
    enterPlacementFlow();
  });

  afterEach(() => {
    __resetPlacementFlowForTest();
  });

  it('starts at navigate with nothing armed', () => {
    expect(placementFlowState.phase).to.equal('navigate');
    expect(placementFlowState.lockedSpaceId).to.be.undefined;
    expect(placementCommitReady()).to.be.false;
  });

  it('a pad lock requires the locking press to be RELEASED before commit', () => {
    pressConfirm(); // the physical press the shell will translate into a lock
    lockPlacementCell(CELL);
    expect(placementFlowState.phase).to.equal('locked');
    __advancePlacementDwellForTest(LOCK_COMMIT_DWELL_MS + 50);
    // Still held — the same physical press can never carry both phases.
    expect(placementCommitReady()).to.be.false;
    releaseConfirm();
    expect(placementCommitReady()).to.be.true;
  });

  it('a held button never satisfies the gate even across the dwell', () => {
    pressConfirm();
    lockPlacementCell(CELL);
    __advancePlacementDwellForTest(10 * LOCK_COMMIT_DWELL_MS);
    expect(placementCommitReady()).to.be.false;
  });

  it('a double-tap inside the dwell window does not commit', () => {
    pressConfirm();
    lockPlacementCell(CELL);
    releaseConfirm();
    // The second tap arrives almost immediately — released, but too soon.
    expect(placementCommitReady()).to.be.false;
    __advancePlacementDwellForTest(LOCK_COMMIT_DWELL_MS);
    expect(placementCommitReady()).to.be.true;
  });

  it('a mouse lock (no held button) is armed by the dwell alone', () => {
    lockPlacementCell(CELL); // no press on the bus — the mouse path
    expect(placementFlowState.armedRelease).to.be.true;
    expect(placementCommitReady()).to.be.false;
    __advancePlacementDwellForTest(LOCK_COMMIT_DWELL_MS);
    expect(placementCommitReady()).to.be.true;
  });

  it('unlock returns to navigation and disarms the gate', () => {
    lockPlacementCell(CELL);
    __advancePlacementDwellForTest(LOCK_COMMIT_DWELL_MS);
    unlockPlacementCell();
    expect(placementFlowState.phase).to.equal('navigate');
    expect(placementFlowState.lockedSpaceId).to.be.undefined;
    expect(placementCommitReady()).to.be.false;
  });

  it('re-locking another cell restarts the dwell', () => {
    lockPlacementCell(CELL);
    __advancePlacementDwellForTest(LOCK_COMMIT_DWELL_MS);
    expect(placementCommitReady()).to.be.true;
    lockPlacementCell(OTHER);
    expect(placementFlowState.lockedSpaceId).to.equal(OTHER);
    expect(placementCommitReady()).to.be.false;
  });

  it('the entry hold-gate refuses every press until the carried button is released', () => {
    __resetPlacementFlowForTest();
    pressConfirm(); // A is DOWN from the press that opened placement mode…
    enterPlacementFlow(); // …when the mode engages
    expect(placementPressAllowed()).to.be.false;
    releaseConfirm();
    expect(placementPressAllowed()).to.be.true;
  });

  it('no entry gate when the button was up at entry', () => {
    expect(placementPressAllowed()).to.be.true;
  });

  describe('committing', () => {
    it('beginPlacementCommit absorbs the phase; a later reset clears it', () => {
      lockPlacementCell(CELL);
      beginPlacementCommit(CELL);
      expect(placementFlowState.phase).to.equal('committing');
      resetPlacementFlow();
      expect(placementFlowState.phase).to.equal('navigate');
    });

    it('a refusal rolls back to LOCKED with the cell intact and re-arms the board', () => {
      let rearmed = 0;
      const unregister = registerPlacementRearm(() => rearmed++);
      lockPlacementCell(CELL);
      __advancePlacementDwellForTest(LOCK_COMMIT_DWELL_MS);
      beginPlacementCommit(CELL);
      rollbackPlacementCommit();
      expect(placementFlowState.phase).to.equal('locked');
      expect(placementFlowState.lockedSpaceId).to.equal(CELL);
      expect(rearmed).to.equal(1);
      // …and the commit gate re-arms from scratch: no instant re-commit.
      expect(placementCommitReady()).to.be.false;
      unregister();
    });

    it('rollback in single-press mode returns to navigation', () => {
      setPlacementTwoStep(false);
      beginPlacementCommit(CELL);
      rollbackPlacementCommit();
      expect(placementFlowState.phase).to.equal('navigate');
      expect(placementFlowState.lockedSpaceId).to.be.undefined;
      setPlacementTwoStep(true);
    });

    it('rollback outside the committing phase is a no-op', () => {
      lockPlacementCell(CELL);
      rollbackPlacementCommit();
      expect(placementFlowState.phase).to.equal('locked');
    });
  });

  describe('preference', () => {
    it('turning two-step OFF mid-lock folds the lock back to navigation', () => {
      lockPlacementCell(CELL);
      setPlacementTwoStep(false);
      expect(placementFlowState.phase).to.equal('navigate');
      setPlacementTwoStep(true);
    });
  });
});
