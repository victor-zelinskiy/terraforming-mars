import {Tag} from '../../../common/cards/Tag';
import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C14_POINT_LUNA);
/** The track the BLACK cube pushes, named by tag (never an index). */
const BLACK_CUBE_TRACK = Tag.SPACE;

/**
 * MarsBot Point Luna — official card C14:
 *
 *   STARTING TAG    space
 *   DRAFT PRIORITY  Earth
 *   SETUP           Place a white cube on the Earth track on spaces #1, #5,
 *                   #9, #13, and #17. Place a black cube on the Earth track
 *                   on spaces #3, #7, #11, and #15.
 *   EFFECT          When MarsBot advances onto a white cube, advance the
 *                   least-advanced track (topmost, if tied). When MarsBot
 *                   advances onto a black cube, advance the space track.
 *
 * Every cube sits on ONE track and pushes ANOTHER — the Earth track is the
 * clock, the rest of the mat is what moves. The cubes themselves are data
 * (`info.trackCubes`); seeding, spent-once and the regression rule are the
 * framework's.
 *
 * «The least-advanced track (topmost, if tied)» is the engine's existing wild
 * rule, so it reuses the board's own `getLeastAdvancedTrackIndex` — the very
 * helper `AutomaResolver.resolveTag(Tag.WILD)` uses — rather than a second
 * implementation that could drift from it. (The advance goes through
 * `advanceTrack`, not `resolveTag`, because no TAG was resolved: writing a
 * wild-tag note into the turn review would be a lie about what happened.)
 *
 * Nothing says «instead of», so RB-B's general rule stands: the Earth space's
 * own printed icon resolves too, after the cube.
 */
export const MarsBotPointLuna: MarsBotCorp = {
  info: INFO,

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const white = cube.cubeType === 'white';
    const target = white ?
      automa.board.getLeastAdvancedTrackIndex() :
      automa.board.getTrackIndexForTag(BLACK_CUBE_TRACK);
    if (target === undefined) {
      return; // No space track on this board — nothing for the black cube.
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bumpCorpStat(game, white ? 'lunaWhiteCubes' : 'lunaBlackCubes');
      bumpCorpStat(game, 'lunaSteps');
      game.log(white ?
        '${0} reached a white cube of its corporation ${1} — its least-advanced track moves' :
        '${0} reached a black cube of its corporation ${1} — the space track moves',
      (b) => b.player(bot).string('Point Luna'));
      // The shared advance: the space's printed icon, cascades, other cubes and
      // the Failed Action on a completed track all behave as anywhere else.
      AutomaResolver.advanceTrack(game, target);
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    // No «instead of» on this card: the Earth space's printed icon still runs.
  },
};
