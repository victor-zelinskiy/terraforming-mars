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
 * THE SEQUENCING CONTRACT: the global parameter scales may only MOVE after
 * the interface has physically returned to normal. Since the ONE-OWNER
 * merge (presentation-reconciliation, mechanism C) the display freeze and
 * the post-exit scale story live in `boardBeatPark.ts` — the shell's
 * «board watchable» probe counts an engaged/returning Planet Focus as a
 * COVERED board, so a commit landing mid-scene seeds the park with the
 * pre-change values (first write wins — the drain glides from what the
 * player last SAW), and the park's drain plays the glide + the
 * `con-scale-focus-<param>` accents once the exit has seated the arcs
 * back. This module owns only the CAMERA: the phase machine, the arcs'
 * return beat, and the exit-transition hold.
 *
 * Phase geometry (the board section maps phases to classes; the CSS owns
 * the actual motion, so a mid-flight reversal is native):
 *
 *   idle ──enter──▶ entering ──settle/snap──▶ active
 *     ▲                                          │ exit
 *     │                                       exit-prep   (one frame:
 *     │                                          │         display restored,
 *     │                                          ▼         still faded)
 *     └────────── idle ◀──────exiting◀───────────┘
 *                   └─ arcsReturning beat, then the park's drain
 *
 * `snapPlanetFocusSettled` is called by `armTilePlacement` so a confirm
 * that lands mid-enter snaps the geometry static BEFORE the hero measures
 * the target hex — the flight never aims at a moving board.
 *
 * DESKTOP SAFETY: only ConsoleShell drives enter/exit, so outside console
 * mode every read degrades to "no hold, no classes".
 */

import {reactive} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {SpaceType} from '@/common/boards/SpaceType';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';

/** The board-growth transition (the planet expands / returns). The landing
 *  is deliberately the LONGER of the two — the opening was asked for, the
 *  return was not, so it must not feel abrupt. Mirrors `--pfocus-ms`. */
export const PLANET_FOCUS_ENTER_MS = 680;
export const PLANET_FOCUS_EXIT_MS = 760;
/** Settle margin over the CSS transition before the settled state locks. */
const SETTLE_MARGIN_MS = 60;
/** The tail of the instruments' materialization: the CSS starts it INSIDE
 *  the landing (delayed ~300ms into a 700ms travel) so both come to rest
 *  together — this is the short window after the phase drops in which the
 *  band is still condensing. Nothing may move a scale, re-measure the board
 *  or take the foreground until it is over: a glide behind a half-formed
 *  band is exactly the wasted story this mode exists to prevent. */
export const PLANET_ARCS_RETURN_MS = 260;

export type PlanetFocusPhase = 'idle' | 'entering' | 'active' | 'exit-prep' | 'exiting';

/** The four value-driven global parameters the arcs + top HUD display. */
export type HeldGlobalParams = {
  temperature: number,
  oxygenLevel: number,
  oceans: number,
  venusScaleLevel: number,
};

export const planetFocusState = reactive({
  phase: 'idle' as PlanetFocusPhase,
  /**
   * The planet has landed and the INSTRUMENTS are fading back in. A short
   * beat of its own: the arcs are on screen but not yet solid, so no scale
   * may move through it (and nothing else may take the foreground either —
   * it is part of the hold). The board-beat park's «watchable» verdict
   * counts it as covered, so the scale story waits it out by construction.
   */
  arcsReturning: false,
  /** Bumped per enter — lets the board section restart per-engagement work. */
  nonce: 0,
});

// The exit transition owns the foreground: follow-up prompts (via the
// presentation fold), announcements and notifications wait until the
// interface has returned. Never active during the live placement — the
// `placement` admission policy waits on `presentation`, so a hold raised
// during `entering`/`active` would suppress the very placement prompt this
// mode decorates. The scale story past the exit raises the park's own
// `board-beat-scale-story` hold.
registerAnimationHoldSupplier('planet-focus', () =>
  planetFocusState.phase === 'exit-prep' ||
  planetFocusState.phase === 'exiting' ||
  planetFocusState.arcsReturning);

let settleTimer: number | undefined;
let exitPrepRaf: number | undefined;
let exitTimer: number | undefined;
let arcsTimer: number | undefined;

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

/** TRUE while the mode visually owns the board (any non-idle phase). */
export function isPlanetFocusEngaged(): boolean {
  return planetFocusState.phase !== 'idle';
}

/**
 * The camera is IN MOTION (or the band still condensing) — a board story
 * (a scale glide, a drain, an automatic transition) must wait this out.
 * Deliberately excludes `active`: a fully-grown stage is stable geometry
 * and hosts the placement's own scenes.
 */
export function planetFocusSettling(): boolean {
  return planetFocusState.phase === 'entering' ||
    planetFocusState.phase === 'exit-prep' ||
    planetFocusState.phase === 'exiting' ||
    planetFocusState.arcsReturning;
}

// ── the lifecycle ───────────────────────────────────────────────────────────

/**
 * ENTER (the shell's target watcher). Re-entering from a mid-exit reversal
 * (a chained second placement) is a native reversal — the CSS transitions
 * live on base selectors. The display freeze needs no capture here: the
 * shell's watchable probe already counts an engaged mode as covered, so
 * any parameter change landing while focused seeds the board-beat park
 * with its pre-change value (first write wins — one glide tells the whole
 * chain's change on exit).
 */
export function enterPlanetFocus(): void {
  if (planetFocusState.phase === 'entering' || planetFocusState.phase === 'active') {
    return;
  }
  clearExitTimers();
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
 * `exiting` runs the return transition, and the landing starts the arcs'
 * own return beat. The scale story (held values gliding + accents) is the
 * board-beat park's: its watchable edge fires exactly when the arcs have
 * seated back.
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
        // fade the instruments back in — the return beat starts exactly
        // here, and the park's drain (the scale story) waits it out.
        planetFocusState.phase = 'idle';
        planetFocusState.arcsReturning = true;
        arcsTimer = schedule(() => {
          arcsTimer = undefined;
          planetFocusState.arcsReturning = false;
        }, consoleMotionMs(PLANET_ARCS_RETURN_MS));
      }
    }, consoleMotionMs(PLANET_FOCUS_EXIT_MS) + SETTLE_MARGIN_MS);
  });
}

/** Drop everything (shell unmount / game switch / tests). No transitions —
 *  the next mount reads honest live values. */
export function resetPlanetFocus(): void {
  clearExitTimers();
  clearTimer(settleTimer);
  settleTimer = undefined;
  planetFocusState.phase = 'idle';
  planetFocusState.arcsReturning = false;
}

// ── internals ───────────────────────────────────────────────────────────────

/** Cancel every exit-side product (a reversal / reset): the prep frame, the
 *  exit settle and the arcs' return beat. */
function clearExitTimers(): void {
  if (exitPrepRaf !== undefined) {
    cancelFrame(exitPrepRaf);
    exitPrepRaf = undefined;
  }
  clearTimer(exitTimer);
  exitTimer = undefined;
  clearTimer(arcsTimer);
  arcsTimer = undefined;
  planetFocusState.arcsReturning = false;
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
