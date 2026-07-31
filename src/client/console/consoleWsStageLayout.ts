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

/** Rows are considered up to here; beyond it the batch is not a stage case. */
const MAX_ROWS = 3;

/**
 * A second row only wins if it makes the cards THIS much bigger. Wrapping is a
 * real cost (the reading order stops being a line), so it has to buy something
 * the player can see — never a 3 % gain that just rearranges the composition.
 */
const WRAP_GAIN = 1.18;

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
};

/** The lateral room ONE focused slot needs beyond its own box, in px. */
export function focusHeadroomPx(renderedSlotW: number, ui: number): number {
  return renderedSlotW * (WS_STAGE_FOCUS_SCALE - 1) / 2 + FOCUS_GLOW_PX * ui;
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
  const hBudget = o.availH - (rows - 1) * rowGap;
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
  const rowGapPx = o.rowGapPx ?? Math.max(MIN_GAP_PX * o.ui, 12 * o.ui);
  let best: WsStageLayout | undefined;
  for (let rows = 1; rows <= Math.min(MAX_ROWS, n); rows++) {
    const perRow = Math.ceil(n / rows);
    // A shape that does not actually use all its rows is the same shape with
    // fewer rows (4 cards in 3 rows of 2 is 2 rows) — skip the duplicate.
    if (Math.ceil(n / perRow) !== rows) {
      continue;
    }
    const raw = shapeZoom(o, rows, perRow, rowGapPx);
    const zoom = Math.min(1.9 * o.ui, Math.max(0.42 * o.ui, raw));
    const gapPx = Math.max(MIN_GAP_PX * o.ui, focusHeadroomPx(o.slotW * zoom, o.ui));
    const candidate: WsStageLayout = {zoom, gapPx, rowGapPx, rows, perRow};
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
    zoom: fitRowZoom({
      availW: o.availW, availH: o.availH, slotW: o.slotW, slotH: o.slotH,
      n, colGap: MIN_GAP_PX * o.ui, ui: o.ui,
    }),
    gapPx: MIN_GAP_PX * o.ui,
    rowGapPx,
    rows: 1,
    perRow: n,
  };
}

/**
 * The CSS custom properties a host publishes on its row from a layout. ONE
 * writer, so the reveal stage and the buy stage cannot drift in how they apply
 * the same numbers.
 */
export function wsStageLayoutStyle(l: WsStageLayout): Record<string, string> {
  return {
    '--con-cards-zoom': l.zoom.toFixed(3),
    '--con-ws-stage-gap': `${l.gapPx.toFixed(2)}px`,
    '--con-ws-stage-rowgap': `${l.rowGapPx.toFixed(2)}px`,
    '--con-ws-focus-scale': `${WS_STAGE_FOCUS_SCALE}`,
    '--con-ws-stage-per-row': `${l.perRow}`,
  };
}
