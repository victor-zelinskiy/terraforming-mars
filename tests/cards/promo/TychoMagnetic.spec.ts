import {expect} from 'chai';
import {TychoMagnetics} from '../../../src/server/cards/promo/TychoMagnetics';
import {SelectAmount} from '../../../src/server/inputs/SelectAmount';
import {TestPlayer} from '../../TestPlayer';
import {cast} from '@/common/utils/utils';
import {testGame} from '../../TestGame';

describe('TychoMagnetics', () => {
  let card: TychoMagnetics;
  let player: TestPlayer;

  beforeEach(() => {
    card = new TychoMagnetics();
    [/* game */, player] = testGame(2);
  });

  it('Can not act if no energy resources available', () => {
    expect(card.canAct(player)).is.not.true;
    expect(card.actionUnavailableReason(player)?.message).eq('Not enough energy');
    player.energy = 1;
    expect(card.canAct(player)).is.true;
  });

  it('cannot act with empty deck', () => {
    player.energy = 10;
    player.game.projectDeck.drawPile.length = 0;
    expect(card.canAct(player)).is.false;
    expect(card.actionUnavailableReason(player)?.message).eq('The deck is empty');
    expect(card.actionPreview(player).branches[0].unavailableReason).eq('The deck is empty');
    expect(card.actionPreview(player).branches[0].steps).has.length(0);
  });

  it('can act with small deck', () => {
    player.energy = 10;
    player.game.projectDeck.drawPile.length = 8;
    expect(card.canAct(player)).is.true;
    const selectAmount = cast(card.action(player), SelectAmount);
    expect(selectAmount.max).eq(8);
  });

  it('Should act', () => {
    player.energy = 5;
    expect(card.canAct(player)).is.true;

    const amount = cast(card.action(player), SelectAmount);

    amount.cb(3);
    expect(player.energy).to.eq(2);
  });
});
