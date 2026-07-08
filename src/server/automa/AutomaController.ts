import {Resource} from '../../common/Resource';
import {MarsBotBonusFate} from '../../common/automa/MarsBotTurn';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {newProjectCard} from '../createCard';
import {resolveBonusCard, routeBonusCard} from './AutomaBonusCards';
import {AutomaDeltaProject} from './AutomaDeltaProject';
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

    /*
     * The whole turn resolves inside ONE journal scope (mirrors the
     * milestone/award precedent): every public log line of the turn carries
     * the scope's correlationId, so the journal groups the bot's turn as one
     * premium entry, and the SAME correlationId is stamped onto the turn
     * script (`lastTurn.correlationId`) — the shared key linking the compact
     * turn notification, the theater replay and the journal entry. Nested
     * scopes opened during resolution (a milestone claim, the Delta Project
     * advance) keep forming their own groups, exactly as before.
     *
     * The scope MUST close before `playerIsFinishedTakingActions()` — that
     * call advances the game (the next turn can start synchronously), and
     * nothing of it belongs to this turn's journal group.
     */
    game.events.beginAction(bot, undefined, {category: 'automa-turn'});
    let passed = false;
    try {
      passed = AutomaController.resolveTurn(game, bot);
    } finally {
      game.events.endScope();
    }
    if (passed) {
      game.playerHasPassed(bot);
    }
    game.playerIsFinishedTakingActions();
  }

  /** Resolve the turn body inside the journal scope. Returns true when the bot passed. */
  private static resolveTurn(game: IGame, bot: IPlayer): boolean {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    // The turn script (the client theater's data feed) records every step +
    // public log line from here to the end of the turn.
    AutomaTurnLog.begin(game);

    AutomaController.maybeHardClaim(game);

    // Solo Delta Project reference card: once per generation, on the bot's
    // FIRST turn (before the reveal + before the empty-deck pass check, so a
    // passing bot still advances). No-op without the Delta Project expansion.
    // Phase B: attribute its log lines to the 'delta' cause.
    AutomaTurnLog.setCause(game, {kind: 'delta'});
    AutomaDeltaProject.resolve(game);
    AutomaTurnLog.setCause(game, undefined);

    // "If MarsBot has no cards in its action deck, it passes for the round." (rulebook p.5)
    if (automa.actionDeck.length === 0) {
      game.log('${0} passed', (b) => b.player(bot));
      AutomaTurnLog.note(game, {kind: 'pass'}, {consumeLog: true});
      AutomaTurnLog.finish(game);
      return true;
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
      // Phase B: the bonus card's effect steps are attributed to the 'bonus'
      // cause (a colony trade re-attributes to 'colony' internally); the card's
      // RESOLVED fate is stamped onto the reveal step.
      AutomaTurnLog.setCause(game, {kind: 'bonus'});
      const outcome = resolveBonusCard(game, entry.id);
      routeBonusCard(game, entry.id, outcome);
      AutomaTurnLog.setCause(game, undefined);
      const fate: MarsBotBonusFate = outcome === 'destroy' ? 'destroyed' :
        (automa.recurringBonusCards.includes(entry.id) ? 'recurring' : 'discarded');
      AutomaTurnLog.setBonusFate(game, fate);
    }

    automa.revealedCard = undefined;
    AutomaTurnLog.finish(game);
    return false;
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
