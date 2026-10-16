/**
 * @console-shared LIVE — a pure CSS `cubic-bezier()` easing for JS-driven motion, so a JS tween can ride the SAME curve
 * a CSS transition declares (`MOTION_EASE` / `CURSOR_EASE` are CSS strings). The standard Newton–Raphson + bisection
 * solve for x(t) = progress, then y(t). Pure and DOM-free.
 */

/** `cubic-bezier(x1, y1, x2, y2)` → an easing function on [0, 1]. */
export function cubicBezierEase(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solveT = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) {
        return t;
      }
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) {
        break;
      }
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) {
        return t;
      }
      if (v < x) {
        lo = t;
      } else {
        hi = t;
      }
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (p: number) => {
    if (p <= 0) {
      return 0;
    }
    if (p >= 1) {
      return 1;
    }
    return sampleY(solveT(p));
  };
}

/** Parse a CSS `cubic-bezier(a, b, c, d)` string; `undefined` when it is not one. */
export function cubicBezierFromCss(css: string): ((p: number) => number) | undefined {
  const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(css);
  if (m === null) {
    return undefined;
  }
  return cubicBezierEase(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]));
}
