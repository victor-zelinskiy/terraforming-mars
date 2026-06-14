import {expect} from 'chai';
import {cast} from '../../../src/common/utils/utils';
import {Fish} from '../../../src/server/cards/base/Fish';
import {LargeConvoy} from '../../../src/server/cards/base/LargeConvoy';
import {Pets} from '../../../src/server/cards/base/Pets';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {maxOutOceans, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';

describe('LargeConvoy', () => {
  let card: LargeConvoy;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new LargeConvoy();
    [game, player] = testGame(2);
  });

  it('Should play without animal cards', () => {
    card.play(player);

    expect(card.getVictoryPoints(player)).to.eq(2);
    expect(player.cardsInHand).has.lengthOf(2);
    expect(player.plants).to.eq(5);
  });

  it('Should play with single animal target', () => {
    const pets = new Pets();
    player.playedCards.push(pets, card);

    // The choice is deferred ahead of the ocean; it surfaces from the queue.
    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), OrOptions);
    expect(action.options).has.lengthOf(2); // gain plants / add animals

    action.options[1].cb(); // add animals → defers the target picker (single candidate still asks)
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.cards).has.lengthOf(1);
    select.cb([pets]);
    runAllActions(game);
    expect(pets.resourceCount).to.eq(4);
    expect(player.plants).to.eq(0);
  });

  it('Should play with multiple animal targets', () => {
    const pets = new Pets();
    const fish = new Fish();
    player.playedCards.push(pets, fish);

    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), OrOptions);
    expect(action.options).has.lengthOf(2);

    action.options[1].cb([pets]); // add animals
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.cards).has.lengthOf(2);
    select.cb([pets]);
    runAllActions(game);
    expect(pets.resourceCount).to.eq(4);
  });

  it('Should play and gain plants even when oceans are maxed out', () => {
    const pets = new Pets();
    player.playedCards.push(pets);
    maxOutOceans(player);
    const plantsCount = player.plants;
    const cardsInHand = player.cardsInHand.length;

    card.play(player);
    runAllActions(game);
    const action = cast(player.popWaitingFor(), OrOptions);

    expect(card.getVictoryPoints(player)).to.eq(2);
    expect(player.cardsInHand).has.lengthOf(cardsInHand + 2);

    action.options[0].cb(); // gain plants
    expect(player.plants).to.eq(plantsCount + 5);
  });
});
