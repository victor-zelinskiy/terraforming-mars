/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PASSED CELL'S ONE IMPULSE — an ATTRIBUTE, never a class (FLAKE ZERO, `console-parliament-unity`, 2026-11-16).
 *
 * A marker gliding along a colony track lights every cell it crosses for one beat (`con-coltrade-cell-sweep`). The
 * crossing is also a TOUCH (`noteColonyTrackWaveTouched`), which turns the cell `--passed` through the tile's reactive
 * `:class` — and a class binding writes `className` WHOLE: an impulse added with `classList.add` in the same task was
 * wiped by the touch's own flush, a microtask later, before any frame. The middle cell of a two-step leg never lit
 * on any machine (the old 40 ms sampler only ever saw the class between the add and the flush). The same law as the
 * board's see-through (`data-peek`, TR47): state written imperatively onto an element whose classes are bound is an
 * attribute.
 */

/** The attribute the sweep's keyframes key on (`console_colony_trade.less`). */
export const TRACK_CELL_SWEEP_ATTR = 'data-sweep';

/** Light a passed cell's impulse (restarting it when it is already lit). */
export function sweepTrackCell(cell: Element): void {
  if (cell.hasAttribute(TRACK_CELL_SWEEP_ATTR)) {
    cell.removeAttribute(TRACK_CELL_SWEEP_ATTR);
    void (cell as HTMLElement).offsetWidth; // a restyle between the two writes restarts the keyframes
  }
  cell.setAttribute(TRACK_CELL_SWEEP_ATTR, '');
}

/** The impulse is over — the cell stands as the reactive classes say. */
export function unsweepTrackCell(cell: Element): void {
  cell.removeAttribute(TRACK_CELL_SWEEP_ATTR);
}
