/*
 * COMPLETING THE CHAIRMAN QUEST (rulebook p.9, project decision Q13).
 *
 * The first player to reach the quest's count this generation advances one
 * step on the Agenda track (collecting the step's bonus) and puts a delegate
 * in the chairman's seat. The previous chairman's delegate returns to its
 * owner; a sitting chairman who completes the quest again keeps the seat and
 * only advances. The new chairman's delegate comes from the reserve, else
 * from the lobby, else from one of the player's own resolutions (the player
 * chooses which) — an eighth delegate is never created.
 */
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {PlayerInput} from '../../PlayerInput';
import {SelectParty} from '../../inputs/SelectParty';
import {InputError} from '../../inputs/InputError';
import {Priority} from '../../deferredActions/Priority';
import {PartyName} from '../../../common/turmoil/PartyName';
import type {AgendaAdvance, Parliament} from '../Parliament';

export class ChairmanSeat {
  /** Advance the Agenda marker and pay the step's bonus, attributed to the parliament. Returns what happened. */
  public static advanceAgenda(player: IPlayer, parliament: Parliament): AgendaAdvance | undefined {
    const game = player.game;
    const advance = parliament.advanceAgenda(player);
    if (advance === undefined) {
      game.log('${0} is already at the end of the Agenda track', (b) => b.player(player));
      return undefined;
    }
    game.events.withSource({kind: 'parliament'}, () => {
      game.log('${0} advances on the Agenda track to step ${1}', (b) => b.player(player).number(advance.to));
      if (advance.bonus === 'tr') {
        player.increaseTerraformRating(1, {trAttribution: {sourceType: 'other', sourceName: 'Agenda track'}});
        game.log('${0} gained ${1} ${2} from the Agenda track', (b) => b.player(player).number(1).tr());
      } else if (advance.bonus === 'card') {
        player.drawCard(1);
      }
    });
    return advance;
  }

  public static onQuestCompleted(player: IPlayer): void {
    const game = player.game;
    const parliament = game.parliament;
    if (parliament === undefined) {
      return;
    }
    game.log('${0} completed the chairman quest', (b) => b.player(player));
    ChairmanSeat.advanceAgenda(player, parliament);
    ChairmanSeat.seat(player, parliament);
  }

  private static seat(player: IPlayer, parliament: Parliament): void {
    const game = player.game;
    if (parliament.chairman === player.id) {
      game.log('${0} remains the chairman', (b) => b.player(player));
      return;
    }
    if (parliament.chairman !== undefined) {
      const previous = game.getPlayerById(parliament.chairman);
      game.log('The delegate of ${0} leaves the chairman seat', (b) => b.player(previous));
      parliament.chairman = undefined;
    }
    if (parliament.reserve(player) > 0) {
      parliament.chairman = player.id;
      game.log('${0} becomes the chairman (delegate from the reserve)', (b) => b.player(player));
      return;
    }
    if (parliament.lobby.has(player.id)) {
      parliament.lobby.delete(player.id);
      parliament.chairman = player.id;
      game.log('${0} becomes the chairman (delegate from the lobby)', (b) => b.player(player));
      return;
    }
    // Every delegate is on a resolution: the player chooses which card gives one up.
    parliament.pendingActions.push({kind: 'chairman-seat', player: player.id});
    player.defer(() => ChairmanSeat.seatPrompt(player, parliament), Priority.DEFAULT);
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
    const finish = (party: PartyName | undefined) => {
      if (party !== undefined) {
        const slot = parliament.slotOf(party as never);
        if (slot === undefined || parliament.removeLatestVote(player, slot) === undefined) {
          throw new InputError('You have no delegate on that resolution');
        }
        player.game.log('${0} takes a delegate back from ${1} for the chairman seat', (b) => b.player(player).resolution(parliament.resolutionOf(slot.instance).id));
      }
      parliament.chairman = player.id;
      parliament.pendingActions = parliament.pendingActions.filter((action) => action !== pending);
      player.game.log('${0} becomes the chairman', (b) => b.player(player));
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

  /** Re-derive the seat prompts after a reload (deferred actions are not serialized). */
  public static rebuildPrompts(game: IGame, parliament: Parliament): void {
    for (const pending of parliament.pendingActions) {
      if (pending.kind !== 'chairman-seat') {
        continue;
      }
      const player = game.getPlayerById(pending.player);
      player.defer(() => ChairmanSeat.seatPrompt(player, parliament), Priority.BACK_OF_THE_LINE);
    }
  }
}
