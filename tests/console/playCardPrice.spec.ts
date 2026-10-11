import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Payment} from '../../src/common/inputs/Payment';
import {playCardPriceReward} from '../../src/client/console/consoleActionCommit';

/**
 * THE CARD'S PRICE PAID WITH CARD RESOURCES (PL-163, the polish remediation iteration № 1).
 *
 * A floater of Dirigibles paying for a Venus card, a mech of EVA Mechs paying for a Space card: the counter that moves
 * lives on ANOTHER card — the ДОП. РЕСУРСЫ satellite under the hand's glass — so the price used to change with no
 * cause on screen. The play flies it as a token off the composer's PAY ROW (the visible double) into the standing
 * card's cost badge. This is the pure half: one loss per paid unit, its holder from the ONE shared table the server's
 * `pay()` spends from, its kind from the holder's manifest, and what else the play moves on that holder as the
 * check's known move.
 */
const pay = (p: Partial<Payment>): Payment => ({...Payment.EMPTY, ...p});

describe('playCardPriceReward — the card-resource price is a token off the pay row (PL-163)', () => {
  it('nothing for a price paid in M€ / steel / titanium / heat (their rows stand on the rail, their chips are the cause)', () => {
    expect(playCardPriceReward(undefined)).to.eq(undefined);
    expect(playCardPriceReward(pay({megacredits: 10, steel: 2, titanium: 1, heat: 3}))).to.eq(undefined);
  });

  it('a floater of Dirigibles, a mech of EVA Mechs — one loss per unit, on the holder the server spends from', () => {
    const price = playCardPriceReward(pay({megacredits: 1, floaters: 1, mechs: 2}));
    expect(price?.reward.cause).to.deep.eq([
      {channel: 'card-resource', resource: 'floater', amount: 1, targetCard: CardName.DIRIGIBLES, direction: 'loss'},
      {channel: 'card-resource', resource: 'mech', amount: 2, targetCard: CardName.EVA_MECHS, direction: 'loss'},
    ]);
    expect(price?.units, 'aligned with the cause — the token\'s pay row').to.deep.eq(['floaters', 'mechs']);
    expect(price?.reward.reactions).to.deep.eq([]);
    expect(price?.reward.known).to.deep.eq({});
  });

  it('what else the play moves on the SAME holder is the check\'s known move (a floater landing on Dirigibles); other cards are not', () => {
    const price = playCardPriceReward(pay({floaters: 2}), [
      {channel: 'card-resource', resource: 'floater', amount: 1, targetCard: CardName.DIRIGIBLES},
      {channel: 'card-resource', resource: 'floater', amount: 1, targetCard: CardName.AERIAL_MAPPERS},
      {channel: 'stock', resource: 'megacredits', amount: 2},
    ]);
    expect(price?.reward.known).to.deep.eq({[`card-resource:floater@${CardName.DIRIGIBLES}`]: 1});
  });
});
