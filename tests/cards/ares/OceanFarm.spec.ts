import {IGame} from '../../../src/server/IGame';
import {OceanFarm} from '../../../src/server/cards/ares/OceanFarm';
import {expect} from 'chai';
import {TileType} from '../../../src/common/TileType';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {TestPlayer} from '../../TestPlayer';
import {addOcean, runAllActions} from '../../TestingUtils';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';

describe('OceanFarm', () => {
  let card: OceanFarm;
  let player: TestPlayer;
  let otherPlayer: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new OceanFarm();
    [game, player, otherPlayer] = testGame(2, {aresExtension: true});
  });

  it('Can play', () => {
    addOcean(player);
    expect(card.canPlay(player)).is.false;

    addOcean(player);
    expect(card.canPlay(player)).is.false;

    addOcean(player);
    expect(card.canPlay(player)).is.false;

    addOcean(player);
    expect(card.canPlay(player)).is.true;
  });

  it('Play', () => {
    expect(player.production.heat).eq(0);
    expect(player.production.plants).eq(0);

    const oceanSpace = addOcean(player);
    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectSpace);

    expect(player.production.heat).eq(1);
    expect(player.production.plants).eq(1);

    action.cb(oceanSpace);

    expect(oceanSpace.player).to.eq(player);
    expect(oceanSpace.tile!.tileType).to.eq(TileType.OCEAN_FARM);
    expect(oceanSpace.adjacency).to.deep.eq({bonus: [SpaceBonus.PLANT]});
  });

  it('Ocean Farm counts as ocean for adjacency', () => {
    const oceanSpace = addOcean(player);
    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectSpace);
    action.cb(oceanSpace);
    const greenery = game.board.getAdjacentSpaces(oceanSpace).filter((space) => space.spaceType === SpaceType.LAND)[0];

    expect(otherPlayer.megaCredits).eq(0);

    game.addGreenery(otherPlayer, greenery);

    expect(otherPlayer.megaCredits).eq(2);
  });

  it('Placing Ocean Farm does not grant underlying space bonus', () => {
    const oceanSpace = game.board.spaces.filter((space) => {
      return space.bonus.length === 1 && space.bonus[0] === SpaceBonus.PLANT && space.spaceType === SpaceType.OCEAN;
    })[0];

    player.plants = 0;
    game.addOcean(player, oceanSpace);
    expect(player.plants).eq(1);

    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectSpace);

    expect(player.plants).eq(1);

    action.cb(oceanSpace);

    expect(oceanSpace.player).to.eq(player);
    expect(oceanSpace.tile!.tileType).to.eq(TileType.OCEAN_FARM);
    expect(player.plants).eq(1);
  });

  /*
   * THE ENGINE FUZZ, seed 2078201324 (finding #133): the last M€ went on the card, the one ocean beside a tile that
   * charges 2 M€ for building next to it was offered all the same, and the pick made the engine THROW («Placing here
   * costs 2 M€») — every land placement is filtered by what the player can pay, the covers of an ocean were not.
   */
  it('an ocean the player cannot pay to build on is never offered; paid for, it is; with no other the card is not playable', () => {
    // (Two oceans far apart: the first and the last of the board's ocean cells.)
    const cells = game.board.getAvailableSpacesForOcean(player);
    const charged = cells[0];
    const free = cells[cells.length - 1];
    game.addOcean(player, charged);
    game.addOcean(player, free);
    const neighbour = game.board.getAdjacentSpaces(charged).find((space) => space.spaceType === SpaceType.LAND && space.tile === undefined)!;
    neighbour.tile = {tileType: TileType.NUCLEAR_ZONE};
    neighbour.adjacency = {bonus: [], cost: 2};
    expect(game.board.getAdjacentSpaces(free).includes(neighbour), 'the other ocean stands away from it').to.eq(false);

    player.megaCredits = 0;
    expect(game.board.getAvailableSpacesForType(player, 'upgradeable-ocean').map((space) => space.id)).to.deep.eq([free.id]);
    player.megaCredits = 2;
    expect(game.board.getAvailableSpacesForType(player, 'upgradeable-ocean').map((space) => space.id).sort()).to.deep.eq([charged.id, free.id].sort());

    // The question the card raises reads the same list — with the money the card left.
    player.megaCredits = 1;
    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectSpace);
    expect(action.spaces.map((space) => space.id)).to.deep.eq([free.id]);

    // …and with the card's own price counted in, the only ocean being the charged one, there is nothing to play it for.
    game.removeTile(free.id);
    player.megaCredits = 16;
    expect(game.board.getAvailableSpacesForType(player, 'upgradeable-ocean', {cost: 15}).map((space) => space.id), '15 for the card + 2 to place').to.deep.eq([]);
    player.megaCredits = 17;
    expect(game.board.getAvailableSpacesForType(player, 'upgradeable-ocean', {cost: 15}).map((space) => space.id)).to.deep.eq([charged.id]);
  });
});
