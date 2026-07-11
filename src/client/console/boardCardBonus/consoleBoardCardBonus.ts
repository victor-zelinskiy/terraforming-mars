/*
 * CONSOLE BOARD CARD-BONUS — the controller + gates of the "card-bonus
 * cover lifts off its source and flips into the received cards" cinematic
 * (console-native only). ONE premium language for two sources:
 *
 *  board-cell  — the player places a tile on a cell printed with a card
 *      bonus. The shell ARMs at SUBMIT time (`armBoardCardBonus`), so the
 *      cover separates BEFORE the tile covers it; the arriving reveal
 *      (source `tile`) is claimed.
 *  venus-scale — the Venus scale crosses 8% (the "draw a card" reward).
 *      There is no tile race, so the layer SELF-ARMs reactively when the
 *      reveal (source `globalParameter`/venus) arrives, lifting the cover
 *      off the 8% marker.
 *
 * Either way: the commit is NOT delayed — the reveal batch is STAGED (the
 * overlay mounts veiled + held), the cover travels into the reveal space,
 * flips into the real received cards, and only the handoff makes the static
 * cards visible/interactive. A single card hands over to the fullscreen
 * viewer (the existing zoom FLIP physically lifts it from the scene).
 *
 * Module-level reactive (survives remounts, one scene at a time — mirrors
 * consoleTradeFleet / consoleHydroMarker). The DESKTOP path is untouched:
 * the layer is console-only, so nothing arms there, and every read gate
 * degrades to a no-op while `active` is false.
 */

import {reactive} from 'vue';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';

/**
 * WHERE the lifting cover comes from. `board-cell` carries the placed
 * space's id (its `.board-space-bonus--card` icon is the anchor); the
 * `venus-scale` marker is a fixed anchor (`[data-arc-marker="venus-8"]`).
 */
export type BonusCoverSource =
  | {kind: 'board-cell', spaceId: string}
  | {kind: 'venus-scale'};

/** The reveal source a `venus-scale` scene claims (the Venus 8% draw). */
export function isVenusScaleReveal(source: CardDrawRevealSource | undefined): boolean {
  return source?.type === 'globalParameter' && source.parameter === 'venus';
}

/** Does a reveal batch belong to a scene armed from `sceneSource`? */
export function revealMatchesSource(
  revealSource: CardDrawRevealSource | undefined,
  sceneSource: BonusCoverSource,
): boolean {
  if (sceneSource.kind === 'board-cell') {
    return revealSource?.type === 'tile';
  }
  return isVenusScaleReveal(revealSource);
}

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
  /** WHERE the cover lifts from (the placed cell, or the Venus 8% marker). */
  source: {kind: 'board-cell', spaceId: ''} as BonusCoverSource,
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
 * ARM the scene — called by the shell RIGHT BEFORE submitting a placement
 * (board-cell), or by the layer when a Venus-scale reveal arrives
 * (venus-scale). Synchronous `active` so the input gate closes at once (no
 * double confirm). One scene at a time.
 */
export function armBoardCardBonus(source: BonusCoverSource): void {
  if (boardCardBonusState.active) {
    return;
  }
  // A new scene supersedes the previous batch's staging memory.
  boardCardBonusState.stagedEventId = undefined;
  boardCardBonusState.stagedCount = 0;
  boardCardBonusState.zoomEntryReady = false;
  boardCardBonusState.source = source;
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
  boardCardBonusState.source = {kind: 'board-cell', spaceId: ''};
  boardCardBonusState.stagedEventId = undefined;
  boardCardBonusState.stagedCount = 0;
  boardCardBonusState.zoomEntryReady = false;
}
