import {Resource} from '../../common/Resource';
import {bonusCardInfo} from '../../common/automa/BonusCardData';
import {MarsBotBonusFate} from '../../common/automa/MarsBotTurn';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {newProjectCard} from '../createCard';
import {resolveBonusCard, routeBonusCard} from './AutomaBonusCards';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {AutomaDeltaProject} from './AutomaDeltaProject';
import {AutomaHumanTagReactions} from './AutomaHumanTagReactions';
import {AutomaLobbying} from './AutomaLobbying';
import {AutomaMAEvaluation} from './AutomaMAEvaluation';
import {AutomaMilestonesAwards} from './AutomaMilestonesAwards';
import {AutomaResolver} from './AutomaResolver';
import {AutomaTurnLog} from './AutomaTurnLog';
import {SecondShift} from './SecondShift';
import {marsBotOf} from './AutomaUtil';
import {reportServerError} from '../diagnostics/serverDiagnostics';

/** How many deferred effects of one bot turn may fail before the turn's tail gives up (a queue that only throws). */
const MAX_LOST_PAYOUTS = 8;

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
    } catch (err) {
      // A TURN THAT CANNOT BE TAKEN ENDS HONESTLY (see `abandonTurn`): said in the turn's own journal group, reported,
      // and the game goes on — the table never dies with the bot's card.
      passed = AutomaController.abandonTurn(game, bot, err);
    } finally {
      game.events.endScope();
    }
    if (passed) {
      game.playerHasPassed(bot);
    }
    /*
     * THE SCRIPT CLOSES AFTER THE TURN'S OWN DEFERRED PAYOUTS DRAIN. A hook a
     * bot placement fires on a HUMAN card routinely defers its payout (Tharsis
     * Republic's GainProduction, a colony bonus, an attack resolution): the
     * mutation then lands AFTER the turn body, and a script finished before the
     * drain diffs its whole-turn snapshots too early — the human's change is
     * real, evented (the deferred action carries the captured 'automa-turn'
     * context), yet ABSENT from the impact steps, and the bot turn card (which
     * owns presentation for automa-turn chains) never tells its owner. So the
     * queue drains FIRST; `finish()` runs when it empties — or immediately at an
     * INPUT boundary (a victim's pick pauses the drain; that interactive tail is
     * already narrated by its own attack step, and the recording must not
     * survive the request — it is transient by construction). The drain itself
     * is the same one `playerIsFinishedTakingActions` used to run before
     * advancing; only the script's closing moved.
     */
    let finished = false;
    const finishTurn = () => {
      if (!finished) {
        finished = true;
        AutomaTurnLog.finish(game);
      }
    };
    // (The game's own ADVANCE is tried once: a throw of the drain BEFORE it is one payout lost; a throw of the advance
    // itself is the engine's, and is never run twice.)
    let advancing = false;
    AutomaController.drainTurnTail(game, bot, () => {
      finishTurn();
      advancing = true;
      game.playerIsFinishedTakingActions();
    }, () => advancing);
    finishTurn();
  }

  /**
   * A TURN THAT CANNOT BE TAKEN ENDS HONESTLY (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4).
   *
   * The bot's turn resolves on the SERVER, on a timer, with nobody at the other end of a request: a throw in its body
   * used to stop inside `BotTurnScheduler`'s catch with the bot still active, the pending marker cleared and no seat
   * asked — a table that polls «WAIT, nobody» for ever, said to nobody (a `console.error` of a process no one reads),
   * and after a restart the same turn re-run by the loader, where a second throw made the game unloadable.
   *
   * So the BODY's failure is contained where every road into a turn passes (the scheduler, the inline call, the
   * loader): the failure is reported with its stack, the journal says so in the turn's own group (no silent loss —
   * what the bot did before the throw stays, and is on the record), the card that broke is spent (never re-revealed),
   * and the turn ENDS the way every turn ends — the deferred drain, then the game's advance.
   *
   * Returns whether the bot PASSES for the round: a turn that broke BEFORE its card was revealed took nothing off
   * the action deck, and a bot that never passes is given the turn again for ever once the players have passed — so
   * such a turn is a pass (the round ends); one that broke on its card spent the card, and the deck runs out as ever.
   */
  private static abandonTurn(game: IGame, bot: IPlayer, err: unknown): boolean {
    const automa = game.automa;
    const entry = automa?.revealedCard;
    const card = entry === undefined ? 'no card revealed' : entry.kind === 'project' ? `the project card ${entry.name}` : `the bonus card ${entry.id}`;
    console.error(`AutomaController: MarsBot's turn could not be finished (generation ${game.generation}, ${card})`, err);
    reportServerError(`MarsBot's turn (generation ${game.generation}, ${card})`, err);
    if (automa !== undefined && entry !== undefined) {
      // The card is SPENT: a project counts as played (its tags were the bot's way of playing it — the pile is what
      // the scoring and the dividends read), a bonus card leaves the game unresolved. Either way it is not revealed again.
      if (entry.kind === 'project' && !automa.playedPile.includes(entry.name)) {
        automa.playedPile.push(entry.name);
      }
      automa.revealedCard = undefined;
    }
    AutomaTurnLog.setCause(game, undefined);
    game.log('${0} could not finish its turn — the rest of it is skipped', (b) => b.player(bot));
    return entry === undefined;
  }

  /**
   * THE TURN'S TAIL — the deferred payouts, then the game's advance. A payout that throws is ONE payout lost, named
   * and reported; the queue has already let it go (an action leaves the queue before it runs), so the drain goes on
   * with the rest. Bounded: a queue that keeps throwing, or a throw of the advance itself, is the caller's to hear.
   */
  private static drainTurnTail(game: IGame, bot: IPlayer, afterDrain: () => void, advancing: () => boolean): void {
    for (let lost = 0; ; lost++) {
      try {
        game.deferredActions.runAll(afterDrain);
        return;
      } catch (err) {
        if (advancing() || lost >= MAX_LOST_PAYOUTS) {
          throw err;
        }
        console.error(`AutomaController: an effect of MarsBot's turn could not be applied (generation ${game.generation})`, err);
        reportServerError(`an effect of MarsBot's turn (generation ${game.generation})`, err);
        game.log('An effect of the turn of ${0} could not be applied — it is skipped', (b) => b.player(bot));
      }
    }
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
    // …unless «вторая смена» offers an extra card first: the players still act and the
    // generation's cap is not spent (`SecondShift.take` puts the card INTO the deck, so
    // the turn below runs the ordinary project branch on it).
    if (automa.actionDeck.length === 0 && !SecondShift.take(game)) {
      game.log('${0} passed', (b) => b.player(bot));
      AutomaTurnLog.note(game, {kind: 'pass'}, {consumeLog: true});
      return true; // takeTurn closes the script after the deferred drain
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
      // The bot PLAYS the card (only its tags count — the automa's own way of
      // playing) — it does NOT merely "reveal"/"show" it. Reuse the standard
      // "played" log so the journal + turn review read «Бот разыграл …», never
      // «показал / раскрыл».
      game.log('${0} played ${1}', (b) => b.player(bot).card(card, {tags: true}));
      AutomaTurnLog.note(game, {kind: 'reveal', card: entry}, {consumeLog: true});
      // The corporation's "When resolving a card …" effect fires for EVERY
      // resolution, before tag processing — a Failed Action can't swallow it.
      AutomaCorporations.onProjectCardResolving(game, card);
      // RB-B FAQ: the sanctioned HUMAN corporations (Saturn Systems, Pharmacy
      // Union, Splice) react to the bot PLAYING this card, exactly like a
      // human play would trigger them.
      AutomaHumanTagReactions.onBotCardResolved(game, card);
      AutomaResolver.resolveProjectCard(game, card);
      // Turmoil Redux: the generation's lobbying mandate paces its delegates
      // over the bot's turns — a cost divisible by 3 sends one (D14).
      AutomaLobbying.afterTurnCard(game, entry, card);
      automa.playedPile.push(entry.name);
    } else {
      // The bonus card is NAMED — «разыграл бонусную карту» with no name made
      // the turn's headline an empty statement (the card is public the moment
      // it is flipped; its name is an i18n key like every automa string).
      game.log('${0} played the bonus card ${1}', (b) => b.player(bot).string(bonusCardInfo(entry.id).name));
      AutomaTurnLog.note(game, {kind: 'reveal', card: entry}, {consumeLog: true});
      // Phase B: the bonus card's effect steps are attributed to the 'bonus'
      // cause (a colony trade re-attributes to 'colony' internally); the card's
      // RESOLVED fate is stamped onto the reveal step.
      AutomaTurnLog.setCause(game, {kind: 'bonus'});
      const outcome = resolveBonusCard(game, entry.id);
      routeBonusCard(game, entry.id, outcome);
      AutomaTurnLog.setCause(game, undefined);
      const fate: MarsBotBonusFate = outcome === 'destroy' ? 'destroyed' :
        outcome === 'return-to-deck' ? 'reshuffled' :
          (automa.recurringBonusCards.includes(entry.id) ? 'recurring' : 'discarded');
      AutomaTurnLog.setBonusFate(game, fate);
      // A bonus card never triggers lobbying, but the mandate may still owe a catch-up on this turn.
      AutomaLobbying.afterTurnCard(game, entry, undefined);
    }

    automa.revealedCard = undefined;
    return false; // takeTurn closes the script after the deferred drain
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
