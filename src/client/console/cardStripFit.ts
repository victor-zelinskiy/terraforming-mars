/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ONE ROW-FIT FORMULA for every workspace card strip.
 *
 * The buy pick (ConsoleTaskHost) and the drawn reveal (ConsoleRevealOverlay)
 * present the same moment — «вот карта(ы), решай» — inside the same stable
 * stage area, and the received card must be EXACTLY the size the buy pick
 * would give it. That is only guaranteed when both hosts derive the slot zoom
 * from the SAME formula over the SAME kind of measurement (available band ÷
 * natural slot box); two independent size sources (a hand-tuned scale ladder
 * vs a fit engine) drifted apart once already. Hosts measure their own DOM
 * and pass numbers; this stays pure and unit-testable.
 */

export type RowFitInput = {
  /** Content-box width available to the row (padding already subtracted). */
  availW: number;
  /** Vertical band budget for the card row itself. */
  availH: number;
  /** One slot's UNZOOMED box (offsetWidth/Height at zoom 1). */
  slotW: number;
  slotH: number;
  /** Cards in the row. */
  n: number;
  /** The row's flex column-gap in px (NOT scaled by the slot zoom). */
  colGap: number;
  /** `conUiScale()` — the TV rem factor; caps/floors ride it. */
  ui: number;
};

/**
 * The slot `zoom` for a single-row card strip: fill the band's height, never
 * overflow its width (0.96 leaves headroom for the focused card's scale-lift),
 * clamped to the profile's floor/ceiling. Byte-identical to the historical
 * ConsoleTaskHost row branch — the buy pick is the visual etalon and must not
 * move.
 */
export function fitRowZoom(o: RowFitInput): number {
  const wZoom = (0.96 * o.availW - (o.n - 1) * o.colGap) / (o.n * o.slotW);
  const hZoom = o.availH / o.slotH;
  return Math.min(1.6 * o.ui, Math.max(0.5 * o.ui, Math.min(wZoom, hZoom)));
}
