import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {MarsBotTrackCube} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';

/**
 * «When MarsBot advances onto a WHITE cube, advance the least-advanced track,
 * topmost if tied. When MarsBot advances onto a BLACK cube, advance the space
 * track.»
 *
 * TWO corporations print that effect word for word — C14 Point Luna (cubes on
 * the Earth track) and C19 Astro Drill (cubes on the space track) — so it has
 * ONE implementation, the same reason B06/B15/B25 share `AutomaNearBonusPush`.
 * Each card keeps only what is genuinely its own: WHERE its cubes sit (data,
 * `info.trackCubes`), its identity, and its counters.
 *
 * «The least-advanced track (topmost, if tied)» is the engine's existing wild
 * rule, so it reuses the board's own `getLeastAdvancedTrackIndex` — the very
 * helper `AutomaResolver.resolveTag(Tag.WILD)` uses — rather than a second
 * implementation that could drift from it. The advance goes through
 * `advanceTrack`, not `resolveTag`, because no TAG was resolved: writing a
 * wild-tag note into the turn review would be a lie about what happened.
 *
 * The push is the SHARED advance, so the landed-on space's printed icon,
 * cascades, other cubes and the Failed Action on a completed track all behave
 * as they do anywhere else — INCLUDING a cube whose own track is the one it
 * pushes (C19's black cubes sit on the space track and advance it): the chain
 * terminates because a cube fires at most once per game.
 *
 * Neither card says «instead of», so RB-B's general rule stands and the
 * caller's space keeps its printed icon — which is exactly what returning
 * nothing does.
 */
export type WildCubePushConfig = {
  /** The original corporation — the effect's event attribution. */
  original: CardName;
  /** How the journal names the corporation in this card's own line. */
  displayName: string;
  /** The track a BLACK cube pushes, named by TAG (never an index). */
  blackCubeTrack: Tag;
  /** This corporation's counters (documented in `MarsBotCorpStats`). */
  stats: {white: string, black: string, steps: string};
};

export function pushWildOrNamedTrack(game: IGame, cube: MarsBotTrackCube, config: WildCubePushConfig): void {
  const automa = game.automa;
  if (automa === undefined) {
    return;
  }
  const white = cube.cubeType === 'white';
  const target = white ?
    automa.board.getLeastAdvancedTrackIndex() :
    automa.board.getTrackIndexForTag(config.blackCubeTrack);
  if (target === undefined) {
    return; // That track does not exist on this board — nothing for the cube.
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: config.original, owner: bot.color}, 'automa-corporation');
  try {
    bumpCorpStat(game, white ? config.stats.white : config.stats.black);
    bumpCorpStat(game, config.stats.steps);
    game.log(white ?
      '${0} reached a white cube of its corporation ${1} — its least-advanced track moves' :
      '${0} reached a black cube of its corporation ${1} — the space track moves',
    (b) => b.player(bot).string(config.displayName));
    AutomaResolver.advanceTrack(game, target);
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
}
