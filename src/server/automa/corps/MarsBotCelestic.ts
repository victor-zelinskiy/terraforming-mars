import {CardResource} from '../../../common/CardResource';
import {FailedActionReason} from '../../../common/automa/MarsBotTurn';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C26_CELESTIC);
/** What the setup box hands the bot. */
const SETUP_FLOATERS = 1;
/** What a Failed Action adds, on top of the usual M€. */
const FAILED_ACTION_FLOATERS = 1;
/** What each round start hands it. */
const ROUND_START_FLOATERS = 1;

/**
 * MarsBot Celestic — official card C26:
 *
 *   STARTING TAG    Venus
 *   DRAFT PRIORITY  Venus > Jovian
 *   SETUP           Use this corporation only when playing with Venus Next or
 *                   Colonies. MarsBot gains a floater.
 *   EFFECT          Failed actions give MarsBot 1 floater in addition to the
 *                   usual MC.
 *   ROUND START     MarsBot gains 1 floater before the Research Phase.
 *
 * THE CORPORATION THAT PROFITS FROM THE BOT BEING STUCK. A Failed Action is
 * the engine's own admission that the bot could not do the thing it wanted —
 * every other corporation just takes the consolation M€. This one turns that
 * consolation into a resource that scores, and it collects a floater every
 * round on top, whatever happens. The bot's worst turns become its steadiest
 * income, which is exactly the human Celestic's own «floaters accumulate»
 * identity read through the bot's failure clause.
 *
 * «IN ADDITION TO THE USUAL MC» is why the hook fires AFTER `failedAction`
 * has paid and logged: the printed sentence adds to a finished event, it does
 * not replace it. Every Failed Action route reaches it, because they all go
 * through that ONE function — a maxed track, a completed parameter, no legal
 * space, a claimed milestone, an unfundable award.
 *
 * THE ROUND START BOX IS ONCE PER GENERATION, and generation 1 never sees it:
 * the corporation is selected at generation 1's research → action gate, which
 * is AFTER that generation's research phase, so the Setup box's own floater is
 * what covers the opening round. The dispatcher's `corpRoundStartGeneration`
 * marker survives save/load and undo, the same shape the Before-Action-Phase
 * box already uses — a box that pays a resource must never pay twice.
 *
 * FLOATERS GO TO THE ONE POOL (`automa.floaters`), like C25's: the Venus
 * board's «Gain Floater» cell, the Titan colony and the research-phase floater
 * spend all read the same counter, so this corporation genuinely funds them.
 */
export const MarsBotCelestic: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    gainFloaters(game, SETUP_FLOATERS, 'celesticSetup');
  },

  onFailedAction(game: IGame, _reason: FailedActionReason): void {
    gainFloaters(game, FAILED_ACTION_FLOATERS, 'celesticFailedActions');
  },

  roundStart(game: IGame): void {
    gainFloaters(game, ROUND_START_FLOATERS, 'celesticRounds');
  },
};

/** The one payout every box of this card makes, counted by which box asked. */
function gainFloaters(game: IGame, count: number, countStat: string): void {
  const automa = game.automa;
  if (automa === undefined) {
    return;
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    automa.floaters += count;
    game.log('${0} gained ${1} ${2} from its corporation ${3}',
      (b) => b.player(bot).number(count).cardResource(CardResource.FLOATER).string('Celestic'));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, countStat);
  bumpCorpStat(game, 'celesticFloaters', count);
}
