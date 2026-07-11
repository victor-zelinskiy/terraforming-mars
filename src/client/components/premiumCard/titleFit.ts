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
