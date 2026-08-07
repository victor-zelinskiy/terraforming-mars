import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TradeWithTitanFloatingLaunchPad, TitanFloatingLaunchPad} from '../../../src/server/cards/colonies/TitanFloatingLaunchPad';
import {CardName} from '../../../src/common/cards/CardName';

/**
 * The colony trade-fee picker hides a payment path it can't use. That is only
 * honest when the player doesn't OWN the card — otherwise the option must appear
 * DISABLED with the reason, or the player watches a path they paid for vanish
 * with no word of why.
 *
 * `disabledReason()` returning `undefined` is therefore a contract, not a
 * shrug: it means "there is nothing here to explain".
 */
describe('colony trader disabled reasons', () => {
  it('not owning the card → undefined (the option is legitimately absent)', () => {
    const [/* game */, player] = testGame(2, {coloniesExtension: true});
    expect(new TradeWithTitanFloatingLaunchPad(player).disabledReason()).is.undefined;
  });

  it('owned but empty → names the missing floaters, never a blank', () => {
    const [/* game */, player] = testGame(2, {coloniesExtension: true});
    const card = new TitanFloatingLaunchPad();
    player.playedCards.push(card);
    card.resourceCount = 0;
    const trader = new TradeWithTitanFloatingLaunchPad(player);
    expect(trader.canUse()).is.false;
    expect(trader.disabledReason()).eq('No floaters on this card');
  });

  it('owned, stocked, but already used this generation → names THAT instead', () => {
    const [/* game */, player] = testGame(2, {coloniesExtension: true});
    const card = new TitanFloatingLaunchPad();
    player.playedCards.push(card);
    card.resourceCount = 2;
    player.actionsThisGeneration.add(CardName.TITAN_FLOATING_LAUNCHPAD);
    const trader = new TradeWithTitanFloatingLaunchPad(player);
    expect(trader.canUse()).is.false;
    expect(trader.disabledReason()).eq('This card\'s action was already used this generation');
  });

  it('usable → canUse is true (the reason path is not consulted)', () => {
    const [/* game */, player] = testGame(2, {coloniesExtension: true});
    const card = new TitanFloatingLaunchPad();
    player.playedCards.push(card);
    card.resourceCount = 1;
    expect(new TradeWithTitanFloatingLaunchPad(player).canUse()).is.true;
  });
});
