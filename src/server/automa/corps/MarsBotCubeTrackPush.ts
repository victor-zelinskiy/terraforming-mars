import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {MarsBotCubeType, MarsBotTrackCube} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';

/**
 * «When MarsBot advances onto a <colour> cube, advance <a track>.»
 *
 * THREE corporations print that shape and it has ONE implementation here —
 * C14 Point Luna and C19 Astro Drill (white → the least-advanced track, black
 * → the space track, word for word the same sentence) and C23 Recyclon (white
 * → the plant track). What each card keeps is genuinely its own: WHERE its
 * cubes sit (data, `info.trackCubes`), WHICH track each colour pushes, its
 * identity, its journal wording and its counters.
 *
 * What is shared is the part that must never drift between them: the event
 * scope and cause attribution, the spent-once bookkeeping's caller contract,
 * and the fact that the push goes through the SHARED advance — so the
 * landed-on space's printed icon, cascades, other cubes and the Failed Action
 * on a completed track all behave as they do anywhere else. INCLUDING a cube
 * whose own track is the one it pushes (C19's black cubes sit on the space
 * track and advance it): the chain terminates because a cube fires at most
 * once per game.
 *
 * «The least-advanced track (topmost, if tied)» is the engine's existing wild
 * rule, so it reuses the board's own `getLeastAdvancedTrackIndex` — the very
 * helper `AutomaResolver.resolveTag(Tag.WILD)` uses — rather than a second
 * implementation that could drift from it. The advance goes through
 * `advanceTrack`, not `resolveTag`, because no TAG was resolved: writing a
 * wild-tag note into the turn review would be a lie about what happened.
 *
 * None of the three says «instead of», so RB-B's general rule stands and the
 * caller's space keeps its printed icon — which is exactly what returning
 * nothing does.
 */

/** What one cube colour advances. */
export type CubePush = {
  /** The track this colour pushes: the wild rule, or a track named by TAG. */
  target: 'least-advanced' | Tag;
  /** EN i18n key for the journal line (params: the bot, the corporation name). */
  logKey: string;
  /** The counter this colour bumps (documented in `MarsBotCorpStats`). */
  stat: string;
};

export type CubeTrackPushConfig = {
  /** The original corporation — the effect's event attribution. */
  original: CardName;
  /** How the journal names the corporation in this card's own line. */
  displayName: string;
  /** What each cube colour does. A colour with no entry does nothing. */
  pushes: Partial<Record<MarsBotCubeType, CubePush>>;
  /** The counter every successful push bumps, whatever the colour. */
  stepsStat: string;
};

/**
 * The journal lines the printed effects share. C14 and C19 print the same
 * sentence, so they name it with the same two keys — deliberately not two
 * phrasings of one rule.
 */
export const WILD_CUBE_LOG = '${0} reached a white cube of its corporation ${1} — its least-advanced track moves';
export const SPACE_CUBE_LOG = '${0} reached a black cube of its corporation ${1} — the space track moves';

export function pushCubeTrack(game: IGame, cube: MarsBotTrackCube, config: CubeTrackPushConfig): void {
  const automa = game.automa;
  const push = config.pushes[cube.cubeType];
  if (automa === undefined || push === undefined) {
    return; // This card prints nothing for a cube of that colour.
  }
  const target = push.target === 'least-advanced' ?
    automa.board.getLeastAdvancedTrackIndex() :
    automa.board.getTrackIndexForTag(push.target);
  if (target === undefined) {
    return; // That track does not exist on this board — nothing for the cube.
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: config.original, owner: bot.color}, 'automa-corporation');
  try {
    bumpCorpStat(game, push.stat);
    bumpCorpStat(game, config.stepsStat);
    game.log(push.logKey, (b) => b.player(bot).string(config.displayName));
    AutomaResolver.advanceTrack(game, target);
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
}
