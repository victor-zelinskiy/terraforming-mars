import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

/** The reward of the printed effect (card C04). */
const REWARD_MC = 2;

/** The two tracks the effect names, by their identity TAG (never an index). */
const PAYING_TAGS: ReadonlyArray<Tag> = [Tag.BUILDING, Tag.EVENT];

/**
 * MarsBot Interplanetary Cinematics — official card C04:
 *
 *   STARTING TAGS  event, event
 *   SETUP          Replace the trackers for the building track and event
 *                  track with white cubes as a reminder for this
 *                  corporation's effect.
 *   EFFECT         When MarsBot advances the building or event tracks,
 *                  including the starting tags, MarsBot gains 2 MC.
 *
 * The SETUP box changes NOTHING — it swaps a component for a reminder, and
 * the digital table needs no reminder token to remember. It is still modeled,
 * as data (`info.whiteMarkerTracks`), because the player reading the bot's mat
 * deserves the same cue the physical table gets: those two markers are painted
 * white with the effect named beside them.
 *
 * The EFFECT is per ADVANCE, not per tag: an advance that cascades along its
 * own track (`advance` icons — the event track prints four) pays for every
 * step it takes, and a tag that cannot advance (a maxed track — the official
 * Failed Action) pays nothing, because the framework only dispatches after a
 * successful step. «Including the starting tags» needs no special case: the
 * corporation is seated before its starting tags resolve, so the two printed
 * event tags run through the very same hook.
 */
export const MarsBotInterplanetaryCinematics: MarsBotCorp = {
  info: marsBotCorpInfo(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS),

  onTrackAdvance(game: IGame, trackIndex: number): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    // Tag → index every time: the board can be Tharsis/Elysium/Hellas/Venus,
    // and a board that merged the two tags into one track must still pay once.
    const tag = PAYING_TAGS.find((t) => automa.board.getTrackIndexForTag(t) === trackIndex);
    if (tag === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: this.info.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.add(Resource.MEGACREDITS, REWARD_MC, {log: false});
      game.log(tag === Tag.BUILDING ?
        '${0} gained ${1} M€ from its corporation ${2} for advancing the building track' :
        '${0} gained ${1} M€ from its corporation ${2} for advancing the event track',
      (b) => b.player(bot).number(REWARD_MC).string('Interplanetary Cinematics'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'icTrackAdvances');
    bumpCorpStat(game, 'icMc', REWARD_MC);
  },
};
