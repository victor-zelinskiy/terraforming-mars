/*
 * TAG LAYOUT — deterministic layout plan for the premium tag rail
 * (top-right medallion cluster). Pure function of the tag COUNT so the
 * layout can never wobble per-frame; the CSS presets in premium_card.less
 * key off the returned mode (`pcard__tags--<mode>`).
 *
 * Real-world data: 0–4 unique tags is the norm; fan cards go up to 8
 * (with duplicates), so every band must stay readable.
 */

export type TagLayoutMode = 'row' | 'wrap2' | 'compact' | 'fan';

export function tagLayoutFor(count: number): TagLayoutMode {
  if (count <= 2) {
    return 'row'; // single row, full-size medallions
  }
  if (count <= 4) {
    return 'wrap2'; // 2-per-row grid (2+1 / 2+2), full size
  }
  if (count <= 6) {
    return 'compact'; // smaller medallions, slight overlap
  }
  return 'fan'; // heavy overlap fan — worst-case fan cards
}
