import {Resource} from '../../../common/Resource';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

/** The M€ threshold and reward of the printed effect (card C01). */
const COST_THRESHOLD = 20;
const REWARD_MC = 4;

/**
 * MarsBot Credicor — official card C01:
 *
 *   DRAFT PRIORITY  Most expensive
 *   EFFECT          When resolving a card with a cost of 20 MC or more,
 *                   MarsBot gains 4 MC.
 *
 * The draft behavior (pick the most expensive, random among ties; the discard
 * step saves ALL of the highest-cost drafted cards and discards one of the
 * others — nothing when all four cost the same, RB-B p.2 "Special Cases") is
 * fully data-driven: `info.draftPriority = mostExpensive` interpreted by
 * `MarsBotDraftResolver`.
 *
 * The M€ gain is attributed like a human corporation's passive effect (an
 * `effect` scope with a `corporation` source), so the journal, the turn
 * review (a `corporation` cause chain) and the endgame corporation facts all
 * see WHY the bot got richer — never a bare "+4 M€".
 */
export const MarsBotCredicor: MarsBotCorp = {
  info: marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR),

  onProjectCardResolving(game: IGame, card: IProjectCard): void {
    if (card.cost < COST_THRESHOLD) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: this.info.original, owner: bot.color}, 'automa-corporation');
    try {
      // The recorder sees the stock change; the explicit template names the
      // corporation as the cause (the plain `gained` line would not).
      bot.stock.add(Resource.MEGACREDITS, REWARD_MC, {log: false});
      game.log('${0} gained ${1} M€ from its corporation ${2} for resolving a card costing 20 M€ or more',
        (b) => b.player(bot).number(REWARD_MC).string('CrediCor'));
    } finally {
      game.events.endScope();
    }
    bumpCorpStat(game, 'credicorTriggers');
    bumpCorpStat(game, 'credicorMc', REWARD_MC);
    AutomaTurnLog.setCause(game, prior);
  },
};
