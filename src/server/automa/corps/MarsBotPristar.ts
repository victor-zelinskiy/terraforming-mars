import {GlobalParameter} from '../../../common/GlobalParameter';
import {Resource} from '../../../common/Resource';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C36_PRISTAR);
/** The card's printed name, for the journal templates. */
const NAME = 'Pristar';
/** What one spent cube pays. */
const TR_GAIN = 1;
const MC_GAIN = 6;

/** Which counter each replaced action bumps — so the finale can name it. */
const SKIP_STAT: Partial<Record<GlobalParameter, string>> = {
  [GlobalParameter.TEMPERATURE]: 'pristarSkippedTemperature',
  [GlobalParameter.OXYGEN]: 'pristarSkippedOxygen',
  [GlobalParameter.OCEANS]: 'pristarSkippedOcean',
  [GlobalParameter.VENUS]: 'pristarSkippedVenus',
};

/**
 * MarsBot Pristar — official card C36:
 *
 *   EFFECT              When MarsBot would raise the temperature, raise
 *                       oxygen, place an ocean, or raise Venus, if there is a
 *                       white cube on this card, remove it. Then, MarsBot
 *                       gains 1 TR and 6 MC, and skip increasing the global
 *                       parameter.
 *   BEFORE ACTION PHASE Place a white cube on this card if there isn't one
 *                       already.
 *
 * THE FIRST CORPORATION THAT SAYS NO. Every other one adds to something that
 * already happened — a payout, a track push, a tile. This one is asked BEFORE
 * the bot's own action and CANCELS it: the mat still says «raise the
 * temperature», and the card answers «no — take a TR and 6 M€ instead, and
 * leave Mars alone». That needed a new kind of hook (`onWouldRaiseParameter`,
 * dispatched through `AutomaCorporations.replacesParameterRaise` at the bot's
 * four printed parameter-action sites), and it is the whole reason the human
 * Pristar is the right face for it: that card pays its owner 6 M€ for every
 * generation they did NOT terraform, and this one pays the same 6 M€ for
 * every terraforming step it talks the bot out of.
 *
 * ONCE PER GENERATION, BY CONSTRUCTION. There is no SETUP box: the cube is
 * armed by the Before-Action-Phase box — which RB-B also resolves once right
 * after setup (the shared `corpBapGeneration` gate does it), so generation 1
 * is armed like every other one, and «if there isn't one already» means a
 * cube that was never spent is never doubled.
 *
 * THE TRIGGER IS THE ACTION, NOT THE PARAMETER MOVING. The four printed
 * sentences are the four parameter ACTIONS the bot can take; a greenery
 * raises oxygen as a consequence of placing a TILE, and «place a greenery
 * tile» is on none of the mat spaces this card lists. So the gate is asked at
 * MarsBot's own action sites, never inside `Game.increaseOxygenLevel` — where
 * it would eat the oxygen of a greenery that had already been placed, which
 * is neither «skip increasing the global parameter» nor anything the card
 * says.
 *
 * A COMPLETED PARAMETER IS STILL A CONVERSION. «When MarsBot WOULD raise …»
 * names the instruction, not its feasibility, so the cube is spent and the
 * card pays even when the parameter had nothing left to give — the gate is
 * asked BEFORE each site's own maxed check, so that raise never becomes a
 * Failed Action. (The other reading — «nothing to skip, so the Failed Action
 * stands» — would make the card silently worse exactly when the bot needs it
 * least; the printed wording is about the instruction.)
 */
export const MarsBotPristar: MarsBotCorp = {
  info: INFO,

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || automa.corpResources >= 1) {
      return; // «…if there isn't one already.»
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources = 1;
      game.log('${0} armed its corporation ${1} with a white cube for this generation',
        (b) => b.player(bot).string(NAME));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'pristarCubes');
  },

  onWouldRaiseParameter(game: IGame, parameter: GlobalParameter): 'replaces-action' | void {
    const automa = game.automa;
    if (automa === undefined || automa.corpResources < 1) {
      return; // No cube: the bot terraforms as usual.
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources--;
      // TR through the player's own raise (its own event, its own log) and M€
      // through the stock — the corporation moves no parameter of its own.
      bot.increaseTerraformRating(TR_GAIN, {log: true});
      bot.stock.add(Resource.MEGACREDITS, MC_GAIN, {log: false});
      game.log('${0} spent the white cube on its corporation ${1}: ${2} is left alone for ${3} M€',
        (b) => b.player(bot).string(NAME).globalParameter(parameter).number(MC_GAIN));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'pristarConversions');
    bumpCorpStat(game, 'pristarMc', MC_GAIN);
    const stat = SKIP_STAT[parameter];
    if (stat !== undefined) {
      bumpCorpStat(game, stat);
    }
    return 'replaces-action';
  },
};
