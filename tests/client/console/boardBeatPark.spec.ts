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
  BOARD_BEAT_PARK_SAFETY_MS, BOARD_BEAT_SCALE_MS, BOARD_BEAT_SETTLE_MS,
  boardBeatDisplayClaims, boardBeatDisplayParams, boardBeatParkPending,
  boardBeatParkState, boardBeatParksReveal, boardBeatStoryPending, boardStoryHeldByPlayer, boardStoryWaitsUnderACover,
  changedGlobalParams, drainBoardBeatsIfDue,
  noteBoardBeatDrainGated, noteBoardScaleAdvance, registerBoardBeatLiveParams, registerBoardBeatRedrive, registerBoardBeatStoryMember,
  registerBoardCoverReasons, registerBoardWatchableProbe, releaseBoardBeatPark,
  resetBoardBeatPark,
} from '@/client/console/boardBeatPark';
import {
  presentationLedgerSnapshot, resetPresentationLedger, settlePresentationDue, STORY_TELLING_GRACE_MS,
} from '@/client/console/presentationLedger';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {claimWorkspaceOutcome, resetWorkspaceOutcome} from '@/client/console/consoleWorkspaceOutcome';
import {currentRevealEvent, drawnCardsState, DrawnCardEntry, registerRevealQueuePark} from '@/client/components/drawnCards/drawnCardsState';
import {HeldGlobalParams} from '@/client/console/planetFocus';
import {causeOf} from '@/common/diagnostics/cause';

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
    segments: [{source: {type: 'globalParameter', parameter: 'venus'}, count: 1}],
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
    resetPresentationLedger();
    drawnCardsState.events.splice(0);
    watchable = true;
    registerBoardWatchableProbe(() => watchable);
  });

  after(() => {
    // Bundle-shared module state: a leaked park (or probe, or a ledger
    // story's heartbeat) would decide a later spec's presentation.
    resetBoardBeatPark();
    resetPresentationLedger();
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

  it('a PARKED batch is not in the queue: the claimed sibling behind it presents, the park holds for the bonus', () => {
    // «Raise Venus + draw» in one press — the Redux Venus pays its Venus step
    // FIRST, so the parked 8 % batch is the OLDER one. The park used to yield
    // to the claimed sibling (oldest-first would wall it), which put the bonus
    // card fullscreen over the trade. Now the queue skips the parked batch.
    const restoreQueue = registerRevealQueuePark((batch) => boardBeatParksReveal(batch.source));
    watchable = false;
    claimWorkspaceOutcome('colonies', 'Venus Redux', ['draw']);
    drawnCardsState.events.push(venusEntry(80));
    drawnCardsState.events.push({
      ...venusEntry(81),
      source: {type: 'colony', colonyName: 'Venus Redux'},
      segments: [{source: {type: 'colony', colonyName: 'Venus Redux'}, count: 1}],
    } as DrawnCardEntry);
    const venus = {type: 'globalParameter', parameter: 'venus'} as const;
    expect(boardBeatParksReveal(venus as never), 'the park holds regardless of the sibling').to.equal(true);
    expect(currentRevealEvent()?.id, 'the own batch of the workspace presents first').to.equal(81);
    expect(boardBeatParkPending(), 'the parked batch is still owed to the drain').to.equal(true);
    // The sibling consumed, the board back → the parked batch is next in line.
    drawnCardsState.events[1].dismissed = true;
    expect(currentRevealEvent(), 'nothing presents while the board is covered').to.equal(undefined);
    watchable = true;
    expect(boardBeatParksReveal(venus as never), 'watchable and nothing held → released').to.equal(false);
    expect(currentRevealEvent()?.id).to.equal(80);
    resetWorkspaceOutcome();
    restoreQueue();
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

  it('a busy STORY MEMBER stretches the scale window by its OWN signal: the batch un-parks only after it (TR24)', async () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    drawnCardsState.events.push(venusEntry());
    const venus = {type: 'globalParameter', parameter: 'venus'} as const;
    let busy = true;
    let settle: () => void = () => {};
    const quiet = new Promise<void>((resolve) => {
      settle = () => {
        busy = false;
        resolve();
      };
    });
    const off = registerBoardBeatStoryMember('spec-member', {busy: () => busy, quiet: () => quiet});
    try {
      watchable = true;
      drainBoardBeatsIfDue();
      await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + consoleMotionMs(BOARD_BEAT_SCALE_MS) + 120);
      // The window has passed, but the scale step's tokens are still in the air.
      expect(boardBeatParkState.heldParams, 'the values went at the settle').to.equal(undefined);
      expect(boardBeatParkState.batchHeldByDrain, 'the cover waits for the last touchdown').to.equal(true);
      expect(boardBeatParkState.scaleStory, 'the blocking story window stretches with it').to.equal(true);
      expect(boardBeatParksReveal(venus as never)).to.equal(true);
      settle();
      await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 40);
      expect(boardBeatParkState.batchHeldByDrain).to.equal(false);
      expect(boardBeatParkState.draining).to.equal(false);
      expect(boardBeatParkState.scaleStory).to.equal(false);
    } finally {
      off();
    }
  });

  /** PL-146 (TR41): the scale window used to be ADDED on top of the members' story — 1.7 s of dead time before the cover on 4K. */
  it('a busy member\'s OWN signal is the whole window: the batch un-parks the moment it is quiet, before the scale beat would have', async () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    drawnCardsState.events.push(venusEntry());
    let busy = true;
    let settle: () => void = () => {};
    const quiet = new Promise<void>((resolve) => {
      settle = () => {
        busy = false;
        resolve();
      };
    });
    const off = registerBoardBeatStoryMember('spec-quick-member', {busy: () => busy, quiet: () => quiet});
    try {
      watchable = true;
      drainBoardBeatsIfDue();
      await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 40);
      expect(boardBeatParkState.heldParams, 'the values went at the settle').to.equal(undefined);
      expect(boardBeatParkState.batchHeldByDrain, 'the cover waits for the member').to.equal(true);
      settle();
      await delay(30);
      expect(boardBeatParkState.batchHeldByDrain, 'one BREATH after the touchdown — the counter\'s tick is read before the cover').to.equal(true);
      await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 40);
      expect(boardBeatParkState.batchHeldByDrain, 'quiet member + a settle beat → the cover arms, no scale window on top').to.equal(false);
      expect(boardBeatParkState.draining).to.equal(false);
      expect(boardBeatParkState.scaleStory).to.equal(false);
    } finally {
      off();
    }
  });

  it('a member that is NOT busy changes nothing — the window is exactly the scale beat', async () => {
    const off = registerBoardBeatStoryMember('spec-idle', {busy: () => false, quiet: () => new Promise<void>(() => {})});
    try {
      watchable = false;
      noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
      drawnCardsState.events.push(venusEntry());
      watchable = true;
      drainBoardBeatsIfDue();
      await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + consoleMotionMs(BOARD_BEAT_SCALE_MS) + 120);
      expect(boardBeatParkState.batchHeldByDrain).to.equal(false);
      expect(boardBeatParkState.draining).to.equal(false);
    } finally {
      off();
    }
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

  // ── the SCALE STORY (the one-owner merge of the old planet-focus beat) ──

  it('changedGlobalParams names exactly the moved held keys', () => {
    const live = {temperature: -18, oxygenLevel: 2, oceans: 2, venusScaleLevel: 8} as HeldGlobalParams;
    expect(changedGlobalParams({temperature: -20, oceans: 2}, live)).to.deep.equal(['temperature']);
    // No live source → every held key was seeded BY a change and counts.
    expect(changedGlobalParams({temperature: -20, oceans: 1}, undefined)).to.deep.equal(['temperature', 'oceans']);
    expect(changedGlobalParams({}, live)).to.deep.equal([]);
  });

  it('the drain plays the SCALE STORY: blocking window + the accent classes', async () => {
    const offLive = registerBoardBeatLiveParams(() => LIVE);
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    noteBoardScaleAdvance(gameWith({temperature: -30, venusScaleLevel: 8}), gameWith({temperature: -28, venusScaleLevel: 8}));

    watchable = true;
    drainBoardBeatsIfDue();
    // The blocking story window opens WITH the drain (a modal must not land
    // in the settle gap either).
    expect(boardBeatParkState.scaleStory).to.equal(true);
    expect(boardBeatStoryPending()).to.equal(true);

    await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 60);
    // Values released; the accent names exactly the scales that moved
    // held → live (venus 6→8 and temperature −30→−28 both moved).
    const html = document.documentElement.classList;
    expect(html.contains('con-scale-focus-venus')).to.equal(true);
    expect(html.contains('con-scale-focus-temperature')).to.equal(true);
    expect(html.contains('con-scale-focus-oxygen')).to.equal(false);
    expect(boardBeatParkState.scaleStory).to.equal(true);

    await delay(consoleMotionMs(BOARD_BEAT_SCALE_MS) + 60);
    expect(boardBeatParkState.scaleStory).to.equal(false);
    expect(html.contains('con-scale-focus-venus')).to.equal(false);
    expect(html.contains('con-scale-focus-temperature')).to.equal(false);
    expect(boardBeatStoryPending()).to.equal(false);
    offLive();
  });

  it('release without the show clears the story window and the accents', async () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    watchable = true;
    drainBoardBeatsIfDue();
    await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 60);
    expect(document.documentElement.classList.contains('con-scale-focus-venus')).to.equal(true);
    releaseBoardBeatPark();
    expect(boardBeatParkState.scaleStory).to.equal(false);
    expect(document.documentElement.classList.contains('con-scale-focus-venus')).to.equal(false);
  });

  // ── the presentation-ledger debt (mechanism B) ──

  it('a seed OWES a ledger story; the release settles it', () => {
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    expect(presentationLedgerSnapshot().stories.map((s) => s.id)).to.deep.equal(['board-beat-park']);
    releaseBoardBeatPark();
    expect(presentationLedgerSnapshot().stories).to.deep.equal([]);
  });

  it('the ledger heartbeat re-drives a missed watchable edge through the registered hook', () => {
    let redriven = 0;
    registerBoardBeatRedrive(() => redriven++);
    watchable = false;
    noteBoardScaleAdvance(gameWith({venusScaleLevel: 6}), gameWith({venusScaleLevel: 8}));
    // The edge everyone watches never fires (a same-flush cover/uncover) —
    // but the board IS watchable now, so one ledger pass re-drives.
    watchable = true;
    settlePresentationDue();
    expect(redriven).to.equal(1);
    // Not ready (covered again) → no redrive spam.
    watchable = false;
    settlePresentationDue();
    expect(redriven).to.equal(1);
  });

  /*
   * WHOSE WAIT A DEGRADE WAS — THE DRAIN IS THE WITNESS (the monkey under a reload, 2026-11-18: «the board was seen»
   * with a section and a workspace over it, filed as a defect, and nothing in the line to tell a board the player
   * CROSSED from a board that stood open while the drain never ran). The story's own diagnose says what the drain
   * did with every board it saw, and the tier is read from that.
   */
  const tierOfTheDegrade = (): {why: Record<string, unknown>, tier: string | undefined} => {
    const why = presentationLedgerSnapshot().stories.find((s) => s.id === 'board-beat-park')?.why ?? '{}';
    return {
      why: JSON.parse(why),
      tier: causeOf(`[presentation-ledger] story «board-beat-park» degraded after 30s — the release edge never came — ${why}`, 'warn')?.tier,
    };
  };

  it('a board the player CROSSED — seen, drained, covered again before the settle — is the player\'s wait, and says so', async () => {
    registerBoardCoverReasons(() => (watchable ? [] : ['section', 'workspace']));
    watchable = false;
    noteBoardScaleAdvance(gameWith({oceans: 0}), gameWith({oceans: 1}));
    settlePresentationDue();
    // The player crosses the board twice — each time for less than the drain's settle. The drain is opened once by
    // the ledger's own look (it sees the board and re-drives) and once by the shell's watchable edge (a direct call).
    const crossings = [() => settlePresentationDue(), () => drainBoardBeatsIfDue()];
    for (const open of crossings) {
      watchable = true;
      open();
      expect(boardBeatParkState.draining, 'the drain opened').to.equal(true);
      watchable = false;
      await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 60);
      expect(boardBeatParkState.draining, 'covered again: re-parked').to.equal(false);
    }
    const {why, tier} = tierOfTheDegrade();
    expect(why).to.deep.include({watchable: false, watchableSeen: true, drains: 2, coveredAgain: 2});
    // (ONE look saw the board — the ledger's; how many looks the window had in all is the heartbeat's own count.)
    expect(why.looks).to.match(/^1\/\d+$/);
    expect(why.coveredAgainBy).to.have.members(['section', 'workspace']);
    expect(boardBeatParkState.heldParams, 'still held: the story was never told').to.deep.equal({oceans: 0});
    expect(tier).to.equal('planned');
  });

  it('a board that stood open while no drain ran is a DEFECT — and a drain the game\'s own scene covered is one too', async () => {
    // The re-drive is refused by something of the shell's (here: a hook that does nothing) — the board was seen, no drain opened.
    registerBoardCoverReasons(() => (watchable ? [] : ['workspace']));
    registerBoardBeatRedrive(() => {});
    watchable = false;
    noteBoardScaleAdvance(gameWith({oceans: 0}), gameWith({oceans: 1}));
    watchable = true;
    settlePresentationDue();
    watchable = false;
    const stood = tierOfTheDegrade();
    expect(stood.why).to.deep.include({watchableSeen: true, looks: '1/1', drains: 0, coveredAgain: 0});
    expect(stood.tier).to.equal('defect');

    // …BUT A DRAIN THAT STOOD BEHIND ITS OWN GATE at every look that saw the board (the shell's guarded drain says by
    // what — the board's scene still settling) is a board the player CROSSED: the gate has its own bound and line.
    releaseBoardBeatPark();
    registerBoardBeatRedrive(() => noteBoardBeatDrainGated(['scene-settling']));
    noteBoardScaleAdvance(gameWith({oceans: 1}), gameWith({oceans: 2}));
    watchable = true;
    settlePresentationDue();
    watchable = false;
    const gated = tierOfTheDegrade();
    expect(gated.why).to.deep.include({watchableSeen: true, looks: '1/1', drains: 0, gated: 1, gatedBy: ['scene-settling']});
    expect(gated.tier).to.equal('planned');

    // …and a drain covered again by the GAME's scene (a sitting on its way up) is not the player's wait.
    releaseBoardBeatPark();
    registerBoardBeatRedrive(undefined as never);
    registerBoardCoverReasons(() => (watchable ? [] : ['workspace', 'sitting-rise']));
    noteBoardScaleAdvance(gameWith({oceans: 2}), gameWith({oceans: 3}));
    watchable = true;
    settlePresentationDue();
    watchable = false;
    await delay(consoleMotionMs(BOARD_BEAT_SETTLE_MS) + 60);
    const scene = tierOfTheDegrade();
    expect(scene.why).to.deep.include({drains: 1, coveredAgain: 1});
    expect(scene.tier).to.equal('defect');
  });

  /*
   * A DRAIN STANDING AT ITS OWN GATE WHEN THE DUE COMES IS ABOUT TO BE TOLD (the box's whole games in a real browser,
   * 2026-11-24 — game 143: «watchable: true, looks 8/112, drains 0, gated ×10 by scene-settling»): the player came back
   * to the board two seconds before the park's thirty ran out, a landing was still settling on it, and the due snapped
   * the three scales the drain was about to glide. The gate ends by itself — the story gets the telling's bounded
   * grace; a reveal standing for the player is no such gate, and a gate that outlives the grace is degraded and named.
   */
  it('a drain at its own gate over a board in view is not cut at the due — within the grace, and only behind a gate that ends by itself', () => {
    const realNow = Date.now;
    let t = realNow();
    Date.now = () => t;
    const warn = console.warn;
    const said: Array<string> = [];
    console.warn = (...args: Array<unknown>) => said.push(args.map(String).join(' '));
    try {
      registerBoardCoverReasons(() => (watchable ? [] : ['workspace']));
      let gate = ['scene-settling', 'settling:remote-placement'];
      registerBoardBeatRedrive(() => noteBoardBeatDrainGated(gate));
      const parkAndComeBackLate = (from: number) => {
        watchable = false;
        noteBoardScaleAdvance(gameWith({oceans: from}), gameWith({oceans: from + 1}));
        t += BOARD_BEAT_PARK_SAFETY_MS - 1_000;
        watchable = true;
        settlePresentationDue(); // the ledger's look: the board is in view, the guarded drain stands at its gate
        t += 1_200; // …and the due comes
        settlePresentationDue();
      };

      parkAndComeBackLate(0);
      expect(boardBeatParkState.heldParams, 'at its gate when the due came: not cut').to.deep.equal({oceans: 0});
      expect(said.filter((line) => line.includes('degraded after'))).to.deep.eq([]);
      // The grace is BOUNDED: a gate that never opens is a wedge — degraded, and the line names the scene behind it.
      t += STORY_TELLING_GRACE_MS;
      settlePresentationDue();
      expect(boardBeatParkState.heldParams, 'past the grace').to.equal(undefined);
      expect(said.filter((line) => line.includes('degraded after')).join('\n')).to.contain('settling:remote-placement');

      // A reveal standing for the player ends at no bound of the game's: no grace.
      said.length = 0;
      gate = ['reveal-open'];
      parkAndComeBackLate(1);
      expect(boardBeatParkState.heldParams, 'behind the player\'s own reveal: the honest degrade at the due').to.equal(undefined);
      expect(said.filter((line) => line.includes('degraded after'))).to.have.length(1);

      // …and a gate's word that is no longer «now» (the board was covered again) gives none either.
      said.length = 0;
      gate = ['scene-settling'];
      watchable = false;
      noteBoardScaleAdvance(gameWith({oceans: 2}), gameWith({oceans: 3}));
      t += BOARD_BEAT_PARK_SAFETY_MS - 1_000;
      watchable = true;
      settlePresentationDue();
      watchable = false;
      t += 1_200;
      settlePresentationDue();
      expect(boardBeatParkState.heldParams, 'covered again before the due').to.equal(undefined);
    } finally {
      Date.now = realNow;
      console.warn = warn;
    }
  });

  /*
   * WHO KEEPS THE SCALES FROM SPEAKING, for a wait's ceiling (`wait-graph/unshaped` — `quiet:city-payout:scales` under
   * a green `console-arabia-terra`, the whole suite on CI, 2026-11-22): the cities' answer waited fifteen seconds for
   * the scales' story while the player answered «on which card» in a workspace of their own — and the line had no
   * shape at all (its owner carries a colon).
   */
  /*
   * THREE WAITS IN A RING (`console-arabia-terra`, «printed DATA, two holders» — fifteen seconds of a frozen plate after
   * the player's answer, every run): the payout waits for the scales' story, the scales' drain waits for the rating,
   * the rating waits for a marker the decision's plate covers, and the plate leaves only with the payout.
   */
  describe('the scales\' story standing under a cover of its own end', () => {
    it('is said only while the drain runs AND a busy member names its end covered', () => {
      let busy = false;
      let covered = false;
      const off = registerBoardBeatStoryMember('spec-covered-member', {busy: () => busy, quiet: () => Promise.resolve(), endCovered: () => covered});
      try {
        expect(boardStoryWaitsUnderACover(), 'no drain').is.false;
        boardBeatParkState.draining = true;
        expect(boardStoryWaitsUnderACover(), 'a drain with no member waiting').is.false;
        busy = true;
        expect(boardStoryWaitsUnderACover(), 'a member busy on its own motion — the field is speaking').is.false;
        covered = true;
        expect(boardStoryWaitsUnderACover(), 'the member waits under a cover of its end').is.true;
        busy = false;
        expect(boardStoryWaitsUnderACover(), 'a member that is not waiting names nothing').is.false;
        busy = true;
        boardBeatParkState.draining = false;
        expect(boardStoryWaitsUnderACover(), 'the story is not being told').is.false;
      } finally {
        boardBeatParkState.draining = false;
        off();
      }
    });

    it('a member that says nothing about its end is never a cover\'s reason (the other members)', () => {
      const off = registerBoardBeatStoryMember('spec-plain-member', {busy: () => true, quiet: () => Promise.resolve()});
      try {
        boardBeatParkState.draining = true;
        expect(boardStoryWaitsUnderACover()).is.false;
      } finally {
        boardBeatParkState.draining = false;
        off();
      }
    });
  });

  describe('the board\'s story held by the player\'s own cover — a wait\'s ceiling says whose time it was', () => {
    it('a board covered only by what the PLAYER looks at is the player\'s; the game\'s own cover, or a board in view, is not', () => {
      registerBoardCoverReasons(() => []);
      expect(boardStoryHeldByPlayer(), 'the board is in view').is.undefined;
      registerBoardCoverReasons(() => ['workspace']);
      expect(boardStoryHeldByPlayer()).to.match(/^the player keeps the board covered by workspace — /);
      registerBoardCoverReasons(() => ['workspace', 'placement']);
      expect(boardStoryHeldByPlayer()).to.contain('workspace + placement');
      registerBoardCoverReasons(() => ['workspace', 'planet-focus']);
      expect(boardStoryHeldByPlayer(), 'the camera is the game\'s — a bound reached under it is a story that never ended').is.undefined;
      // …except while it serves a placement the player keeps live: the focus IS that placement's view.
      registerBoardCoverReasons(() => ['workspace', 'placement', 'planet-focus']);
      expect(boardStoryHeldByPlayer(), 'the camera of the player\'s own placement').to.contain('workspace + placement + planet-focus');
      // …and in for a placement the player has not come to, beside the screen that keeps them from it.
      registerBoardCoverReasons(() => ['section', 'workspace', 'placement-camera']);
      expect(boardStoryHeldByPlayer(), 'the camera of a placement that waits for the player').to.contain('placement-camera');
      registerBoardCoverReasons(() => ['placement-camera']);
      expect(boardStoryHeldByPlayer(), 'no screen of their own: the game holds that placement').is.undefined;
      registerBoardCoverReasons(() => ['sitting-rise']);
      expect(boardStoryHeldByPlayer()).is.undefined;
      registerBoardCoverReasons(undefined);
      expect(boardStoryHeldByPlayer(), 'no shell — nobody to ask').is.undefined;
    });

    it('the ceiling line of a quiet-wait whose owner carries a colon has its SHAPE — a defect bare, planned with the player\'s phrase', () => {
      const line = (planned: string) => '[wait-graph] ceiling quiet:city-payout:scales (city-payout:scales) — «the console quiet» did not come in 15000 ms — the wait ended on its ceiling' + planned;
      expect(causeOf(line(''), 'warn')).to.deep.include({cls: 'wait-graph/ceiling/quiet:city-payout:scales', tier: 'defect'});
      registerBoardCoverReasons(() => ['workspace']);
      const phrase = boardStoryHeldByPlayer();
      expect(phrase, 'no bracket of its own inside the reason').to.not.match(/[()]/);
      expect(causeOf(line(` (planned: ${phrase})`), 'warn')).to.deep.include({cls: 'wait-graph/ceiling/quiet:city-payout:scales', tier: 'planned'});
      // THE PARK's OWN DEGRADE reads the same rule (`console-start-held-placement` on CI: an oxygen step parked thirty
      // seconds behind the player's own placement and its camera — a defect by the old reading of «the camera»).
      const degrade = (coveredBy: string) => '[presentation-ledger] story «board-beat-park» degraded after 30s — the release edge never came — ' +
        `{"watchable":false,"watchableSeen":false,"looks":"0/118","drains":0,"coveredAgain":0,"coveredAgainBy":[],"gated":0,"gatedBy":[],"coveredBy":[${coveredBy}],"pending":true}`;
      expect(causeOf(degrade('"workspace","placement","planet-focus"'), 'warn')?.tier, 'the player in their placement the whole time').to.equal('planned');
      expect(causeOf(degrade('"workspace","planet-focus"'), 'warn')?.tier, 'the camera with no placement under it').to.equal('defect');
      expect(causeOf(degrade('"section","workspace","placement-camera"'), 'warn')?.tier, 'the camera in for a placement the player has not come to').to.equal('planned');
      expect(causeOf(degrade('"placement-camera"'), 'warn')?.tier, 'the same camera with no screen of their own over it').to.equal('defect');
      expect(causeOf(degrade('"planet-focus"'), 'warn')?.tier).to.equal('defect');
      expect(causeOf(degrade('"sitting-rise","placement"'), 'warn')?.tier, 'a sitting on its way up is the game\'s').to.equal('defect');
      // …and an owner WITH a detail still reads as before.
      expect(causeOf('[wait-graph] ceiling played-hero:target (playedHero: Red Lawyers) — «a measurable landing slot for the card» did not come in 1600 ms — the wait ended on its ceiling', 'warn'))
        .to.deep.include({cls: 'wait-graph/ceiling/played-hero:target', tier: 'defect'});
    });
  });
});
