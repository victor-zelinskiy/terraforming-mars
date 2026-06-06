import {expect} from 'chai';
import {Celestic} from '../../../src/server/cards/venusNext/Celestic';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {testGame} from '../../TestGame';
import {churn} from '../../TestingUtils';
import {cast} from '@/common/utils/utils';

describe('Celestic', () => {
  it('Should play', () => {
    const card = new Celestic();
    const [/* game */, player] = testGame(2);
    cast(card.play(player), undefined);
    player.playedCards.push(card);

    const selectCard = cast(churn(card.action(player), player), SelectCard);
    selectCard.cb([card]);
    expect(card.resourceCount).to.eq(1);

    player.addResourceTo(card, 4);

    expect(card.getVictoryPoints(player)).to.eq(1);
  });
});
