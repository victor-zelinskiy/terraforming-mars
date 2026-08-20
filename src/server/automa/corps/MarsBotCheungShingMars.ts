import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {takeSilverCube} from './MarsBotSilverCubePayout';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C13_CHEUNG_SHING_MARS);

/**
 * MarsBot Cheung Shing Mars — official card C13:
 *
 *   STARTING TAG    building
 *   DRAFT PRIORITY  Building
 *   SETUP           Place silver resource cube on every space of the building
 *                   track starting with space #4.
 *   EFFECT          When MarsBot advances onto a silver resource cube, MarsBot
 *                   gains it as MC.
 *
 * The cubes are data (`info.trackCubes`, the whole building track from #4 on);
 * seeding, the spent-once bookkeeping and the regression rule are the
 * framework's. The PAYOUT is printed word for word on C27 Morning Star Inc.
 * too, so it lives in ONE place (`MarsBotSilverCubePayout`) — this file
 * contributes only its identity and its counters.
 *
 * Nothing says «instead of», so RB-B's general rule stands: the space's own
 * printed icon still resolves, after the cube (the caller's job).
 */
export const MarsBotCheungShingMars: MarsBotCorp = {
  info: INFO,

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    takeSilverCube(game, cube, {
      original: INFO.original,
      displayName: 'Cheung Shing Mars',
      stats: {hits: 'cheungCubesHit', mc: 'cheungMc'},
    });
    // No «instead of» on this card: the space's printed icon still resolves.
  },
};
