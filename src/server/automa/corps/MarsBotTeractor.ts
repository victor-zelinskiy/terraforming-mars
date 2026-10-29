import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';
import {TrackPayout, payForTrackAdvance} from './MarsBotTrackPayout';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {pileTagCount, largestBotCluster} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.C09_TERACTOR);
/** The printed setup gift. */
const SETUP_MC = 25;

/** The printed payout: 2 M€ per advance of the EARTH track. */
const PAYOUT: TrackPayout = {
  tracks: [Tag.EARTH],
  mc: 2,
  original: INFO.original,
  corpName: 'Teractor',
  countStat: 'teractorAdvances',
  mcStat: 'teractorMc',
  logTemplate: () => '${0} gained ${1} M€ from its corporation ${2} for advancing the Earth track',
};

/**
 * MarsBot Teractor — official card C09:
 *
 *   DRAFT PRIORITY  Earth
 *   SETUP           MarsBot gains 25 MC. Replace the tracker for the Earth
 *                   track with a white cube as a reminder for this
 *                   corporation's effect.
 *   EFFECT          When MarsBot advances the Earth track, MarsBot gains 2 MC.
 *
 * Everything here already existed, which is the point: the Earth draft
 * priority is the ordinary tag chain, the white tracker is C04's reminder
 * primitive (same promise, same legend sentence), and the payout is C04's
 * `MarsBotTrackPayout` pointed at a different track. Only the 25 M€ opening
 * gift is this card's own.
 *
 * The trigger is the TRACK, not the tag: on Tharsis the Earth track also
 * carries CITY tags, so a city the bot resolves pays too — exactly as printed
 * («when MarsBot advances the Earth track»), and pinned by a test.
 */
export const MarsBotTeractor: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.C09_TERACTOR).rates;
    return dividendResult([
      perUnitTerm('Earth tags of MarsBot', pileTagCount(game, [Tag.EARTH]), r.each),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return largestBotCluster(game);
  },

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    // The plain gain: the selection scope already attributes it, and the
    // explicit line names the corporation the way every other one does.
    bot.stock.add(Resource.MEGACREDITS, SETUP_MC, {log: false});
    game.log('${0} received ${1} M€ from its corporation ${2}',
      (b) => b.player(bot).number(SETUP_MC).string('Teractor'));
  },

  onTrackAdvance(game: IGame, trackIndex: number): void {
    payForTrackAdvance(game, trackIndex, PAYOUT);
  },
};
