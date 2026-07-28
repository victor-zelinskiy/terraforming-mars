/*
 * CARD DISCARD — the PURE half of the console's "a card physically leaves the
 * hand" cinematic (phases, timings, geometry, the server-truth diff).
 *
 * No Vue, no DOM, no GSAP: everything here is unit-tested under the server
 * runner (tests/client/components/console/discardModel.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';

/**
 * The scene's phase ladder — a TABLETOP gesture, in order. It runs in this
 * order on EVERY path, including the degraded ones (reduced motion /
 * off-screen sources / a JSDOM test), so the shell watchers that key off a
 * phase can never desynchronise.
 *
 *  idle      — nothing armed.
 *  armed     — the player answered; sources captured, the server round-trip is
 *              in flight. Nothing is on screen yet.
 *  fixating  — the chosen cards come off the table a little and the rest of
 *              the hand recedes: "these are the ones, in my hand now".
 *  flipping  — they are turned FACE DOWN where they lie, one after another
 *              like a hand turning cards over — they stop being yours.
 *  gathering — the turned cards are squared up into one compact packet.
 *  leaving   — the pick surface hands off: the UNCHOSEN cards go home to the
 *              dock through the ORDINARY close episode, while the packet stays
 *              over the table on its own layer (object permanence), and the
 *              discard pile lights up as the receiver.
 *  carrying  — the packet is picked up and carried over to the pile on an arc.
 *  landing   — it lands: contact settle, the pile takes the weight, the count
 *              ticks.
 *  settling  — the pile keeps the acknowledgement, then the tray withdraws.
 *  failed    — the server did NOT take the cards: no fake disposal is drawn.
 */
export type DiscardPhase =
  | 'idle' | 'armed'
  | 'fixating' | 'flipping' | 'gathering' | 'leaving' | 'carrying' | 'landing' | 'settling'
  | 'failed';

/** The scene owns the foreground for every phase that has something on screen. */
export function discardPhaseHolds(phase: DiscardPhase): boolean {
  return phase !== 'idle' && phase !== 'armed' && phase !== 'failed';
}

/** Phases where the chosen cards are still INSIDE the pick surface — the hand
 *  must keep rendering (frozen) and the packet must not be carried yet. */
export function discardPhaseInOverlay(phase: DiscardPhase): boolean {
  return phase === 'fixating' || phase === 'flipping' || phase === 'gathering';
}

export type DiscardTimings = {
  /** A — the chosen cards lift out of the row; the rest recede. */
  fixateMs: number,
  /** B — the face→back turn, per card, in place. */
  flipMs: number,
  /** B — cascade between cards, so a hand turns them over one by one. */
  flipStepMs: number,
  /** C — squaring the turned cards into one packet. */
  gatherMs: number,
  /** D — the beat the packet holds while the overlay goes home behind it. */
  handoffMs: number,
  /** E — the pick-up before the carry (never an instant jerk). */
  liftMs: number,
  /** E — the carry itself. */
  carryMs: number,
  /** E — cascade on the final approach when several cards travel loose. */
  carryStepMs: number,
  /** F — contact settle on the pile. */
  landMs: number,
  /** The pile's acknowledgement + the tray withdrawing. */
  settleMs: number,
};

export const DISCARD_TIMINGS: DiscardTimings = {
  fixateMs: 130,
  flipMs: 300,
  flipStepMs: 85,
  gatherMs: 220,
  handoffMs: 260,
  liftMs: 180,
  carryMs: 620,
  carryStepMs: 70,
  landMs: 260,
  settleMs: 620,
};

/** Reduced motion keeps the ladder but collapses every beat to a short fade. */
export const DISCARD_TIMINGS_REDUCED: DiscardTimings = {
  fixateMs: 60,
  flipMs: 110,
  flipStepMs: 20,
  gatherMs: 60,
  handoffMs: 60,
  liftMs: 50,
  carryMs: 160,
  carryStepMs: 15,
  landMs: 70,
  settleMs: 180,
};

export function discardTimings(reduced: boolean): DiscardTimings {
  return reduced ? DISCARD_TIMINGS_REDUCED : DISCARD_TIMINGS;
}

/**
 * The scene's own safety ceiling. Deliberately BELOW the animation-hold
 * registry's 35 s net so the flow's abort always cleans up its own visuals
 * first (the ceiling would only ever fire on a genuinely wedged rAF).
 */
export const DISCARD_SAFETY_MS = 7_000;

/**
 * How many card backs the pile draws. A discard of nine cards must not become
 * nine DOM cards — the count carries the rest (mirrors the deck-draw tray and
 * the played-events pile).
 */
export const DISCARD_PILE_MAX_BACKS = 3;

export function discardPileBacks(count: number): number {
  return Math.max(0, Math.min(DISCARD_PILE_MAX_BACKS, count));
}

export type DiscardRect = {left: number, top: number, width: number, height: number};

/** A rect we can honestly fly from/to (a collapsed one means "no anchor"). */
export function usableDiscardRect(rect: DiscardRect | undefined): rect is DiscardRect {
  return rect !== undefined && rect.width > 10 && rect.height > 10;
}

/**
 * THE SERVER IS THE TRUTH. The scene only plays for cards the server actually
 * removed from the hand: a rejected or partially applied answer can never draw
 * a disposal that did not happen.
 *
 * Names are unique across a hand, so a plain set difference is exact.
 *
 * @param armed the names the player answered with.
 * @param nextHand the hand of the response being applied.
 */
export function discardedFromHand(
  armed: ReadonlyArray<CardName>,
  nextHand: ReadonlyArray<{name: CardName}>,
): ReadonlyArray<CardName> {
  const remaining = new Set(nextHand.map((c) => c.name));
  return armed.filter((name) => !remaining.has(name));
}

/**
 * The stack pose above the tray: the cards converge into one neat pile with a
 * small physical offset, so a multi-card discard is thrown as ONE object
 * rather than N independent flights.
 */
export function stackOffset(index: number, count: number, unit: number): {dx: number, dy: number, rotation: number} {
  const centered = index - (count - 1) / 2;
  return {
    dx: centered * 3 * unit,
    dy: centered * 2 * unit,
    rotation: centered * 2.4,
  };
}

/**
 * Where the packet is squared up: the CENTROID of the cards' own positions, so
 * the gather happens where they were lying rather than at some arbitrary
 * "collection point" the player never looked at. Physical, not decorative.
 */
export function packetCentre(rects: ReadonlyArray<DiscardRect>): {x: number, y: number} {
  if (rects.length === 0) {
    return {x: 0, y: 0};
  }
  let x = 0;
  let y = 0;
  for (const r of rects) {
    x += r.left + r.width / 2;
    y += r.top + r.height / 2;
  }
  return {x: x / rects.length, y: y / rects.length};
}

/**
 * The squared-up packet pose. Much tighter than {@link stackOffset} (which is
 * the loose pile pose): a packet in a hand is a NEAT stack, offset just enough
 * that the player can count its edges and read the top card.
 */
export function packetOffset(index: number, count: number, unit: number): {dx: number, dy: number, rotation: number} {
  const centered = index - (count - 1) / 2;
  return {
    dx: centered * 1.6 * unit,
    dy: centered * 2.4 * unit,
    // Alternating, tiny — hand-squared, never machine-perfect.
    rotation: centered * 0.9 + pileJitterDeg(index) * 0.12,
  };
}

/**
 * The pile's own scatter — a discarded card never lands perfectly square.
 * Deterministic (index-derived): the same discard replays identically, and no
 * `Math.random()` sneaks into a replayable scene.
 */
export function pileJitterDeg(index: number): number {
  const wave = Math.sin((index + 1) * 2.399963);
  return Math.round(wave * 42) / 10;
}
