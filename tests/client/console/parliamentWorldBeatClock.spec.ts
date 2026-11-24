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

  /*
   * WHOSE TIME THE CEILING WAS (FREEZE ZERO, the autopilot's game 3 — three humans, 2026-11-24): the frame stepped
   * aside for the story while the player stood in the Colonies they had opened over the Parliament; the board stayed
   * covered for as long as they chose, the wait ran to its ceiling by design — and was said as a defect. The cover's
   * witness reads it (the law the foreign tile's wait already keeps): the player's own workspace → planned; a board
   * in plain view for the story's whole budget → the story's own defect.
   */
  describe('the ceiling says whose time it was', () => {
    const lines: Array<string> = [];
    const realWarn = console.warn;
    beforeEach(() => {
      lines.splice(0);
      console.warn = (...args: Array<unknown>) => {
        lines.push(args.map(String).join(' '));
      };
    });
    afterEach(() => {
      console.warn = realWarn;
    });
    const ceilingLine = () => lines.find((line) => line.includes('ceiling parliament-world:story-quiet'));

    it('the player keeps the board covered by a workspace of their own: planned — the sitting goes on', async () => {
      remotePlacementState.waitingForBoard = true;
      remotePlacementState.queued = 1;
      const run = runWorldMoveBeat('3:1');
      await microtasks();
      // The player opens the Colonies over the Parliament that stepped aside.
      enterWorkspace('colonies');
      clock.advance(WORLD_STORY_MAX_MS + 500);
      expect(await run).is.true;
      expect(ceilingLine(), 'the ceiling is said').is.not.undefined;
      expect(ceilingLine()).to.contain('(planned: the viewer kept the board covered by workspace — the sitting goes on without the board');
    });

    it('a board in plain view for the whole budget and a story that did not fall quiet: a defect, said with what stood', async () => {
      remotePlacementState.active = true;
      const run = runWorldMoveBeat('3:1');
      clock.advance(WORLD_STORY_HARD_MAX_MS + 1000);
      expect(await run).is.true;
      expect(ceilingLine(), 'the ceiling is said').is.not.undefined;
      expect(ceilingLine()).to.not.contain('planned');
      expect(ceilingLine()).to.contain('in plain view for');
    });
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
