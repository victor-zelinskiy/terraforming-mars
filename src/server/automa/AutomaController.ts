import {IGame} from '../IGame';
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

    // Card resolution (tags → tracks → track actions → Failed Action) is Automa
    // Phase 3. Failing loudly beats hanging the game on a bot prompt that will
    // never come — and the automa option is not reachable from the UI yet.
    throw new Error('MarsBot card resolution is not implemented yet (Automa Phase 3)');
  }
}
