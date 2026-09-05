/*
 * BOARD BEAT PARK — the «полевой пакет ждёт видимую доску» module
 * (src/client/console/boardBeatPark.ts). Pins the four laws the venus-bonus
 * regression class rides on:
 *
 *  1. INERT WITHOUT A PROBE — no registered «watchable» verdict means the
 *     module changes nothing (desktop, tests, a torn-down shell).
 *  2. SEEDING — only while COVERED, first write wins per parameter (the drain
 *     glides from the value the player last SAW), claims snapshot alongside.
 *  3. THE PARK PREDICATE — scoped to the globalParameter batch it parks,
 *     holds while covered / while values are held / through the drain's
 *     glide half, and never touches any other source.
 *  4. THE DRAIN — settle → values release → the batch waits out the scale
 *     beat → un-parks; a board re-covered mid-settle re-parks everything.
 */
import {expect} from 'chai';
import {GameModel} from '@/common/models/GameModel';
import {Color} from '@/common/Color';
import {
  BOARD_BEAT_SCALE_MS, BOARD_BEAT_SETTLE_MS,
  boardBeatDisplayClaims, boardBeatDisplayParams, boardBeatParkPending,
  boardBeatParkState, boardBeatParksReveal, drainBoardBeatsIfDue,
  noteBoardScaleAdvance, registerBoardWatchableProbe, releaseBoardBeatPark,
  resetBoardBeatPark,
} from '@/client/console/boardBeatPark';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {claimWorkspaceOutcome, resetWorkspaceOutcome} from '@/client/console/consoleWorkspaceOutcome';
import {drawnCardsState, DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {HeldGlobalParams} from '@/client/console/planetFocus';

function gameWith(partial: Partial<GameModel>): GameModel {
  return {
    temperature: -30,
    oxygenLevel: 0,
    oceans: 0,
    venusScaleLevel: 6,
    scaleBonusClaims: {},
    ...partial,
  } as GameModel;
}

function venusEntry(id = 71): DrawnCardEntry {
  return {
    id,
    source: {type: 'globalParameter', parameter: 'venus'},
    cards: [{name: 'Ants'} as DrawnCardEntry['cards'][number]],
    takenIndices: new Set<number>(),
    acking: false,
    dismissed: false,
  } as DrawnCardEntry;
}

const LIVE: HeldGlobalParams = {temperature: -28, oxygenLevel: 1, oceans: 2, venusScaleLevel: 8};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('boardBeatPark', function() {
  // The drain tests walk the REAL settle + scale-beat windows (~2.2 s worst
  // case) — the module's timers are its contract, so nothing is faked here.
  // eslint-disable-next-line no-invalid-this
  this.timeout(10_000);

  let watchable = true;

  beforeEach(() => {
    resetBoardBeatPark();
    drawnCardsState.events.splice(0);
    watchable = true;
    registerBoardWatchableProbe(() => watchable);
  });

  after(() => {
    // Bundle-shared module state: a leaked park (or probe) would decide a
    // later spec's presentation.
    resetBoardBeatPark();
    drawnCardsState.events.splice(0);
  });

  it('is INERT without a registered probe', () => {
    resetBoardBeatPark(); // drops the probe too
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    expect(boardBeatParkState.heldParams).to.equal(undefined);
    expect(boardBeatParksReveal({type: 'globalParameter', parameter: 'venus'} as never)).to.equal(false);
    expect(boardBeatParkPending()).to.equal(false);
  });

  it('seeds NOTHING while the board is watchable', () => {
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    expect(boardBeatParkState.heldParams).to.equal(undefined);
    expect(boardBeatParkState.heldClaims).to.equal(undefined);
  });

  it('holds the PRE-CHANGE value while covered — first write wins per parameter', () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    // A second response moves the same dial again: the drain must glide from
    // the value the player last SAW (6), never from the intermediate 8.
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 8}), gameWith({venusScaleLevel: 10}));
    // …and an unrelated dial seeds beside it without touching the first.
    noteBoardScaleAdvance(gameWith({temperature: -28, venusScaleLevel: 10}),
      gameWith({temperature: -26, venusScaleLevel: 10}));
    expect(boardBeatParkState.heldParams).to.deep.equal({venusScaleLevel: 6, temperature: -28});
    expect(boardBeatParkPending()).to.equal(true);
  });

  it('snapshots the pre-change CLAIM map (the chip capture plays on release)', () => {
    watchable = false;
    noteBoardScaleAdvance(
      gameWith({venusScaleLevel: 6, scaleBonusClaims: {}}),
      gameWith({venusScaleLevel: 8, scaleBonusClaims: {'venus-8': 'red' as Color}}));
    expect(boardBeatParkState.heldClaims).to.deep.equal({});
    expect(boardBeatDisplayClaims({'venus-8': 'red' as Color})).to.deep.equal({});
  });

  it('merges held values OVER the base presenter and releases to live', () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    expect(boardBeatDisplayParams(LIVE)).to.deep.equal({...LIVE, venusScaleLevel: 6});
    releaseBoardBeatPark();
    expect(boardBeatDisplayParams(LIVE)).to.deep.equal(LIVE);
    expect(boardBeatDisplayClaims({'venus-8': 'red' as Color})).to.deep.equal({'venus-8': 'red' as Color});
  });

  it('parks ONLY the globalParameter batch, and only while something is owed', () => {
    const venus = {type: 'globalParameter', parameter: 'venus'} as const;
    // Covered → parked even with nothing held yet (a reload mid-park).
    watchable = false;
    expect(boardBeatParksReveal(venus as never)).to.equal(true);
    // Foreign shapes keep their own presenters, covered or not.
    expect(boardBeatParksReveal({type: 'tile'} as never)).to.equal(false);
    expect(boardBeatParksReveal({type: 'card', cardName: 'Ants'} as never)).to.equal(false);
    expect(boardBeatParksReveal(undefined)).to.equal(false);
    // Values held → still parked after the board opens (the glide goes first).
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    watchable = true;
    expect(boardBeatParksReveal(venus as never)).to.equal(true);
    // Released → un-parked.
    releaseBoardBeatPark();
    expect(boardBeatParksReveal(venus as never)).to.equal(false);
  });

  it('a CLAIMED SIBLING batch outranks the park — the bonus batch degrades to standalone', () => {
    // «Raise Venus + draw» in one press: the workspace's own claimed batch is
    // queued beside the bonus batch. Parked, the bonus would wall it behind
    // an event that only releases after the workspace concludes — while the
    // claim holds the workspace for exactly that batch. The park must yield.
    watchable = false;
    claimWorkspaceOutcome('card-actions', 'Ants', ['draw']);
    drawnCardsState.events.push({
      ...venusEntry(80),
      source: {type: 'card', cardName: 'Ants'},
    } as DrawnCardEntry);
    const venus = {type: 'globalParameter', parameter: 'venus'} as const;
    expect(boardBeatParksReveal(venus as never)).to.equal(false);
    // The sibling consumed → the park holds again for the bonus batch.
    drawnCardsState.events[0].dismissed = true;
    expect(boardBeatParksReveal(venus as never)).to.equal(true);
    resetWorkspaceOutcome();
  });

  it('DRAINS in causal order: settle → values release → the batch waits out the scale beat', async () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    drawnCardsState.events.push(venusEntry());
    const venus = {type: 'globalParameter', parameter: 'venus'} as const;

    watchable = true;
    drainBoardBeatsIfDue();
    expect(boardBeatParkState.draining).to.equal(true);
    // Mid-settle: nothing released yet.
    expect(boardBeatParkState.heldParams).to.not.equal(undefined);

    await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 60);
    // The glide half released; the batch still waits out the scale beat.
    expect(boardBeatParkState.heldParams).to.equal(undefined);
    expect(boardBeatParkState.batchHeldByDrain).to.equal(true);
    expect(boardBeatParksReveal(venus as never)).to.equal(true);

    await delay(consoleMotionMs(BOARD_BEAT_SCALE_MS) + 60);
    expect(boardBeatParkState.batchHeldByDrain).to.equal(false);
    expect(boardBeatParkState.draining).to.equal(false);
    expect(boardBeatParksReveal(venus as never)).to.equal(false);
  });

  it('re-parks when the board is covered again mid-settle', async () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    watchable = true;
    drainBoardBeatsIfDue();
    watchable = false; // a workspace re-opened before the settle elapsed
    await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 60);
    expect(boardBeatParkState.draining).to.equal(false);
    expect(boardBeatParkState.heldParams).to.deep.equal({venusScaleLevel: 6});
    // The next watchable edge runs the whole drain again.
    watchable = true;
    drainBoardBeatsIfDue();
    await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + consoleMotionMs(BOARD_BEAT_SCALE_MS) + 120);
    expect(boardBeatParkState.heldParams).to.equal(undefined);
    expect(boardBeatParkState.draining).to.equal(false);
  });

  it('a drain with NO batch still holds through the glide window only', async () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({temperature: -30}), gameWith({temperature: -28}));
    watchable = true;
    drainBoardBeatsIfDue();
    await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 60);
    expect(boardBeatParkState.heldParams).to.equal(undefined);
    expect(boardBeatParkState.draining).to.equal(true); // the glide window
    await delay(consoleMotionMs(BOARD_BEAT_SCALE_MS) + 60);
    expect(boardBeatParkState.draining).to.equal(false);
  });
});
