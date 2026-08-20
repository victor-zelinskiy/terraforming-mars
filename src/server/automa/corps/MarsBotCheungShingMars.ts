import {Resource} from '../../../common/Resource';
import {MARSBOT_SILVER_CUBE_MC, TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
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
 * framework's. This module is only the payout — and the payout is the cube's
 * own value: Terraforming Mars' resource cubes are 1 (bronze) / 5 (silver) /
 * 10 (gold), so «gains IT as MC» is five (`MARSBOT_SILVER_CUBE_MC`).
 *
 * Nothing says «instead of», so RB-B's general rule stands: the space's own
 * printed icon still resolves, after the cube (the caller's job).
 */
export const MarsBotCheungShingMars: MarsBotCorp = {
  info: INFO,

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    if (cube.cubeType !== 'credit') {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.add(Resource.MEGACREDITS, MARSBOT_SILVER_CUBE_MC, {log: false});
      game.log('${0} picked up a silver cube of its corporation ${1} — ${2} M€',
        (b) => b.player(bot).string('Cheung Shing Mars').number(MARSBOT_SILVER_CUBE_MC));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'cheungCubesHit');
    bumpCorpStat(game, 'cheungMc', MARSBOT_SILVER_CUBE_MC);
    // No «instead of» on this card: the space's printed icon still resolves.
  },
};
