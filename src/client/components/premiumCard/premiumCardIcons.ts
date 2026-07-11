/*
 * PREMIUM CARD ICONS — the ONE mapping from render-DSL vocabulary to icon
 * assets for the premium card face.
 *
 * Deliberately returns raw asset URLs (the component inline-styles
 * `background-image`) instead of legacy CSS classes: the legacy icon rules
 * are scoped under `.card-container` (cards_v2.less) and reusing them would
 * drag the whole legacy cascade into the new renderer. Sizing/effects live
 * in premium_card.less on GENERIC `.pcard-ic` classes.
 *
 * An unmapped item type resolves to `undefined` → the mechanics renderer
 * draws a labelled fallback chip and warns once in dev (the coverage guard
 * test lists the gaps per module).
 */

import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ICardRenderTile} from '@/common/cards/render/Types';
import {CardResource} from '@/common/CardResource';
import {GameModule} from '@/common/cards/GameModule';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {TileType} from '@/common/TileType';

export type MechIconSpec =
  | {kind: 'img', url: string}
  | {kind: 'glyph', glyph: string};

const RES = 'assets/resources';
const TILES = 'assets/tiles';
const GLOBALS = 'assets/global-parameters';
const TAGS = 'assets/tags';
const MISC = 'assets/misc';

/** Card-resource key → filename under assets/resources (lowercase, spaces→hyphens). */
function cardResourceKey(resource: CardResource): string {
  return resource.toLowerCase().replaceAll(' ', '-');
}

export function cardResourceIconUrl(resource: CardResource): string {
  if (resource === CardResource.RESOURCE_CUBE) {
    return 'assets/cube.png'; // the one card resource living outside assets/resources
  }
  return `${RES}/${cardResourceKey(resource)}.png`;
}

export function tagIconUrl(tag: Tag): string {
  return `${TAGS}/${tag}.png`;
}

/** Standard-resource icon (production requirements, reserve units). */
const STANDARD_RESOURCE_URL: Readonly<Record<Resource, string>> = {
  [Resource.MEGACREDITS]: `${RES}/megacredit.png`,
  [Resource.STEEL]: `${RES}/steel.png`,
  [Resource.TITANIUM]: `${RES}/titanium.png`,
  [Resource.PLANTS]: `${RES}/plant.png`,
  [Resource.ENERGY]: `${RES}/power.png`,
  [Resource.HEAT]: `${RES}/heat.png`,
};

export function standardResourceIconUrl(resource: Resource): string {
  return STANDARD_RESOURCE_URL[resource];
}

/**
 * Direct item-type → asset table. Covers the full vocabulary of the premium
 * scope (project + prelude cards of the in-scope modules) plus every exotic
 * type that has a clean shipped asset — an entry missing here degrades to
 * the labelled fallback chip, never a broken image.
 */
const ITEM_ICON_URL: Partial<Record<CardRenderItemType, string>> = {
  [CardRenderItemType.MEGACREDITS]: `${RES}/megacredit.png`,
  [CardRenderItemType.STEEL]: `${RES}/steel.png`,
  [CardRenderItemType.TITANIUM]: `${RES}/titanium.png`,
  [CardRenderItemType.PLANTS]: `${RES}/plant.png`,
  [CardRenderItemType.ENERGY]: `${RES}/power.png`,
  [CardRenderItemType.HEAT]: `${RES}/heat.png`,
  [CardRenderItemType.CARDS]: `${RES}/card.webp`,
  [CardRenderItemType.TR]: `${RES}/tr.png`,
  [CardRenderItemType.WILD]: `${RES}/wild.png`,
  [CardRenderItemType.ONE]: `${RES}/one.png`,

  [CardRenderItemType.TEMPERATURE]: `${GLOBALS}/temperature.png`,
  [CardRenderItemType.OXYGEN]: `${GLOBALS}/oxygen.png`,
  [CardRenderItemType.VENUS]: `${GLOBALS}/venus.png`,
  [CardRenderItemType.OCEANS]: `${TILES}/ocean.png`,

  [CardRenderItemType.CITY]: `${TILES}/city.png`,
  [CardRenderItemType.GREENERY]: `${TILES}/greenery.png`,
  [CardRenderItemType.EMPTY_TILE]: `${TILES}/empty.png`,
  [CardRenderItemType.EMPTY_TILE_GOLDEN]: `${TILES}/adjacency_bonus.png`,
  [CardRenderItemType.HAZARD_TILE]: `${TILES}/hazard.png`,
  [CardRenderItemType.COLONY_TILE]: `${TILES}/colony.png`,

  [CardRenderItemType.DELEGATES]: `${MISC}/delegate.png`,
  [CardRenderItemType.CHAIRMAN]: `${MISC}/chairman.png`,
  [CardRenderItemType.INFLUENCE]: `${MISC}/influence.png`,
  [CardRenderItemType.FIRST_PLAYER]: `${MISC}/first-player.png`,
};

/** One-shot dev warning per unmapped type so a gap is visible but never spams. */
const warned = new Set<string>();
function warnUnmapped(kind: string): void {
  if (!warned.has(kind) && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    warned.add(kind);
    console.warn(`premiumCardIcons: no icon mapping for '${kind}' — rendering a fallback chip.`);
  }
}

/* ── tiles ─────────────────────────────────────────────────────────── */

const SPECIAL_TILE = `${TILES}/special.png`;
const TILE_SYMBOLS = 'assets/tiles/special_tile_icons';

export type TileIconSpec = {
  /** The tile canvas image. */
  base: string;
  /** Optional symbol drawn over a special-tile canvas. */
  symbol?: string;
};

/** In-scope tile pictograms (base + special tiles of the covered modules). */
const TILE_ICON: Partial<Record<TileType, TileIconSpec>> = {
  [TileType.OCEAN]: {base: `${TILES}/ocean.png`},
  [TileType.CITY]: {base: `${TILES}/city.png`},
  [TileType.GREENERY]: {base: `${TILES}/greenery.png`},
  [TileType.CAPITAL]: {base: `${TILES}/city.png`},
  [TileType.COMMERCIAL_DISTRICT]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/commerical_district.png`},
  [TileType.DEIMOS_DOWN]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/deimos.png`},
  [TileType.GREAT_DAM]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/great_dam.png`},
  [TileType.ECOLOGICAL_ZONE]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/ecological_zone.png`},
  [TileType.INDUSTRIAL_CENTER]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/industrial_center.png`},
  [TileType.LAVA_FLOWS]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/lava_flows.png`},
  [TileType.MAGNETIC_FIELD_GENERATORS]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/magnetic_field_gen.png`},
  [TileType.MINING_AREA]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/mining_area.png`},
  [TileType.MINING_RIGHTS]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/mining_area.png`},
  [TileType.MOHOLE_AREA]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/mohole_area.png`},
  [TileType.NATURAL_PRESERVE]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/natural_preserve.png`},
  [TileType.NUCLEAR_ZONE]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/nuclear_zone.png`},
  [TileType.RESTRICTED_AREA]: {base: SPECIAL_TILE, symbol: `${TILE_SYMBOLS}/restricted_area.png`},
  [TileType.MINING_STEEL_BONUS]: {base: SPECIAL_TILE, symbol: `${RES}/steel.png`},
  [TileType.MINING_TITANIUM_BONUS]: {base: SPECIAL_TILE, symbol: `${RES}/titanium.png`},
  [TileType.NEW_HOLLAND]: {base: `${TILES}/new_holland.png`},
};

export function tileIcon(tile: ICardRenderTile): TileIconSpec {
  const spec = TILE_ICON[tile.tile];
  if (spec !== undefined) {
    return spec;
  }
  warnUnmapped(`tile/${TileType[tile.tile]}`);
  return {base: SPECIAL_TILE};
}

/* ── expansion medallion ───────────────────────────────────────────── */

const EXPANSION_ICON_FILE: Partial<Record<GameModule, string>> = {
  corpera: 'corporateEra',
  promo: 'promo',
  venus: 'venus',
  colonies: 'colonies',
  prelude: 'prelude',
  prelude2: 'prelude2',
  turmoil: 'turmoil',
  community: 'community',
  ares: 'ares',
  moon: 'themoon',
  pathfinders: 'pathfinders',
  ceo: 'ceo',
  starwars: 'starwars',
  underworld: 'underworld',
  deltaProject: 'deltaProject',
};

/** Expansion medallion icon; undefined for the base game (plain engraved medallion). */
export function expansionIconUrl(module: GameModule): string | undefined {
  const file = EXPANSION_ICON_FILE[module];
  return file === undefined ? undefined : `assets/expansion_icons/expansion_icon_${file}.png`;
}

/**
 * Resolve the icon for a render item. Structural types (TEXT / PLATE / NBSP)
 * are the component's business and must not reach this function.
 */
export function mechItemIcon(item: ICardRenderItem): MechIconSpec | undefined {
  switch (item.type) {
  case CardRenderItemType.TAG:
    if (item.tag !== undefined) {
      return {kind: 'img', url: tagIconUrl(item.tag)};
    }
    break;
  case CardRenderItemType.RESOURCE:
    if (item.resource !== undefined) {
      return {kind: 'img', url: cardResourceIconUrl(item.resource)};
    }
    break;
  case CardRenderItemType.MULTIPLIER_WHITE:
    return {kind: 'glyph', glyph: 'X'};
  case CardRenderItemType.VP:
    return {kind: 'glyph', glyph: '?'};
  default: {
    const url = ITEM_ICON_URL[item.type];
    if (url !== undefined) {
      return {kind: 'img', url};
    }
  }
  }
  warnUnmapped(`${item.type}${item.tag !== undefined ? `/${item.tag}` : ''}${item.resource !== undefined ? `/${item.resource}` : ''}`);
  return undefined;
}
