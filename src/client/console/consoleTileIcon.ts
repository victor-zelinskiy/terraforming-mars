/*
 * A SMALL inline tile pictogram for console text rows (the composer's «ДАЛЕЕ»
 * placement line).
 *
 * It reuses the premium face's per-`TileType` art table (`tileIcon`) so the icon
 * next to «особый тайл «Солнечная электростанция»» is literally the tile the
 * card renders — no second art mapping to drift.
 *
 * Sizing is deliberately NOT set here: the caller's class owns width/height so
 * the row keeps its fixed height whatever tile is shown. This only supplies the
 * layered background, which the console paint baseline leaves untouched (no filter).
 */

import {TileType} from '@/common/TileType';
import {tileIcon} from '@/client/components/premiumCard/premiumCardIcons';

/**
 * Inline `background-image` for a tile. A special tile drawn as "canvas +
 * pictogram" gets both layers (symbol first — CSS paints the first layer on
 * top), so it reads the same as on the card face.
 */
export function tileIconStyle(tileType: TileType, over?: TileType): Record<string, string> {
  if (over !== undefined) {
    // A TILE OVER A TILE (TR44 — the city on top of an ocean): the SAME node the card face draws, in the row's
    // fixed box — the water at the foot, the city lifted over it, overlapping the depth of a stacked token.
    const {base, over: under} = tileIcon({is: 'tile', tile: tileType, over});
    return {
      backgroundImage: `url(${base}), url(${under ?? base})`,
      backgroundPosition: 'center 0%, center 100%',
      backgroundSize: '78% auto, 78% auto',
    };
  }
  const {base, symbol} = tileIcon({is: 'tile', tile: tileType, hasSymbol: true});
  const layers = symbol !== undefined ? [symbol, base] : [base];
  return {backgroundImage: layers.map((src) => `url(${src})`).join(', ')};
}
