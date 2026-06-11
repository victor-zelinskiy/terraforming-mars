import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {runNextAction} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {ProcessorFactory} from '../../../src/server/cards/moon/ProcessorFactory';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';

describe('ProcessorFactory', () => {
  let player: TestPlayer;
  let card: ProcessorFactory;

  beforeEach(() => {
    [/* game */, player] = testGame(1, {moonExpansion: true});
    card = new ProcessorFactory();
  });

  it('can act', () => {
    player.steel = 1;
    expect(card.canAct(player)).is.true;

    player.steel = 0;
    expect(card.canAct(player)).is.false;
  });

  it('act', () => {
    player.steel = 1;
    card.resourceCount = 0;
    card.action(player);
    player.playedCards.push(card);
    expect(player.steel).eq(0);
    const selectCard = cast(runNextAction(player.game), SelectCard<ICard>);
    selectCard.cb([card]);

    expect(card.resourceCount).eq(2);
  });
});
