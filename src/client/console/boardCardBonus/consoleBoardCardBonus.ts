/*
 * CONSOLE BOARD CARD-BONUS — the controller + gates of the "card bonus
 * lifts off the board cell" cinematic (console-native only).
 *
 * The story: the player confirms a tile placement on a cell printed with a
 * card-draw bonus → the cover ARMs client-side and physically separates
 * from the cell BEFORE the tile covers it (the shell calls
 * `armBoardCardBonus` right before submitting the space response). The
 * commit is NOT delayed (the tile-placement hold plays as usual, under the
 * hovering cover); instead the arriving reveal batch (source `tile`) is
 * STAGED — the reveal overlay mounts veiled + held, the covers travel into
 * its exact slots, flip into the real received cards, the frame
 * materializes around them, and only the handoff makes the static cards
 * visible/interactive. A single card hands over to the fullscreen viewer
 * instead (the existing zoom FLIP physically lifts it from the scene).
 *
 * Module-level reactive (survives remounts, one scene at a time — mirrors
 * consoleTradeFleet / consoleHydroMarker). The DESKTOP path is untouched:
 * nothing arms outside the console shell, and every read gate degrades to
 * a no-op while `active` is false.
 */

import {reactive} from 'vue';

export type BoardCardBonusPhase =
  | 'idle'
  /** The cover separates from the cell (client-armed at submit). */
  | 'lift'
  /** Hovering above the cell — the honest pending pose (server thinking). */
  | 'hover'
  /** The covers travel toward the reveal space (multi: the packed leg). */
  | 'gather'
  /** Multi: the covers fan into their exact reveal slots, flipping. */
  | 'fan'
  /** The reveal frame/backdrop materializes AROUND the landed cards. */
  | 'frame'
  /** Proxy → real card crossfade (static cards become visible). */
  | 'handoff'
  | 'done';

/**
 * Abort flavours (the visual is the layer's; the mode names the honest
 * story): `return` — nothing happened, the cover flies back onto its cell;
 * `absorb` — the tile IS placed but no cards came (deck empty / stale arm),
 * the cover sinks into the fresh tile; `instant` — teardown (errors,
 * unmount): a short fade, no theatrics.
 */
export type BoardCardBonusAbortMode = 'return' | 'absorb' | 'instant';

export type BoardCardBonusHandle = {
  /** Kill the live timelines + play the abort visual + restore the board icon. */
  abort: (mode: BoardCardBonusAbortMode) => void,
};

export const boardCardBonusState = reactive({
  active: false,
  phase: 'idle' as BoardCardBonusPhase,
  /** The placed space (the cell whose card bonus is being taken). */
  spaceId: '',
  /** Bumped per arm — the layer (re-)starts its scene on this. */
  nonce: 0,
  /**
   * The claimed reveal batch (drawnCardsState event id). KEPT after the
   * scene ends — the overlay's `bonus-mode` (which suppresses the stock
   * deal-in entrance for THIS batch) must persist for the batch's whole
   * on-screen life, else removing it would replay the entrance animation.
   * Cleared on the next arm / abort / reset.
   */
  stagedEventId: undefined as number | undefined,
  stagedCount: 0,
  /**
   * SINGLE-card: flips true when the cover has arrived at the presentation
   * point — the reveal overlay's fullscreen auto-open is HELD until then,
   * and opens with a PHYSICAL origin resolving to the cover proxy (the
   * existing zoom FLIP lifts the real card out of the scene).
   */
  zoomEntryReady: false,
});

let handle: BoardCardBonusHandle | undefined;
let zoomOriginResolver: (() => HTMLElement | null) | undefined;
let safetyTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The whole-scene safety backstop: arm → the server must stage a reveal
 * and the scene must finish well inside this window; a stall (lost
 * response, stuck timeline) can never gate input forever.
 */
const ARM_SAFETY_MS = 15_000;

function clearSafety(): void {
  if (safetyTimer !== undefined) {
    clearTimeout(safetyTimer);
    safetyTimer = undefined;
  }
}

/** The input gate — the shell blocks pad input + commands while true. */
export function isBoardCardBonusActive(): boolean {
  return boardCardBonusState.active;
}

/** The layer registers its live-scene handle (idempotent re-register). */
export function registerBoardCardBonusHandle(h: BoardCardBonusHandle | undefined): void {
  handle = h;
}

/** The layer registers the cover-proxy element for the zoom FLIP origin. */
export function registerBonusZoomOrigin(fn: (() => HTMLElement | null) | undefined): void {
  zoomOriginResolver = fn;
}

/** The single-card fullscreen's physical origin (the cover proxy). */
export function bonusZoomOriginEl(): HTMLElement | null {
  return zoomOriginResolver?.() ?? null;
}

/**
 * ARM the scene — called by the shell RIGHT BEFORE submitting a space
 * response for a cell with a card-draw bonus. Synchronous `active` so the
 * input gate closes at once (no double confirm). One scene at a time.
 */
export function armBoardCardBonus(spaceId: string): void {
  if (boardCardBonusState.active) {
    return;
  }
  // A new scene supersedes the previous batch's staging memory.
  boardCardBonusState.stagedEventId = undefined;
  boardCardBonusState.stagedCount = 0;
  boardCardBonusState.zoomEntryReady = false;
  boardCardBonusState.spaceId = spaceId;
  boardCardBonusState.phase = 'lift';
  boardCardBonusState.active = true;
  boardCardBonusState.nonce++;
  clearSafety();
  // Bare setTimeout (NOT window.setTimeout): `window` isn't reliably the
  // global inside the mochapack test bundle (same as the draft tray).
  safetyTimer = setTimeout(() => abortBoardCardBonus('instant'), ARM_SAFETY_MS);
}

/** Phase transitions only apply to a LIVE scene (zombie-safe). */
export function setBoardCardBonusPhase(phase: BoardCardBonusPhase): void {
  if (boardCardBonusState.active) {
    boardCardBonusState.phase = phase;
  }
}

/**
 * CLAIM the arrived tile-bonus reveal batch for the scene. Exactly once,
 * and only while the cover is still at the cell (lift/hover) — a batch
 * arriving mid-transfer (impossible in practice) falls through to the
 * standard instant reveal instead of corrupting a running scene.
 */
export function stageBoardCardBonusReveal(eventId: number, cardCount: number): boolean {
  if (!boardCardBonusState.active || boardCardBonusState.stagedEventId !== undefined) {
    return false;
  }
  if (boardCardBonusState.phase !== 'lift' && boardCardBonusState.phase !== 'hover') {
    return false;
  }
  boardCardBonusState.stagedEventId = eventId;
  boardCardBonusState.stagedCount = Math.max(1, cardCount);
  return true;
}

/** Is THIS reveal batch the scene's staged one (drives the overlay classes)? */
export function isBonusRevealStaged(eventId: number | undefined): boolean {
  return eventId !== undefined && boardCardBonusState.stagedEventId === eventId;
}

/**
 * SINGLE-card: the reveal overlay HOLDS its fullscreen auto-open while the
 * cover is still travelling; the flag drops the moment the cover stands at
 * the presentation point (or the scene aborts — never a stranded reveal).
 */
export function bonusHoldingSingleZoom(eventId: number | undefined): boolean {
  return boardCardBonusState.active && isBonusRevealStaged(eventId) &&
    boardCardBonusState.stagedCount === 1 && !boardCardBonusState.zoomEntryReady;
}

/** The cover stands ready — release the held fullscreen auto-open. */
export function markBonusZoomEntryReady(): void {
  if (boardCardBonusState.active) {
    boardCardBonusState.zoomEntryReady = true;
  }
}

/**
 * Clean finish. `stagedEventId` is deliberately KEPT (see its doc) so the
 * overlay's bonus-mode persists for the batch's on-screen life.
 */
export function endBoardCardBonus(): void {
  if (!boardCardBonusState.active) {
    return;
  }
  clearSafety();
  boardCardBonusState.active = false;
  boardCardBonusState.phase = 'done';
  handle = undefined;
  zoomOriginResolver = undefined;
}

/**
 * ABORT — recall the scene (submit error, no reveal arrived, teardown).
 * Clears the staging so the reveal overlay (if any) instantly unveils and
 * releases its cards — an abort can never leave the UI invisible — and
 * releases a held single-card auto-open the same way.
 */
export function abortBoardCardBonus(mode: BoardCardBonusAbortMode = 'instant'): void {
  if (!boardCardBonusState.active) {
    return;
  }
  clearSafety();
  const h = handle;
  handle = undefined;
  zoomOriginResolver = undefined;
  boardCardBonusState.active = false;
  boardCardBonusState.phase = 'idle';
  boardCardBonusState.stagedEventId = undefined;
  boardCardBonusState.stagedCount = 0;
  boardCardBonusState.zoomEntryReady = true;
  h?.abort(mode);
}

/** Full reset (tests / game-switch boundary). */
export function resetBoardCardBonus(): void {
  clearSafety();
  handle = undefined;
  zoomOriginResolver = undefined;
  boardCardBonusState.active = false;
  boardCardBonusState.phase = 'idle';
  boardCardBonusState.spaceId = '';
  boardCardBonusState.stagedEventId = undefined;
  boardCardBonusState.stagedCount = 0;
  boardCardBonusState.zoomEntryReady = false;
}
