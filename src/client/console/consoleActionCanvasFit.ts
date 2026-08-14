/*
 * THE ACTION CANVAS FIT.
 *
 * Every action slot gives its printed formula the SAME stage: one width, one
 * height, one position (`--act-canvas-w` / `--act-canvas-h`). That is a LAYOUT
 * decision and must not depend on what the formula happens to draw — a card
 * whose action reads «2x M€ → X energy» must not own a wider graphic area than
 * its own alternative reading «energy production → 8 M€», or two variants of
 * one card stop reading as equal choices and the grid loses its rhythm.
 *
 * The formulas are px-authored card art of genuinely different natural widths,
 * so a fixed stage is only honest if the CONTENT adapts. This module measures
 * each formula against its stage and publishes a per-slot `--act-fit` scale,
 * never below `MIN_FIT` (a formula the player cannot read from the sofa is
 * worse than one that touches its edges).
 *
 * Measurement only: it writes ONE custom property per graphic, which drives a
 * `transform: scale()`. Transforms do not affect layout, so a fit can never
 * feed back into the measurement that produced it — no oscillation is
 * possible, and nothing here can move the grid.
 *
 * Ratios only — no px constant, so nothing to multiply by `conUiScale()`.
 */

/** Below this the formula stops being readable at couch distance. */
const MIN_FIT = 0.62;
/** A fit within a hair of 1 is not worth a transform (and its blur risk). */
const SNAP = 0.995;

type Pair = {graphic: HTMLElement, canvas: HTMLElement};

function pairsIn(root: HTMLElement): Array<Pair> {
  const out: Array<Pair> = [];
  for (const graphic of Array.from(root.querySelectorAll<HTMLElement>('.con-cardactions__graphic'))) {
    const canvas = graphic.parentElement;
    if (canvas !== null && canvas.classList.contains('con-cardactions__canvas')) {
      out.push({graphic, canvas});
    }
  }
  return out;
}

/**
 * Fit every action formula inside the fixed canvas of its slot. Batched in
 * three passes (reset all → measure all → apply all) so the browser lays out
 * once, not once per slot.
 */
export function fitActionCanvases(root: HTMLElement | undefined | null): void {
  if (root === undefined || root === null || typeof window === 'undefined') {
    return;
  }
  const pairs = pairsIn(root);
  if (pairs.length === 0) {
    return;
  }
  for (const {graphic} of pairs) {
    graphic.style.removeProperty('--act-fit');
  }
  const fits = pairs.map(({graphic, canvas}) => {
    const g = graphic.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    if (g.width < 1 || g.height < 1 || c.width < 1 || c.height < 1) {
      return 1;
    }
    return Math.min(1, c.width / g.width, c.height / g.height);
  });
  pairs.forEach(({graphic}, i) => {
    const fit = Math.max(MIN_FIT, fits[i]);
    if (fit >= SNAP) {
      graphic.style.removeProperty('--act-fit');
    } else {
      graphic.style.setProperty('--act-fit', String(Math.round(fit * 1000) / 1000));
    }
  });
}

/*
 * There is deliberately NO `clear` counterpart, and a teardown must never
 * grow one back. The fit is an inline property on nodes that are destroyed
 * with their surface, so there is nothing to clean up — while the ONE moment
 * a teardown runs (`beforeUnmount`, which Vue fires synchronously at the
 * press) is the moment the leave transition still has the surface fully
 * painted: dropping the fit there pops every formula from its fitted size to
 * its natural one and dismisses the workspace with enlarged icons. A stale
 * value cannot outlive the mount either — `fitActionCanvases` resets every
 * pair before it measures.
 */
