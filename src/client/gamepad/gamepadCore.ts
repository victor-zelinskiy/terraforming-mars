/*
 * Gamepad core — the DOM shell around the pure poll model
 * (GAMEPAD_SUPPORT_DESIGN.md §4.2).
 *
 * Owns: `gamepadconnected` / `gamepaddisconnected`, the rAF poll loop
 * (runs ONLY while ≥1 pad is connected AND the document is visible), the
 * active-pad election (the last pad that produced activity), and intent
 * fan-out to subscribers (the focus engine, the debug overlay).
 *
 * Perf contract (invariant 8): the loop is DOM-free — it reads
 * `navigator.getGamepads()`, runs the pure model, and early-outs on idle
 * frames. All DOM work happens in intent SUBSCRIBERS, which fire only on
 * actual input. The loop is deliberately NOT frame-gated (input latency);
 * visual followers apply their own `createFrameGate()` discipline.
 *
 * The W3C privacy gesture-gate (pads are invisible to the page until a
 * button is pressed while the page is focused) is exactly our mode-entry
 * trigger — `gamepadconnected` firing IS the player picking up the pad.
 */

import {reactive} from 'vue';
import {
  GamepadIntent,
  GamepadSnapshot,
  PollState,
  diffSnapshots,
  emptySnapshot,
  initialPollState,
  readSnapshot,
  snapshotActivity,
} from '@/client/gamepad/gamepadPollModel';
import {gamepadDeadzone, gamepadEnabled} from '@/client/gamepad/gamepadSettings';
import {enterGamepadMode, exitGamepadMode, inputModeState, installInputModeWatchers, resetPointerTravel, uninstallInputModeWatchers} from '@/client/gamepad/inputModeState';

type IntentListener = (intent: GamepadIntent) => void;

export const gamepadCoreState = reactive({
  /** Index of the pad currently driving the UI (-1 = none elected yet). */
  activeIndex: -1,
  /** Pad id string for the debug overlay / connect toast. */
  activeId: '',
});

const intentListeners = new Set<IntentListener>();

/** Subscribe to semantic intents (returns an unsubscribe fn). */
export function onGamepadIntent(fn: IntentListener): () => void {
  intentListeners.add(fn);
  return () => intentListeners.delete(fn);
}

let installed = false;
let rafId = 0;
let connectedCount = 0;
const prevSnapshots = new Map<number, GamepadSnapshot>();
const pollStates = new Map<number, PollState>();

function navigatorPads(): ReadonlyArray<Gamepad | null> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return [];
  }
  try {
    return navigator.getGamepads();
  } catch (err) {
    return [];
  }
}

function loopRunning(): boolean {
  return rafId !== 0;
}

function startLoop(): void {
  if (loopRunning() || typeof window === 'undefined') {
    return;
  }
  const tick = (now: number) => {
    rafId = window.requestAnimationFrame(tick);
    pollOnce(now);
  };
  rafId = window.requestAnimationFrame(tick);
}

function stopLoop(): void {
  if (!loopRunning() || typeof window === 'undefined') {
    return;
  }
  window.cancelAnimationFrame(rafId);
  rafId = 0;
}

function pollOnce(now: number): void {
  const pads = navigatorPads();
  const deadzone = gamepadDeadzone();
  for (const pad of pads) {
    if (pad === null || !pad.connected) {
      continue;
    }
    const next = readSnapshot(pad);
    const prev = prevSnapshots.get(pad.index) ?? emptySnapshot();
    const state = pollStates.get(pad.index) ?? initialPollState();

    // Idle early-out: nothing pressed now AND nothing was pressed before →
    // skip the diff entirely (the common case, every frame at rest).
    const active = snapshotActivity(next, deadzone);
    if (!active && !snapshotActivity(prev, deadzone)) {
      prevSnapshots.set(pad.index, next);
      continue;
    }

    // Active-pad election: the last pad producing activity drives the UI.
    if (active && gamepadCoreState.activeIndex !== pad.index) {
      gamepadCoreState.activeIndex = pad.index;
      gamepadCoreState.activeId = pad.id;
    }

    const {intents, state: nextState} = diffSnapshots(prev, next, state, now, deadzone);
    prevSnapshots.set(pad.index, next);
    pollStates.set(pad.index, nextState);

    if (intents.length === 0 || pad.index !== gamepadCoreState.activeIndex) {
      continue;
    }
    // Any intent from the active pad (re-)enters gamepad mode and re-arms
    // the pointer-exit hysteresis so slow desk drift can't accumulate.
    enterGamepadMode();
    resetPointerTravel();
    for (const intent of intents) {
      for (const fn of intentListeners) {
        fn(intent);
      }
    }
  }
}

function onConnected(e: GamepadEvent): void {
  connectedCount++;
  inputModeState.padsConnected = connectedCount;
  if (gamepadCoreState.activeIndex === -1) {
    gamepadCoreState.activeIndex = e.gamepad.index;
    gamepadCoreState.activeId = e.gamepad.id;
  }
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    startLoop();
  }
}

function onDisconnected(e: GamepadEvent): void {
  connectedCount = Math.max(0, connectedCount - 1);
  inputModeState.padsConnected = connectedCount;
  prevSnapshots.delete(e.gamepad.index);
  pollStates.delete(e.gamepad.index);
  if (e.gamepad.index === gamepadCoreState.activeIndex) {
    // The driving pad went away: drop to pointer mode (graceful — the W3C
    // disconnect story) and let any remaining pad re-elect itself on its
    // next input.
    gamepadCoreState.activeIndex = -1;
    gamepadCoreState.activeId = '';
    exitGamepadMode();
  }
  if (connectedCount === 0) {
    stopLoop();
  }
}

function onVisibilityChange(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.visibilityState === 'visible') {
    if (connectedCount > 0) {
      startLoop();
    }
  } else {
    stopLoop();
  }
}

/**
 * Install once at App bootstrap. A no-op (subsystem fully inert) when the
 * `?gp=0` kill switch / `gamepad_enabled` preference disables it, or when
 * the environment has no Gamepad API (JSDOM).
 */
export function installGamepadCore(): void {
  if (installed || typeof window === 'undefined' || !gamepadEnabled()) {
    return;
  }
  installed = true;
  installInputModeWatchers();
  window.addEventListener('gamepadconnected', onConnected);
  window.addEventListener('gamepaddisconnected', onDisconnected);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // Pads connected BEFORE page load only surface after a button press (the
  // privacy gate), so the connect listener is sufficient — but if the API
  // already reports pads (e.g. after a soft reload), pick them up now.
  for (const pad of navigatorPads()) {
    if (pad !== null && pad.connected) {
      connectedCount++;
    }
  }
  inputModeState.padsConnected = connectedCount;
  if (connectedCount > 0) {
    startLoop();
  }
}

export function uninstallGamepadCore(): void {
  if (!installed || typeof window === 'undefined') {
    return;
  }
  installed = false;
  stopLoop();
  window.removeEventListener('gamepadconnected', onConnected);
  window.removeEventListener('gamepaddisconnected', onDisconnected);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  prevSnapshots.clear();
  pollStates.clear();
  connectedCount = 0;
  inputModeState.padsConnected = 0;
  // Leaving the game screen: drop back to pointer presentation and remove
  // the exit watchers — the subsystem is fully inert until re-installed.
  exitGamepadMode();
  uninstallInputModeWatchers();
}
