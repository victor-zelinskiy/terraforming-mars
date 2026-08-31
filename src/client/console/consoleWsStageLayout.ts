/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE EMBEDDED WORKSPACE STAGE LAYOUT — one geometry brain for every card
 * result a workspace shows.
 *
 * `cardStripFit.fitRowZoom` already made the buy pick and the drawn reveal
 * derive their card SIZE from one formula. This is the next layer of the same
 * discipline, because size alone was not enough:
 *
 *  · the GAP was a CSS constant, so a focused card's emphasis (scale + ring)
 *    grew over its neighbour — the bigger the profile, the worse;
 *  · the row was always ONE row, so a large batch could only get smaller;
 *  · the count-driven ladders that tried to compensate lived per host.
 *
 * So the gap is SOLVED together with the zoom instead of being an input:
 *
 *      gap = focusOverhang(zoom) + glowPad          (focus-safe by construction)
 *      row = n·slotW·zoom + (n−1)·gap  ≤  availW
 *
 * which is linear in `zoom` and therefore has a closed form — no iteration, no
 * measure-loop, no circularity (the classic way a fit engine oscillates).
 *
 * PURE (no DOM, no Vue): hosts measure their own band and pass numbers, the
 * same contract `fitRowZoom` established. Unit-tested.
 */

import {fitRowZoom} from '@/client/console/cardStripFit';

/**
 * The focus emphasis of an embedded stage slot. Deliberately SMALLER than the
 * hand/draft carousel's 1.08: on a stage the neighbours are the same decision,
 * so the focused card must read as SELECTED, not as a different-sized card.
 * The weight of the cue is carried by the ring + depth (both `box-shadow`, so
 * they survive performance mode), not by growth.
 *
 * Mirrored in LESS as `--con-ws-focus-scale`; the layout RESERVES exactly this
 * much room, so the two must move together — that is why it is a shared export
 * and not two constants.
 */
export const WS_STAGE_FOCUS_SCALE = 1.045;

/** Ring + glow headroom around a focused slot, in rem-equivalent px at ui 1. */
const FOCUS_GLOW_PX = 9;

/** The gap never collapses below this, however tight the band (Steam Deck). */
const MIN_GAP_PX = 10;

/**
 * THE PUBLISHED GRID — the precision `wsStageLayoutStyle` serializes with.
 *
 * A layout is only real once it is a STRING in the cascade, and `toFixed`
 * ROUNDS: a zoom of 1.136957 renders as `1.137` and a gap of 26.186 renders as
 * `26.19`. Both are LARGER than the values the shape was solved for, and the
 * wrap cap was computed from the solved ones — so a seven-card stage on a 4K TV
 * asked for a line 1533.93 px wide inside a cap whose content box was 1533.87.
 * `flex-wrap` obeys the 0.06 px, breaks the fourth card off, and the "4 + 3"
 * the engine chose renders as 3 + 3 + 1, clipped top and bottom.
 *
 * So the solver SNAPS onto this grid itself, downwards, before anything is
 * derived from a number: the zoom that feeds the height check, the gap that
 * feeds the width check and the cap are then the exact values that will be
 * painted. Same discipline as «compare on the value that will render», one
 * layer lower.
 */
const ZOOM_STEP = 1e3;  // `toFixed(3)`
const GAP_STEP = 1e2;   // `toFixed(2)`

/**
 * Snap DOWN onto the published grid. Down, never nearest: every consumer of
 * these numbers is a BUDGET check, and a value below the solved one can only
 * fit better. The epsilon absorbs binary representation (3.8 × 1000 is
 * 3800.0000000000005 on one side and 1.137 × 1000 is 1136.9999999999998 on the
 * other), so a value already on the grid costs no step.
 */
function snapDown(value: number, scale: number): number {
  return Math.floor(value * scale + 1e-6) / scale;
}

/**
 * Snap UP onto the published grid — the direction a GAP has to round.
 *
 * A gap is not a budget, it is a CLEARANCE: it exists so a focused card's
 * emphasis and ring never reach its neighbour, so rounding it down breaks the
 * property the whole engine is built to guarantee. Rounding it up is free
 * because the zoom is back-solved against the gap that is actually published,
 * a few lines below — the row still fits.
 */
function snapUp(value: number, scale: number): number {
  return Math.ceil(value * scale - 1e-6) / scale;
}

/**
 * Sub-pixel headroom kept off the vertical budget, in rem-equivalent px.
 *
 * The width already keeps 2 % (see `shapeZoom`); the height kept nothing, so a
 * height-bound shape solved to fill its band EXACTLY — and a browser laying out
 * on 1/64 px units then clips a hair off a card that mathematically fits. The
 * cost is ~0.1 % of a card; the failure it removes is a visibly cropped row.
 */
const SUBPIXEL_PX = 0.5;

/**
 * The largest a card may ever be drawn, in slot widths. A CEILING is safe —
 * it can only make a shape fit better.
 *
 * There is deliberately NO floor any more. A floor is a readability courtesy;
 * `shapeZoom` already returns the LARGEST zoom that fits, so raising a result
 * to a floor is by definition asking for a card that does not fit — and that
 * is precisely what shipped: a seven-card reveal on a 4K profile solved three
 * rows whose raw zoom was under the floor, got clamped UP to it, then beat the
 * feasible two-row shape in the comparison and rendered clipped top AND bottom
 * with no way to scroll to what was cut off. Small honest cards beat cropped
 * ones every time.
 */
const MAX_ZOOM = 1.9;

/** Rows are considered up to here; beyond it the batch is not a stage case. */
const MAX_ROWS = 3;

/**
 * A second row only wins if it makes the cards THIS much bigger.
 *
 * It started at 1.18 — «wrapping has to EARN the break» — which is right for a
 * two- or three-card result. It is wrong for a SEVEN-card reveal on a 4K TV: a
 * single line of seven is width-bound long before it is height-bound, so the
 * engine kept a strip of small cards across the whole band with half the height
 * unused, and the composition read as a web carousel rather than a placed
 * scene. The break is cheap when the row is already the full width of the band
 * — what it costs (one reading line becomes two) is repaid by every card being
 * bigger AND by the group becoming a block instead of a stripe.
 *
 * Kept above 1 so a genuine tie still prefers the single line.
 */
const WRAP_GAIN = 1.03;

export type WsStageLayoutInput = {
  /** Content-box width available to the row (padding already subtracted). */
  availW: number;
  /** Vertical band budget for the card rows themselves. */
  availH: number;
  /** One slot's UNZOOMED box (offsetWidth/Height at zoom 1). */
  slotW: number;
  slotH: number;
  /** Cards in the batch. */
  n: number;
  /** `conUiScale()` — the TV rem factor; caps, floors and pads ride it. */
  ui: number;
  /** Gap between wrapped rows (px); defaults to the column gap. */
  rowGapPx?: number;
  /**
   * The row element's own horizontal padding (px). Only used to publish the
   * WRAP CAP below — pass it and the row breaks where the layout says it
   * breaks; omit it and the cap is not published (the historical behaviour).
   */
  padXPx?: number;
};

export type WsStageLayout = {
  /** The slot `zoom` (the shared `--con-cards-zoom` contract). */
  zoom: number;
  /** The focus-safe column gap in px — the row's `column-gap`. */
  gapPx: number;
  /** Gap between wrapped rows in px. */
  rowGapPx: number;
  /** How many rows the batch is laid out in. */
  rows: number;
  /** Cards per row (the last row may hold fewer). */
  perRow: number;
  /**
   * THE WRAP CAP — the row's `max-width`, or `undefined` when the caller did
   * not pass its padding.
   *
   * A solved shape is only real if the row actually breaks where it was solved
   * to break. `flex-wrap` breaks on the AVAILABLE width, and the zoom is
   * frequently bound by HEIGHT (two rows have to fit vertically), which leaves
   * the line narrower than the room — so seven cards planned as 4+3 wrapped as
   * 6+1, an orphan the engine never chose. Capping the line to exactly the
   * planned row makes the break an output like everything else.
   */
  rowMaxPx?: number;
};

/** The lateral room ONE focused slot needs beyond its own box, in px. */
export function focusHeadroomPx(renderedSlotW: number, ui: number): number {
  return renderedSlotW * (WS_STAGE_FOCUS_SCALE - 1) / 2 + FOCUS_GLOW_PX * ui;
}

/** Breathing room between the source seat and the nearest card, in px @1×. */
const SEAT_CLEARANCE_PX = 18;

/**
 * THE SOURCE SEAT'S SAFE ZONE, measured off the real seat — or 0 when no host
 * is standing one.
 *
 * A host may park a compact SOURCE card at the left of its embed zone (the
 * Hydronetwork's repeated action, the start workspace's play-from-hand step).
 * The card group is CENTRED, so reserving this width on BOTH sides of the
 * budget is what guarantees the group's margin can never be narrower than the
 * seat: the two simply never occupy the same space, in any phase, at any focus
 * scale. Not a z-index, not an overlap the eye forgives.
 *
 * ⚠️ MEASURED, never read from the custom property that declares the seat's
 * width: `getPropertyValue('--x')` returns a `calc(...)` token UNRESOLVED, so
 * `parseFloat` gives NaN and the reserve silently disappears. And never
 * expressed as row `padding` either — the profile ladders re-declare that
 * shorthand, which is how the inset vanished at 4K and the source card sat on
 * top of the first revealed card.
 *
 * ONE definition, read by every stage that can host a seat: the deck pick and
 * the drawn reveal both present inside the same zones, and two copies of this
 * arithmetic is exactly how one of them ends up cropping.
 */
export function sourceSeatReservePx(ui: number): number {
  if (typeof document === 'undefined') {
    return 0;
  }
  const seat = document.querySelector<HTMLElement>('[data-embed-source-slot]');
  const w = seat?.getBoundingClientRect().width ?? 0;
  return w > 4 ? w + SEAT_CLEARANCE_PX * ui : 0;
}

/**
 * Solve one candidate row shape. Returns the zoom this shape can afford.
 *
 * Width: `perRow·slotW·z + (perRow−1)·gap ≤ 0.98·availW`, with the gap itself
 * a function of `z` — hence the closed form below. Horizontally the gap is the
 * ONLY thing standing between two cards, so the focus clearance has to be
 * bought here.
 *
 * Height: the budget is the row's CONTENT box — the caller has already
 * subtracted the row's own padding — and that padding is exactly what the
 * focused card's vertical growth (and its pick band) live in. Reserving the
 * emphasis a second time here cost the hero ~4.5 % of its height for nothing,
 * which is why the divisor is 1 and the contract is stated instead: the row's
 * `padding-top` must clear `focusHeadroomPx` (it does, on every profile — the
 * pick band alone needs more).
 */
function shapeZoom(o: WsStageLayoutInput, rows: number, perRow: number, rowGap: number): number {
  const a = (WS_STAGE_FOCUS_SCALE - 1) / 2;
  const b = FOCUS_GLOW_PX * o.ui;
  const gaps = Math.max(0, perRow - 1);
  const wBudget = 0.98 * o.availW - gaps * b;
  const wDenom = o.slotW * (perRow + gaps * a);
  const zW = wDenom > 0 ? wBudget / wDenom : 0;
  const hBudget = o.availH - (rows - 1) * rowGap - SUBPIXEL_PX * o.ui;
  const hDenom = rows * o.slotH;
  const zH = hDenom > 0 ? hBudget / hDenom : 0;
  return Math.min(zW, zH);
}

/**
 * THE layout. Adaptive by measurement, never by a per-count ladder:
 *
 *  · 1 card  — one big, centred hero (the whole band is its own);
 *  · 2 cards — a symmetric pair;
 *  · 3+      — a single row as long as a single row is genuinely better;
 *  · beyond  — wrap, but only when wrapping makes the cards visibly bigger.
 *
 * Every card in the batch gets the SAME base size in every shape — the only
 * thing that ever differs between two cards on this stage is which one holds
 * the focus, and that is a ring, not a size.
 */
export function wsStageLayout(o: WsStageLayoutInput): WsStageLayout {
  const n = Math.max(1, Math.floor(o.n));
  const rowGapPx = snapUp(o.rowGapPx ?? Math.max(MIN_GAP_PX * o.ui, 12 * o.ui), GAP_STEP);
  let best: WsStageLayout | undefined;
  for (let rows = 1; rows <= Math.min(MAX_ROWS, n); rows++) {
    const perRow = Math.ceil(n / rows);
    // A shape that does not actually use all its rows is the same shape with
    // fewer rows (4 cards in 3 rows of 2 is 2 rows) — skip the duplicate.
    if (Math.ceil(n / perRow) !== rows) {
      continue;
    }
    // The CEILING only (see MAX_ZOOM): `shapeZoom` already returns the largest
    // zoom this shape can afford, so anything above it overflows by
    // construction — and shapes are compared on this same value, so an
    // infeasible one can never out-score a feasible one.
    const raw = Math.min(MAX_ZOOM * o.ui, shapeZoom(o, rows, perRow, rowGapPx));
    const gapPx = snapUp(
      Math.max(MIN_GAP_PX * o.ui, focusHeadroomPx(o.slotW * raw, o.ui)), GAP_STEP);
    // BACK-SOLVE against the gap we are actually going to use. `shapeZoom`
    // solves the gap as a function of the zoom (focus headroom), but the gap
    // ALSO has a floor — and on a starved band that floor is the larger of the
    // two, so the row ended up wider than the budget the zoom was solved for.
    // One pass is exact: shrinking the zoom can only shrink the headroom, at
    // which point the floor dominates and the gap stops moving.
    const gaps = Math.max(0, perRow - 1);
    const fitW = perRow * o.slotW > 0 ?
      (0.98 * o.availW - gaps * gapPx) / (perRow * o.slotW) :
      raw;
    const zoom = snapDown(Math.max(0, Math.min(raw, fitW)), ZOOM_STEP);
    const candidate: WsStageLayout = {
      zoom, gapPx, rowGapPx, rows, perRow,
      // THE CAP SITS AT THE MIDPOINT, not on the shape's own width. Its only
      // job is to be a number that fits `perRow` cards and not `perRow + 1`,
      // and those two widths are a WHOLE CARD apart — so pinning it to the
      // first of them spends the entire tolerance on the wrong side and lets
      // any sub-pixel disagreement (layout units, a `zoom` factor rounded by
      // the compositor, a profile ladder's fractional padding) break a card
      // off the line. Half a card of slack is invisible — the group is centred
      // inside the cap — and puts the failure ~190 px away instead of 0.06.
      rowMaxPx: o.padXPx === undefined ? undefined :
        perRow * o.slotW * zoom + gaps * gapPx + o.padXPx +
        (o.slotW * zoom + gapPx) / 2,
    };
    if (best === undefined) {
      best = candidate;
      continue;
    }
    // Fewer rows always wins ties: a single reading line is the default, and
    // wrapping has to EARN the break by a visible size gain.
    if (candidate.zoom > best.zoom * WRAP_GAIN) {
      best = candidate;
    }
  }
  return best ?? {
    zoom: snapDown(Math.min(MAX_ZOOM * o.ui, fitRowZoom({
      availW: o.availW, availH: o.availH, slotW: o.slotW, slotH: o.slotH,
      n, colGap: MIN_GAP_PX * o.ui, ui: o.ui,
    })), ZOOM_STEP),
    gapPx: snapUp(MIN_GAP_PX * o.ui, GAP_STEP),
    rowGapPx,
    rows: 1,
    perRow: n,
  };
}

/**
 * The CSS custom properties a host publishes on its row from a layout. ONE
 * writer, so the reveal stage and the buy stage cannot drift in how they apply
 * the same numbers.
 *
 * The `toFixed` calls below are LOSSLESS by construction — `wsStageLayout`
 * snapped every value onto this precision (`ZOOM_STEP` / `GAP_STEP`) before
 * deriving anything from it — which is the whole point: what the solver
 * checked its budgets against is exactly what the browser lays out.
 */
export function wsStageLayoutStyle(l: WsStageLayout): Record<string, string> {
  return {
    '--con-cards-zoom': l.zoom.toFixed(3),
    '--con-ws-stage-gap': `${l.gapPx.toFixed(2)}px`,
    '--con-ws-stage-rowgap': `${l.rowGapPx.toFixed(2)}px`,
    '--con-ws-focus-scale': `${WS_STAGE_FOCUS_SCALE}`,
    '--con-ws-stage-per-row': `${l.perRow}`,
    // `100%` = "no cap" — a single-row shape needs none, and a caller that
    // passed no padding gets the historical behaviour unchanged.
    '--con-ws-stage-rowmax': l.rowMaxPx === undefined || l.rows <= 1 ?
      '100%' : `${l.rowMaxPx.toFixed(2)}px`,
  };
}
