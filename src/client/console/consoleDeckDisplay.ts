/**
 * Console project-deck display model (top HUD draw pile).
 *
 * The COUNT is always the server's authoritative draw-pile size
 * (`GameModel.deckSize` = `game.projectDeck.drawPile.length`, serialized in
 * ServerModel on every response) — never a client-side derivation. This
 * module owns only PRESENTATION concerns:
 *
 *  - `deckStackTier(size)` — the discrete physical-thickness tier the stack
 *    renders at (how many side layers are visible under the top card);
 *  - the HOLD hook — the architectural seam for the FUTURE hero
 *    draw animation: while a physical card-flight plays, the animation
 *    director calls `holdDeckDisplay(preDrawSize)` so the visible counter
 *    keeps the pre-draw value, then `releaseDeckDisplay()` once the flight
 *    lands — at which point the widget transitions to the (already
 *    committed) authoritative value. No such animation exists yet; today
 *    the hold is never engaged and `displayedDeckSize(actual)` is the
 *    identity.
 *
 * Module-level reactive (survives the playerkey remount, mirrors
 * journalState & friends).
 */
import {reactive} from 'vue';

/** At or below this many remaining cards the deck reads as LOW. */
export const DECK_LOW_THRESHOLD = 10;

/** Above this size the stack renders at full thickness (3 side layers). */
export const DECK_FULL_THRESHOLD = 60;

export type DeckStackTier = 'empty' | 'thin' | 'half' | 'full';

/** Visible side layers under the top card, per tier. */
export const DECK_TIER_LAYERS: Record<DeckStackTier, number> = {
  empty: 0,
  thin: 1,
  half: 2,
  full: 3,
};

/** Discrete physical thickness of the rendered pile. */
export function deckStackTier(size: number): DeckStackTier {
  if (size <= 0) {
    return 'empty';
  }
  if (size <= DECK_LOW_THRESHOLD) {
    return 'thin';
  }
  if (size <= DECK_FULL_THRESHOLD) {
    return 'half';
  }
  return 'full';
}

const deckHoldState = reactive({
  held: undefined as number | undefined,
  /** The current hold is the APPLY-BLOCK SEED (`seedDeckDisplay`), not yet taken over by the flight that deals it. */
  seeded: false,
});

/** Freeze the VISIBLE deck count at `value` (pre-draw size) while a future
 *  physical draw animation plays. Idempotent; re-holding replaces the value
 *  (and takes over a seed — the flight that deals the cards owns it now). */
export function holdDeckDisplay(value: number): void {
  deckHoldState.held = value;
  deckHoldState.seeded = false;
}

/** Release the hold — the widget transitions to the authoritative value. */
export function releaseDeckDisplay(): void {
  deckHoldState.held = undefined;
  deckHoldState.seeded = false;
}

/**
 * THE APPLY-BLOCK SEED (PL-088): a response that drew cards off the deck
 * commits the SMALLER count in the very block the batch arrives in, while the
 * flight that will deal them arms a watcher later — after the HUD has rendered
 * the smaller count. The flight then held the pre-draw number back, and the
 * counter flipped UP with a «+N» chip: the deck read as gaining the cards it
 * was about to deal. Seeded in the same synchronous block as the commit, the
 * pre-draw number never leaves the screen; the flight's own `hold` takes it
 * over (same value), a foreign owner releases it (`releaseDeckSeed`).
 * Never replaces a standing hold (a composer that held before its submit).
 */
export function seedDeckDisplay(value: number): boolean {
  if (deckHoldState.held !== undefined) {
    return false;
  }
  deckHoldState.held = value;
  deckHoldState.seeded = true;
  return true;
}

/** Drop the SEED only — a hold some flight has taken over is never touched. */
export function releaseDeckSeed(): void {
  if (deckHoldState.seeded) {
    deckHoldState.held = undefined;
    deckHoldState.seeded = false;
  }
}

/** Is the visible count the apply-block seed, still waiting for its flight? */
export function isDeckDisplaySeeded(): boolean {
  return deckHoldState.seeded;
}

export function isDeckDisplayHeld(): boolean {
  return deckHoldState.held !== undefined;
}

/** The value the widget shows: the held pre-animation size, else the
 *  server-authoritative one. */
export function displayedDeckSize(actual: number): number {
  return deckHoldState.held ?? actual;
}
