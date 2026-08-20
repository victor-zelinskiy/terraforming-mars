import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {inplaceShuffle} from '../../utils/shuffle';
import {AutomaResearch} from '../AutomaResearch';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C12_UNMI);
const SUBSIDY = BonusCardId.B31_GOVERNMENT_SUBSIDY;
/** The printed «starting from the 2nd generation». */
const FIRST_EXTRA_GENERATION = 2;

/**
 * MarsBot United Nations Mars Initiative — official card C12:
 *
 *   SETUP                Shuffle Government Subsidy into the bonus deck. Do
 *                        not add a bonus card to MarsBot's action deck during
 *                        setup.
 *   BEFORE ACTION PHASE  Add an additional card from the bonus deck to
 *                        MarsBot's action deck each generation, starting from
 *                        the 2nd generation.
 *
 * plus its corporation-specific bonus card B31 Government Subsidy («MarsBot
 * raises its TR 1 step»).
 *
 * The trade is the whole card: generation 1 runs on projects alone, and every
 * generation after it gets TWO bonus cards instead of one. Unlike Ecoline's
 * B23 or Inventrix's B25, B31 is NOT recurring — it is shuffled into the bonus
 * deck and then lives in the ordinary rotation (drawn, discarded, reshuffled),
 * which is exactly why the corporation deals itself extra bonus cards.
 *
 * This engine builds generation 1's action deck at game creation, BEFORE the
 * corporation exists, so «do not add a bonus card» is undone rather than
 * prevented: the card it was dealt goes BACK into the bonus deck, which is the
 * state the table would have had.
 */
export const MarsBotUnmi: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    // «Do not add a bonus card during setup» — take back the one generation 1
    // was already dealt (the deck keeps its projects, one card shorter).
    const dealt = automa.actionDeck.findIndex((entry) => entry.kind === 'bonus');
    if (dealt !== -1) {
      const [returned] = automa.actionDeck.splice(dealt, 1);
      automa.bonusDeck.push(returned);
      game.log('${0} starts without a bonus card: its corporation ${1} keeps that card in the bonus deck',
        (b) => b.player(bot).string('UNMI'));
    }
    automa.bonusDeck.push({kind: 'bonus', id: SUBSIDY});
    inplaceShuffle(automa.bonusDeck, game.rng);
    game.log('${0} shuffled Government Subsidy into its bonus deck', (b) => b.player(bot));
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || game.generation < FIRST_EXTRA_GENERATION) {
      return; // «Starting from the 2nd generation».
    }
    // The generation's action deck was built (and shuffled) during research;
    // this is the ADDITIONAL card on top of the one it already holds. It joins
    // at a seeded-random position — equivalent to having been shuffled in.
    AutomaResearch.reshuffleBonusDeckIfEmpty(game, automa);
    const extra = automa.bonusDeck.shift();
    if (extra === undefined) {
      return; // Deck and discard both empty — nothing to add.
    }
    const index = game.rng.nextInt(automa.actionDeck.length + 1);
    automa.actionDeck.splice(index, 0, extra);
    bumpCorpStat(game, 'unmiExtraCards');
    // Journal-only: public bookkeeping, not an event — the card announces
    // itself when the bot flips it.
    game.log('${0} added an extra bonus card to its action deck (corporation ${1})',
      (b) => b.player(marsBotOf(game)).string('UNMI'));
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== SUBSIDY) {
      throw new Error(`MarsBot UNMI does not own bonus card ${id}`);
    }
    return governmentSubsidy(game);
  },
};

/** B31 Government Subsidy: «MarsBot raises its TR 1 step.» */
function governmentSubsidy(game: IGame): BonusCardOutcome {
  const bot = marsBotOf(game);
  AutomaTurnLog.setBonusBranch(game, {key: 'A subsidy from Earth'});
  bumpCorpStat(game, 'subsidyPlayed');
  bumpCorpStat(game, 'subsidyTr');
  bot.increaseTerraformRating(1, {log: true});
  // Not recurring and not destroyed — the ordinary rotation takes it back.
  return 'discard';
}
