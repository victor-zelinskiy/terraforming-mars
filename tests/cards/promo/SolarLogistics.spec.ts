import {expect} from 'chai';
import {SolarLogistics} from '../../../src/server/cards/promo/SolarLogistics';
import {Birds} from '../../../src/server/cards/base/Birds';
import {Cartel} from '../../../src/server/cards/base/Cartel';
import {LunaGovernor} from '../../../src/server/cards/colonies/LunaGovernor';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {BigAsteroid} from '../../../src/server/cards/base/BigAsteroid';
import {runAllActions} from '../../TestingUtils';

describe('Solar Logistics', () => {
  let card: SolarLogistics;
  let player: TestPlayer;

  beforeEach(() => {
    card = new SolarLogistics();
    [/* game */, player] = testGame(2);
  });

  it('Card Effects Work - titanium', () => {
    player.titanium = 0;
    expect(card.canPlay(player)).is.true;
    card.play(player);
    expect(player.titanium).to.eq(2);
  });

  it('Card Effects Work - discounts', () => {
    card.play(player);
    expect(card.getCardDiscount(player, new Cartel())).to.eq(2);
    expect(card.getCardDiscount(player, new Birds())).to.eq(0);
    expect(card.getCardDiscount(player, new LunaGovernor())).to.eq(4);
  });

  it('Card Effects Work - card draw (own space event keeps the plain draw)', () => {
    card.play(player);
    expect(player.cardsInHand).has.length(0);
    expect(card.onCardPlayedByAnyPlayer(player, card, player)).is.undefined;
    // I play a space event — my own flow, ordinary draw straight to hand.
    expect(card.onCardPlayedByAnyPlayer(player, new BigAsteroid(), player)).is.undefined;
    expect(player.cardsInHand).has.length(1);
    expect(player.pendingCardIntakes).is.empty;
  });

  it('a FOREIGN space event routes through the mandatory external-draw intake', () => {
    const [game, owner, other] = testGame(2);
    const solar = new SolarLogistics();
    owner.playedCards.push(solar);
    const trigger = new BigAsteroid();
    other.playCard(trigger);
    expect(owner.cardsInHand, 'withheld until taken').has.length(0);
    expect(owner.pendingCardIntakes).has.length(1);
    const intake = owner.pendingCardIntakes[0];
    expect(intake.effectCard).eq(solar.name);
    expect(intake.effectCardOwner).eq('you');
    expect(intake.initiator).eq(other.color);
    expect(intake.triggerCard).eq(trigger.name);
    runAllActions(game);
    expect(owner.getWaitingFor()?.externalDrawPrompt?.intakeId).eq(intake.id);
    owner.process({type: 'card', cards: [intake.cards[0].name]});
    expect(owner.cardsInHand).has.length(1);
    expect(owner.pendingCardIntakes).is.empty;
  });
});
