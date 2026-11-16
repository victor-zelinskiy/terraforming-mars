import {expect} from 'chai';
import {GameModel} from '@/common/models/GameModel';
import {
  BOARD_BEAT_MEMBER_WAIT_MAX_MS, BOARD_BEAT_MEMBERS_HARD_MAX_MS, BOARD_BEAT_PARK_SAFETY_MS, BOARD_BEAT_SETTLE_MS, BoardBeatStoryMember,
  boardBeatParkState, drainBoardBeatsIfDue, noteBoardScaleAdvance, registerBoardBeatStoryMember, registerBoardWatchableProbe,
  resetBoardBeatPark,
} from '@/client/console/boardBeatPark';
import {presentationLedgerSnapshot, resetPresentationLedger, settlePresentationDue} from '@/client/console/presentationLedger';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {drawnCardsState, DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * THE DRAIN WAITS FOR ITS MEMBERS FROM THEIR LAST PROGRESS (FLAKE ZERO Ф4, class N). What a released scale step PAID is
 * told by the park's story members IN TURN (the rating's tokens, then the step's reward, then the Venus bonus cell —
 * each waits for the one before) at the machine's pace. The net over them ran ONE budget from the scale window's end
 * (and halved with a faster motion setting): on a slow renderer the chain outlasted it, the parked Venus card's cover
 * rose and the blocking story let go over tokens still in the air. Each member that goes quiet re-arms the net; a
 * chain that stops progressing lets go a budget after its last quiet; a hard ceiling bounds the whole story.
 */
function gameWith(partial: Partial<GameModel>): GameModel {
  return {temperature: -30, oxygenLevel: 0, oceans: 0, venusScaleLevel: 6, scaleBonusClaims: {}, ...partial} as GameModel;
}

function venusEntry(): DrawnCardEntry {
  return {
    id: 91,
    source: {type: 'globalParameter', parameter: 'venus'},
    segments: [{source: {type: 'globalParameter', parameter: 'venus'}, count: 1}],
    cards: [{name: 'Ants'} as DrawnCardEntry['cards'][number]],
    takenIndices: new Set<number>(),
    acking: false,
    dismissed: false,
  } as DrawnCardEntry;
}

/** A member busy until the spec says it is quiet. */
function member(): BoardBeatStoryMember & {settle: () => void} {
  let busy = true;
  let resolve: () => void = () => {};
  const quiet = new Promise<void>((r) => {
    resolve = r;
  });
  return {busy: () => busy, quiet: () => quiet, settle: () => {
    busy = false;
    resolve();
  }};
}

async function microtasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('boardBeatPark — the members\' net counts from their last progress (FLAKE ZERO Ф4)', () => {
  let clock: ManualFlowClock;
  let watchable = true;
  const offs: Array<() => void> = [];
  const settleMs = consoleMotionMs(BOARD_BEAT_SETTLE_MS);

  beforeEach(() => {
    resetBoardBeatPark();
    resetPresentationLedger();
    drawnCardsState.events.splice(0);
    clock = createManualClock(0);
    setFlowClock(clock);
    watchable = true;
    registerBoardWatchableProbe(() => watchable);
  });

  afterEach(async () => {
    offs.splice(0).forEach((off) => off());
    resetBoardBeatPark();
    resetPresentationLedger();
    drawnCardsState.events.splice(0);
    await microtasks();
    clock.advance(60_000);
    setFlowClock(undefined);
  });

  /** Park a Venus step with its 8 % card under a covered board, register the members, uncover and drain. */
  async function drainWith(members: ReadonlyArray<BoardBeatStoryMember>): Promise<void> {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    drawnCardsState.events.push(venusEntry());
    members.forEach((m, i) => offs.push(registerBoardBeatStoryMember(`spec-chain-${i}`, m)));
    watchable = true;
    drainBoardBeatsIfDue();
    clock.advance(settleMs);
    await microtasks();
    expect(boardBeatParkState.heldParams, 'the values went at the settle').to.equal(undefined);
    expect(boardBeatParkState.batchHeldByDrain, 'the cover waits for the members').to.equal(true);
  }

  it('a CHAIN of members that keeps progressing holds the cover past one budget — and lets it go on its own end', async () => {
    const rating = member();
    const reward = member();
    await drainWith([rating, reward]);
    // The rating's tokens land late (a slow renderer), then the reward's — each within a budget of the one before.
    clock.advance(BOARD_BEAT_MEMBER_WAIT_MAX_MS - 1000);
    rating.settle();
    await microtasks();
    clock.advance(3000);
    await microtasks();
    expect(boardBeatParkState.batchHeldByDrain, 'past one budget from the window, the chain is still telling: held').to.equal(true);
    expect(boardBeatParkState.scaleStory, 'the blocking story stands with it').to.equal(true);
    clock.advance(BOARD_BEAT_MEMBER_WAIT_MAX_MS - 4000);
    reward.settle();
    await microtasks();
    clock.advance(settleMs + 10);
    await microtasks();
    expect(boardBeatParkState.batchHeldByDrain, 'the last member quiet + one breath: the cover arms').to.equal(false);
    expect(boardBeatParkState.draining).to.equal(false);
  });

  it('a chain that STOPS progressing lets go one budget after its last quiet', async () => {
    const rating = member();
    const stuck = member();
    await drainWith([rating, stuck]);
    clock.advance(2000);
    rating.settle();
    await microtasks();
    clock.advance(BOARD_BEAT_MEMBER_WAIT_MAX_MS - 100);
    await microtasks();
    expect(boardBeatParkState.batchHeldByDrain, 'within a budget of the last progress').to.equal(true);
    clock.advance(100 + settleMs + 10);
    await microtasks();
    expect(boardBeatParkState.batchHeldByDrain, 'the net let it go').to.equal(false);
  });

  it('the whole members\' story is bounded by the hard ceiling', async () => {
    const chain = [member(), member(), member()];
    await drainWith(chain);
    // Two members go quiet just inside a budget of the previous one — the last one never does.
    const step = BOARD_BEAT_MEMBER_WAIT_MAX_MS - 1000;
    clock.advance(step);
    chain[0].settle();
    await microtasks();
    clock.advance(step);
    chain[1].settle();
    await microtasks();
    // A budget past the last quiet would end at 2 × 7 + 8 = 22 s; the ceiling (20 s) comes first.
    expect(2 * step + BOARD_BEAT_MEMBER_WAIT_MAX_MS).to.be.greaterThan(BOARD_BEAT_MEMBERS_HARD_MAX_MS);
    clock.advance(BOARD_BEAT_MEMBERS_HARD_MAX_MS - 2 * step - 500);
    await microtasks();
    expect(boardBeatParkState.batchHeldByDrain, 'under the ceiling: held').to.equal(true);
    clock.advance(500 + settleMs + 10);
    await microtasks();
    expect(boardBeatParkState.batchHeldByDrain, 'the hard ceiling let the cover go').to.equal(false);
  });

  /*
   * …AND THE PARK'S WHOLE-LIFE BOUND IS THE STORY'S FROM ITS RELEASE. The park's ledger story is due 30 s after the SEED
   * (a board the player keeps covered must not withhold the card forever) — and its degrade used to cut a story that
   * was already being told: a board covered for 28 s (a sitting walking to its world trip on a slow renderer) released
   * its scales, and two seconds later the degrade let the cover rise over the step's tokens in the air.
   */
  describe('the park\'s whole-life bound counts from the release once the story is told', () => {
    const realNow = Date.now;
    let wall = 1_000_000;

    beforeEach(() => {
      wall = 1_000_000;
      // The ledger keeps its ages on the wall clock — the spec walks it by hand.
      Date.now = () => wall;
    });
    afterEach(() => {
      Date.now = realNow;
    });

    it('a story released just before the seed\'s due is not cut by it', async () => {
      const rating = member();
      watchable = false;
      noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
      drawnCardsState.events.push(venusEntry());
      offs.push(registerBoardBeatStoryMember('spec-told', rating));
      // The board stays covered for most of the park's bound.
      wall += BOARD_BEAT_PARK_SAFETY_MS - 2000;
      settlePresentationDue();
      expect(boardBeatParkState.heldParams, 'still parked, still owed').to.not.equal(undefined);
      watchable = true;
      drainBoardBeatsIfDue();
      clock.advance(settleMs);
      await microtasks();
      expect(boardBeatParkState.heldParams, 'released: the story is being told').to.equal(undefined);
      // Past the seed's due, the story's tokens still in the air.
      wall += 5000;
      settlePresentationDue();
      expect(boardBeatParkState.draining, 'the story is not cut by a bound counted from the seed').to.equal(true);
      expect(boardBeatParkState.batchHeldByDrain, 'the cover still waits for the tokens').to.equal(true);
      rating.settle();
      await microtasks();
      clock.advance(settleMs + 10);
      await microtasks();
      expect(boardBeatParkState.batchHeldByDrain, 'it ends on its own signal').to.equal(false);
      expect(presentationLedgerSnapshot().stories.map((s) => s.id), 'nothing left owed').not.includes('board-beat-park');
    });
  });
});
