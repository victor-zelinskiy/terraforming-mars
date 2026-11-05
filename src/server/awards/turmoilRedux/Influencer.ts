import {IPlayer} from '../../IPlayer';
import {IAward} from '../IAward';

/**
 * Turmoil Redux — «Influencer»: furthest on the Agenda track.
 *
 * The award twin of Activist (`milestones/turmoilRedux/Activist.ts`): the score is the marker's position on the Agenda
 * (Career) track as the Parliament keeps it (`Parliament.agendaOf` — 0 = still at the start, 12 = the end), moved only by
 * the track's ONE walk (`ChairmanSeat.walkAgenda`). A table without a Parliament reads 0. The two share a random
 * exclusion group (`agenda-track`), so no random set offers both.
 */
export class Influencer implements IAward {
  public readonly name = 'Influencer';
  public readonly description = 'Furthest on the Agenda track';

  public getScore(player: IPlayer): number {
    return player.game.parliament?.agendaOf(player) ?? 0;
  }
}
