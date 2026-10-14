import {expect} from 'chai';
import {TileType} from '../../src/common/TileType';
import {
  PiecedCell, buriedOceanUnder, buriedTileOf, countsAsOcean, hasPlainOcean, isPlainOceanTop, pieceCountOf, piecesOf, topTileOf,
} from '../../src/common/boards/cellPieces';
import {marsTilePiecesOn} from '../../src/common/boards/marsTileCensus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceId} from '../../src/common/Types';

/**
 * THE PIECES ON A CELL (`common/boards/cellPieces.ts`) — the ONE reading of
 * «what lies here» the engine's ocean predicates, the TR45 census and the
 * client's picture of the cell all stand on (Turmoil Redux TR44 Aquatic
 * Research Station: a city ON TOP OF an ocean is TWO tiles; an Ocean City is
 * ONE). The table below is the owner's ruling (2026-10-13), row by row, read
 * from BOTH shapes — the server's `Space` (`tile.covers`) and the client's
 * `SpaceModel` (`under`) — so the two sides can never read one cell differently.
 */
type Row = {
  name: string,
  cell: PiecedCell,
  /** The same cell as the client sees it (what the server publishes as `under`). */
  model: PiecedCell,
  tile: TileType | undefined,
  under: TileType | undefined,
  tiers: number,
  plainOcean: boolean,
  plainTop: boolean,
  ocean: boolean,
  top: TileType | undefined,
  buried: TileType | undefined,
  pieces: number,
  census: ReadonlyArray<{kind: string, count: number}>,
};

const OCEAN = {tileType: TileType.OCEAN};

const TABLE: ReadonlyArray<Row> = [
  {name: 'an empty cell', cell: {}, model: {},
    tile: undefined, under: undefined, tiers: 0, plainOcean: false, plainTop: false, ocean: false, top: undefined, buried: undefined, pieces: 0, census: []},
  {name: 'a plain ocean', cell: {tile: OCEAN}, model: {tileType: TileType.OCEAN},
    tile: TileType.OCEAN, under: undefined, tiers: 1, plainOcean: true, plainTop: true, ocean: true, top: TileType.OCEAN, buried: undefined, pieces: 1,
    census: [{kind: 'ocean', count: 1}]},
  {name: 'a plain city', cell: {tile: {tileType: TileType.CITY}}, model: {tileType: TileType.CITY},
    tile: TileType.CITY, under: undefined, tiers: 1, plainOcean: false, plainTop: false, ocean: false, top: TileType.CITY, buried: undefined, pieces: 1,
    census: [{kind: 'city', count: 1}]},
  {name: 'a CITY OVER AN OCEAN (TR44) — two pieces, the ocean marked', cell: {tile: {tileType: TileType.CITY, covers: OCEAN}}, model: {tileType: TileType.CITY, under: TileType.OCEAN},
    tile: TileType.CITY, under: TileType.OCEAN, tiers: 1, plainOcean: true, plainTop: false, ocean: true, top: TileType.CITY, buried: TileType.OCEAN, pieces: 2,
    census: [{kind: 'city', count: 1}, {kind: 'ocean', count: 1}]},
  {name: 'a STACK over an ocean (TR44 + Skyscrapers) — three pieces, the ocean still the mark', cell: {tile: {tileType: TileType.CITY, covers: OCEAN}, stackHeight: 2},
    model: {tileType: TileType.CITY, under: TileType.OCEAN, stackHeight: 2},
    tile: TileType.CITY, under: TileType.OCEAN, tiers: 2, plainOcean: true, plainTop: false, ocean: true, top: TileType.CITY, buried: TileType.OCEAN, pieces: 3,
    census: [{kind: 'city', count: 2}, {kind: 'ocean', count: 1}]},
  {name: 'an OCEAN CITY — ONE composite piece; the ocean it covers is not a piece', cell: {tile: {tileType: TileType.OCEAN_CITY, covers: OCEAN}}, model: {tileType: TileType.OCEAN_CITY},
    tile: TileType.OCEAN_CITY, under: undefined, tiers: 1, plainOcean: false, plainTop: false, ocean: true, top: TileType.OCEAN_CITY, buried: undefined, pieces: 1,
    census: [{kind: 'city', count: 1}]},
  {name: 'an Ocean Farm / New Holland — one piece each', cell: {tile: {tileType: TileType.NEW_HOLLAND, covers: OCEAN}}, model: {tileType: TileType.NEW_HOLLAND},
    tile: TileType.NEW_HOLLAND, under: undefined, tiers: 1, plainOcean: false, plainTop: false, ocean: true, top: TileType.NEW_HOLLAND, buried: undefined, pieces: 1,
    census: [{kind: 'city', count: 1}]},
  {name: 'Wetlands — one piece, counts as an ocean, never a plain one', cell: {tile: {tileType: TileType.WETLANDS}}, model: {tileType: TileType.WETLANDS},
    tile: TileType.WETLANDS, under: undefined, tiers: 1, plainOcean: false, plainTop: false, ocean: true, top: TileType.WETLANDS, buried: undefined, pieces: 1,
    census: [{kind: 'greenery', count: 1}]},
  {name: 'the Capital under a tier — the Capital is the mark (the stack\'s own law)', cell: {tile: {tileType: TileType.CAPITAL}, stackHeight: 2}, model: {tileType: TileType.CAPITAL, stackHeight: 2},
    tile: TileType.CAPITAL, under: undefined, tiers: 2, plainOcean: false, plainTop: false, ocean: false, top: TileType.CITY, buried: TileType.CAPITAL, pieces: 2,
    census: [{kind: 'city', count: 2}]},
  {name: 'a greenery over a hazard — a hazard is removed, never a piece', cell: {tile: {tileType: TileType.GREENERY, covers: {tileType: TileType.DUST_STORM_MILD}}}, model: {tileType: TileType.GREENERY},
    tile: TileType.GREENERY, under: undefined, tiers: 1, plainOcean: false, plainTop: false, ocean: false, top: TileType.GREENERY, buried: undefined, pieces: 1,
    census: [{kind: 'greenery', count: 1}]},
];

describe('cellPieces — the pieces on a cell', () => {
  for (const row of TABLE) {
    for (const [shape, cell] of [['the server\'s Space', row.cell], ['the client\'s SpaceModel', row.model]] as const) {
      it(`${row.name} — read from ${shape}`, () => {
        expect(piecesOf(cell)).deep.eq({tile: row.tile, under: row.under, tiers: row.tiers});
        expect(hasPlainOcean(cell), 'hasPlainOcean').eq(row.plainOcean);
        expect(isPlainOceanTop(cell), 'isPlainOceanTop').eq(row.plainTop);
        expect(countsAsOcean(cell), 'countsAsOcean').eq(row.ocean);
        expect(topTileOf(cell), 'topTileOf').eq(row.top);
        expect(buriedTileOf(cell), 'buriedTileOf').eq(row.buried);
        expect(pieceCountOf(cell), 'pieceCountOf').eq(row.pieces);
        expect(marsTilePiecesOn({id: 'x' as SpaceId, spaceType: SpaceType.LAND, ...cell}), 'the census').deep.eq(row.census);
      });
    }
  }

  it('the composite rule: a covered ocean is a piece exactly when the tile over it is not itself an ocean', () => {
    expect(buriedOceanUnder(TileType.CITY, TileType.OCEAN)).eq(TileType.OCEAN);
    expect(buriedOceanUnder(TileType.CAPITAL, TileType.OCEAN), 'any non-ocean tile over water keeps the water a piece').eq(TileType.OCEAN);
    expect(buriedOceanUnder(TileType.OCEAN_CITY, TileType.OCEAN), 'a composite absorbs it').is.undefined;
    expect(buriedOceanUnder(TileType.OCEAN_FARM, TileType.OCEAN)).is.undefined;
    expect(buriedOceanUnder(TileType.OCEAN_SANCTUARY, TileType.OCEAN)).is.undefined;
    expect(buriedOceanUnder(TileType.NEW_HOLLAND, TileType.OCEAN)).is.undefined;
    expect(buriedOceanUnder(TileType.WETLANDS, TileType.OCEAN)).is.undefined;
    expect(buriedOceanUnder(TileType.CITY, TileType.DUST_STORM_MILD), 'only a plain OCEAN is a buried piece').is.undefined;
    expect(buriedOceanUnder(TileType.CITY, undefined)).is.undefined;
    expect(buriedOceanUnder(undefined, TileType.OCEAN)).is.undefined;
  });

  it('the client\'s `under` wins over the server shape when both are given (the model is what the server published)', () => {
    expect(piecesOf({tileType: TileType.CITY, under: TileType.OCEAN, tile: {tileType: TileType.CITY}}).under).eq(TileType.OCEAN);
  });
});
