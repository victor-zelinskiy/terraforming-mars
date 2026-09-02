/*
 * PLACEMENT FLOW — the console's two-phase tile-placement confirm.
 *
 * WHY A STATE MACHINE AND NOT A DIALOG. A tile placement is the one everyday
 * action in this game that is strategically irreversible the instant it is
 * submitted: events are recorded, bonuses pay out, a card may be drawn — no
 * undo can honestly unwind it. The historical guard was a centre-screen
 * confirm dialog, which covers the very cell being confirmed and rips the
 * spatial continuity the whole board experience is built on. The console
 * answer is a SECOND PHASE OF THE BOARD ITSELF: the first press LOCKS the
 * focused cell (pure presentation — no request, no events, no state), the
 * second, separately-released press commits through the exact same submit
 * funnel a single press used to drive. B from the locked phase returns to
 * navigation; one more B is the ordinary cancel hierarchy.
 *
 * INPUT SAFETY IS STRUCTURAL, never a debounce:
 *  - press intents are edge-detected upstream (a held button never re-fires),
 *    so one physical press can never produce both phases;
 *  - the commit additionally requires the lock's own press to have been
 *    RELEASED (`armedRelease`) — tracked from the intent bus's falling edge,
 *    exactly like consoleHoldConfirm does, so a swallowed edge cannot arm it;
 *  - a minimum LOCK DWELL separates the two presses in time, so a double-tap
 *    or a bouncing pad cannot ride through the gate before the locked pose
 *    has even painted;
 *  - while a commit is on the wire the phase is `committing`, which absorbs
 *    every board press by construction (the transport's own
 *    `isServerSideRequestInProgress` stays the second, independent barrier).
 *
 * The module owns NO DOM and submits NOTHING. The shell drives the phase from
 * its board input handlers; `ConsoleBoardInput` (the one tile-submit funnel)
 * marks the commit and enforces readiness at the last gate; the transport's
 * refusal battery rolls a failed commit back to the locked phase with the
 * player's context intact (`rollbackPlacementCommit`), re-arming the board
 * wiring through the registered re-arm hook.
 *
 * The TWO-STEP PREFERENCE lives here too: default ON (the recommended
 * console-native behaviour); «Одно нажатие» restores the historical instant
 * commit — still covered by the entry hold-gate and the committing absorb.
 */

import {reactive} from 'vue';
import {SpaceId} from '@/common/Types';
import {observeConsoleIntents} from '@/client/console/consoleRouter';

export type PlacementFlowPhase = 'navigate' | 'locked' | 'committing';

/**
 * The two presses must be separate DECISIONS, not one motor gesture: below
 * ~250 ms a second press is muscle bounce, not a read of the locked pose.
 * Deliberately NOT scaled by `--motion-scale` — a player who shortened
 * decoration has not asked for a thinner safety gate (same rule as
 * HOLD_CONFIRM_MS).
 */
export const LOCK_COMMIT_DWELL_MS = 280;

/**
 * A commit whose request never got an answer (a submit raced another
 * in-flight request and was dropped by the transport's re-entry guard) must
 * not seal the board forever: fall back to the locked phase, where B works.
 */
export const COMMIT_ROLLBACK_SAFETY_MS = 8000;

export const placementFlowState = reactive({
  phase: 'navigate' as PlacementFlowPhase,
  /** The locked cell (also the committing cell). */
  lockedSpaceId: undefined as SpaceId | undefined,
  /** The confirm button is physically DOWN right now (edge-tracked). */
  confirmDown: false,
  /** The lock's own press has been let go — the second press may commit. */
  armedRelease: false,
  /**
   * Placement mode was entered while confirm was already held (the press
   * that opened this mode) — every board confirm is refused until the
   * button is released once. Applies to BOTH modes.
   */
  entryHoldGate: false,
  /** Two-step confirm is ON (the recommended console default). */
  twoStep: true,
});

let lockedAtMs = 0;
let intentWatchStarted = false;
let rearmBoard: (() => void) | undefined;
let commitSafety: ReturnType<typeof setTimeout> | undefined;

function now(): number {
  return typeof performance === 'object' && performance !== null &&
    typeof performance.now === 'function' ? performance.now() : Date.now();
}

/**
 * Track the confirm button's physical edges off the intent bus — observers
 * are non-consuming and run before the routing handler, so the press that
 * locks a cell is already reflected in `confirmDown` when the shell asks.
 * One module-lifetime subscription (the bus is a module singleton too).
 */
function ensureIntentWatch(): void {
  if (intentWatchStarted) {
    return;
  }
  intentWatchStarted = true;
  observeConsoleIntents((intent) => {
    if (intent.kind === 'press' && intent.button === 'confirm') {
      placementFlowState.confirmDown = true;
    } else if (intent.kind === 'release' && intent.button === 'confirm') {
      placementFlowState.confirmDown = false;
      placementFlowState.entryHoldGate = false;
      if (placementFlowState.phase === 'locked') {
        placementFlowState.armedRelease = true;
      }
    }
  });
}

// ── preference ─────────────────────────────────────────────────────────────

const PREF_KEY = 'tm_place_confirm';

function readStoredPref(): boolean {
  try {
    return window.localStorage?.getItem(PREF_KEY) !== '0';
  } catch (err) {
    return true;
  }
}

export function setPlacementTwoStep(on: boolean): void {
  placementFlowState.twoStep = on;
  try {
    window.localStorage?.setItem(PREF_KEY, on ? '1' : '0');
  } catch (err) {
    // storage unavailable — the in-memory value still applies this session
  }
  // A mode change mid-placement never strands a phase the new mode has no
  // UI for: fold any standing lock back to plain navigation.
  if (!on && placementFlowState.phase === 'locked') {
    unlockPlacementCell();
  }
}

/** Load-time init (module scope): the stored preference, watch armed. */
placementFlowState.twoStep = typeof window === 'undefined' ? true : readStoredPref();

// ── lifecycle ──────────────────────────────────────────────────────────────

/**
 * Placement mode ENTERED (the shell's `placementActive` rising edge). Arms
 * the entry hold-gate when the confirm button is still physically down from
 * the press that opened the mode — that press must never place a tile.
 */
export function enterPlacementFlow(): void {
  ensureIntentWatch();
  clearCommitSafety();
  placementFlowState.phase = 'navigate';
  placementFlowState.lockedSpaceId = undefined;
  placementFlowState.armedRelease = false;
  placementFlowState.entryHoldGate = placementFlowState.confirmDown;
}

/** Placement left / the world moved on — everything transient clears. */
export function resetPlacementFlow(): void {
  clearCommitSafety();
  placementFlowState.phase = 'navigate';
  placementFlowState.lockedSpaceId = undefined;
  placementFlowState.armedRelease = false;
  placementFlowState.entryHoldGate = false;
}

/**
 * First press on a legal cell (two-step mode): lock it. Pure presentation —
 * nothing is submitted, nothing is armed, no gameplay effect of any kind.
 * Re-locking another cell moves the lock (the mouse path uses this).
 */
export function lockPlacementCell(spaceId: SpaceId): void {
  ensureIntentWatch();
  placementFlowState.phase = 'locked';
  placementFlowState.lockedSpaceId = spaceId;
  lockedAtMs = now();
  // A lock taken by a pad press is released later (the observer arms it); a
  // lock taken by a mouse click has no held button — armed immediately.
  placementFlowState.armedRelease = !placementFlowState.confirmDown;
}

/** B from the locked phase — back to navigation, no gameplay consequence. */
export function unlockPlacementCell(): void {
  if (placementFlowState.phase !== 'locked') {
    return;
  }
  placementFlowState.phase = 'navigate';
  placementFlowState.lockedSpaceId = undefined;
  placementFlowState.armedRelease = false;
}

/**
 * May the SECOND press commit right now? The three gates together: the lock
 * stands, its press was released, and the dwell has passed. The entry
 * hold-gate covers the pathological «locked by a press that was itself
 * carried in» shape.
 */
export function placementCommitReady(): boolean {
  return placementFlowState.phase === 'locked' &&
    placementFlowState.armedRelease &&
    !placementFlowState.entryHoldGate &&
    (now() - lockedAtMs) >= LOCK_COMMIT_DWELL_MS;
}

/** A board confirm press may act at all (both modes' shared entry gate). */
export function placementPressAllowed(): boolean {
  return !placementFlowState.entryHoldGate;
}

/**
 * The point of no return — called by `ConsoleBoardInput.confirmPlacement`,
 * the ONE commit funnel every placement source drives (pad, mouse, dialog).
 * From here to the server's answer the phase absorbs all board input.
 */
export function beginPlacementCommit(spaceId: SpaceId): void {
  clearCommitSafety();
  placementFlowState.phase = 'committing';
  placementFlowState.lockedSpaceId = spaceId;
  commitSafety = setTimeout(() => {
    commitSafety = undefined;
    // No answer ever arrived for this commit (dropped submit) — fall back to
    // a phase where the player has agency again.
    if (placementFlowState.phase === 'committing') {
      rollbackPlacementCommit();
    }
  }, COMMIT_ROLLBACK_SAFETY_MS);
}

/**
 * The server REFUSED the commit (or the wire failed) — called from the
 * transport's abort battery. The player returns to the locked phase with
 * their chosen cell intact (two-step) or plain navigation (single-press),
 * and the board wiring re-arms (the submit funnel disarmed the per-cell
 * handlers before posting).
 */
export function rollbackPlacementCommit(): void {
  clearCommitSafety();
  if (placementFlowState.phase !== 'committing') {
    return;
  }
  if (placementFlowState.twoStep && placementFlowState.lockedSpaceId !== undefined) {
    placementFlowState.phase = 'locked';
    lockedAtMs = now();
    placementFlowState.armedRelease = !placementFlowState.confirmDown;
  } else {
    placementFlowState.phase = 'navigate';
    placementFlowState.lockedSpaceId = undefined;
    placementFlowState.armedRelease = false;
  }
  rearmBoard?.();
}

/**
 * The board binder's re-arm hook (re-attach per-cell handlers + highlight
 * after a refused commit). Registered on mount, retracted on unmount.
 */
export function registerPlacementRearm(fn: () => void): () => void {
  rearmBoard = fn;
  return () => {
    if (rearmBoard === fn) {
      rearmBoard = undefined;
    }
  };
}

function clearCommitSafety(): void {
  if (commitSafety !== undefined) {
    clearTimeout(commitSafety);
    commitSafety = undefined;
  }
}

// ── test seams ─────────────────────────────────────────────────────────────

/** Drive the dwell clock forward without waiting (mirrors holdConfirm's seam). */
export function __advancePlacementDwellForTest(ms: number): void {
  lockedAtMs -= ms;
}

export function __resetPlacementFlowForTest(): void {
  resetPlacementFlow();
  placementFlowState.confirmDown = false;
  placementFlowState.twoStep = true;
}
