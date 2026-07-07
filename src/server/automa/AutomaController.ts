import {IGame} from '../IGame';
import {newProjectCard} from '../createCard';
import {AutomaResolver} from './AutomaResolver';
import {marsBotOf} from './AutomaSetup';

/**
 * Orchestrates MarsBot's turn. Entered from `Game.startActionsForPlayer` when the
 * active player is the bot. The whole turn resolves synchronously and
 * authoritatively on the server; the client replays the emitted events with its
 * own pacing ("turn theater") — the server never sleeps.
 */
export class AutomaController {
  public static takeTurn(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);

    // "If MarsBot has no cards in its action deck, it passes for the round." (rulebook p.5)
    if (automa.actionDeck.length === 0) {
      game.log('${0} passed', (b) => b.player(bot));
      game.playerHasPassed(bot);
      game.playerIsFinishedTakingActions();
      return;
    }

    const entry = automa.actionDeck.shift();
    if (entry === undefined) {
      throw new Error('Unreachable: empty action deck');
    }
    // Kept until the turn fully resolves so a mid-turn save (a human sub-prompt
    // interrupting a bonus card) can restore the reveal.
    automa.revealedCard = entry;

    if (entry.kind === 'project') {
      const card = newProjectCard(entry.name);
      if (card === undefined) {
        throw new Error(`Unknown project card in MarsBot action deck: ${entry.name}`);
      }
      game.log('${0} revealed ${1}', (b) => b.player(bot).card(card, {tags: true}));
      AutomaResolver.resolveProjectCard(game, card);
      automa.playedPile.push(entry.name);
    } else {
      // Bonus card resolution (B01–B08 + expansion cards) is Automa Phase 8.
      // Failing loudly beats hanging the game — automa is not reachable from
      // the UI yet, and tests control the deck contents.
      throw new Error(`MarsBot bonus card ${entry.id} is not implemented yet (Automa Phase 8)`);
    }

    automa.revealedCard = undefined;
    game.playerIsFinishedTakingActions();
  }
}
