/*
 * HYDRO DRAW MODEL — the PURE timing/geometry plan of the «Гидромоделирование»
 * card flight (Delta stage 5: "look at 4 cards, take up to 2"). No DOM, no
 * GSAP — unit-tested under the server runner, like boardCardBonusModel /
 * cardDealModel / hydroMarkerModel.
 *
 * THE STORY (hydroDrawDirector.ts / ConsoleHydroDrawLayer.vue). The marker has
 * just glided to its new stop, so THAT CELL is where the player is looking. The
 * four cards come out of it: a tight face-down stack rises from the cell, opens
 * into a fan that breathes for a beat, then travels as a group into the pick
 * modal's exact slots, flipping face-up on the way.
 *
 * WHY ITS OWN MODEL rather than the board card-bonus timings: the bonus is ONE
 * cover leaving a board icon while the server thinks — brisk on purpose. This
 * is a four-card presentation the player is meant to WATCH, so every beat is
 * longer and every junction is smoothed. Everything here is BASE milliseconds;
 * the director resolves them through motionMs(), so the fork-wide speed presets
 * (calm / standard / swift) scale the whole scene in lockstep.
 */

/** A plain rect (screen px) — DOMRect-compatible, test-friendly. */
export type RectLike = {left: number, top: number, width: number, height: number};

export type HydroDrawTimings = {
  /** One card's rise out of the cell into its place in the fan. */
  emergeMs: number,
  /** Lag between consecutive cards leaving the stack (the fan opens). */
  emergeStaggerMs: number,
  /** The completed fan holds — the beat that makes it read as a presentation. */
  fanHoldMs: number,
  /** One card's fan → slot leg (position, scale, rotation and flip all ride it). */
  travelMs: number,
  /** Lag between consecutive departures (the group moves, not a rank). */
  travelStaggerMs: number,
  /**
   * Portion of the travel by which the VERTICAL tween lags the horizontal one.
   * The two axes stay single continuous tweens (so there is no junction and no
   * possible jerk); the lag alone bows the path into an arc.
   */
  travelArcLag: number,
  /** Where in the travel the flip starts, and how much of it the flip takes. */
  flipStartPortion: number,
  flipPortion: number,
  /** The modal frame materializes around the landed cards. */
  frameMs: number,
  /** Proxy → real card crossfade (the handoff). */
  handoffMs: number,
};

/**
 * Deliberately unhurried: the player just watched the marker land and is now
 * being shown what that stop pays out. Roughly twice the board-bonus pacing.
 */
export function hydroDrawTimings(): HydroDrawTimings {
  return {
    emergeMs: 560,
    emergeStaggerMs: 75,
    fanHoldMs: 220,
    travelMs: 820,
    travelStaggerMs: 85,
    travelArcLag: 0.12,
    flipStartPortion: 0.16,
    flipPortion: 0.52,
    frameMs: 340,
    handoffMs: 240,
  };
}

/**
 * Reduced motion: the full path still reads (cell → fan → slots), only short
 * and without the presentation beat — mirrors the other console scenes.
 */
export function reducedHydroDrawTimings(): HydroDrawTimings {
  return {
    emergeMs: 150,
    emergeStaggerMs: 20,
    fanHoldMs: 0,
    travelMs: 240,
    travelStaggerMs: 30,
    travelArcLag: 0,
    flipStartPortion: 0.1,
    flipPortion: 0.5,
    frameMs: 120,
    handoffMs: 110,
  };
}

/** When card `index` starts rising out of the cell. */
export function emergeDelayMs(index: number, t: HydroDrawTimings): number {
  return index * t.emergeStaggerMs;
}

/**
 * When card `index` leaves the fan. Every card waits for the WHOLE fan to be
 * open (plus its hold) before any of them departs — the group travels together.
 */
export function travelDelayMs(index: number, count: number, t: HydroDrawTimings): number {
  const fanComplete = emergeDelayMs(Math.max(0, count - 1), t) + t.emergeMs + t.fanHoldMs;
  return fanComplete + index * t.travelStaggerMs;
}

/** Total BASE duration of the flight (the layer's safety budget). */
export function hydroSceneBudgetMs(count: number, t: HydroDrawTimings): number {
  const n = Math.max(1, count);
  return travelDelayMs(n - 1, n, t) + t.travelMs + t.frameMs + t.handoffMs;
}

/** One card's place in the opened fan, in CARD-SIZE units (not px). */
export type HydroFanOffset = {
  /** Horizontal offset in card WIDTHS (negative = left of centre). */
  spread: number,
  /** Vertical offset in card HEIGHTS (positive = lower — the fan's arc). */
  drop: number,
  /** Tilt in degrees. */
  rot: number,
};

/** How much of a card width separates neighbours (they overlap by the rest). */
const FAN_SPREAD_STEP = 0.62;
/** Tilt of the outermost cards, degrees per step from the centre. */
const FAN_ROT_STEP = 6.5;
/** How far the outer cards ride below the middle ones (in card heights). */
const FAN_ARC_DROP = 0.055;

/**
 * A symmetric hand-of-cards fan: evenly spread, tilted away from the centre,
 * outer cards riding slightly lower — the shape a fanned hand actually makes.
 * A single card gets a dead-centre, untilted pose.
 */
export function hydroFanOffsets(count: number): ReadonlyArray<HydroFanOffset> {
  const n = Math.max(0, count);
  const mid = (n - 1) / 2;
  const out: Array<HydroFanOffset> = [];
  for (let i = 0; i < n; i++) {
    const step = i - mid;
    out.push({
      spread: step * FAN_SPREAD_STEP,
      drop: Math.pow(Math.abs(step), 1.4) * FAN_ARC_DROP,
      rot: step * FAN_ROT_STEP,
    });
  }
  return out;
}

/** Where the stack sits inside the cell before it rises (card widths/heights). */
export function stackOffset(index: number): {dx: number, dy: number} {
  return {dx: (index % 2 === 0 ? -1 : 1) * index * 0.012, dy: index * 0.018};
}

/**
 * How far along the cell → modal path the fan opens. The two axes are tuned
 * separately on purpose: horizontally the fan stays close to the cell (it must
 * read as belonging to that stop), while vertically it moves a little further
 * so a fanned card — several times taller than the rail cell — does not sit on
 * top of the very cell it just came out of. Still well under halfway, so the
 * travel leg keeps a real distance to cover.
 */
const FAN_PULL_X = 0.30;
const FAN_PULL_Y = 0.38;

/**
 * WHERE THE FAN OPENS: on the path from the cell toward the modal row, but
 * still close enough to the cell to read as "these came out of THAT stop".
 * Clamped away from the viewport edges so a rail stop near a corner cannot
 * push the fan off screen.
 */
export function hydroFanCentre(
  cell: RectLike,
  targets: ReadonlyArray<RectLike>,
  viewport: {width: number, height: number},
  margin: number,
): {x: number, y: number} {
  const cx = cell.left + cell.width / 2;
  const cy = cell.top + cell.height / 2;
  if (targets.length === 0) {
    return {x: cx, y: cy};
  }
  let tx = 0;
  let ty = 0;
  for (const r of targets) {
    tx += r.left + r.width / 2;
    ty += r.top + r.height / 2;
  }
  tx /= targets.length;
  ty /= targets.length;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp(cx + (tx - cx) * FAN_PULL_X, margin, Math.max(margin, viewport.width - margin)),
    y: clamp(cy + (ty - cy) * FAN_PULL_Y, margin, Math.max(margin, viewport.height - margin)),
  };
}

/**
 * The card silhouette the stack starts as: a card-shaped rect INSIDE the track
 * cell (a fraction of its width, centred), so the cards visibly come out of the
 * cell rather than replacing it.
 */
export function stackStartRect(cell: RectLike, aspect: number): RectLike {
  const w = Math.max(6, cell.width * 0.46);
  const h = w / aspect;
  return {
    left: cell.left + (cell.width - w) / 2,
    top: cell.top + (cell.height - h) / 2,
    width: w,
    height: h,
  };
}
