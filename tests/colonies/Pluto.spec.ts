import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Pluto} from '../../src/server/colonies/Pluto';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

describe('Pluto', () => {
  let pluto: Pluto;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    pluto = new Pluto();
    [game, player, player2] = testGame(2, {coloniesExtension: true});
    game.colonies.push(pluto);
  });

  it('Should build', () => {
    pluto.addColony(player);
    runAllActions(game); // Draw cards
    expect(player.cardsInHand).has.lengthOf(2);
  });

  it('Should trade', () => {
    pluto.trade(player);
    runAllActions(game); // Draw cards
    expect(player.cardsInHand).has.lengthOf(1);
  });

  it('Should give trade bonus', () => {
    pluto.addColony(player);
    runAllActions(game); // Draw a card
    expect(player.cardsInHand).has.lengthOf(2);

    pluto.trade(player2);
    runAllActions(game); // Draw a card
    expect(player.cardsInHand).has.lengthOf(3);

    const input = cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    input.cb([input.cards[0]]); // Discard a card

    runAllActions(game);

    expect(player.cardsInHand).has.lengthOf(2);
    expect(player2.cardsInHand).has.lengthOf(1);
  });

  // THE RULES resolve each colony SEPARATELY and in full: draw 1 → discard 1,
  // and only then does the next cube start. Never a merged draw and never a
  // multi-card discard (#4536 pinned the draw-before-discard order; this pins
  // the whole pairwise sequence). The prompt carries its ORDINAL so the console
  // reveal modal can lay out one zone per colony.
  it('two cubes: draw → discard → draw → discard, each prompt carrying its ordinal', () => {
    pluto.addColony(player);
    pluto.addColony(player);
    runAllActions(game);
    expect(player.cardsInHand).has.lengthOf(4);

    pluto.trade(player2);
    runAllActions(game);

    // Cube 1: ONE card drawn, ONE to discard — the second bonus has not started.
    const first = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(player.cardsInHand).has.lengthOf(5);
    expect(first.config.min).to.eq(1);
    expect(first.config.max).to.eq(1);
    expect(first.colonyBonusDiscard).to.deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 2});
    first.cb([first.cards[0]]);
    expect(player.cardsInHand).has.lengthOf(4);

    runAllActions(game);

    // Cube 2 only now draws — its card could not have been seen before choosing.
    const second = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(player.cardsInHand).has.lengthOf(5);
    expect(second.colonyBonusDiscard).to.deep.eq({colonyName: ColonyName.PLUTO, index: 2, total: 2});
    second.cb([second.cards[0]]);
    expect(player.cardsInHand).has.lengthOf(4);

    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
  });

  it('one cube: a single draw → discard pair, ordinal 1 of 1', () => {
    pluto.addColony(player);
    runAllActions(game);
    expect(player.cardsInHand).has.lengthOf(2);

    pluto.trade(player2);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(selectCard.config.min).to.eq(1);
    expect(selectCard.config.max).to.eq(1);
    expect(selectCard.colonyBonusDiscard).to.deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 1});
    selectCard.cb([selectCard.cards[0]]);
    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
  });
});
