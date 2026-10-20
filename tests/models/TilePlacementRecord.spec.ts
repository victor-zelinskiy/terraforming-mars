import {expect} from 'chai';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {Server} from '../../src/server/models/ServerModel';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * THE TILE LANGUAGE'S RECORD (`GameModel.tilePlacements`, 2026-10-20): every tile placed on Mars names WHO placed it
 * (an ocean's placer too — the tile carries no owner) and what its cell's PRINTED bonus paid them, so another seat's
 * screen can fly the tile from the placer's chip and the bonus back to it, without guessing a thing.
 */
describe('TilePlacementRecord', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
  });

  /** A free land cell, its printed bonus overwritten for the test (the board's own cells vary by seed). */
  function landCell(bonus: Array<SpaceBonus>): Space {
    const space = game.board.getAvailableSpacesOnLand(player).find((s) => s.spaceType === SpaceType.LAND);
    if (space === undefined) {
      throw new Error('no free land cell');
    }
    space.bonus = bonus;
    return space;
  }

  it('a city on a steel cell: the placer and the steel the cell paid them', () => {
    const space = landCell([SpaceBonus.STEEL, SpaceBonus.STEEL]);
    game.addTile(player, space, {tileType: TileType.CITY});
    runAllActions(game);
    const record = game.tilePlacements.at(-1);
    expect(record).to.deep.include({spaceId: space.id, color: player.color, tileType: TileType.CITY, cards: 0});
    expect(record?.paid).to.deep.eq([{resource: 'steel', amount: 2}]);
    expect(player.steel).eq(2);
  });

  it('an OCEAN names its placer — the tile itself carries no owner', () => {
    const ocean = game.board.getAvailableSpacesForOcean(player)[0];
    ocean.bonus = [SpaceBonus.PLANT, SpaceBonus.PLANT];
    game.addTile(player, ocean, {tileType: TileType.OCEAN});
    runAllActions(game);
    const record = game.tilePlacements.at(-1);
    expect(ocean.player, 'the ocean is nobody\'s').is.undefined;
    expect(record?.color).eq(player.color);
    expect(record?.paid).to.deep.eq([{resource: 'plants', amount: 2}]);
  });

  it('a card bonus is counted as cards drawn, never as stock', () => {
    const space = landCell([SpaceBonus.DRAW_CARD, SpaceBonus.PLANT]);
    const hand = player.cardsInHand.length;
    game.addTile(player, space, {tileType: TileType.GREENERY});
    runAllActions(game);
    const record = game.tilePlacements.at(-1);
    expect(record?.cards).eq(1);
    expect(record?.paid).to.deep.eq([{resource: 'plants', amount: 1}]);
    expect(player.cardsInHand.length).eq(hand + 1);
  });

  it('a cell with no printed bonus still names its placer', () => {
    const space = landCell([]);
    game.addTile(player, space, {tileType: TileType.CITY});
    expect(game.tilePlacements.at(-1)).to.deep.include({color: player.color, paid: [], cards: 0});
  });

  it('MarsBot is paid by ITS rule — 1 M€ per covered icon, never the human\'s printed resources', () => {
    const [botGame, , bot] = testAutomaGame();
    const space = botGame.board.getAvailableSpacesOnLand(bot).find((s) => s.spaceType === SpaceType.LAND);
    if (space === undefined) {
      throw new Error('no free land cell');
    }
    space.bonus = [SpaceBonus.STEEL, SpaceBonus.PLANT];
    botGame.addTile(bot, space, {tileType: TileType.CITY});
    runAllActions(botGame);
    const record = botGame.tilePlacements.at(-1);
    expect(record?.color).eq(bot.color);
    expect(record?.paid).to.deep.eq([{resource: 'megacredits', amount: 2}]);
  });

  it('the ring is bounded, its seq strictly increasing, and it rides the game model', () => {
    const cells = game.board.getAvailableSpacesOnLand(player).filter((s) => s.spaceType === SpaceType.LAND).slice(0, 10);
    for (const space of cells) {
      space.bonus = [];
      game.addTile(player, space, {tileType: TileType.CITY});
    }
    expect(game.tilePlacements).has.length(8);
    const seqs = game.tilePlacements.map((r) => r.seq);
    expect([...seqs].sort((a, b) => a - b)).deep.eq(seqs);
    expect(new Set(seqs).size).eq(seqs.length);
    expect(Server.getGameModel(game).tilePlacements?.map((r) => r.spaceId)).deep.eq(game.tilePlacements.map((r) => r.spaceId));
  });
});
