import {expect} from 'chai';
import {tileIcon} from '@/client/components/premiumCard/premiumCardIcons';
import {ICardRenderTile} from '@/common/cards/render/Types';
import {TileType} from '@/common/TileType';

// A pure helper (no Vue deps) — runs under the server runner, like
// victoryPointsModel.spec.ts.
function tileNode(tile: TileType, opts: {isAres?: true, hasSymbol?: true} = {}): ICardRenderTile {
  return {is: 'tile', tile, isAres: opts.isAres, hasSymbol: opts.hasSymbol};
}

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
