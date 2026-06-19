import {expect} from 'chai';
import {addCity, runAllActions} from '../../TestingUtils';
import {DeimosDownPromo} from '../../../src/server/cards/promo/DeimosDownPromo';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {KingdomofTauraro} from '../../../src/server/cards/underworld/KingdomofTauraro';
import {cast} from '../../../src/common/utils/utils';

describe('DeimosDownPromo', () => {
  let card: DeimosDownPromo;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new DeimosDownPromo();
    [game, player, player2] = testGame(2);
  });

  it('Should play without plants', () => {
    cast(card.play(player), undefined);
    runAllActions(game);
    // No opponent has plants → the plant-removal attack produces no prompt; only the
    // tile placement remains (it rides the post-confirm PlacementBanner).
    cast(player.popWaitingFor(), SelectSpace);
    expect(player.game.getTemperature()).to.eq(-24);
    expect(player.steel).to.eq(4);
    expect(player.game.deferredActions).has.lengthOf(0);
  });

  it('Can remove plants', () => {
    player2.plants = 5;

    cast(card.play(player), undefined);
    runAllActions(game);

    // The plant removal now resolves BEFORE the tile placement: it's elevated to
    // Priority.PLAY_CARD_PLANT_REMOVAL so the premium play modal can pre-collect the
    // target before confirm; the Deimos Down tile then rides the post-confirm
    // PlacementBanner. (Effects are independent — only the prompt order changed.)
    const orOptions = cast(player.popWaitingFor(), OrOptions);
    orOptions.options[0].cb();
    expect(player2.plants).to.eq(0);

    runAllActions(game);
    cast(player.popWaitingFor(), SelectSpace);
    expect(player.game.getTemperature()).to.eq(-24);
    expect(player.steel).to.eq(4);
  });

  it('Works fine in solo mode', () => {
    const [game, player] = testGame(1);

    player.plants = 15;
    cast(card.play(player), undefined);
    runAllActions(game);
    cast(player.popWaitingFor(), SelectSpace);

    expect(player.game.getTemperature()).to.eq(-24);
    expect(player.steel).to.eq(4);
    expect(player.plants).to.eq(15); // not removed
  });

  it('Compatible with Kingdom of Tauraro', () => {
    const [game, player] = testGame(2);
    player.playedCards.push(new KingdomofTauraro());

    const space35 = game.board.getSpaceOrThrow('35');
    const adjacentSpace = game.board.getAdjacentSpaces(space35)[0];

    card.play(player);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    expect(selectSpace.spaces).includes(adjacentSpace);

    addCity(player, '35');
    card.play(player);
    runAllActions(game);
    const selectSpace2 = cast(player.popWaitingFor(), SelectSpace);

    expect(selectSpace2.spaces).does.not.include(adjacentSpace);
  });
});
