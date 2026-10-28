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
 * THE WALK OF THE TRACK IS ONE FUNCTION (`walkAgenda`, TR04 Minority
 * Representation): the sitting's winner step, the quest's step and a card's
 * «advance N steps» are the same walk — one step at a time, each step's bonus
 * paid before the next is taken, ONE record and ONE journal event for the
 * whole walk. The quest and the phase call it with `steps = 1`.
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
import {Resource} from '../../../common/Resource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {AgendaAdvanceStep, ResolutionId} from '../../../common/parliament/ParliamentTypes';
import type {AgendaWalkContext} from '../../cards/ICard';
import {CardReactionCause} from '../../../common/models/CardReactionModel';
import {CardName} from '../../../common/cards/CardName';
import type {Parliament} from '../Parliament';
import {chooseSeatSlot} from '../BotVoteChooser';
import {ratingVetoed} from '../ratingVetoGate';
import {AutomaTurnLog} from '../../automa/AutomaTurnLog';

/** What `seat()` did: the office changed hands here and now, or the player still has to pick the delegate. */
type SeatResult = 'seated' | 'asking';

/**
 * WHY the marker walks — the ENGINES of the Agenda track: the sitting's winner
 * step (`phase`), the chairman quest (`quest`), a card that prints «advance
 * your Agenda marker N steps» (`card`, TR04 Minority Representation) and an
 * enacted LAW that walks the seats' markers (`resolution`, Reds Budget RX39 —
 * the shared `agendaGrantStep`). A card and a law name themselves: the
 * journal, the score's provenance segment and the other players' notification
 * read the walk off the card's own play / the law's own enactment.
 */
export type AgendaWalkCause = {reason: 'quest'} | {reason: 'phase'} | {reason: 'card', card: CardName} | {reason: 'resolution', resolution: ResolutionId};

/**
 * Why the chair cannot be TAKEN by an unseat (TR76): it is empty (`vacant`), it is already the player's (`self`), or
 * the player's reserve is empty (`reserve`).
 */
export type UnseatBlocker = 'vacant' | 'self' | 'reserve';

/** What ONE walk did: where it started, where it ended, and EVERY step it took in order, each with the bonus that step paid. */
export type AgendaWalk = {from: number; to: number; steps: ReadonlyArray<AgendaAdvanceStep>};

export class ChairmanSeat {
  /**
   * THE ONE WALK OF THE AGENDA TRACK. The marker takes up to `steps` steps,
   * one at a time, and EACH step pays its own bonus before the next one is
   * taken («collect bonuses from each step»: a TR step raises the rating on
   * the spot, a card step draws — an influence step pays nothing immediately,
   * the level being a reading of the position). The end of the track cuts the
   * walk honestly: «already at the end» is logged ONCE and the walk stops; a
   * walk that took no step returns undefined and records nothing.
   *
   * ONE record for the whole walk (`parliament.lastAdvance`, `seq` + 1 once —
   * the client plays a record by its serial): `from`, `to` and every step in
   * order; the top-level `bonus` stays the LAST step's for the one-step
   * readers. ONE journal event (`agenda-advanced`) after the last step. The
   * sitting and the quest are this walk with `steps = 1`, attributed to the
   * parliament (`withSource`); a card's walk runs INSIDE the card's own play
   * and keeps that source — the journal shows the card's chip, the rival's
   * notification says «played a card» — and so does a LAW's (the seat step's
   * scope is the resolution's: the journal shows the law's chip).
   *
   * ONE RECORD PER GAME: `lastAdvance` is the LAST walk. A law walks several
   * seats in one response (`resolution`), so its walks are recorded per seat
   * by the step that called this (the phase's `agenda` outcomes) and the
   * client plays THOSE — `lastAdvance` of a law is never a presentation key. The TR's provenance segment is the
   * TRACK's for all three engines, the way the greenery revision names its
   * segment after the rule and not after who laid the tile.
   */
  public static walkAgenda(player: IPlayer, parliament: Parliament, steps: number, cause: AgendaWalkCause): AgendaWalk | undefined {
    const game = player.game;
    const walk = (): AgendaWalk | undefined => {
      const from = parliament.agendaOf(player);
      const taken: Array<AgendaAdvanceStep> = [];
      for (let i = 0; i < steps; i++) {
        const advance = parliament.advanceAgenda(player);
        if (advance === undefined) {
          game.log('${0} is already at the end of the Agenda track', (b) => b.player(player));
          break;
        }
        game.log('${0} advances on the Agenda track to step ${1}', (b) => b.player(player).number(advance.to));
        const vetoed = ChairmanSeat.payStep(player, advance.bonus, advance.to);
        taken.push({
          to: advance.to,
          ...(advance.bonus === undefined ? {} : {bonus: advance.bonus}),
          // The step's rating was REFUSED by the standing law (RX42 UNMI Veto — the seat is first by rating): the
          // marker moved, the record says the «+1 TR» did not come, and the presentation strikes it instead of flying it.
          ...(vetoed ? {vetoed: true as const} : {}),
        });
      }
      if (taken.length === 0) {
        return undefined;
      }
      const last = taken[taken.length - 1];
      // The walk is RECORDED for the client's presentation (the marker's glide
      // step by step and each step's reward, played once by its sequence
      // number) — the political phase's summary carries its own one-step copy.
      parliament.lastAdvance = {
        seq: (parliament.lastAdvance?.seq ?? 0) + 1,
        player: player.id,
        from,
        to: last.to,
        bonus: last.bonus,
        steps: taken,
        reason: cause.reason,
        ...(cause.reason === 'card' ? {card: cause.card} : {}),
        ...(cause.reason === 'resolution' ? {resolution: cause.resolution} : {}),
        generation: game.generation,
      };
      game.events.recordAgendaAdvanced(player, {from, to: last.to, steps: taken, influence: parliament.influence(player)}, cause.reason);
      // THE TABLE ANSWERS THE WALK — once, after the last step's bonus and the walk's own record (`ICard.onAgendaWalked`).
      ChairmanSeat.answerWalk(player, {from, to: last.to, steps: taken, cause});
      return {from, to: last.to, steps: taken};
    };
    // A card's and a law's walk keep the scope they run in (the card's play, the law's seat step); the sitting's
    // winner step and the quest are the parliament's own.
    return cause.reason === 'card' || cause.reason === 'resolution' ? walk() : game.events.withSource({kind: 'parliament'}, walk);
  }

  /**
   * THE ONE CALL of `ICard.onAgendaWalked` — every card of the walker's tableau carrying it, the corporation included,
   * each inside its own effect scope (the record the console's reaction scene plays; a card's walk names the card as
   * the cause). MarsBot answers nothing: it has no table of its own to answer with.
   */
  private static answerWalk(player: IPlayer, walk: AgendaWalkContext): void {
    if (player.isMarsBot === true) {
      return;
    }
    // WHAT WOKE THE EFFECT — the walk itself (and the card that made it, when a card did): the console's answer
    // stage is chosen off the record's cause, never off `lastAdvance` (one record per game, several walks a response).
    const cause: CardReactionCause = {
      ...(walk.cause.reason === 'card' ? {card: walk.cause.card} : {}),
      walk: {reason: walk.cause.reason, from: walk.from, to: walk.to},
    };
    for (const card of player.tableau) {
      if (card.onAgendaWalked === undefined) {
        continue;
      }
      player.game.events.withEffect(player, card, 'agenda-step', () => card.onAgendaWalked?.(player, walk), cause);
    }
  }

  /**
   * The step's own bonus, paid the moment the marker lands on it — before the next step is taken. Returns whether a
   * rating step was VETOED (RX42: the funnel refuses the whole event for a seat first by rating — read off the same
   * gate the funnel reads, so the record and the refusal can never disagree; the law's own line replaces the track's).
   */
  private static payStep(player: IPlayer, bonus: 'tr' | 'card' | undefined, step: number): boolean {
    const game = player.game;
    if (bonus === 'tr') {
      const vetoed = ratingVetoed(player);
      player.increaseTerraformRating(1, {trAttribution: {sourceType: 'other', sourceName: 'Agenda track'}});
      if (vetoed) {
        return true;
      }
      game.log('${0} gained ${1} ${2} from the Agenda track', (b) => b.player(player).number(1).tr());
    } else if (bonus === 'card') {
      if (player.isMarsBot) {
        // The Automa FAQ (RB-A p.11): a card MarsBot would draw is 1 M€ — it has no hand. Under the hood; the journal
        // speaks the card, as for every seat (D16 — the bot is one more player at the table).
        player.stock.add(Resource.MEGACREDITS, 1, {log: false});
        game.log('${0} draws ${1} card(s) from the Agenda track', (b) => b.player(player).number(1));
      } else {
        // The Agenda's own source: the console lifts the card off the track step — named by the STEP, so a walk with two
        // card steps (TR42 at TR 45: steps 7 and 10) parks and presents each batch on its own node, never one for both.
        player.drawCard(1, {source: {type: 'agenda', step}});
      }
    }
    return false;
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
    if (player.isMarsBot === true) {
      // THE BOT'S BRANCH (docs/TURMOIL_REDUX_MARSBOT.md §5): no gate — the bot
      // answers nothing — the office and the Agenda step here and now, inside
      // the turn that reached the count; the seat's delegate by a
      // deterministic rule (`chooseSeatSlot`), never a pick.
      ChairmanSeat.applyBotQuest(player, parliament);
      return;
    }
    parliament.pendingActions.push({kind: 'chairman-quest', player: player.id});
    player.defer(() => ChairmanSeat.questPrompt(player, parliament), Priority.BACK_OF_THE_LINE);
  }

  /**
   * THE BOT TAKES THE CHAIRMANSHIP — the human's `applyQuest` and `seat`
   * without the questions: the same journal lines, the same order (the office,
   * then the Agenda step — a card is 1 M€ for the bot), the previous holder's
   * delegate home by derivation, the seat's delegate from the reserve, else
   * the lobby, else off the resolution the rule names. One nested journal
   * group of its own inside the turn; the turn script gets a typed
   * `chairman` step so the review names the office change from data.
   */
  private static applyBotQuest(bot: IPlayer, parliament: Parliament): void {
    const game = bot.game;
    const events = game.events;
    events.beginAction(bot, {kind: 'parliament'}, {category: 'parliament'});
    try {
      game.log('${0} takes the chairmanship', (b) => b.player(bot));
      const seat = ChairmanSeat.seatBot(bot, parliament);
      const walk = ChairmanSeat.walkAgenda(bot, parliament, 1, {reason: 'quest'});
      const bonus = walk?.steps[walk.steps.length - 1].bonus;
      AutomaTurnLog.note(game, {
        kind: 'chairman',
        source: seat.source,
        ...(seat.resolution === undefined ? {} : {resolution: seat.resolution}),
        ...(seat.previous === undefined ? {} : {previous: seat.previous}),
        ...(walk === undefined ? {} : {agenda: {from: walk.from, to: walk.to, ...(bonus === undefined ? {} : {bonus})}}),
      });
    } finally {
      events.endScope();
    }
  }

  private static seatBot(bot: IPlayer, parliament: Parliament): {source: 'kept' | 'reserve' | 'lobby' | 'resolution'; resolution?: ResolutionId; previous?: Color} {
    const game = bot.game;
    if (parliament.chairman === bot.id) {
      game.log('${0} remains the chairman', (b) => b.player(bot));
      game.events.recordChairmanSeated(bot);
      return {source: 'kept'};
    }
    let previous: Color | undefined = undefined;
    if (parliament.chairman !== undefined) {
      const holder = game.getPlayerById(parliament.chairman);
      previous = holder.color;
      game.log('The delegate of ${0} leaves the chairman seat', (b) => b.player(holder));
      parliament.chairman = undefined;
    }
    if (parliament.reserve(bot) > 0) {
      parliament.chairman = bot.id;
      game.log('${0} becomes the chairman (delegate from the reserve)', (b) => b.player(bot));
      game.events.recordChairmanSeated(bot, previous);
      return {source: 'reserve', ...(previous === undefined ? {} : {previous})};
    }
    if (parliament.lobby.has(bot.id)) {
      parliament.lobby.delete(bot.id);
      parliament.chairman = bot.id;
      game.log('${0} becomes the chairman (delegate from the lobby)', (b) => b.player(bot));
      game.events.recordChairmanSeated(bot, previous);
      return {source: 'lobby', ...(previous === undefined ? {} : {previous})};
    }
    // Every delegate is on a resolution: the rule names the card (never a pick).
    const index = chooseSeatSlot(parliament, bot);
    if (index === undefined) {
      throw new Error('MarsBot has no delegate anywhere — the ledger is broken');
    }
    const slot = parliament.slots[index];
    if (parliament.removeLatestVote(bot, slot) === undefined) {
      throw new Error('MarsBot has no delegate on the resolution the rule named');
    }
    const resolution = parliament.resolutionOf(slot.instance).id;
    game.log('${0} takes a delegate back from ${1} for the chairman seat', (b) => b.player(bot).resolution(resolution));
    parliament.chairman = bot.id;
    game.log('${0} becomes the chairman', (b) => b.player(bot));
    game.events.recordChairmanSeated(bot, previous);
    return {source: 'resolution', resolution, ...(previous === undefined ? {} : {previous})};
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
        ChairmanSeat.walkAgenda(player, parliament, 1, {reason: 'quest'});
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

  /**
   * THE FIRST BLOCKER of an UNSEAT (TR76 Vote Of No Confidence:redux — «remove the current Chairman and move your own
   * delegate (from the reserve) there instead»), in the order the printed sentence needs them: somebody to remove (an
   * empty chair has no «current Chairman»), somebody ELSE (removing yourself to sit back down changes nothing the card
   * prints), a delegate in the reserve (the printed «from the reserve» — never the lobby, never a resolution).
   * `undefined` = the unseat can happen now. ONE reading for the card's gate, the hand's reason and the play.
   */
  public static unseatBlocker(player: IPlayer, parliament: Parliament): UnseatBlocker | undefined {
    if (parliament.chairman === undefined) {
      return 'vacant';
    }
    if (parliament.chairman === player.id) {
      return 'self';
    }
    return parliament.reserve(player) > 0 ? undefined : 'reserve';
  }

  /**
   * UNSEAT THE CURRENT CHAIRMAN AND SIT DOWN FROM THE RESERVE (TR76) — `seat()`'s first two branches and nothing else:
   * the outgoing delegate (a player's, MarsBot's — whoever holds the chair) leaves the seat and is back in its owner's
   * reserve by derivation (`Parliament.reserve` counts the chair out), the new one comes OUT OF THE RESERVE. Never the
   * lobby, never a resolution, never a pick (`pendingActions` is not touched), never the quest (the quest is the
   * generation's, not the office-holder's). The same lines, the same record (`chairman-seated {previous}`) the quest's
   * seating writes — the caller owns the journal root (a card's play). Throws on a blocked unseat: the gate is the
   * caller's (`unseatBlocker`), and a play that passed it cannot reach here otherwise.
   */
  public static unseatAndSeatFromReserve(player: IPlayer, parliament: Parliament): {previous: Color} {
    const blocker = ChairmanSeat.unseatBlocker(player, parliament);
    if (blocker !== undefined || parliament.chairman === undefined) {
      throw new Error(`The chairman cannot be unseated (${blocker})`);
    }
    const game = player.game;
    const holder = game.getPlayerById(parliament.chairman);
    game.log('The delegate of ${0} leaves the chairman seat', (b) => b.player(holder));
    // ONE assignment moves both cubes: the reserve is derived (7 − votes − chair − lobby), so the outgoing owner's
    // count grows and the new chairman's shrinks by this very write.
    parliament.chairman = player.id;
    game.log('${0} becomes the chairman (delegate from the reserve)', (b) => b.player(player));
    game.events.recordChairmanSeated(player, holder.color);
    return {previous: holder.color};
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
        ChairmanSeat.walkAgenda(player, parliament, 1, {reason: 'quest'});
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
