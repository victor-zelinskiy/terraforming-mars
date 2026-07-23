/*
 * Gamepad core — the DOM shell around the pure poll model
 * (docs/GAMEPAD_SUPPORT_DESIGN.md §4.2).
 *
 * Owns: `gamepadconnected` / `gamepaddisconnected`, the poll loop (runs
 * ONLY while ≥1 pad is connected AND the document is visible), the
 * active-pad election (the last pad that produced activity), and intent
 * fan-out to subscribers (the focus engine, the debug overlay).
 *
 * ── THE POLL IS rAF + A TIMER, DELIBERATELY (load-bearing) ────────────
 * The Gamepad API does NOT buffer input: `getGamepads()` returns the state
 * AT READ TIME, and an edge is only seen by DIFFING two consecutive reads.
 * So a press+release that falls entirely BETWEEN two reads is invisible —
 * the intent is never born. With an rAF-only loop, any frame long enough to
 * span a tap (heavy raster/compositing on a big scene) silently EATS that
 * press: the classic "sometimes the first B press does nothing". rAF is
 * vsync-bound, so exactly when frames stretch is when presses go missing.
 * A `setInterval` is NOT vsync-bound, so it keeps sampling across a
 * stretched frame and catches the tap. Both drivers call the same
 * `pollOnce`, which is IDEMPOTENT (it diffs against the stored snapshot and
 * updates it), so double-driving can never double-fire an intent; the
 * hold-repeat cadence is time-based (`now`), not per-frame, so the higher
 * sample rate does not change its feel. NEVER reduce this back to rAF-only.
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
  electActivePad,
  emptySnapshot,
  initialPollState,
  readSnapshot,
  snapshotActivity,
} from '@/client/gamepad/gamepadPollModel';
import {gamepadDeadzone, gamepadEnabled} from '@/client/gamepad/gamepadSettings';
import {updateDetectedGlyphSet} from '@/client/gamepad/glyphSets';
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
let pollTimer = 0;
let connectedCount = 0;

/**
 * The timer poll's period. ~8ms (≈125Hz) — fast enough that no realistic tap
 * (~60ms+) can fall between two samples even while rAF is stretched, and
 * cheap because `pollOnce` early-outs at rest (the overwhelmingly common
 * case). See the module header for why a timer must back the rAF loop.
 */
const POLL_INTERVAL_MS = 8;
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
  return rafId !== 0 || pollTimer !== 0;
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
  // The non-vsync driver: keeps sampling while a frame is stretched, so a
  // tap can never fall between two reads (see the module header).
  pollTimer = window.setInterval(() => pollOnce(performance.now()), POLL_INTERVAL_MS);
}

function stopLoop(): void {
  if (!loopRunning() || typeof window === 'undefined') {
    return;
  }
  if (rafId !== 0) {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (pollTimer !== 0) {
    window.clearInterval(pollTimer);
    pollTimer = 0;
  }
}

/** One connected pad's contribution to a poll frame. */
type PadContribution = {index: number, id: string, active: boolean, intents: Array<GamepadIntent>};

function pollOnce(now: number): void {
  const pads = navigatorPads();
  const deadzone = gamepadDeadzone();

  // ── PASS 1: refresh EVERY connected pad, collect its intents, DON'T dispatch.
  // Diffing every pad each frame (not only the driving one) keeps every pad's
  // baseline current — a pad diffed against a stale snapshot when it later
  // becomes the driver would fire a burst of phantom edges. `engaged` collects
  // the non-idle pads so PASS 2 can elect exactly ONE driver.
  const engaged: Array<PadContribution> = [];
  for (const pad of pads) {
    if (pad === null || !pad.connected) {
      continue;
    }
    const next = readSnapshot(pad);
    const active = snapshotActivity(next, deadzone);

    // FIRST sighting of this pad (fresh page after a game-boundary reload, or a
    // just-woken pad): seed the baseline from the CURRENT state and emit NO
    // intents this frame. A button STILL HELD when the pad first appears is the
    // pad-wake gesture, never an action — an edge only counts once it is released
    // and pressed again. This is load-bearing: the game boundary is a full reload
    // (navigateWithCurtain), and the A that confirmed "exit to main menu" is
    // typically still down when the new page mounts. Without this seed, an empty
    // baseline reads that held A as a fresh `confirm` press on the freshly-loaded
    // main menu and auto-activates the focused item (Continue → bounced straight
    // back into the game — the "exit does nothing the 2nd time" bug). We still
    // let it enter the election (below) so a fresh pad becomes responsive; only
    // the stray press/nav intent is withheld (its intents list stays empty).
    if (!prevSnapshots.has(pad.index)) {
      prevSnapshots.set(pad.index, next);
      pollStates.set(pad.index, initialPollState());
      if (active) {
        engaged.push({index: pad.index, id: pad.id, active: true, intents: []});
      }
      continue;
    }

    const prev = prevSnapshots.get(pad.index) ?? emptySnapshot();
    const state = pollStates.get(pad.index) ?? initialPollState();

    // Idle early-out: nothing pressed now AND nothing was pressed before →
    // skip the diff entirely (the common case, every frame at rest).
    if (!active && !snapshotActivity(prev, deadzone)) {
      prevSnapshots.set(pad.index, next);
      continue;
    }

    const {intents, state: nextState} = diffSnapshots(prev, next, state, now, deadzone);
    prevSnapshots.set(pad.index, next);
    pollStates.set(pad.index, nextState);
    engaged.push({index: pad.index, id: pad.id, active, intents});
  }

  // ── PASS 2: elect exactly ONE driving pad (STICKY), then dispatch ONLY its
  // intents. This is the anti-double-dispatch rule for multi-pad hosts: Steam
  // Input on a Steam Machine exposes one physical controller as TWO mirrored
  // "standard" pads, and dispatching from both doubled every edge (a d-pad tap
  // skipped two rows; a toggle wheel opened-then-closed). See `electActivePad`.
  const elected = electActivePad(engaged, gamepadCoreState.activeIndex);
  const chosen = engaged.find((p) => p.index === elected);
  if (chosen !== undefined && elected !== gamepadCoreState.activeIndex) {
    gamepadCoreState.activeIndex = chosen.index;
    gamepadCoreState.activeId = chosen.id;
    updateDetectedGlyphSet(chosen.id);
  }
  if (chosen === undefined) {
    return;
  }
  // Any activity from the driving pad (re-)enters gamepad mode and re-arms the
  // pointer-exit hysteresis so slow desk drift can't accumulate — this fires
  // even on a fresh sighting that carries no intents (mode entry).
  if (chosen.active) {
    enterGamepadMode();
    resetPointerTravel();
  }
  for (const intent of chosen.intents) {
    for (const fn of intentListeners) {
      fn(intent);
    }
  }
}

function onConnected(e: GamepadEvent): void {
  connectedCount++;
  inputModeState.padsConnected = connectedCount;
  if (gamepadCoreState.activeIndex === -1) {
    gamepadCoreState.activeIndex = e.gamepad.index;
    gamepadCoreState.activeId = e.gamepad.id;
    updateDetectedGlyphSet(e.gamepad.id);
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
