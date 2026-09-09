import {expect} from 'chai';
import {Hackers} from '../../../src/server/cards/base/Hackers';
import {CardName} from '../../../src/common/cards/CardName';
import {Resource} from '../../../src/common/Resource';
import {SelectPlayer} from '../../../src/server/inputs/SelectPlayer';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';

describe('Hackers', () => {
  let card: Hackers;
  let player: TestPlayer;

  beforeEach(() => {
    card = new Hackers();
    player = TestPlayer.BLUE.newPlayer();
  });

  it('Can not play', () => {
    expect(card.canPlay(player)).is.not.true;
  });

  it('Should play', () => {
    player.production.add(Resource.ENERGY, 1);
    expect(card.canPlay(player)).is.true;
  });

  it('The attack names its source card', () => {
    const [game, gamePlayer] = testGame(2);
    gamePlayer.production.add(Resource.ENERGY, 1);

    card.play(gamePlayer);
    runAllActions(game);
    const select = cast(gamePlayer.popWaitingFor(), SelectPlayer);
    expect(select.choiceContext?.source.card).to.eq(CardName.HACKERS);
    expect(select.choiceContext?.mode).to.eq('attack');
  });
});
