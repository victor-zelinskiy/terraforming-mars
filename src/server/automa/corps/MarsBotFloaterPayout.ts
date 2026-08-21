import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';

/**
 * «MarsBot gains N floater(s)» — printed by TWO corporations, and by three of
 * each one's boxes: C26 Celestic (setup · every Failed Action · every round
 * start) and C34 Stormcraft Incorporated (setup · every round start). Both
 * cards even print the SAME two sentences for the setup and the round start,
 * word for word, so they share this implementation and those i18n keys — the
 * same law that gave B06/B15/B25 `AutomaNearBonusPush`, C14/C19/C23
 * `MarsBotCubeTrackPush` and C13/C27 `MarsBotSilverCubePayout`. What each card
 * keeps is its identity, its counters and WHICH boxes ask — never the insight
 * fact: one rule, one phrasing, two voices.
 *
 * FLOATERS GO TO THE ONE POOL (`automa.floaters`). The Venus board's «Gain
 * Floater» cell, the Titan colony's storage and the research-phase floater
 * spend all read that counter, so a corporation feeding it genuinely funds
 * them — which is exactly what makes C34's own effect reachable.
 */
export type FloaterPayoutConfig = {
  /** The original corporation — the effect's event attribution. */
  original: CardName;
  /** How the journal names the corporation in the shared line. */
  displayName: string;
  /** The counter for the BOX that asked (documented in `MarsBotCorpStats`). */
  countStat: string;
  /** The card's running total of every floater it ever handed the bot. */
  totalStat: string;
};

export function gainFloaters(game: IGame, count: number, config: FloaterPayoutConfig): void {
  const automa = game.automa;
  if (automa === undefined) {
    return;
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: config.original, owner: bot.color}, 'automa-corporation');
  try {
    automa.floaters += count;
    game.log('${0} gained ${1} ${2} from its corporation ${3}',
      (b) => b.player(bot).number(count).cardResource(CardResource.FLOATER).string(config.displayName));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, config.countStat);
  bumpCorpStat(game, config.totalStat, count);
}
