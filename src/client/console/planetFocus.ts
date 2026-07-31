/*
 * PLANET FOCUS — the premium "the board becomes the stage" mode of a
 * main-grid tile placement (console-native only).
 *
 * When the active placement's WHOLE candidate set lives on the Mars grid
 * (no off-Mars colony slots), the shell enters PLANET FOCUS: the arc
 * scales and the off-Mars flanks recede (they are not part of this
 * decision), and the planet expands into the space they held — the fit
 * engine re-fits the board to the PLANET-ONLY footprint, and one CSS
 * transition carries the growth. The whole placement — cell choice, the
 * tile-flight hero, the printed-bonus / ocean-adjacency reward beats, the
 * board card-bonus cover lift — plays on this enlarged stage.
 *
 * THE SEQUENCING CONTRACT this module exists to enforce: the global
 * parameter scales may only MOVE after the interface has physically
 * returned to normal. The commit lands mid-scene (the tile hero holds it,
 * then the reward beats run post-commit), and the arc scales + top-HUD
 * readouts are value-driven — they would glide the instant the commit
 * flushed, invisible behind the receded arcs. So while focus is engaged
 * this module HOLDS THE DISPLAYED VALUES of the four global parameters
 * (`displayGlobalParams` — the board section and the status strip both
 * read through it), and releases them only after the exit transition has
 * seated the arcs back: release → the arc markers glide, the arc fills
 * advance, the HUD values flip, and the changed scale gets the one-shot
 * `con-scale-focus-<param>` accent (the Government-Support beat's own CSS,
 * extended with an oceans variant). The release window registers a
 * BLOCKING animation hold, so follow-up prompts and notifications wait for
 * the scales to finish their story.
 *
 * DEADLOCK GUARD (load-bearing): the hold is active ONLY during the exit
 * phases + the scale beat — never while the placement is live. The
 * `placement` admission policy waits on `presentation` (which folds
 * blocking holds), so a hold raised during `entering`/`active` would
 * suppress the very placement prompt this mode decorates.
 *
 * Phase geometry (the board section maps phases to classes; the CSS owns
 * the actual motion, so a mid-flight reversal is native):
 *
 *   idle ──enter──▶ entering ──settle/snap──▶ active
 *     ▲                                          │ exit
 *     │                                       exit-prep   (one frame:
 *     │                                          │         display restored,
 *     │                                          ▼         still faded)
 *     └── scale beat ◀── idle ◀──exiting◀────────┘
 *
 * `snapPlanetFocusSettled` is called by `armTilePlacement` so a confirm
 * that lands mid-enter snaps the geometry static BEFORE the hero measures
 * the target hex — the flight never aims at a moving board.
 *
 * DESKTOP SAFETY: only ConsoleShell drives enter/exit, so outside console
 * mode every read degrades to "no hold, live values, no classes".
 */

import {reactive} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {SpaceType} from '@/common/boards/SpaceType';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {AdmissionSignals} from '@/client/console/consolePromptAdmission';

/** The board-growth transition (the planet expands / returns). The landing
 *  is deliberately the LONGER of the two — the opening was asked for, the
 *  return was not, so it must not feel abrupt. Mirrors `--pfocus-ms`. */
export const PLANET_FOCUS_ENTER_MS = 640;
export const PLANET_FOCUS_EXIT_MS = 700;
/** Settle margin over the CSS transition before the settled state locks. */
const SETTLE_MARGIN_MS = 60;
/** The tail of the instruments' materialization: the CSS starts it INSIDE
 *  the landing (delayed ~300ms into a 700ms travel) so both come to rest
 *  together — this is the short window after the phase drops in which the
 *  band is still condensing. Nothing may move a scale, re-measure the board
 *  or take the foreground until it is over: a glide behind a half-formed
 *  band is exactly the wasted story this mode exists to prevent. */
export const PLANET_ARCS_RETURN_MS = 220;
/** The post-exit scale story: marker glide (≤1280) + the accent pulse tail. */
export const PLANET_SCALE_BEAT_MS = 1250;
/** A pending beat can never freeze the HUD — a stuck foreground releases
 *  the held values quietly after this ceiling. */
const BEAT_SAFETY_MS = 15000;

export type PlanetFocusPhase = 'idle' | 'entering' | 'active' | 'exit-prep' | 'exiting';

/** The four value-driven global parameters the arcs + top HUD display. */
export type HeldGlobalParams = {
  temperature: number,
  oxygenLevel: number,
  oceans: number,
  venusScaleLevel: number,
};

/** The html accent class suffix per changed parameter (shared CSS). */
const ACCENT_OF_PARAM: ReadonlyArray<{key: keyof HeldGlobalParams, accent: string}> = [
  {key: 'temperature', accent: 'temperature'},
  {key: 'oxygenLevel', accent: 'oxygen'},
  {key: 'oceans', accent: 'oceans'},
  {key: 'venusScaleLevel', accent: 'venus'},
];

export const planetFocusState = reactive({
  phase: 'idle' as PlanetFocusPhase,
  /**
   * The displayed-value freeze of the four global parameters, captured at
   * enter. While set, `displayGlobalParams` serves THESE to the board and
   * the status strip — a commit mid-scene changes nothing on screen until
   * the release lets the scales tell it.
   */
  heldParams: undefined as HeldGlobalParams | undefined,
  /**
   * The exit landed with parameter changes still untold — the scale beat
   * is owed. The SHELL fires it (`playPlanetFocusScaleBeat`) once the
   * world is quiet enough for the scales to be READ (its admission
   * signals know about reveals / card intakes / presentation): a card
   * placement exits UNDER the drawn-cards overlay, and gliding the arcs
   * behind it would waste the story.
   */
  beatPending: false,
  /**
   * The planet has landed and the INSTRUMENTS are fading back in. A short
   * beat of its own: the arcs are on screen but not yet solid, so no scale
   * may move through it (and nothing else may take the foreground either —
   * it is part of the hold).
   */
  arcsReturning: false,
  /** The arcs are back and the released values are gliding (accent window). */
  scaleBeat: false,
  /** Bumped per enter — lets the board section restart per-engagement work. */
  nonce: 0,
});

// The exit transition, the OWED beat and the beat itself own the
// foreground: follow-up prompts (via the presentation fold), announcements
// and notifications (the bot's story rides them) wait until the interface
// has returned AND the scales have moved. Never active during the live
// placement (see the deadlock guard above). `beatPending` is deliberately
// part of this hold: without it a follow-up modal or a bot-turn card would
// slip in during the quiet frame between the exit and the glide.
registerAnimationHoldSupplier('planet-focus', () =>
  planetFocusState.phase === 'exit-prep' ||
  planetFocusState.phase === 'exiting' ||
  planetFocusState.arcsReturning ||
  planetFocusState.beatPending ||
  planetFocusState.scaleBeat);

/**
 * May the OWED scale beat play right now? The scales must be READABLE: no
 * reveal overlay above the board, no cards mid-flight, no cover-lift
 * scene, no discard settling. Deliberately IGNORES `presentation` /
 * `anyAnimation` / `announceGate` — the pending beat is itself a blocking
 * hold (self-reference), and the announce must come AFTER the story it
 * announces around. PURE — the shell evaluates it against its one
 * admission-signal collection.
 */
export function planetFocusBeatAllowed(signals: AdmissionSignals): boolean {
  return planetFocusState.beatPending &&
    // …and the instruments the story is TOLD ON are actually back.
    !planetFocusState.arcsReturning &&
    !signals.revealOpen && !signals.revealPending &&
    !signals.cardArrival && !signals.boardBonus && !signals.cardDiscard;
}

/** The live committed values, read at release time (the shell registers —
 *  the playerView root identity changes per response, so the module can
 *  never hold a stale object reference). */
let liveParamsSource: (() => HeldGlobalParams) | undefined;

let settleTimer: number | undefined;
let exitPrepRaf: number | undefined;
let exitTimer: number | undefined;
let beatTimer: number | undefined;
let beatSafetyTimer: number | undefined;
let arcsTimer: number | undefined;

export function registerPlanetFocusParamsSource(source: () => HeldGlobalParams): () => void {
  liveParamsSource = source;
  return () => {
    if (liveParamsSource === source) {
      liveParamsSource = undefined;
    }
  };
}

/** Snapshot the four displayed parameters off a game model. */
export function captureGlobalParams(game: GameModel): HeldGlobalParams {
  return {
    temperature: game.temperature,
    oxygenLevel: game.oxygenLevel,
    oceans: game.oceans,
    venusScaleLevel: game.venusScaleLevel,
  };
}

/**
 * Does this placement qualify for Planet Focus? TRUE only when EVERY
 * candidate is a cell of the main Mars grid — an off-Mars colony slot
 * (Ganymede / Phobos / Stanford Torus / the Venus stations) or an id the
 * displayed board doesn't know (a Moon cell) keeps the full overview: the
 * mode must never hide a cell the player can actually pick.
 */
export function qualifiesForPlanetFocus(
  candidates: ReadonlyArray<SpaceId> | undefined,
  spaces: ReadonlyArray<SpaceModel> | undefined,
): boolean {
  if (candidates === undefined || candidates.length === 0 || spaces === undefined) {
    return false;
  }
  const byId = new Map(spaces.map((s) => [s.id, s]));
  return candidates.every((id) => {
    const space = byId.get(id);
    return space !== undefined && space.spaceType !== SpaceType.COLONY;
  });
}

/**
 * The parameters the board + status strip should DISPLAY right now: the
 * frozen snapshot while focus is engaged, the live values otherwise. ONE
 * read for both surfaces, so the arcs and the top HUD can never disagree.
 */
export function displayGlobalParams(game: GameModel): HeldGlobalParams {
  return planetFocusState.heldParams ?? captureGlobalParams(game);
}

/** The accent suffixes of the parameters that changed held → live. */
export function changedGlobalParams(held: HeldGlobalParams, live: HeldGlobalParams): Array<string> {
  return ACCENT_OF_PARAM.filter(({key}) => held[key] !== live[key]).map(({accent}) => accent);
}

/** TRUE while the mode visually owns the board (any non-idle phase). */
export function isPlanetFocusEngaged(): boolean {
  return planetFocusState.phase !== 'idle';
}

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * ENTER (the shell's target watcher). Captures the displayed parameter
 * snapshot ONCE per engagement — re-entering from a mid-exit reversal (a
 * chained second placement) keeps the original hold, so the final beat
 * tells the WHOLE chain's change in one glide.
 */
export function enterPlanetFocus(game: GameModel): void {
  if (planetFocusState.phase === 'entering' || planetFocusState.phase === 'active') {
    return;
  }
  clearExitTimers();
  if (planetFocusState.heldParams === undefined) {
    planetFocusState.heldParams = captureGlobalParams(game);
  }
  planetFocusState.nonce++;
  planetFocusState.phase = 'entering';
  clearTimer(settleTimer);
  settleTimer = schedule(() => {
    if (planetFocusState.phase === 'entering') {
      planetFocusState.phase = 'active';
    }
  }, consoleMotionMs(PLANET_FOCUS_ENTER_MS) + SETTLE_MARGIN_MS);
}

/**
 * SNAP to the settled state (called by `armTilePlacement`): a confirm that
 * lands mid-enter must finish the growth NOW — the hero captures the
 * target hex's live rect right after, and the flight may never aim at a
 * board that is still moving. The `--anim` class drops with the phase, so
 * the CSS transition releases and the transform lands in the same frame.
 */
export function snapPlanetFocusSettled(): void {
  if (planetFocusState.phase === 'entering') {
    clearTimer(settleTimer);
    settleTimer = undefined;
    planetFocusState.phase = 'active';
  }
}

/**
 * EXIT (the shell's target watcher — the field's whole story is over: the
 * placement resolved or was cancelled, the tile hero finished, the field
 * reward beats are done). Two-step so the receded elements can transition
 * back: `exit-prep` restores their display for one frame (still faded),
 * `exiting` runs the return transition, and the arrival releases the held
 * parameters into the SCALE BEAT — the one moment the scales move.
 */
export function beginPlanetFocusExit(): void {
  if (planetFocusState.phase === 'idle' || planetFocusState.phase === 'exit-prep' ||
      planetFocusState.phase === 'exiting') {
    return;
  }
  clearTimer(settleTimer);
  settleTimer = undefined;
  planetFocusState.phase = 'exit-prep';
  exitPrepRaf = nextFrame(() => {
    exitPrepRaf = undefined;
    if (planetFocusState.phase !== 'exit-prep') {
      return; // a reversal (chained placement) claimed the mode back
    }
    planetFocusState.phase = 'exiting';
    exitTimer = schedule(() => {
      exitTimer = undefined;
      if (planetFocusState.phase === 'exiting') {
        // The planet has landed. Dropping the phase is what lets the CSS
        // fade the instruments back in — so the beat of their return starts
        // exactly here, and the scale story waits it out.
        planetFocusState.phase = 'idle';
        planetFocusState.arcsReturning = true;
        arcsTimer = schedule(() => {
          arcsTimer = undefined;
          planetFocusState.arcsReturning = false;
        }, consoleMotionMs(PLANET_ARCS_RETURN_MS));
        settleExit();
      }
    }, consoleMotionMs(PLANET_FOCUS_EXIT_MS) + SETTLE_MARGIN_MS);
  });
}

/**
 * The exit LANDED. If nothing changed, the held values dissolve silently
 * (they equal the live ones — no glide, no beat, the hold drops with the
 * phase). If the placement moved a parameter, the beat is OWED
 * (`beatPending`) — the shell fires `playPlanetFocusScaleBeat` the moment
 * its admission signals say the scales can actually be read (no reveal
 * overlay, no cards in transit, no blocking presentation). A safety timer
 * bounds the wait: a stuck foreground releases the values quietly rather
 * than freezing the HUD forever.
 */
function settleExit(): void {
  const held = planetFocusState.heldParams;
  if (held === undefined || liveParamsSource === undefined) {
    planetFocusState.heldParams = undefined;
    return;
  }
  if (changedGlobalParams(held, liveParamsSource()).length === 0) {
    planetFocusState.heldParams = undefined;
    return;
  }
  planetFocusState.beatPending = true;
  clearTimer(beatSafetyTimer);
  beatSafetyTimer = schedule(() => {
    beatSafetyTimer = undefined;
    if (planetFocusState.beatPending) {
      // The foreground never freed — release honestly, without the show.
      planetFocusState.beatPending = false;
      planetFocusState.heldParams = undefined;
    }
  }, BEAT_SAFETY_MS);
}

/**
 * The SCALE BEAT (fired by the shell when the world is quiet): release the
 * held values so the arc markers glide / the arc fills advance / the HUD
 * flips, and pulse the changed scales with the shared
 * `con-scale-focus-<param>` accent. The beat keeps a BLOCKING hold up for
 * its window, so follow-up prompts, announcements and notifications wait
 * for the scales to finish their story.
 */
export function playPlanetFocusScaleBeat(): void {
  if (!planetFocusState.beatPending) {
    return;
  }
  planetFocusState.beatPending = false;
  clearTimer(beatSafetyTimer);
  beatSafetyTimer = undefined;
  const held = planetFocusState.heldParams;
  planetFocusState.heldParams = undefined;
  if (held === undefined || liveParamsSource === undefined) {
    return;
  }
  const changed = changedGlobalParams(held, liveParamsSource());
  if (changed.length === 0) {
    return;
  }
  planetFocusState.scaleBeat = true;
  applyAccentClasses(changed);
  clearTimer(beatTimer);
  beatTimer = schedule(() => {
    beatTimer = undefined;
    endScaleBeat();
  }, consoleMotionMs(PLANET_SCALE_BEAT_MS));
}

function endScaleBeat(): void {
  clearAccentClasses();
  planetFocusState.scaleBeat = false;
}

/** Drop everything (shell unmount / game switch / tests). No transitions,
 *  no beat — the next mount reads honest live values. */
export function resetPlanetFocus(): void {
  clearExitTimers();
  clearTimer(settleTimer);
  settleTimer = undefined;
  clearAccentClasses();
  planetFocusState.phase = 'idle';
  planetFocusState.heldParams = undefined;
  planetFocusState.arcsReturning = false;
  planetFocusState.scaleBeat = false;
}

// ── internals ───────────────────────────────────────────────────────────────

function applyAccentClasses(accents: ReadonlyArray<string>): void {
  if (typeof document === 'undefined') {
    return;
  }
  for (const accent of accents) {
    document.documentElement.classList.add('con-scale-focus-' + accent);
  }
}

function clearAccentClasses(): void {
  if (typeof document === 'undefined') {
    return;
  }
  for (const {accent} of ACCENT_OF_PARAM) {
    document.documentElement.classList.remove('con-scale-focus-' + accent);
  }
}

/**
 * Cancel every exit-side product (a reversal / reset): the prep frame, the
 * exit settle, a PENDING beat and a RUNNING beat. `heldParams` is left
 * alone on purpose — a chained placement re-claims the ORIGINAL hold, so
 * the final beat tells the whole chain's change in one glide.
 */
function clearExitTimers(): void {
  if (exitPrepRaf !== undefined) {
    cancelFrame(exitPrepRaf);
    exitPrepRaf = undefined;
  }
  clearTimer(exitTimer);
  exitTimer = undefined;
  clearTimer(beatTimer);
  beatTimer = undefined;
  clearTimer(beatSafetyTimer);
  beatSafetyTimer = undefined;
  clearTimer(arcsTimer);
  arcsTimer = undefined;
  planetFocusState.arcsReturning = false;
  planetFocusState.beatPending = false;
  endScaleBeat();
}

function schedule(run: () => void, ms: number): number | undefined {
  if (typeof window === 'undefined') {
    run();
    return undefined;
  }
  return window.setTimeout(run, ms);
}

function clearTimer(t: number | undefined): void {
  if (t !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(t);
  }
}

function nextFrame(run: () => void): number | undefined {
  if (typeof window === 'undefined') {
    run();
    return undefined;
  }
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(run);
  }
  return window.setTimeout(run, 16);
}

function cancelFrame(id: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (typeof window.requestAnimationFrame === 'function') {
    window.cancelAnimationFrame(id);
  } else {
    window.clearTimeout(id);
  }
}
