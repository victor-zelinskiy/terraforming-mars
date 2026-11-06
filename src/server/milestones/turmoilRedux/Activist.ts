import {BaseMilestone} from '../IMilestone';
import {IPlayer} from '../../IPlayer';

/** «At least 3 steps from its starting position» — the step that gives 2 influence. */
export const ACTIVIST_AGENDA_STEPS = 3;

/**
 * Turmoil Redux — «Activist»: advance your Agenda marker at least 3 steps from its starting position
 * (i.e. to the step that gives you 2 Influence).
 *
 * The score is the marker's position on the Agenda (Career) track as the Parliament keeps it
 * (`Parliament.agendaOf`): every marker starts OFF the track at 0, so the position IS the number of
 * steps walked, by whatever engine walked them (the sitting's winner step, the chairman quest, a card,
 * a law — all through `ChairmanSeat.walkAgenda`). Position 3 is the second influence step (2 influence).
 *
 * MarsBot's marker walks the same track, so its score is the player's own metric — the bot-rule registry
 * reads it as such (`src/server/automa/ma/botMARules.ts`, kind `player`) when a random set draws Activist.
 */
export class Activist extends BaseMilestone {
  constructor() {
    super(
      'Activist',
      'Advance your Agenda marker at least 3 steps from its starting position (to the step that gives 2 influence)',
      ACTIVIST_AGENDA_STEPS);
  }

  public getScore(player: IPlayer): number {
    return player.game.parliament?.agendaOf(player) ?? 0;
  }
}
