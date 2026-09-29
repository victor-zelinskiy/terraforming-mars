/*
 * WHERE MARSBOT SENDS A DELEGATE (Turmoil Redux — docs/TURMOIL_REDUX_MARSBOT.md §3.3).
 *
 * The bot's one goal at the vote is to be the WINNING PLAYER (the Agenda step
 * and the winner's reward); a law's payout is nothing to it, and it has no
 * «own» resolutions. So the list is ONE principle and its tie-breaks:
 *   1. `win-now`      — the card where THIS delegate makes it the winning
 *                       player (deficit 1);
 *   2. `closest`      — else the card with the smallest DEFICIT: how many of
 *                       its delegates (this one included) it takes to become
 *                       the winning player there, simulated one delegate at a
 *                       time by the REAL rules, never beyond its supply. This
 *                       CONCENTRATES: the next cube strengthens the card the
 *                       bot already leads instead of opening a new front;
 *   3. the ties, in order — `star` (a winner's reward the bot can execute:
 *      the only «own» resolutions it has), `fewest-human` (the fewest
 *      delegates of the players — the sum of every human's), `nearest-slot`
 *      (the slot with the tie priority, index 0).
 *
 * PURE: it reads the parliament and returns a choice; it places nothing,
 * rolls nothing, and asks the same arithmetic the table is judged by —
 * `leaderOf` over a slot with the hypothetical votes added (a later delegate
 * loses a tie: the bot needs STRICTLY more than any player), `winnerAmong`
 * over the whole hypothetical table (the neutral votes count, a tie goes to
 * the slot closer to ENACTED). Randomness decides WHEN and HOW MANY the bot
 * votes (`AutomaPartyPolitics`, `AutomaLobbying`); never WHERE.
 */
import {IPlayer} from '../IPlayer';
import {Parliament, Slot} from './Parliament';
import {ResolutionInstanceId} from '../../common/parliament/ParliamentTypes';
import {MarsBotVoteRule} from '../../common/automa/MarsBotTurn';
import {botWinnerRewardKind} from '../automa/BotWinnerReward';

export type BotVoteChoice = {
  slotIndex: number;
  instance: ResolutionInstanceId;
  /** The rules that NARROWED the choice, in order — the last one decided it. */
  rules: ReadonlyArray<MarsBotVoteRule>;
  /** The chosen card's deficit; absent when no number of delegates within the bot's supply wins it. */
  deficit?: number;
};

/** The delegates the bot can still send this generation: the lobby's free one plus its reserve. */
export function botDelegateSupply(parliament: Parliament, bot: IPlayer): number {
  return (parliament.lobby.has(bot.id) ? 1 : 0) + parliament.reserve(bot);
}

/** The delegates of the PLAYERS (every human, summed; the neutral ones and the bot's excluded) on `slot`. */
export function humanDelegatesOn(slot: Slot, bot: IPlayer): number {
  return slot.votes.filter((vote) => vote.owner !== 'NEUTRAL' && vote.owner !== bot.id).length;
}

/**
 * Would the bot be the WINNING PLAYER after `k` more of its delegates landed
 * on slot `index`? The real rules over a hypothetical table: the added votes
 * carry sequence numbers past every existing one (a delegate placed later
 * loses a tie of the lead), nothing else moves.
 */
export function botWinsWith(parliament: Parliament, bot: IPlayer, index: number, k: number): boolean {
  const slots = parliament.slots.map((slot, i): Slot => i !== index ? slot : {
    instance: slot.instance,
    votes: [...slot.votes, ...Array.from({length: k}, (_, n) => ({owner: bot.id, seq: parliament.voteSeq + n + 1}))],
  });
  const verdict = parliament.winnerAmong(slots);
  return verdict !== undefined && verdict.slotIndex === index && verdict.player === bot.id;
}

/**
 * The DEFICIT of every slot: the smallest number of the bot's delegates
 * (1..its supply) that makes it the winning player there; `undefined` when
 * none within the supply does. Exported so a spec can pin the arithmetic
 * (the earlier-delegate tie, the neutral votes, the slot priority).
 */
export function voteDeficits(parliament: Parliament, bot: IPlayer): Array<number | undefined> {
  const supply = Math.max(1, botDelegateSupply(parliament, bot));
  return parliament.slots.map((_, index) => {
    for (let k = 1; k <= supply; k++) {
      if (botWinsWith(parliament, bot, index, k)) {
        return k;
      }
    }
    return undefined;
  });
}

/**
 * WHICH CARD GIVES A DELEGATE UP FOR THE CHAIRMAN SEAT when every delegate of
 * the bot stands on a resolution (§5): the card whose LATEST cube can leave
 * without changing the verdict (`winnerAmong`) or the bot's lead on that card;
 * a tie → the card where the bot has the FEWEST delegates; a tie → the
 * farthest slot (the highest index). Pure; `undefined` when the bot has no
 * delegate on any card.
 */
export function chooseSeatSlot(parliament: Parliament, bot: IPlayer): number | undefined {
  const slots = parliament.slots;
  const own = slots.map((_, index) => index).filter((index) => parliament.votesOf(bot, slots[index]) > 0);
  if (own.length === 0) {
    return undefined;
  }
  const before = parliament.winnerAmong(slots);
  const leads = (slot: Slot): boolean => parliament.leaderOf(slot)?.owner === bot.id;
  const harmless = own.filter((index) => {
    const without = slots.map((slot, i): Slot => {
      if (i !== index) {
        return slot;
      }
      const votes = [...slot.votes];
      for (let v = votes.length - 1; v >= 0; v--) {
        if (votes[v].owner === bot.id) {
          votes.splice(v, 1);
          break;
        }
      }
      return {instance: slot.instance, votes};
    });
    const after = parliament.winnerAmong(without);
    const verdictSame = before?.instance === after?.instance && before?.player === after?.player;
    return verdictSame && leads(slots[index]) === leads(without[index]);
  });
  let candidates = harmless.length > 0 ? harmless : own;
  const fewest = Math.min(...candidates.map((index) => parliament.votesOf(bot, slots[index])));
  candidates = candidates.filter((index) => parliament.votesOf(bot, slots[index]) === fewest);
  return Math.max(...candidates);
}

/** The card the bot's NEXT delegate goes to, and why. `undefined` on an empty voting area. */
export function chooseVoteSlot(parliament: Parliament, bot: IPlayer): BotVoteChoice | undefined {
  const slots = parliament.slots;
  if (slots.length === 0) {
    return undefined;
  }
  const deficits = voteDeficits(parliament, bot);
  const rules: Array<MarsBotVoteRule> = [];
  let candidates = slots.map((_, index) => index);

  // 1. Win now.
  const winNow = candidates.filter((index) => deficits[index] === 1);
  if (winNow.length > 0) {
    candidates = winNow;
    rules.push('win-now');
  } else {
    // 2. Closest to winning — the smallest deficit among the reachable cards.
    const reachable = candidates.filter((index) => deficits[index] !== undefined);
    if (reachable.length > 0) {
      const least = Math.min(...reachable.map((index) => deficits[index] as number));
      candidates = reachable.filter((index) => deficits[index] === least);
      rules.push('closest');
    }
  }

  // 3. The ties — each applied only where it NARROWS.
  if (candidates.length > 1) {
    const starred = candidates.filter((index) => botWinnerRewardKind(parliament.resolutionOf(slots[index].instance)) !== undefined);
    if (starred.length > 0 && starred.length < candidates.length) {
      candidates = starred;
      rules.push('star');
    }
  }
  if (candidates.length > 1) {
    const fewest = Math.min(...candidates.map((index) => humanDelegatesOn(slots[index], bot)));
    const calm = candidates.filter((index) => humanDelegatesOn(slots[index], bot) === fewest);
    if (calm.length < candidates.length) {
      candidates = calm;
      rules.push('fewest-human');
    }
  }
  if (candidates.length > 1) {
    candidates = [Math.min(...candidates)];
    rules.push('nearest-slot');
  }
  if (rules.length === 0) {
    // One card on the table, nothing to narrow: the slot with the tie priority IS the choice.
    rules.push('nearest-slot');
  }
  const slotIndex = candidates[0];
  const choice: BotVoteChoice = {slotIndex, instance: slots[slotIndex].instance, rules};
  const deficit = deficits[slotIndex];
  if (deficit !== undefined) {
    choice.deficit = deficit;
  }
  return choice;
}
