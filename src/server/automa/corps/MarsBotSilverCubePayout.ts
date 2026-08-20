import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {MARSBOT_SILVER_CUBE_MC} from '../../../common/automa/AutomaTypes';
import {MarsBotTrackCube} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';

/**
 * «When MarsBot advances onto a silver resource cube, MarsBot gains it as MC.»
 *
 * TWO corporations print that sentence word for word — C13 Cheung Shing Mars
 * (the building track from #4 on) and C27 Morning Star Inc. (seven spaces of
 * the Venus track) — so it has ONE implementation, the same law that gave
 * B06/B15/B25 `AutomaNearBonusPush` and C14/C19/C23 `MarsBotCubeTrackPush`.
 * Each card keeps only what is genuinely its own: WHERE its cubes sit (data,
 * `info.trackCubes`), its identity and its counters. They share the effect's
 * i18n keys too — one rule, one phrasing — but never the insight fact.
 *
 * THE PAYOUT IS THE CUBE'S OWN VALUE. Terraforming Mars' resource cubes are
 * 1 (bronze) / 5 (silver) / 10 (gold), so «gains IT as MC» is five
 * (`MARSBOT_SILVER_CUBE_MC`) — the number is the component's, not a per-card
 * choice, which is exactly why it lives in `common`.
 *
 * Neither card says «instead of», so RB-B's general rule stands and the
 * landed-on space keeps its printed icon — which is what returning nothing
 * does at the call site.
 */
export type SilverCubeConfig = {
  /** The original corporation — the effect's event attribution. */
  original: CardName;
  /** How the journal names the corporation in the shared line. */
  displayName: string;
  /** This corporation's counters (documented in `MarsBotCorpStats`). */
  stats: {hits: string, mc: string};
};

export function takeSilverCube(game: IGame, cube: MarsBotTrackCube, config: SilverCubeConfig): void {
  if (cube.cubeType !== 'credit') {
    return;
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: config.original, owner: bot.color}, 'automa-corporation');
  try {
    bot.stock.add(Resource.MEGACREDITS, MARSBOT_SILVER_CUBE_MC, {log: false});
    game.log('${0} picked up a silver cube of its corporation ${1} — ${2} M€',
      (b) => b.player(bot).string(config.displayName).number(MARSBOT_SILVER_CUBE_MC));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, config.stats.hits);
  bumpCorpStat(game, config.stats.mc, MARSBOT_SILVER_CUBE_MC);
}
