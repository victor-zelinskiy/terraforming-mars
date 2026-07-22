/*
 * CONSOLE MODAL BAND — the JS accessor of the shared modal-layout contract.
 *
 * The CSS side (console.less `.con-root`) defines the contract: two tokens —
 * `--con-band-top` / `--con-band-bottom` — describe the viewport bands
 * reserved for the ALWAYS-VISIBLE top HUD strip and bottom command bar, and
 * the `.con-modal-band()` mixin positions every console modal/overlay EXACTLY
 * between them. This module is the MEASURED mirror for JS consumers:
 *
 *  - a fit engine that plans against the viewport (rather than its own
 *    measured box) reads `conModalBandRect()` instead of `innerHeight`;
 *  - the FUTURE one-frame modal-swap animations anchor here: every band
 *    surface shares one identical frame box, so a swap is a content
 *    crossfade/FLIP inside a geometry both sides already agree on — the
 *    choreography only needs THIS rect, never per-modal constants.
 *
 * Measured (not recomputed from CSS formulas): the strip's live bottom edge
 * and the footer's live top edge are the truth on every profile — no second
 * constant to drift. Graceful fallbacks keep JSDOM / pre-mount callers sane.
 */

export type ConsoleModalBandRect = {
  /** Viewport-px top edge of the band (just below the status strip). */
  top: number;
  /** Viewport-px bottom edge of the band (just above the footer bar). */
  bottom: number;
  height: number;
};

/** Breathing between the bars and the band content (mirrors the CSS tokens'
 *  built-in gap — the measured edges are the BARS', not the content's). */
const BAND_GAP_PX = 8;

export function conModalBandRect(): ConsoleModalBandRect {
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 1080;
  let top = Math.round(viewH * 0.06);
  let bottom = Math.round(viewH * 0.92);
  if (typeof document !== 'undefined') {
    const strip = document.querySelector<HTMLElement>('.con-status');
    const stripRect = strip?.getBoundingClientRect();
    if (stripRect !== undefined && stripRect.height > 0) {
      top = stripRect.bottom + BAND_GAP_PX;
    }
    const bar = document.querySelector<HTMLElement>('.con-cmdbar');
    const barRect = bar?.getBoundingClientRect();
    if (barRect !== undefined && barRect.height > 0) {
      bottom = barRect.top - BAND_GAP_PX;
    }
  }
  return {top, bottom, height: Math.max(0, bottom - top)};
}
