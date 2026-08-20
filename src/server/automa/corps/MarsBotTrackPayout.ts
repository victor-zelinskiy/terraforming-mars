import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';

/**
 * «When MarsBot advances <track>, MarsBot gains N MC» — printed twice with
 * different tracks (C04 Interplanetary Cinematics: building + event; C09
 * Teractor: Earth), so the payout lives in ONE place and the two corporations
 * differ only in their data: which tracks pay, how much, what the journal
 * calls it, and which counters it feeds.
 *
 * The caller owns the QUESTION («is this track mine?»); this owns the ANSWER
 * (attribution scope, the M€, the journal line, the counters), so the two
 * cards can never drift apart on the part that is identical.
 */
export type TrackPayout = {
  /** The tracks that pay, named by TAG — never an index (boards differ). */
  readonly tracks: ReadonlyArray<Tag>;
  readonly mc: number;
  /** The original corporation, for the effect scope's source. */
  readonly original: CardName;
  /** The corporation's display name, as the journal names it. */
  readonly corpName: string;
  /** Counters: how many advances paid, and how much they paid. */
  readonly countStat: string;
  readonly mcStat: string;
  /** The journal line for a paying advance of that track (EN i18n key). */
  logTemplate(tag: Tag): string;
};

/**
 * Pay for one advance of `trackIndex`, if that track is one of the payout's.
 * Returns the tag that paid, or undefined when this track does not pay —
 * the caller usually ignores it; the tests read it.
 */
export function payForTrackAdvance(game: IGame, trackIndex: number, payout: TrackPayout): Tag | undefined {
  const automa = game.automa;
  if (automa === undefined) {
    return undefined;
  }
  // Tag → index every time: the board can be Tharsis/Elysium/Hellas/Venus, and
  // a board that merged two paying tags into one track must still pay once.
  const tag = payout.tracks.find((t) => automa.board.getTrackIndexForTag(t) === trackIndex);
  if (tag === undefined) {
    return undefined;
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: payout.original, owner: bot.color}, 'automa-corporation');
  try {
    bot.stock.add(Resource.MEGACREDITS, payout.mc, {log: false});
    game.log(payout.logTemplate(tag), (b) => b.player(bot).number(payout.mc).string(payout.corpName));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, payout.countStat);
  bumpCorpStat(game, payout.mcStat, payout.mc);
  return tag;
}
