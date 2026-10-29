import {Tag} from '../../../common/cards/Tag';
import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {SPACE_CUBE_LOG, WILD_CUBE_LOG, pushCubeTrack} from './MarsBotCubeTrackPush';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {matTracks, botTileSpaces, bonusUnits} from './MarsBotDividendReads';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';

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

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.C19_ASTRO_DRILL).rates;
    const passed = matTracks(game).reduce((n, t) =>
      n + t.definition.layout.slice(0, t.position + 1).filter((action) => action === 'advance').length, 0);
    return dividendResult([
      perUnitTerm('«Advance» spaces passed', passed, r.each),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return botTileSpaces(game).reduce((n, s) => n + bonusUnits(s, SpaceBonus.STEEL), 0);
  },

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
