import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {TileType} from '../../src/common/TileType';
import {
  cityIgnoringRestrictions, cityIgnoringRestrictionsReasoner, isAdjacentToOwnCity,
} from '../../src/server/boards/ignoreRestrictionsCity';
import {addCity, addGreenery} from '../TestingUtils';
import {CityNeighbourhood, cityNeighbourhood} from './cityNeighbourhood';

/**
 * THE CITY «IGNORING OTHER PLACEMENT RESTRICTIONS» — one cell rule for the
 * Turmoil Redux sisters: TR16 Administration District (beside one's OWN city)
 * and TR19 Sponsored Settlement (anywhere non-reserved). Only the city's own
 * «not next to a city» rule is lifted; everything the engine's land set
 * reserves stays reserved.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer};

function table(options?: {aresExtension?: boolean}): Table {
  const [game, p1, p2] = testGame(2, {aresExtension: options?.aresExtension === true, aresHazards: false});
  return {game, p1, p2};
}

/** An interior land cell: six neighbours, every one plain empty land. */
function interiorLand(game: IGame): Space {
  const board = game.board;
  const found = board.spaces.find((space) => space.spaceType === SpaceType.LAND && space.tile === undefined &&
    space.id !== board.noctisCitySpaceId &&
    board.getAdjacentSpaces(space).length === 6 &&
    board.getAdjacentSpaces(space).every((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== board.noctisCitySpaceId));
  if (found === undefined) {
    throw new Error('no interior land cell');
  }
  return found;
}

/** Own city O (p1), another player's city F (p2); X beside both, Y beside F only. */
function arranged(t: Table): CityNeighbourhood {
  const hood = cityNeighbourhood(t.game);
  addCity(t.p1, hood.own.id);
  addCity(t.p2, hood.foreign.id);
  return hood;
}

const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

describe('ignoreRestrictionsCity', () => {
  describe('adjacentToOwnCity (TR16)', () => {
    it('legal: every free land cell beside one of the player\'s own cities — a cell beside another player\'s city too', () => {
      const t = table();
      const {own, shared, foreignOnly} = arranged(t);
      const legal = ids(cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true}));
      expect(legal).to.include(shared.id, 'beside own AND foreign: the «not next to a city» rule is lifted');
      expect(legal).to.not.include(foreignOnly.id, 'beside another player\'s city only');
      expect(legal).to.not.include(own.id, 'the own city cell itself is occupied');
      expect(legal.every((id) => isAdjacentToOwnCity(t.p1, t.game.board.getSpaceOrThrow(id)))).is.true;
      // The ordinary city rule would refuse the shared cell.
      expect(ids(t.game.board.getAvailableSpacesForCity(t.p1))).to.not.include(shared.id);
    });

    it('no city of one\'s own: nothing; another player\'s cities never give adjacency', () => {
      const t = table();
      addCity(t.p2, interiorLand(t.game).id);
      expect(cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true})).is.empty;
      expect(cityIgnoringRestrictions(t.p2, {adjacentToOwnCity: true})).is.not.empty;
    });

    it('an off-Mars city has no neighbour; the Capital and a city stack are the player\'s cities', () => {
      const t = table();
      t.game.addCity(t.p1, t.game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY));
      expect(cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true}), 'Ganymede').is.empty;
      const capital = interiorLand(t.game);
      t.game.addTile(t.p1, capital, {tileType: TileType.CAPITAL});
      expect(ids(cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true}))).to.have.members(ids(t.game.board.getAdjacentSpaces(capital)));
      t.game.addCityTier(t.p1, capital);
      expect(ids(cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true})), 'a stack is still the player\'s city')
        .to.have.members(ids(t.game.board.getAdjacentSpaces(capital)));
    });

    it('reserved cells stay reserved: an ocean cell, Noctis, an occupied cell, another player\'s claim', () => {
      const t = table();
      const board = t.game.board;
      const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
      const noctisId = board.noctisCitySpaceId;
      if (noctisId === undefined) {
        throw new Error('Tharsis reserves Noctis City');
      }
      const noctis = board.getSpaceOrThrow(noctisId);
      addCity(t.p1, board.getAdjacentSpaces(noctis).filter(free)[0].id);
      const own = interiorLand(t.game);
      addCity(t.p1, own.id);
      const [greenery, claimed] = board.getAdjacentSpaces(own);
      addGreenery(t.p1, greenery.id);
      claimed.player = t.p2;
      const oceanCell = board.spaces.filter((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
        board.getAdjacentSpaces(s).some(free))[0];
      addCity(t.p1, board.getAdjacentSpaces(oceanCell).filter(free)[0].id);

      const legal = ids(cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true}));
      for (const space of [noctis, greenery, claimed, oceanCell]) {
        expect(legal, space.id).to.not.include(space.id);
      }
      const illegal = board.computeIllegalReasons(t.p1, 'city', cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true}),
        {customReasoner: cityIgnoringRestrictionsReasoner(t.p1, {adjacentToOwnCity: true})});
      const reasonOf = (space: Space) => illegal.find((e) => e.spaceId === space.id)?.reason;
      expect(reasonOf(noctis)).eq('reserved-noctis');
      expect(reasonOf(greenery)).eq('occupied');
      expect(reasonOf(claimed)).eq('owned-by-other');
      expect(reasonOf(oceanCell)).eq('ocean-only');
    });

    it('the per-cell reason: a land cell without one\'s own city beside it — never the lifted «adjacent to a city»', () => {
      const t = table();
      const {foreignOnly} = arranged(t);
      const legal = cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true});
      const illegal = t.game.board.computeIllegalReasons(t.p1, 'city', legal,
        {customReasoner: cityIgnoringRestrictionsReasoner(t.p1, {adjacentToOwnCity: true})});
      expect(illegal.find((e) => e.spaceId === foreignOnly.id)?.reason).eq('not-adjacent-to-your-city');
      expect(illegal.map((e) => e.reason)).to.not.include('adjacent-to-city');
    });

    it('Ares: an unprotected hazard beside one\'s city is coverable as usual (not a reservation); a protected one is not', () => {
      const t = table({aresExtension: true});
      const own = interiorLand(t.game);
      addCity(t.p1, own.id);
      t.p1.megaCredits = 100;
      t.p1.production.override({megacredits: 5});
      const [mild, protectedOne] = t.game.board.getAdjacentSpaces(own);
      mild.tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: false};
      protectedOne.tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: true};
      const legal = ids(cityIgnoringRestrictions(t.p1, {adjacentToOwnCity: true}));
      expect(legal).to.include(mild.id);
      expect(legal).to.not.include(protectedOne.id);
    });
  });

  describe('without adjacency (TR19)', () => {
    it('the engine\'s whole land set — beside any city included — and no reason of its own', () => {
      const t = table();
      const {shared, foreignOnly} = arranged(t);
      const legal = cityIgnoringRestrictions(t.p1, {});
      expect(ids(legal)).deep.eq(ids(t.game.board.getAvailableSpacesOnLand(t.p1)));
      expect(ids(legal)).to.include.members([shared.id, foreignOnly.id]);
      const reasoner = cityIgnoringRestrictionsReasoner(t.p1, {});
      expect(t.game.board.spaces.map(reasoner).filter((r) => r !== undefined)).is.empty;
    });
  });
});
