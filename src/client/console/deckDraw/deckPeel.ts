/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PEEL OFF THE HUD DECK — one gesture for every flight that takes a card
 * off `.con-deckstack__pile` (the search scene, a plain batch's arrival, a
 * deck check's reveal).
 *
 * The pile lives in the top status strip, flush with the screen's top edge.
 * The peel used to LIFT the card upward out of the stack, which there means
 * out of the screen: ≈ 10.7 px of the card above the edge on fhd, a quarter of
 * it clipped for the beat (PL-089, the owner's decision 2026-10-07: the card
 * separates DOWNWARD, into the screen — the same distance, the same growth).
 */

/** How far (px, screen space) a card travels away from the pile's centre as it separates — always DOWN. */
export function deckPeelDy(startScale: number): number {
  return 10 + 14 * startScale;
}

/** The deck check's shorter separation (`consoleActionRevealMotion`) — the same direction. */
export const DECK_CHECK_PEEL_DY = 12;
