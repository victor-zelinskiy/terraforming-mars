/*
 * TITLE FIT — size tier for the card name on the premium title band.
 *
 * Measured on the TRANSLATED string (the legacy renderer already learned
 * this lesson — Russian names run long), returning one of FOUR presets so
 * cards never get chaotic per-card font sizes. The tiers map to fixed
 * font sizes + line counts in premium_card.less (`pcard__title--t<n>`):
 *
 *   t1 — short name, large type, single line;
 *   t2 — medium, single line;
 *   t3 — long, 2 lines;
 *   t4 — extreme, 2 lines, smallest readable size.
 *
 * Uppercase styling is applied only for t1/t2 (long Cyrillic names in
 * uppercase become unreadable at small sizes — the CSS keys off the tier).
 *
 * The tier alone can't know how much width is LEFT for the text: the cost
 * badge and the tag cluster eat into it (the safe-areas), so a name that fits
 * on a bare plate can overrun a 2-tag one. A WORD must never be split
 * mid-glyph, so the CSS does the last-mile fit itself: it never wraps inside a
 * word and shrinks the type until the LONGEST WORD fits the container's real
 * inline size (`100cqi` against `--pcard-title-longest`). Hence this second,
 * still purely deterministic measure — a character count, never a DOM measure.
 */

export type TitleTier = 1 | 2 | 3 | 4;

export function titleTierFor(translatedTitle: string): TitleTier {
  const len = translatedTitle.length;
  if (len <= 14) {
    return 1;
  }
  if (len <= 22) {
    return 2;
  }
  if (len <= 34) {
    return 3;
  }
  return 4;
}

/* A run the renderer can NEVER break apart — the widest one drives the CSS
 * shrink-to-fit. Whitespace is a legal break; so are hyphens / dashes /
 * slashes (the browser wraps AFTER them), so they end a run. */
const UNBREAKABLE_SPLIT = /[\s ]+|(?<=[-–—/])/;

export function longestWordLength(translatedTitle: string): number {
  let longest = 1;
  for (const run of translatedTitle.split(UNBREAKABLE_SPLIT)) {
    longest = Math.max(longest, run.trim().length);
  }
  return longest;
}
