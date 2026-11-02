import {CardType} from '../../../common/cards/CardType';
import {Resource} from '../../../common/Resource';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {BotVoteBranch} from '../../../common/automa/botVoteText';
import {IGame} from '../../IGame';
import {castBotVote} from '../AutomaPolitics';
import {AutomaLobbying} from '../AutomaLobbying';
import {logVoteRefusal} from '../AutomaPartyPolitics';
import {GRAY_EMINENCE_VOTES} from '../LobbyMandate';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {destroyRecurringBonusCard} from './MarsBotBonusDeckOps';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {pileCount} from './MarsBotDividendReads';

/** B29: what each delegate the card could not send pays instead. */
const UNSENT_DELEGATE_MC = 2;

/**
 * MarsBot Septem Tribus — official card C37, ADAPTED to Turmoil Redux:
 *
 *   SETUP                Use this corporation only when playing with Turmoil.
 *                        Destroy Party Politics from the bonus deck. Shuffle
 *                        Gray Eminence into the bonus deck. Add all delegates
 *                        of another color to the reserve: they count as the
 *                        MarsBot's delegates.
 *   BEFORE ACTION PHASE  Add Gray Eminence to MarsBot's action deck.
 *
 * plus its corporation-specific bonus card B29 Gray Eminence: «Place 2 MarsBot
 * delegates (if able) using the following priorities: 1. the party with the
 * lowest number of MarsBot's delegates, 2. the party with the lowest number of
 * your delegates, 3. random. For each delegate it couldn't place, it gains
 * 2 MC. At the beginning of every generation, shuffle this into MarsBot's
 * action deck.»
 *
 * THE REDUX READING (the owner, 2026-11-02 — «оставил лимит общий и голосовал
 * по существующим правилам»):
 *  - «Turmoil» is the Mars Parliament (`requiresModules: ['turmoilRedux']`;
 *    classic Turmoil is refused in MarsBot games).
 *  - The second colour of delegates is NOT added: the bot keeps the common
 *    seven (`PARLIAMENT_DELEGATES_PER_PLAYER`), like every seat.
 *  - The printed party priorities are NOT played: a Redux delegate goes on a
 *    RESOLUTION, and each of the two votes is the bot's ordinary one —
 *    `castBotVote` (the source by the human's rule, D12; the chooser's list,
 *    §3.3; the hold on a fact, D15). The corporation changes WHICH CARD votes:
 *    Gray Eminence takes Party Politics' place in the recurring pool and sends
 *    two delegates where Party Politics sent one; the lobbying mandate (D14)
 *    runs beside it unchanged, and the turn's two places are the card's own
 *    (`cardVotesOf`).
 *  - «For each delegate it couldn't place, it gains 2 MC» stands as printed:
 *    a refused vote (no seat, no resolution up for a vote, no delegate left)
 *    pays 2 M€ for it and for every delegate after it. A KEPT delegate (D15 —
 *    the vote is already decided, or out of reach) is a choice, not an
 *    inability: it pays nothing, the same way Party Politics' hold does not.
 *
 * LIFECYCLE. Party Politics is a RECURRING card in Redux (RB-C p.6 Setup 3 —
 * it joins every generation's action deck, never the bonus deck), so «destroy
 * it from the bonus deck» clears the recurring pool and its generation-1 copy
 * (`destroyRecurringBonusCard`); Gray Eminence then rides the same recurring
 * mechanism as Inventrix's B25 — joined here at Before Action Phase, handed
 * back every generation by `AutomaResearch.finishActionDeck`.
 */
export const MarsBotSeptemTribus: MarsBotCorp = {
  info: marsBotCorpInfo(MarsBotCorpId.C37_SEPTEM_TRIBUS),

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.C37_SEPTEM_TRIBUS).rates;
    const steps = game.parliament?.agendaOf(marsBotOf(game)) ?? 0;
    return dividendResult([
      perUnitTerm('Steps on the Career track', steps, r.each),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return pileCount(game, (card) => card.type === CardType.EVENT);
  },

  setup(game: IGame): void {
    if (destroyRecurringBonusCard(game, BonusCardId.B21_PARTY_POLITICS)) {
      game.log('${0} destroyed Party Politics from its bonus deck — Gray Eminence replaces it',
        (b) => b.player(marsBotOf(game)));
    }
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B29_GRAY_EMINENCE)) {
      automa.recurringBonusCards.push(BonusCardId.B29_GRAY_EMINENCE);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.B29_GRAY_EMINENCE);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.B29_GRAY_EMINENCE});
      // Journal-only (no scope): the deck join is public bookkeeping — the
      // card announces itself when flipped.
      game.log('${0} shuffled Gray Eminence into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.B29_GRAY_EMINENCE) {
      throw new Error(`MarsBot Septem Tribus does not own bonus card ${id}`);
    }
    return grayEminence(game);
  },
};

/** B29 Gray Eminence. Always ends in the recurring holding (never destroyed). */
function grayEminence(game: IGame): BonusCardOutcome {
  const bot = marsBotOf(game);
  bumpCorpStat(game, 'grayEminencePlayed');
  let sent = 0;
  let unsent = 0;
  let stopped: BotVoteBranch | undefined;
  for (let i = 0; i < GRAY_EMINENCE_VOTES; i++) {
    // The budget counts THIS card's delegates still to come — what «out of reach» is judged against.
    const vote = castBotVote(game, bot, AutomaLobbying.budgetOf(game, bot, GRAY_EMINENCE_VOTES - i));
    if (vote.placed) {
      sent++;
      continue;
    }
    stopped = logVoteRefusal(game, bot, vote.refusal);
    if (vote.refusal === 'vote-decided' || vote.refusal === 'out-of-reach') {
      // KEPT, not unable (D15): the next delegate would meet the very same fact.
      AutomaLobbying.noteHold(game, bot, vote.refusal);
    } else {
      // Unable — and nothing between two votes of one card can change that: every delegate left is unsent.
      AutomaTurnLog.note(game, {kind: 'vote-refused', reason: vote.refusal}, {consumeLog: true});
      unsent = GRAY_EMINENCE_VOTES - i;
    }
    break;
  }
  bumpCorpStat(game, 'grayEminenceDelegates', sent);
  if (unsent > 0) {
    const mc = unsent * UNSENT_DELEGATE_MC;
    bot.stock.add(Resource.MEGACREDITS, mc, {log: false});
    game.log('${0} could not send ${1} delegate(s) and gained ${2} M€ instead', (b) => b.player(bot).number(unsent).number(mc));
    bumpCorpStat(game, 'grayEminenceMc', mc);
  }
  AutomaTurnLog.setBonusBranch(game, branchOf(sent, unsent * UNSENT_DELEGATE_MC, stopped));
  return 'discard'; // Recurring: `routeBonusCard` keeps it in the holding pool.
}

/** The card's ONE resolved branch for the turn review — what the two delegates came to. */
function branchOf(sent: number, mc: number, stopped: BotVoteBranch | undefined): BotVoteBranch {
  if (mc > 0) {
    return sent > 0 ?
      {key: 'Sent ${0} delegate(s) — ${1} M€ for the one it could not send', params: [`${sent}`, `${mc}`]} :
      {key: 'Could not send its delegates — ${0} M€ instead', params: [`${mc}`]};
  }
  if (sent === 0 && stopped !== undefined) {
    return stopped; // Both kept: the hold's own phrase.
  }
  return {key: 'Sent ${0} delegate(s)', params: [`${sent}`]};
}
