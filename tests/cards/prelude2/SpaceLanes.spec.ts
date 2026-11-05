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
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {IPlayer} from '../../../src/server/IPlayer';
import {Payment} from '../../../src/common/inputs/Payment';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {Tag} from '../../../src/common/cards/Tag';
import {aggregateBySource} from '../../../src/common/events/aggregate';
import {sourceKey} from '../../../src/common/events/EventSource';

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

  // P62 · GB — THE SAVING IS WHAT WAS SAVED: the row keeps its nominal offer and names what the 0-floor let it take.
  it('a discount past the price floors at 0 — the row keeps its offer and carries what it saved', () => {
    player.playedCards.push(card);
    const office = new EarthOffice();
    expect(player.getCardCostBreakdown(office)).deep.eq({
      base: 1,
      final: 0,
      discounts: [{source: {kind: 'card', card: CardName.SPACE_LANES, owner: player.color}, amount: 2, saved: 1}],
    });
  });

  it("the floor is spent in the breakdown's order — a line it emptied saved 0", () => {
    player.playedCards.push(card, new EarthOffice());
    expect(player.getCardCostBreakdown(new EarthOffice()).discounts).deep.eq([
      {source: {kind: 'card', card: CardName.SPACE_LANES, owner: player.color}, amount: 2, saved: 1},
      {source: {kind: 'card', card: CardName.EARTH_OFFICE, owner: player.color}, amount: 3, saved: 0},
    ]);
  });

  it('the play writes the FACT — the event, the journal and the stats say 1 M€, never the offer of 2', () => {
    const [game, blue] = testGame(1);
    blue.playedCards.push(card);
    const office = new EarthOffice();
    blue.playCard(office, Payment.EMPTY);
    runAllActions(game);
    const saved = game.events.events.filter((e) => e.type === 'discount-applied' && e.source?.kind === 'card' && e.source.card === CardName.SPACE_LANES);
    expect(saved.map((e) => e.impact.megacreditsSaved), 'ONE record of the 1 M€ really saved').deep.eq([1]);
    expect(aggregateBySource(game.events.events).get(sourceKey({kind: 'card', card: CardName.SPACE_LANES}))?.megacreditsSaved).eq(1);
    const line = game.gameLog.find((m) => m.message === '${0} saved ${1} M€ playing with ${2}');
    expect(line?.data[1]?.value, 'the journal line says 1').eq('1');
  });

  it('a line the floor emptied writes no record and no line', () => {
    const [game, blue] = testGame(1);
    blue.playedCards.push(card, new EarthOffice());
    blue.playCard(fakeCard({cost: 1, tags: [Tag.EARTH]}), Payment.EMPTY);
    runAllActions(game);
    const office = game.events.events.filter((e) => e.type === 'discount-applied' && e.source?.kind === 'card' && e.source.card === CardName.EARTH_OFFICE);
    expect(office, 'Earth Office took nothing off a price already at 0').deep.eq([]);
    const lines = game.gameLog.filter((m) => m.message === '${0} saved ${1} M€ playing with ${2}');
    expect(lines.length, 'one line — the 1 M€ of Space Lanes').eq(1);
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
  it('the play forecast carries the floor too — the remainder stays 0', () => {
    player.playedCards.push(card);
    const office = new EarthOffice();
    player.cardsInHand.push(office);
    expect(discountsOf(player, office)).deep.eq({
      base: 1,
      final: 0,
      items: [{source: {kind: 'card', card: CardName.SPACE_LANES, owner: player.color}, amount: 2, saved: 1}],
      other: 0,
    });
  });

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
