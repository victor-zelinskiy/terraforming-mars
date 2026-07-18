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

import {AltSecondaryTag} from '@/common/cards/render/AltSecondaryTag';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ICardRenderTile} from '@/common/cards/render/Types';
import {CardResource} from '@/common/CardResource';
import {GameModule} from '@/common/cards/GameModule';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {TileType} from '@/common/TileType';

export type MechIconSpec =
  | {kind: 'img', url: string, mod?: string}
  /** A localized text plate (prelude / award / milestone / ignore-global-req).
   *  `text` is the English i18n KEY — the component translates it. */
  | {kind: 'label', text: string, accent?: 'prelude' | 'award'}
  /** A value-bearing light token (trade discount) — the amount rides `amountInside`. */
  | {kind: 'token'}
  | {kind: 'glyph', glyph: string};

const RES = 'assets/resources';
const TILES = 'assets/tiles';
const GLOBALS = 'assets/global-parameters';
const TAGS = 'assets/tags';
const MISC = 'assets/misc';
const PROMO = 'assets/promo';

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
  // The PLAIN greenery (the classic-card default). The oxygen-raising variant
  // (secondaryTag OXYGEN) resolves to greenery.png in mechItemIcon — the O₂
  // symbol is baked into that asset.
  [CardRenderItemType.GREENERY]: `${TILES}/greenery_no_O2.png`,
  [CardRenderItemType.EMPTY_TILE]: `${TILES}/empty.png`,
  [CardRenderItemType.EMPTY_TILE_GOLDEN]: `${TILES}/adjacency_bonus.png`,
  [CardRenderItemType.HAZARD_TILE]: `${TILES}/hazard.png`,
  [CardRenderItemType.COLONY_TILE]: `${TILES}/colony.png`,

  // Colonies expansion — the trade-track colony icon + the trade token.
  [CardRenderItemType.COLONIES]: `${TILES}/colony.png`,
  [CardRenderItemType.TRADE]: `${TILES}/trade.png`,

  // Promo special icons that ship a clean asset.
  [CardRenderItemType.CATHEDRAL]: `${PROMO}/cathedral.png`,
  [CardRenderItemType.CITY_OR_SPECIAL_TILE]: `${PROMO}/city-or-special-tile.png`,

  // «a corporation card» / «a card slot on Self-replicating Robots» — corp
  // cards render on the same premium face as project cards, so the generic
  // card cover (the playground card-back texture) IS the corporation glyph.
  [CardRenderItemType.CORPORATION]: `${RES}/card.webp`,
  [CardRenderItemType.SELF_REPLICATING]: `${RES}/card.webp`,

  // Tag markers with dedicated art.
  [CardRenderItemType.NO_TAGS]: `${TAGS}/tag-none.png`,
  [CardRenderItemType.DIVERSE_TAG]: `${TAGS}/diverse.png`,

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
const CUSTOM_TILES = 'assets/custom_tiles';

export type TileIconSpec = {
  /** The tile canvas image. */
  base: string;
  /** Optional symbol drawn over a special-tile canvas. */
  symbol?: string;
};

/**
 * Per-tile art for the premium face — mirrors the legacy renderer's three
 * slots (`CardRenderTileComponent`'s `TILE_CLASSES`) so the two never diverge:
 *   - `full`   — the normal full-tile art (legacy `tile:`).
 *   - `variant`— per-VARIANT full-tile art, selected by a flag the render node
 *                itself carries. Today the only variant is `ares` (legacy
 *                `aresTile:`); it WINS over `full`/`symbol` when the node is
 *                authored as the Ares variant of a tile (`.tile(type, false,
 *                /* isAres * / true)`), so an Ares override of a tile shared
 *                with base/promo — Capital, Deimos Down, Commercial District,
 *                Great Dam … — shows the Ares art rather than the plain one.
 *   - `symbol` — inner pictogram over the generic special-tile canvas, for the
 *                non-variant "canvas + symbol" look (legacy `symbol:`, gated on
 *                the node's `hasSymbol`).
 *
 * A NEW render node flag is the whole point of the `variant` map: when a future
 * expansion introduces its own tile-art variant (e.g. a hypothetical `isPromo`
 * tile), give the node a flag, add a `variant.<key>` slot here, and slot the
 * key into `TILE_VARIANT_PRIORITY` below. Ares stays first, so its override
 * always wins a shared card.
 */
type TileVisual = {
  full?: string;
  variant?: Partial<Record<TileVariantKey, string>>;
  symbol?: string;
};

/** Render-node-selectable tile-art variants, in resolution priority order. */
type TileVariantKey = 'ares';
const TILE_VARIANT_PRIORITY: ReadonlyArray<{key: TileVariantKey, active: (t: ICardRenderTile) => boolean}> = [
  {key: 'ares', active: (t) => t.isAres === true},
];

/** In-scope tile pictograms (base + special tiles of the covered modules). */
const TILE_VISUAL: Partial<Record<TileType, TileVisual>> = {
  // Basic tiles — always the plain full art.
  [TileType.OCEAN]: {full: `${TILES}/ocean.png`},
  [TileType.CITY]: {full: `${TILES}/city.png`},
  [TileType.GREENERY]: {full: `${TILES}/greenery_no_O2.png`},
  [TileType.NEW_HOLLAND]: {full: `${TILES}/new_holland.png`},

  // Variant-capable tiles — a base/promo look (full or canvas+symbol) PLUS a
  // dedicated Ares tile graphic that wins when the node carries `isAres`.
  [TileType.CAPITAL]: {full: `${TILES}/city.png`, variant: {ares: `${CUSTOM_TILES}/tile_capital_ares.png`}},
  [TileType.COMMERCIAL_DISTRICT]: {symbol: `${TILE_SYMBOLS}/commerical_district.png`, variant: {ares: `${CUSTOM_TILES}/ares_commercial_district.png`}},
  [TileType.DEIMOS_DOWN]: {symbol: `${TILE_SYMBOLS}/deimos.png`, variant: {ares: `${CUSTOM_TILES}/ares_deimos_down.png`}},
  [TileType.GREAT_DAM]: {symbol: `${TILE_SYMBOLS}/great_dam.png`, variant: {ares: `${CUSTOM_TILES}/ares_great_dam.png`}},
  [TileType.ECOLOGICAL_ZONE]: {symbol: `${TILE_SYMBOLS}/ecological_zone.png`, variant: {ares: `${CUSTOM_TILES}/ares_ecological_zone.png`}},
  [TileType.INDUSTRIAL_CENTER]: {symbol: `${TILE_SYMBOLS}/industrial_center.png`, variant: {ares: `${CUSTOM_TILES}/ares_industrial_center.png`}},
  [TileType.LAVA_FLOWS]: {symbol: `${TILE_SYMBOLS}/lava_flows.png`, variant: {ares: `${CUSTOM_TILES}/ares_lava_flows.png`}},
  [TileType.MAGNETIC_FIELD_GENERATORS]: {symbol: `${TILE_SYMBOLS}/magnetic_field_gen.png`, variant: {ares: `${CUSTOM_TILES}/ares_magnetic_field_generators.png`}},
  [TileType.MOHOLE_AREA]: {symbol: `${TILE_SYMBOLS}/mohole_area.png`, variant: {ares: `${CUSTOM_TILES}/ares_mohole_area.png`}},
  [TileType.NATURAL_PRESERVE]: {symbol: `${TILE_SYMBOLS}/natural_preserve.png`, variant: {ares: `${CUSTOM_TILES}/ares_natural_preserve.png`}},
  [TileType.NUCLEAR_ZONE]: {symbol: `${TILE_SYMBOLS}/nuclear_zone.png`, variant: {ares: `${CUSTOM_TILES}/ares_nuclear_zone.png`}},
  [TileType.RESTRICTED_AREA]: {symbol: `${TILE_SYMBOLS}/restricted_area.png`, variant: {ares: `${CUSTOM_TILES}/ares_restricted_area.png`}},

  // Ares-only tiles — never placed as a base/promo tile, so the Ares art is
  // their only representation (they still author `isAres`).
  [TileType.BIOFERTILIZER_FACILITY]: {variant: {ares: `${CUSTOM_TILES}/ares_biofertilizer_facility.png`}},
  [TileType.METALLIC_ASTEROID]: {variant: {ares: `${CUSTOM_TILES}/ares_metallic_asteroid.png`}},

  // Symbol-only tiles — a pictogram over the canvas, no dedicated card art.
  [TileType.MINING_AREA]: {symbol: `${TILE_SYMBOLS}/mining_area.png`},
  [TileType.MINING_RIGHTS]: {symbol: `${TILE_SYMBOLS}/mining_area.png`},

  // Ares-module tiles shown whole (they author `isAres` but have no distinct
  // "plain" variant, so the full art serves every placement).
  [TileType.MINING_STEEL_BONUS]: {full: `${CUSTOM_TILES}/ares_tile_mining_steel.png`},
  [TileType.MINING_TITANIUM_BONUS]: {full: `${CUSTOM_TILES}/ares_tile_mining_titanium.png`},
  [TileType.OCEAN_CITY]: {full: `${CUSTOM_TILES}/ares_ocean_city.png`},
  [TileType.OCEAN_FARM]: {full: `${CUSTOM_TILES}/ares_ocean_farm.png`},
  [TileType.OCEAN_SANCTUARY]: {full: `${CUSTOM_TILES}/ares_ocean_sanctuary.png`},
  [TileType.SOLAR_FARM]: {full: `${CUSTOM_TILES}/ares_solar_farm.png`},
};

export function tileIcon(tile: ICardRenderTile): TileIconSpec {
  const visual = TILE_VISUAL[tile.tile];
  if (visual === undefined) {
    warnUnmapped(`tile/${TileType[tile.tile]}`);
    return {base: SPECIAL_TILE};
  }
  // A render-node variant (Ares) WINS — the node authors the flag for a tile's
  // variant override, so it beats the base/promo art even on a shared card.
  for (const {key, active} of TILE_VARIANT_PRIORITY) {
    const art = visual.variant?.[key];
    if (art !== undefined && active(tile)) {
      return {base: art};
    }
  }
  if (visual.full !== undefined) {
    return {base: visual.full};
  }
  if (visual.symbol !== undefined) {
    // The DSL sets `hasSymbol` for the canvas+symbol look; fall back to showing
    // the symbol anyway if it's the only art we have (never a blank canvas).
    return {base: SPECIAL_TILE, symbol: visual.symbol};
  }
  // A variant-only tile authored WITHOUT its flag — prefer the first variant
  // art over a bare canvas.
  for (const {key} of TILE_VARIANT_PRIORITY) {
    const art = visual.variant?.[key];
    if (art !== undefined) {
      return {base: art};
    }
  }
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
  case CardRenderItemType.GREENERY:
    // O₂-raising greenery → the O₂-baked asset; plain greenery → no_O2
    // (mirrors the legacy greenery-tile / greenery-tile-oxygen split).
    if (item.secondaryTag === AltSecondaryTag.OXYGEN) {
      return {kind: 'img', url: `${TILES}/greenery.png`};
    }
    return {kind: 'img', url: `${TILES}/greenery_no_O2.png`};
  case CardRenderItemType.MULTIPLIER_WHITE:
    return {kind: 'glyph', glyph: 'X'};
  case CardRenderItemType.VP:
    return {kind: 'glyph', glyph: '?'};
  case CardRenderItemType.TRADE_FLEET:
    // Same trade canvas as TRADE, inverted — the fork's fleet marker (mirrors
    // the legacy `filter: invert(1)` on card-resource-trade-fleet).
    return {kind: 'img', url: `${TILES}/trade.png`, mod: 'invert'};
  case CardRenderItemType.TRADE_DISCOUNT:
    // A light value token (the −N reduction rides `amountInside`).
    return {kind: 'token'};
  case CardRenderItemType.PRELUDE:
    return {kind: 'label', text: 'Prelude', accent: 'prelude'};
  case CardRenderItemType.AWARD:
    return {kind: 'label', text: 'Award', accent: 'award'};
  case CardRenderItemType.MILESTONE:
    return {kind: 'label', text: 'Milestone', accent: 'award'};
  case CardRenderItemType.IGNORE_GLOBAL_REQUIREMENTS:
    return {kind: 'label', text: 'Global requirements'};
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
