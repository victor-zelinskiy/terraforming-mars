/**
 * THE PAINTED WIDTH OF A LABEL (final polish P-15). The command bar's fit plan used a per-character
 * estimate («0.6 rem a character») and every zone still clipped as a last resort — on the busiest
 * screen of the political phase (the board home under the sitting's plate) the estimate under-counted
 * four uppercase Russian labels at once, the plan kept them all, and the bay's «graceful» shrink cut
 * every one of them to «ОТКРЫ…» / «ИНФОРМАЦ…» / «РАЗЫГРА…» / «ДЕЙСТВ…». A width is measured on the
 * bar's own font (canvas `measureText` + the tracking), so whole low-priority hints drop and a word is
 * never cut. Platform glyph rounding is the runner's, not ours: the caller keeps its own margin.
 */
let ctx: CanvasRenderingContext2D | null | undefined;

export type LabelFont = {
  /** The CSS font shorthand the label paints with. */
  font: string;
  /** The label's letter-spacing, px. */
  letterSpacingPx: number;
  /** The label paints uppercase. */
  uppercase: boolean;
};

/** The font a label element paints with, or undefined off the DOM. */
export function labelFontOf(el: Element | null | undefined): LabelFont | undefined {
  if (el === null || el === undefined || typeof getComputedStyle !== 'function') {
    return undefined;
  }
  const cs = getComputedStyle(el);
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return {font, letterSpacingPx: parseFloat(cs.letterSpacing) || 0, uppercase: cs.textTransform === 'uppercase'};
}

/** The painted width of `text` in `font`, px — undefined when no canvas is available (a test DOM). */
export function measureTextPx(text: string, font: LabelFont): number | undefined {
  if (ctx === undefined) {
    ctx = typeof document === 'undefined' ? null : (document.createElement('canvas').getContext('2d') ?? null);
  }
  if (ctx === null) {
    return undefined;
  }
  const painted = font.uppercase ? text.toUpperCase() : text;
  ctx.font = font.font;
  return ctx.measureText(painted).width + Math.max(0, painted.length - 1) * font.letterSpacingPx;
}
