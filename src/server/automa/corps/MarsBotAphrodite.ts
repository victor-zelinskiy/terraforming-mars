import {Resource} from '../../../common/Resource';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C28_APHRODITE);
/** What ONE step of Venus pays — the human twin's own rate. */
const MC_PER_STEP = 2;

/**
 * MarsBot Aphrodite — official card C28:
 *
 *   STARTING TAG    plant
 *   DRAFT PRIORITY  Plant > animal > Venus
 *   SETUP           Use this corporation only when playing with Venus Next.
 *   EFFECT          When Venus is increased (by you, MarsBot, or the card
 *                   Government Intervention), MarsBot gains 2 MC.
 *
 * THE PUREST TOLL IN THE SET: it never acts, never builds and never asks for
 * anything — it simply takes a cut of a global parameter, whoever moves it.
 * The human cannot avoid paying it by refusing to touch Venus either, because
 * the bot's own turns raise Venus constantly and the World Government does it
 * on the bot's behalf.
 *
 * ONE CHOKE POINT, SHARED WITH THE TWIN. `Game.increaseVenusScaleLevel` is the
 * only way Venus ever moves, and the HUMAN Aphrodite's payout already lives
 * there — this corporation's dispatch sits on the very next line, so the two
 * entities that print one rule cannot drift apart.
 *
 * «OR THE CARD GOVERNMENT INTERVENTION» NEEDS NO SPECIAL CASE, and that is
 * what the placement buys. B16 raises Venus with `game.phase` forced to SOLAR
 * precisely so its raise grants no TR and no track bonuses — and the Aphrodite
 * payout sits OUTSIDE that phase guard. The printed parenthetical exists to
 * tell a human player that the suppression does not reach this effect; the
 * engine already encodes it, so the honest implementation is to inherit the
 * position rather than to re-state the exception.
 *
 * PER STEP, NOT PER EVENT. The bot card says «2 MC» with no «per step», but
 * its twin prints «whenever Venus is terraformed 1 STEP, you gain 2 M€» and
 * the engine pays `2 * steps` for it. A card raising Venus 2 steps therefore
 * pays 4 M€ — the C21/C24 law: when the human card prints the same rule, take
 * the ENGINE's reading of it, never a fresh one.
 */
export const MarsBotAphrodite: MarsBotCorp = {
  info: INFO,

  onVenusIncreased(game: IGame, steps: number): void {
    if (steps <= 0) {
      return;
    }
    const amount = MC_PER_STEP * steps;
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bot.stock.add(Resource.MEGACREDITS, amount, {log: false});
      game.log('${0} gained ${1} M€ from its corporation ${2}: Venus rose',
        (b) => b.player(bot).number(amount).string('Aphrodite'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'aphroditeSteps', steps);
    bumpCorpStat(game, 'aphroditeMc', amount);
  },
};
