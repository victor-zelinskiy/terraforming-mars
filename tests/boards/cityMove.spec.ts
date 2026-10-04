import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {Capital} from '../../src/server/cards/base/Capital';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {
  cityMoveDestinations, cityMoveOffer, cityMovePromptModel, cityMoveReasoner, cityStandsOnOcean, findCityMove, movableCities,
} from '../../src/server/boards/cityMove';
import {cityIgnoringRestrictions, cityIgnoringRestrictionsReasoner} from '../../src/server/boards/ignoreRestrictionsCity';
import {liftTopCity, tiersOf} from '../../src/server/boards/cityStack';
import {aggregateByPlayer} from '../../src/common/events/aggregate';
import {addGreenery, addOcean, runAllActions} from '../TestingUtils';

/**
 * A CITY MOVES (Turmoil Redux TR14 Re-settlement) — the engine's one mover
 * (`Game.moveCityTile` + `liftTopCity`) and the one reading of «who may move,
 * and where» (`boards/cityMove.ts`, standing on the family's cell rule with
 * `adjacentTo`). Every rule reading the card's header lists is pinned here at
 * the engine; the card's own spec pins the play.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer};

function table(options?: {aresExtension?: boolean}): Table {
  const [game, p1, p2] = testGame(2, {aresExtension: options?.aresExtension === true, aresHazards: false});
  return {game, p1, p2};
}

const ids = (spaces: ReadonlyArray<Space>) => spaces.map((s) => s.id);

/** An interior land cell: six neighbours, every one plain empty land with no owner. */
function interiorLand(game: IGame, skip: ReadonlyArray<string> = []): Space {
  const board = game.board;
  const plain = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
  const found = board.spaces.find((space) => plain(space) && !skip.includes(space.id) &&
    board.getAdjacentSpaces(space).length === 6 && board.getAdjacentSpaces(space).every(plain));
  if (found === undefined) {
    throw new Error('no interior land cell');
  }
  return found;
}

/** A land cell with a free land neighbour and an OCEAN-reserved neighbour (both empty). */
function landBesideOceanCell(game: IGame): {city: Space, ocean: Space} {
  const board = game.board;
  for (const city of board.spaces) {
    if (city.spaceType !== SpaceType.LAND || city.tile !== undefined || city.id === board.noctisCitySpaceId) {
      continue;
    }
    const ocean = board.getAdjacentSpaces(city).find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined);
    if (ocean !== undefined) {
      return {city, ocean};
    }
  }
  throw new Error('no land cell beside an ocean cell');
}

/** Seat a city of `player` on `space` without any placement rule. */
function seatCity(game: IGame, player: TestPlayer, space: Space, card?: CardName): Space {
  game.simpleAddTile(player, space, card === undefined ? {tileType: TileType.CITY} : {tileType: TileType.CITY, card});
  return space;
}

/** A neighbour of `space` that is free land. */
function freeNeighbour(game: IGame, space: Space, skip: ReadonlyArray<string> = []): Space {
  const found = game.board.getAdjacentSpaces(space).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && !skip.includes(s.id));
  if (found === undefined) {
    throw new Error('no free neighbour');
  }
  return found;
}

describe('cityMove', () => {
  describe('Game.moveCityTile — the one mover', () => {
    it('an ordinary city moves whole: the old cell is bare land with no owner, the new one carries the SAME tile', () => {
      const {game, p1} = table();
      const from = seatCity(game, p1, interiorLand(game), CardName.RESEARCH_OUTPOST);
      const tile = from.tile;
      const to = freeNeighbour(game, from);

      game.moveCityTile(p1, from, to);

      expect(from.tile, 'the old cell is empty').is.undefined;
      expect(from.player, 'and nobody\'s').is.undefined;
      expect('stackHeight' in from).is.false;
      expect(to.tile, 'the SAME tile object travelled — its identity with it').eq(tile);
      expect(to.tile?.card).eq(CardName.RESEARCH_OUTPOST);
      expect(to.player).eq(p1);
      expect(game.board.countCities(p1), 'the number of cities did not change').eq(1);
    });

    it('records ONE `tile-moved` event in place of `tile-placed`, and «tiles placed» does not grow', () => {
      const {game, p1} = table();
      const from = seatCity(game, p1, interiorLand(game));
      const to = freeNeighbour(game, from);
      const placedBefore = aggregateByPlayer(game.events.events).get(p1.color)?.tilesPlaced ?? 0;
      const eventsBefore = game.events.events.length;

      game.moveCityTile(p1, from, to);

      const fresh = game.events.events.slice(eventsBefore);
      const moved = fresh.filter((e) => e.type === 'tile-moved');
      expect(moved).has.length(1);
      expect(moved[0].impact.tileMove).deep.eq({from: from.id, to: to.id, tileType: TileType.CITY});
      expect(moved[0].space, 'the destination — «show on map»').eq(to.id);
      expect(moved[0].tile).eq(TileType.CITY);
      expect(moved[0].visibility).eq('journal');
      expect(moved[0].impact.tilesPlaced, 'a moved tile is not a new one').is.undefined;
      expect(fresh.some((e) => e.type === 'tile-placed'), 'no placement event for the move').is.false;
      expect(aggregateByPlayer(game.events.events).get(p1.color)?.tilesPlaced ?? 0).eq(placedBefore);
    });

    it('writes ONE log line naming both cells, and publishes the move on the `tileMoves` ring', () => {
      const {game, p1} = table();
      const from = seatCity(game, p1, interiorLand(game));
      const to = freeNeighbour(game, from);
      const logBefore = game.gameLog.length;

      game.moveCityTile(p1, from, to);

      const lines = game.gameLog.slice(logBefore).filter((l) => l.message === '${0} moved their city · ${1} → ${2}');
      expect(lines).has.length(1);
      expect(lines[0].data.map((d) => d.value)).deep.eq([p1.color, from.id, to.id]);
      expect(game.gameLog.slice(logBefore).some((l) => String(l.message).includes('placed')), 'never «placed city tile»').is.false;
      expect(game.tileMoves).has.length(1);
      expect(game.tileMoves[0]).deep.include({from: from.id, to: to.id, tileType: TileType.CITY, color: p1.color});
    });

    it('the ring is bounded and each record takes its own `seq`', () => {
      const {game, p1} = table();
      let city = seatCity(game, p1, interiorLand(game));
      for (let i = 0; i < 10; i++) {
        const next = freeNeighbour(game, city);
        game.moveCityTile(p1, city, next);
        city = next;
      }
      expect(game.tileMoves.length).eq(8);
      expect(new Set(game.tileMoves.map((m) => m.seq)).size, 'every record is consumable once').eq(8);
    });

    it('pays the new cell\'s printed bonus and its ocean adjacency — by the engine\'s own `addTile`', () => {
      const {game, p1, p2} = table();
      const {city: to, ocean} = landBesideOceanCell(game);
      const from = freeNeighbour(game, to);
      seatCity(game, p1, from);
      addOcean(p2, ocean.id);
      to.bonus = [SpaceBonus.STEEL, SpaceBonus.STEEL];
      p1.megaCredits = 0;
      p1.steel = 0;

      game.moveCityTile(p1, from, to);
      runAllActions(game);

      expect(p1.steel, 'the printed bonus of the new cell').eq(2);
      expect(p1.megaCredits, 'the ocean beside the new cell').eq(p1.oceanBonus);
    });

    it('the freed cell pays its printed bonus AGAIN to whoever takes it next', () => {
      const {game, p1, p2} = table();
      const from = seatCity(game, p1, interiorLand(game));
      from.bonus = [SpaceBonus.TITANIUM];
      const to = freeNeighbour(game, from);
      game.moveCityTile(p1, from, to);
      p2.titanium = 0;

      game.addGreenery(p2, from, false);
      runAllActions(game);

      expect(p2.titanium, 'a property of the cell, not of the move').eq(1);
      expect(from.player).eq(p2);
    });

    it('fires everything that answers «a city tile was placed» — Rover Construction and Tharsis Republic', () => {
      const {game, p1, p2} = table();
      const from = seatCity(game, p1, interiorLand(game));
      const to = freeNeighbour(game, from);
      p2.playedCards.push(new RoverConstruction());
      p1.playedCards.push(new TharsisRepublic());
      p1.megaCredits = 0;
      p2.megaCredits = 0;
      const production = p1.production.megacredits;

      game.events.beginAction(p1, {kind: 'card', card: CardName.RESEARCH_OUTPOST});
      game.moveCityTile(p1, from, to);
      runAllActions(game);
      game.events.endScope();

      expect(p2.megaCredits, 'Rover Construction: 2 M€ for any city placed').eq(2);
      expect(p1.megaCredits, 'Tharsis Republic: 3 M€ for one\'s own city').eq(3);
      expect(p1.production.megacredits, 'Tharsis Republic: +1 M€ production for a city on Mars').eq(production + 1);
    });

    it('the Capital moves as the Capital: its card\'s VP are counted by the NEW cell', () => {
      const {game, p1, p2} = table();
      const {city: to, ocean} = landBesideOceanCell(game);
      const from = freeNeighbour(game, to);
      const capital = new Capital();
      p1.playedCards.push(capital);
      game.simpleAddTile(p1, from, {tileType: TileType.CAPITAL, card: capital.name});
      addOcean(p2, ocean.id);
      const before = capital.getVictoryPoints(p1);

      game.moveCityTile(p1, from, to);

      expect(to.tile?.tileType).eq(TileType.CAPITAL);
      expect(game.board.getSpaceByTileCard(capital.name)?.id, 'the card finds its tile on the new cell').eq(to.id);
      const oceansBesideOld = game.board.getAdjacentSpaces(from).filter(Board.isOceanSpace).length;
      const oceansBesideNew = game.board.getAdjacentSpaces(to).filter(Board.isOceanSpace).length;
      expect(oceansBesideNew).greaterThan(0);
      expect(capital.getVictoryPoints(p1) - before).eq(oceansBesideNew - oceansBesideOld);
    });

    it('the Ares Capital moves to an ADJACENT cell without an exception: its adjacency leaves the old cell and stands on the new', () => {
      const {game, p1} = table({aresExtension: true});
      const from = interiorLand(game);
      const adjacency = {bonus: [SpaceBonus.MEGACREDITS, SpaceBonus.MEGACREDITS]};
      game.simpleAddTile(p1, from, {tileType: TileType.CAPITAL, card: CardName.CAPITAL_ARES});
      from.adjacency = adjacency;
      const to = freeNeighbour(game, from);
      p1.megaCredits = 0;

      expect(() => game.moveCityTile(p1, from, to)).not.to.throw();
      runAllActions(game);

      expect('adjacency' in from, 'an adjacency with no owner is what the Ares handler throws on').is.false;
      expect(to.adjacency).eq(adjacency);
      expect(p1.megaCredits, 'the Capital is not paid its own adjacency for landing beside the cell it left').eq(0);
      // …and the next tile beside the NEW cell earns the bonus, with the owner's M€ on top.
      const neighbour = freeNeighbour(game, to, [from.id]);
      game.addGreenery(p1, neighbour, false);
      runAllActions(game);
      expect(p1.megaCredits).eq(3);
    });

    it('a STACK gives up its top tier only: 2 → 1 and 3 → 2, the base keeps its tile, its card and its owner', () => {
      const {game, p1} = table();
      const from = interiorLand(game);
      game.simpleAddTile(p1, from, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      game.addCityTier(p1, from);
      game.addCityTier(p1, from);
      expect(from.stackHeight).eq(3);
      const first = freeNeighbour(game, from);

      game.moveCityTile(p1, from, first);

      expect(from.stackHeight, '3 → 2').eq(2);
      expect(from.tile?.tileType, 'the base Capital stays a Capital').eq(TileType.CAPITAL);
      expect(from.tile?.card).eq(CardName.CAPITAL);
      expect(from.player).eq(p1);
      expect(first.tile, 'what travels is a plain city, even off a Capital').deep.eq({tileType: TileType.CITY});
      expect(tiersOf(first)).eq(1);

      const second = freeNeighbour(game, from, [first.id]);
      game.moveCityTile(p1, from, second);

      expect('stackHeight' in from, '2 → 1: the key is REMOVED — an absent key is height 1').is.false;
      expect(from.tile?.tileType).eq(TileType.CAPITAL);
      expect(second.tile).deep.eq({tileType: TileType.CITY});
      expect(game.board.countCities(p1), 'three cities before, three after').eq(3);
      const event = game.events.events.filter((e) => e.type === 'tile-moved').pop()!;
      expect(event.impact.tileMove?.stack, 'the event names the height the cell was left at').deep.eq({before: 2, after: 1});
    });

    it('a St. Joseph cathedral travels with a single city, and stays with the base of a stack', () => {
      const {game, p1} = table();
      const single = seatCity(game, p1, interiorLand(game));
      game.stJosephCathedrals.push(single.id);
      const to = freeNeighbour(game, single);
      game.moveCityTile(p1, single, to);
      expect(game.stJosephCathedrals, 'the list holds cell ids — the id is rewritten').deep.eq([to.id]);

      game.addCityTier(p1, to);
      const next = freeNeighbour(game, to, [single.id]);
      game.moveCityTile(p1, to, next);
      expect(game.stJosephCathedrals, 'a stack\'s cathedral stays on the base').deep.eq([to.id]);
    });

    it('a co-owner travels with the single tile', () => {
      const {game, p1, p2} = table();
      const from = seatCity(game, p1, interiorLand(game));
      from.coOwner = p2;
      const to = freeNeighbour(game, from);
      game.moveCityTile(p1, from, to);
      expect('coOwner' in from).is.false;
      expect(to.coOwner).eq(p2);
    });

    it('survives a save and a load: the city stands on the new cell, the old one is free', () => {
      const {game, p1} = table();
      const from = seatCity(game, p1, interiorLand(game));
      game.addCityTier(p1, from);
      const to = freeNeighbour(game, from);
      game.moveCityTile(p1, from, to);

      const live = Game.deserialize(structuredClone(game.serialize()));
      const loadedFrom = live.board.getSpaceOrThrow(from.id);
      const loadedTo = live.board.getSpaceOrThrow(to.id);
      expect(loadedFrom.tile?.tileType).eq(TileType.CITY);
      expect(loadedFrom.stackHeight, 'a stack of two left at one writes no field').is.undefined;
      expect(loadedTo.tile?.tileType).eq(TileType.CITY);
      expect(loadedTo.player?.id).eq(p1.id);
      expect(live.board.countCities(live.getPlayerById(p1.id))).eq(2);
      expect(live.tileMoves, 'the ring is presentation, never state').deep.eq([]);
    });

    describe('refuses — before touching anything', () => {
      function snapshot(space: Space) {
        return {tile: space.tile, player: space.player, stackHeight: space.stackHeight};
      }

      it('a cell that is not adjacent', () => {
        const {game, p1} = table();
        const from = seatCity(game, p1, interiorLand(game));
        const far = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
          s.id !== game.board.noctisCitySpaceId && !game.board.getAdjacentSpaces(from).includes(s))!;
        const before = snapshot(from);
        expect(() => game.moveCityTile(p1, from, far)).to.throw(/cannot be moved/);
        expect(snapshot(from)).deep.eq(before);
        expect(far.tile).is.undefined;
        expect(game.tileMoves).deep.eq([]);
      });

      it('another player\'s city, and a city on a colony slot', () => {
        const {game, p1, p2} = table();
        const foreign = seatCity(game, p2, interiorLand(game));
        expect(() => game.moveCityTile(p1, foreign, freeNeighbour(game, foreign))).to.throw(/Not a city of yours/);
        const ganymede = game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY);
        game.simpleAddTile(p1, ganymede, {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY});
        expect(() => game.moveCityTile(p1, ganymede, interiorLand(game, [foreign.id]))).to.throw(/Not a city of yours/);
        expect(ganymede.tile?.card).eq(CardName.GANYMEDE_COLONY);
      });

      it('a city OVER AN OCEAN — the tile and the ocean under it stay as they are', () => {
        const {game, p1} = table();
        const {city: land, ocean} = landBesideOceanCell(game);
        addOcean(p1, ocean.id);
        const covered = ocean.tile;
        game.addTile(p1, ocean, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: covered});
        const oceans = game.board.getOceanSpaces().length;

        expect(() => game.moveCityTile(p1, ocean, land)).to.throw(/Not a city of yours that can be moved/);

        expect(ocean.tile?.tileType).eq(TileType.OCEAN_CITY);
        expect(ocean.tile?.covers).eq(covered);
        expect(land.tile).is.undefined;
        expect(game.board.getOceanSpaces().length, 'the ocean count did not move').eq(oceans);
      });

      it('an occupied cell, and a cell another player claimed', () => {
        const {game, p1, p2} = table();
        const from = seatCity(game, p1, interiorLand(game));
        const occupied = freeNeighbour(game, from);
        addGreenery(p2, occupied.id);
        expect(() => game.moveCityTile(p1, from, occupied)).to.throw(/cannot be moved/);
        const claimed = freeNeighbour(game, from);
        claimed.player = p2;
        expect(() => game.moveCityTile(p1, from, claimed)).to.throw(/cannot be moved/);
        expect(from.tile?.tileType).eq(TileType.CITY);
      });
    });
  });

  describe('liftTopCity', () => {
    it('throws on a cell with no city, and reports the heights it left', () => {
      const {game, p1} = table();
      const empty = interiorLand(game);
      expect(() => liftTopCity(empty)).to.throw();
      const city = seatCity(game, p1, empty);
      game.addCityTier(p1, city);
      expect(liftTopCity(city).tiers).deep.eq({before: 2, after: 1});
      expect(liftTopCity(city).tiers).deep.eq({before: 1, after: 0});
      expect(city.tile).is.undefined;
    });
  });

  describe('where a city may move — `cityIgnoringRestrictions` with `adjacentTo`', () => {
    it('every free land cell beside the city — a cell beside another player\'s city too', () => {
      const {game, p1, p2} = table();
      const from = seatCity(game, p1, interiorLand(game));
      const neighbours = game.board.getAdjacentSpaces(from);
      const besideForeign = neighbours[0];
      const foreign = game.board.getAdjacentSpaces(besideForeign).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && !neighbours.includes(s) && s.id !== from.id)!;
      seatCity(game, p2, foreign);

      const legal = ids(cityIgnoringRestrictions(p1, {adjacentTo: from}));

      expect(legal).to.have.members(ids(neighbours));
      expect(legal, 'the «not next to a city» rule is lifted').to.include(besideForeign.id);
    });

    it('never an ocean cell, the Noctis cell, an occupied cell, another player\'s claim or the Nomads camp', () => {
      const {game, p1, p2} = table();
      const {city: shore, ocean} = landBesideOceanCell(game);
      seatCity(game, p1, shore);
      expect(ids(cityIgnoringRestrictions(p1, {adjacentTo: shore})), 'an ocean cell is reserved for oceans').to.not.include(ocean.id);

      const from = seatCity(game, p1, interiorLand(game));
      const lands = game.board.getAdjacentSpaces(from);
      addGreenery(p2, lands[0].id);
      lands[1].player = p2;
      game.nomadSpace = lands[2].id;
      const legal = ids(cityIgnoringRestrictions(p1, {adjacentTo: from}));
      expect(legal).to.not.include(lands[0].id, 'occupied');
      expect(legal).to.not.include(lands[1].id, 'another player\'s Land Claim');
      expect(legal).to.not.include(lands[2].id, 'the Mars Nomads camp');

      const noctis = game.board.getSpaceOrThrow(game.board.noctisCitySpaceId!);
      const besideNoctis = game.board.getAdjacentSpaces(noctis).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== game.nomadSpace)!;
      seatCity(game, p1, besideNoctis);
      expect(ids(cityIgnoringRestrictions(p1, {adjacentTo: besideNoctis}))).to.not.include(noctis.id, 'reserved for Noctis City');
    });

    it('an unprotected Ares hazard is coverable at its price; a protected one and an unaffordable one are not', () => {
      const {game, p1} = table({aresExtension: true});
      const from = seatCity(game, p1, interiorLand(game));
      const [hazard, guarded] = game.board.getAdjacentSpaces(from);
      hazard.tile = {tileType: TileType.DUST_STORM_MILD};
      guarded.tile = {tileType: TileType.DUST_STORM_MILD, protectedHazard: true};
      p1.megaCredits = 20;
      expect(ids(cityIgnoringRestrictions(p1, {adjacentTo: from}))).to.include(hazard.id);
      expect(ids(cityIgnoringRestrictions(p1, {adjacentTo: from}))).to.not.include(guarded.id);
      p1.megaCredits = 0;
      expect(ids(cityIgnoringRestrictions(p1, {adjacentTo: from})), 'the removal cost is the cell\'s own price').to.not.include(hazard.id);
    });

    it('the reasoner names a free land cell that is not a neighbour — and nothing else', () => {
      const {game, p1} = table();
      const from = seatCity(game, p1, interiorLand(game));
      const reasoner = cityIgnoringRestrictionsReasoner(p1, {adjacentTo: from});
      const far = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
        s.id !== game.board.noctisCitySpaceId && !game.board.getAdjacentSpaces(from).includes(s))!;
      expect(reasoner(far)).eq('not-adjacent-to-the-city');
      expect(reasoner(game.board.getAdjacentSpaces(from)[0]), 'a neighbour has no reason of this rule').is.undefined;
      expect(reasoner(from), 'the occupied cell keeps the generic reason').is.undefined;
    });
  });

  describe('who may move — `cityMoveOffer`', () => {
    it('an ordinary city, the Capital and a city on the Noctis cell are sources; a colony city and another player\'s are not listed at all', () => {
      const {game, p1, p2} = table();
      const first = interiorLand(game);
      const plain = seatCity(game, p1, first);
      const second = interiorLand(game, [first.id, ...ids(game.board.getAdjacentSpaces(first))]);
      game.simpleAddTile(p1, second, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      const noctis = game.board.getSpaceOrThrow(game.board.noctisCitySpaceId!);
      game.simpleAddTile(p1, noctis, {tileType: TileType.CITY, card: CardName.NOCTIS_CITY});
      game.simpleAddTile(p1, game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY), {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY});
      const foreign = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== noctis.id &&
        game.board.getAdjacentSpaces(s).every((n) => n.tile === undefined))!;
      seatCity(game, p2, foreign);

      const offer = cityMoveOffer(p1);

      expect(offer.sources.map((s) => s.from.id)).to.have.members([plain.id, second.id, noctis.id]);
      expect(offer.disabledSources).deep.eq([]);
      const capital = offer.sources.find((s) => s.from.id === second.id)!;
      expect(capital.tileType).eq(TileType.CAPITAL);
      expect(capital.card).eq(CardName.CAPITAL);
      expect(capital.arrives, 'a single Capital arrives as a Capital').eq(TileType.CAPITAL);
      expect(capital.tiers).eq(1);
      expect(movableCities(p1).map((s) => s.from.id)).deep.eq(offer.sources.map((s) => s.from.id));
    });

    it('a stack is ONE source whose top tier arrives as a plain city — even over a Capital', () => {
      const {game, p1} = table();
      const from = interiorLand(game);
      game.simpleAddTile(p1, from, {tileType: TileType.CAPITAL, card: CardName.CAPITAL});
      game.addCityTier(p1, from);
      const [source] = cityMoveOffer(p1).sources;
      expect(source.tiers).eq(2);
      expect(source.tileType, 'the cell\'s own tile').eq(TileType.CAPITAL);
      expect(source.arrives).eq(TileType.CITY);
    });

    it('the destinations run clockwise from the EAST neighbour', () => {
      const {game, p1} = table();
      const from = seatCity(game, p1, interiorLand(game));
      const ring = game.board.getAdjacentSpacesClockwise(from);
      const [source] = cityMoveOffer(p1).sources;
      // top-left, top-right, RIGHT, bottom-right, bottom-left, left → from the east.
      expect(ids(source.to)).deep.eq([ring[2], ring[3], ring[4], ring[5], ring[0], ring[1]].map((s) => s!.id));
    });

    it('a city with nowhere to go is LISTED with its one reason, never hidden', () => {
      const {game, p1, p2} = table();
      const from = seatCity(game, p1, interiorLand(game));
      game.board.getAdjacentSpaces(from).forEach((s) => game.simpleAddTile(p2, s, {tileType: TileType.GREENERY}));
      const offer = cityMoveOffer(p1);
      expect(offer.sources).deep.eq([]);
      expect(offer.disabledSources.map((e) => [e.space.id, e.reason])).deep.eq([[from.id, 'no-space-to-move']]);
    });

    for (const special of [
      {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY},
      {tileType: TileType.NEW_HOLLAND, card: CardName.NEW_HOLLAND},
    ]) {
      it(`a city OVER AN OCEAN (${TileType[special.tileType]}) is the player's city with its OWN reason and zero destinations`, () => {
        const {game, p1} = table();
        const {ocean} = landBesideOceanCell(game);
        addOcean(p1, ocean.id);
        game.addTile(p1, ocean, {...special, covers: ocean.tile});
        expect(game.board.getCitiesOnMars(p1).map((s) => s.id), 'it IS a city of theirs on Mars').deep.eq([ocean.id]);
        expect(cityStandsOnOcean(ocean)).is.true;

        const offer = cityMoveOffer(p1);

        expect(offer.sources, 'never a source').deep.eq([]);
        expect(offer.disabledSources.map((e) => [e.space.id, e.reason]), 'the more fundamental reason, though free land stands beside it')
          .deep.eq([[ocean.id, 'city-stands-on-ocean']]);
        expect(cityMoveDestinations(offer)).deep.eq([]);
      });
    }

    it('a tier built ON a city over an ocean is a plain city and moves like any tier', () => {
      const {game, p1} = table();
      const {city: land, ocean} = landBesideOceanCell(game);
      addOcean(p1, ocean.id);
      game.addTile(p1, ocean, {tileType: TileType.OCEAN_CITY, card: CardName.OCEAN_CITY, covers: ocean.tile});
      game.addCityTier(p1, ocean);
      expect(cityStandsOnOcean(ocean)).is.false;
      const [source] = cityMoveOffer(p1).sources;
      expect(source.arrives).eq(TileType.CITY);
      game.moveCityTile(p1, ocean, land);
      expect(ocean.tile?.tileType, 'the special tile never left its ocean').eq(TileType.OCEAN_CITY);
      expect('stackHeight' in ocean).is.false;
      expect(land.tile).deep.eq({tileType: TileType.CITY});
    });

    it('the prompt offers the UNION of the destinations; each city names the offered cells it cannot reach', () => {
      const {game, p1} = table();
      const first = seatCity(game, p1, interiorLand(game));
      const second = seatCity(game, p1, interiorLand(game, [first.id, ...ids(game.board.getAdjacentSpaces(first))]));
      const offer = cityMoveOffer(p1);
      const union = cityMoveDestinations(offer);
      expect(new Set(ids(union)).size, 'each cell once').eq(union.length);
      for (const source of offer.sources) {
        const own = ids(source.to);
        const others = ids(union).filter((id) => !own.includes(id));
        expect(source.illegal.map((e) => e.spaceId)).to.have.members(others);
        expect(source.illegal.every((e) => e.reason === 'not-adjacent-to-the-city')).is.true;
      }
      const firstSource = offer.sources.find((s) => s.from.id === first.id)!;
      expect(findCityMove(offer, first.id, firstSource.to[0].id)?.source.from.id).eq(first.id);
      expect(findCityMove(offer, first.id, second.id), 'a city is not a destination').is.undefined;
      const secondSource = offer.sources.find((s) => s.from.id === second.id)!;
      const firstOnly = firstSource.to.find((space) => !ids(secondSource.to).includes(space.id))!;
      expect(findCityMove(offer, second.id, firstOnly.id), 'a cell only the sibling city reaches').is.undefined;
      expect(findCityMove(offer, 'nope', firstSource.to[0].id)).is.undefined;
      // The id model is the offer, cell for cell.
      const model = cityMovePromptModel(offer);
      expect(model.sources.map((s) => s.from)).deep.eq(offer.sources.map((s) => s.from.id));
      expect(model.sources[0].to).deep.eq(ids(offer.sources[0].to));
      expect(model.disabledSources, 'absent when every city may move').is.undefined;
    });

    it('`getAvailableSpacesForType(\'city-move\')` is that union, and the prompt-level reasoner names a far free cell', () => {
      const {game, p1} = table();
      const from = seatCity(game, p1, interiorLand(game));
      const offer = cityMoveOffer(p1);
      expect(ids(game.board.getAvailableSpacesForType(p1, 'city-move'))).deep.eq(ids(cityMoveDestinations(offer)));
      const far = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
        s.id !== game.board.noctisCitySpaceId && !game.board.getAdjacentSpaces(from).includes(s))!;
      const reasoner = cityMoveReasoner(p1, offer);
      expect(reasoner(far)).eq('not-adjacent-to-the-city');
      expect(reasoner(from), 'the city\'s own cell falls through to the generic «occupied»').is.undefined;
    });

    it('the unpaid card\'s price folds into the offer: a hazard the player can cover alone is out of reach beside the card\'s cost', () => {
      const {game, p1} = table({aresExtension: true});
      const from = seatCity(game, p1, interiorLand(game));
      game.board.getAdjacentSpaces(from).forEach((s) => {
        s.tile = {tileType: TileType.DUST_STORM_MILD};
      });
      p1.megaCredits = 10;
      expect(cityMoveOffer(p1).sources).has.length(1);
      const offer = cityMoveOffer(p1, {cost: 7});
      expect(offer.sources, '8 M€ to clear + 7 for the card > 10').deep.eq([]);
      expect(offer.disabledSources.map((e) => e.reason)).deep.eq(['no-space-to-move']);
    });
  });
});
