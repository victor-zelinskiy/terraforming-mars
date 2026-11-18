import {expect} from 'chai';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType} from '@/common/TileType';
import {abortRemotePlacements, remotePlacementState, stageRemotePlacements} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {resetTileMoveClaims} from '@/client/console/tilePlacement/tileMoveRecords';
import {clearRemoteRevealHolds, isRemoteRevealHeld} from '@/client/console/tilePlacement/remoteRevealHold';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/**
 * A LANDING WAITS FOR THE SURFACE THAT UNCOVERED THE BOARD TO BE GONE — the settle is a floor, the leave its event.
 *
 * CI #42 (run 44206354914, `console-parliament-marsfirst-budget` § PL-764, tv4k): the sitting stepped aside for the
 * bot's city, the landing's fixed 320 ms settle ran out while the Parliament was still dissolving on a starved 4K frame,
 * and the bot's proxy mounted 48 ms before `.con-parl` left the DOM — a tile flying under a leaving surface. A leaver
 * wears `data-motion-leaving` (`surfaceLeaveHook`) until it is removed; the landing now waits for none to stand.
 *
 * Driven on the KERNEL's manual clock: every wait of the queue (the probe tick, the board poll, the settle, the look at
 * a leaving surface) is an owned timer of that clock.
 */
function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

describe('a remote landing after the board is uncovered — it waits for the leaving surface, never under it', () => {
  let clock: ManualFlowClock;
  let leaver: HTMLElement | undefined;

  /** Walk the clock in small steps, letting the promise chains between the timers run. */
  async function advance(ms: number): Promise<void> {
    for (let t = 0; t < ms; t += 10) {
      clock.advance(10);
      for (let i = 0; i < 6; i++) {
        await Promise.resolve();
      }
    }
  }

  /** Stage blue's greenery on 12 under a covered board, then uncover it (the stack leaves — its surface starts its leave). */
  async function landAfterUncover(opts: {leaving: boolean}): Promise<void> {
    enterWorkspace('card-actions');
    stageRemotePlacements([space('12')], [space('12', {tileType: TileType.GREENERY, color: 'blue'})], {gamePhase: 'action'});
    await advance(200);
    expect(remotePlacementState.waitingForBoard, 'the landing parked for the covered board').is.true;
    if (opts.leaving) {
      leaver = document.createElement('section');
      leaver.className = 'con-ws';
      leaver.dataset.motionLeaving = '1';
      document.body.appendChild(leaver);
    }
    resetWorkspaceStack();
    await advance(200);
    expect(remotePlacementState.waitingForBoard, 'the board is uncovered — the wait for it is over').is.false;
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });

  afterEach(() => {
    leaver?.remove();
    leaver = undefined;
    resetWorkspaceStack();
    abortRemotePlacements();
    clearRemoteRevealHolds();
    resetTileMoveClaims();
    setFlowClock(undefined);
  });

  it('no leaver: the landing goes on its settle, as before', async () => {
    await landAfterUncover({leaving: false});
    await advance(600);
    expect(isRemoteRevealHeld('12'), 'landed (degraded: no stage) once the settle passed').is.false;
  });

  it('a leaver standing past the settle holds the landing — and it goes the moment the leaver is gone', async () => {
    await landAfterUncover({leaving: true});
    await advance(800);
    expect(isRemoteRevealHeld('12'), 'the settle is over, but the surface still dissolves over the board: no landing yet').is.true;
    leaver!.remove();
    await advance(150);
    expect(isRemoteRevealHeld('12'), 'the leaver is gone — the landing went').is.false;
  });

  it('a leave that never ends is bounded — the landing goes on the ceiling', async () => {
    await landAfterUncover({leaving: true});
    await advance(3000);
    expect(isRemoteRevealHeld('12'), 'a stuck leaver never holds a foreign tile for ever').is.false;
  });
});
