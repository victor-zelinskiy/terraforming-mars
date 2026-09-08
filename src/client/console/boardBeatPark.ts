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
 *     plays its capture) → the scale beat runs its window → the batch
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

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {GameModel} from '@/common/models/GameModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {HeldGlobalParams} from '@/client/console/planetFocus';
import {OwedStoryHandle, owePresentation} from '@/client/console/presentationLedger';
import {currentRevealEvent, drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {workspaceClaimsRevealSource} from '@/client/console/consoleWorkspaceOutcome';

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
});

// The DRAIN is a real board cinematic: notifications queue behind it exactly
// as they do behind the cover-lift scene it hands over to. Deliberately only
// the drain — a PARK can outlive any reasonable silence (the player may sit
// in a workspace for minutes) and the feed must keep flowing there.
registerAnimationHoldSupplier('board-beat-drain',
  () => boardBeatParkState.draining, {scope: 'notification-only'});

// …and the SCALE STORY holds BLOCKING for its own bounded window: a follow-up
// modal or a bot-turn card must not cover the gliding scales (the defect the
// old planet-focus beat existed to prevent, now stated once for every drain
// that releases held values).
registerAnimationHoldSupplier('board-beat-scale-story',
  () => boardBeatParkState.scaleStory);

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
let watchableProbe: (() => boolean) | undefined;

export function registerBoardWatchableProbe(probe: (() => boolean) | undefined): void {
  watchableProbe = probe;
}

function boardWatchable(): boolean {
  return watchableProbe === undefined || watchableProbe();
}

let ledgerStory: OwedStoryHandle | undefined;
let drainTimers: Array<ReturnType<typeof setTimeout>> = [];

function clearSafety(): void {
  ledgerStory?.settle();
  ledgerStory = undefined;
}

function clearDrainTimers(): void {
  for (const t of drainTimers) {
    clearTimeout(t);
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
  ledgerStory = owePresentation({
    id: 'board-beat-park',
    ready: () => boardWatchable() && boardBeatParkPending() && !boardBeatParkState.draining,
    redrive: () => (redriveHook ?? drainBoardBeatsIfDue)(),
    dueMs: BOARD_BEAT_PARK_SAFETY_MS,
    degrade: () => releaseBoardBeatPark(),
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
  if (watchableProbe === undefined || boardWatchable()) {
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

/** The parameters the board + status strip should DISPLAY: the held
 *  pre-change values over whatever the base presenter (planet focus / live)
 *  already decided. ONE merge for both surfaces. */
export function boardBeatDisplayParams(base: HeldGlobalParams): HeldGlobalParams {
  const held = boardBeatParkState.heldParams;
  return held === undefined ? base : {...base, ...held};
}

/** The scale-bonus claim map the board should DISPLAY (held ?? live). */
export function boardBeatDisplayClaims(live: Record<string, Color>): Record<string, Color> {
  return boardBeatParkState.heldClaims ?? live;
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
  if (watchableProbe === undefined) {
    return false;
  }
  // A CLAIMED SIBLING OUTRANKS THE PARK. One response can queue the workspace's
  // OWN batch behind the scale bonus («raise Venus + draw» in one press), and
  // `currentRevealEvent` presents oldest-first — parking the bonus batch in
  // front would wall the claimed one behind an event that only releases after
  // the workspace concludes, while the claim holds the workspace for exactly
  // that batch: a deadlock by construction. The bonus batch then keeps its
  // historical standalone presentation — bounded and honest, never a wedge.
  // (A globalParameter source never matches a claim, so no self-match here.)
  const claimedSibling = drawnCardsState.events.some((e) =>
    !e.dismissed && e.cards.length - e.takenIndices.size > 0 &&
    workspaceClaimsRevealSource(e.source));
  if (claimedSibling) {
    return false;
  }
  return !boardWatchable() ||
    boardBeatParkState.heldParams !== undefined ||
    boardBeatParkState.heldClaims !== undefined ||
    boardBeatParkState.batchHeldByDrain;
}

/** Is a batch of this park's family pending right now (drives the drain)? */
function parkedBatchPending(): boolean {
  const ev = currentRevealEvent();
  return ev !== undefined && ev.source?.type === 'globalParameter';
}

/** Anything owed at all — the drain trigger's cheap pre-check. */
export function boardBeatParkPending(): boolean {
  return boardBeatParkState.heldParams !== undefined ||
    boardBeatParkState.heldClaims !== undefined ||
    (watchableProbe !== undefined && parkedBatchPending());
}

function schedule(run: () => void, ms: number): void {
  if (typeof setTimeout !== 'function') {
    run();
    return;
  }
  drainTimers.push(setTimeout(run, ms));
}

/**
 * DRAIN — the shell calls this on the «board watchable» rising edge (and
 * re-asks after every conclusion; idempotent). Causal order, each step
 * re-checking that the board is still watchable — a workspace re-opened
 * mid-drain simply re-parks what has not been released yet.
 */
export function drainBoardBeatsIfDue(): void {
  if (boardBeatParkState.draining || !boardBeatParkPending() || !boardWatchable()) {
    return;
  }
  clearDrainTimers();
  boardBeatParkState.draining = true;
  boardBeatParkState.nonce++;
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
  schedule(() => {
    if (!boardWatchable()) {
      // Covered again before anything released — everything stays held; the
      // next watchable edge re-runs the whole drain.
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
    const releaseBatch = () => {
      boardBeatParkState.batchHeldByDrain = false;
      boardBeatParkState.draining = false;
      endScaleStory();
      clearSafety();
    };
    if (parkedBatchPending()) {
      // The cover lifts only off a marker that has ARRIVED. No scale story →
      // no wait (a reload mid-park holds no values — the batch releases on
      // the settle alone).
      boardBeatParkState.batchHeldByDrain = true;
      schedule(releaseBatch, hadScaleStory ? consoleMotionMs(BOARD_BEAT_SCALE_MS) : 0);
    } else if (hadScaleStory) {
      // Values released with no batch behind them — the hold covers the
      // glide window so nothing lands on top of the moving scales.
      schedule(() => {
        boardBeatParkState.draining = false;
        endScaleStory();
        clearSafety();
      }, consoleMotionMs(BOARD_BEAT_SCALE_MS));
    } else {
      boardBeatParkState.draining = false;
      endScaleStory();
      clearSafety();
    }
  }, consoleMotionMs(BOARD_BEAT_SETTLE_MS));
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
  watchableProbe = undefined;
  redriveHook = undefined;
  liveParamsSource = undefined;
}
