import {expect} from 'chai';
import {CensusCell, MARS_TILE_KINDS, marsTileCensus, marsTileKindOf, marsTilePiecesOn} from '../../src/common/boards/marsTileCensus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceId} from '../../src/common/Types';
import {TileType} from '../../src/common/TileType';
import {testGame} from '../TestGame';
import {addCity, addGreenery, addOcean, fakeCard} from '../TestingUtils';
import {Counter} from '../../src/server/behavior/Counter';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {Space} from '../../src/server/boards/Space';
import {IGame} from '../../src/server/IGame';
import {MoonExpansion} from '../../src/server/moon/MoonExpansion';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * THE CENSUS OF TILES ON MARS (TR45 Composting Initiative — «1 microbe for each
 * tile on Mars»): the ONE reading the countable, the preview's composition, the
 * journal's basis and the board peek share. The table below is the census's
 * edges as the owner decided them (2026-10-12): a stack by its tiers, an
 * upgraded ocean as ONE tile, hazards / cubes / off-board cells excluded and
 * NAMED, every owner's tile counted. Every row also pins the partition: the
 * parts sum to the total.
 */

let seq = 10;
function cell(spaceType: SpaceType, tileType?: TileType, stackHeight?: number): CensusCell {
  seq++;
  return {id: String(seq) as SpaceId, spaceType, ...(tileType === undefined ? {} : {tile: {tileType}}), ...(stackHeight === undefined ? {} : {stackHeight})};
}
const land = (t?: TileType, h?: number) => cell(SpaceType.LAND, t, h);
const ocean = (t?: TileType) => cell(SpaceType.OCEAN, t);
const offMars = (t?: TileType) => cell(SpaceType.COLONY, t);

type Row = {name: string, cells: Array<CensusCell>, total: number, parts?: Record<string, number>, excluded?: Record<string, number>};

const TABLE: ReadonlyArray<Row> = [
  {name: 'an empty board → 0', cells: [land(), ocean(), offMars()], total: 0},
  {name: 'a city, a greenery, an ocean, a special tile → one of each', cells: [land(TileType.CITY), land(TileType.GREENERY), ocean(TileType.OCEAN), land(TileType.NUCLEAR_ZONE)],
    total: 4, parts: {city: 1, greenery: 1, ocean: 1, special: 1}},
  {name: 'a stack of 2 → 2 cities (the stack\'s own law)', cells: [land(TileType.CITY, 2)], total: 2, parts: {city: 2}},
  {name: 'a stack of 3 on the Capital → 3 cities', cells: [land(TileType.CAPITAL, 3)], total: 3, parts: {city: 3}},
  {name: 'the Capital → a city', cells: [land(TileType.CAPITAL)], total: 1, parts: {city: 1}},
  {name: 'Red City / New Holland → cities', cells: [land(TileType.RED_CITY), ocean(TileType.NEW_HOLLAND)], total: 2, parts: {city: 2}},
  {name: 'Ocean City → ONE tile, a city (the owner\'s decision: an upgrade is one tile)', cells: [ocean(TileType.OCEAN_CITY)], total: 1, parts: {city: 1}},
  {name: 'Ocean Farm / Ocean Sanctuary → ONE tile each, oceans', cells: [ocean(TileType.OCEAN_FARM), ocean(TileType.OCEAN_SANCTUARY)], total: 2, parts: {ocean: 2}},
  {name: 'Wetlands → ONE tile, a greenery', cells: [land(TileType.WETLANDS)], total: 1, parts: {greenery: 1}},
  {name: 'MarsBot\'s Neural Instance and the Mohole → special tiles', cells: [land(TileType.NEURAL_INSTANCE), land(TileType.MOHOLE_AREA)], total: 2, parts: {special: 2}},
  {name: 'an Ares hazard is NOT a tile — excluded and named', cells: [land(TileType.DUST_STORM_MILD), land(TileType.EROSION_SEVERE), land(TileType.CITY)],
    total: 1, parts: {city: 1}, excluded: {hazard: 2}},
  {name: 'a neutral CUBE kept in space.tile is NOT a tile — excluded and named', cells: [land(TileType.MARTIAN_NATURE_WONDERS), land(TileType.REY_SKYWALKER)],
    total: 0, excluded: {cube: 2}},
  {name: 'a city OFF Mars (Ganymede, Phobos, a Venus city, Aurora, Nova) is not on Mars — excluded and named',
    cells: [offMars(TileType.CITY), offMars(TileType.CITY), offMars(TileType.CITY), land(TileType.GREENERY)], total: 1, parts: {greenery: 1}, excluded: {'off-mars': 3}},
  {name: 'a marker with no tile (Land Claim) → nothing', cells: [land()], total: 0},
];

describe('marsTileCensus', () => {
  for (const row of TABLE) {
    it(row.name, () => {
      const census = marsTileCensus(row.cells);
      expect(census.total).eq(row.total);
      const parts = Object.fromEntries(census.parts.map((p) => [p.kind, p.count]));
      expect(parts).deep.eq(row.parts ?? {});
      const excluded = Object.fromEntries(census.excluded.map((p) => [p.kind, p.count]));
      expect(excluded).deep.eq(row.excluded ?? {});
      // THE PARTITION: every tile in exactly one kind — the parts sum to the total.
      expect(census.parts.reduce((n, p) => n + p.count, 0), 'Σ parts = total').eq(census.total);
      // No zero share is ever listed.
      expect([...census.parts, ...census.excluded].every((p) => p.count > 0)).is.true;
    });
  }

  it('lists the parts in the census\'s order (city · greenery · ocean · special) and each part\'s cells once', () => {
    const special = land(TileType.LAVA_FLOWS);
    const stack = land(TileType.CITY, 3);
    const census = marsTileCensus([special, ocean(TileType.OCEAN), stack, land(TileType.GREENERY)]);
    expect(census.parts.map((p) => p.kind)).deep.eq(MARS_TILE_KINDS);
    const city = census.parts.find((p) => p.kind === 'city')!;
    expect(city.count, 'the stack\'s tiers').eq(3);
    expect(city.spaces, 'a stack is ONE cell of its share').deep.eq([stack.id]);
    expect(census.parts.find((p) => p.kind === 'special')!.spaces).deep.eq([special.id]);
  });

  it('partitions every tile type: one kind each, by the first match (city → greenery → ocean → special)', () => {
    const tileTypes = Object.values(TileType).filter((v): v is TileType => typeof v === 'number');
    for (const t of tileTypes) {
      expect(MARS_TILE_KINDS).includes(marsTileKindOf(t));
    }
    expect(marsTileKindOf(TileType.OCEAN_CITY)).eq('city');
    expect(marsTileKindOf(TileType.WETLANDS)).eq('greenery');
    expect(marsTileKindOf(TileType.OCEAN_FARM)).eq('ocean');
  });

  it('reads the pieces on ONE cell — the stack in its base\'s kind (the door TR44 adds its buried ocean through)', () => {
    expect(marsTilePiecesOn(land())).deep.eq([]);
    expect(marsTilePiecesOn(land(TileType.CAPITAL, 2))).deep.eq([{kind: 'city', count: 2}]);
    expect(marsTilePiecesOn(ocean(TileType.OCEAN))).deep.eq([{kind: 'ocean', count: 1}]);
  });

  describe('on a real game — the countable, every owner, the edges of the board', () => {
    function census(game: IGame, all?: boolean) {
      const player = game.players[0];
      const counter = new Counter(player, fakeCard());
      const countable = {tiles: {where: 'onmars' as const}, ...(all === undefined ? {} : {all})};
      const c = counter.marsTileCensus(countable)!;
      // THE PARITY: the countable's number IS the census's total.
      expect(counter.count(countable), 'Counter.count = census.total').eq(c.total);
      return c;
    }

    it('counts every owner\'s tiles and every ownerless ocean; `all: false` narrows to one\'s own', () => {
      const [game, p1, p2] = testGame(2);
      expect(census(game).total).eq(0);
      addCity(p1);
      addGreenery(p1);
      addCity(p2);
      addOcean(p2);
      const all = census(game);
      expect(all.total).eq(4);
      expect(Object.fromEntries(all.parts.map((p) => [p.kind, p.count]))).deep.eq({city: 2, greenery: 1, ocean: 1});
      // An ocean has no owner — it is nobody's in the narrowed count.
      expect(census(game, false).total, 'the player\'s own: a city and a greenery').eq(2);
    });

    it('sums a stack by its tiers and names the city off Mars', () => {
      const [game, p1] = testGame(2);
      const city = addCity(p1);
      city.stackHeight = 2;
      addCity(p1, SpaceName.GANYMEDE_COLONY);
      const c = census(game);
      expect(c.total).eq(2);
      expect(c.excluded).deep.eq([{kind: 'off-mars', count: 1, spaces: [SpaceName.GANYMEDE_COLONY]}]);
    });

    it('excludes and names an Ares hazard; a protected hazard is still a hazard', () => {
      const [game, p1] = testGame(2, {aresExtension: true, aresHazards: false});
      const spaces = game.board.getAvailableSpacesOnLand(p1);
      AresHazards.putHazardAt(game, spaces[0], TileType.DUST_STORM_MILD);
      AresHazards.putHazardAt(game, spaces[5], TileType.EROSION_SEVERE);
      spaces[5].tile!.protectedHazard = true;
      addCity(p1, spaces[10].id);
      const c = census(game);
      expect(c.total).eq(1);
      expect(c.excluded.map((p) => [p.kind, p.count])).deep.eq([['hazard', 2]]);
    });

    it('a Land Claim marker counts nothing; Moon tiles live on another board', () => {
      const [game, p1] = testGame(2, {moonExpansion: true});
      const space: Space = game.board.getAvailableSpacesOnLand(p1)[0];
      space.player = p1; // Land Claim: an owner, no tile
      MoonExpansion.moonData(game).moon.spaces.find((s) => s.spaceType === SpaceType.LUNAR_MINE)!.tile = {tileType: TileType.MOON_MINE};
      expect(census(game).total).eq(0);
    });

    it('counts MarsBot\'s tiles (the bot never plays the card; its tiles are on Mars)', () => {
      const [game, , bot] = testAutomaGame();
      addCity(bot);
      expect(census(game).total).greaterThanOrEqual(1);
      const botCells = game.board.spaces.filter((s) => s.player === bot && s.tile !== undefined && s.spaceType !== SpaceType.COLONY);
      expect(census(game, undefined).parts.flatMap((p) => p.spaces)).to.include.members(botCells.map((s) => s.id));
    });

    it('solo: the neutral cities and their greeneries count from the first turn', () => {
      const [game] = testGame(1);
      const neutral = game.board.spaces.filter((s) => s.tile !== undefined && s.spaceType !== SpaceType.COLONY);
      expect(neutral.length, 'the solo setup lays tiles').greaterThanOrEqual(4);
      expect(census(game).total).eq(neutral.length);
    });

    it('counts only the neighbours of the card\'s tile under `nextToThis` (the census over the filtered cells)', () => {
      const [/* game */, p1] = testGame(2);
      const counter = new Counter(p1, fakeCard());
      expect(counter.marsTileCensus({tiles: {where: 'onmars'}, nextToThis: {}})!.total, 'a card with no tile has no neighbours').eq(0);
      expect(counter.marsTileCensus({cities: {}}), 'a countable with no tiles has no census').is.undefined;
    });
  });
});
