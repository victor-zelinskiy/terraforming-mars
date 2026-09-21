/*
 * COMPLETING THE CHAIRMAN QUEST (rulebook p.9, project decision Q13).
 *
 * The first player to reach the quest's count this generation puts a delegate
 * in the chairman's seat and advances one step on the Agenda track (collecting
 * the step's bonus). The previous chairman's delegate returns to its owner's
 * RESERVE; a sitting chairman who completes the quest again keeps the seat and
 * only advances. The new chairman's delegate comes from the reserve, else from
 * the lobby, else from one of the player's own resolutions (the player chooses
 * which) — an eighth delegate is never created.
 *
 * THE GATE (docs/claude/prompts/parliament-chairman-quest.md §2). Nothing of
 * the above happens when the count is reached: the completion only RECORDS
 * itself (`pendingActions` + a deferred confirm) and the player is asked.
 * Until the answer the screen is untouched — the marker on its old step, the
 * TR unchanged, the hand the same size, the seat as it was. It is the law the
 * sitting's `assembly` gate follows: the players are asked BEFORE anything
 * changes, never shown a change they missed.
 *
 * The gate is deferred at `BACK_OF_THE_LINE` on purpose: the count is reached
 * by the last tag of a card or the last tile of a placement, and a gate at
 * `DEFAULT` would announce the reward in the middle of that card's own
 * cinematic.
 *
 * THE ORDER after the answer is SEAT, then AGENDA. The rules fix no order;
 * this is the presentation's choice and it follows the sitting's own law
 * «причина раньше следствия» — the player learns WHAT they took (the office)
 * before being paid for it. In the corner case where the seat needs a choice
 * (every delegate stands on a resolution) the Agenda step waits for that
 * choice too: a marker that moves while the player is still picking is a
 * reward with no cause on screen.
 */
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {PlayerInput} from '../../PlayerInput';
import {SelectParty} from '../../inputs/SelectParty';
import {SelectOption} from '../../inputs/SelectOption';
import {InputError} from '../../inputs/InputError';
import {Priority} from '../../deferredActions/Priority';
import {Color} from '../../../common/Color';
import {PartyName} from '../../../common/turmoil/PartyName';
import type {AgendaAdvance, Parliament} from '../Parliament';

/** What `seat()` did: the office changed hands here and now, or the player still has to pick the delegate. */
type SeatResult = 'seated' | 'asking';

export class ChairmanSeat {
  /** Advance the Agenda marker and pay the step's bonus, attributed to the parliament. Returns what happened. */
  public static advanceAgenda(player: IPlayer, parliament: Parliament, reason: 'quest' | 'phase' = 'quest'): AgendaAdvance | undefined {
    const game = player.game;
    const advance = parliament.advanceAgenda(player);
    if (advance === undefined) {
      game.log('${0} is already at the end of the Agenda track', (b) => b.player(player));
      return undefined;
    }
    // The move is RECORDED for the client's presentation (the marker's glide
    // and the step's reward, played once by its sequence number) — the
    // political phase's summary carries its own copy for the results scene.
    parliament.lastAdvance = {
      seq: (parliament.lastAdvance?.seq ?? 0) + 1,
      player: player.id,
      from: advance.from,
      to: advance.to,
      bonus: advance.bonus,
      reason,
      generation: game.generation,
    };
    game.events.withSource({kind: 'parliament'}, () => {
      game.log('${0} advances on the Agenda track to step ${1}', (b) => b.player(player).number(advance.to));
      if (advance.bonus === 'tr') {
        player.increaseTerraformRating(1, {trAttribution: {sourceType: 'other', sourceName: 'Agenda track'}});
        game.log('${0} gained ${1} ${2} from the Agenda track', (b) => b.player(player).number(1).tr());
      } else if (advance.bonus === 'card') {
        // The Agenda's own source: the console lifts the card off the track step.
        player.drawCard(1, {source: {type: 'agenda'}});
      }
    });
    return advance;
  }

  /**
   * The count was reached. NOTHING is applied: the fact is logged, the pending
   * record written (so a reload finds it) and the gate deferred.
   */
  public static onQuestCompleted(player: IPlayer): void {
    const game = player.game;
    const parliament = game.parliament;
    if (parliament === undefined) {
      return;
    }
    game.log('${0} completed the chairman quest', (b) => b.player(player));
    parliament.pendingActions.push({kind: 'chairman-quest', player: player.id});
    player.defer(() => ChairmanSeat.questPrompt(player, parliament), Priority.BACK_OF_THE_LINE);
  }

  /**
   * THE GATE'S PROMPT (also rebuilt after a reload) — a bare confirm carrying
   * the structural marker; the title is for the journal and a plain renderer,
   * never for detection. `undefined` when the record is already gone (a
   * doubled defer, a resume that raced the answer): answering twice is not
   * expressible.
   */
  public static questPrompt(player: IPlayer, parliament: Parliament): PlayerInput | undefined {
    if (!ChairmanSeat.questGatePending(parliament, player)) {
      return undefined;
    }
    const generation = parliament.quest?.generation ?? player.game.generation;
    // The title is the one the seat pick already prints — the journal and a
    // plain renderer read it; the console routes on the marker alone.
    return new SelectOption('You completed the chairman quest', 'Continue')
      .markChairmanQuest({generation})
      .andThen(() => {
        ChairmanSeat.applyQuest(player, parliament);
        return undefined;
      });
  }

  /** Is `player`'s quest gate still unanswered? (The save's own record — never a counter in memory.) */
  public static questGatePending(parliament: Parliament, player: IPlayer): boolean {
    return parliament.pendingActions.some((action) => action.kind === 'chairman-quest' && action.player === player.id);
  }

  /**
   * Re-raise every unanswered quest gate whose player is not already holding
   * it. Returns true when something was deferred — the caller then drains the
   * queue and re-enters. The generation may not END over an unanswered gate:
   * the political phase would move the very same marker on top of a reward the
   * player has never seen.
   */
  public static deferPendingQuestGates(game: IGame, parliament: Parliament): boolean {
    let deferred = false;
    for (const pending of parliament.pendingActions) {
      if (pending.kind !== 'chairman-quest') {
        continue;
      }
      const player = game.getPlayerById(pending.player);
      if (player.getWaitingFor()?.chairmanQuestPrompt !== undefined) {
        // The gate already stands — the seat is blocked on it by construction.
        continue;
      }
      player.defer(() => ChairmanSeat.questPrompt(player, parliament), Priority.BACK_OF_THE_LINE);
      deferred = true;
    }
    return deferred;
  }

  /**
   * THE ANSWER: the office first, the Agenda step second — and, when the seat
   * still needs the player's pick, the step waits for that pick
   * (`seatPrompt`'s `finish`). One journal ROOT for the whole thing, so the
   * other players' notification has a group of its own to stand on instead of
   * hanging off whatever card happened to close the quest.
   */
  private static applyQuest(player: IPlayer, parliament: Parliament): void {
    const game = player.game;
    parliament.pendingActions = parliament.pendingActions.filter(
      (action) => !(action.kind === 'chairman-quest' && action.player === player.id));
    const events = game.events;
    events.beginAction(player, {kind: 'parliament'}, {category: 'parliament'});
    try {
      // THE GROUP'S OWN HEADER — the fact the other players' notification is
      // built on. Logged first, so the journal group never opens with the
      // outgoing delegate's line.
      game.log('${0} takes the chairmanship', (b) => b.player(player));
      if (ChairmanSeat.seat(player, parliament) === 'seated') {
        ChairmanSeat.advanceAgenda(player, parliament);
      }
    } finally {
      events.endScope();
    }
    game.save();
  }

  private static seat(player: IPlayer, parliament: Parliament): SeatResult {
    const game = player.game;
    if (parliament.chairman === player.id) {
      game.log('${0} remains the chairman', (b) => b.player(player));
      // Nobody lost anything: the record carries no previous holder, and no
      // card tells anyone that one did.
      game.events.recordChairmanSeated(player);
      return 'seated';
    }
    let previous: Color | undefined = undefined;
    if (parliament.chairman !== undefined) {
      const holder = game.getPlayerById(parliament.chairman);
      previous = holder.color;
      game.log('The delegate of ${0} leaves the chairman seat', (b) => b.player(holder));
      parliament.chairman = undefined;
    }
    if (parliament.reserve(player) > 0) {
      parliament.chairman = player.id;
      game.log('${0} becomes the chairman (delegate from the reserve)', (b) => b.player(player));
      game.events.recordChairmanSeated(player, previous);
      return 'seated';
    }
    if (parliament.lobby.has(player.id)) {
      parliament.lobby.delete(player.id);
      parliament.chairman = player.id;
      game.log('${0} becomes the chairman (delegate from the lobby)', (b) => b.player(player));
      game.events.recordChairmanSeated(player, previous);
      return 'seated';
    }
    // Every delegate is on a resolution: the player chooses which card gives
    // one up. WHOSE delegate left the seat rides the RECORD, not a field in
    // memory: the pick is routinely answered after a reload.
    parliament.pendingActions.push({kind: 'chairman-seat', player: player.id, ...(previous === undefined ? {} : {previous})});
    player.defer(() => ChairmanSeat.seatPrompt(player, parliament), Priority.DEFAULT);
    return 'asking';
  }

  /** The prompt of a pending seat (also rebuilt after a reload). */
  public static seatPrompt(player: IPlayer, parliament: Parliament): PlayerInput | undefined {
    const pending = parliament.pendingActions.find((action) => action.kind === 'chairman-seat' && action.player === player.id);
    if (pending === undefined) {
      return undefined;
    }
    const parties = parliament.slots
      .filter((slot) => parliament.votesOf(player, slot) > 0)
      .map((slot) => parliament.resolutionOf(slot.instance).party);
    const previous = pending.kind === 'chairman-seat' ? pending.previous : undefined;
    const finish = (party: PartyName | undefined) => {
      const game = player.game;
      // ITS OWN JOURNAL ROOT: the pick is answered in a separate request, so
      // without one the seating would hang off whatever chain happened to be
      // live — and the other players' notification would have no group.
      game.events.beginAction(player, {kind: 'parliament'}, {category: 'parliament'});
      try {
        game.log('${0} takes the chairmanship', (b) => b.player(player));
        if (party !== undefined) {
          const slot = parliament.slotOf(party as never);
          if (slot === undefined || parliament.removeLatestVote(player, slot) === undefined) {
            throw new InputError('You have no delegate on that resolution');
          }
          game.log('${0} takes a delegate back from ${1} for the chairman seat', (b) => b.player(player).resolution(parliament.resolutionOf(slot.instance).id));
        }
        parliament.chairman = player.id;
        parliament.pendingActions = parliament.pendingActions.filter((action) => action !== pending);
        game.log('${0} becomes the chairman', (b) => b.player(player));
        game.events.recordChairmanSeated(player, previous);
        // …and only NOW the Agenda step: the office is what the step pays for.
        ChairmanSeat.advanceAgenda(player, parliament);
      } finally {
        game.events.endScope();
      }
    };
    if (parties.length === 0) {
      // Defensive: should be unreachable (7 delegates are always somewhere).
      finish(undefined);
      return undefined;
    }
    return new SelectParty('Choose which of your resolutions gives up a delegate for the chairman seat', 'Take', parties)
      .markVotePrompt({source: 'chairman-seat', cost: 0})
      .andThen((party) => {
        finish(party);
        return undefined;
      });
  }

  /** Re-derive the pending prompts after a reload (deferred actions are not serialized). */
  public static rebuildPrompts(game: IGame, parliament: Parliament): void {
    for (const pending of parliament.pendingActions) {
      const player = game.getPlayerById(pending.player);
      if (pending.kind === 'chairman-quest') {
        // THE GATE ITSELF. Without this branch the reward is lost outright: the
        // record says «not applied» and nothing would ever ask again.
        player.defer(() => ChairmanSeat.questPrompt(player, parliament), Priority.BACK_OF_THE_LINE);
      } else if (pending.kind === 'chairman-seat') {
        player.defer(() => ChairmanSeat.seatPrompt(player, parliament), Priority.BACK_OF_THE_LINE);
      }
    }
  }
}
