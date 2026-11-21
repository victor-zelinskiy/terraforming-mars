import {expect} from 'chai';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import * as constants from '../../src/common/constants';
import {IGame} from '../../src/server/IGame';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {MoholeArea} from '../../src/server/cards/base/MoholeArea';
import {ProtectedValley} from '../../src/server/cards/base/ProtectedValley';
import {unplayableReasons} from '../../src/server/models/unplayableReasons';
import {SEA_KEEPS_ITS_CELLS} from '../../src/server/models/actionUnavailableReasons';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {addOcean, formatMessage, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';

/*
 * THE SEA KEEPS ROOM FOR ITS OCEANS (`MarsBoard.seaKeepsItsCells`) — and the two floors under it.
 *
 * The engine fuzz, FREEZE ZERO stage 5 — seed 50926: MarsBot (PolderTECH Dutch) won three polders from the sea, a
 * seat's Mohole Area then took the ninth ocean's cell. `canAddOcean` said yes for the rest of the game with nowhere
 * to put one: a paid Lake Marineris was refused half-played, and the table could not end.
 */
describe('the sea keeps room for its oceans', () => {
  let game: IGame;
  let player: TestPlayer;
  let other: TestPlayer;

  beforeEach(() => {
    [game, player, other] = testGame(2);
  });

  const freeCells = () => game.board.getSpaces(SpaceType.OCEAN).filter((space) => space.tile === undefined);
  /** Build `count` tiles that are no ocean on the sea (what a polder, Mohole Area, Mangrove do). */
  const buildOnSea = (count: number) => {
    for (const space of freeCells().slice(0, count)) {
      game.simpleAddTile(other, space, {tileType: TileType.GREENERY});
    }
  };
  const reasonsOf = (card: MoholeArea | ProtectedValley) => unplayableReasons(player, card).map((reason) => reason.message);

  it('the printed game never meets it: three spare cells, three tiles may be built on the sea', () => {
    const spare = freeCells().length - constants.MAX_OCEAN_TILES;
    expect(spare, 'this board has spare cells').to.be.greaterThan(0);
    expect(game.board.seaKeepsItsCells(player)).eq(false);
    buildOnSea(spare - 1);
    expect(game.board.seaKeepsItsCells(player), 'one spare cell left').eq(false);
    expect(new MoholeArea().canPlay(player)).eq(true);
    expect(new ProtectedValley().canPlay(player)).eq(true);
  });

  it('every free cell owed to an ocean: a tile that is no ocean may not take one — gate, reason and grid read ONE set', () => {
    buildOnSea(freeCells().length - constants.MAX_OCEAN_TILES);
    expect(freeCells().length).eq(constants.MAX_OCEAN_TILES);
    expect(game.board.seaKeepsItsCells(player)).eq(true);

    for (const card of [new MoholeArea(), new ProtectedValley()]) {
      expect(card.canPlay(player), card.name).eq(false);
      expect(reasonsOf(card), card.name).to.include(SEA_KEEPS_ITS_CELLS.message);
    }
    expect(game.board.getAvailableSpacesForTile(player, 'ocean')).deep.eq([]);
    // The cells are KEPT for the oceans — an ocean still has all of them.
    expect(game.board.getAvailableSpacesForOcean(player)).to.have.length(constants.MAX_OCEAN_TILES);
    expect(game.board.getAvailableSpacesForType(player, 'ocean')).to.have.length(constants.MAX_OCEAN_TILES);
  });

  it('an ocean placed owes one less and frees nothing: the law holds to the last ocean, and lets go with it', () => {
    buildOnSea(freeCells().length - constants.MAX_OCEAN_TILES);
    for (let placed = 1; placed < constants.MAX_OCEAN_TILES; placed++) {
      addOcean(player);
      expect(game.board.seaKeepsItsCells(player), `${placed} ocean(s) placed`).eq(true);
    }
    addOcean(player);
    expect(game.canAddOcean()).eq(false);
    expect(game.board.seaKeepsItsCells(player), 'no free cell, no ocean owed').eq(false);
  });

  describe('the floors — a board that got there by a road the law does not judge', () => {
    beforeEach(() => {
      // One cell too many built on: eight oceans fill the sea, the ninth has no cell.
      buildOnSea(freeCells().length - constants.MAX_OCEAN_TILES + 1);
      while (freeCells().length > 0) {
        addOcean(player);
      }
      expect(game.board.getOceanSpaces()).to.have.length(constants.MAX_OCEAN_TILES - 1);
      expect(game.canAddOcean(), 'the ceiling is not reached').eq(true);
    });

    it('an ocean the board has no cell for is SKIPPED, and said — the card is never refused half-played (Lake Marineris)', () => {
      setTemperature(game, 0);
      player.megaCredits = 30;
      const card = new LakeMarineris();
      player.cardsInHand.push(card);
      game.gameLog.length = 0;

      player.playCard(card);
      runAllActions(game);

      expect(player.popWaitingFor(), 'no cell is asked').eq(undefined);
      expect(game.deferredActions.length, 'nothing is left queued').eq(0);
      expect(player.playedCards.asArray().map((played) => played.name)).to.include(card.name);
      expect(game.board.getOceanSpaces()).to.have.length(constants.MAX_OCEAN_TILES - 1);
      const skipped = game.gameLog.map(formatMessage).filter((line) => line.includes('effect skipped'));
      expect(skipped, 'each ocean lost is named').to.have.length(2);
      expect(skipped[0]).to.include('No free ocean space on the board');
    });

    it('a table that ends when Mars is terraformed CAN END — a full sea is a finished sea', () => {
      setTemperature(game, constants.MAX_TEMPERATURE);
      setOxygenLevel(game, constants.MAX_OXYGEN_LEVEL);
      expect(game.marsIsTerraformed()).eq(true);
    });

    it('…and one free cell is one ocean still owed', () => {
      const [cell] = game.board.getOceanSpaces();
      game.removeTile(cell.id);
      setTemperature(game, constants.MAX_TEMPERATURE);
      setOxygenLevel(game, constants.MAX_OXYGEN_LEVEL);
      expect(game.marsIsTerraformed()).eq(false);
    });
  });
});
