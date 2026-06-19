import {expect} from 'chai';
import {MetallicAsteroid} from '../../../src/server/cards/ares/MetallicAsteroid';
import {IGame} from '../../../src/server/IGame';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {TileType} from '../../../src/common/TileType';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';

describe('MetallicAsteroid', () => {
  let card: MetallicAsteroid;
  let player: TestPlayer;
  let otherPlayer: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new MetallicAsteroid();
    [game, player, otherPlayer] = testGame(2, {aresExtension: true});
  });

  it('Play', () => {
    otherPlayer.plants = 5;

    expect(player.titanium).eq(0);
    expect(game.getTemperature()).eq(-30);
    expect(game.deferredActions).has.lengthOf(0);

    card.play(player);
    runAllActions(game);

    expect(player.titanium).eq(1);
    expect(game.getTemperature()).eq(-28);

    // The plant-removal attack now resolves BEFORE the tile placement (elevated to
    // Priority.PLAY_CARD_PLANT_REMOVAL so the play modal can pre-collect the target);
    // the metallic-asteroid tile then rides the post-confirm PlacementBanner.
    const orOptions = cast(player.popWaitingFor(), OrOptions);
    orOptions.options[0].cb();
    expect(otherPlayer.plants).eq(1); // 5 − 4 removed

    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectSpace);
    const space = game.board.getAvailableSpacesOnLand(player)[0];
    action.cb(space);
    expect(space.player).to.eq(player);
    expect(space.tile!.tileType).to.eq(TileType.METALLIC_ASTEROID);
    expect(space.adjacency).to.deep.eq({bonus: [SpaceBonus.TITANIUM]});
  });
});
