import {expect} from 'chai';
import {Flooding} from '../../../src/server/cards/base/Flooding';
import {LandClaim} from '../../../src/server/cards/base/LandClaim';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {TestPlayer} from '../../TestPlayer';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {CardName} from '../../../src/common/cards/CardName';
import {addGreenery, formatMessage, maxOutOceans, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';

describe('Flooding', () => {
  let card: Flooding;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Flooding();
    [game, player, player2] = testGame(2);
  });

  /** Place the ocean on `space` after seating an adjacent player-2 greenery. */
  function placeNextToPlayer2(megaCredits: number): OrOptions {
    player2.megaCredits = megaCredits;
    const oceans = game.board.getAvailableSpacesForOcean(player);
    cast(card.play(player), undefined);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    expect(selectSpace.cb(oceans[0])).is.undefined;
    const adjacentSpaces = game.board.getAdjacentSpaces(oceans[0]);
    oceans[0].tile = undefined;
    for (const adjacentSpace of adjacentSpaces) {
      if (adjacentSpace.spaceType === SpaceType.LAND) {
        game.addGreenery(player2, adjacentSpace);
        break;
      }
    }

    cast(selectSpace.cb(oceans[0]), undefined);
    runAllActions(game);
    return cast(player.popWaitingFor(), OrOptions);
  }

  it('Should play — the follow-up is the premium FLAT attack shape', () => {
    const subAction = placeNextToPlayer2(4);

    // One leaf option per victim + the deliberate skip — never a nested
    // SelectPlayer wizard (the console's one-press decision screen needs
    // every branch to be a leaf).
    expect(subAction.options).has.lengthOf(2);
    const remove = cast(subAction.options[0], SelectOption);
    // The PLAYER token's value is the seat colour.
    expect(formatMessage(remove.title)).to.eq('Remove 4 M€ from ' + player2.color);
    expect(remove.metadata?.kind).to.eq('resourceRemoval');
    expect(remove.metadata?.player?.color).to.eq(player2.color);
    expect(remove.metadata?.player?.current).to.eq(4);
    expect(remove.metadata?.player?.resulting).to.eq(0);
    const skipOption = cast(subAction.options[1], SelectOption);
    expect(skipOption.metadata?.kind).to.eq('skip');

    // The console routes off this marker — an unmarked prompt falls into the
    // generic two-step list.
    expect(subAction.choiceContext?.mode).to.eq('attack');
    expect(subAction.choiceContext?.source.card).to.eq(CardName.FLOODING);
    expect(subAction.choiceContext?.trigger).is.not.undefined;

    remove.cb(undefined);
    expect(player2.megaCredits).to.eq(0);

    expect(card.getVictoryPoints(player)).to.eq(-1);
  });

  it('The removal is honest about a target with fewer than 4 M€', () => {
    const subAction = placeNextToPlayer2(2);

    const remove = cast(subAction.options[0], SelectOption);
    expect(formatMessage(remove.title)).to.eq('Remove 2 M€ from ' + player2.color);
    expect(remove.metadata?.player?.current).to.eq(2);
    expect(remove.metadata?.player?.resulting).to.eq(0);

    remove.cb(undefined);
    expect(player2.megaCredits).to.eq(0);
  });

  it('The skip option removes nothing', () => {
    const subAction = placeNextToPlayer2(4);

    cast(subAction.options[1], SelectOption).cb(undefined);
    expect(player2.megaCredits).to.eq(4);
  });

  it('No prompt when the adjacent opponent has no M€', () => {
    player2.megaCredits = 0;
    const oceans = game.board.getAvailableSpacesForOcean(player);
    cast(card.play(player), undefined);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    const adjacentSpaces = game.board.getAdjacentSpaces(oceans[0]);
    for (const adjacentSpace of adjacentSpaces) {
      if (adjacentSpace.spaceType === SpaceType.LAND) {
        game.addGreenery(player2, adjacentSpace);
        break;
      }
    }

    cast(selectSpace.cb(oceans[0]), undefined);
    runAllActions(game);
    cast(player.popWaitingFor(), undefined);
  });

  it('A broke adjacent opponent is a greyed target with a reason, not a hidden one', () => {
    const [game3, player1, playerRich, playerBroke] = testGame(3);
    const card3 = new Flooding();
    playerRich.megaCredits = 7;
    playerBroke.megaCredits = 0;

    cast(card3.play(player1), undefined);
    runAllActions(game3);
    const selectSpace = cast(player1.popWaitingFor(), SelectSpace);

    // Any reserved ocean space with two land neighbours seats both opponents.
    const ocean = game3.board.getAvailableSpacesForOcean(player1)
      .find((space) => game3.board.getAdjacentSpaces(space)
        .filter((adjacent) => adjacent.spaceType === SpaceType.LAND).length >= 2)!;
    const adjacentLand = game3.board.getAdjacentSpaces(ocean)
      .filter((space) => space.spaceType === SpaceType.LAND);
    game3.addGreenery(playerRich, adjacentLand[0]);
    game3.addGreenery(playerBroke, adjacentLand[1]);

    cast(selectSpace.cb(ocean), undefined);
    runAllActions(game3);
    const subAction = cast(player1.popWaitingFor(), OrOptions);

    expect(subAction.options).has.lengthOf(2);
    const remove = cast(subAction.options[0], SelectOption);
    expect(formatMessage(remove.title)).to.eq('Remove 4 M€ from ' + playerRich.color);
    expect(subAction.disabledOptions).has.lengthOf(1);
    expect(subAction.disabledOptions[0].metadata?.player?.color).to.eq(playerBroke.color);
    expect(subAction.disabledOptions[0].reason).to.eq('No M€ to remove');
  });

  it('Does not suggest to remove money from yourself', () => {
    player2.megaCredits = 4;
    const oceanSpaces = game.board.getAvailableSpacesForOcean(player);
    cast(card.play(player), undefined);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    addGreenery(player, '03');
    addGreenery(player2, '05');

    cast(selectSpace.cb(oceanSpaces[0]), undefined);
    runAllActions(game);
    const subAction = cast(player.popWaitingFor(), OrOptions);
    expect(subAction.options).has.lengthOf(2);

    const remove = cast(subAction.options[0], SelectOption);
    expect(remove.metadata?.player?.color).to.eq(player2.color);
  });

  it('Does not suggest player who played Land Claim', () => {
    const landClaim = new LandClaim();
    const landClaimAction = cast(landClaim.play(player2), SelectSpace);
    const adjacentSpace = game.board.getAvailableSpacesOnLand(player).filter((space) => space.id === '03')[0];

    landClaimAction.cb(adjacentSpace);
    expect(adjacentSpace.player).to.eq(player2);
    expect(adjacentSpace.tile).is.undefined;

    const oceanSpaces = game.board.getAvailableSpacesForOcean(player);
    cast(card.play(player), undefined);
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    expect(selectSpace.cb(oceanSpaces[0])).is.undefined;
  });

  it('Does not suggest to remove money if oceans are already maxed', () => {
    maxOutOceans(player);
    expect(card.canPlay(player)).is.true;

    cast(card.play(player), undefined);
  });
});
