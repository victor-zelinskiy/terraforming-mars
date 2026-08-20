import {Tag} from '../../../common/cards/Tag';
import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {pushCubeTrack} from './MarsBotCubeTrackPush';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C23_RECYCLON);
/** The track a white cube pushes, named by TAG (never an index). */
const PUSHED_TRACK = Tag.PLANT;
/** The journal line for this card's own cube. */
const CUBE_LOG = '${0} reached a white cube of its corporation ${1} — the plant track moves';

/**
 * MarsBot Recyclon — official card C23:
 *
 *   STARTING TAG    microbe
 *   DRAFT PRIORITY  Building
 *   SETUP           Place a white cube on the building track on spaces #3,
 *                   #6, #9, #12, #15, and #18.
 *   EFFECT          When MarsBot advances onto a white cube, advance the
 *                   plant track.
 *
 * THE PUREST CONVERTER IN THE SET: one track feeds another, at a fixed rate,
 * with nothing in between. Six cubes evenly spaced the whole length of the
 * building track (#18 is its last space) mean that every third step of
 * construction buys a step of biology — the human Recyclon's own microbes-for-
 * plants trade, expressed as track geometry instead of card resources.
 *
 * THE EFFECT IS THE SHARED CUBE PUSH (`MarsBotCubeTrackPush`), which C14 Point
 * Luna and C19 Astro Drill already run: same scope, same attribution, same
 * SHARED advance — so the landed-on plant space's printed icon, its cascades
 * and the Failed Action on a completed track behave as they do everywhere.
 * What this card contributes is its own colour→track mapping (white → PLANT,
 * where those two print white → the wild rule), its own journal line and its
 * own counters. The module was generalized for it; C14's and C19's specs were
 * run first as the proof nothing drifted.
 *
 * THE BUILDING TRACK PUSHES THE PLANT TRACK, so the cubes never sit on the
 * track they advance and this corporation cannot accelerate itself the way
 * C19 does. It is deliberately one-directional: the bot must actually BUILD.
 *
 * Nothing says «instead of», so RB-B's general rule stands — the building
 * space's own printed icon resolves too, after the cube (building #3 is
 * blank, #6 temperature, #9 award, #12 ocean, #15 city, #18 tr5).
 */
export const MarsBotRecyclon: MarsBotCorp = {
  info: INFO,

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    pushCubeTrack(game, cube, {
      original: INFO.original,
      displayName: 'Recyclon',
      pushes: {
        white: {target: PUSHED_TRACK, logKey: CUBE_LOG, stat: 'recyclonCubesHit'},
      },
      stepsStat: 'recyclonSteps',
    });
    // No «instead of» on this card: the building space's printed icon still runs.
  },
};
