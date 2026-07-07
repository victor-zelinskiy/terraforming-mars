import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {toName} from '../../src/common/utils/utils';
import {cardsFromJSON, corporationCardsFromJSON, preludesFromJSON} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * The REAL start-of-game path: the human answers SelectInitialCards through
 * `player.process(...)` — exactly what the client submits. The older automa
 * specs popped the prompt and called `playerIsFinishedWithResearchPhase`
 * directly, which silently skipped `playerHasPickedCorporationCard`; its
 * "EVERY player picked a corporation" barrier could never pass with the
 * corporation-less bot seated, deadlocking the game right after the human's
 * confirmed pick (the corporation never played, the phase never left
 * RESEARCH). These specs pin the full path, including the prelude round.
 */

/** Deterministic deal, replaced IN PLACE (the live prompt holds the array refs). */
function seedStartingCards(human: TestPlayer, withPreludes: boolean) {
  human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
    ...corporationCardsFromJSON([CardName.INTERPLANETARY_CINEMATICS, CardName.HELION]));
  if (withPreludes) {
    // Both preludes resolve without any follow-up prompt.
    human.dealtPreludeCards.splice(0, human.dealtPreludeCards.length,
      ...preludesFromJSON([CardName.SUPPLY_DROP, CardName.LOAN, CardName.EARLY_SETTLEMENT, CardName.POLAR_INDUSTRIES]));
  }
  human.dealtProjectCards.splice(0, 4,
    ...cardsFromJSON([CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]));
}

describe('Automa start flow — answering SelectInitialCards for real', () => {
  it('with Prelude: the corporation plays and the prelude round starts for the human', () => {
    const [game, human] = testAutomaGame({
      preludeExtension: true,
      venusNextExtension: true,
      draftVariant: true,
      keepInitialCardSelection: true,
    });
    seedStartingCards(human, true);

    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
      {type: 'card', cards: [CardName.SUPPLY_DROP, CardName.LOAN]},
      {type: 'card', cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]},
    ]});
    runAllActions(game);

    // The corporation actually PLAYED (the deadlock left it unplayed at 0 M€).
    expect(human.playedCards.corporations().map(toName)).deep.eq([CardName.INTERPLANETARY_CINEMATICS]);
    expect(human.megaCredits).eq(30 - 4 * 3);
    expect(human.steel).eq(20);
    expect(human.cardsInHand.map(toName)).deep.eq([CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]);
    // The research barrier released: the prelude round starts, waiting on the HUMAN.
    expect(game.phase).eq(Phase.PRELUDES);
    expect(game.activePlayer.id).eq(human.id);
    expect(human.getWaitingFor(), 'the human must be prompted to play a prelude').is.not.undefined;
    expect(game.automa?.actionDeck.length).to.be.greaterThan(0);
  });

  it('the prelude round completes WITHOUT a bot flip; the action phase waits on the human', () => {
    const [game, human] = testAutomaGame({
      preludeExtension: true,
      keepInitialCardSelection: true,
    });
    seedStartingCards(human, true);
    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
      {type: 'card', cards: [CardName.SUPPLY_DROP, CardName.LOAN]},
      {type: 'card', cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]},
    ]});
    runAllActions(game);

    // Play both preludes through the real prompts.
    human.process({type: 'card', cards: [CardName.SUPPLY_DROP]});
    runAllActions(game);
    human.process({type: 'card', cards: [CardName.LOAN]});
    runAllActions(game);

    expect(human.preludeCardsInHand).is.empty;
    // Preludes are setup — MarsBot takes NO prelude turn (no flip, no pile).
    expect(game.automa?.lastTurn).is.undefined;
    expect(game.automa?.playedPile).is.empty;
    // The game lands on the human's first REAL action.
    expect(game.phase).eq(Phase.ACTION);
    expect(game.activePlayer.id).eq(human.id);
    expect(human.getWaitingFor(), 'the action menu must be live').is.not.undefined;

    // And the bot's first flip answers the human's first ACTION turn as usual.
    human.popWaitingFor();
    game.playerIsFinishedTakingActions();
    expect(game.automa?.lastTurn).is.not.undefined;
  });

  it('without Prelude: the same path lands on the action menu directly', () => {
    const [game, human] = testAutomaGame({keepInitialCardSelection: true});
    seedStartingCards(human, false);

    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
      {type: 'card', cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET]},
    ]});
    runAllActions(game);

    expect(human.playedCards.corporations().map(toName)).deep.eq([CardName.INTERPLANETARY_CINEMATICS]);
    expect(game.phase).eq(Phase.ACTION);
    expect(game.activePlayer.id).eq(human.id);
    expect(human.getWaitingFor()).is.not.undefined;
  });
});
