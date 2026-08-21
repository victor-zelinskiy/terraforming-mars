import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTerraformer} from '../AutomaTerraformer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {FloaterPayoutConfig, gainFloaters} from './MarsBotFloaterPayout';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C34_STORMCRAFT);
/** What the setup box hands the bot. */
const SETUP_FLOATERS = 1;
/** What each round start hands it. */
const ROUND_START_FLOATERS = 1;

/**
 * MarsBot Stormcraft Incorporated — official card C34:
 *
 *   STARTING TAG    Jovian
 *   SETUP           Use this corporation only when playing with Venus Next or
 *                   Colonies. MarsBot gains a floater.
 *   EFFECT          When MarsBot spends floaters to keep an additional card,
 *                   MarsBot raises the temperature 1 step.
 *   ROUND START     MarsBot gains 1 floater before the Research Phase.
 *
 * THE CARD THAT CLOSES ITS OWN LOOP. Two of its three boxes do nothing but
 * FILL the floater pool, and the third pays out the moment that pool is
 * SPENT — so the corporation is a slow pump whose every discharge heats Mars.
 * It is the human Stormcraft's own identity (floaters as fuel, heat as the
 * output) read through the only floater expense the bot has.
 *
 * ITS SETUP AND ROUND-START BOXES ARE C26 CELESTIC'S, WORD FOR WORD — same
 * module condition, same floater, same «before the Research Phase». So both
 * run the ONE payout in `MarsBotFloaterPayout` and share those i18n keys, and
 * this file contributes only its identity, its counters and its own third box.
 * The two cards are deliberately NOT the same corporation: Celestic profits
 * from the bot being STUCK, this one from the bot being RICH enough to spend.
 *
 * «SPENDS FLOATERS TO KEEP AN ADDITIONAL CARD» IS ONE EXACT EVENT, and the
 * engine already has exactly one place for it: `AutomaResearch.trySpendFloaters`
 * — 5 floaters at the end of the Research Phase, once the Hoverlord milestone
 * is out of reach (RB-C p.4), for an extra project card in the non-draft
 * variant or the 4th drafted card in the draft one. The hook fires AFTER the
 * pool is charged and the spend is logged, so the printed sentence adds to a
 * FINISHED event — the same reading `onFailedAction` follows for «in addition
 * to the usual MC».
 *
 * THE RAISE IS THE SHARED ONE (`AutomaTerraformer.raiseTemperature`): its TR,
 * its bot-specific bonus steps and its Failed Action on a completed
 * temperature all come with it, and none of them is restated here. A step is
 * counted only when it LANDED — a finished temperature took the Failed Action
 * instead, which is a real outcome, not a step.
 */

/** Everything this card's floater boxes share when they pay. */
function payout(countStat: string): FloaterPayoutConfig {
  return {original: INFO.original, displayName: 'Stormcraft Incorporated', countStat, totalStat: 'stormcraftFloaters'};
}

export const MarsBotStormcraft: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    gainFloaters(game, SETUP_FLOATERS, payout('stormcraftSetup'));
  },

  roundStart(game: IGame): void {
    gainFloaters(game, ROUND_START_FLOATERS, payout('stormcraftRounds'));
  },

  onFloatersSpent(game: IGame, _count: number): void {
    const bot = marsBotOf(game);
    const before = game.getTemperature();
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      game.log('${0} raises the temperature from its corporation ${1}: floaters were spent',
        (b) => b.player(bot).string('Stormcraft Incorporated'));
      AutomaTerraformer.raiseTemperature(game);
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'stormcraftSpends');
    // Counted only when the parameter actually MOVED: a completed temperature
    // took the shared Failed Action instead, and that is a real outcome rather
    // than a step.
    if (game.getTemperature() > before) {
      bumpCorpStat(game, 'stormcraftTemperature');
    }
  },
};
