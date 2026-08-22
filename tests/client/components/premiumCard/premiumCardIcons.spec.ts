import {expect} from 'chai';
import {mechItemIcon, tileIcon} from '@/client/components/premiumCard/premiumCardIcons';
import {
  ICardRenderItem,
  ICardRenderTile,
  ItemType,
  isICardRenderCorpBoxAction,
  isICardRenderCorpBoxEffect,
  isICardRenderCorpBoxEffectAction,
  isICardRenderEffect,
  isICardRenderItem,
  isICardRenderProductionBox,
  isICardRenderRoot,
} from '@/common/cards/render/Types';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardType} from '@/common/cards/CardType';
import {TileType} from '@/common/TileType';
import {getCards} from '@/client/cards/ClientCardManifest';

// A pure helper (no Vue deps) — runs under the server runner, like
// victoryPointsModel.spec.ts.
function tileNode(tile: TileType, opts: {isAres?: true, hasSymbol?: true} = {}): ICardRenderTile {
  return {is: 'tile', tile, isAres: opts.isAres, hasSymbol: opts.hasSymbol};
}

function itemNode(type: CardRenderItemType, amount = -1): ICardRenderItem {
  return {is: 'item', type, amount} as ICardRenderItem;
}

describe('premiumCardIcons.mechItemIcon', () => {
  it('colonies + trade resolve to their shipped tile art (no fallback chip)', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.COLONIES))).to.deep.equal({kind: 'img', url: 'assets/tiles/colony.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.TRADE))).to.deep.equal({kind: 'img', url: 'assets/tiles/trade.png'});
  });

  it('trade fleet is the trade canvas inverted', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.TRADE_FLEET))).to.deep.equal({kind: 'img', url: 'assets/tiles/trade.png', mod: 'invert'});
  });

  it('corporation + self-replicating use the generic premium card cover', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.CORPORATION))).to.deep.equal({kind: 'img', url: 'assets/resources/card.webp'});
    expect(mechItemIcon(itemNode(CardRenderItemType.SELF_REPLICATING))).to.deep.equal({kind: 'img', url: 'assets/resources/card.webp'});
  });

  it('tag markers + promo icons resolve to shipped art', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.NO_TAGS))).to.deep.equal({kind: 'img', url: 'assets/tags/tag-none.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.DIVERSE_TAG))).to.deep.equal({kind: 'img', url: 'assets/tags/diverse.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.CATHEDRAL))).to.deep.equal({kind: 'img', url: 'assets/promo/cathedral.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.CITY_OR_SPECIAL_TILE))).to.deep.equal({kind: 'img', url: 'assets/promo/city-or-special-tile.png'});
  });

  it('concept plates carry an i18n KEY + accent (prelude / award / milestone / global req)', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.PRELUDE))).to.deep.equal({kind: 'label', text: 'Prelude', accent: 'prelude'});
    expect(mechItemIcon(itemNode(CardRenderItemType.AWARD))).to.deep.equal({kind: 'label', text: 'Award', accent: 'award'});
    expect(mechItemIcon(itemNode(CardRenderItemType.MILESTONE))).to.deep.equal({kind: 'label', text: 'Milestone', accent: 'award'});
    expect(mechItemIcon(itemNode(CardRenderItemType.IGNORE_GLOBAL_REQUIREMENTS))).to.deep.equal({kind: 'label', text: 'Global requirements'});
  });

  it('trade discount is a value-bearing token', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.TRADE_DISCOUNT))).to.deep.equal({kind: 'token'});
  });

  it('community + nomads reuse the premium player cube (representative colour)', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.COMMUNITY))).to.deep.equal({kind: 'cube', color: 'orange'});
    expect(mechItemIcon(itemNode(CardRenderItemType.NOMADS))).to.deep.equal({kind: 'cube', color: 'bronze'});
  });

  it('fork premium primitives resolve to their SVG (graphic replacements for prose)', () => {
    expect(mechItemIcon(itemNode(CardRenderItemType.PROTECTION))).to.deep.equal({kind: 'img', url: 'assets/misc/shield-protect.svg'});
    expect(mechItemIcon(itemNode(CardRenderItemType.DECK_LOOK))).to.deep.equal({kind: 'img', url: 'assets/misc/deck-look.svg'});
    expect(mechItemIcon(itemNode(CardRenderItemType.DISCARD))).to.deep.equal({kind: 'img', url: 'assets/misc/card-discard.svg'});
    expect(mechItemIcon(itemNode(CardRenderItemType.ACTION_REPLAY))).to.deep.equal({kind: 'img', url: 'assets/misc/action-replay.svg'});
  });

  it('CEO vocabulary resolves (wave 4): OPG marker, Reds, adjacency bonus, Moon tiles, planetary track', () => {
    // The once-per-game arrow is a premium-native marker, never the legacy PNG.
    expect(mechItemIcon(itemNode(CardRenderItemType.ARROW_OPG))).to.deep.equal({kind: 'opg'});
    expect(mechItemIcon(itemNode(CardRenderItemType.REDS))).to.deep.equal({kind: 'img', url: 'assets/parties/reds.png'});
    // Deactivated Reds (Zan's immunity): dim + strike via the 'off' mod —
    // legacy grayscale was a `filter`, which console-native strips.
    expect(mechItemIcon(itemNode(CardRenderItemType.REDS_DEACTIVATED))).to.deep.equal({kind: 'img', url: 'assets/parties/reds.png', mod: 'off'});
    expect(mechItemIcon(itemNode(CardRenderItemType.ADJACENCY_BONUS))).to.deep.equal({kind: 'img', url: 'assets/tiles/adjacency_bonus.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.MOON_HABITAT))).to.deep.equal({kind: 'img', url: 'assets/moon/habitattile.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.MOON_MINE))).to.deep.equal({kind: 'img', url: 'assets/moon/minetile.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.MOON_ROAD))).to.deep.equal({kind: 'img', url: 'assets/moon/roadtile.png'});
    expect(mechItemIcon(itemNode(CardRenderItemType.PLANETARY_TRACK))).to.deep.equal({kind: 'img', url: 'assets/pathfinders/planetary-track.png'});
  });
});

/*
 * WORKLIST GUARD — the whole CEO corpus resolves every render item to a REAL
 * icon spec. The labelled fallback chip is an honest degradation for the
 * frontier, but for an IN-SCOPE type it is a defect: a face that ships a
 * dashed chip says less than the legacy face it replaced. A new CEO (or an
 * upstream render change) that introduces unmapped vocabulary fails here
 * with the card + item type, never silently.
 */
describe('premiumCardIcons — CEO corpus sweep (no fallback chips)', () => {
  /** Structural kinds the component renders itself — never sent to mechItemIcon. */
  const STRUCTURAL = new Set<CardRenderItemType>([
    CardRenderItemType.TEXT, CardRenderItemType.PLATE, CardRenderItemType.NBSP,
  ]);

  function collectItems(nodes: ReadonlyArray<ItemType>, out: Array<ICardRenderItem>): void {
    for (const node of nodes) {
      if (node === undefined || typeof node === 'string') {
        continue;
      }
      if (isICardRenderItem(node)) {
        out.push(node);
      } else if (isICardRenderEffect(node) || isICardRenderProductionBox(node) ||
                 isICardRenderCorpBoxEffect(node) || isICardRenderCorpBoxAction(node) ||
                 isICardRenderCorpBoxEffectAction(node)) {
        for (const row of node.rows) {
          collectItems(row, out);
        }
      }
    }
  }

  it('every render item of every CEO resolves to an icon spec', () => {
    const ceos = getCards((c) => c.type === CardType.CEO);
    expect(ceos.length).to.be.greaterThan(35);
    const offenders: Array<string> = [];
    for (const card of ceos) {
      const root = card.metadata.renderData;
      if (root === undefined || !isICardRenderRoot(root)) {
        continue;
      }
      const items: Array<ICardRenderItem> = [];
      for (const row of root.rows) {
        collectItems(row, items);
      }
      for (const item of items) {
        if (STRUCTURAL.has(item.type) || item.isPlate === true) {
          continue;
        }
        if (mechItemIcon(item) === undefined) {
          offenders.push(`${card.name}: ${item.type}`);
        }
      }
    }
    expect(offenders, `unmapped CEO icons (fallback chips would ship):\n${offenders.join('\n')}`).to.deep.eq([]);
  });
});

describe('premiumCardIcons.tileIcon', () => {
  it('base Capital renders the plain city tile (no Ares art)', () => {
    const spec = tileIcon(tileNode(TileType.CAPITAL));
    expect(spec.base).to.match(/tiles\/city\.png$/);
    expect(spec.symbol).to.be.undefined;
  });

  it('Ares Capital renders the dedicated Ares tile art', () => {
    const spec = tileIcon(tileNode(TileType.CAPITAL, {isAres: true}));
    expect(spec.base).to.match(/custom_tiles\/tile_capital_ares\.png$/);
    expect(spec.symbol).to.be.undefined;
  });

  it('base special tile (Commercial District) is canvas + symbol', () => {
    const spec = tileIcon(tileNode(TileType.COMMERCIAL_DISTRICT, {hasSymbol: true}));
    expect(spec.base).to.match(/tiles\/special\.png$/);
    expect(spec.symbol).to.match(/commerical_district\.png$/);
  });

  it('Ares special tile (Commercial District) swaps to the whole Ares tile', () => {
    const spec = tileIcon(tileNode(TileType.COMMERCIAL_DISTRICT, {isAres: true}));
    expect(spec.base).to.match(/custom_tiles\/ares_commercial_district\.png$/);
    expect(spec.symbol).to.be.undefined;
  });

  it('the Ares variant WINS for a tile shared with base/promo (Deimos Down)', () => {
    // Deimos Down exists as base, promo AND Ares — the Ares node authors isAres,
    // and its art must beat the plain deimos symbol.
    const ares = tileIcon(tileNode(TileType.DEIMOS_DOWN, {isAres: true}));
    expect(ares.base).to.match(/custom_tiles\/ares_deimos_down\.png$/);
    const base = tileIcon(tileNode(TileType.DEIMOS_DOWN, {hasSymbol: true}));
    expect(base.base).to.match(/tiles\/special\.png$/);
    expect(base.symbol).to.match(/deimos\.png$/);
  });

  it('Ares-only tiles resolve to their Ares art (Biofertilizer, Metallic Asteroid)', () => {
    expect(tileIcon(tileNode(TileType.BIOFERTILIZER_FACILITY, {isAres: true})).base)
      .to.match(/custom_tiles\/ares_biofertilizer_facility\.png$/);
    expect(tileIcon(tileNode(TileType.METALLIC_ASTEROID, {isAres: true})).base)
      .to.match(/custom_tiles\/ares_metallic_asteroid\.png$/);
  });

  it('Ares-module whole tiles (Ocean City, Solar Farm) resolve to their full art even authored with isAres', () => {
    expect(tileIcon(tileNode(TileType.OCEAN_CITY, {isAres: true})).base)
      .to.match(/custom_tiles\/ares_ocean_city\.png$/);
    expect(tileIcon(tileNode(TileType.SOLAR_FARM, {isAres: true})).base)
      .to.match(/custom_tiles\/ares_solar_farm\.png$/);
  });

  it('an unmapped tile falls back to the generic special canvas', () => {
    const spec = tileIcon(tileNode(TileType.RED_CITY));
    expect(spec.base).to.match(/tiles\/special\.png$/);
  });
});
