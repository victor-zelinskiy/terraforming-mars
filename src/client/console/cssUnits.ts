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
