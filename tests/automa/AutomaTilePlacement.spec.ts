import {expect} from 'chai';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {fakeCard} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

function failedActions(game: IGame): number {
  return game.gameLog.filter((m) => m.message.includes('Failed Action')).length;
}

function emptyLand(game: IGame): Array<Space> {
  return game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined);
}

function adjacentEmptyLand(game: IGame, space: Space): Array<Space> {
  return game.board.getAdjacentSpaces(space).filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
}

describe('AutomaTilePlacer', () => {
  describe('tiebreakers', () => {
    it('#2: covers the most placement bonus icons', () => {
      const [game] = testAutomaGame();
      // An empty board: every candidate has 0 adjacent oceans → the icon count decides.
      const candidates = game.board.getAvailableSpacesForOcean(game.players[1]);
      const maxIcons = Math.max(...candidates.map((s) => s.bonus.length));
      // Make the max unique for determinism: keep one top space and drop the rest.
      const top = candidates.filter((s) => s.bonus.length === maxIcons);
      const picked = AutomaTilePlacer.breakTie(game, [top[0], ...candidates.filter((s) => s.bonus.length < maxIcons)]);
      expect(picked.id).eq(top[0].id);
    });

    it('#3: flips a project card and counts through the tied spaces in board order', () => {
      const [game] = testAutomaGame();
      // Three icon-less, ocean-free land spaces = a genuine tie down to the flip.
      const tied = emptyLand(game)
        .filter((s) => s.bonus.length === 0)
        .filter((s) => game.board.getAdjacentSpaces(s).every((adj) => !Board.isOceanSpace(adj)))
        .slice(0, 3);
      expect(tied).has.length(3);
      const ordered = game.board.spaces.filter((s) => tied.includes(s));

      const discardsBefore = game.projectDeck.discardPile.length;
      game.projectDeck.drawPile.push(fakeCard({cost: 5}));
      // Counting 5 through 3 spaces: 1,2,3,1,2 → the 2nd space (index 1).
      expect(AutomaTilePlacer.breakTie(game, tied).id).eq(ordered[1].id);
      expect(game.projectDeck.discardPile.length).eq(discardsBefore + 1);
    });

    it('#3: a cost of 0 normalizes to the first tied space (OQ-5)', () => {
      const [game] = testAutomaGame();
      const tied = emptyLand(game)
        .filter((s) => s.bonus.length === 0)
        .filter((s) => game.board.getAdjacentSpaces(s).every((adj) => !Board.isOceanSpace(adj)))
        .slice(0, 3);
      const ordered = game.board.spaces.filter((s) => tied.includes(s));
      game.projectDeck.drawPile.push(fakeCard({cost: 0}));
      expect(AutomaTilePlacer.breakTie(game, tied).id).eq(ordered[0].id);
    });
  });

  describe('ocean placement', () => {
    it('places on an ocean-reserved space, gains TR, prefers the most bonus icons', () => {
      const [game, /* human */, bot] = testAutomaGame();
      const maxIcons = Math.max(...game.board.getAvailableSpacesForOcean(bot).map((s) => s.bonus.length));
      AutomaTilePlacer.placeOcean(game);
      const oceans = game.board.getOceanSpaces();
      expect(oceans).has.length(1);
      expect(oceans[0].spaceType).eq(SpaceType.OCEAN);
      expect(bot.terraformRating).eq(21);
      // Tiebreaker #2 kicked in on the empty board (no adjacent oceans anywhere).
      expect(oceans[0].bonus.length).eq(maxIcons);
    });

    it('with all 9 oceans placed the action is a Failed Action', () => {
      const [game, human, bot] = testAutomaGame();
      for (let i = 0; i < 9; i++) {
        const space = game.board.getAvailableSpacesForOcean(human)[0];
        game.simpleAddTile(human, space, {tileType: TileType.OCEAN});
      }
      AutomaTilePlacer.placeOcean(game);
      expect(failedActions(game)).eq(1);
      expect(bot.megaCredits).eq(5);
    });
  });

  describe('greenery placement', () => {
    it('goes adjacent to MarsBot cities while avoiding human cities, and raises oxygen + TR', () => {
      const [game, human, bot] = testAutomaGame();
      // A bot city somewhere roomy (4+ empty land neighbors).
      const citySpace = emptyLand(game).find((s) => adjacentEmptyLand(game, s).length >= 4)!;
      game.simpleAddTile(bot, citySpace, {tileType: TileType.CITY});

      // Poison one neighbor: a human city adjacent to it (but not to the bot city).
      const botCityNeighbors = adjacentEmptyLand(game, citySpace);
      const poisoned = botCityNeighbors.find((cand) =>
        adjacentEmptyLand(game, cand).some((s) =>
          !botCityNeighbors.includes(s) && s.id !== citySpace.id &&
          !game.board.getAdjacentSpaces(s).some((adj) => adj.id === citySpace.id)))!;
      const humanCitySpace = adjacentEmptyLand(game, poisoned).find((s) =>
        !botCityNeighbors.includes(s) && s.id !== citySpace.id &&
        !game.board.getAdjacentSpaces(s).some((adj) => adj.id === citySpace.id))!;
      game.simpleAddTile(human, humanCitySpace, {tileType: TileType.CITY});

      AutomaTilePlacer.placeGreenery(game);
      const greenery = game.board.spaces.find((s) => s.tile?.tileType === TileType.GREENERY)!;
      // Adjacent to the bot city (its own tiles rule + max own cities)…
      expect(game.board.getAdjacentSpaces(citySpace).map((s) => s.id)).contains(greenery.id);
      // …but not the neighbor that touches the human city.
      expect(greenery.id).not.eq(poisoned.id);
      expect(greenery.player?.id).eq(bot.id);
      expect(game.getOxygenLevel()).eq(1);
      expect(bot.terraformRating).eq(21);
    });

    it('a fully built-up board makes the greenery action a Failed Action', () => {
      const [game, human, bot] = testAutomaGame();
      for (const space of emptyLand(game)) {
        game.simpleAddTile(human, space, {tileType: TileType.CITY});
      }
      AutomaTilePlacer.placeGreenery(game);
      expect(failedActions(game)).eq(1);
      expect(bot.megaCredits).eq(5);
    });
  });

  describe('city placement', () => {
    it('goes adjacent to as much existing greenery as possible (anyone\'s)', () => {
      const [game, human] = testAutomaGame();
      const greenerySpace = emptyLand(game).find((s) => adjacentEmptyLand(game, s).length >= 4)!;
      game.simpleAddTile(human, greenerySpace, {tileType: TileType.GREENERY});

      AutomaTilePlacer.placeCity(game);
      const city = game.board.spaces.find((s) => s.tile?.tileType === TileType.CITY)!;
      expect(game.board.getAdjacentSpaces(greenerySpace).map((s) => s.id)).contains(city.id);
    });
  });

  describe('MarsBot placement bonuses', () => {
    it('gains 1 M€ per covered icon + 2 M€ per adjacent ocean — never the printed rewards', () => {
      const [game, human, bot] = testAutomaGame();
      // Put an ocean down, then have the bot build on an icon-bearing neighbor.
      const oceanSpace = game.board.getAvailableSpacesForOcean(human)[0];
      game.simpleAddTile(human, oceanSpace, {tileType: TileType.OCEAN});
      const spot = game.board.getAdjacentSpaces(oceanSpace)
        .find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length > 0)!;

      const icons = spot.bonus.length;
      game.addCity(bot, spot);
      expect(bot.megaCredits).eq(icons + 2);
      expect(bot.steel).eq(0);
      expect(bot.plants).eq(0);
      expect(bot.titanium).eq(0);
      expect(bot.cardsInHand).is.empty;
    });

    it('2 M€ per EACH adjacent ocean (two oceans → +4 M€)', () => {
      const [game, human, bot] = testAutomaGame();
      // Find a land space with two ocean-reserved neighbors.
      const spot = emptyLand(game).find((s) =>
        s.bonus.length === 0 &&
        game.board.getAdjacentSpaces(s).filter((adj) => adj.spaceType === SpaceType.OCEAN).length >= 2)!;
      const oceanNeighbors = game.board.getAdjacentSpaces(spot).filter((adj) => adj.spaceType === SpaceType.OCEAN);
      game.simpleAddTile(human, oceanNeighbors[0], {tileType: TileType.OCEAN});
      game.simpleAddTile(human, oceanNeighbors[1], {tileType: TileType.OCEAN});

      game.addCity(bot, spot);
      expect(bot.megaCredits).eq(4);
    });

    it('the human still receives the printed rewards (regression)', () => {
      const [game, human] = testAutomaGame();
      const spot = emptyLand(game).find((s) => s.bonus.length > 0)!;
      const before = human.megaCredits;
      game.addCity(human, spot);
      // The human got SOMETHING printed (steel/plants/cards/heat), not the bot's flat M€.
      const gainedStuff = human.steel + human.plants + human.titanium + human.heat + human.cardsInHand.length;
      expect(gainedStuff).is.greaterThan(0);
      expect(human.megaCredits).eq(before);
    });
  });
});
