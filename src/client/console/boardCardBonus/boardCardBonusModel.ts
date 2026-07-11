/*
 * BOARD CARD-BONUS MODEL — the PURE timing/geometry plan of the console
 * "card bonus lifts off the board cell" cinematic (no DOM, no GSAP —
 * unit-tested under the server runner, like cardDealModel / tradeFleetModel).
 *
 * The story (consoleBoardCardBonus.ts / boardCardBonusDirector.ts): the
 * player places a tile on a cell printed with a card-back bonus. The SAME
 * cover art (assets/resources/card.webp — the board icon IS the console
 * card-back sleeve) physically separates from the cell BEFORE the tile
 * covers it, hovers while the server resolves, then travels into the
 * reveal space: a MULTI-card batch unpacks the one cover into N card
 * backs that fan into the exact reveal-modal slots and flip into the real
 * received cards; a SINGLE card flies to a presentation point flipping
 * mid-flight, and the fullscreen viewer physically lifts it out of the
 * scene (the existing zoom FLIP). Everything here is BASE milliseconds —
 * the director resolves through motionMs() so the whole choreography
 * follows the fork-wide speed presets.
 */

/** A plain rect (screen px) — DOMRect-compatible, test-friendly. */
export type RectLike = {left: number, top: number, width: number, height: number};

export type BonusSceneTimings = {
  /** The cover separates from the cell (rise + slight grow). */
  liftMs: number,
  /** One hover float half-period while awaiting the server (0 = static). */
  hoverLoopMs: number,
  /** The stacked covers travel cell → gather point (the shared leg). */
  gatherMs: number,
  /** Tiny per-cover lag on the shared leg (the stack reads as a packet). */
  gatherStaggerMs: number,
  /** One cover's gather point → reveal slot leg (the fan). */
  fanMs: number,
  /** Delay between consecutive fan launches. */
  fanStaggerMs: number,
  /** Portion of the fan leg spent completing the back→face flip (0..1). */
  flipPortion: number,
  /** Single-card: the cover's cell → presentation-point flight. */
  singleFlightMs: number,
  /** The reveal frame/backdrop materializes AROUND the landed cards. */
  frameMs: number,
  /** Proxy → real card crossfade (the handoff). */
  handoffMs: number,
  /** Abort: the cover returns to its cell (nothing was granted). */
  returnMs: number,
  /** Abort: the cover is absorbed into the freshly-placed tile. */
  absorbMs: number,
};

/** Confident pacing — calm lift, deliberate fan, never a popup. */
export function bonusSceneTimings(): BonusSceneTimings {
  return {
    liftMs: 300,
    hoverLoopMs: 1400,
    gatherMs: 360,
    gatherStaggerMs: 45,
    fanMs: 430,
    fanStaggerMs: 85,
    flipPortion: 0.55,
    singleFlightMs: 540,
    frameMs: 240,
    handoffMs: 170,
    returnMs: 240,
    absorbMs: 260,
  };
}

/**
 * Reduced motion: SHORT but still the full physical path (cell → reveal →
 * real cards) — the story must read, only faster and without float/fan
 * theatrics (mirrors reducedMarkerTimings / the deal's reduced fallback).
 */
export function reducedBonusSceneTimings(): BonusSceneTimings {
  return {
    liftMs: 70,
    hoverLoopMs: 0,
    gatherMs: 120,
    gatherStaggerMs: 0,
    fanMs: 160,
    fanStaggerMs: 40,
    flipPortion: 0.5,
    singleFlightMs: 180,
    frameMs: 100,
    handoffMs: 90,
    returnMs: 100,
    absorbMs: 110,
  };
}

/** Launch offset of cover i's fan leg (deterministic — no Math.random). */
export function fanDelayMs(index: number, t: BonusSceneTimings): number {
  return index * t.fanStaggerMs;
}

/** Total BASE duration of the multi-card transfer (safety budget). */
export function multiSceneBudgetMs(cardCount: number, t: BonusSceneTimings): number {
  const n = Math.max(1, cardCount);
  return t.gatherMs + fanDelayMs(n - 1, t) + t.fanMs + t.frameMs + t.handoffMs;
}

/** Total BASE duration of the single-card transfer (safety budget). */
export function singleSceneBudgetMs(t: BonusSceneTimings): number {
  return t.singleFlightMs + t.frameMs + t.handoffMs;
}

/**
 * How high the cover rises off its cell (px) — proportional to the icon so
 * a zoomed-out board still reads, clamped so it never leaves the hex area.
 */
export function coverLiftRise(coverHeight: number): number {
  return Math.min(40, Math.max(18, Math.round(coverHeight * 1.35)));
}

/**
 * The GATHER point of the multi-card transfer: where the packed covers
 * pause before fanning out. The centroid of the target slots, pulled 22%
 * back toward the cover (so the path reads cell → reveal, not a detour),
 * lifted slightly above the slot band and clamped clear of the top HUD.
 */
export function gatherPoint(cover: RectLike, targets: ReadonlyArray<RectLike>): {x: number, y: number} {
  if (targets.length === 0) {
    return {x: cover.left + cover.width / 2, y: Math.max(120, cover.top - 60)};
  }
  let cx = 0;
  let cy = 0;
  for (const r of targets) {
    cx += r.left + r.width / 2;
    cy += r.top + r.height / 2;
  }
  cx /= targets.length;
  cy /= targets.length;
  const coverCx = cover.left + cover.width / 2;
  const coverCy = cover.top + cover.height / 2;
  return {
    x: cx + (coverCx - cx) * 0.22,
    y: Math.max(120, cy + (coverCy - cy) * 0.22 - 40),
  };
}

/**
 * The SINGLE-card presentation point: centre-screen, slightly above the
 * middle, sized to a readable mid-scale card (~a third of the viewport
 * height) — the fullscreen viewer then physically lifts it from there
 * (the existing zoom FLIP), so this is a hand-over pose, not the finale.
 */
export function presentationTarget(
  viewportW: number, viewportH: number, naturalW: number, naturalH: number,
): {x: number, y: number, scale: number} {
  const scale = Math.min(0.5, Math.max(0.28, (viewportH * 0.34) / Math.max(1, naturalH)));
  void naturalW; // the card keeps its aspect — only the height drives scale
  return {x: viewportW / 2, y: viewportH * 0.44, scale};
}
