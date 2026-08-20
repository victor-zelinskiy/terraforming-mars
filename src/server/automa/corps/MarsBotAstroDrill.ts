import {Tag} from '../../../common/cards/Tag';
import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {SPACE_CUBE_LOG, WILD_CUBE_LOG, pushCubeTrack} from './MarsBotCubeTrackPush';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C19_ASTRO_DRILL);

/**
 * MarsBot Astro Drill — official card C19:
 *
 *   DRAFT PRIORITY  Space
 *   SETUP           Place a white cube on the space track on spaces #2, #4,
 *                   #7, #10, and #13. Place a black cube on the space track
 *                   on spaces #5, #11, and #16.
 *   EFFECT          When MarsBot advances onto a white cube, advance the
 *                   least-advanced track, topmost if tied. When MarsBot
 *                   advances onto a black cube, advance the space track.
 *
 * No starting tag is printed — the space symbol on the card is its DRAFT
 * PRIORITY. Everything about this corporation is the space programme: it
 * drafts space, its cubes line the space track, and reaching one either
 * shores up whatever is furthest behind or drives space itself further.
 *
 * THE EFFECT IS C14 POINT LUNA'S, WORD FOR WORD, so both cards run the ONE
 * implementation in `MarsBotCubeTrackPush` — this file contributes only the
 * identity and the counters. What genuinely differs is DATA: Point Luna's
 * cubes sit on the Earth track, these sit on the very track the black cubes
 * push. That self-advance is not a special case — a cube fires at most once
 * per game, so a black cube stepping the space track onto another cube is an
 * ordinary chain that terminates (and it is what makes this corporation
 * accelerate: its own track carries it).
 */
export const MarsBotAstroDrill: MarsBotCorp = {
  info: INFO,

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    pushCubeTrack(game, cube, {
      original: INFO.original,
      displayName: 'Astro Drill',
      pushes: {
        white: {target: 'least-advanced', logKey: WILD_CUBE_LOG, stat: 'astroWhiteCubes'},
        black: {target: Tag.SPACE, logKey: SPACE_CUBE_LOG, stat: 'astroBlackCubes'},
      },
      stepsStat: 'astroSteps',
    });
    // No «instead of» on this card: the space's printed icon still runs.
  },
};
