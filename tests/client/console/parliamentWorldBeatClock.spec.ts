import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {
  enterWorldBeatSitting, resetParliamentWorldBeat, runWorldMoveBeat, seedWorldMoveBeat, WORLD_STORY_HARD_MAX_MS, WORLD_STORY_MAX_MS,
} from '@/client/console/parliament/parliamentWorldBeat';
import {enterWorkspace, resetWorkspaceStack, stackYieldedToBoard} from '@/client/console/consoleWorkspaceStack';
import {resetBoardBeatPark} from '@/client/console/boardBeatPark';
import {remotePlacementState} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * THE WORLD BEAT'S WAIT COUNTS FROM THE STORY'S PROGRESS, never from the yield (FLAKE ZERO Ф4, class N). The sitting
 * steps aside for the board's story and comes back when it is quiet — bounded. The bound used to run from the YIELD:
 * on a slow renderer a queue of landings (another seat's city of the law, PL-764) or the scales' drain outlasted it and
 * the sitting came back over the board mid-story. A story being TOLD (a landing on the remote stage, the park's drain)
 * restarts the budget; a story only OWED (a landing parked for a covered board) spends it; a hard ceiling ends one that
 * never ends.
 */
function world(step: string): ParliamentEnactOutcomeModel {
  return {step, part: 'world', kind: 'globalParameter', amount: -1, parameter: {id: 'oxygen', before: 5, after: 4}, unrewarded: true} as ParliamentEnactOutcomeModel;
}

function view(outcomes: Array<ParliamentEnactOutcomeModel>): PlayerViewModel {
  return {
    thisPlayer: {color: 'blue'},
    game: {parliament: {phase: {generation: 3, final: false, step: 'effects', outcomes, summary: {generation: 3, seq: 1, support: [], refreshed: [], lobbyRefilled: [], outcomes}}}},
  } as unknown as PlayerViewModel;
}

/** Let the promise chain of a resolved wait run (the beat's `finally` resumes the stack a few microtasks later). */
async function microtasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('parliamentWorldBeat — the story wait counts from the story\'s progress (FLAKE ZERO Ф4)', () => {
  let clock: ManualFlowClock;

  function reset(): void {
    remotePlacementState.active = false;
    remotePlacementState.waitingForBoard = false;
    remotePlacementState.queued = 0;
    resetParliamentWorldBeat();
    resetWorkspaceStack();
    resetBoardBeatPark();
  }

  beforeEach(() => {
    reset();
    clock = createManualClock(0);
    setFlowClock(clock);
    enterWorkspace('parliament');
    enterWorldBeatSitting('3:1');
    seedWorldMoveBeat(view([]), view([world('oxygen')]));
  });

  afterEach(async () => {
    // Every wait still standing runs out on the manual clock before the real one comes back.
    reset();
    await microtasks();
    clock.advance(WORLD_STORY_HARD_MAX_MS * 2);
    await microtasks();
    setFlowClock(undefined);
  });

  it('a landing STILL ON STAGE past the budget keeps the frame aside — it comes back on the story\'s own end', async () => {
    // Another seat's city is on the remote stage (the queue lands at the machine's pace).
    remotePlacementState.active = true;
    const run = runWorldMoveBeat('3:1');
    expect(stackYieldedToBoard(), 'the sitting stepped aside').is.true;
    clock.advance(WORLD_STORY_MAX_MS + 4000);
    await microtasks();
    expect(stackYieldedToBoard(), 'the story is still being told: the frame stays aside').is.true;
    // The landing ends → the story is quiet → the frame comes back.
    remotePlacementState.active = false;
    clock.advance(100);
    expect(await run).is.true;
    expect(stackYieldedToBoard(), 'back over a quiet board').is.false;
  });

  it('a story OWED but not told (a landing parked for a board the viewer keeps covered) spends the budget as before', async () => {
    remotePlacementState.waitingForBoard = true;
    remotePlacementState.queued = 1;
    const run = runWorldMoveBeat('3:1');
    clock.advance(WORLD_STORY_MAX_MS - 500);
    await microtasks();
    expect(stackYieldedToBoard(), 'within the budget').is.true;
    clock.advance(1000);
    expect(await run).is.true;
    expect(stackYieldedToBoard(), 'the budget ran out: the frame came back').is.false;
  });

  it('a story that never ends is bounded by the hard ceiling', async () => {
    remotePlacementState.active = true;
    const run = runWorldMoveBeat('3:1');
    clock.advance(WORLD_STORY_HARD_MAX_MS - 1000);
    await microtasks();
    expect(stackYieldedToBoard(), 'still told, still under the ceiling').is.true;
    clock.advance(2000);
    expect(await run).is.true;
    expect(stackYieldedToBoard(), 'the ceiling brought the frame back').is.false;
  });
});
