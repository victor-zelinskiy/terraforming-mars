import {expect} from 'chai';
import {
  boardSceneSettling, concurrentResourcePayout, rewardPayoutSettling,
  waitBoardSceneQuiet, waitRewardPayoutQuiet,
} from '@/client/console/rewardPayoutQuiet';
import {
  boardSourcedTransferActive, resourceTransferState,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  abortTilePlacement, tilePlacementState,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {remotePlacementState} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {nomadMoveState} from '@/client/console/nomads/consoleNomadMove';
import {boardCardBonusState} from '@/client/console/boardCardBonus/consoleBoardCardBonus';

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The coordination seam of "a placement pays a card AND resources": the
 * card-bonus scene sequences its covering surfaces (the fullscreen open,
 * the multi fan into the reveal) on THESE answers, so the contract here is
 * what keeps a flying card from being destroyed under a parked reveal.
 */
describe('rewardPayoutQuiet (card ↔ resource payout coordination)', () => {
  afterEach(async () => {
    // Module state is bundle-shared — leave every term lowered.
    resourceTransferState.runActive = false;
    resourceTransferState.flights = [];
    abortTilePlacement();
    nomadMoveState.active = false;
    nomadMoveState.phase = 'idle';
    nomadMoveState.remoteActive = false;
    remotePlacementState.active = false;
    boardCardBonusState.active = false;
    await settle(5); // the tile abort lowers 'failed' → 'idle' on nextTick
  });

  it('quiet by default — nothing settling on an idle screen', () => {
    expect(rewardPayoutSettling()).to.be.false;
    expect(concurrentResourcePayout()).to.be.false;
  });

  it('chips in the air (or their absorb tails) are a settling payout', () => {
    resourceTransferState.runActive = true;
    expect(rewardPayoutSettling()).to.be.true;
    expect(concurrentResourcePayout()).to.be.true;
    resourceTransferState.runActive = false;
    // The absorb tail: the wave resolved but a chip is still dissolving.
    resourceTransferState.flights = [{id: 1, spec: {channel: 'stock', resource: 'steel', amount: 1}, fromBoard: false}];
    expect(rewardPayoutSettling()).to.be.true;
    resourceTransferState.flights = [];
    expect(rewardPayoutSettling()).to.be.false;
  });

  it('a tile hero mid-beat settles; only its REWARD half reads as concurrent', () => {
    tilePlacementState.active = true;
    tilePlacementState.phase = 'landed';
    // A plain landing (no rewards pending) owns the screen…
    expect(rewardPayoutSettling()).to.be.true;
    // …but is NOT a concurrent resource payout — a lone card cover must not
    // be slowed by a landing that pays nothing.
    expect(concurrentResourcePayout()).to.be.false;
    tilePlacementState.phase = 'rewarding';
    expect(concurrentResourcePayout()).to.be.true;
  });

  it('a nomad move mid-beat settles too', () => {
    nomadMoveState.active = true;
    nomadMoveState.phase = 'rewarding';
    expect(rewardPayoutSettling()).to.be.true;
  });

  it('waitRewardPayoutQuiet resolves at once on a quiet screen', async () => {
    const before = Date.now();
    await waitRewardPayoutQuiet();
    expect(Date.now() - before).to.be.lessThan(60);
  });

  it('waitRewardPayoutQuiet pends while settling and resolves when the payout clears', async () => {
    resourceTransferState.runActive = true;
    let resolved = false;
    const wait = waitRewardPayoutQuiet().then(() => {
      resolved = true;
    });
    // Longer than one probe-tick fallback — the wait genuinely held.
    await settle(80);
    expect(resolved).to.be.false;
    resourceTransferState.runActive = false;
    await wait;
    expect(resolved).to.be.true;
  });

  it('a dead caller is never held on a foreign payout (alive gate)', async () => {
    resourceTransferState.runActive = true;
    const before = Date.now();
    await waitRewardPayoutQuiet({alive: () => false});
    expect(Date.now() - before).to.be.lessThan(60);
  });

  it('the wait is BOUNDED — a stalled payout costs the cap, never the scene', async () => {
    resourceTransferState.runActive = true;
    const before = Date.now();
    await waitRewardPayoutQuiet({maxMs: 60});
    const elapsed = Date.now() - before;
    expect(elapsed).to.be.at.least(50);
    expect(elapsed).to.be.lessThan(400);
  });

  /**
   * The AUTOMATIC-transition gate: a workspace that opens with no press
   * behind it (the endgame auto-open, a yielded stack's return) waits out
   * the WHOLE board scene — own and remote alike — so it can never stand up
   * under a still-flying board animation.
   */
  describe('boardSceneSettling (the automatic-transition gate)', () => {
    it('quiet by default, and it includes the whole payout chain', () => {
      expect(boardSceneSettling()).to.be.false;
      resourceTransferState.runActive = true;
      expect(boardSceneSettling()).to.be.true;
    });

    it('a REMOTE tile landing settles the board scene', () => {
      remotePlacementState.active = true;
      expect(boardSceneSettling()).to.be.true;
      remotePlacementState.active = false;
      expect(boardSceneSettling()).to.be.false;
    });

    it('a REMOTE nomad hop settles the board scene', () => {
      nomadMoveState.remoteActive = true;
      expect(boardSceneSettling()).to.be.true;
    });

    it('the placed cell\'s card-bonus lift settles the board scene', () => {
      boardCardBonusState.active = true;
      expect(boardSceneSettling()).to.be.true;
    });

    it('a landed tile with rewards still OWED settles past the hero\'s own phases', () => {
      tilePlacementState.active = true;
      tilePlacementState.phase = 'rewarding';
      expect(boardSceneSettling()).to.be.true;
    });

    it('waitBoardSceneQuiet resolves at once on a quiet board', async () => {
      const before = Date.now();
      await waitBoardSceneQuiet();
      expect(Date.now() - before).to.be.lessThan(60);
    });

    it('waitBoardSceneQuiet pends on a remote scene and resolves when it clears', async () => {
      remotePlacementState.active = true;
      let resolved = false;
      const wait = waitBoardSceneQuiet().then(() => {
        resolved = true;
      });
      await settle(80);
      expect(resolved).to.be.false;
      remotePlacementState.active = false;
      await wait;
      expect(resolved).to.be.true;
    });

    it('a superseded transition is never held on a foreign scene (alive gate)', async () => {
      boardCardBonusState.active = true;
      const before = Date.now();
      await waitBoardSceneQuiet({alive: () => false});
      expect(Date.now() - before).to.be.lessThan(60);
    });
  });

  /**
   * The layer's demotion witness: `con-flight-to-board` rides ONLY a
   * board-sourced wave, so a workspace-sourced wave (a played card's
   * rewards) keeps flying over the panel whose story it is.
   */
  describe('boardSourcedTransferActive (the layer demotion witness)', () => {
    it('false for a workspace-sourced wave, true while a board chip is on stage', () => {
      resourceTransferState.flights = [{id: 1, spec: {channel: 'stock', resource: 'steel', amount: 1}, fromBoard: false}];
      expect(boardSourcedTransferActive()).to.be.false;
      resourceTransferState.flights = [
        ...resourceTransferState.flights,
        {id: 2, spec: {channel: 'stock', resource: 'plants', amount: 2}, fromBoard: true},
      ];
      expect(boardSourcedTransferActive()).to.be.true;
      resourceTransferState.flights = resourceTransferState.flights.filter((f) => f.id !== 2);
      expect(boardSourcedTransferActive()).to.be.false;
    });
  });
});
