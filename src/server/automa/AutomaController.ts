import {Resource} from '../../common/Resource';
import {IGame} from '../IGame';
import {newProjectCard} from '../createCard';
import {resolveBonusCard, routeBonusCard} from './AutomaBonusCards';
import {AutomaMAEvaluation} from './AutomaMAEvaluation';
import {AutomaMilestonesAwards} from './AutomaMilestonesAwards';
import {AutomaResolver} from './AutomaResolver';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';

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

    // The turn script (the client theater's data feed) records every step +
    // public log line from here to the end of the turn.
    AutomaTurnLog.begin(game);

    AutomaController.maybeHardClaim(game);

    // "If MarsBot has no cards in its action deck, it passes for the round." (rulebook p.5)
    if (automa.actionDeck.length === 0) {
      game.log('${0} passed', (b) => b.player(bot));
      AutomaTurnLog.note(game, {kind: 'pass'}, {consumeLog: true});
      AutomaTurnLog.finish(game);
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
      AutomaTurnLog.note(game, {kind: 'reveal', card: entry}, {consumeLog: true});
      AutomaResolver.resolveProjectCard(game, card);
      automa.playedPile.push(entry.name);
    } else {
      game.log('${0} revealed a bonus card', (b) => b.player(bot));
      AutomaTurnLog.note(game, {kind: 'reveal', card: entry}, {consumeLog: true});
      const outcome = resolveBonusCard(game, entry.id);
      routeBonusCard(game, entry.id, outcome);
    }

    automa.revealedCard = undefined;
    AutomaTurnLog.finish(game);
    game.playerIsFinishedTakingActions();
  }

  /**
   * Hard/Brutal (rulebook p.11): on MarsBot's FIRST turn of each generation,
   * with 8+ M€ and enough milestone pressure — no milestones claimed and it
   * meets 3+, one claimed and it meets 2+, or two claimed and it meets any —
   * it claims a milestone (normal tiebreakers) and loses 8 M€. Then the turn
   * proceeds as normal.
   */
  private static maybeHardClaim(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    if (automa.difficulty !== 'hard' && automa.difficulty !== 'brutal') {
      return;
    }
    if (automa.hardClaimCheckedGeneration >= game.generation) {
      return; // Not the first turn of this generation.
    }
    automa.hardClaimCheckedGeneration = game.generation;

    const bot = marsBotOf(game);
    if (bot.megaCredits < 8) {
      return;
    }
    const claimedCount = game.claimedMilestones.length;
    if (claimedCount >= 3) {
      return;
    }
    const metCount = game.milestones
      .filter((m) => !game.milestoneClaimed(m))
      .filter((m) => AutomaMAEvaluation.botMilestoneMet(m, game))
      .length;
    if (metCount < 3 - claimedCount) {
      return;
    }
    bot.stock.deduct(Resource.MEGACREDITS, 8, {log: true});
    AutomaMilestonesAwards.tryClaimMilestone(game);
  }
}
