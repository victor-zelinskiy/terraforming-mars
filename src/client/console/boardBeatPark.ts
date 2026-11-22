/*
 * BOARD BEAT PARK — «полевой пакет» ждёт доску, которую игрок ВИДИТ.
 *
 * A server response that lands while the player stands inside a workspace
 * routinely carries BOARD-BORN presentation alongside the workspace's own
 * outcome: a global-parameter scale moved, a scale-threshold bonus was
 * claimed (the Venus 8% chip), and — for the Venus 8% crossing — a card was
 * drawn whose ONLY honest presentation is the cover lifting off the scale's
 * own marker. All three presenters are plain reactive consumers, so before
 * this module they fired IMMEDIATELY:
 *
 *  · the scale marker SNAPped behind `display: none` (unseen, correct per its
 *    own invariant — but the story was gone by the time the player returned);
 *  · the claim chip's capture flash played invisible;
 *  · the cover-lift scene armed against a hidden board, measured a 0×0
 *    anchor, aborted — and the fullscreen viewer then opened `mandatory` OVER
 *    the open workspace with a textual entrance, while the batch's presence
 *    wedged the workspace-outcome witnesses («workspace завис пустой»).
 *
 * THE LAW (the same one the auto tile landing already states): a board beat
 * WAITS for a board the player can see. While the board is covered, this
 * module
 *
 *  1. HOLDS THE PRESENTED VALUES of the changed global parameters (and the
 *     scale-bonus claim map) — the board section and the status strip read
 *     through `boardBeatDisplayParams` / `boardBeatDisplayClaims` (since the
 *     one-owner merge this module is the ONLY presenter of the law: an
 *     engaged Planet Focus counts as a covered board through the shell's
 *     watchable probe, so mid-focus commits seed here too);
 *  2. PARKS the batch a `globalParameter` source produced: it presents
 *     NOWHERE (`rawDrawnRevealPending` subtracts it — the colony-bonus park's
 *     own pattern), it does not silence the feed (the shell's reveal-park
 *     supplier includes this verdict), and no scene arms for it;
 *  3. DRAINS on the «board watchable» rising edge, in causal order: settle →
 *     the held values release (the marker glides, the fill advances, the chip
 *     plays its capture) → the scale beat runs its window → what the step
 *     PAID is told (the STORY MEMBERS — Turmoil Redux TR24 Venusian Census:
 *     the tokens born at the marker once it has arrived; the window stretches
 *     by the wave's own landing signal, never by a number) → the batch
 *     un-parks, and the cover-lift scene self-arms against a board it can
 *     actually measure.
 *
 * EVERY HOLD IS BOUNDED AND NAMES ITSELF: the park's safety releases
 * everything after `PARK_SAFETY_MS` (degrade = the pre-park behaviour — a
 * snap and a standalone reveal; a hidden card is a worse lie than a missed
 * animation), and the drain itself registers a notification-only animation
 * hold for exactly its own window.
 *
 * The «watchable» verdict is INJECTED by the shell (section, stack, overlays
 * — console domain this module must not import). No probe registered → the
 * board is treated as watchable and every read degrades to the historical
 * behaviour (desktop, tests, a torn-down shell).
 */

import {reactive, shallowRef} from 'vue';
import {consoleSessionScope, sessionState} from '@/client/console/session/consoleSession';
import {deriveFlowRun} from '@/client/console/session/flowRun';
import {reactivePredicate} from '@/client/components/presentation/reactivityWitness';
import {Color} from '@/common/Color';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {GameModel} from '@/common/models/GameModel';
import {boardCoversAreThePlayers} from '@/common/diagnostics/shapes';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {motionCeilingMs} from '@/client/components/motion/motionTokens';
import {flowClock} from '@/client/console/kernel/flowClock';
import {HeldGlobalParams, planetFocusState} from '@/client/console/planetFocus';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';

/** The leaving surface settles before the story starts (the auto-landing's
 *  own `BOARD_SETTLE_MS` beat — the board must not still be condensing). */
export const BOARD_BEAT_SETTLE_MS = 360;
/** The scale story's window: marker glide (≤1280) + the capture flash tail.
 *  The parked batch waits it out so the cover lifts off a marker that has
 *  already ARRIVED at its new step. */
export const BOARD_BEAT_SCALE_MS = 1250;
/** The park's whole-life ceiling. A board that never becomes watchable (a
 *  workspace that genuinely cannot conclude) must not withhold a drawn card
 *  forever — past this the park releases honestly, without the show. */
export const BOARD_BEAT_PARK_SAFETY_MS = 30_000;

export const boardBeatParkState = reactive({
  /** The PRESENTED (pre-change) values of the parameters that moved while
   *  the board was covered. First write wins per parameter — several
   *  responses may land during one workspace flow, and the drain must glide
   *  from the value the player last SAW. `undefined` = nothing held. */
  heldParams: undefined as Partial<HeldGlobalParams> | undefined,
  /** The PRESENTED (pre-change) scale-bonus claim map, held so the chip's
   *  one-shot capture flash plays on the release, in front of the player. */
  heldClaims: undefined as Record<string, Color> | undefined,
  /** The drain sequence owns the board (settle → glide → batch release). */
  draining: false,
  /** The glide half has released but the batch still waits out the scale
   *  beat — the cover must lift off a marker that has finished moving. */
  batchHeldByDrain: false,
  /**
   * The SCALE STORY window: from the drain's start (when values are held)
   * until the glide window closes. A BLOCKING hold — follow-up prompts,
   * announcements and notifications wait for the scales to finish their
   * story (the contract Planet Focus's own beat used to carry). Bounded by
   * the drain's own timers (settle + glide ≈ 1.6 s).
   */
  scaleStory: false,
  /** Bumped per drain — lets a spec (or a future scene) key on the run. */
  nonce: 0,
  /**
   * A SCENE OWNS THE HELD VALUES (TR70 «Марс терраформирован» — `terraformedScene.ts`): the last step of the
   * scales is held on an uncovered board too, until the scene's stage stands (the interface receded, the
   * planet in focus) and the scene itself asks for the release (`releaseBoardScaleForScene`). The ordinary
   * drain stands aside while it is set; the park's safety still bounds it.
   */
  sceneHeld: false,
  /**
   * «ОБРАТНЫЙ ХОД» (TR47 — `scaleSwing/scaleSwingDirector.ts`): the values a PARAMETER SWING presents until each
   * leg's own turn — the peak the fall starts from, or the value a raise that arrived with its fall glides up
   * from. Written by the swing director ONLY (never by the drain), merged UNDER the park's held values: a raise
   * the park still holds is the drain's story, and the swing's display takes over once the drain lets it go.
   */
  swingParams: undefined as Partial<HeldGlobalParams> | undefined,
  /** …and the scale-bonus claim map as it stood before a raise the swing plays itself (its capture plays on the glide). */
  swingClaims: undefined as Record<string, Color> | undefined,
});

// The DRAIN is a real board cinematic: notifications queue behind it exactly
// as they do behind the cover-lift scene it hands over to. Deliberately only
// the drain — a PARK can outlive any reasonable silence (the player may sit
// in a workspace for minutes) and the feed must keep flowing there.
//
// THE CEILING ENDS THE WEDGE, NOT JUST THE COUNT (both holds): a drain whose
// own timers / members never closed runs the park's honest degrade — the one
// its ledger story's `degrade` and the game switch run: every held value let
// go (the HUD reads the applied view), the parked batch un-parks.
registerAnimationHoldSupplier('board-beat-drain',
  () => boardBeatParkState.draining, {
    scope: 'notification-only',
    diagnose: () => boardBeatParkDiagnosis(),
    expire: () => {
      if (!boardBeatParkState.draining) {
        return;
      }
      console.warn('[boardBeatPark] board-beat drain: outlived its ceiling — ended');
      releaseBoardBeatPark();
    },
  });

// …and the SCALE STORY holds BLOCKING for its own bounded window: a follow-up
// modal or a bot-turn card must not cover the gliding scales (the defect the
// old planet-focus beat existed to prevent, now stated once for every drain
// that releases held values).
registerAnimationHoldSupplier('board-beat-scale-story',
  () => boardBeatParkState.scaleStory, {
    diagnose: () => boardBeatParkDiagnosis(),
    expire: () => {
      if (!boardBeatParkState.scaleStory) {
        return;
      }
      console.warn('[boardBeatPark] board-beat scale story: outlived its ceiling — ended');
      releaseBoardBeatPark();
    },
  });

function boardBeatParkDiagnosis(): unknown {
  return {
    nonce: boardBeatParkState.nonce,
    draining: boardBeatParkState.draining,
    scaleStory: boardBeatParkState.scaleStory,
    batchHeldByDrain: boardBeatParkState.batchHeldByDrain,
    sceneHeld: boardBeatParkState.sceneHeld,
    held: Object.keys(boardBeatParkState.heldParams ?? {}),
    members: [...storyMembers.entries()].filter(([, m]) => m.busy()).map(([id]) => id),
  };
}

/** The html accent class suffix per changed parameter (shared CSS —
 *  `con-scale-focus-<accent>`, the Government-Support beat's own language). */
const ACCENT_OF_PARAM: ReadonlyArray<{key: keyof HeldGlobalParams, accent: string}> = [
  {key: 'temperature', accent: 'temperature'},
  {key: 'oxygenLevel', accent: 'oxygen'},
  {key: 'oceans', accent: 'oceans'},
  {key: 'venusScaleLevel', accent: 'venus'},
];

/** The accent suffixes of the parameters that changed held → live. A held
 *  key with no live source counts as changed (it was seeded BY a change). */
export function changedGlobalParams(
  held: Partial<HeldGlobalParams>, live: HeldGlobalParams | undefined): Array<string> {
  return ACCENT_OF_PARAM
    .filter(({key}) => held[key] !== undefined && (live === undefined || held[key] !== live[key]))
    .map(({accent}) => accent);
}

function applyScaleAccents(accents: ReadonlyArray<string>): void {
  if (typeof document === 'undefined') {
    return;
  }
  for (const accent of accents) {
    document.documentElement.classList.add('con-scale-focus-' + accent);
  }
}

function clearScaleAccents(): void {
  if (typeof document === 'undefined') {
    return;
  }
  for (const {accent} of ACCENT_OF_PARAM) {
    document.documentElement.classList.remove('con-scale-focus-' + accent);
  }
}

/** The live committed values, read at the drain's release (the playerView
 *  root identity changes per response, so this module can never hold a
 *  stale object reference — the shell registers a reader). */
let liveParamsSource: (() => HeldGlobalParams) | undefined;

export function registerBoardBeatLiveParams(source: () => HeldGlobalParams): () => void {
  liveParamsSource = source;
  return () => {
    if (liveParamsSource === source) {
      liveParamsSource = undefined;
    }
  };
}

/** The ledger's redrive entry — the SHELL registers its guarded drain (the
 *  one that waits out board cinematics); the bare `drainBoardBeatsIfDue` is
 *  the desktop/test default. */
let redriveHook: (() => void) | undefined;

export function registerBoardBeatRedrive(hook: (() => void) | undefined): void {
  redriveHook = hook;
}

/** The injected «board watchable» verdict (shell-owned). Undefined → always
 *  watchable → this module is inert (desktop / tests / a dead shell). */
/**
 * A SHALLOW REF, never a plain `let`: the probe is registered at the shell's mount — after its first render — and
 * `boardBeatParkPending` (read by the shell's cached `board-story` admission term) short-circuits on it; a plain `let`
 * left that term cached at «no story» for a reload that landed with a parked batch (the `reactivityWitness.ts` class).
 */
const watchableProbeRef = shallowRef<(() => boolean) | undefined>(undefined);

export function registerBoardWatchableProbe(probe: (() => boolean) | undefined): void {
  watchableProbeRef.value = probe;
}

function boardWatchable(): boolean {
  return watchableProbeRef.value === undefined || watchableProbeRef.value();
}

/**
 * WHAT COVERS THE BOARD right now — the names of the watchable verdict's terms that are false (the shell's own, beside
 * the verdict: `placementController.boardCoverReasons`). Read only by the degrade's diagnose: «the board was covered»
 * is a defect or an honest wait depending on WHO covered it (the tier audit of 2026-11-18, row 1 — the box's
 * `watchable: false` with the player on the board and no frame standing was filed as an honest wait).
 */
let coverReasonsProbe: (() => ReadonlyArray<string>) | undefined;

export function registerBoardCoverReasons(probe: (() => ReadonlyArray<string>) | undefined): void {
  coverReasonsProbe = probe;
}

/** Who covers the board right now — for every board story's degrade diagnose (`coveredBy`; empty when watchable / no shell). */
export function boardCoverReasonsNow(): Array<string> {
  return [...(coverReasonsProbe?.() ?? [])];
}

/**
 * THE SCALES' STORY IS BEING TOLD AND STANDS UNDER A COVER OF ITS OWN END: the drain runs, and a member it waits for
 * says the place of its story is covered (`BoardBeatStoryMember.endCovered` — the rating's marker under a decision's
 * plate). Whoever must wait for the scales AND owns that cover cannot wait: it waits for itself.
 *
 * THE CYCLE THIS NAMES (the whole suite on CI, 2026-11-22 — `console-arabia-terra`, «printed DATA, two holders»;
 * fifteen seconds of a frozen plate after the player's answer, every time): the landing raises «on which card» in
 * the same response as its oxygen step; the plate stands over the board while the step is told, so the rating's token
 * waits for a marker the player can see; the answer starts the payout, which waits for the scales' story (the field
 * speaks first); the scales' drain waits for its member, the rating; and the plate — the cover — does not leave
 * until the payout has carried its card out of it. Three waits in a ring, each right alone, broken only by the
 * payout's ceiling. None of them named another as a node — a count of members, a cover read off the DOM.
 */
export function boardStoryWaitsUnderACover(): boolean {
  return boardBeatParkState.draining && [...storyMembers.values()].some((member) => member.busy() && member.endCovered?.() === true);
}

/**
 * WHAT THE PARK IS DOING RIGHT NOW, in a phrase — for the node of whoever waits for the scales' story (a ceiling's
 * line then names the gate that never opened instead of «the console quiet did not come»): what is held, whether a
 * drain runs or a scene holds the values, what gated the drain at its last look, how many drains this window opened.
 */
export function boardBeatParkWhy(): string {
  return `park held ${Object.keys(boardBeatParkState.heldParams ?? {}).join('+') || 'nothing'}` +
    `${boardBeatParkState.heldClaims !== undefined ? ' +claims' : ''}${parkedBatchPending() ? ' +batch' : ''}` +
    `${boardBeatParkState.draining ? ' · draining' : ''}${boardBeatParkState.sceneHeld ? ' · held for a scene' : ''}` +
    `${boardBeatParkState.scaleStory ? ' · scale story' : ''}${boardBeatParkState.batchHeldByDrain ? ' · batch held by the drain' : ''}` +
    `${boardBeatParkState.draining ? ` · the drain stands ${Math.round((Date.now() - parkWindow.drainAt) / 100) / 10}s at «${parkWindow.drainStep}»` : ''}` +
    ` · members busy [${[...storyMembers.entries()].filter(([, member]) => member.busy()).map(([key]) => key).join(', ')}]` +
    ` · gated by [${[...parkWindow.gatedBy].join(', ')}] ×${parkWindow.gated} · drains ${parkWindow.drains} · looks ${parkWindow.seen}/${parkWindow.looks}`;
}

/**
 * THE BOARD's STORY WAITS FOR THE PLAYER — the board is covered right now, and only by what the PLAYER looks at
 * (`boardCoversAreThePlayers`: a section, a sheet, a workspace, a placement of theirs and the camera that serves it —
 * never the game's own scene, a sitting on its way up or the camera alone). A phrase for a wait's ceiling (`QuietWaitOpts.heldByPlayer`): whoever waits
 * for the scales' story then reached its bound over the player's own time; `undefined` — the board is in view, or
 * what covers it is the game's, and a bound reached there is a story that never ended.
 */
export function boardStoryHeldByPlayer(): string | undefined {
  const covers = boardCoverReasonsNow();
  if (!boardCoversAreThePlayers(covers)) {
    return undefined;
  }
  return `the player keeps the board covered by ${covers.join(' + ')} — the scales' story waits for the board they uncover`;
}

/** Was the board watchable at ANY look of the owed story's window? (A degrade's verdict is the whole window's, never one snapshot's.) */
let watchableSeen = false;

/**
 * WHAT THE DRAIN DID WITH THE BOARD IT SAW, over the owed story's window. «Seen» alone cannot tell two windows apart:
 * a board that stood open while the drain never ran (a defect), and a board the player CROSSED — open for less than
 * the drain's own settle (`BOARD_BEAT_SETTLE_MS`, after a leaving surface), then covered again, which re-parks by
 * design (the monkey under a reload, 2026-11-18: `watchableSeen: true` behind a section and a workspace, filed as a
 * defect with nothing in the line to say which). The drain itself is the witness: how many looks saw the board, how
 * many drains it opened, how many of them ended «covered again before anything released», and BY WHAT.
 *
 * …AND WHY A BOARD THAT WAS SEEN OPENED NO DRAIN (the box's plain pass, `fz0` · `parliament-bot-lobby`, 2026-11-19:
 * «looks 3/117 · drains 0» — three looks of a board the player was crossing, and the line could not say whether the
 * drain was refused by a wedge or stood behind its own lawful gate). The drain the shell registers is GATED — the
 * board's own scene settling, a reveal above it, cards in transit — and each gated re-drive says by what
 * (`noteBoardBeatDrainGated`): `gated` looks, `gatedBy` reasons. The gate has its own bound and its own line.
 */
const parkWindow = {
  looks: 0, seen: 0, drains: 0, coveredAgain: 0, coveredAgainBy: new Set<string>(), gated: 0, gatedBy: new Set<string>(),
  /** When the drain that runs now began, and where it stands (its last step — for the line of whoever waits for it). */
  drainAt: 0, drainStep: '',
};

/** The shell's guarded drain found the board watchable and did NOT open — held by its own gate (`reasons`, never empty). */
export function noteBoardBeatDrainGated(reasons: ReadonlyArray<string>): void {
  parkWindow.gated++;
  for (const reason of reasons) {
    parkWindow.gatedBy.add(reason);
  }
}

function resetParkWindow(): void {
  watchableSeen = false;
  parkWindow.looks = 0;
  parkWindow.seen = 0;
  parkWindow.drains = 0;
  parkWindow.coveredAgain = 0;
  parkWindow.coveredAgainBy.clear();
  parkWindow.gated = 0;
  parkWindow.gatedBy.clear();
}

/** Is the park LIVE — a shell registered its watchable verdict? Without one the module is inert (desktop / tests). */
export function boardBeatParkLive(): boolean {
  return watchableProbeRef.value !== undefined;
}

/** The «board watchable» verdict, for a board scene that must wait for the player's view (TR24's scale-step tokens). */
export function boardBeatBoardWatchable(): boolean {
  return boardWatchable();
}

/** Is this parameter's PRESENTED value still held (its marker has not been released to glide)? */
export function boardBeatHoldsParam(key: keyof HeldGlobalParams): boolean {
  return boardBeatParkState.heldParams?.[key] !== undefined;
}

/**
 * THE SCALE STORY'S MEMBERS — a scene that tells what the released step PAID
 * (TR24 Venusian Census / Aphrodite: the tokens born at the scale's marker once
 * it has arrived). The drain asks every member after the scale window: a busy
 * one STRETCHES the window by its own landing signal (`quiet`) — the blocking
 * scale story stands, and a parked batch (the Venus 8 % card) un-parks only
 * after the last token has landed. Bounded (`BOARD_BEAT_MEMBER_WAIT_MAX_MS`):
 * a member that never settles cannot wedge the drain.
 */
export type BoardBeatStoryMember = {
  busy: () => boolean,
  quiet: () => Promise<void>,
  /**
   * THE MEMBER WAITS UNDER A COVER OF ITS OWN END — it is busy because the place its story is told on (a scale's
   * marker) is covered by a surface standing over the board in view: a decision's plate, by the law that a decision
   * never waits on a story. Said by the member, asked through `boardStoryWaitsUnderACover`.
   */
  endCovered?: () => boolean,
};
const storyMembers = new Map<string, BoardBeatStoryMember>();

export function registerBoardBeatStoryMember(id: string, member: BoardBeatStoryMember): () => void {
  storyMembers.set(id, member);
  return () => {
    if (storyMembers.get(id) === member) {
      storyMembers.delete(id);
    }
  };
}

/**
 * The longest the drain waits for its members after the scale window — COUNTED FROM THE LAST MEMBER'S QUIET, never from
 * the window's end alone (FLAKE ZERO Ф4, class N): the members tell what the step paid IN TURN (the rating's tokens,
 * then the step's reward, then the Venus bonus cell — each waits for the one before), at the machine's pace, and on a
 * slow renderer the chain outlasted one budget: the cover rose and the blocking story let go over tokens still in the
 * air. Each member that goes quiet re-arms it, bounded by `BOARD_BEAT_MEMBERS_HARD_MAX_MS`. A ceiling — never scaled
 * down with a faster motion setting (it halved to 4 s in every functional e2e while a CI frame does not halve).
 */
export const BOARD_BEAT_MEMBER_WAIT_MAX_MS = 8000;
/** …and the hard ceiling of the whole members' story. */
export const BOARD_BEAT_MEMBERS_HARD_MAX_MS = 20_000;

/**
 * The injected «a surface is still LEAVING» verdict (shell-owned —
 * `conWsPresence.wsOpen`, which counts a `.con-ws` through its whole leave).
 * The stack empties on the frame the workspace STARTS fading, so a drain
 * scheduled off that edge alone released the scales under a surface still
 * painting its fade (measured: the Venus strip read 6 % → 8 % ~130 ms before
 * the colony workspace's root left the DOM). The settle starts only once the
 * board is genuinely uncovered; bounded, so a stuck leave can never wedge it.
 */
let surfaceLeavingProbe: (() => boolean) | undefined;

export function registerBoardBeatSurfaceProbe(probe: (() => boolean) | undefined): void {
  surfaceLeavingProbe = probe;
}

/** The longest a drain waits for a leaving surface before it goes on anyway. */
export const BOARD_BEAT_LEAVE_WAIT_MAX_MS = 1200;
const LEAVE_POLL_MS = 40;

let ledgerStory: OwedStoryHandle | undefined;
/** The story's steps — each the cancel of a timer the STORY'S RUN owns (`boardStoryRun`). */
let drainTimers: Array<() => void> = [];

function clearSafety(): void {
  ledgerStory?.settle();
  ledgerStory = undefined;
  resetParkWindow();
}

function clearDrainTimers(): void {
  for (const cancel of drainTimers) {
    cancel();
  }
  drainTimers = [];
}

/**
 * The park's whole-life bound, restated as a PRESENTATION-LEDGER story
 * (mechanism B): the heartbeat re-drives the drain whenever the board is
 * watchable and something is owed (a missed watchable edge costs one tick,
 * never the 30 s safety), and past the ceiling the degrade releases
 * honestly — WITH a named warn, where the old private timer snapped in
 * silence.
 */
function armSafety(): void {
  if (ledgerStory !== undefined) {
    return;
  }
  resetParkWindow();
  ledgerStory = owePresentation({
    id: 'board-beat-park',
    ready: () => {
      // Every look of the ledger's heartbeat is a sample of the window — the degrade reports whether ANY saw the board.
      const watchable = boardWatchable();
      parkWindow.looks++;
      if (watchable) {
        watchableSeen = true;
        parkWindow.seen++;
      }
      return watchable && boardBeatParkPending() && !boardBeatParkState.draining && !boardBeatParkState.sceneHeld;
    },
    redrive: () => (redriveHook ?? drainBoardBeatsIfDue)(),
    dueMs: BOARD_BEAT_PARK_SAFETY_MS,
    degrade: () => releaseBoardBeatPark(),
    // The degrade names WHICH gate never opened: `watchable: false` is the
    // honest multiplayer wait (the viewer sat in a screen while an opponent
    // moved a scale — the park released the values without the show, by
    // design); `watchable: true` is the interesting case — the drain was
    // re-driven for 30 s over an open board and something in its own quiet
    // gate (scene settling / read admission) never let it run.
    // `coveredBy` + `watchableSeen` + what the drain did decide the TIER (`shapes.ts` story-due): an honest wait only
    // when the player's own choices covered the board — for the whole window, or again each time the drain opened
    // (`drains` === `coveredAgain`, every `coveredAgainBy` the player's); anything else is a defect.
    diagnose: () => ({
      watchable: boardWatchable(),
      watchableSeen,
      looks: `${parkWindow.seen}/${parkWindow.looks}`,
      drains: parkWindow.drains,
      coveredAgain: parkWindow.coveredAgain,
      coveredAgainBy: [...parkWindow.coveredAgainBy],
      gated: parkWindow.gated,
      gatedBy: [...parkWindow.gatedBy],
      coveredBy: [...(coverReasonsProbe?.() ?? [])],
      pending: boardBeatParkPending(),
      draining: boardBeatParkState.draining,
      sceneHeld: boardBeatParkState.sceneHeld,
      held: Object.keys(boardBeatParkState.heldParams ?? {}),
      claims: boardBeatParkState.heldClaims !== undefined,
      batch: parkedBatchPending(),
    }),
  });
}

const PARAM_KEYS: ReadonlyArray<keyof HeldGlobalParams> =
  ['temperature', 'oxygenLevel', 'oceans', 'venusScaleLevel'];

function claimsChanged(oldClaims: Record<string, Color>, newClaims: Record<string, Color>): boolean {
  const oldKeys = Object.keys(oldClaims);
  const newKeys = Object.keys(newClaims);
  return oldKeys.length !== newKeys.length ||
    newKeys.some((k) => oldClaims[k] !== newClaims[k]);
}

/**
 * The shell's per-view observer: a global parameter (or the claim map) moved
 * between two applied views. While the board is WATCHABLE this is a no-op —
 * the reactive bindings tell the story themselves, exactly as before. While
 * it is covered, the OLD value is held for the drain to release.
 */
export function noteBoardScaleAdvance(oldGame: GameModel, newGame: GameModel): void {
  if (watchableProbeRef.value === undefined || boardWatchable()) {
    return;
  }
  let seeded = false;
  for (const key of PARAM_KEYS) {
    if (oldGame[key] !== newGame[key] && boardBeatParkState.heldParams?.[key] === undefined) {
      boardBeatParkState.heldParams = {
        ...(boardBeatParkState.heldParams ?? {}),
        [key]: oldGame[key],
      };
      seeded = true;
    }
  }
  if (boardBeatParkState.heldClaims === undefined &&
      claimsChanged(oldGame.scaleBonusClaims ?? {}, newGame.scaleBonusClaims ?? {})) {
    boardBeatParkState.heldClaims = {...(oldGame.scaleBonusClaims ?? {})};
    seeded = true;
  }
  if (seeded) {
    armSafety();
  }
}

/**
 * A SCENE'S HOLD (TR70 — the terraformed scene): the parameters that moved between two views keep their
 * PRESENTED pre-change values whether or not the board is covered — the scene's stage is what releases them.
 * First write wins per parameter, like the shell's observer. Returns whether anything is held.
 */
export function holdBoardScaleForScene(oldGame: GameModel, newGame: GameModel): boolean {
  let seeded = false;
  for (const key of PARAM_KEYS) {
    if (oldGame[key] !== newGame[key] && boardBeatParkState.heldParams?.[key] === undefined) {
      boardBeatParkState.heldParams = {
        ...(boardBeatParkState.heldParams ?? {}),
        [key]: oldGame[key],
      };
      seeded = true;
    }
  }
  if (boardBeatParkState.heldParams === undefined && boardBeatParkState.heldClaims === undefined) {
    return false;
  }
  boardBeatParkState.sceneHeld = true;
  if (seeded) {
    armSafety();
  }
  return true;
}

/**
 * THE SCENE'S OWN RELEASE (TR70): the scales' story played NOW, on the scene's stage — the camera standing, the
 * arcs lit (the «watchable» verdict says «covered» for a Planet Focus, which is right for a placement and wrong
 * for the ceremony). The same release the drain plays: the accents on the scales about to move, the values let
 * go (the markers glide, the HUD flips, the chips fire), the blocking story window for the glide. A parked
 * BATCH stays parked for the ordinary drain — the scene owns the values, never the reveal. Returns the story's
 * window in ms (0 when nothing was held).
 */
export function releaseBoardScaleForScene(): number {
  boardBeatParkState.sceneHeld = false;
  const held = boardBeatParkState.heldParams;
  if (held === undefined && boardBeatParkState.heldClaims === undefined) {
    return 0;
  }
  clearDrainTimers();
  if (held !== undefined) {
    applyScaleAccents(changedGlobalParams(held, liveParamsSource?.()));
  }
  boardBeatParkState.heldParams = undefined;
  boardBeatParkState.heldClaims = undefined;
  boardBeatParkState.scaleStory = true;
  const windowMs = consoleMotionMs(BOARD_BEAT_SCALE_MS);
  schedule(() => {
    clearScaleAccents();
    boardBeatParkState.scaleStory = false;
    if (!boardBeatParkPending()) {
      clearSafety();
    }
  }, windowMs);
  return windowMs;
}

/** The parameters the board + status strip should DISPLAY: the held
 *  pre-change values over whatever the base presenter (planet focus / live)
 *  already decided. ONE merge for both surfaces. */
export function boardBeatDisplayParams(base: HeldGlobalParams): HeldGlobalParams {
  const held = boardBeatParkState.heldParams;
  const swing = boardBeatParkState.swingParams;
  if (held === undefined && swing === undefined) {
    return base;
  }
  return {...base, ...(swing ?? {}), ...(held ?? {})};
}

/** The scale-bonus claim map the board should DISPLAY (held ?? the swing's ?? live). */
export function boardBeatDisplayClaims(live: Record<string, Color>): Record<string, Color> {
  return boardBeatParkState.heldClaims ?? boardBeatParkState.swingClaims ?? live;
}

/**
 * Does the board / the status strip display anything but the live values right now? The ONE gate both read
 * (the park's held values, the swing's presented ones) — reactive through `boardBeatParkState`.
 */
export function boardBeatDisplayHeld(): boolean {
  return boardBeatParkState.heldParams !== undefined ||
    boardBeatParkState.heldClaims !== undefined ||
    boardBeatParkState.swingParams !== undefined ||
    boardBeatParkState.swingClaims !== undefined;
}

/**
 * The swing director's ONE writer of its display (`undefined` = nothing presented). Never touched by the drain
 * or the park's safety: the swing owns its own bound (its stage due) and its own release.
 */
export function setBoardSwingDisplay(params: Partial<HeldGlobalParams> | undefined, claims?: Record<string, Color>): void {
  boardBeatParkState.swingParams = params !== undefined && Object.keys(params).length > 0 ? {...params} : undefined;
  boardBeatParkState.swingClaims = claims !== undefined ? {...claims} : undefined;
}

/**
 * Is THIS batch parked behind the board-beat drain? True for a
 * `globalParameter`-sourced batch while the board is covered, while values
 * are still held, or while the drain's glide half is still playing. Scoped
 * to the batch it parks (never «the reveal») — the colony park's own law.
 */
export function boardBeatParksReveal(source: CardDrawRevealSource | undefined): boolean {
  if (source?.type !== 'globalParameter') {
    return false;
  }
  if (watchableProbeRef.value === undefined) {
    return false;
  }
  // A CLAIMED SIBLING no longer outranks the park. It used to («raise Venus +
  // draw» in one press): the queue presented oldest-first, so a parked bonus
  // batch in FRONT walled the workspace's own batch behind it — and the park
  // yielded, which put the Venus 8 % card FULLSCREEN over the colony trade
  // mid-beat. The queue now skips a parked batch (`registerRevealQueuePark`,
  // the shell registers this very verdict), so the claimed sibling presents
  // in its zone and the parked batch waits for the board — no wall, no yield.
  return !boardWatchable() ||
    boardBeatParkState.heldParams !== undefined ||
    boardBeatParkState.heldClaims !== undefined ||
    boardBeatParkState.batchHeldByDrain;
}

/** Is a batch of this park's family pending right now (drives the drain)? */
function parkedBatchPending(): boolean {
  // The park's own family, read PAST the queue's skip: the queue hides exactly
  // the batch this asks about.
  return pendingRevealEvents().some((ev) => ev.source?.type === 'globalParameter');
}

/** Anything owed at all — the drain trigger's cheap pre-check. */
export const boardBeatParkPending = reactivePredicate('board-beat-park-pending', (): boolean => {
  return boardBeatParkState.heldParams !== undefined ||
    boardBeatParkState.heldClaims !== undefined ||
    (watchableProbeRef.value !== undefined && parkedBatchPending());
});

/**
 * THE BOARD'S STORY IS A RUN (architecture v2 — PLAN §10 · C4): derived from the two flags that say it is being told
 * (a drain in flight, a scale story's blocking window), so every writer of them moves the run by construction. Its
 * steps are the run's own timers; a story whose game screen left is RELEASED without the show (`orphaned` — the
 * honest degrade `releaseBoardBeatPark` already is), never left holding the next game's board.
 */
const boardStoryRun = deriveFlowRun('board-beat-story', () => boardBeatParkState.draining || boardBeatParkState.scaleStory, {
  kind: 'story',
  orphaned: () => releaseBoardBeatPark(),
});

function schedule(run: () => void, ms: number): () => void {
  const cancel = (boardStoryRun.scope ?? consoleSessionScope()).after(ms, 'a step of the board\'s story', run);
  drainTimers.push(cancel);
  return cancel;
}

/** The settle, started only once no surface is still leaving (bounded — see `registerBoardBeatSurfaceProbe`). */
function scheduleSettle(run: () => void): void {
  // A drain opened INSIDE the camera's exit (W6 — the story starts with the pullback) owes no settle of its own: the
  // landing camera IS the settle, and the instruments are already readable (`planetFocusStoryReady`).
  const settle = planetFocusState.storyReady ? 0 : consoleMotionMs(BOARD_BEAT_SETTLE_MS);
  const started = Date.now();
  const tick = (): void => {
    if (surfaceLeavingProbe?.() === true && Date.now() - started < BOARD_BEAT_LEAVE_WAIT_MAX_MS) {
      schedule(tick, LEAVE_POLL_MS);
      return;
    }
    schedule(run, settle);
  };
  tick();
}

/**
 * DRAIN — the shell calls this on the «board watchable» rising edge (and
 * re-asks after every conclusion; idempotent). Causal order, each step
 * re-checking that the board is still watchable — a workspace re-opened
 * mid-drain simply re-parks what has not been released yet.
 */
export function drainBoardBeatsIfDue(): void {
  // A SCENE owns the held values (the terraformed scene): its stage releases them, never the drain.
  if (boardBeatParkState.draining || boardBeatParkState.sceneHeld || !boardBeatParkPending() || !boardWatchable()) {
    return;
  }
  clearDrainTimers();
  boardBeatParkState.draining = true;
  boardBeatParkState.nonce++;
  parkWindow.drains++;
  parkWindow.drainAt = Date.now();
  parkWindow.drainStep = 'the settle';
  // The BLOCKING story window opens with the drain when values are owed —
  // a follow-up modal must not land during the settle gap either, or it
  // covers the very release it is about to explain.
  const owesScaleStory = boardBeatParkState.heldParams !== undefined ||
    boardBeatParkState.heldClaims !== undefined;
  boardBeatParkState.scaleStory = owesScaleStory;
  const endScaleStory = () => {
    clearScaleAccents();
    boardBeatParkState.scaleStory = false;
  };
  scheduleSettle(() => {
    if (!boardWatchable()) {
      // Covered again before anything released — everything stays held; the
      // next watchable edge re-runs the whole drain. (Said to the window: WHO covered it decides whose wait this was.)
      parkWindow.coveredAgain++;
      for (const reason of coverReasonsProbe?.() ?? []) {
        parkWindow.coveredAgainBy.add(reason);
      }
      boardBeatParkState.draining = false;
      endScaleStory();
      return;
    }
    const held = boardBeatParkState.heldParams;
    const hadScaleStory = held !== undefined ||
      boardBeatParkState.heldClaims !== undefined;
    if (hadScaleStory && held !== undefined) {
      // The one-shot accent on exactly the scales about to move — applied
      // BEFORE the release so the pulse and the glide are one beat (the
      // planet-focus beat's own language, owned by the drain since the
      // one-owner merge).
      applyScaleAccents(changedGlobalParams(held, liveParamsSource?.()));
    }
    // Release the values: the marker glides, the fill advances, the claim
    // chip plays its capture — plain reactivity from here.
    boardBeatParkState.heldParams = undefined;
    boardBeatParkState.heldClaims = undefined;
    parkWindow.drainStep = 'the values released';
    // THE STORY IS BEING TOLD NOW: the park's whole-life bound (`BOARD_BEAT_PARK_SAFETY_MS`, counted from the SEED — a
    // board kept covered) bounds what is left of the story from HERE (FLAKE ZERO Ф4, class N). A board covered for most
    // of the bound (a Parliament sitting walking to its world trip at a slow renderer's pace) left a story released a
    // few seconds before the due, and the degrade cut it mid-glide: the cover rose over tokens in the air, the frame
    // that stepped aside came back over the board. Once released the values cannot be re-parked — this happens once.
    if (ledgerStory !== undefined) {
      clearSafety();
      armSafety();
    }
    const releaseBatch = () => {
      boardBeatParkState.batchHeldByDrain = false;
      boardBeatParkState.draining = false;
      endScaleStory();
      clearSafety();
    };
    // …and what the released step PAID is told before anything after it (the members' own signal).
    const nonce = boardBeatParkState.nonce;
    const afterMembers = (run: () => void) => () => {
      const owed = [...storyMembers.values()].filter((m) => m.busy());
      if (owed.length === 0) {
        run();
        return;
      }
      parkWindow.drainStep = 'the members\' story';
      let done = false;
      let cancelNet: () => void = () => {};
      const finish = () => {
        // A drain released / reset meanwhile (or a NEW drain running) is not this one's to end.
        if (!done && boardBeatParkState.nonce === nonce && boardBeatParkState.draining) {
          done = true;
          cancelNet();
          // ONE BREATH after the last touchdown (PL-146): the member's quiet lands on the counter's own tick, and
          // a cover rising 23 ms later (measured) buries the number it just paid — a settle beat, never the window.
          schedule(() => {
            if (boardBeatParkState.nonce === nonce && boardBeatParkState.draining) {
              run();
            }
          }, consoleMotionMs(BOARD_BEAT_SETTLE_MS));
        }
      };
      // The net counts from the LAST member's quiet (the chain progressed), bounded by the hard ceiling.
      const hardAt = flowClock().now() + motionCeilingMs(BOARD_BEAT_MEMBERS_HARD_MAX_MS);
      const armNet = (): void => {
        if (done) {
          return;
        }
        cancelNet();
        cancelNet = schedule(finish, Math.max(0, Math.min(motionCeilingMs(BOARD_BEAT_MEMBER_WAIT_MAX_MS), hardAt - flowClock().now())));
      };
      const quiets = owed.map((m) => m.quiet());
      for (const quiet of quiets) {
        void quiet.then(armNet, armNet);
      }
      void Promise.all(quiets).then(finish, finish);
      armNet();
    };
    // THE WINDOW IS THE MEMBERS' WHEN THERE ARE MEMBERS (PL-146): a story member waits for the marker's
    // arrival itself and then tells what the step paid, so the fixed scale window on top of it was
    // dead time — 1.7 s of silence between the last touchdown and the cover on a 4K frame. The window
    // stays for the EMPTY drain (a scale that moves and nobody answers): the glide's own cover.
    const membersOwed = [...storyMembers.values()].some((m) => m.busy());
    const windowMs = hadScaleStory && !membersOwed ? consoleMotionMs(BOARD_BEAT_SCALE_MS) : 0;
    if (parkedBatchPending()) {
      // The cover lifts only off a marker that has ARRIVED. No scale story →
      // no wait (a reload mid-park holds no values — the batch releases on
      // the settle alone).
      boardBeatParkState.batchHeldByDrain = true;
      schedule(hadScaleStory ? afterMembers(releaseBatch) : releaseBatch, windowMs);
    } else if (hadScaleStory) {
      // Values released with no batch behind them — the hold covers the
      // glide window (or the members' story) so nothing lands on top of the moving scales.
      schedule(afterMembers(() => {
        boardBeatParkState.draining = false;
        endScaleStory();
        clearSafety();
      }), windowMs);
    } else {
      boardBeatParkState.draining = false;
      endScaleStory();
      clearSafety();
    }
  });
}

/**
 * Release everything WITHOUT the show (the safety, a game switch). The
 * values snap by reactivity; a parked batch un-parks and takes the ordinary
 * standalone presentation wherever the player stands — the pre-park
 * behaviour, and the honest degrade.
 */
export function releaseBoardBeatPark(): void {
  clearSafety();
  clearDrainTimers();
  clearScaleAccents();
  boardBeatParkState.heldParams = undefined;
  boardBeatParkState.heldClaims = undefined;
  boardBeatParkState.batchHeldByDrain = false;
  boardBeatParkState.draining = false;
  boardBeatParkState.scaleStory = false;
  boardBeatParkState.sceneHeld = false;
}

/**
 * A scale story is OWED or PLAYING — the automatic-transition gate's term
 * (`boardStorySettling` in rewardPayoutQuiet): a yielded stack's return and
 * the endgame auto-open wait it out, so the story plays on the board they
 * are about to cover instead of dying behind them. Never a term of the
 * drain's own gate (self-wait) or of the watchable probe (reactivity cycle).
 */
export function boardBeatStoryPending(): boolean {
  return boardBeatParkPending() || boardBeatParkState.draining;
}

/** Full reset (game switch / shell unmount / tests). Also drops the probe —
 *  a dead shell's computeds must never decide the next game's parks. */
export function resetBoardBeatPark(): void {
  releaseBoardBeatPark();
  setBoardSwingDisplay(undefined);
  watchableProbeRef.value = undefined;
  coverReasonsProbe = undefined;
  resetParkWindow();
  surfaceLeavingProbe = undefined;
  redriveHook = undefined;
  liveParamsSource = undefined;
}

// THE GAME SCREEN LEAVES: this state goes with it — declared here, taken down by the session's ordered pass
// (architecture v2 — PLAN §10 · C5; the number is its place in that pass — `leaveConsoleSession`).
// The board-beat park dies with the shell (drops the probe too — a dead shell's computeds must never decide the next
// game's parks; held values and a parked batch release honestly, without the show).
sessionState('board-beat-park', resetBoardBeatPark, 40);
