/*
 * CONSOLE DECK-DRAW — the controller + gates of the "cards physically come
 * off the top-bar project deck" cinematic (console-native only).
 *
 * It composes the two mechanisms this fork already trusts, and invents
 * neither:
 *
 *  · Like the BOARD CARD-BONUS scene, the state commit is NOT delayed. The
 *    reveal batch is STAGED — the overlay mounts veiled so its slots are
 *    measurable, the flying proxies land in them, and only the handoff makes
 *    the real cards visible. So the server is never waiting on the animation.
 *  · Like the TILE-PLACEMENT hold, the reveal overlay does not even MOUNT
 *    while the cards are still coming off the deck (`deckDrawHolds()` feeds
 *    ConsoleShell.consoleRevealMode). The player watches the board, the deck
 *    and the hold zone — the modal only assembles once the search is over.
 *
 * The scene SELF-ARMS reactively from the arriving reveal (like the Venus
 * card-bonus path): a draw has no single client submit point to arm from
 * (it can be a prelude, a card action, a colony bonus, a poll from another
 * player's turn), so the arriving batch IS the trigger.
 *
 * WHAT IT NEVER DOES: decide the order. `CardDrawRevealModel.sequence` is the
 * server's own record of the search; the scene replays it verbatim.
 *
 * Module-level reactive (survives remounts, one scene at a time — mirrors
 * consoleBoardCardBonus / consoleTradeFleet). The DESKTOP path is untouched:
 * the layer is console-only, so nothing arms there, and every read gate
 * degrades to a no-op while `active` is false.
 */

import {reactive} from 'vue';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {holdDeckDisplay, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';

export type DeckDrawPhase =
  | 'idle'
  /** Cards are peeling off the deck and being routed. The reveal is WITHHELD. */
  | 'search'
  /** The search is over; the found cards stand in the hold zone (hero beat). */
  | 'settle'
  /** The reveal is staged (veiled); the held cards fly into its real slots. */
  | 'assemble'
  /** The frame materializes AROUND the landed cards. */
  | 'frame'
  /** Proxy → real card crossfade. */
  | 'handoff'
  | 'done';

/**
 * A reveal batch is OURS when the cards come off the project deck. A tile /
 * Venus-scale bonus is the board card-bonus scene's (the cover lifts off the
 * cell or the marker, not off the deck) — the two can never both claim one
 * batch.
 */
export function isDeckDrawSource(source: CardDrawRevealSource | undefined): boolean {
  return source === undefined || (source.type !== 'tile' && source.type !== 'globalParameter');
}

export type DeckDrawHandle = {
  /** Kill the live timelines, drop the proxies, release every gate. */
  abort: () => void,
};

export const deckDrawState = reactive({
  active: false,
  phase: 'idle' as DeckDrawPhase,
  /** Bumped per arm — the layer (re-)starts its scene on this. */
  nonce: 0,
  /**
   * The claimed reveal batch id. KEPT after the scene ends — the overlay's
   * staged-entrance mode (which suppresses the stock deal-in for THIS batch)
   * must persist for the batch's whole on-screen life, else removing it would
   * replay the entrance. Cleared on the next arm / abort / reset.
   */
  stagedEventId: undefined as number | undefined,
  /** True when the server sequence contains at least one discarded card. */
  hasDiscards: false,
  /** The deck size BEFORE this draw — what the counter shows until a card leaves. */
  preDrawSize: 0,
  /** Discarded cards that have physically landed in the tray so far. */
  trayCount: 0,
  /** Snapshot taken at arm — one scene stays internally consistent. */
  reducedMotion: false,
  /**
   * SINGLE-card batches: flips true when the card has arrived in the hold
   * zone. The reveal is HEADLESS there (the fullscreen viewer IS the reveal),
   * so its auto-open is held until then and opens with a PHYSICAL origin
   * resolving to our proxy — the viewer lifts the very card that flew, never
   * a fresh copy appearing over a dissolving one.
   */
  zoomEntryReady: false,
});

let handle: DeckDrawHandle | undefined;
let zoomOriginResolver: (() => HTMLElement | null) | undefined;
let safetyTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The whole-scene safety backstop. A stall (lost element, stuck timeline,
 * a backgrounded tab freezing rAF) can never withhold the reveal forever:
 * the abort releases every gate and the batch falls back to the stock modal.
 */
const SCENE_SAFETY_MS = 30_000;

function clearSafety(): void {
  if (safetyTimer !== undefined) {
    clearTimeout(safetyTimer);
    safetyTimer = undefined;
  }
}

/** The input gate — the shell blocks pad input + commands while true. */
export function isDeckDrawActive(): boolean {
  return deckDrawState.active;
}

// While cards physically come off the deck, notifications queue behind the
// scene. 'notification-only': the scene STAGES the reveal overlay (a mandatory
// result surface) around its landed cards — a blocking hold would withhold the
// very surface the scene assembles into. Surface coordination stays with the
// shell (`consoleRevealMode` reads `deckDrawHolds()`).
registerAnimationHoldSupplier('deck-draw', isDeckDrawActive, {scope: 'notification-only'});

/**
 * The reveal overlay must not MOUNT while cards are still coming off the deck
 * (ConsoleShell.consoleRevealMode reads this, exactly like tilePlacementHolds).
 * It releases at 'assemble', where the overlay mounts veiled so the director
 * can measure its slots.
 */
export function deckDrawHolds(): boolean {
  return deckDrawState.active &&
    (deckDrawState.phase === 'search' || deckDrawState.phase === 'settle');
}

/** The layer registers its live-scene handle (idempotent re-register). */
export function registerDeckDrawHandle(h: DeckDrawHandle | undefined): void {
  handle = h;
}

/** The layer registers the held card's proxy for the zoom FLIP origin. */
export function registerDeckDrawZoomOrigin(fn: (() => HTMLElement | null) | undefined): void {
  zoomOriginResolver = fn;
}

/** The single-card fullscreen's physical origin (the arrived proxy). */
export function deckDrawZoomOriginEl(): HTMLElement | null {
  return zoomOriginResolver?.() ?? null;
}

/**
 * SINGLE-card: the reveal overlay HOLDS its fullscreen auto-open while the
 * card is still travelling; the flag drops the moment it stands in the hold
 * zone (or the scene aborts — never a stranded reveal).
 */
export function deckDrawHoldingSingleZoom(eventId: number | undefined): boolean {
  return deckDrawState.active && isDeckDrawStaged(eventId) && !deckDrawState.zoomEntryReady;
}

/** The card stands ready — release the held fullscreen auto-open. */
export function markDeckDrawZoomReady(): void {
  if (deckDrawState.active) {
    deckDrawState.zoomEntryReady = true;
  }
}

/**
 * ARM — the layer calls this when a deck-sourced reveal batch arrives.
 * Synchronous `active` so the gates close in the same tick the batch lands
 * (no frame where the stock modal could flash). One scene at a time.
 */
export function armDeckDraw(eventId: number, opts: {hasDiscards: boolean, preDrawSize: number, reducedMotion: boolean}): boolean {
  if (deckDrawState.active) {
    return false;
  }
  deckDrawState.active = true;
  deckDrawState.phase = 'search';
  deckDrawState.stagedEventId = eventId;
  deckDrawState.hasDiscards = opts.hasDiscards;
  deckDrawState.preDrawSize = opts.preDrawSize;
  deckDrawState.trayCount = 0;
  deckDrawState.reducedMotion = opts.reducedMotion;
  deckDrawState.zoomEntryReady = false;
  deckDrawState.nonce++;
  // The authoritative deckSize has ALREADY dropped (the server drew before it
  // answered). Hold the pre-draw number so the counter ticks down with the
  // cards physically leaving, then release to the server's truth at the end.
  holdDeckDisplay(opts.preDrawSize);
  clearSafety();
  // Bare setTimeout (NOT window.setTimeout): `window` isn't reliably the
  // global inside the mochapack test bundle (same as the draft tray).
  safetyTimer = setTimeout(() => abortDeckDraw(), SCENE_SAFETY_MS);
  return true;
}

/** Phase transitions only apply to a LIVE scene (zombie-safe). */
export function setDeckDrawPhase(phase: DeckDrawPhase): void {
  if (deckDrawState.active) {
    deckDrawState.phase = phase;
  }
}

/** One card has physically left the deck — tick the held counter down. */
export function markDeckCardDrawn(remaining: number): void {
  if (deckDrawState.active) {
    holdDeckDisplay(remaining);
  }
}

/** One discarded card has landed in the tray (drives its count + thickness). */
export function markDeckDrawDiscarded(): void {
  if (deckDrawState.active) {
    deckDrawState.trayCount++;
  }
}

/** Is THIS reveal batch the scene's staged one (drives the overlay classes)? */
export function isDeckDrawStaged(eventId: number | undefined): boolean {
  return eventId !== undefined && deckDrawState.stagedEventId === eventId;
}

/**
 * Clean finish. `stagedEventId` is deliberately KEPT (see its doc) so the
 * overlay's staged mode persists for the batch's on-screen life; the deck
 * counter is released to the server's authoritative value.
 */
export function endDeckDraw(): void {
  if (!deckDrawState.active) {
    return;
  }
  clearSafety();
  releaseDeckDisplay();
  deckDrawState.active = false;
  deckDrawState.phase = 'done';
  handle = undefined;
  zoomOriginResolver = undefined;
}

/**
 * ABORT — teardown / safety / an unexpected stall. Clears the staging FIRST
 * so the overlay instantly unveils and releases its cards (an abort can never
 * leave the reveal invisible), then plays the visual teardown.
 */
export function abortDeckDraw(): void {
  if (!deckDrawState.active) {
    return;
  }
  clearSafety();
  releaseDeckDisplay();
  const h = handle;
  handle = undefined;
  zoomOriginResolver = undefined;
  deckDrawState.active = false;
  deckDrawState.phase = 'idle';
  deckDrawState.stagedEventId = undefined;
  deckDrawState.hasDiscards = false;
  deckDrawState.preDrawSize = 0;
  deckDrawState.trayCount = 0;
  // Release the held single-card auto-open — an abort must never leave the
  // reveal invisible.
  deckDrawState.zoomEntryReady = true;
  h?.abort();
}

/** Full reset (tests / game-switch boundary). */
export function resetDeckDraw(): void {
  clearSafety();
  releaseDeckDisplay();
  handle = undefined;
  zoomOriginResolver = undefined;
  deckDrawState.active = false;
  deckDrawState.phase = 'idle';
  deckDrawState.stagedEventId = undefined;
  deckDrawState.hasDiscards = false;
  deckDrawState.preDrawSize = 0;
  deckDrawState.trayCount = 0;
  deckDrawState.reducedMotion = false;
  deckDrawState.zoomEntryReady = false;
}
