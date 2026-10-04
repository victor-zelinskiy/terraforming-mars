import {expect} from 'chai';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {stackBuriedTile, stackTopTile} from '../../src/common/boards/cityStack';
import {liftTopCity} from '../../src/server/boards/cityStack';
import {testGame} from '../TestGame';

/**
 * WHAT THE TIERS OF A STACK ARE — the physical pieces (`common/boards/cityStack.ts`).
 *
 * A stack is built one way: a PLAIN city tile is put on top of a city that
 * already stands. So the top of a pile is a plain city, and the cell's own tile
 * (the Capital, an Ocean City) is its BASE. The picture of the cell, the tier
 * that lands (Skyscrapers) and the tier that leaves (Re-settlement) all read
 * these two functions — and they must agree with what the ENGINE takes off a
 * pile, or a piece would change its kind between the board and the rules.
 */
describe('cityStack — the pieces of a pile', () => {
  it('the top of a single tile is the tile itself', () => {
    expect(stackTopTile(TileType.CITY, undefined)).eq(TileType.CITY);
    expect(stackTopTile(TileType.CAPITAL, undefined)).eq(TileType.CAPITAL);
    expect(stackTopTile(TileType.CAPITAL, 1)).eq(TileType.CAPITAL);
    expect(stackTopTile(TileType.OCEAN_CITY, 1)).eq(TileType.OCEAN_CITY);
  });

  it('the top of a pile is a PLAIN city, whatever city is the base', () => {
    expect(stackTopTile(TileType.CITY, 2)).eq(TileType.CITY);
    expect(stackTopTile(TileType.CAPITAL, 2)).eq(TileType.CITY);
    expect(stackTopTile(TileType.CAPITAL, 3)).eq(TileType.CITY);
    expect(stackTopTile(TileType.OCEAN_CITY, 2)).eq(TileType.CITY);
    expect(stackTopTile(TileType.NEW_HOLLAND, 2)).eq(TileType.CITY);
  });

  it('only a city is a pile: a height on anything else changes nothing', () => {
    expect(stackTopTile(TileType.GREENERY, 2)).eq(TileType.GREENERY);
    expect(stackBuriedTile(TileType.GREENERY, 2)).is.undefined;
  });

  it('a SPECIAL city under a tier is buried — and only there', () => {
    expect(stackBuriedTile(TileType.CAPITAL, 2)).eq(TileType.CAPITAL);
    expect(stackBuriedTile(TileType.OCEAN_CITY, 3)).eq(TileType.OCEAN_CITY);
    expect(stackBuriedTile(TileType.CAPITAL, 1), 'a single Capital is what the player sees').is.undefined;
    expect(stackBuriedTile(TileType.CAPITAL, undefined)).is.undefined;
    expect(stackBuriedTile(TileType.CITY, 3), 'a pile of plain cities hides nothing').is.undefined;
    expect(stackBuriedTile(undefined, 2)).is.undefined;
  });

  it('the ENGINE takes the same piece off a pile: a plain city leaves, the Capital stays the base', () => {
    const [game, player] = testGame(1);
    const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    space.tile = {tileType: TileType.CAPITAL};
    space.player = player;
    space.stackHeight = 2;

    expect(stackTopTile(TileType.CAPITAL, 2), 'what the board shows on top').eq(TileType.CITY);
    const lifted = liftTopCity(space);
    expect(lifted.tile.tileType, 'what the engine lifts').eq(TileType.CITY);
    expect(space.tile?.tileType, 'the base never changes its kind').eq(TileType.CAPITAL);
    expect(stackBuriedTile(space.tile?.tileType, space.stackHeight), 'a single Capital again — nothing buried').is.undefined;
    expect(stackTopTile(TileType.CAPITAL, space.stackHeight), '…and it shows as itself').eq(TileType.CAPITAL);
  });
});
