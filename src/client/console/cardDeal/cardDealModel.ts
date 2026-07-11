/*
 * CARD DEAL MODEL — the PURE timing/geometry plan of the console card-deal
 * cinematic (no DOM, no GSAP — unit-tested under the server runner).
 *
 * The deal is the console-native "dealer" moment: lightweight proxy cards
 * fly from a deck anchor at the bottom of the screen into the EXACT slots
 * where the real interactive cards already sit (hidden), half-flipping
 * from card back to face mid-flight, then hand off to the real card.
 *
 * Everything here is BASE milliseconds — the director resolves every value
 * through `motionMs()` (the fork-wide speed-preset channel) when building
 * the GSAP timeline, so the whole choreography scales with `--motion-scale`.
 * Reduced motion never reaches the director at all (the sequence falls back
 * to a short staggered reveal — see cardDealSequence.ts).
 */

export type DealTimings = {
  /** Deck stack rise-in at the bottom of the screen. */
  deckRiseMs: number,
  /** Beat between the deck appearing and the first card leaving it. */
  deckPulseMs: number,
  /** One card's flight from deck to slot. */
  flightMs: number,
  /** Delay between consecutive card launches. */
  staggerMs: number,
  /** Portion of the flight spent completing the back→face half-flip (0..1). */
  flipPortion: number,
  /** Proxy fade-out at landing (the real card fades in underneath). */
  handoffMs: number,
  /** Deck stack drop-out after the last card leaves. */
  deckExitMs: number,
};

/** Per-card launch plan (deterministic — no Math.random, test-friendly). */
export type DealFlight = {
  /** Launch offset from the deal start (after deck rise + pulse). */
  delayMs: number,
  /** Starting Z-rotation jitter in degrees (settles to 0 in flight). */
  rotZFrom: number,
};

/**
 * Confident pacing: a small hand (≤6 — corp picks, preludes, draft rows)
 * deals deliberately; a wide grid (10 starting projects) tightens the
 * stagger so the whole sequence stays under ~1.5s.
 */
export function dealTimings(cardCount: number): DealTimings {
  const wide = cardCount > 6;
  return {
    deckRiseMs: 150,
    deckPulseMs: 90,
    flightMs: wide ? 380 : 420,
    staggerMs: wide ? 70 : 95,
    flipPortion: 0.55,
    handoffMs: 130,
    deckExitMs: 180,
  };
}

/**
 * Deterministic per-card rotation jitter: alternating sides, varying
 * magnitude (−6°..+6°), stable across re-runs (important for the resume /
 * test story — the fork bans Math.random in choreography plans).
 */
export function flightPlan(index: number, timings: DealTimings): DealFlight {
  const magnitude = 2 + ((index * 137) % 5); // 2..6
  const sign = index % 2 === 0 ? -1 : 1;
  return {
    delayMs: timings.deckRiseMs + timings.deckPulseMs + index * timings.staggerMs,
    rotZFrom: sign * magnitude,
  };
}

/** Total BASE duration of the whole sequence (safety-timeout budget). */
export function dealTotalMs(cardCount: number, timings: DealTimings): number {
  if (cardCount <= 0) {
    return 0;
  }
  const lastLaunch = flightPlan(cardCount - 1, timings).delayMs;
  return lastLaunch + timings.flightMs + Math.max(timings.handoffMs, timings.deckExitMs);
}

/**
 * The reveal moment WITHIN one card's flight (0..1 of flightMs) — the real
 * slot starts fading in slightly BEFORE the proxy finishes settling, so the
 * handoff reads as one continuous materialization, never a swap.
 */
export const REVEAL_AT = 0.86;
/** Proxy fade-out start within the flight (overlaps the slot fade-in). */
export const HANDOFF_AT = 0.92;

/**
 * The natural (unscaled) card width — mirrors the premium face
 * (`.pcard { width: 320px }`). Every card these cinematics fly (hand /
 * draft / research / reveal) is a project or prelude card, i.e. premium;
 * with the proxy box at 320 × (320/aspect) a premium target resolves to
 * exactly 320×460 — the pcard's own natural size, no stretch.
 */
export const CARD_NATURAL_W = 320;

/** Deck presentation scale (card backs in the stack, ~108px wide). */
export const DECK_SCALE = 0.36;

/** Reduced-motion fallback: short staggered reveal (no proxies, no flight). */
export const REDUCED_REVEAL_STEP_MS = 30;

/* ── The RESEARCH RISE — the draft→research phase transition scene ──────
 * The drafted pile physically becomes the research row: the auto-passed
 * last card(s) ARRIVE into the tray (deck → tray slot, flipping), the
 * completed set pulses once, then the whole pile LIFTS OFF and each card
 * flies into its research-row slot; the modal frame materializes AROUND
 * the landed cards, and only then do the proxies dissolve into the real
 * interactive cards. Pure numbers here — the director resolves through
 * motionMs(); reduced motion never reaches it (sequence short-circuits).
 */
export type RiseTimings = {
  /** One arriving card's deck → tray-slot flight (back→face flip). */
  arrivalFlightMs: number,
  /** Stagger between several arrivals (rare — usually exactly one). */
  arrivalStaggerMs: number,
  /** Settle beat after the last arrival lands, before the pulse. */
  arrivalSettleMs: number,
  /** The «set complete» pulse of the whole pile. */
  pulseMs: number,
  /** Readable hold after the pulse — the player registers the full set. */
  setHoldMs: number,
  /** Group lift-off: the pile comes off the table (staggered). */
  liftMs: number,
  liftStaggerMs: number,
  /** One card's flight tray → research-row slot (grows to row scale). */
  flightMs: number,
  flightStaggerMs: number,
  /** Frame/backdrop materialization around the landed row. */
  frameMs: number,
  /** Proxy → real card crossfade after the frame is up. */
  handoffMs: number,
};

/** Confident pacing; a wide set (Luna Project Office 5+ buys) tightens. */
export function riseTimings(cardCount: number): RiseTimings {
  const wide = cardCount > 6;
  return {
    arrivalFlightMs: 420,
    arrivalStaggerMs: 90,
    arrivalSettleMs: 100,
    pulseMs: 220,
    setHoldMs: 200,
    liftMs: 160,
    liftStaggerMs: 40,
    flightMs: wide ? 380 : 430,
    flightStaggerMs: wide ? 55 : 75,
    frameMs: 240,
    handoffMs: 130,
  };
}

/** Launch offset of card i's tray→row flight, from the lift-off start. */
export function riseFlightDelayMs(index: number, t: RiseTimings): number {
  return t.liftMs + index * t.flightStaggerMs;
}

/** Total BASE duration of the rise scene (safety-timeout budget). */
export function riseTotalMs(cardCount: number, arrivals: number, t: RiseTimings): number {
  if (cardCount <= 0) {
    return 0;
  }
  const arrival = arrivals > 0 ?
    t.arrivalFlightMs + (arrivals - 1) * t.arrivalStaggerMs + t.arrivalSettleMs : 0;
  const set = t.pulseMs + t.setHoldMs;
  const flights = riseFlightDelayMs(cardCount - 1, t) + t.flightMs;
  return arrival + set + flights + t.frameMs + t.handoffMs;
}
