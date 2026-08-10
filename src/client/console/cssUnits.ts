/*
 * cssUnits — resolving CSS custom-property LENGTHS from JS (console fit
 * engines).
 *
 * getComputedStyle().getPropertyValue('--x') returns an UNRESOLVED token
 * for unregistered custom properties: after the console stylesheets moved
 * to rem (the TV logical space), a `--coltile-base-w: 18.3rem` comes back
 * as the string "18.3rem" — a naive parseFloat() reads 18.3 "px" and the
 * fit math collapses (the colonies grid bug). Every JS reader of a
 * length-valued console custom property MUST resolve through here.
 */

/**
 * Resolve a CSS length string ('366px' / '18.3rem' / '18.3') to px.
 * rem resolves against the LIVE root font-size — which is exactly how the
 * TV profile scales the logical space, so JS and CSS can never disagree.
 * Returns `fallbackPx` for an empty/unparsable value.
 */
/**
 * The element's CUMULATIVE visual scale — the client-px ⇄ local-px ratio.
 *
 * `getBoundingClientRect()` is post-`zoom`; `offsetWidth`, and any `left` /
 * `width` written back onto an absolutely positioned child, are not. The console
 * stacks at least one CSS `zoom` ladder on every profile (`--con-ui-scale`, plus
 * a per-composer hero `zoom:`), so anything that measures a rect and then places
 * something at it MUST divide by this or it lands at the wrong scale — a class
 * of bug that only shows on one profile.
 *
 * Returns 1 for a zero-width / detached element, which is the only honest
 * neutral: there is nothing to correct against.
 */
export function effectiveZoom(el: HTMLElement): number {
  const layout = el.offsetWidth;
  if (layout <= 0) {
    return 1;
  }
  const visual = el.getBoundingClientRect().width;
  return visual > 0 ? visual / layout : 1;
}

export function cssLengthPx(raw: string, fallbackPx: number): number {
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) {
    return fallbackPx;
  }
  if (raw.includes('rem')) {
    const root = typeof document !== 'undefined' ?
      parseFloat(getComputedStyle(document.documentElement).fontSize) : NaN;
    return v * (Number.isFinite(root) && root > 0 ? root : 20);
  }
  return v; // px or unitless-px
}
