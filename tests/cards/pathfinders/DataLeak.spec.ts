import {expect} from 'chai';
import {DataLeak} from '../../../src/server/cards/pathfinders/DataLeak';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {LunarObservationPost} from '../../../src/server/cards/moon/LunarObservationPost';
import {runAllActions, testGame} from '../../TestingUtils';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cast} from '../../../src/common/utils/utils';

describe('DataLeak', () => {
  let card: DataLeak;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new DataLeak();
    [game, player] = testGame(1);
  });

  it('play', () => {
    const lunarObservationPost = new LunarObservationPost();
    player.playedCards.push(lunarObservationPost);

    card.play(player);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard);
    selectCard.cb([lunarObservationPost]);

    expect(lunarObservationPost.resourceCount).eq(5);
  });
});
