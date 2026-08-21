import {FAILED_ACTION_MC} from '../../../common/automa/AutomaTypes';
import {FailedActionReason} from '../../../common/automa/MarsBotTurn';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {Resource} from '../../../common/Resource';
import {IProjectCard} from '../../cards/IProjectCard';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES);
/** The card's printed name, for the journal templates. */
const NAME = 'Sagitta Frontier Services';
/** What the setup box pays. */
const SETUP_MC = 8;
/** What a card with NO tags pays, in place of the usual compensation. */
const DEAD_CARD_MC = 10;
/** What a card with exactly one tag pays, on top of what that tag does. */
const THIN_CARD_MC = 1;

/**
 * MarsBot Sagitta Frontier Services — official card C44:
 *
 *   STARTING TAGS  power, event
 *   SETUP          MarsBot gains 8 MC.
 *   EFFECT         When resolving a card with no tags, MarsBot gains 10 MC
 *                  (instead of 5MC). When resolving a card with exactly 1 tag,
 *                  MarsBot gains 1 MC.
 *
 * THE COMPANY THAT DELIVERS WHATEVER NOBODY ELSE WILL. Its human twin pays 4
 * M€ for a card with no tags and 1 M€ for a card with exactly one — it earns
 * from the thin end of the deck, the cards other corporations have no engine
 * for. The bot's version is the same trade in the bot's own economy: a card
 * with no tags is the one flip that gives MarsBot NOTHING (no tag, no track
 * step — the official Failed Action), and this corporation doubles what that
 * failure pays. So the worst card in the deck becomes its best.
 *
 * THE TAG COUNT IS THE BOT'S OWN (`AutomaResolver.printedTags`), NOT the human
 * twin's. The two readings genuinely differ — the human's `onCardPlayed`
 * excludes WILD tags, the bot's row counts them (a wild tag advances its
 * least-advanced track, so it is a step like any other) — and the printed
 * parenthetical is what settles it: «(instead of 5MC)» names the FAILED ACTION,
 * and the failed action is triggered by exactly `printedTags(card).length === 0`
 * (`AutomaResolver.resolveProjectCard`). Reading «no tags» any other way would
 * pay 10 M€ for a card that did not fail, or leave a real failure at 5. The
 * second clause then has to use the SAME count, or one card could be «no tags»
 * to one half of the effect and «one tag» to the other.
 *
 * TWO HOOKS, BECAUSE THE TWO CLAUSES HAPPEN AT DIFFERENT MOMENTS:
 *  · `failedActionCompensation` REPLACES the amount before it is paid, so the
 *    journal line and the turn recording both state 10 — the number the card
 *    prints — instead of a standard 5 plus a correction. It is a question and
 *    stays pure; the counters and the attribution line live in
 *    `onFailedAction`, which the framework asks exactly once per failure.
 *  · `onProjectCardResolving` is the ordinary «when resolving a card …» hook,
 *    fired for EVERY card the bot resolves (its own flip, the R&D draw, the
 *    Local Neural Instance fallback) and BEFORE the tags are processed.
 *
 * EASY DIFFICULTY DOES NOT SHRINK THE 10. The printed sentence states an
 * absolute number, and so does the Easy rule (a failed action pays 3, not
 * «5 − 2»), so the corporation REPLACES the constant rather than modifying it.
 * The other reading — apply Easy's reduction to the corporation's number too —
 * is recorded here as rejected, and pinned by a test.
 */
export const MarsBotSagittaFrontierServices: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    bot.stock.add(Resource.MEGACREDITS, SETUP_MC, {log: false});
    game.log('${0} gained ${1} M€ from its corporation ${2} at setup',
      (b) => b.player(bot).number(SETUP_MC).string(NAME));
  },

  failedActionCompensation(_game: IGame, reason: FailedActionReason): number | void {
    // ONLY the no-tag card. Every other failure (a maxed track, no legal space,
    // three milestones already claimed) pays what it always pays — the printed
    // clause is about resolving a CARD, not about failing.
    if (reason === 'no-tags') {
      return DEAD_CARD_MC;
    }
  },

  onFailedAction(game: IGame, reason: FailedActionReason): void {
    if (reason !== 'no-tags') {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bumpCorpStat(game, 'sagittaDeadCards');
      // How much MORE than the failure would otherwise have paid. Measured
      // against the STANDARD amount rather than the difficulty's, because that
      // is the number the card's own parenthetical names.
      bumpCorpStat(game, 'sagittaBonusMc', DEAD_CARD_MC - FAILED_ACTION_MC);
      game.log('${0} was paid the whole ${1} M€ by its corporation ${2} — a card with no tags is what it lives on',
        (b) => b.player(bot).number(DEAD_CARD_MC).string(NAME));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },

  onProjectCardResolving(game: IGame, card: IProjectCard): void {
    // The bot's OWN printed row — the same count that decides how many tracks
    // this card advances (see the file docstring).
    if (AutomaResolver.printedTags(card).length !== 1) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.add(Resource.MEGACREDITS, THIN_CARD_MC, {log: false});
      bumpCorpStat(game, 'sagittaThinCards');
      bumpCorpStat(game, 'sagittaThinMc', THIN_CARD_MC);
      game.log('${0} gained ${1} M€ from its corporation ${2} for resolving a card with a single tag',
        (b) => b.player(bot).number(THIN_CARD_MC).string(NAME));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },
};
