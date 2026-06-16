import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {SelectCard} from '@/server/inputs/SelectCard';
import {PublicPlans} from '@/server/cards/promo/PublicPlans';
import {SearchForLife} from '@/server/cards/base/SearchForLife';
import {AsteroidDeflectionSystem} from '@/server/cards/promo/AsteroidDeflectionSystem';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

/**
 * Guards the public-reveal markers: PublicPlans (hand-show) and the deck-reveal
 * action cards stamp a structured `reveal` meta on their PUBLIC log + carry the
 * card names as CARD/CARDS tokens — so the premium notification + read-only
 * viewer can detect them without parsing text.
 */
describe('public card reveal log markers', () => {
  it('PublicPlans stamps a hand-show reveal marker + the card names', () => {
    const [game, player] = testGame(2);
    player.cardsInHand.push(new SearchForLife(), new AsteroidDeflectionSystem());
    const card = new PublicPlans();

    const select = cast(card.bespokePlay(player), SelectCard);
    select.cb(player.cardsInHand.slice());
    runAllActions(game);

    const log = game.gameLog.find((m) => m.reveal?.origin === 'hand');
    expect(log, 'hand-show log').to.not.be.undefined;
    expect(log!.reveal!.result).to.eq('shown');
    expect(log!.reveal!.source).to.eq(CardName.PUBLIC_PLANS);
    expect(log!.playerId, 'must be PUBLIC (not reserved)').to.be.undefined;
    const cardsToken = log!.data.find((d) => d.type === LogMessageDataType.CARDS);
    expect(cardsToken, 'CARDS token with the shown card names').to.not.be.undefined;
  });

  it('game.log attaches the reveal marker (deck-reveal plumbing)', () => {
    const [game, player] = testGame(2);
    game.log('${0} revealed and discarded ${1}', (b) => b.player(player).card(new SearchForLife()),
      {reveal: {origin: 'deck', result: 'discarded', source: CardName.SEARCH_FOR_LIFE}});
    const log = game.gameLog[game.gameLog.length - 1];
    expect(log.reveal).to.deep.eq({origin: 'deck', result: 'discarded', source: CardName.SEARCH_FOR_LIFE});
    expect(log.data.some((d) => d.type === LogMessageDataType.CARD)).to.eq(true);
  });
});
