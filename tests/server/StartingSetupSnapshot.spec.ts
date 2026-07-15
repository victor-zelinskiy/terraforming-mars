import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {cardsFromJSON, corporationCardsFromJSON, preludesFromJSON} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * `Player.startingSetup` — the transient, self-only snapshot the premium start
 * flow reveals as explicit "apply corporation" / "pay for cards" stages. Set in
 * `playCorporationCard`, cleared on the player's next input.
 */

function seedCards(human: TestPlayer) {
  // Interplanetary Cinematics: 30 M€ start, +20 steel behavior, card cost 3.
  human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
    ...corporationCardsFromJSON([CardName.INTERPLANETARY_CINEMATICS, CardName.HELION]));
  human.dealtProjectCards.splice(0, 4,
    ...cardsFromJSON([CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]));
}

describe('Player.startingSetup snapshot', () => {
  it('captures the pre-corp baseline + the bonus/payment amounts', () => {
    const [game, human] = testAutomaGame({keepInitialCardSelection: true});
    seedCards(human);

    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
      // Buy 3 of the 4 → 3 × 3 = 9 M€ paid.
      {type: 'card', cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET]},
    ]});
    runAllActions(game);
    // The explicit corporationPlay press (the deferred-play contract). The
    // snapshot is read HERE — it is one-shot and the card-payment press below
    // is the next input, which consumes it.
    human.process({type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]});
    runAllActions(game);

    const setup = human.startingSetup;
    expect(setup, 'the snapshot is set after the corp is played').is.not.undefined;
    if (setup === undefined) {
      return;
    }
    expect(setup.corporation).eq(CardName.INTERPLANETARY_CINEMATICS);
    expect(setup.generation).eq(1);
    // The pre-corp baseline: no M€, no steel, the starting TR of 20.
    expect(setup.before.megacredits).eq(0);
    expect(setup.before.steel).eq(0);
    expect(setup.before.terraformRating).eq(20);
    // 3 cards bought at card cost 3.
    expect(setup.cardsBought).eq(3);
    expect(setup.megacreditsPaid).eq(9);
    // The corp is played but the cards are NOT paid yet — the payment is its
    // own explicit press, which the snapshot's amounts describe.
    expect(human.megaCredits).eq(30);
    human.process({type: 'option'});
    runAllActions(game);
    expect(human.megaCredits).eq(21);
    expect(human.steel).eq(20);
  });

  it('is cleared on the next input', () => {
    const [game, human] = testAutomaGame({preludeExtension: true, keepInitialCardSelection: true});
    seedCards(human);
    human.dealtPreludeCards.splice(0, human.dealtPreludeCards.length,
      ...preludesFromJSON([CardName.SUPPLY_DROP, CardName.LOAN, CardName.EARLY_SETTLEMENT, CardName.POLAR_INDUSTRIES]));
    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
      {type: 'card', cards: [CardName.SUPPLY_DROP, CardName.LOAN]},
      {type: 'card', cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]},
    ]});
    runAllActions(game);
    human.process({type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]});
    runAllActions(game);
    expect(human.startingSetup).is.not.undefined;

    // Paying for the bought cards is the player's next input — process()
    // consumes the one-shot snapshot at its start (like energyHeatConversion
    // / lastReveal).
    human.process({type: 'option'});
    runAllActions(game);
    expect(human.startingSetup, 'the one-shot snapshot is consumed').is.undefined;
  });

  it('skips the payment stage when no cards were bought', () => {
    const [game, human] = testAutomaGame({keepInitialCardSelection: true});
    seedCards(human);
    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
      {type: 'card', cards: []},
    ]});
    runAllActions(game);
    human.process({type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]});
    runAllActions(game);

    const setup = human.startingSetup;
    expect(setup?.cardsBought).eq(0);
    expect(setup?.megacreditsPaid).eq(0);
    // Nothing was bought → the payment press is SKIPPED entirely: the game
    // goes straight on (no corporationPay prompt is ever offered).
    expect(human.getWaitingFor()?.startGamePrompt?.kind).to.not.eq('corporationPay');
  });
});
