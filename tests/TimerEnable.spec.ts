import {expect} from 'chai';
import {cast} from '../src/common/utils/utils';
import {SelectCard} from '../src/server/inputs/SelectCard';
import {SelectInitialCards} from '../src/server/inputs/SelectInitialCards';
import {testGame} from './TestingUtils';

// Upstream 31f1669f9a — the clock starts with the corporation pick; the initial selection is untimed.
describe('Timer — enabled by the corporation pick', () => {
  it('timer is disabled until the player picks their corporation', () => {
    const [/* game */, player, player2] = testGame(2, {skipInitialCardSelection: false});
    const selectInitialCards = cast(player.getWaitingFor(), SelectInitialCards);
    expect(player.timer.serialize().enabled).is.false;
    expect(player.timer.serialize().running).is.false;

    player.process({type: 'initialCards', responses: [
      {type: 'card', cards: [cast(selectInitialCards.options[0], SelectCard).cards[0].name]},
      {type: 'card', cards: []},
    ]});
    expect(player.timer.serialize().enabled).is.true;
    expect(player.timer.getElapsed()).eq(0);
    expect(player2.timer.serialize().enabled).is.false;
  });
});
