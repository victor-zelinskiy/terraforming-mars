/*
 * CARD DISCARD — the PURE half of the console's "a card physically leaves the
 * hand" cinematic (phases, timings, geometry, the server-truth diff).
 *
 * No Vue, no DOM, no GSAP: everything here is unit-tested under the server
 * runner (tests/client/components/console/discardModel.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';

/**
 * The scene's phase ladder. It runs in this order on EVERY path, including the
 * degraded ones (reduced motion / off-screen sources / a JSDOM test), so the
 * shell watchers that key off a phase can never desynchronise.
 *
 *  idle      — nothing armed.
 *  armed     — the player answered; sources captured, the server round-trip is
 *              in flight. Nothing is on screen yet.
 *  seizing   — the proxies stand over the real hand cards (which are held
 *              empty) and lift: "these are the ones".
 *  leaving   — the pick surface hands off (the shell closes the hand section;
 *              the survivors fly home to the dock) and the tray slides in.
 *  consuming — the cards turn face-down and are tossed onto the pile; the
 *              count ticks on contact.
 *  settling  — the pile acknowledges, the tray withdraws.
 *  failed    — the server did NOT take the cards: no fake disposal is drawn.
 */
export type DiscardPhase = 'idle' | 'armed' | 'seizing' | 'leaving' | 'consuming' | 'settling' | 'failed';

/** The scene owns the foreground for every phase that has something on screen. */
export function discardPhaseHolds(phase: DiscardPhase): boolean {
  return phase !== 'idle' && phase !== 'armed' && phase !== 'failed';
}

export type DiscardTimings = {
  /** The lift out of the hand slot. */
  seizeMs: number,
  /** The readable beat at the top of the lift — "this one is going". */
  condemnMs: number,
  /** The tray sliding into the scene. */
  trayInMs: number,
  /** The toss onto the pile. */
  tossMs: number,
  /** The face→back turn, overlapped with the toss. */
  turnMs: number,
  /** The pile's acknowledgement + the tray withdrawing. */
  settleMs: number,
  /** Per-card offset in a multi-card discard. */
  stepMs: number,
};

export const DISCARD_TIMINGS: DiscardTimings = {
  seizeMs: 200,
  condemnMs: 150,
  trayInMs: 220,
  tossMs: 460,
  turnMs: 360,
  settleMs: 280,
  stepMs: 90,
};

/** Reduced motion keeps the ladder but collapses every beat to a short fade. */
export const DISCARD_TIMINGS_REDUCED: DiscardTimings = {
  seizeMs: 80,
  condemnMs: 0,
  trayInMs: 80,
  tossMs: 140,
  turnMs: 100,
  settleMs: 100,
  stepMs: 30,
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
 * The pile's own scatter — a discarded card never lands perfectly square.
 * Deterministic (index-derived): the same discard replays identically, and no
 * `Math.random()` sneaks into a replayable scene.
 */
export function pileJitterDeg(index: number): number {
  const wave = Math.sin((index + 1) * 2.399963);
  return Math.round(wave * 42) / 10;
}
