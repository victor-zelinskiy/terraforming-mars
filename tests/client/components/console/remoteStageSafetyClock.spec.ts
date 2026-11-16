import {expect} from 'chai';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {
  abortRemotePlacements, REMOTE_STAGE_SAFETY_MS, remotePlacementState, stageRemotePlacements,
} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {clearRemoteRevealHolds, isRemoteRevealHeld} from '@/client/console/tilePlacement/remoteRevealHold';
import {cubePhase, HERO_CUBE_HOLD_SAFETY_MS} from '@/client/components/board/cubeDropState';
import {registerBoardGeometryProbe} from '@/client/console/boardSpaceGeometry';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * THE REMOTE STAGE'S SAFETY BOUNDS ONE LANDING, and a held cube waits for ITS landing (FLAKE ZERO Ф4, class N).
 *
 * A queue of another seat's tiles lands in turn, each at the machine's pace. The stage's 15 s safety used to be armed
 * at the STAGING only: on a slow renderer three landings outlasted it, and the abort revealed the rest at once,
 * mid-flight. And a cube held at the staging dropped on its own 10 s clock onto a cell whose tile was still held — a
 * cube standing on an empty hex before its city flew in. Here every landing waits on an UNSTABLE board geometry (the
 * stage's own bounded wait — a slow landing) and the spec lets them through one at a time on the kernel's clock.
 */
function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

async function microtasks(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

/** Advance the kernel's clock in frames, letting each landing's promise chain run between them. */
async function advance(clock: ManualFlowClock, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 50) {
    clock.advance(Math.min(50, ms - t));
    await microtasks();
  }
}

describe('the remote stage — its safety bounds ONE landing; a held cube waits for its landing (FLAKE ZERO Ф4)', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);
  let clock: ManualFlowClock;
  let passes = 0;
  let unregister: () => void = () => {};

  beforeEach(() => {
    resetWorkspaceStack();
    clock = createManualClock(0);
    setFlowClock(clock);
    passes = 0;
    // The board's geometry settles ONCE per pass the spec hands out: each landing waits for one.
    unregister = registerBoardGeometryProbe(() => {
      if (passes > 0) {
        passes--;
        return true;
      }
      return false;
    });
  });

  afterEach(async () => {
    unregister();
    abortRemotePlacements();
    clearRemoteRevealHolds();
    await microtasks();
    clock.advance(60_000);
    await microtasks();
    setFlowClock(undefined);
  });

  it('three slow landings outlast the stage\'s safety TOGETHER, never one by one: nothing is aborted, every cube waits', async () => {
    const ids = ['21', '22', '23'] as Array<SpaceId>;
    stageRemotePlacements(ids.map((id) => space(id)), ids.map((id) => space(id, {tileType: TileType.CITY, color: 'red'})), {gamePhase: 'action'});
    expect(remotePlacementState.queued, 'three landings queued').eq(3);

    // The first landing takes 10 s (its board never settles until the spec says so).
    await advance(clock, 10_000);
    expect(remotePlacementState.queued).eq(3);
    passes = 1;
    await advance(clock, 200);
    expect(remotePlacementState.queued, 'the first landing is done').eq(2);

    // The second one takes long too — the queue is now past the safety counted from the staging.
    await advance(clock, REMOTE_STAGE_SAFETY_MS - 10_000 + 4000);
    expect(remotePlacementState.queued, 'the stage was not aborted: the safety bounds ONE landing').eq(2);
    const owed = ids.filter((id) => isRemoteRevealHeld(id));
    expect(owed, 'the tiles still owed are still held — nothing revealed at once').has.length(2);
    expect(owed.map((id) => cubePhase(id)), `past ${HERO_CUBE_HOLD_SAFETY_MS} ms the cubes of the owed landings stay hidden`).deep.eq(['hidden', 'hidden']);

    // The board settles: the rest land, each cube with its tile.
    passes = 100;
    await advance(clock, 2000);
    expect(remotePlacementState.queued, 'the queue landed').eq(0);
    expect(ids.every((id) => !isRemoteRevealHeld(id))).is.true;
    expect(ids.map((id) => cubePhase(id))).deep.eq(['rest', 'rest', 'rest']);
  });

  it('a landing that NEVER ends is still bounded: the safety aborts it, every tile and cube shown', async () => {
    const ids = ['31', '32'] as Array<SpaceId>;
    stageRemotePlacements(ids.map((id) => space(id)), ids.map((id) => space(id, {tileType: TileType.CITY, color: 'red'})), {gamePhase: 'action'});
    await advance(clock, REMOTE_STAGE_SAFETY_MS + 500);
    expect(remotePlacementState.queued, 'aborted').eq(0);
    expect(ids.every((id) => !isRemoteRevealHeld(id))).is.true;
    expect(ids.map((id) => cubePhase(id))).deep.eq(['rest', 'rest']);
  });
});
