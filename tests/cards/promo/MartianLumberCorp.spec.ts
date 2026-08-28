import {expect} from 'chai';
import {MartianLumberCorp} from '../../../src/server/cards/promo/MartianLumberCorp';
import {AquiferPumping} from '../../../src/server/cards/base/AquiferPumping';
import {IoMiningIndustries} from '../../../src/server/cards/base/IoMiningIndustries';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {CardName} from '../../../src/common/cards/CardName';
import {Payment} from '../../../src/common/inputs/Payment';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {cast} from '@/common/utils/utils';

/**
 * «Марсианская лесопильная компания» — the standing grant that lets plants pay
 * for BUILDING-tagged cards at 3 M€ each.
 *
 * The rate and the tag gate live in `Player.paymentOptionsForCard` /
 * `Player.payingAmount`; what these fixtures pin is the whole chain a console
 * payment walks — the grant flag, the per-card option the client's lanes are
 * built from, and the server ACCEPTING a plants-funded `projectCard` response.
 * (The client half was unreachable for a long time: the payment panel's lane
 * order simply had no `plants` entry — see paymentPlan.spec.ts.)
 */
describe('MartianLumberCorp', () => {
  let card: MartianLumberCorp;
  let player: TestPlayer;

  beforeEach(() => {
    card = new MartianLumberCorp();
    [/* game */, player] = testGame(1);
  });

  it('Should play', () => {
    cast(card.play(player), undefined);
    expect(player.production.plants).to.eq(1);
    expect(player.canUsePlantsAsMegacredits).is.true;
  });

  it('losing the card revokes the grant', () => {
    card.play(player);
    card.onDiscard(player);
    expect(player.canUsePlantsAsMegacredits).is.false;
  });

  it('the plants payment option is offered for BUILDING cards only', () => {
    player.playedCards.push(card);
    card.play(player);

    expect(player.affordOptionsForCard(new AquiferPumping()).plants).is.true;
    expect(player.affordOptionsForCard(new IoMiningIndustries()).plants).is.false;

    // …and without the card in the tableau it is never offered.
    player.playedCards.remove(card);
    expect(player.affordOptionsForCard(new AquiferPumping()).plants).is.false;
  });

  it('plants pay 3 M€ each towards a building card', () => {
    player.playedCards.push(card);
    card.play(player);
    const options = player.affordOptionsForCard(new AquiferPumping());

    expect(player.payingAmount(Payment.of({plants: 4}), options)).to.eq(12);
    // The same plants are worth nothing on a card with no building tag.
    expect(player.payingAmount(Payment.of({plants: 4}), player.affordOptionsForCard(new IoMiningIndustries()))).to.eq(0);
  });

  it('the server ACCEPTS a plants-funded building card and deducts them', () => {
    player.playedCards.push(card);
    card.play(player);
    player.plants = 6;
    player.megaCredits = 3;

    const selectProjectCardToPlay = new SelectProjectCardToPlay(player, [new AquiferPumping()]);

    // 5 plants (15) + 3 M€ = 18 — exactly the card's cost.
    selectProjectCardToPlay.process({
      type: 'projectCard',
      card: CardName.AQUIFER_PUMPING,
      payment: Payment.of({plants: 5, megacredits: 3}),
    });

    expect(player.playedCards.get(CardName.AQUIFER_PUMPING)).is.not.undefined;
    expect(player.plants).to.eq(1);
    expect(player.megaCredits).to.eq(0);
  });

  it('plants cannot fund a card with no building tag', () => {
    player.playedCards.push(card);
    card.play(player);
    player.plants = 20;

    const selectProjectCardToPlay = new SelectProjectCardToPlay(player, [new IoMiningIndustries()]);

    expect(() => selectProjectCardToPlay.process({
      type: 'projectCard',
      card: CardName.IO_MINING_INDUSTRIES,
      payment: Payment.of({plants: 14}),
    })).to.throw(/Did not spend enough to pay for card/);
  });
});
