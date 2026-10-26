/*
 * DOES THE BOT'S NEXT DELEGATE STILL MATTER? (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md
 * §3.4, the owner's decision D15 of 2026-10-26.)
 *
 * The bot's one goal at the vote is to be the WINNING PLAYER (§3.3). A delegate
 * that can change nothing — the vote already won beyond any reply, or beyond
 * the bot's own reach — reads at the table as a machine spending cubes for
 * nothing (the bot's delegates are free, and nobody at the table should have
 * to know that for the move to look sensible). So before every delegate the
 * bot asks whether the outcome is still open — and it HOLDS only on a FACT,
 * never on a guess (the owner: «без догадок, только на фактах»).
 *
 * WHEN IS THE OUTCOME A FACT? Only when nobody but the bot can still move a
 * delegate before the sitting. While a player can still act, nothing is
 * guaranteed: Banned Delegate removes ANY delegate (the bot's included),
 * Nationalist Movement adds neutral ones, a colony or a card grants more, and
 * the cards a player has not drawn yet are unknown. So the table is STATIC
 * ⇔ every seat but the bot has PASSED this action phase, has nothing queued
 * that moves a delegate (`IDeferredAction.changesVotes`), and owns no colony
 * whose owner bonus — paid when somebody else trades — places delegates.
 *
 * ONE MOVE A PASSED SEAT CAN STILL MAKE: the chairman's seat. A seat that
 * completes the chairman quest while its reserve and lobby are empty takes
 * one of its own delegates back from a resolution (`ChairmanSeat`) — and a
 * passed seat's quest can still progress off another's turn. That removal is
 * a POSSIBILITY, not a fact either way, so the verdict is read over EVERY
 * table it could produce (the current one and each take-back, every
 * combination across seats): the vote is DECIDED only when the bot wins on all
 * of them, OUT OF REACH only when it can win on none.
 *
 * THE VERDICTS:
 *  · `contested`    — somebody can still act: the bot votes as ever (§3.3);
 *  · `decided`      — static, and the bot is the winning player on every
 *                     table the passed seats can still produce: it KEEPS the
 *                     delegate;
 *  · `out-of-reach` — static, and on no such table can the bot become the
 *                     winning player with every delegate it may still send
 *                     this generation (`budget`): it KEEPS the delegate;
 *  · `open`         — static, and the next delegate can still decide it: the
 *                     bot votes (the chooser concentrates — it takes the card
 *                     it can win with the fewest, and holds once it has).
 *
 * PURE: it reads the game and the parliament and judges over throwaway slot
 * lists with the table's own arithmetic (`winnerAmong` / `leaderOf`). It
 * places, removes and rolls nothing.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Phase} from '../../common/Phase';
import {PlayerId} from '../../common/Types';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {Parliament, Slot} from '../parliament/Parliament';
import {botDelegateSupply} from '../parliament/BotVoteChooser';

export type VoteStakes =
  | {kind: 'contested'}
  | {kind: 'decided'}
  | {kind: 'out-of-reach'}
  | {kind: 'open'};

/** Somebody but the bot can still move a delegate this generation — the outcome is no fact yet. */
export function seatCanStillMoveVotes(game: IGame, seat: IPlayer): boolean {
  if (!game.hasPassedThisActionPhase(seat)) {
    return true;
  }
  if (game.deferredActions.queuedFor(seat).some((action) => action.changesVotes === true)) {
    return true;
  }
  // An owner bonus is paid to the seat when ANOTHER trades — the bot's turn included.
  return game.colonies.some((colony) => colony.colonies.includes(seat.id) &&
    colony.metadata.colony.type === ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION);
}

/**
 * The resolutions a passed `seat` could still take one of its own delegates back from (the chairman's seat:
 * the quest still open, the seat not already the chairman, its reserve and lobby empty). Empty when it cannot.
 */
export function chairmanTakeBackSlots(parliament: Parliament, seat: IPlayer): Array<number> {
  const quest = parliament.quest;
  const questOpen = quest !== undefined && quest.completedBy === undefined;
  const pendingSeat = parliament.pendingActions.some((action) => action.kind === 'chairman-seat' && action.player === seat.id);
  if (!questOpen && !pendingSeat) {
    return [];
  }
  if (parliament.chairman === seat.id || parliament.lobby.has(seat.id) || parliament.reserve(seat) > 0) {
    return [];
  }
  return parliament.slots.flatMap((slot, index) => slot.votes.some((vote) => vote.owner === seat.id) ? [index] : []);
}

/** `slots` with the LATEST delegate of `owner` taken off slot `index` (the chairman's take-back). */
function withoutLatest(slots: ReadonlyArray<Slot>, index: number, owner: PlayerId): Array<Slot> {
  return slots.map((slot, i) => {
    if (i !== index) {
      return slot;
    }
    const votes = [...slot.votes];
    for (let v = votes.length - 1; v >= 0; v--) {
      if (votes[v].owner === owner) {
        votes.splice(v, 1);
        break;
      }
    }
    return {instance: slot.instance, votes};
  });
}

/** Every table the passed seats can still produce: the current one, and each combination of take-backs. */
export function possibleTables(parliament: Parliament, seats: ReadonlyArray<IPlayer>): Array<ReadonlyArray<Slot>> {
  let tables: Array<ReadonlyArray<Slot>> = [parliament.slots];
  for (const seat of seats) {
    const takeBacks = chairmanTakeBackSlots(parliament, seat);
    if (takeBacks.length === 0) {
      continue;
    }
    tables = tables.flatMap((table) => [table, ...takeBacks.map((index) => withoutLatest(table, index, seat.id))]);
  }
  return tables;
}

/** Is the bot the winning player of `slots`? */
function botWins(parliament: Parliament, slots: ReadonlyArray<Slot>, bot: PlayerId): boolean {
  return parliament.winnerAmong(slots)?.player === bot;
}

/** Can the bot become the winning player of `slots` with at most `budget` more delegates, all on one card? */
function botCanWin(parliament: Parliament, slots: ReadonlyArray<Slot>, bot: PlayerId, budget: number): boolean {
  // Concentration is optimal: a delegate on another card only raises THAT card's chance to be enacted.
  for (let index = 0; index < slots.length; index++) {
    for (let k = 1; k <= budget; k++) {
      const hypothetical = slots.map((slot, i): Slot => i !== index ? slot : {
        instance: slot.instance,
        votes: [...slot.votes, ...Array.from({length: k}, (_, n) => ({owner: bot, seq: parliament.voteSeq + n + 1}))],
      });
      if (botWins(parliament, hypothetical, bot)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * THE VERDICT for the bot's next delegate. `budget` — every delegate the bot may still send this generation,
 * this one included (the caller's: the mandate left, Party Politics still ahead); capped here by its supply.
 */
export function voteStakes(game: IGame, bot: IPlayer, budget: number): VoteStakes {
  const parliament = game.parliament;
  if (parliament === undefined || game.phase !== Phase.ACTION || parliament.slots.length === 0) {
    return {kind: 'contested'};
  }
  const others = game.players.filter((player) => player.id !== bot.id);
  if (others.some((seat) => seatCanStillMoveVotes(game, seat))) {
    return {kind: 'contested'};
  }
  const tables = possibleTables(parliament, others);
  if (tables.every((table) => botWins(parliament, table, bot.id))) {
    return {kind: 'decided'};
  }
  const reach = Math.max(1, Math.min(budget, botDelegateSupply(parliament, bot)));
  if (tables.every((table) => !botWins(parliament, table, bot.id) && !botCanWin(parliament, table, bot.id, reach))) {
    return {kind: 'out-of-reach'};
  }
  return {kind: 'open'};
}
