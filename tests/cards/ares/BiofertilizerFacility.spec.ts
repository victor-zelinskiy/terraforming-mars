import {expect} from 'chai';
import {AICentral} from '../../../src/server/cards/base/AICentral';
import {Ants} from '../../../src/server/cards/base/Ants';
import {BiofertilizerFacility} from '../../../src/server/cards/ares/BiofertilizerFacility';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {IGame} from '../../../src/server/IGame';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {TileType} from '../../../src/common/TileType';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';

describe('BiofertilizerFacility', () => {
  let card: BiofertilizerFacility;
  let player: TestPlayer;
  let game: IGame;

  let scienceTagCard: IProjectCard = new AICentral();
  let microbeHost: IProjectCard = new Ants();

  beforeEach(() => {
    card = new BiofertilizerFacility();
    [game, player] = testGame(2, {aresExtension: true});
    scienceTagCard = new AICentral();
    microbeHost = new Ants();
  });

  it('Cannot play without a science tag', () => {
    expect(card.canPlay(player)).is.not.true;
  });

  it('Play', () => {
    // Set up the cards.
    // Adds the necessary Science tag.
    player.playCard(scienceTagCard);
    player.playCard(microbeHost);

    // Initial expectations that will change after playing the card.
    expect(player.production.plants).is.eq(0);
    expect(microbeHost.resourceCount).is.eq(0);
    expect(game.deferredActions).has.lengthOf(0);

    expect(card.canPlay(player)).is.true;
    card.play(player);
    runAllActions(game);
    expect(player.production.plants).is.eq(1);

    // The card-target pick prompts FIRST (PLAY_CARD_RESOURCE_CHOICE elevates
    // it ahead of the tile) — the order the play preview promises, so the
    // premium modal's pre-collected pick lands and the tile placement rides
    // the board banner instead of the pick re-surfacing after the tile.
    const selectCard = cast(player.popWaitingFor(), SelectCard<ICard>);
    selectCard.cb([microbeHost]);
    expect(microbeHost.resourceCount).is.eq(2);

    runAllActions(game);
    const action = cast(player.popWaitingFor(), SelectSpace);
    const citySpace = game.board.getAvailableSpacesForCity(player)[0];
    action.cb(citySpace);

    expect(citySpace.player).to.eq(player);
    expect(citySpace.tile!.tileType).to.eq(TileType.BIOFERTILIZER_FACILITY);
    expect(citySpace.adjacency).to.deep.eq({bonus: [SpaceBonus.PLANT, SpaceBonus.MICROBE]});
  });
});
