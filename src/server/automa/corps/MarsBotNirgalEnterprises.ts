import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaMilestonesAwards} from '../AutomaMilestonesAwards';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {destroyBonusCard} from './MarsBotBonusDeckOps';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C42_NIRGAL_ENTERPRISES);
/** The card's printed name, for the journal templates. */
const NAME = 'Nirgal Enterprises';
/** The bonus card its setup box removes from the game. */
const OVERACHIEVEMENT = BonusCardId.B04_OVERACHIEVEMENT;
/** The printed modifier on every award. */
const AWARD_BONUS = 2;

/** Which box the printed generation ranges call for, if any. */
function boxFor(generation: number): 'milestone' | 'award' | undefined {
  if (generation >= 2 && generation <= 5) {
    return 'milestone';
  }
  if (generation >= 6 && generation <= 9) {
    return 'award';
  }
  if (generation >= 10) {
    return 'milestone';
  }
  return undefined; // Generation 1 is printed into NEITHER range.
}

/**
 * MarsBot Nirgal Enterprises — official card C42:
 *
 *   STARTING TAGS       building, power, plant
 *   SETUP               Destroy Overachievement from the bonus deck.
 *   EFFECT              MarsBot has +2 on all awards (when considering
 *                       funding, and during scoring).
 *   BEFORE ACTION PHASE If generation 2-5 or 10+: perform a Milestone action.
 *                       If generation 6-9: perform an Award action. Skip
 *                       Failed Action if unable to perform these.
 *
 * A CAREER IN THREE ACTS. The human Nirgal pays 0 M€ for awards and
 * milestones; the bot has no prices, so its version buys the same thing with
 * TEMPO — a free milestone claim every generation of the early game, a free
 * award funding through the middle one, and milestones again once the endgame
 * is in sight. The +2 is what makes that middle act land: an award the bot is
 * two behind on becomes one it is ahead of, and the same +2 is still there
 * when the awards are scored.
 *
 * ⚠️ THE +2 IS RETURNED, NOT APPLIED. `AutomaMAEvaluation.botAwardScore` is
 * the ONE derivation of the bot's award strength and every consumer reads it
 * through `AwardScorer` — the bot's own funding decision, the award overlay
 * the player reads, and the endgame scoring. So the corporation answers a
 * NUMBER (`awardScoreBonus`) that the derivation adds; computing it at a call
 * site would have left the other two consumers telling the player a different
 * story from the one the rules follow.
 *
 * «SKIP FAILED ACTION IF UNABLE» IS THE CARD OVERRIDING A GENERAL RULE. The
 * ordinary Claim-Milestone / Fund-Award actions (`claimMilestoneAction` /
 * `fundAwardAction`) end in the official Failed Action when nothing is
 * claimable or the bot is ahead nowhere — this box explicitly does not, so it
 * calls the `try…` pair, which is the same selection and the same claim with
 * no compensation branch. Nothing else about them is restated here.
 *
 * GENERATION 1 IS IN NEITHER PRINTED RANGE, and that matters because RB-B
 * resolves Before-Action-Phase boxes once right after setup too: the box is
 * OFFERED in generation 1 and correctly declines. Pinned by a test.
 *
 * DESTROYING OVERACHIEVEMENT is the shared setup operation (`destroyBonusCard`
 * — C05 and C21 use it): deck, discard and the generation-1 action-deck slot
 * are all cleaned, and the successor takes that slot. The card is the one
 * whose whole text is «claim a milestone / fund an award», so a corporation
 * that already does that every generation removes it rather than competing
 * with itself for the same free actions — and C17 Vitor, which SETS IT ASIDE
 * to replay it forever, is the exact opposite reading of the same card.
 */
export const MarsBotNirgalEnterprises: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    if (destroyBonusCard(game, OVERACHIEVEMENT)) {
      game.log('${0} destroyed Overachievement — its corporation ${1} claims and funds on its own',
        (b) => b.player(bot).string(NAME));
    }
  },

  awardScoreBonus(): number {
    return AWARD_BONUS;
  },

  beforeActionPhase(game: IGame): void {
    const box = boxFor(game.generation);
    if (box === undefined) {
      return; // Generation 1: the printed ranges start at 2.
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      // The `try…` pair: the same selection and claim as the track actions,
      // without their Failed Action — which is exactly what «skip Failed
      // Action if unable» asks for.
      const done = box === 'milestone' ?
        AutomaMilestonesAwards.tryClaimMilestone(game) :
        AutomaMilestonesAwards.tryFundAward(game);
      if (done) {
        bumpCorpStat(game, box === 'milestone' ? 'nirgalMilestones' : 'nirgalAwards');
        return;
      }
      bumpCorpStat(game, 'nirgalSkipped');
      game.log(box === 'milestone' ?
        '${0} had no milestone to claim this generation (corporation ${1})' :
        '${0} led no award this generation (corporation ${1})',
      (b) => b.player(bot).string(NAME));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },
};
