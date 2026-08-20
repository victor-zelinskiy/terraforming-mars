import {Tag} from '../../../common/cards/Tag';
import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {pushWildOrNamedTrack} from './MarsBotWildCubePush';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C14_POINT_LUNA);

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
 * The EFFECT itself is printed word for word on C19 Astro Drill too, so it
 * lives in ONE place (`MarsBotWildCubePush`) — this card contributes only its
 * identity, where its cubes sit, and its own counters.
 */
export const MarsBotPointLuna: MarsBotCorp = {
  info: INFO,

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    pushWildOrNamedTrack(game, cube, {
      original: INFO.original,
      displayName: 'Point Luna',
      blackCubeTrack: Tag.SPACE,
      stats: {white: 'lunaWhiteCubes', black: 'lunaBlackCubes', steps: 'lunaSteps'},
    });
    // No «instead of» on this card: the Earth space's printed icon still runs.
  },
};
