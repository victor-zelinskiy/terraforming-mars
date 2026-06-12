import {expect} from 'chai';
import {HiTechLab} from '../../../src/server/cards/promo/HiTechLab';
import {SelectAmount} from '../../../src/server/inputs/SelectAmount';
import {Resource} from '../../../src/common/Resource';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';

describe('HiTechLab', () => {
  let card: HiTechLab;
  let player: TestPlayer;

  beforeEach(() => {
    card = new HiTechLab();
    [/* game */, player] = testGame(2);
  });

  it('Can not act if no energy resources available', () => {
    expect(card.canAct(player)).is.not.true;
    expect(card.actionUnavailableReason(player)?.message).eq('Not enough energy');
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
    player.stock.add(Resource.ENERGY, 5);
    expect(card.canAct(player)).is.true;

    const selectAmount = cast(card.action(player), SelectAmount);

    selectAmount.cb(3);
    expect(player.energy).to.eq(2);
  });

  it('Should give victory points', () => {
    card.play(player);
    expect(card.getVictoryPoints(player)).to.eq(1);
  });
});
