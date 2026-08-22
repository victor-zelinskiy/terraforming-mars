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
export function tileIconStyle(tileType: TileType): Record<string, string> {
  const {base, symbol} = tileIcon({is: 'tile', tile: tileType, hasSymbol: true});
  const layers = symbol !== undefined ? [symbol, base] : [base];
  return {backgroundImage: layers.map((src) => `url(${src})`).join(', ')};
}
