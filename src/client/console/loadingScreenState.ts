/*
 * SCENE TRANSITION DIRECTOR — the console-native lifecycle of every screen
 * boundary (menu ⇄ game ⇄ campaign). Reworked from the P10 loading curtain
 * into a real readiness-gated state machine.
 *
 * The GAME BOUNDARY stays a deliberate full reload (App.navigateInApp doc:
 * a fresh page guarantees clean per-game module state — five board baseline
 * modules and the notification ledgers depend on it). This module makes the
 * boundary a DIRECTED SCENE instead of a raw reload:
 *
 *   idle → covering → revealing → idle          (+ the error/retry state)
 *
 *  - `navigateWithCurtain(url, stage, context)` raises the curtain FIRST
 *    (one painted frame — the double-rAF), hands the typed context to the
 *    NEXT page via sessionStorage (including the press timestamp, so the
 *    text policy spans the reload), then navigates. The player never sees
 *    the outgoing page tear down.
 *  - On the next page App reads `consumeBootFlags()` during mount — BEFORE
 *    the first route resolution — so the curtain is up from the very first
 *    Vue paint.
 *  - THE CURTAIN NEVER DROPS ON «data arrived». A destination screen owns
 *    its own visual readiness: it registers HOLDS (`deferSceneReveal`) and
 *    ARMS itself (`armSceneDestination`); the reveal happens only when the
 *    destination is armed, every hold is released, and the frame has been
 *    SETTLED (two probe ticks with the conditions re-verified after them).
 *    Route resolution only reports itself (`noteScreenResolved`); legacy
 *    screens that never learned the contract reveal immediately, readiness-
 *    aware ones wait — with a bounded watchdog, because an unbounded hold
 *    is a hang, not a ceremony.
 *  - TEXT POLICY: a load that finishes fast shows NO text at all (a status
 *    line that exists for 200 ms is a flash, not information). The status
 *    block appears only after `TEXT_APPEAR_MS` of covering, and once shown
 *    it is held readable (`TEXT_MIN_DWELL_MS`) before the reveal may start.
 *  - Every hold is BOUNDED and names itself; stale releases are epoch-
 *    guarded; a second navigation while one is departing is ignored.
 *
 * `fullscreenLost` drives the RESTORE prompt inside the curtain: a browser
 * drops fullscreen on navigation BY SPEC. Inside Electron the window
 * fullscreen survives the reload natively.
 *
 * Module-level reactive — survives the playerkey epoch like every other
 * console state.
 */

import {reactive} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {probeTick} from '@/client/console/probeTick';

const BOOT_FLAG = 'tm_boot_curtain';
const FS_FLAG = 'tm_fs_restore';

/** Legacy stage vocabulary — kept as the call sites' shorthand; each stage
 *  maps to a default transition context (see `contextForStage`). */
export type LoadingStage =
  | 'expedition' // leaving for a new game
  | 'sync' // re-entering an existing game / opening a settled one
  | 'map' // legacy alias (unused by new callers)
  | 'draft' // legacy alias (unused by new callers)
  | 'interface' // leaving a game for the menu
  | 'controls'; // legacy alias (unused by new callers)

/** What the transition is ABOUT — drives the curtain's composition. */
export type TransitionContextKind =
  | 'new-game'
  | 'resume-game'
  | 'campaign-mission'
  | 'campaign-map'
  | 'main-menu';

export type TransitionContext = {
  kind: TransitionContextKind;
  /** Campaign mission being entered (1-based), when known. */
  mission?: number;
  /** Total missions of the campaign, when known. */
  missionCount?: number;
  /** campaign-mission only: re-entering a mission already underway. */
  resume?: boolean;
};

export type SceneTransitionPhase = 'idle' | 'covering' | 'revealing';

// ── Timing (base ms; motion-scaled at schedule time) ────────────────────────
/** Status text appears only after this much covering — a faster load shows
 *  no text at all (the anti-flash rule). */
export const TEXT_APPEAR_MS = 900;
/** Once shown, the status text is held readable before the reveal starts. */
export const TEXT_MIN_DWELL_MS = 1150;
/** A genuinely long wait swaps the status line to the long-wait phrasing. */
export const LONG_WAIT_MS = 9000;
/** The curtain's reveal dissolve — MUST mirror `.con-load-fade-leave-active`. */
export const REVEAL_MS = 620;
/** A hold that was never released is a bug, not a ceremony. */
export const DEFAULT_HOLD_MAX_MS = 12000;
/** Screen resolved to a readiness-aware destination that never armed. */
export const ARM_WATCHDOG_MS = 10000;
/** Covering with no route resolution at all — a hung boot fetch. */
export const BOOT_STALL_MS = 45000;

/** Screens whose destination components implement the readiness contract
 *  (they call `armSceneDestination()`); every other screen reveals the moment
 *  it resolves — the legacy behaviour, correct for screens with no boot work. */
const READINESS_AWARE_SCREENS: ReadonlySet<string> = new Set(['player-home', 'main-menu', 'campaign']);

export const loadingScreenState = reactive({
  active: false,
  phase: 'idle' as SceneTransitionPhase,
  /** A failed load — the curtain becomes the premium error/retry state. */
  error: '' as string,
  /** The previous page was fullscreen → offer the gesture-based restore. */
  fullscreenLost: false,
  /** What this transition is about (curtain composition). */
  context: undefined as TransitionContext | undefined,
  /** The status block is visible (appears only past TEXT_APPEAR_MS). */
  textShown: false,
  /** The wait is genuinely long — the status line changes phrasing. */
  longWait: false,
});

// ── Test seam: the director's clock/scheduler is injectable ────────────────
type SceneScheduler = {
  now(): number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  /** One settled-paint tick (rAF with a timer fallback — see probeTick). */
  settle(fn: () => void): void;
};

const realScheduler: SceneScheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => clearTimeout(id as never),
  settle: probeTick,
};

let sched: SceneScheduler = realScheduler;

/** TEST ONLY — replace the scheduler (returns the restore function). */
export function setSceneTransitionSchedulerForTest(s: SceneScheduler): () => void {
  sched = s;
  return () => {
    sched = realScheduler;
  };
}

// ── Director internals (non-reactive) ──────────────────────────────────────
/** Stale-async guard: every scheduled callback captures the epoch. */
let epoch = 0;
let coverT0 = 0;
let textShownAt = 0;
let armed = false;
let screenState: 'none' | 'aware' | 'unaware' = 'none';
let settling = false;
let navPending = false;
const holds = new Map<string, number>(); // name → bound-timer id
const timers = new Set<number>();
let revealedCallbacks: Array<() => void> = [];

function schedule(ms: number, fn: () => void): number {
  const at = epoch;
  const id = sched.setTimeout(() => {
    timers.delete(id);
    if (at === epoch) {
      fn();
    }
  }, ms);
  timers.add(id);
  return id;
}

function clearAllTimers(): void {
  for (const id of timers) {
    sched.clearTimeout(id);
  }
  timers.clear();
  for (const id of holds.values()) {
    sched.clearTimeout(id);
  }
  holds.clear();
}

function resetMachine(): void {
  epoch++;
  clearAllTimers();
  armed = false;
  screenState = 'none';
  settling = false;
  textShownAt = 0;
  revealedCallbacks = [];
}

function contextForStage(stage: LoadingStage): TransitionContext {
  switch (stage) {
  case 'expedition':
    return {kind: 'new-game'};
  case 'interface':
    return {kind: 'main-menu'};
  default:
    return {kind: 'resume-game'};
  }
}

// ── The lifecycle ──────────────────────────────────────────────────────────

/**
 * Raise the curtain. `t0` (when given — the boot handoff) is the ORIGINAL
 * press timestamp from the departing page, so the text-appearance policy
 * counts the whole boundary, not just this page's share of it.
 */
export function beginLoading(stage: LoadingStage = 'sync', context?: TransitionContext, t0?: number): void {
  resetMachine();
  loadingScreenState.active = true;
  loadingScreenState.phase = 'covering';
  loadingScreenState.error = '';
  loadingScreenState.context = context ?? contextForStage(stage);
  loadingScreenState.textShown = false;
  loadingScreenState.longWait = false;
  coverT0 = t0 ?? sched.now();
  const elapsed = Math.max(0, sched.now() - coverT0);
  // The status block appears only if the wait is real; once shown it is held
  // readable by the dwell rule inside maybeReveal().
  schedule(Math.max(0, motionMs(TEXT_APPEAR_MS) - elapsed), () => {
    if (loadingScreenState.phase === 'covering') {
      loadingScreenState.textShown = true;
      textShownAt = sched.now();
    }
  });
  schedule(Math.max(0, motionMs(LONG_WAIT_MS) - elapsed), () => {
    if (loadingScreenState.phase === 'covering') {
      loadingScreenState.longWait = true;
    }
  });
  // A boot whose route never resolves is a hung fetch — become the error
  // state instead of an infinite atmosphere loop.
  schedule(BOOT_STALL_MS, () => {
    if (loadingScreenState.phase === 'covering' && screenState === 'none') {
      failLoading('Error getting game data');
    }
  });
}

/**
 * Route resolution reports itself (App's `screen` watcher). This NEVER drops
 * the curtain by itself for a readiness-aware destination — it only starts
 * the arm watchdog; a legacy screen reveals right away (it has no boot work).
 */
export function noteScreenResolved(screen: string): void {
  if (!loadingScreenState.active || loadingScreenState.phase !== 'covering' || loadingScreenState.error !== '') {
    return;
  }
  if (screenState !== 'none') {
    return;
  }
  screenState = READINESS_AWARE_SCREENS.has(screen) ? 'aware' : 'unaware';
  if (screenState === 'aware') {
    schedule(ARM_WATCHDOG_MS, () => {
      if (loadingScreenState.phase === 'covering' && !armed) {
        console.warn('[scene-transition] destination never armed — revealing anyway');
        armed = true;
        holds.clear();
        maybeReveal();
      }
    });
  }
  maybeReveal();
}

/**
 * The destination declares «I am mounted and every hold I need is
 * registered». Registering holds BEFORE arming is the contract — an armed
 * destination with zero holds is considered visually ready (modulo settle).
 */
export function armSceneDestination(): void {
  if (!loadingScreenState.active || loadingScreenState.phase !== 'covering') {
    return;
  }
  armed = true;
  maybeReveal();
}

/**
 * Register a named readiness hold. Returns the release function. Every hold
 * is BOUNDED: past `maxMs` it force-releases with a dev warning — a curtain
 * that never lifts is strictly worse than one that lifts a beat early.
 */
export function deferSceneReveal(name: string, maxMs: number = DEFAULT_HOLD_MAX_MS): () => void {
  if (!loadingScreenState.active || loadingScreenState.phase !== 'covering') {
    return () => {};
  }
  const at = epoch;
  let key = name;
  for (let i = 2; holds.has(key); i++) {
    key = `${name}#${i}`;
  }
  const release = () => {
    const boundTimer = holds.get(key);
    if (at !== epoch || boundTimer === undefined) {
      return;
    }
    sched.clearTimeout(boundTimer);
    holds.delete(key);
    maybeReveal();
  };
  const boundId = sched.setTimeout(() => {
    if (at === epoch && holds.has(key)) {
      console.warn(`[scene-transition] hold "${key}" hit its ${maxMs}ms bound — force-released`);
      holds.delete(key);
      maybeReveal();
    }
  }, maxMs);
  holds.set(key, boundId);
  return release;
}

function readyNow(): boolean {
  if (!loadingScreenState.active || loadingScreenState.phase !== 'covering' || loadingScreenState.error !== '') {
    return false;
  }
  if (screenState === 'none') {
    return false;
  }
  if (screenState === 'aware' && (!armed || holds.size > 0)) {
    return false;
  }
  return true;
}

function maybeReveal(): void {
  if (!readyNow() || settling) {
    return;
  }
  // The dwell rule: text that was shown must have been readable.
  if (loadingScreenState.textShown) {
    const dwellLeft = textShownAt + motionMs(TEXT_MIN_DWELL_MS) - sched.now();
    if (dwellLeft > 0) {
      schedule(dwellLeft, maybeReveal);
      return;
    }
  }
  // SETTLE: two painted frames, then RE-verify — a hold registered while we
  // were settling (a late-mounting surface) postpones the reveal honestly.
  settling = true;
  const at = epoch;
  sched.settle(() => sched.settle(() => {
    if (at !== epoch) {
      return;
    }
    settling = false;
    if (!readyNow()) {
      return; // the releasing hold will re-trigger maybeReveal
    }
    startReveal();
  }));
}

function startReveal(): void {
  loadingScreenState.phase = 'revealing';
  const cbs = revealedCallbacks;
  revealedCallbacks = [];
  for (const cb of cbs) {
    try {
      cb();
    } catch (e) {
      console.warn('[scene-transition] onSceneRevealed callback failed', e);
    }
  }
  schedule(motionMs(REVEAL_MS), () => endLoading());
}

/** Tear the curtain down (also the terminal step of a finished reveal). */
export function endLoading(): void {
  resetMachine();
  loadingScreenState.active = false;
  loadingScreenState.phase = 'idle';
  loadingScreenState.error = '';
  loadingScreenState.context = undefined;
  loadingScreenState.textShown = false;
  loadingScreenState.longWait = false;
}

export function failLoading(message: string): void {
  resetMachine();
  navPending = false;
  loadingScreenState.active = true;
  loadingScreenState.phase = 'covering';
  loadingScreenState.error = message;
  // The error is information the player must read — no appear delay.
  loadingScreenState.textShown = true;
}

/**
 * One-shot «the destination is being revealed» subscription — for surfaces
 * whose own opening cinematic must start AT the reveal, not under the
 * curtain (the campaign map's creation reveal). Called immediately when no
 * transition is in flight.
 */
export function onSceneRevealed(cb: () => void): void {
  if (!loadingScreenState.active || loadingScreenState.phase === 'revealing') {
    cb();
    return;
  }
  revealedCallbacks.push(cb);
}

/**
 * The ONE gameplay-input gate of a transition: while the curtain owns the
 * frame, console intents are swallowed centrally (consoleRouter) so a
 * buffered press can never drive the invisible scene underneath. The
 * curtain's own retry / fullscreen buttons ride the DOM focus engine
 * (scope `loadingScreen`) and are not affected.
 */
export function sceneTransitionInputLocked(): boolean {
  return loadingScreenState.active && loadingScreenState.error === '';
}

export function clearFullscreenLost(): void {
  loadingScreenState.fullscreenLost = false;
}

// ── The game-boundary navigation ───────────────────────────────────────────

/**
 * Curtain up → typed context + press timestamp handed to the next page →
 * hard navigate (the deliberate reload). The double-rAF guarantees the
 * curtain actually PAINTS before the browser tears the page down. A repeat
 * command while one navigation is departing is ignored deterministically.
 */
export function navigateWithCurtain(url: string, stage: LoadingStage = 'expedition', context?: TransitionContext): void {
  if (navPending) {
    return;
  }
  navPending = true;
  const t0 = Date.now();
  beginLoading(stage, context, t0);
  try {
    sessionStorage.setItem(BOOT_FLAG, JSON.stringify({stage, context: loadingScreenState.context, t0}));
    if (typeof document !== 'undefined' && document.fullscreenElement !== null) {
      sessionStorage.setItem(FS_FLAG, '1');
    }
  } catch {
    // sessionStorage unavailable — the next page just boots without the handoff.
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.location.assign(url);
  }));
}

export type BootFlags = {
  stage: LoadingStage;
  context?: TransitionContext;
  t0?: number;
};

/**
 * Read + CLEAR the boot handoff (called once from App.mounted, before the
 * first route resolution). Returns the flags to open the curtain with, or
 * undefined when this is a plain page load.
 */
export function consumeBootFlags(): BootFlags | undefined {
  try {
    const raw = sessionStorage.getItem(BOOT_FLAG);
    const fs = sessionStorage.getItem(FS_FLAG);
    sessionStorage.removeItem(BOOT_FLAG);
    sessionStorage.removeItem(FS_FLAG);
    if (fs === '1' && typeof document !== 'undefined' && document.fullscreenElement === null) {
      loadingScreenState.fullscreenLost = true;
    }
    if (raw === null) {
      return undefined;
    }
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as BootFlags;
      return {stage: parsed.stage ?? 'sync', context: parsed.context, t0: parsed.t0};
    }
    // A legacy plain-string flag from a pre-rework page (mixed-version edge).
    return {stage: raw as LoadingStage};
  } catch {
    return undefined;
  }
}

// ── The ONE exit funnel ────────────────────────────────────────────────────

let exitTarget: {url: string; stage: LoadingStage; context: TransitionContext} | undefined;

/**
 * The in-game shell registers where «выйти из партии» actually leads: the
 * main menu for an ordinary game, the campaign map for a campaign mission.
 * Every exit door (system menu, corner button) goes through `exitGameToMenu`
 * so the destination can never diverge between doors.
 */
export function registerGameExitTarget(url: string, context: TransitionContext, stage: LoadingStage = 'interface'): void {
  exitTarget = {url, stage, context};
}

export function clearGameExitTarget(): void {
  exitTarget = undefined;
}

export function exitGameToMenu(): void {
  const t = exitTarget ?? {url: '/', stage: 'interface' as LoadingStage, context: {kind: 'main-menu' as TransitionContextKind}};
  navigateWithCurtain(t.url, t.stage, t.context);
}

/** TEST ONLY — full reset of the module state between specs. */
export function resetSceneTransitionForTest(): void {
  resetMachine();
  navPending = false;
  exitTarget = undefined;
  loadingScreenState.active = false;
  loadingScreenState.phase = 'idle';
  loadingScreenState.error = '';
  loadingScreenState.fullscreenLost = false;
  loadingScreenState.context = undefined;
  loadingScreenState.textShown = false;
  loadingScreenState.longWait = false;
}
