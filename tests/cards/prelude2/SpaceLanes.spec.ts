import {expect} from 'chai';
import {SpaceLanes} from '../../../src/server/cards/prelude2/SpaceLanes';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {Ants} from '../../../src/server/cards/base/Ants';
import {CorroderSuits} from '../../../src/server/cards/venusNext/CorroderSuits';
import {IoMiningIndustries} from '../../../src/server/cards/base/IoMiningIndustries';
import {EarthOffice} from '../../../src/server/cards/base/EarthOffice';
import {PublicSpaceline} from '../../../src/server/cards/underworld/PublicSpaceline';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {SaturnSurfing} from '../../../src/server/cards/promo/SaturnSurfing';
import {InterstellarColonyShip} from '../../../src/server/cards/base/InterstellarColonyShip';
import {CardName} from '../../../src/common/cards/CardName';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {IPlayer} from '../../../src/server/IPlayer';

function discountsOf(player: IPlayer, card: IProjectCard) {
  return effectForecastForPlay(player, card, cardPlayPreview(player, card)).discounts;
}

describe('SpaceLanes', () => {
  let card: SpaceLanes;
  let player: TestPlayer;

  beforeEach(() => {
    card = new SpaceLanes();
    [/* game */, player] = testGame(2);
  });

  it('is adapted — no longer held back', () => {
    expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.SPACE_LANES)).is.false;
  });

  it('play', () => {
    card.play(player);
    expect(player.titanium).eq(3);
  });

  it('card discount', () => {
    player.playedCards.push(card);
    expect(card.getCardDiscount(player, new Ants())).eq(0);
    expect(card.getCardDiscount(player, new CorroderSuits())).eq(2);
    expect(card.getCardDiscount(player, new IoMiningIndustries())).eq(2);
    expect(card.getCardDiscount(player, new EarthOffice())).eq(2);
    // Upstream's 12 (2 Earth · 2 Jovian · 2 Venus); the fork counts its 2 Mars tags too.
    expect(card.getCardDiscount(player, new PublicSpaceline())).eq(16);
  });

  // The fork's planet tags include MARS (the P85 Summit Logistics precedent) — counted, and printed on the face.
  it('a Mars tag is a planet tag', () => {
    player.playedCards.push(card);
    expect(card.getCardDiscount(player, new CouncilSeat())).eq(2);
    expect(player.getCardCost(new CouncilSeat())).eq(4);
  });

  it('counts EACH planet tag — a Jovian + Earth card is 4 cheaper, ONE breakdown row of one source', () => {
    player.playedCards.push(card);
    const surfing = new SaturnSurfing();
    expect(player.getCardCostBreakdown(surfing)).deep.eq({
      base: 13,
      final: 9,
      discounts: [{source: {kind: 'card', card: CardName.SPACE_LANES, owner: player.color}, amount: 4}],
    });
  });

  it('a discount past the price floors at 0 — the row keeps its nominal amount', () => {
    player.playedCards.push(card);
    const office = new EarthOffice();
    expect(player.getCardCostBreakdown(office)).deep.eq({
      base: 1,
      final: 0,
      discounts: [{source: {kind: 'card', card: CardName.SPACE_LANES, owner: player.color}, amount: 2}],
    });
  });

  it('stacks with another standing discount — two rows, each named', () => {
    player.playedCards.push(card, new EarthOffice());
    const ship = new InterstellarColonyShip();
    const breakdown = player.getCardCostBreakdown(ship);
    expect(breakdown.final).eq(24 - 2 - 3);
    expect(breakdown.discounts).deep.eq([
      {source: {kind: 'card', card: CardName.SPACE_LANES, owner: player.color}, amount: 2},
      {source: {kind: 'card', card: CardName.EARTH_OFFICE, owner: player.color}, amount: 3},
    ]);
  });

  it('a card without a planet tag is not discounted', () => {
    player.playedCards.push(card);
    expect(player.getCardCostBreakdown(new Ants()).discounts).deep.eq([]);
  });

  // The forecast's «Скидки и оплата» group reads the SAME breakdown: a STANDING source, never a one-shot.
  it('the play forecast itemizes it as a standing discount', () => {
    player.playedCards.push(card);
    const surfing = new SaturnSurfing();
    player.cardsInHand.push(surfing);
    expect(discountsOf(player, surfing)).deep.eq({
      base: 13,
      final: 9,
      items: [{source: {kind: 'card', card: CardName.SPACE_LANES, owner: player.color}, amount: 4}],
      other: 0,
    });
  });
});
