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
  ElectionState,
  GamepadIntent,
  GamepadSnapshot,
  PollState,
  decisiveEdge,
  diffSnapshots,
  electActivePad,
  emptySnapshot,
  initialElectionState,
  initialPollState,
  pollStatePending,
  readSnapshot,
  snapshotActivity,
} from '@/client/gamepad/gamepadPollModel';
import {gamepadDeadzone, gamepadEnabled} from '@/client/gamepad/gamepadSettings';
import {installNativePadBridge, nativePads, onNativePadCountChange, setNativePadsWanted} from '@/client/gamepad/nativePadBridge';
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
let offNativePads: (() => void) | undefined;
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
let election: ElectionState = initialElectionState();

/**
 * FIELD DIAGNOSTICS — deliberately always on, deliberately tiny.
 *
 * "The pad works in other games but not here" is unanswerable from a normal
 * log: the page either never saw the device (a platform/Steam-Input problem,
 * nothing we can fix in JS) or saw it and dropped its intents (ours). These
 * lines separate those two worlds on the FIRST report, with no special build
 * and no `?gpDebug` URL the packaged shell cannot even reach. They fire only on
 * rare events — connect, disconnect, a change of driver, and a throttled
 * "someone else is pressing buttons" — so the poll loop stays DOM-free and
 * allocation-free at rest (perf invariant 8). The Electron main process
 * forwards `[gamepad]` lines to stdout, where the Steam Deck wrapper's
 * redirect captures them (electron/consoleExport.ts).
 */
function gpLog(message: string): void {
  try {
    console.log(`[gamepad] ${message}`);
  } catch (err) {
    // A console-less host must never break input.
  }
}

/** Everything the poll loop reads off a pad — satisfied by `Gamepad` AND by a
 *  native pad, so the loop below never learns which source it is driving. */
type PollablePad = {
  index: number,
  id: string,
  connected: boolean,
  buttons: ReadonlyArray<{pressed: boolean, value: number}>,
  axes: ReadonlyArray<number>,
};

/** One pad, described for the log: everything needed to tell devices apart. */
function describePad(pad: PollablePad): string {
  const mapping = (pad as {mapping?: string}).mapping;
  return `#${pad.index} "${pad.id}" mapping=${mapping === undefined ? 'native' : mapping || 'none'} ` +
    `buttons=${pad.buttons.length} axes=${pad.axes.length}`;
}

/** The FULL slot table as the page currently sees it (null slots included). */
function describeAllPads(): string {
  const pads = navigatorPads();
  const seen = pads
    .map((pad, slot) => pad === null ? `#${slot} —` : describePad(pad))
    .join(' | ');
  return `slots=${pads.length}${padsFromNative ? ' (NATIVE — Gamepad API is empty)' : ''} [${seen}]`;
}

function chromiumPads(): ReadonlyArray<Gamepad | null> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return [];
  }
  try {
    return navigator.getGamepads();
  } catch (err) {
    return [];
  }
}

/**
 * Which source the LAST `navigatorPads()` call answered from. Published as a
 * flag rather than recomputed, so nothing has to call `getGamepads()` twice per
 * poll just to ask "which source is this?".
 */
let padsFromNative = false;
/**
 * Has Chromium's own fetcher PROVEN it works, by reporting a connected pad?
 * Distinct from `!padsFromNative`: before the first button press Chromium hides
 * pads, so "no Chromium pads" is not evidence of anything. Only the positive
 * form is safe to act on — see `syncNativePadsWanted`.
 */
let chromiumHasPads = false;

function navigatorPads(): ReadonlyArray<PollablePad | null> {
  const pads = chromiumPads();
  for (const pad of pads) {
    if (pad !== null && pad.connected) {
      chromiumHasPads = true;
      padsFromNative = false;
      return pads;
    }
  }
  chromiumHasPads = false;
  padsFromNative = nativePads().length > 0;
  return nativePads();
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
type PadContribution = {index: number, id: string, active: boolean, edge: boolean, intents: Array<GamepadIntent>};

/** Rate limit for the "a non-driving pad is being pressed" diagnostic. */
const SUPPRESSED_LOG_INTERVAL_MS = 3000;
let suppressedLoggedAt = 0;
/**
 * Rate limit for driver changes. Where Steam Input mirrors one controller onto
 * two devices (the measured Steam Deck set-up: a raw pad plus its virtual twin),
 * the two nodes deliver the same press in different poll frames, so the wheel
 * legitimately changes hands about once per press. Input stays correct — the
 * loser's edges are dropped — but logging every one of them would bloat the
 * shared Steam log over a long session. Collapsed changes are COUNTED, never
 * silently dropped: a churn that matters still shows up as a number.
 */
const DRIVER_LOG_INTERVAL_MS = 5000;
let driverLoggedAt = Number.NEGATIVE_INFINITY;
let driverChangesSinceLog = 0;
/** Which source the previous poll frame read, to notice a HANDOVER between them. */
let sourceWasNative = false;
/** Last suppression state sent to main (undefined = nothing sent yet). */
let nativePadsWantedSent: boolean | undefined;

/**
 * Keep the main process's native pad stream switched off while Chromium's own
 * API is doing the job — on a Steam Machine that is every frame of every game,
 * and each one would otherwise carry an IPC message straight into the bin.
 * Sent only on CHANGE, so this costs one boolean compare per poll.
 */
function syncNativePadsWanted(): void {
  const wanted = !chromiumHasPads;
  if (wanted !== nativePadsWantedSent) {
    nativePadsWantedSent = wanted;
    setNativePadsWanted(wanted);
  }
}

function pollOnce(now: number): void {
  const pads = navigatorPads();
  const deadzone = gamepadDeadzone();
  syncNativePadsWanted();

  // ── SOURCE HANDOVER (matters on a platform whose Gamepad API WORKS) ────────
  // Chromium hides pads until the first button press (the privacy gate), so a
  // healthy Linux host — a Steam Machine, say — starts a session on the native
  // source and switches to Chromium's the instant that first press opens the
  // gate. Both sources index pads from 0, so without this the baseline stored
  // for native pad #0 would be diffed against CHROMIUM pad #0: two different
  // views of the device, with different button counts and possibly different
  // states, producing a burst of phantom press/release intents — at the worst
  // possible moment, the very first press of the session. Dropping the
  // baselines re-seeds them, and the first-sighting rule emits nothing.
  if (padsFromNative !== sourceWasNative) {
    sourceWasNative = padsFromNative;
    prevSnapshots.clear();
    pollStates.clear();
    election = initialElectionState();
    gamepadCoreState.activeIndex = -1;
    gamepadCoreState.activeId = '';
    gpLog(`source → ${padsFromNative ? 'NATIVE (Gamepad API empty)' : 'Chromium Gamepad API'} — ${describeAllPads()}`);
  }

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
        engaged.push({index: pad.index, id: pad.id, active: true, edge: false, intents: []});
      }
      continue;
    }

    const prev = prevSnapshots.get(pad.index) ?? emptySnapshot();
    const state = pollStates.get(pad.index) ?? initialPollState();

    // Idle early-out: nothing pressed now AND nothing was pressed before AND
    // no protocol is mid-flight in the carry state → skip the diff entirely
    // (the common case, every frame at rest). `pollStatePending` keeps the
    // diff alive through the aim protocol's neutral-confirm window — the
    // stick already reads at-rest there, but the commit edge (`aimEnd`)
    // still needs a few more frames to fire.
    if (!active && !snapshotActivity(prev, deadzone) && !pollStatePending(state)) {
      prevSnapshots.set(pad.index, next);
      continue;
    }

    const {intents, state: nextState} = diffSnapshots(prev, next, state, now, deadzone);
    prevSnapshots.set(pad.index, next);
    pollStates.set(pad.index, nextState);
    engaged.push({index: pad.index, id: pad.id, active, edge: decisiveEdge(intents), intents});
  }

  // ── PASS 2: elect exactly ONE driving pad, then dispatch ONLY its intents.
  // This is the anti-double-dispatch rule for multi-pad hosts: Steam Input on a
  // Steam Machine exposes one physical controller as TWO mirrored "standard"
  // pads, and dispatching from both doubled every edge (a d-pad tap skipped two
  // rows; a toggle wheel opened-then-closed). Incumbency follows who is ACTING,
  // not who looks busy — a pad resting off-centre must not be able to hold the
  // wheel against a controller someone is actually pressing. See `electActivePad`.
  const previous = election.index;
  election = electActivePad(engaged, election, now);
  const chosen = engaged.find((p) => p.index === election.index);
  if (chosen !== undefined && election.index !== previous) {
    gamepadCoreState.activeIndex = chosen.index;
    gamepadCoreState.activeId = chosen.id;
    updateDetectedGlyphSet(chosen.id);
    driverChangesSinceLog++;
    if (now - driverLoggedAt >= DRIVER_LOG_INTERVAL_MS) {
      const collapsed = driverChangesSinceLog - 1;
      driverLoggedAt = now;
      driverChangesSinceLog = 0;
      gpLog(`driver → #${chosen.index} "${chosen.id}" (was #${previous})` +
        (collapsed > 0 ? ` — ${collapsed} more change(s) collapsed` : ''));
    }
  }
  if (chosen === undefined) {
    return;
  }

  // The smoking gun for "my other controller does nothing": a pad DID act this
  // frame and is not the one driving. Expected briefly for a Steam Input mirror
  // of the pad in your hands; sustained, it means real input is being dropped.
  // (Throttle window checked FIRST — a plain number compare, so the common
  // "someone is playing normally" frame allocates nothing here.)
  if (now - suppressedLoggedAt >= SUPPRESSED_LOG_INTERVAL_MS &&
      engaged.some((p) => p.edge && p.index !== election.index)) {
    suppressedLoggedAt = now;
    const who = engaged.filter((p) => p.edge && p.index !== election.index)
      .map((p) => `#${p.index} "${p.id}"`).join(', ');
    gpLog(`input from NON-driving pad(s) ${who} — driver is #${election.index} "${gamepadCoreState.activeId}"`);
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

/**
 * Reconcile pad PRESENCE across both sources and run the loop iff something is
 * there. Presence cannot be a plain event counter any more: Chromium fires no
 * `gamepadconnected` for a native pad — and the Steam Deck case is precisely one
 * where that event never arrives at all, so a counter-driven loop would stay
 * stopped forever with three working controllers attached.
 */
function syncPadPresence(): void {
  const present = connectedCount > 0 ? connectedCount : nativePads().length;
  inputModeState.padsConnected = present;
  if (present === 0) {
    stopLoop();
    return;
  }
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    startLoop();
  }
}

/** The native pad SET changed (a controller arrived or left). */
function onNativePadsChanged(): void {
  if (!installed) {
    return;
  }
  // Drop every baseline: indices are reused across device sets, and a snapshot
  // diffed against another device's state would fire a burst of phantom edges.
  // Re-seeding costs one poll and emits nothing (the first-sighting rule).
  prevSnapshots.clear();
  pollStates.clear();
  const before = inputModeState.padsConnected;
  syncPadPresence();
  gpLog(`native pads changed — pads=${inputModeState.padsConnected} (was ${before}) ${describeAllPads()}`);
  if (inputModeState.padsConnected === 0) {
    election = initialElectionState();
    gamepadCoreState.activeIndex = -1;
    gamepadCoreState.activeId = '';
    exitGamepadMode();
  }
}

function onConnected(e: GamepadEvent): void {
  connectedCount++;
  syncPadPresence();
  gpLog(`connected ${describePad(e.gamepad)} — pads=${inputModeState.padsConnected} ${describeAllPads()}`);
  if (election.index === -1) {
    // No driver yet: this pad takes the wheel, but with edgeAt = 0 ("never
    // acted") so the first pad someone actually PRESSES can still take over.
    election = {index: e.gamepad.index, edgeAt: 0};
    gamepadCoreState.activeIndex = e.gamepad.index;
    gamepadCoreState.activeId = e.gamepad.id;
    updateDetectedGlyphSet(e.gamepad.id);
  }
}

function onDisconnected(e: GamepadEvent): void {
  connectedCount = Math.max(0, connectedCount - 1);
  syncPadPresence();
  prevSnapshots.delete(e.gamepad.index);
  pollStates.delete(e.gamepad.index);
  // The slot table on BOTH edges: a Chromium/Steam-Input device swap shows up
  // here as disconnect+connect on the same slot with a DIFFERENT id, which no
  // single-line log would reveal.
  gpLog(`disconnected ${describePad(e.gamepad)} — pads=${inputModeState.padsConnected} ${describeAllPads()}`);
  if (e.gamepad.index === election.index) {
    // The driving pad went away: drop to pointer mode (graceful — the W3C
    // disconnect story) and let any remaining pad re-elect itself on its
    // next input.
    election = initialElectionState();
    gamepadCoreState.activeIndex = -1;
    gamepadCoreState.activeId = '';
    exitGamepadMode();
  }
}

function onVisibilityChange(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.visibilityState === 'visible') {
    syncPadPresence();
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
  // The main-process source (Linux/Electron only). It publishes asynchronously,
  // so the count below is usually still zero here — `onNativePadsChanged` starts
  // the loop when the first snapshot lands. Registered under the same
  // `gamepadEnabled()` gate, so `?gp=0` kills this path too.
  offNativePads = onNativePadCountChange(onNativePadsChanged);
  installNativePadBridge();
  // Pads connected BEFORE page load only surface after a button press (the
  // privacy gate), so the connect listener is sufficient — but if the API
  // already reports pads (e.g. after a soft reload), pick them up now.
  for (const pad of chromiumPads()) {
    if (pad !== null && pad.connected) {
      connectedCount++;
    }
  }
  syncPadPresence();
  gpLog(`installed — pads=${inputModeState.padsConnected} ${describeAllPads()}`);
}

export function uninstallGamepadCore(): void {
  if (!installed || typeof window === 'undefined') {
    return;
  }
  installed = false;
  stopLoop();
  offNativePads?.();
  offNativePads = undefined;
  // Forget what we told main, so a reinstall re-asserts it from scratch rather
  // than assuming a suppression that may no longer match reality.
  nativePadsWantedSent = undefined;
  chromiumHasPads = false;
  padsFromNative = false;
  sourceWasNative = false;
  window.removeEventListener('gamepadconnected', onConnected);
  window.removeEventListener('gamepaddisconnected', onDisconnected);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  prevSnapshots.clear();
  pollStates.clear();
  election = initialElectionState();
  gamepadCoreState.activeIndex = -1;
  gamepadCoreState.activeId = '';
  connectedCount = 0;
  inputModeState.padsConnected = 0;
  // Leaving the game screen: drop back to pointer presentation and remove
  // the exit watchers — the subsystem is fully inert until re-installed.
  exitGamepadMode();
  uninstallInputModeWatchers();
}
